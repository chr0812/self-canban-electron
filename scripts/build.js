#!/usr/bin/env node
'use strict';
// 구현 단계 도구. 사용법은 아래 USAGE 참고.
const path = require('path');
const lib = require('./lib/build');
const issues = require('./lib/issues');

const USAGE = [
  '사용법:',
  '  node scripts/build.js init                       구현 기록(06-build/build-log.md, issues.md), app/, 하네스 지문을 만든다',
  '  node scripts/build.js doctor                     시험 환경 표의 도구가 설치되어 있는지 확인한다',
  '  node scripts/build.js status | next              Task 진행과 지금 할 일 (검증 대기·중단·개발 중·실행 가능·함께 시작 가능)',
  '  node scripts/build.js brief <T-NNN>              Task 지시서 (요구사항·시험 시나리오·파일 명세 발췌, 근거 문서 판)',
  '  node scripts/build.js start <T-NNN>              개발 시작 기록 (다른 Task 와 함께면 의존 관계·파일 겹침을 검사)',
  '  node scripts/build.js handoff <T-NNN> [--files a,b] [--note <설계와 다른 점>] [--decisions <결정 필요>]',
  '  node scripts/build.js pause <T-NNN> --reason <중단 사유> [--files a,b]   (사용량 제한 등. 실패 횟수에 넣지 않는다)',
  '  node scripts/build.js verify <T-NNN> [--install] [--note <설계와 다른 점>]   명령을 실행해 검증하고 기록한다',
  '  node scripts/build.js test-run                   시험 단계: 모든 명령을 실행하고 증거를 남긴다',
  '  node scripts/build.js issue add --type <유형> --text <내용> [--found <T-NNN>] [--scope <영향>]',
  '  node scripts/build.js issue set <BI-NNN> --state <상태> [--action <처리>]',
  '공통 옵션: [--root <경로>] [--json]',
  '종료 코드: 0 성공 · 1 검증 실패·막힘 · 2 사용법 오류',
].join('\n');

class UsageError extends Error {}

const VALUE_OPTS = ['root', 'files', 'note', 'decisions', 'reason', 'type', 'text', 'found', 'scope', 'state', 'action'];

function parse(argv) {
  const opts = { positional: [], root: process.cwd(), json: false, install: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const name = a.replace(/^--/, '');
    if (a.startsWith('--') && VALUE_OPTS.includes(name)) {
      if (i + 1 >= argv.length) throw new UsageError(`${a} 에 값이 필요하다`);
      opts[name] = argv[++i];
    } else if (a === '--json') opts.json = true;
    else if (a === '--install') opts.install = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--')) throw new UsageError(`알 수 없는 옵션 ${a}`);
    else opts.positional.push(a);
  }
  opts.root = path.resolve(opts.root);
  return opts;
}

const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const LABEL = { done: '완료', stale: '재검증 필요', failed: '검증 실패', unavailable: '실행 불가', conflict: '환경 충돌·검증 중 변경', todo: '할 일' };

function renderStatus(n) {
  if (!n.ok) return [`구현을 진행할 수 없다: ${n.message}`, ...n.errors.map((e) => `  - ${e.rule} ${e.target || e.file}: ${e.message}`)].join('\n');
  const lines = [`Task ${n.done}/${n.total} 완료${n.finished ? ' (모두 끝남)' : ''}`];
  if (n.verifying) lines.push(`  검증 진행 중: ${n.verifying.id} (${n.verifying.at})`);
  if (n.stale.length) lines.push(`  재검증 필요: ${n.stale.join(', ')}`);
  if (n.handoff.length) lines.push(`  검증 대기(개발 끝남): ${n.handoff.map((h) => h.id).join(', ')}`);
  if (n.paused.length) lines.push(`  중단(이어서 개발): ${n.paused.map((p) => `${p.id}${p.reason ? ` — ${p.reason}` : ''}`).join(', ')}`);
  if (n.developing.length) lines.push(`  개발 중: ${n.developing.map((x) => x.id).join(', ')}`);
  if (n.runnable.length) lines.push(`  실행 가능: ${n.runnable.map((r) => `${r.id}${r.status === 'todo' ? '' : `(${LABEL[r.status]}${r.attempts ? `, ${r.attempts}회` : ''})`}`).join(', ')}`);
  if (n.parallel.length > 1) lines.push(`  함께 시작 가능(의존 관계 없음·파일 안 겹침): ${n.parallel.join(', ')}`);
  if (n.blocked.length) lines.push(`  멈춤(미해결 보고): ${n.blocked.map((b) => `${b.id}←${b.by.join('/')}`).join(', ')}`);
  if (n.waiting.length) lines.push(`  선행 대기: ${n.waiting.length}개`);
  return lines.join('\n');
}

// 지금 할 일 한 줄: 검증 대기 → 중단 재개 → 실행 가능 순
function nextLine(n) {
  if (n.verifying) return `검증(${n.verifying.id})이 끝나기를 기다린다`;
  if (n.handoff.length) return `검증: node scripts/build.js verify ${n.handoff[0].id} (개발 끝남)`;
  if (n.paused.length) return `재개: ${n.paused[0].id} — 남은 파일과 기록을 확인하고 이어서 개발한다 (start ${n.paused[0].id})`;
  if (n.developing.length && !n.runnable.some((r) => !r.conflicts.length)) return `개발 중인 Task(${n.developing.map((x) => x.id).join(', ')})가 돌아오기를 기다린다`;
  const first = n.runnable.find((r) => !r.conflicts.length) || n.runnable[0];
  if (first) return `다음: ${first.id} ${first.title}${first.status === 'todo' ? '' : ` (${LABEL[first.status]})`}`;
  return n.finished ? '모든 Task 가 검증되었다' : '지금 실행할 수 있는 Task 가 없다 (보고 처리나 선행 Task 필요)';
}

function main() {
  const opts = parse(process.argv.slice(2));
  const [cmd, arg] = opts.positional;
  if (opts.help || !cmd) {
    console.log(USAGE);
    return opts.help ? 0 : 2;
  }
  const out = (obj, text) => console.log(opts.json ? JSON.stringify(obj, null, 2) : text);
  const root = opts.root;
  const needId = () => { if (!arg) throw new UsageError('Task ID 가 필요하다'); return arg; };

  if (cmd === 'init') {
    const r = lib.init(root);
    out(r, r.made.length ? `만들었다: ${r.made.join(', ')}` : '구현 기록이 이미 있다');
    return 0;
  }
  if (cmd === 'doctor') {
    const r = lib.doctor(root);
    const word = { available: '있음', unavailable: '없음', unknown: '확인 명령 없음', missing: '시험 환경 표에 없음' };
    out(r, [...r.result.map((x) => `  ${x.exec}: ${word[x.status]} (시나리오 ${x.tcCount}개)${x.cmd ? `  ← ${x.cmd}` : ''}`), `기록: ${r.log}`].join('\n'));
    return r.ok ? 0 : 1;
  }
  if (cmd === 'status' || cmd === 'next') {
    const n = lib.next(root);
    if (cmd === 'next' && n.ok) out({ ...n, line: nextLine(n) }, `${nextLine(n)}\n${renderStatus(n)}`);
    else out(n, renderStatus(n));
    return n.ok ? 0 : 1;
  }
  if (cmd === 'brief') {
    const b = lib.brief(root, needId());
    out({ id: b.id, hash: b.hash, text: b.text }, b.text);
    return 0;
  }
  if (cmd === 'start') {
    const r = lib.start(root, needId());
    out(r, `${r.id} 개발 시작${r.resumed ? ' (중단에서 재개)' : ''}${r.parallelWith.length ? ` — 함께 개발 중: ${r.parallelWith.join(', ')}` : ''}`);
    return 0;
  }
  if (cmd === 'handoff') {
    const r = lib.handoff(root, needId(), { files: list(opts.files), note: opts.note || '', decisions: opts.decisions || '' });
    out(r, `${r.id} 검증 대기로 기록했다`);
    return 0;
  }
  if (cmd === 'pause') {
    if (!opts.reason) throw new UsageError('--reason 이 필요하다');
    const r = lib.pause(root, needId(), { reason: opts.reason, files: list(opts.files) });
    out(r, `${r.id} 중단으로 기록했다 (실패 횟수에 넣지 않는다)`);
    return 0;
  }
  if (cmd === 'verify') {
    const r = lib.verify(root, needId(), { forceInstall: opts.install, note: opts.note || '' });
    const word = { done: '통과 — 완료로 기록하고 구현 기록에 블록을 썼다', failed: '실패', unavailable: '실행 불가 (도구가 없다)', conflict: '환경 충돌 또는 검증 중 파일 변경 — 코드 실패가 아니다' };
    out(r, [`${r.id} 검증: ${word[r.status]}`, ...r.runs.map((x) => `  ${x.use}: ${x.status}${x.envConflict ? ' (환경 충돌)' : ''} (종료 코드 ${x.exit})`), ...(r.skipped.length ? [`  건너뜀: ${r.skipped.join(', ')} (그 실행 위치의 TC 를 맡은 Task 가 아직 없다)`] : []), ...r.problems.map((p) => `  - ${p}`), `기록: ${r.log}`].join('\n'));
    return r.status === 'done' ? 0 : 1;
  }
  if (cmd === 'test-run') {
    const r = lib.testRun(root);
    const missing = r.tcs.filter((t) => t.exec !== 'manual' && (r.perTc ? t.result !== 'passed' : !t.inCode)).map((t) => t.id);
    out(r, [`시험 실행: ${r.suite}${r.changedDuring ? ' (실행 중 앱 파일이 바뀌어 무효)' : ''}`, ...r.commands.map((x) => `  ${x.use}: ${x.status} (종료 코드 ${x.exit})`), `  통과로 확인되지 않은 자동 시나리오: ${missing.length ? missing.join(', ') : '없음'}`, `증거: ${[r.evidence, ...r.reports].join(', ')}`].join('\n'));
    return r.suite === 'passed' ? 0 : 1;
  }
  if (cmd === 'issue') {
    if (arg === 'add') {
      const r = issues.add(root, { type: opts.type, text: opts.text, found: opts.found || '', scope: opts.scope || '' });
      out(r, `보고를 더했다: ${r.id}`);
      return 0;
    }
    if (arg === 'set') {
      const id = opts.positional[2];
      if (!id) throw new UsageError('BI ID 가 필요하다');
      const r = issues.set(root, id, { state: opts.state, action: opts.action });
      out(r, `${r.id} 상태: ${r.state}`);
      return 0;
    }
    throw new UsageError("issue 다음에는 'add' 또는 'set'");
  }
  throw new UsageError(`알 수 없는 명령 '${cmd}'`);
}

try {
  process.exit(main());
} catch (e) {
  if (e instanceof UsageError) {
    console.error(`사용법 오류: ${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (e instanceof lib.BuildError || e instanceof issues.IssueError) {
    console.error(`중단: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
