'use strict';
const fs = require('fs');
const path = require('path');
const { Doc } = require('../markdown');
const { idsIn } = require('../ids');
const common = require('../common');
const interview = require('./interview');
const prdStage = require('./prd');
const specStage = require('./spec');
const review = require('./review');
const direction = require('./design-direction');
const stack = require('./design-stack');
const issuesLib = require('../issues');
const P = require('../paths');

// 설계 산출물(개념 이름, 파일 이름은 paths.js)과 파일마다 꼭 있어야 하는 핵심 섹션.
// 템플릿 전체가 아니라 프로젝트에 맞게 조정돼도 남는 핵심만 요구한다.
const DOCS = {
  'tech-stack': ['추천 스택', '환경 / 빌드 / 실행 가이드', '명령', '시험 환경'],
  'data-model': ['ERD'],
  'api-spec': ['API / 인터페이스'],
  'ui-spec': ['화면 목록', '화면 상세'],
  architecture: ['아키텍처 개요', '시스템 구조', '디렉토리 구조', '기술 결정 기록'],
  'file-map': ['Directory Structure', 'Wave 별 생성 순서', '파일별 상세 명세'],
  'test-plan': ['시험 전략', '시험 시나리오'],
  tasks: ['요약', 'Task 목록', '요구사항 커버리지 점검표'],
  README: ['산출물 목록'],
};

const RAN = ['FMT-01', 'FMT-05', 'VAL-14', 'VAL-15', 'VAL-16', 'REF-04', 'REF-05', 'REF-06', 'REF-07', 'REF-08', 'REF-09', 'REF-10', 'REF-11', 'REF-12', 'REV-01', 'REV-02', 'REV-03', ...direction.RAN, ...stack.RAN];

// 시험 시나리오의 실행 위치
const EXEC = ['cli', 'browser', 'device', 'manual'];
const plain = (s) => (s || '').replace(/`/g, '').trim();

const wireframeFiles = (root) => {
  const d = path.join(root, P.wireframes);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.svg')).sort() : [];
};

// 승인 대상: 설계 문서 9개 + 와이어프레임 전부 (계약: SVG 도 해시 대상)
const approval = {
  file: P.approval('design'),
  title: '설계',
  upstream: [P.spec],
  targets: (root) => [
    ...['tech-stack', 'data-model', 'api-spec', 'ui-spec'].map(P.design),
    ...wireframeFiles(root).map((f) => `${P.wireframes}/${f}`),
    ...['architecture', 'file-map', 'test-plan', 'tasks', 'README'].map(P.design),
  ],
};

// 07-test-plan.md 의 "### TC-NNN 제목" 블록과 그 아래 "- 근거:", "- 실행:" 필드를 읽는다
function readTestPlan(doc) {
  const out = [];
  for (const h of doc.headings) {
    if (h.level !== 3) continue;
    const m = /^(TC-\d{3})/.exec(h.clean);
    if (!m) continue;
    const next = doc.headings.find((x) => x.line > h.line && x.level <= 3);
    const body = doc.lines.slice(h.line + 1, next ? next.line : doc.lines.length);
    const field = (name) => {
      const l = body.find((x) => new RegExp(`^\\s*[-*]\\s*\\**${name}\\**\\s*[:：]`).test(x));
      return l === undefined ? null : plain(l.replace(/^.*?[:：]/, ''));
    };
    const exec = field('실행');
    out.push({
      id: m[1], kind: 'TC', file: doc.file, line: h.line + 1,
      basis: idsIn(field('근거') || ''),
      exec: exec === null ? null : exec.split(/[\s,(/]/)[0].toLowerCase(),
      manualReason: field('수동 사유'),
    });
  }
  return out;
}

// 01-tech-stack.md 의 표 하나를 읽는다 (섹션이 없으면 null, 열이 맞는 표가 없으면 [])
function tableRows(doc, heading, cols) {
  const sec = doc.findHeading(heading);
  if (!sec) return null;
  const t = doc.tables(sec).find((x) => cols.every((c) => x.col(c) >= 0));
  if (!t) return [];
  return t.rows.map((r) => ({ line: r.line, ...Object.fromEntries(cols.map((c) => [c, plain(r.cells[t.col(c)])])) }));
}

// VAL-15: 명령 표에 install 과 test(또는 test:종류) 가 있고, 실행 위치 열이 있으면 자동 TC 의 실행 위치마다 시험 명령이 있다
// VAL-16: 시험 명령마다 결과 파일(JUnit XML)과 실행 위치가 있다 (경고)
function checkCommands(doc, report, tcs = []) {
  const rows = tableRows(doc, '명령', ['용도', '명령']);
  if (rows === null) return; // 섹션 누락은 FMT-01 이 본다
  if (rows.length === 0) {
    report.add('VAL-15', doc.file, '명령', "'명령' 섹션에 '| 용도 | 명령 |' 표가 없다");
    return;
  }
  for (const r of rows) if (!r['명령']) report.add('VAL-15', doc.file, r['용도'], `용도 '${r['용도']}'의 명령이 비어 있다`);
  const uses = rows.map((r) => r['용도'].toLowerCase());
  if (!uses.includes('install')) report.add('VAL-15', doc.file, 'install', "명령 표에 용도 'install' 행이 없다");
  if (!uses.some((u) => u === 'test' || u.startsWith('test:'))) report.add('VAL-15', doc.file, 'test', "명령 표에 용도 'test'(또는 'test:종류') 행이 없다");

  // VAL-16: 테스트 명령마다 결과 파일(JUnit XML)이 있어야 TC 별로 판정할 수 있다
  const withReport = tableRows(doc, '명령', ['용도', '명령', '결과 파일']) || [];
  for (const r of rows) {
    const use = r['용도'].toLowerCase();
    if (use !== 'test' && !use.startsWith('test:')) continue;
    const rep = (withReport.find((x) => x.line === r.line) || {})['결과 파일'] || '';
    if (!rep || rep === '-') report.add('VAL-16', doc.file, r['용도'], `테스트 명령 '${r['용도']}'에 결과 파일(JUnit XML 경로)이 없다. TC 별 통과·실패를 확인할 수 없고 전체 실행 결과로만 판정한다 (만들 수 없는 도구면 이유를 비고에 적는다)`);
  }

  // 실행 위치: 시험 명령이 어떤 실행 위치의 TC 를 돌리는지. Task 검증은 그 실행 위치의 TC 를 맡은 Task 가 생긴 뒤에만 그 명령을 돌린다.
  const withExec = tableRows(doc, '명령', ['용도', '명령', '실행 위치']) || [];
  const testRows = rows.filter((r) => /^test(:|$)/i.test(r['용도']));
  const execOf = (r) => { const v = ((withExec.find((x) => x.line === r.line) || {})['실행 위치'] || '').toLowerCase(); return v === '-' ? '' : v; };
  if (testRows.length > 1 && testRows.some((r) => !execOf(r))) {
    report.add('VAL-16', doc.file, '실행 위치', "시험 명령이 여럿인데 '실행 위치' 열이 비어 있는 행이 있다. 실행 위치가 없으면 모든 Task 검증에서 그 명령을 돌린다 (화면 시험이 생기기 전 Task 가 실패할 수 있다)");
  }
  if (withExec.length) {
    const covered = new Set(testRows.map(execOf).filter(Boolean));
    const anyAll = testRows.some((r) => !execOf(r));
    for (const e of new Set(tcs.map((t) => t.exec).filter((x) => x && x !== 'manual' && EXEC.includes(x)))) {
      if (!anyAll && !covered.has(e)) report.add('VAL-15', doc.file, e, `실행 위치 '${e}'의 시험 시나리오가 있는데 그 실행 위치의 시험 명령(실행 위치 열)이 없다`);
    }
  }
}

// 파일이 모두 시험 파일인가 (구현 없이 시험만 쓰는 Task)
const TEST_FILE = /(^|\/)(tests?|__tests__|specs?|e2e)(\/|$)|\.(test|spec)\.[a-z0-9]+$/i;
const testOnly = (files) => files.length > 0 && files.every((f) => TEST_FILE.test(f.replace(/\\/g, '/')));

// 설계 폴더에 둘 수 있는 것 (문서 외의 파일·폴더는 설계 역할이 만들지 않는다)
const ALLOWED_ENTRY = (name) => Object.values(P.DESIGN_FILE).includes(name) || name === 'wireframes' || name === '_review' || name === '_variants' || /^_approval(\..*)?\.md$/.test(name);

// 시험 환경 표의 실행 위치 (섹션이 없으면 null)
function environments(doc, report) {
  const rows = tableRows(doc, '시험 환경', ['실행 위치']);
  if (rows === null) return null;
  if (rows.length === 0) report.add('VAL-14', doc.file, '시험 환경', "'시험 환경' 섹션에 '실행 위치' 열이 있는 표가 없다");
  return new Set(rows.map((r) => r['실행 위치'].toLowerCase()));
}

// 08-tasks.md 의 Task 줄을 읽는다
function readTasks(doc) {
  const tasks = [];
  let wave = null;
  doc.lines.forEach((l, i) => {
    if (doc.fenced[i]) return;
    const w = /^###\s+Wave\s+(\d+)/.exec(l);
    if (w) wave = Number(w[1]);
    const m = /^- \[( |x)\] \*\*(T-\d{3})\*\*(.*)$/.exec(l);
    if (!m) return;
    const rest = m[3];
    const cov = /covers\s*:\s*([^/)]*)/.exec(rest);
    const chk = /check\s*:\s*([^/)]*)/.exec(rest);
    const dep = /deps\s*:\s*(.*)$/.exec(rest);
    tasks.push({
      id: m[2], kind: 'T', file: doc.file, line: i + 1, wave, done: m[1] === 'x',
      covers: cov ? idsIn(cov[1]) : [],
      check: chk ? idsIn(chk[1]) : null,
      deps: dep ? idsIn(dep[1]).filter((x) => x.startsWith('T-')) : [],
    });
  });
  return tasks;
}

function run(root, report) {
  report.run(...RAN);

  // 설계 문서 로드와 섹션 검사
  const docs = {};
  for (const [name, sections] of Object.entries(DOCS)) {
    const rel = P.design(name);
    const doc = Doc.load(root, rel);
    if (!doc) {
      report.add('FMT-01', rel, '', `설계 산출물 '${P.DESIGN_FILE[name]}'가 없다`);
      continue;
    }
    docs[name] = doc;
    for (const s of sections) {
      const sec = doc.findHeading(s);
      if (!sec) report.add('FMT-01', rel, s, `필수 섹션 '${s}'이 없다`);
      else if (!doc.hasBody(sec)) report.add('FMT-01', rel, s, `섹션 '${s}'의 본문이 비어 있다`);
    }
    common.checkHeadings(doc, report);
    common.checkDate(doc, report);
  }

  // 상류: 명세(필수), PRD·인터뷰(ID 정의용)
  const spec = Doc.load(root, specStage.FILE);
  if (!spec) {
    report.add('FMT-01', specStage.FILE, '', '설계의 상류인 명세가 없다');
    return;
  }
  const sd = specStage.read(spec);
  const itv = Doc.load(root, interview.FILE);
  const prd = Doc.load(root, prdStage.FILE);
  const upDefs = [...(itv ? interview.read(itv).defs : []), ...(prd ? prdStage.readPfs(prd).pfs : [])];
  const specIds = new Set(sd.defs.map((x) => x.id));

  // 08-tasks.md
  const tasksDoc = docs.tasks;
  const tasks = tasksDoc ? readTasks(tasksDoc) : [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const covered = new Map();

  if (tasksDoc) {
    // REF-04: covers 의 ID가 spec 에 있다
    for (const t of tasks) {
      for (const c of t.covers) {
        covered.set(c, [...(covered.get(c) || []), t.id]);
        if (!specIds.has(c)) report.add('REF-04', tasksDoc.file, t.id, `${t.id}의 covers ${c}가 명세에 없다`);
      }
    }
    // REF-05: 모든 P0 FR 이 Task 에 매핑된다
    for (const fr of sd.frs) {
      if (fr.prio === 'P0' && !covered.has(fr.id)) report.add('REF-05', tasksDoc.file, fr.id, `P0인 ${fr.id}가 어떤 Task 에도 매핑되지 않았다`);
    }
    // REF-07: deps 가 존재하고 앞선(같은) Wave 에 있다
    for (const t of tasks) {
      for (const dep of t.deps) {
        const dt = byId.get(dep);
        if (dep === t.id) report.add('REF-07', tasksDoc.file, t.id, `${t.id}가 자기 자신에 의존한다`);
        else if (!dt) report.add('REF-07', tasksDoc.file, t.id, `${t.id}의 deps ${dep}가 없다`);
        else if (dt.wave !== null && t.wave !== null && dt.wave > t.wave) {
          report.add('REF-07', tasksDoc.file, t.id, `${t.id}(Wave ${t.wave})가 더 뒤 Wave 의 ${dep}(Wave ${dt.wave})에 의존한다`);
        }
      }
    }
    // REF-08: 점검표·요약이 실제와 일치한다
    const cov = tasksDoc.findHeading('요구사항 커버리지 점검표');
    const listed = new Set();
    if (cov) {
      for (const table of tasksDoc.tables(cov)) {
        const tc = table.col('커버') >= 0 ? table.col('커버') : 2;
        for (const row of table.rows) {
          const id = row.cells[0] || '';
          if (!/^[A-Z]+-\d{3}$/.test(id)) continue;
          listed.add(id);
          const claimed = new Set(idsIn(row.cells[tc] || '').filter((x) => x.startsWith('T-')));
          const actual = new Set(covered.get(id) || []);
          const diff = [...claimed].filter((x) => !actual.has(x)).concat([...actual].filter((x) => !claimed.has(x)));
          if (diff.length) report.add('REF-08', tasksDoc.file, id, `점검표의 ${id} 커버 Task(${[...claimed].join(', ') || '없음'})가 실제 covers(${[...actual].join(', ') || '없음'})와 다르다`);
        }
      }
      for (const fr of sd.frs) {
        if (fr.prio === 'P0' && !listed.has(fr.id)) report.add('REF-08', tasksDoc.file, fr.id, `P0인 ${fr.id}가 커버리지 점검표에 없다`);
      }
    }
    const sum = tasksDoc.findHeading('요약');
    const total = sum ? /총 Task\s*:\s*(\d+)/.exec(tasksDoc.textOf(sum)) : null;
    if (total && Number(total[1]) !== tasks.length) report.add('REF-08', tasksDoc.file, '요약', `요약의 총 Task ${total[1]}개가 실제 ${tasks.length}개와 다르다`);
    if (tasks.length === 0) report.add('FMT-01', tasksDoc.file, 'Task 목록', 'Task 가 1개도 없다 (`- [ ] **T-001** ...` 형식)');
  }

  // REF-06: SCR 과 와이어프레임이 일대일이다
  const wf = wireframeFiles(root);
  const wfIds = wf.map((x) => x.replace(/\.svg$/, ''));
  for (const s of sd.scrs) {
    if (!wfIds.includes(s.id)) report.add('REF-06', `${P.wireframes}`, s.id, `${s.id}의 wireframes/${s.id}.svg 가 없다`);
  }
  for (const w of wfIds) {
    if (!/^SCR-\d{3}$/.test(w)) report.add('REF-06', `${P.wireframes}/${w}.svg`, w, '와이어프레임 파일 이름은 SCR-NNN.svg 여야 한다');
    else if (!sd.scrs.some((s) => s.id === w)) report.add('REF-06', `${P.wireframes}/${w}.svg`, w, `${w}가 명세의 화면(SCR)에 없다`);
  }

  // DSN-01 ~ DSN-05: 시안 비교표, 선택한 디자인 방향, 디자인 토큰, 시선 위계
  direction.check(root, docs['ui-spec'], sd.scrs, report);

  // 기술 스택의 명령·시험 환경 표, 시험 계획
  const planDoc = docs['test-plan'];
  const tcs = planDoc ? readTestPlan(planDoc) : [];
  if (docs['tech-stack']) checkCommands(docs['tech-stack'], report, tcs);
  if (docs['tech-stack']) stack.check(docs['tech-stack'], report); // VAL-21: 후보 비교
  const envs = docs['tech-stack'] ? environments(docs['tech-stack'], report) : null;
  if (planDoc) {
    if (tcs.length === 0) report.add('FMT-01', planDoc.file, '시험 시나리오', "시험 시나리오가 1개도 없다 ('### TC-001 제목' 형식)");
    // VAL-14: 근거와 실행 위치, 사람이 확인하는 시나리오의 사유
    for (const tc of tcs) {
      if (tc.basis.length === 0) report.add('VAL-14', planDoc.file, tc.id, `${tc.id}에 '- 근거:' 필드(AC·UC·NFR 등 ID)가 없거나 비어 있다`);
      if (!EXEC.includes(tc.exec)) report.add('VAL-14', planDoc.file, tc.id, `${tc.id}의 '- 실행:' 값 '${tc.exec || ''}'은 ${EXEC.join(' / ')} 중 하나여야 한다`);
      else if (tc.exec !== 'manual' && envs && !envs.has(tc.exec)) report.add('VAL-14', planDoc.file, tc.id, `${tc.id}의 실행 위치 '${tc.exec}'가 기술 스택의 '시험 환경' 표에 없다`);
      if (tc.exec === 'manual' && !tc.manualReason) report.add('VAL-14', planDoc.file, tc.id, `사람이 확인하는 ${tc.id}에 '- 수동 사유:'가 없다 (자동화하지 않는 근거와 대상 환경을 적는다)`);
    }
    // REF-09 / REF-11: 인수 기준·NFR 이 시나리오에 있다
    const basis = new Set(tcs.flatMap((t) => t.basis));
    for (const ac of sd.acs) if (!basis.has(ac.id)) report.add('REF-09', planDoc.file, ac.id, `${ac.id}(${ac.fr})를 근거로 삼는 시험 시나리오가 없다`);
    for (const n of sd.nfrs) if (!basis.has(n.id)) report.add('REF-11', planDoc.file, n.id, `${n.id}를 근거로 삼는 시험 시나리오가 없다`);
  }
  // REF-10: Task 의 check ↔ 시나리오
  if (tasksDoc && planDoc) {
    const tcIds = new Set(tcs.map((t) => t.id));
    const assigned = new Set();
    for (const t of tasks) {
      if (t.check === null) {
        report.add('REF-10', tasksDoc.file, t.id, `${t.id}에 check 필드가 없다 (담당 TC, 없으면 'check: -')`);
        continue;
      }
      for (const c of t.check) {
        assigned.add(c);
        if (!c.startsWith('TC-')) report.add('REF-10', tasksDoc.file, t.id, `${t.id}의 check ${c}는 TC 가 아니다`);
        else if (!tcIds.has(c)) report.add('REF-10', tasksDoc.file, t.id, `${t.id}의 check ${c}가 시험 계획에 없다`);
      }
    }
    for (const tc of tcs) {
      if (tc.exec !== 'manual' && EXEC.includes(tc.exec) && !assigned.has(tc.id)) {
        report.add('REF-10', tasksDoc.file, tc.id, `자동 시나리오 ${tc.id}(${tc.exec})를 맡은 Task 가 없다`);
      }
    }
    // REF-12: 시험 파일만 만드는 Task 가 시나리오를 맡으면, 그 동작을 구현한 Task 는 검증 없이 완료된다
    for (const t of tasks) {
      const files = fileField(tasksDoc.lines[t.line - 1]);
      if ((t.check || []).length && testOnly(files)) {
        report.add('REF-12', tasksDoc.file, t.id, `${t.id}는 시험 파일만 만들면서 시나리오 ${t.check.length}개(${t.check.slice(0, 3).join(', ')}${t.check.length > 3 ? ' …' : ''})를 맡는다. 시나리오는 그 동작을 구현하는 Task 에 붙인다 (여러 Task 를 거쳐야 하는 E2E 는 마지막으로 필요한 구현 Task)`);
      }
    }
  }

  // FMT-05: 설계 폴더에는 설계 문서·와이어프레임·리뷰 기록만 둔다
  const dir = path.join(root, P.DIR.design);
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (!ALLOWED_ENTRY(name)) report.add('FMT-05', `${P.DIR.design}/${name}`, name, `설계 폴더에 정해지지 않은 항목이 있다 (앱 파일·폴더는 ${P.app}/ 에 둔다)`);
    }
  }

  // 리뷰 결과와 처리 기록
  review.check(root, report);

  // ID 규칙: 설계 문서 전체에서 정의 없는 ID·형식 오류를 본다.
  // 각 문서의 '변경 이력' 구간은 삭제 기록이라 정의 없는 ID 로 보지 않고, 구현 중 보고(BI)는 issues.md 가 정의한다.
  const bi = (issuesLib.load(root) || { issues: [] }).issues.map((i) => ({ id: i.id, kind: 'BI', file: P.issues, line: i.line }));
  common.checkIds(report, {
    scanDocs: Object.values(docs),
    defs: [...sd.defs, ...upDefs, ...tasks, ...tcs, ...bi],
    gapDocs: [tasksDoc, planDoc].filter(Boolean),
    skipRef: (doc, line) => common.inChangeLog(doc, line),
  });
}

// Task 줄의 file: 필드 (경로에 / 가 있으므로 ' / ' 로 나눈다)
function fileField(line) {
  const body = (line || '').replace(/\s+deps\s*:.*$/, '');
  const inner = body.slice(body.lastIndexOf('(') + 1, body.lastIndexOf(')'));
  const part = inner.split(/\s+\/\s+/).find((p) => /^\s*file\s*:/.test(p));
  return part ? part.replace(/^\s*file\s*:\s*/, '').split(',').map((s) => s.trim()).filter((s) => s && s !== '-') : [];
}

module.exports = { run, approval, readTasks, readTestPlan, tableRows, DOCS, EXEC };
