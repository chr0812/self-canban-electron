'use strict';
// 구현 단계 게이트: 모든 Task 가 현재 근거로 검증되었고, 미해결 결함이 없고, 기록 문서가 온전하고,
// 하네스 파일이 프로젝트 안에서 바뀌었다면 그 사실이 보고되어 있다.
const { Doc } = require('../markdown');
const common = require('../common');
const P = require('../paths');
const lib = require('../build');
const issuesLib = require('../issues');
const fp = require('../fingerprint');

const RAN = ['FMT-01', 'BLD-01', 'BLD-02', 'BLD-03', 'BLD-04', 'BLD-05', 'BLD-06', 'BLD-07', 'BLD-08', 'BLD-09'];
// 이 규칙들만 남았으면 '구현 진행 중'이다 (status 가 fix 대신 continue_build 로 안내)
const PROGRESS_RULES = new Set(['BLD-01', 'BLD-02']);
const LOG_TITLE = '# 구현 기록';

function run(root, report) {
  report.run(...RAN);
  const log = Doc.load(root, P.buildLog);
  if (!log) {
    report.add('FMT-01', P.buildLog, '', '구현 기록이 없다 (node scripts/build.js init)');
    return;
  }
  common.checkDate(log, report);
  if (!log.findHeading('Task 기록')) report.add('FMT-01', P.buildLog, 'Task 기록', "필수 섹션 'Task 기록'이 없다");

  // BLD-07: 기록 문서의 제목과 필수 표가 온전하다 (손으로 고치다 깨진 것을 잡는다)
  const h1 = log.headings.find((h) => h.level === 1);
  if (!h1 || `# ${h1.text}` !== LOG_TITLE) report.add('BLD-07', P.buildLog, '제목', `제목이 '${LOG_TITLE}'가 아니다 (현재: '${h1 ? `# ${h1.text}` : '없음'}')`);
  const parsed = issuesLib.load(root);
  if (!parsed) report.add('BLD-07', P.issues, '', '구현 중 보고 문서가 없다 (node scripts/build.js init)');
  else for (const p of parsed.problems) report.add('BLD-07', P.issues, '구조', p);

  // BLD-06: 설계 승인이 유효하다
  const gate = lib.designGate(root);
  if (!gate.ok) {
    report.add('BLD-06', P.approval('design'), '', `설계 승인이 유효하지 않다 (${gate.errors.slice(0, 2).map((e) => e.rule).join(', ')}). 설계를 확인하고 다시 승인받은 뒤 영향 Task 를 다시 검증한다`);
    return;
  }

  let d;
  try { d = lib.loadDesign(root); } catch (e) {
    report.add('FMT-01', P.design('tasks'), '', e.message);
    return;
  }
  const states = lib.taskStates(root, d);

  // BLD-01 / BLD-02: 모든 Task 가 검증되었고 낡지 않았다
  const word = { todo: '아직 안 함', failed: '검증 실패', unavailable: '실행 불가', conflict: '환경 충돌·검증 중 변경' };
  for (const [id, s] of states) {
    if (s.status === 'stale') report.add('BLD-02', P.buildState, id, `${id}는 검증 뒤에 근거(요구사항·시험 시나리오·파일 명세·참조 설계 문서·지시서 판)가 바뀌었다. 다시 검증한다`);
    else if (s.status !== 'done') report.add('BLD-01', P.buildState, id, `${id}가 검증되지 않았다 (${word[s.status] || s.status}${s.work ? `, ${{ developing: '개발 중', handoff: '검증 대기', paused: '중단' }[s.work.state]}` : ''})`);
  }

  // BLD-03 / BLD-05: 보고 값과 미해결 결함
  const issues = parsed ? parsed.issues : [];
  for (const i of issues) {
    for (const p of issuesLib.valueProblems(i)) report.add('BLD-03', P.issues, i.id, p);
    if (issuesLib.BLOCKING.includes(i.type) && i.state === '미해결') report.add('BLD-03', P.issues, i.id, `미해결 ${i.type} ${i.id}: ${i.text}`);
    if (i.type === '구현 차이' && i.state === '미해결') report.add('BLD-05', P.issues, i.id, `구현 차이 ${i.id}가 정리되지 않았다 (설계 정정 또는 기록으로 남길지 정한다): ${i.text}`);
  }

  // BLD-04: 검증된 Task 마다 구현 기록에 블록과 '설계와 다른 점' 줄이 있다
  for (const [id, s] of states) {
    if (s.status !== 'done') continue;
    const h = log.headings.find((x) => x.level === 3 && x.clean.startsWith(id));
    if (!h) { report.add('BLD-04', P.buildLog, id, `구현 기록에 '### ${id}' 블록이 없다`); continue; }
    const next = log.headings.find((x) => x.line > h.line && x.level <= 3);
    const body = log.lines.slice(h.line + 1, next ? next.line : log.lines.length);
    if (!body.some((l) => /설계와 다른 점\s*[:：]\s*\S/.test(l))) report.add('BLD-04', P.buildLog, id, `${id} 블록에 '- 설계와 다른 점:' 줄이 없거나 비어 있다 (없으면 "없음")`);
  }

  // BLD-08 / BLD-09: 하네스 파일이 프로젝트 안에서 바뀌었는가
  const recorded = fp.readHarness(root);
  if (!recorded) {
    report.add('BLD-09', P.harnessState, '', '하네스 지문 기록이 없어 프로젝트 안의 하네스 변경을 확인할 수 없다 (node scripts/gate.js init)');
  } else {
    const changed = fp.diff(recorded.files, fp.harnessFiles(root));
    const reported = issues.filter((i) => i.type === '하네스 결함' && ['임시 패치', '원본 반영'].includes(i.state));
    if (changed.length && reported.length === 0) {
      report.add('BLD-08', P.harnessState, '', `하네스 파일이 기록과 다르다 (${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ` 외 ${changed.length - 5}개` : ''}). 프로젝트 안에서 고쳤다면 '하네스 결함' 보고(임시 패치)로 남긴다`);
    }
    for (const i of issues.filter((x) => x.type === '하네스 결함' && x.state === '임시 패치')) {
      report.add('BLD-09', P.issues, i.id, `하네스 임시 패치 ${i.id}가 하네스 원본에 반영되지 않았다: ${i.text}`);
    }
  }
}

module.exports = { run, RAN, PROGRESS_RULES };
