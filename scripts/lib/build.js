'use strict';
// 구현 단계의 결정적 부분: 지금 할 Task 계산, Task 지시서(brief) 조립, 개발 진행 기록, 검증 명령 실행과 기록.
// 진행 기록은 기계 전용 JSON(docs/_gate/build.json)이다. 08-tasks.md 의 체크박스는 설계 승인 대상이라 건드리지 않는다.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Doc, sha256 } = require('./markdown');
const P = require('./paths');
const design = require('./stages/design');
const specStage = require('./stages/spec');
const approvalLib = require('./approval');
const issuesLib = require('./issues');
const junit = require('./junit');
const fp = require('./fingerprint');

class BuildError extends Error {}

const ISSUE_TYPES = issuesLib.TYPES;
const BLOCKING = issuesLib.BLOCKING;
// 지시서 형식의 판. 기록된 판과 다르면 완료 Task 를 재검증 대상으로 본다 (근거 없이 최신으로 간주하지 않는다).
const BRIEF_VERSION = 2;
const TIMEOUT_MS = 10 * 60 * 1000;
// 검증 잠금이 이보다 오래되면 남은 잠금으로 본다 (검증 하나의 최대 실행 시간보다 길게)
const LOCK_STALE_MS = 60 * 60 * 1000;
// 명령 출력에서 '코드 실패'가 아닌 '환경 충돌'로 보는 것 (다른 프로세스가 포트를 쓰는 중)
const ENV_CONFLICT = /EADDRINUSE|address already in use|is already used|port \d+ is (?:already )?in use|already in use/i;

const exists = (root, rel) => fs.existsSync(path.join(root, rel));
// 실행 기록 파일 이름용 (초까지: 같은 분에 여러 번 실행해도 덮어쓰지 않는다)
const stampOf = (d) => `${approvalLib.stampOf(d)}${String(d.getSeconds()).padStart(2, '0')}`;
const norm = (f) => f.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

// ── 설계 읽기 ─────────────────────────────────────────────

// Task 줄의 괄호 안 "키: 값 / 키: 값" 필드 (파일 경로에 / 가 있으므로 ' / ' 로 나눈다)
function taskFields(line) {
  const body = line.replace(/\s+deps\s*:.*$/, '');
  const open = body.lastIndexOf('(');
  const close = body.lastIndexOf(')');
  const out = {};
  if (open < 0 || close < open) return out;
  for (const part of body.slice(open + 1, close).split(/\s+\/\s+/)) {
    const m = /^\s*([A-Za-z가-힣]+)\s*:\s*(.*?)\s*$/.exec(part);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// 명령 표: 용도·명령(필수), 결과 파일(JUnit XML)·실행 위치·증거(선택). 선택 열은 '-'면 없음.
function readCommands(stackDoc) {
  if (!stackDoc) return [];
  const base = design.tableRows(stackDoc, '명령', ['용도', '명령']) || [];
  const opt = (col) => design.tableRows(stackDoc, '명령', ['용도', '명령', col]) || [];
  const extra = { report: opt('결과 파일'), exec: opt('실행 위치'), evidence: opt('증거') };
  const val = (rows, line, col) => {
    const v = ((rows.find((x) => x.line === line) || {})[col] || '').trim();
    return v === '-' ? '' : v;
  };
  return base.map((r) => ({
    ...r,
    use: r['용도'].toLowerCase(),
    report: val(extra.report, r.line, '결과 파일'),
    exec: val(extra.exec, r.line, '실행 위치').toLowerCase(),
    evidence: val(extra.evidence, r.line, '증거'),
  }));
}

function loadDesign(root) {
  const tasksDoc = Doc.load(root, P.design('tasks'));
  if (!tasksDoc) throw new BuildError(`작업 목록이 없다: ${P.design('tasks')}`);
  const planDoc = Doc.load(root, P.design('test-plan'));
  const stackDoc = Doc.load(root, P.design('tech-stack'));
  const specDoc = Doc.load(root, P.spec);
  const tasks = design.readTasks(tasksDoc).map((t) => {
    const line = tasksDoc.lines[t.line - 1];
    const fields = taskFields(line);
    const title = line.replace(/^- \[[ x]\] \*\*T-\d{3}\*\*\s*/, '').replace(/\s*\(.*$/, '').trim();
    const files = (fields.file || '').split(',').map((s) => norm(s.trim())).filter((s) => s && s !== '-');
    return { ...t, title, raw: line, fields, files };
  });
  const tcs = planDoc ? design.readTestPlan(planDoc) : [];
  const envs = stackDoc ? (design.tableRows(stackDoc, '시험 환경', ['실행 위치']) || []) : [];
  return { tasksDoc, planDoc, stackDoc, specDoc, tasks, tcs, commands: readCommands(stackDoc), envs, spec: specDoc ? specStage.read(specDoc) : null };
}

// 헤딩 줄(0부터)에서 시작하는 블록: 같거나 높은 수준의 다음 헤딩 전까지
function headingBlock(doc, line0) {
  const h = doc.headings.find((x) => x.line === line0);
  if (!h) return doc.lines[line0] || '';
  const next = doc.headings.find((x) => x.line > h.line && x.level <= h.level);
  return doc.lines.slice(h.line, next ? next.line : doc.lines.length).join('\n').trimEnd();
}

// 문서에서 needle 이 나오는 곳의 맥락: 헤딩이면 그 블록, 표 행이면 머리줄+그 행, 아니면 그 문단
function contextOf(doc, needle) {
  const out = [];
  const seen = new Set();
  doc.lines.forEach((l, i) => {
    if (!l.includes(needle)) return;
    let text;
    if (/^#{1,6}\s/.test(l)) text = headingBlock(doc, i);
    else if (/^\s*\|/.test(l)) {
      let s = i;
      while (s > 0 && /^\s*\|/.test(doc.lines[s - 1])) s--;
      text = [doc.lines[s], doc.lines[s + 1], l].filter((x, k, a) => a.indexOf(x) === k).join('\n');
    } else {
      let s = i;
      let e = i;
      while (s > 0 && doc.lines[s - 1].trim() && !/^#{1,6}\s/.test(doc.lines[s - 1])) s--;
      while (e < doc.lines.length - 1 && doc.lines[e + 1].trim() && !/^#{1,6}\s/.test(doc.lines[e + 1])) e++;
      text = doc.lines.slice(s, e + 1).join('\n');
    }
    if (!seen.has(text)) { seen.add(text); out.push(text); }
  });
  return out;
}

// ── 진행 기록 ─────────────────────────────────────────────

function readState(root) {
  const p = path.join(root, P.buildState);
  if (!fs.existsSync(p)) return { tasks: {}, install: null, env: null };
  try {
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { tasks: s.tasks || {}, install: s.install || null, env: s.env || null };
  } catch {
    throw new BuildError(`${P.buildState}를 읽을 수 없다 (JSON 형식 오류)`);
  }
}

function writeState(root, state) {
  const p = path.join(root, P.buildState);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

// ── 구현 중 보고 ──────────────────────────────────────────

function readIssues(root) {
  const parsed = issuesLib.load(root);
  return parsed ? { doc: parsed.doc, issues: parsed.issues, problems: parsed.problems } : { doc: null, issues: [], problems: [] };
}

// 미해결 설계·명세·하네스 결함이 멈추게 하는 Task (영향 Task 와 그 뒤에 deps 로 이어진 Task)
function blockedTasks(tasks, issues) {
  const open = issues.filter((i) => BLOCKING.includes(i.type) && i.state === '미해결');
  const blocked = new Map();
  if (open.some((i) => i.all)) {
    for (const t of tasks) blocked.set(t.id, open.filter((i) => i.all).map((i) => i.id));
    return blocked;
  }
  for (const i of open) for (const id of i.tasks) blocked.set(id, [...(blocked.get(id) || []), i.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (blocked.has(t.id)) continue;
      const by = t.deps.filter((d) => blocked.has(d)).flatMap((d) => blocked.get(d));
      if (by.length) { blocked.set(t.id, [...new Set(by)]); changed = true; }
    }
  }
  return blocked;
}

// ── 설계 승인 확인 ────────────────────────────────────────

// 설계 내용 검사와 승인(해시·상류 해시)이 모두 유효해야 구현할 수 있다
function designGate(root) {
  const { runGate } = require('./run'); // run → stages → build 단계가 이 파일을 쓰므로 늦게 불러온다
  const r = runGate({ root, stage: 'design', approved: true, log: false });
  return { ok: r.exitCode === 0, errors: r.errors };
}

// ── Task 지시서 ───────────────────────────────────────────

const shortHash = (root, rel) => (exists(root, rel) ? sha256(fs.readFileSync(path.join(root, rel), 'utf8')).slice(0, 12) : '없음');

// 지시서는 결정적이어야 한다 (진행 상태·시각을 넣지 않는다). 해시가 Task 의 '근거 해시'다.
// 발췌하지 않고 경로만 안내하는 설계 문서는 '근거 문서 판'에 내용 해시를 넣어, 그 문서가 바뀌면 근거도 바뀌게 한다.
function brief(root, id, d = loadDesign(root)) {
  const t = d.tasks.find((x) => x.id === id);
  if (!t) throw new BuildError(`${P.design('tasks')}에 ${id}가 없다`);
  const out = [];
  out.push(`# Task 지시서: ${t.id}`, '');
  out.push(`- 지시서 판: ${BRIEF_VERSION}`, `- 작업: ${t.title}`, `- Wave: ${t.wave === null ? '-' : t.wave}`, `- 앱 루트: \`${P.app}/\` (모든 파일 경로는 앱 루트 기준. 명령도 앱 루트에서 실행한다)`);
  out.push(`- 만들 파일: ${t.files.length ? t.files.map((f) => `\`${f}\``).join(', ') : '(지정 없음)'}`);
  out.push(`- 선행 Task: ${t.deps.length ? t.deps.join(', ') : '없음'}`, '');
  out.push('## Task 줄 (08-tasks.md)', '', t.raw, '');

  // 요구사항 원문
  out.push('## 요구사항 원문 (04-spec/spec.md)', '');
  const s = d.spec;
  const specText = [];
  for (const c of t.covers) {
    const fr = s && s.frs.find((x) => x.id === c);
    const nfr = s && s.nfrs.find((x) => x.id === c);
    const uc = s && s.ucs.find((x) => x.id === c);
    const scr = s && s.scrs.find((x) => x.id === c);
    if (fr) specText.push(fr.lines.join('\n'));
    else if (nfr) specText.push(nfr.lines.join('\n'));
    else if (uc) specText.push(`### ${uc.id}\n${uc.text.trim()}`);
    else if (scr && d.specDoc) specText.push(contextOf(d.specDoc, scr.id)[0] || scr.id);
    else specText.push(`- ${c} (본문 발췌 없음: ${P.spec}에서 찾는다)`);
  }
  out.push(specText.length ? specText.join('\n\n') : '(covers 없음)', '');

  // 담당 시험 시나리오
  out.push('## 담당 시험 시나리오 (05-design/07-test-plan.md)', '');
  const check = t.check || [];
  if (check.length && d.planDoc) {
    out.push(
      '테스트 코드를 이 Task 에서 함께 쓴다. **각 테스트(testcase) 이름에 TC ID 를 넣는다** (예: `TC-003 필수 항목이 비면 제출되지 않는다`).',
      '- 검증은 결과 파일(JUnit XML)의 testcase 이름·classname 과 그것을 감싸는 testsuite 이름에서 TC ID 를 찾는다. describe 이름에만 넣으면 describe 를 testsuite 로 내보내지 않는 러너에서는 결과에 없음이 된다. **주석은 인정하지 않는다.**',
      '- 담당 TC 의 테스트를 건너뛰게(skip·only·todo) 두거나 테스트 설정의 포함 범위 밖에 두면 실패다.',
      '',
    );
    for (const c of check) {
      const tc = d.tcs.find((x) => x.id === c);
      out.push(tc ? headingBlock(d.planDoc, tc.line - 1) : `### ${c}\n(시험 계획에 없음)`, '');
    }
  } else out.push('없음 (이 Task 는 명령 검증만 받는다)', '');

  // 파일 명세
  out.push('## 파일 명세 (05-design/06-file-map.md)', '');
  const fm = Doc.load(root, P.design('file-map'));
  if (fm && t.files.length) {
    for (const f of t.files) {
      const ctx = contextOf(fm, f);
      out.push(`### \`${f}\``, '', ctx.length ? ctx.join('\n\n') : '(file-map 에서 이 경로를 찾지 못했다)', '');
    }
  } else out.push('(파일 지정 없음)', '');

  // 명령
  out.push('## 검증 명령 (05-design/01-tech-stack.md `명령` 표)', '');
  if (d.commands.length) {
    out.push('| 용도 | 명령 | 실행 위치 | 결과 파일 |', '|------|------|-----------|-----------|',
      ...d.commands.map((c) => `| ${c['용도']} | \`${c['명령']}\` | ${c.exec || '-'} | ${c.report ? `\`${c.report}\`` : '-'} |`), '');
    out.push('- `lint`·`build`와 실행 위치가 없는 시험 명령은 매번 돌린다. 실행 위치가 있는 시험 명령은 이 Task 나 이미 끝난 Task 가 그 실행 위치의 TC 를 맡았을 때만 돌린다.', '');
    if (d.commands.some((c) => c.report)) out.push('- 결과 파일(JUnit XML)에서 **TC 마다** 통과를 확인한다. 담당 TC 의 테스트가 결과에 없거나 건너뜀이면 실패다.', '');
  } else out.push('(명령 표 없음)', '');

  // 더 볼 곳과 근거 문서 판
  const more = [];
  const refs = [];
  if (t.fields.data) { more.push(`- 데이터: ${t.fields.data} → \`${P.design('data-model')}\``); refs.push(P.design('data-model')); }
  if (t.fields.api) { more.push(`- 인터페이스: ${t.fields.api} → \`${P.design('api-spec')}\``); refs.push(P.design('api-spec')); }
  const scrs = t.covers.filter((c) => c.startsWith('SCR-'));
  if (scrs.length) {
    more.push(`- 화면: ${scrs.join(', ')} → \`${P.design('ui-spec')}\`, ${scrs.map((x) => `\`${P.wireframes}/${x}.svg\``).join(', ')}`);
    refs.push(P.design('ui-spec'), ...scrs.map((x) => `${P.wireframes}/${x}.svg`));
  }
  more.push(`- 구조·규칙·기술 결정: \`${P.design('architecture')}\``);
  refs.push(P.design('architecture'));
  if (t.deps.length) {
    const depFiles = t.deps.map((x) => d.tasks.find((y) => y.id === x)).filter(Boolean).flatMap((y) => y.files);
    if (depFiles.length) more.push(`- 선행 Task 가 만든 파일 (실제 시그니처를 맞춘다): ${[...new Set(depFiles)].map((f) => `\`${P.app}/${f}\``).join(', ')}`);
  }
  out.push('## 더 볼 곳 (필요한 부분만 읽는다)', '', ...more, '');
  out.push('## 근거 문서 판 (이 문서들이 바뀌면 이 Task 는 다시 검증한다)', '', ...refs.map((r) => `- \`${r}\` ${shortHash(root, r)}`), '');
  const text = `${out.join('\n').trimEnd()}\n`;
  return { id, text, hash: sha256(text), task: t };
}

// ── Task 상태 ────────────────────────────────────────────
// status: todo | done | stale | failed | unavailable | conflict
// work  : 개발 진행 (developing 개발 중 / handoff 검증 대기 / paused 중단). 완료 판정은 verify 만 한다.

function taskStates(root, d = loadDesign(root), state = readState(root)) {
  const { issues } = readIssues(root);
  const blocked = blockedTasks(d.tasks, issues);
  const map = new Map();
  for (const t of d.tasks) {
    const rec = state.tasks[t.id];
    const h = brief(root, t.id, d).hash;
    let status = 'todo';
    if (rec && rec.status === 'done') status = rec.briefHash === h && rec.briefVersion === BRIEF_VERSION ? 'done' : 'stale';
    else if (rec && rec.status) status = rec.status;
    map.set(t.id, { task: t, status, work: (rec && rec.work) || null, blockedBy: blocked.get(t.id) || [], attempts: rec ? rec.attempts || 0 : 0 });
  }
  return map;
}

// 두 Task 사이의 의존 관계 (어느 쪽이든 deps 로 이어지면 true)
function related(tasks, a, b) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const reach = (from, to, seen = new Set()) => {
    if (seen.has(from)) return false;
    seen.add(from);
    const t = byId.get(from);
    return Boolean(t) && t.deps.some((x) => x === to || reach(x, to, seen));
  };
  return reach(a, b) || reach(b, a);
}
const overlaps = (fa, fb) => fa.filter((x) => fb.some((y) => x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)));

// 지금 개발 중인 Task 들과 함께 시작할 수 있는가 (의존 관계가 없고 파일이 겹치지 않아야 한다)
function parallelConflicts(d, states, id) {
  const t = d.tasks.find((x) => x.id === id);
  const out = [];
  for (const [other, s] of states) {
    if (other === id || !s.work || s.work.state !== 'developing') continue;
    if (related(d.tasks, id, other)) out.push(`${other}와 의존 관계가 있다`);
    const same = overlaps(t.files, s.task.files);
    if (same.length) out.push(`${other}와 파일이 겹친다 (${same.join(', ')})`);
    if (!t.files.length || !s.task.files.length) out.push(`${!t.files.length ? id : other}의 파일이 지정되지 않아 겹침을 확인할 수 없다`);
  }
  return out;
}

const readLock = (root) => {
  const p = path.join(root, P.buildLock);
  if (!fs.existsSync(p)) return null;
  try {
    const l = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Date.now() - Date.parse(l.at) > LOCK_STALE_MS ? null : l;
  } catch { return null; }
};

function next(root) {
  const gate = designGate(root);
  if (!gate.ok) {
    return { ok: false, reason: 'design', message: '설계 승인이 유효하지 않다 (설계가 바뀌었거나 승인·상류가 낡았다). 설계를 확인하고 다시 승인받는다.', errors: gate.errors.slice(0, 5) };
  }
  const d = loadDesign(root);
  const states = taskStates(root, d);
  const isDone = (id) => (states.get(id) || {}).status === 'done';
  const runnable = [];
  const waiting = [];
  const blocked = [];
  const developing = [];
  const handoff = [];
  const paused = [];
  for (const [id, s] of states) {
    if (s.status === 'done') continue;
    if (s.blockedBy.length) { blocked.push({ id, by: s.blockedBy }); continue; }
    if (s.work && s.work.state === 'developing') { developing.push({ id, title: s.task.title, since: s.work.at }); continue; }
    if (s.work && s.work.state === 'handoff') { handoff.push({ id, title: s.task.title, files: s.work.files || [], note: s.work.note || '' }); continue; }
    if (s.work && s.work.state === 'paused') { paused.push({ id, title: s.task.title, reason: s.work.reason || '', files: s.work.files || [] }); continue; }
    const missing = s.task.deps.filter((x) => !isDone(x));
    if (missing.length) { waiting.push({ id, waitingFor: missing }); continue; }
    runnable.push({ id, title: s.task.title, wave: s.task.wave, status: s.status, attempts: s.attempts, files: s.task.files, conflicts: parallelConflicts(d, states, id) });
  }
  const order = { stale: 0, conflict: 1, failed: 1, unavailable: 1, todo: 2 };
  runnable.sort((a, b) => order[a.status] - order[b.status] || (a.wave ?? 99) - (b.wave ?? 99) || a.id.localeCompare(b.id));
  // 함께 시작할 수 있는 묶음: 앞에서부터 서로 의존 관계가 없고 파일이 겹치지 않는 것 (개발 중인 것과도)
  const parallel = [];
  for (const r of runnable) {
    if (r.conflicts.length) continue;
    if (parallel.every((p) => !related(d.tasks, p.id, r.id) && overlaps(p.files, r.files).length === 0 && p.files.length && r.files.length)) parallel.push(r);
  }
  const all = [...states.values()];
  return {
    ok: true,
    total: all.length,
    done: all.filter((s) => s.status === 'done').length,
    stale: all.filter((s) => s.status === 'stale').map((s) => s.task.id),
    handoff, paused, developing, runnable, parallel: parallel.map((p) => p.id), waiting, blocked,
    verifying: readLock(root),
    finished: all.every((s) => s.status === 'done'),
  };
}

// ── 개발 진행 기록 ────────────────────────────────────────

// 개발을 시작한다. 다른 Task 가 개발 중이면 의존 관계가 없고 파일이 겹치지 않을 때만 함께 시작할 수 있다.
function start(root, id, { now = new Date() } = {}) {
  const gate = designGate(root);
  if (!gate.ok) throw new BuildError('설계 승인이 유효하지 않아 개발을 시작하지 않는다');
  if (readLock(root)) throw new BuildError(`검증이 진행 중이다 (${readLock(root).id}). 검증 중에는 개발을 시작하지 않는다`);
  const d = loadDesign(root);
  const state = readState(root);
  const states = taskStates(root, d, state);
  const s = states.get(id);
  if (!s) throw new BuildError(`${P.design('tasks')}에 ${id}가 없다`);
  if (s.status === 'done') throw new BuildError(`${id}는 이미 검증되었다`);
  if (s.blockedBy.length) throw new BuildError(`${id}는 미해결 보고(${s.blockedBy.join(', ')})로 멈춰 있다`);
  const notDone = s.task.deps.filter((x) => (states.get(x) || {}).status !== 'done');
  if (notDone.length) throw new BuildError(`${id}의 선행 Task(${notDone.join(', ')})가 검증되지 않았다`);
  if (s.work && s.work.state === 'developing') throw new BuildError(`${id}는 이미 개발 중이다 (${s.work.at})`);
  const conflicts = parallelConflicts(d, states, id);
  if (conflicts.length) throw new BuildError(`${id}를 지금 시작할 수 없다: ${conflicts.join('; ')}. 개발 중인 Task 가 돌아온 뒤 시작한다`);
  const rec = state.tasks[id] || {};
  const resumed = Boolean(rec.work && rec.work.state === 'paused');
  rec.work = { state: 'developing', at: now.toISOString(), briefHash: brief(root, id, d).hash, files: (rec.work && rec.work.files) || [], resumedFrom: resumed ? rec.work.reason || '중단' : undefined };
  state.tasks[id] = rec;
  writeState(root, state);
  return { id, resumed, parallelWith: [...states].filter(([x, v]) => x !== id && v.work && v.work.state === 'developing').map(([x]) => x) };
}

// 개발자가 돌아왔다: 검증 대기로 둔다 (바꾼 파일·설계와 다른 점·결정 필요를 남긴다)
function handoff(root, id, { files = [], note = '', decisions = '', now = new Date() } = {}) {
  const state = readState(root);
  const rec = state.tasks[id];
  if (!rec || !rec.work || !['developing', 'paused'].includes(rec.work.state)) throw new BuildError(`${id}는 개발 중이 아니다 (node scripts/build.js start ${id} 로 시작한다)`);
  rec.work = { ...rec.work, state: 'handoff', at: now.toISOString(), files: files.map(norm), note, decisions };
  writeState(root, state);
  return { id, state: 'handoff' };
}

// 개발이 중단됐다 (사용량 제한·세션 종료 등). 검증 실패 횟수에 넣지 않는다.
function pause(root, id, { reason = '', files = [], now = new Date() } = {}) {
  const state = readState(root);
  const rec = state.tasks[id];
  if (!rec || !rec.work || rec.work.state !== 'developing') throw new BuildError(`${id}는 개발 중이 아니다`);
  rec.work = { ...rec.work, state: 'paused', at: now.toISOString(), reason, files: [...new Set([...(rec.work.files || []), ...files.map(norm)])] };
  writeState(root, state);
  return { id, state: 'paused' };
}

// ── 명령 실행 ─────────────────────────────────────────────

// 셸 내장 명령 (PATH 에서 찾지 않는다)
const BUILTINS = new Set(['echo', 'cd', 'set', 'exit', 'true', 'false', 'test', '[', 'type', 'dir', 'copy', 'del', 'mkdir', 'rem', 'call', 'start', 'pushd', 'popd', 'export', 'source', '.']);

// 명령의 첫 실행 파일 (앞의 VAR=값 할당은 건너뛴다)
function firstProgram(cmd) {
  const tokens = cmd.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  const t = tokens.find((x) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(x));
  return t ? t.replace(/^["']|["']$/g, '') : '';
}

// 실행 파일을 찾을 수 있는가. cmd.exe 는 '명령 없음'에도 종료 코드 1 을 돌려주고 메시지가 지역화되어 있어, 실행 전에 직접 찾는다.
function programExists(prog, cwd) {
  if (!prog || BUILTINS.has(prog.toLowerCase())) return true;
  const exts = process.platform === 'win32' ? ['', ...(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)] : [''];
  const isFile = (p) => exts.some((e) => { try { return fs.statSync(p + e).isFile(); } catch { return false; } });
  if (/[\\/]/.test(prog)) return isFile(path.resolve(cwd, prog));
  return (process.env.PATH || '').split(path.delimiter).filter(Boolean).some((dir) => isFile(path.join(dir, prog)));
}

// 명령을 앱 루트에서 실행한다. 실행 파일을 찾지 못하면(사전 확인, 127, ENOENT) '실행 불가'로 본다.
function runCommand(cwd, use, cmd) {
  const started = Date.now();
  const prog = firstProgram(cmd);
  if (!programExists(prog, cwd)) {
    return { use, cmd, status: 'unavailable', exit: null, ms: 0, output: `실행 파일을 찾지 못했다: ${prog}\n`, timedOut: false };
  }
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', timeout: TIMEOUT_MS, env: { ...process.env, CI: '1' }, maxBuffer: 64 * 1024 * 1024 });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  let status;
  if (r.error && r.error.code === 'ENOENT') status = 'unavailable';
  else if (r.error && r.error.code === 'ETIMEDOUT') status = 'failed';
  else if (r.status === 0) status = 'passed';
  else if (r.status === 127 || r.status === 9009) status = 'unavailable';
  else status = 'failed';
  const envConflict = status === 'failed' && ENV_CONFLICT.test(output);
  return { use, cmd, status, exit: r.status, ms: Date.now() - started, output, envConflict, timedOut: Boolean(r.error && r.error.code === 'ETIMEDOUT') };
}

const isTest = (use) => use === 'test' || use.startsWith('test:');
// 검증에 쓰는 명령: lint → build → test 계열 (표 순서 유지). execs 가 주어지면, 실행 위치가 있는 시험 명령은 그 안에 있을 때만.
function verifyCommands(commands, execs = null) {
  const pick = (f) => commands.filter((c) => f(c.use));
  const tests = pick(isTest);
  const run = tests.filter((c) => !execs || !c.exec || execs.has(c.exec));
  return { run: [...pick((u) => u === 'lint'), ...pick((u) => u === 'build'), ...run], skipped: tests.filter((c) => !run.includes(c)) };
}

// 앱 루트의 파일에서 TC ID 를 찾는다 (결과 파일이 없는 설계에서만 쓴다)
function tcIdsInCode(root) {
  const base = path.join(root, P.app);
  const found = new Map();
  if (!fs.existsSync(base)) return found;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || fp.GENERATED_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && fs.statSync(p).size < 1024 * 1024) {
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/\bTC-\d{3}\b/g)) {
          const rel = path.relative(root, p).split(path.sep).join('/');
          if (!found.has(m[0])) found.set(m[0], new Set());
          found.get(m[0]).add(rel);
        }
      }
    }
  };
  walk(base);
  return found;
}

const TC_WORD = { failed: '실패', skipped: '건너뜀(skip)', missing: '테스트 결과에 없음 (실행되지 않았다 — 각 테스트 이름의 TC ID 와 테스트 설정의 포함 범위를 확인한다)' };

// 명령을 실행한다. 결과 파일이 있는 명령은 실행 전에 옛 결과 파일을 지우고, 실행 뒤에 읽는다.
function runChecks(root, cmds) {
  const app = ensureApp(root);
  const runs = [];
  const reports = [];
  for (const c of cmds) {
    const rp = c.report ? path.join(app, c.report) : null;
    if (rp) fs.rmSync(rp, { force: true });
    const r = runCommand(app, c['용도'], c['명령']);
    runs.push(r);
    if (!rp) continue;
    if (r.status === 'unavailable' || !fs.existsSync(rp)) { reports.push({ use: c['용도'], report: c.report, exists: false }); continue; }
    const parsed = junit.parse(fs.readFileSync(rp, 'utf8'));
    reports.push({ use: c['용도'], report: c.report, exists: true, cases: parsed.cases, byTc: parsed.byTc });
  }
  // 결과 파일이 하나라도 설정되어 있으면 TC 별로 판정한다 (없으면 null: 전체 결과 + 코드 검색으로 대신한다)
  let byTc = null;
  if (reports.length) {
    byTc = new Map();
    for (const rep of reports) if (rep.exists) for (const [id, list] of rep.byTc) byTc.set(id, [...(byTc.get(id) || []), ...list]);
  }
  const tcStatus = (id) => (byTc.has(id) ? junit.combine(byTc.get(id)) : 'missing');
  return { runs, reports, perTc: byTc !== null, tcStatus };
}

function writeRunLog(root, dir, name, now, runs, extra = []) {
  const p = path.join(root, dir, `${name}-${stampOf(now)}.log`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const body = [...extra, ...runs.map((r) => `===== ${r.use}: ${r.cmd}\n상태: ${r.status}${r.envConflict ? ' (환경 충돌)' : ''} (종료 코드 ${r.exit}, ${r.ms}ms${r.timedOut ? ', 시간 초과' : ''})\n${r.output}`)].join('\n');
  fs.writeFileSync(p, body, 'utf8');
  return path.relative(root, p).split(path.sep).join('/');
}

function ensureApp(root) {
  const app = path.join(root, P.app);
  fs.mkdirSync(app, { recursive: true });
  return app;
}

// install 명령. 성공 기록이 없거나 force 면 실행한다.
function install(root, { force = false, now = new Date(), d = loadDesign(root), state = readState(root) } = {}) {
  if (state.install && state.install.status === 'passed' && !force) return { skipped: true, status: 'passed' };
  const row = d.commands.find((c) => c.use === 'install');
  if (!row) throw new BuildError("명령 표에 'install' 이 없다");
  const r = runCommand(ensureApp(root), 'install', row['명령']);
  const log = writeRunLog(root, P.buildRuns, 'install', now, [r]);
  state.install = { status: r.status, at: now.toISOString(), log };
  writeState(root, state);
  return { skipped: false, status: r.status, log };
}

// 구현 기록(build-log.md)에 Task 블록을 쓴다. 이미 있으면 그 블록 끝에 재검증 줄을 더한다.
function logBlock(root, t, { log, files, note, now }) {
  const p = path.join(root, P.buildLog);
  const text = fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
  const doc = new Doc(P.buildLog, text);
  const h = doc.headings.find((x) => x.level === 3 && x.clean.startsWith(t.id));
  const lines = text.split('\n');
  if (h) {
    const nextH = doc.headings.find((x) => x.line > h.line && x.level <= 3);
    let at = nextH ? nextH.line : lines.length;
    while (at > h.line + 1 && !lines[at - 1].trim()) at--;
    lines.splice(at, 0, `- 재검증: 통과 (${log}, ${approvalLib.dateOf(now)})${note ? ` — 설계와 다른 점: ${note}` : ''}`);
  } else {
    const block = ['', `### ${t.id} ${t.title}`, `- 검증: 통과 (${log})`, `- 바꾼 파일: ${files.length ? files.map((f) => `${P.app}/${f}`).join(', ') : '(기록 없음)'}`, `- 설계와 다른 점: ${note || '없음'}`];
    // 'Task 기록' 섹션 끝에 넣는다
    const sec = doc.findHeading('Task 기록');
    let at = sec ? sec.end : lines.length;
    while (at > 0 && !lines[at - 1].trim()) at--;
    lines.splice(at, 0, ...block);
  }
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
}

// Task 검증: 명령을 실제로 실행하고, 담당 TC 를 결과 파일에서 TC 별로 확인한다 (결과 파일이 없으면 코드에 TC ID 가 있는지로 대신한다).
// 통과해야만 완료로 기록하고 구현 기록에 블록을 쓴다. 검증 중에는 잠금을 두고, 앱 파일이 바뀌면 결과를 버린다.
function verify(root, id, { forceInstall = false, note = '', now = new Date() } = {}) {
  const gate = designGate(root);
  if (!gate.ok) throw new BuildError('설계 승인이 유효하지 않아 검증하지 않는다. 설계를 확인하고 다시 승인받는다 (node scripts/gate.js design --approved)');
  if (!exists(root, P.buildLog)) throw new BuildError(`${P.buildLog}가 없다 (node scripts/build.js init)`);
  const d = loadDesign(root);
  const state = readState(root);
  const states = taskStates(root, d, state);
  const s = states.get(id);
  if (!s) throw new BuildError(`${P.design('tasks')}에 ${id}가 없다`);
  if (s.blockedBy.length) throw new BuildError(`${id}는 미해결 보고(${s.blockedBy.join(', ')})로 멈춰 있다. 보고를 먼저 처리한다`);
  const notDone = s.task.deps.filter((x) => (states.get(x) || {}).status !== 'done');
  if (notDone.length) throw new BuildError(`${id}의 선행 Task(${notDone.join(', ')})가 검증되지 않았다`);
  const others = [...states].filter(([x, v]) => x !== id && v.work && v.work.state === 'developing').map(([x]) => x);
  if (others.length) throw new BuildError(`개발 중인 Task(${others.join(', ')})가 있어 검증하지 않는다 — 검증 중에 파일이 바뀔 수 있다. 그 개발자가 돌아온 뒤(handoff) 검증한다`);
  const lock = readLock(root);
  if (lock) throw new BuildError(`다른 검증(${lock.id})이 진행 중이다`);

  const lockPath = path.join(root, P.buildLock);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify({ id, pid: process.pid, at: now.toISOString() }), 'utf8');
  try {
    const ins = install(root, { force: forceInstall, now, d, state });
    let runs = [];
    const problems = [];
    const tcs = {};
    let perTc = false;
    let skipped = [];
    // 실행 위치가 있는 시험 명령은 이 Task 나 이미 끝난 Task 가 그 실행 위치의 TC 를 맡았을 때만 돌린다
    const execOf = (c) => (d.tcs.find((x) => x.id === c) || {}).exec;
    const execs = new Set([...(s.task.check || []), ...[...states.values()].filter((v) => v.status === 'done').flatMap((v) => v.task.check || [])].map(execOf).filter(Boolean));
    const plan = verifyCommands(d.commands, execs);
    if (!d.commands.some((c) => isTest(c.use))) problems.push('명령 표에 test 명령이 없다');
    const reportFiles = d.commands.map((c) => c.report).filter(Boolean);
    const before = fp.app(root, reportFiles);
    if (ins.status !== 'passed') problems.push(`install ${ins.status === 'unavailable' ? '실행 불가' : '실패'} (${ins.log})`);
    else {
      const res = runChecks(root, plan.run);
      runs = res.runs;
      perTc = res.perTc;
      skipped = plan.skipped.map((c) => c['용도']);
      for (const r of runs) if (r.status !== 'passed') problems.push(`${r.use} ${r.envConflict ? '환경 충돌(포트 등 다른 프로세스가 사용 중)' : r.status === 'unavailable' ? '실행 불가' : '실패'}: ${r.cmd}`);
      for (const rep of res.reports) {
        const run = runs.find((r) => r.use === rep.use);
        if (!rep.exists && run && run.status !== 'unavailable') problems.push(`${rep.use}의 결과 파일 ${P.app}/${rep.report}가 만들어지지 않았다 (명령 표의 결과 파일 옵션을 확인한다)`);
      }
      const inCode = perTc ? null : tcIdsInCode(root);
      for (const c of s.task.check || []) {
        const tc = d.tcs.find((x) => x.id === c);
        if (!tc || tc.exec === 'manual') continue;
        if (perTc) {
          tcs[c] = res.tcStatus(c);
          if (tcs[c] !== 'passed') problems.push(`${c}: ${TC_WORD[tcs[c]]}`);
        } else {
          tcs[c] = inCode.has(c) ? 'in-code' : 'missing';
          if (!inCode.has(c)) problems.push(`${c}가 앱 코드(${P.app}/)에 없다 — 테스트 이름에 TC ID 를 넣는다`);
        }
      }
    }
    const changed = fp.app(root, reportFiles) !== before;
    if (changed) problems.unshift('검증 중에 앱 파일이 바뀌었다 — 결과를 버린다. 개발 중인 작업이나 직접 띄운 프로세스가 없는지 확인하고 다시 검증한다');

    const envConflict = runs.some((r) => r.envConflict);
    const unavailable = ins.status === 'unavailable' || runs.some((r) => r.status === 'unavailable');
    const status = problems.length === 0 ? 'done'
      : changed || envConflict ? 'conflict'
        : unavailable && !runs.some((r) => r.status === 'failed') ? 'unavailable' : 'failed';
    const log = writeRunLog(root, P.buildRuns, id, now, runs, [`Task ${id} 검증 ${now.toISOString()}`, ...problems.map((p) => `문제: ${p}`), ...(skipped.length ? [`건너뛴 시험 명령(아직 그 실행 위치의 TC 를 맡은 Task 가 없다): ${skipped.join(', ')}`] : []), '']);
    const prev = state.tasks[id] || {};
    const work = prev.work || null;
    // 코드 실패만 시도 횟수에 넣는다 (환경 충돌·검증 중 변경·실행 불가는 코드 탓이 아니다)
    const attempts = status === 'done' ? 0 : status === 'failed' ? (prev.attempts || 0) + 1 : prev.attempts || 0;
    state.tasks[id] = {
      status,
      briefHash: status === 'done' ? brief(root, id, d).hash : prev.briefHash || null,
      briefVersion: status === 'done' ? BRIEF_VERSION : prev.briefVersion || null,
      verifiedAt: status === 'done' ? now.toISOString() : prev.verifiedAt || null,
      attempts,
      work: status === 'done' ? null : work,
      last: { at: now.toISOString(), status, log, perTc, tcs, skipped, commands: runs.map((r) => ({ use: r.use, status: r.status, exit: r.exit, envConflict: r.envConflict || false })), problems },
    };
    if (state.tasks[id].work === null) delete state.tasks[id].work;
    writeState(root, state);
    if (status === 'done') logBlock(root, s.task, { log, files: (work && work.files) || [], note: note || (work && work.note) || '', now });
    return { id, status, problems, log, perTc, tcs, skipped, runs: runs.map((r) => ({ use: r.use, cmd: r.cmd, status: r.status, exit: r.exit, envConflict: r.envConflict || false })), attempts };
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

// ── 시험 환경 점검 ────────────────────────────────────────

function doctor(root, { now = new Date() } = {}) {
  const d = loadDesign(root);
  const runs = [];
  const result = [];
  const withCmd = d.stackDoc ? design.tableRows(d.stackDoc, '시험 환경', ['실행 위치', '확인']) || [] : [];
  for (const e of d.envs) {
    const exec = e['실행 위치'].toLowerCase();
    const tcCount = d.tcs.filter((t) => t.exec === exec).length;
    const row = withCmd.find((r) => r.line === e.line);
    const cmd = row ? row['확인'] : '';
    if (!cmd) { result.push({ exec, tcCount, status: 'unknown', cmd: '' }); continue; }
    const r = runCommand(root, `환경:${exec}`, cmd);
    runs.push(r);
    result.push({ exec, tcCount, status: r.status === 'passed' ? 'available' : 'unavailable', cmd });
  }
  const used = [...new Set(d.tcs.map((t) => t.exec).filter((x) => x && x !== 'manual'))];
  for (const u of used) if (!result.some((r) => r.exec === u)) result.push({ exec: u, tcCount: d.tcs.filter((t) => t.exec === u).length, status: 'missing', cmd: '' });
  const log = writeRunLog(root, P.buildRuns, 'doctor', now, runs);
  const state = readState(root);
  state.env = { at: now.toISOString(), result, log };
  writeState(root, state);
  return { result, log, ok: result.every((r) => r.status === 'available') };
}

// ── 시험 단계: 전체 실행 ──────────────────────────────────

function readTestState(root) {
  const p = path.join(root, P.testState);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { throw new BuildError(`${P.testState}를 읽을 수 없다 (JSON 형식 오류)`); }
}

// 시험의 근거: 앱 코드·시험 코드·설정·잠금 파일(생성물 제외), 시험 계획, 명령 표. 바뀌면 시험을 다시 한다.
function testBasis(root) {
  const d = loadDesign(root);
  const reportFiles = d.commands.map((c) => c.report).filter(Boolean);
  return { app: fp.app(root, reportFiles), testPlan: shortHash(root, P.design('test-plan')), techStack: shortHash(root, P.design('tech-stack')) };
}

const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) return false;
  fs.cpSync(src, dest, { recursive: true });
  return true;
};

// 모든 명령을 실행하고 자동 TC 마다 결과를 기록한다 (증거: docs/07-test/_evidence/).
// 결과 파일이 있으면 TC 별 결과(passed/failed/skipped/missing), 없으면 코드에 TC ID 가 있는지만 남긴다 (perTc: false).
function testRun(root, { now = new Date() } = {}) {
  if (readLock(root)) throw new BuildError(`검증(${readLock(root).id})이 진행 중이다`);
  const d = loadDesign(root);
  const state = readState(root);
  const lockPath = path.join(root, P.buildLock);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify({ id: 'test-run', pid: process.pid, at: now.toISOString() }), 'utf8');
  try {
    const ins = install(root, { force: true, now, d, state });
    const basisBefore = testBasis(root);
    const res = ins.status === 'passed' ? runChecks(root, verifyCommands(d.commands).run) : { runs: [], reports: [], perTc: false, tcStatus: null };
    const runs = res.runs;
    const missingReports = res.reports.filter((r) => !r.exists).map((r) => `${P.app}/${r.report}`);
    const evidence = writeRunLog(root, P.evidence, 'run', now, runs, [`시험 실행 ${now.toISOString()} (install: ${ins.status})`, ...missingReports.map((r) => `만들어지지 않은 결과 파일: ${r}`), '']);
    // 결과 파일과 진단 증거(명령 표의 '증거' 폴더: trace·스크린샷 등)를 증거 폴더에 보관한다
    const saved = [];
    for (const rep of res.reports.filter((r) => r.exists)) {
      const dest = path.join(root, P.evidence, `${path.basename(rep.report, path.extname(rep.report))}-${stampOf(now)}${path.extname(rep.report) || '.xml'}`);
      fs.copyFileSync(path.join(root, P.app, rep.report), dest);
      saved.push(path.relative(root, dest).split(path.sep).join('/'));
    }
    for (const c of d.commands.filter((x) => x.evidence)) {
      const dest = path.join(root, P.evidence, `${c.use.replace(/[^a-z0-9]+/gi, '-')}-${stampOf(now)}`);
      if (copyDir(path.join(root, P.app, c.evidence), dest)) saved.push(path.relative(root, dest).split(path.sep).join('/'));
    }
    const basis = testBasis(root);
    const changedDuring = basis.app !== basisBefore.app;
    const inCode = tcIdsInCode(root);
    const unavailable = ins.status === 'unavailable' || runs.some((r) => r.status === 'unavailable');
    const suite = !changedDuring && ins.status === 'passed' && runs.length > 0 && runs.every((r) => r.status === 'passed') && missingReports.length === 0 ? 'passed'
      : unavailable ? 'unavailable' : 'failed';
    const tcs = d.tcs.map((t) => ({
      id: t.id, exec: t.exec,
      result: res.perTc && t.exec !== 'manual' ? res.tcStatus(t.id) : null,
      inCode: inCode.has(t.id), files: inCode.has(t.id) ? [...inCode.get(t.id)] : [],
    }));
    const result = {
      at: now.toISOString(), suite, perTc: res.perTc, basis, changedDuring, install: ins.status, evidence, reports: saved, missingReports,
      commands: runs.map((r) => ({ use: r.use, cmd: r.cmd, status: r.status, exit: r.exit, envConflict: r.envConflict || false })), tcs,
    };
    const p = path.join(root, P.testState);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    return result;
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

// ── 안내 파일 ─────────────────────────────────────────────

const TEMPLATES = {
  [P.buildLog]: 'contracts/templates/build/build-log-template.md',
  [P.issues]: 'contracts/templates/build/issues-template.md',
};

// 구현 기록 파일을 템플릿에서 만든다 (있으면 그대로 둔다). 하네스 지문 기록이 없으면 만든다.
function init(root, { now = new Date() } = {}) {
  const made = [];
  for (const [dest, tpl] of Object.entries(TEMPLATES)) {
    if (exists(root, dest)) continue;
    const src = path.join(root, tpl);
    if (!fs.existsSync(src)) throw new BuildError(`템플릿이 없다: ${tpl}`);
    const text = fs.readFileSync(src, 'utf8').replace(/\{YYYY-MM-DD\}/g, approvalLib.dateOf(now));
    fs.mkdirSync(path.dirname(path.join(root, dest)), { recursive: true });
    fs.writeFileSync(path.join(root, dest), text, 'utf8');
    made.push(dest);
  }
  ensureApp(root);
  if (fp.recordHarness(root, now).created) made.push(P.harnessState);
  return { made };
}

module.exports = {
  BuildError, ISSUE_TYPES, BLOCKING, BRIEF_VERSION,
  taskFields, loadDesign, readCommands, readState, writeState, readIssues, blockedTasks, designGate,
  brief, taskStates, related, parallelConflicts, next, start, handoff, pause,
  firstProgram, programExists, runCommand, verifyCommands, tcIdsInCode, runChecks, install, verify,
  doctor, testRun, testBasis, readTestState, init,
  parseJUnit: junit.parse,
};
