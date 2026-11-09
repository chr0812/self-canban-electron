'use strict';
// 시험 단계 게이트: 모든 시나리오에 결과가 있고, 자동 통과는 실제 실행으로, 수동 통과는 사용자 확인으로 뒷받침된다.
const { Doc } = require('../markdown');
const common = require('../common');
const P = require('../paths');
const lib = require('../build');
const buildStage = require('./build');
const { Report } = require('../report');

const RAN = ['FMT-01', 'TST-01', 'TST-02', 'TST-03', 'TST-04', 'TST-05', 'TST-06', 'TST-07', 'TST-08', 'TST-09', 'TST-10'];
const RESULTS = ['통과', '실패', '실행 불가', '면제'];

// 인수 승인: 시험 보고서. 상류는 명세·작업 목록·시험 실행 기록 (바뀌면 인수가 낡는다)
const approval = { file: P.approval('test'), targets: [P.testReport], upstream: [P.spec, P.design('tasks'), P.testState], title: '인수' };

function readResults(doc) {
  const sec = doc.findHeading('시나리오 결과');
  if (!sec) return null;
  const t = doc.tables(sec).find((x) => x.col('TC') >= 0 && x.col('결과') >= 0);
  if (!t) return [];
  const c = Object.fromEntries(['TC', '실행', '결과', '증거', '확인자', '비고'].map((n) => [n, t.col(n)]));
  const get = (r, n) => (c[n] >= 0 ? (r.cells[c[n]] || '').replace(/`/g, '').trim() : '');
  return t.rows.map((r) => ({ id: get(r, 'TC'), result: get(r, '결과'), evidence: get(r, '증거'), by: get(r, '확인자'), note: get(r, '비고'), line: r.line }))
    .filter((r) => /^TC-\d{3}$/.test(r.id));
}

function run(root, report) {
  report.run(...RAN);
  const doc = Doc.load(root, P.testReport);
  if (!doc) {
    report.add('FMT-01', P.testReport, '', '시험 보고서가 없다');
    return;
  }
  common.checkDate(doc, report);
  for (const s of ['요약', '시나리오 결과']) {
    const sec = doc.findHeading(s);
    if (!sec) report.add('FMT-01', P.testReport, s, `필수 섹션 '${s}'이 없다`);
    else if (!doc.hasBody(sec)) report.add('FMT-01', P.testReport, s, `섹션 '${s}'의 본문이 비어 있다`);
  }

  // TST-06: 구현 단계가 끝났다 (게이트 build 통과)
  const b = new Report();
  buildStage.run(root, b);
  const bErr = b.items.filter((i) => i.level === 'error');
  if (bErr.length) report.add('TST-06', P.buildState, '', `구현 단계가 끝나지 않았다: ${bErr.slice(0, 3).map((e) => `${e.rule} ${e.target}`).join(', ')}${bErr.length > 3 ? ` 외 ${bErr.length - 3}건` : ''}`);

  let d;
  try { d = lib.loadDesign(root); } catch (e) {
    report.add('FMT-01', P.design('tasks'), '', e.message);
    return;
  }
  const rows = readResults(doc);
  if (rows === null) return;
  if (rows.length === 0) report.add('FMT-01', P.testReport, '시나리오 결과', "'| TC | 실행 | 결과 | 증거 | 확인자 | 비고 |' 표가 없다");

  // TST-01: 모든 TC 에 결과가 정확히 한 번, 허용 값
  const byId = new Map();
  for (const r of rows) {
    if (byId.has(r.id)) report.add('TST-01', P.testReport, r.id, `${r.id}의 결과 행이 두 번 있다`);
    byId.set(r.id, r);
    if (!d.tcs.some((t) => t.id === r.id)) report.add('TST-01', P.testReport, r.id, `${r.id}가 시험 계획에 없다`);
    if (!RESULTS.includes(r.result)) report.add('TST-01', P.testReport, r.id, `${r.id}의 결과 '${r.result}'는 ${RESULTS.join(' / ')} 중 하나여야 한다`);
  }
  for (const t of d.tcs) if (!byId.has(t.id)) report.add('TST-01', P.testReport, t.id, `${t.id}의 결과 행이 없다`);

  // TST-02 / TST-03 / TST-04
  const last = lib.readTestState(root);
  for (const t of d.tcs) {
    const r = byId.get(t.id);
    if (!r) continue;
    if (r.result === '통과' && t.exec !== 'manual') {
      const rec = last ? last.tcs.find((x) => x.id === t.id) || {} : {};
      if (!last) report.add('TST-02', P.testReport, t.id, `${t.id}를 통과로 적었지만 시험 실행 기록(${P.testState})이 없다 (node scripts/build.js test-run)`);
      else if (last.suite !== 'passed') report.add('TST-02', P.testReport, t.id, `${t.id}를 통과로 적었지만 최근 시험 실행이 ${last.suite === 'failed' ? '실패' : '실행 불가'}했다`);
      else if (last.perTc && rec.result !== 'passed') report.add('TST-02', P.testReport, t.id, `${t.id}를 통과로 적었지만 테스트 결과 파일에서 ${rec.result === 'failed' ? '실패' : rec.result === 'skipped' ? '건너뜀' : '찾지 못함(실행되지 않음)'}이다`);
      else if (!last.perTc && !rec.inCode) report.add('TST-02', P.testReport, t.id, `${t.id}를 통과로 적었지만 앱 코드에서 ${t.id}를 찾지 못했다`);
    }
    if (r.result === '통과' && t.exec === 'manual' && (!r.by || r.by === '-')) report.add('TST-03', P.testReport, t.id, `사람이 확인하는 ${t.id}의 통과에 확인자가 없다 (사용자가 확인한다)`);
    if (r.result === '실패' || r.result === '실행 불가') report.add('TST-04', P.testReport, t.id, `${t.id}가 ${r.result}이다. 고치거나, 사용자가 정하면 사유와 함께 면제한다`);
    if (r.result === '면제' && (!r.note || r.note === '-')) report.add('TST-04', P.testReport, t.id, `${t.id}의 면제에 사유(비고)가 없다`);
  }

  // TST-09: 시험의 근거(앱 코드·시험 계획·명령 표)가 시험 뒤에 바뀌지 않았다. 근거가 없는 옛 기록은 최신으로 보지 않는다.
  if (last) {
    if (!last.basis) report.add('TST-09', P.testState, '', '시험 실행 기록에 근거 해시가 없다 (옛 기록). node scripts/build.js test-run 으로 다시 시험한다');
    else {
      const now = lib.testBasis(root);
      const what = [['app', '앱 코드'], ['testPlan', '시험 계획'], ['techStack', '명령 표']].filter(([k]) => now[k] !== last.basis[k]).map(([, w]) => w);
      if (what.length) report.add('TST-09', P.testState, '', `시험 뒤에 ${what.join('·')}가 바뀌었다. node scripts/build.js test-run 으로 다시 시험하고 보고서를 갱신한다`);
    }
  }

  // TST-10: 요약의 집계 줄이 결과 표와 같다 ("시나리오 N개: 통과 a · 실패 b · 실행 불가 c · 면제 d")
  const sum = doc.findHeading('요약');
  const m = sum ? /시나리오\s*(\d+)\s*개\s*[:：]\s*통과\s*(\d+)\s*·\s*실패\s*(\d+)\s*·\s*실행 불가\s*(\d+)\s*·\s*면제\s*(\d+)/.exec(doc.textOf(sum)) : null;
  if (!m) report.add('TST-10', P.testReport, '요약', "요약에 '시나리오 N개: 통과 a · 실패 b · 실행 불가 c · 면제 d' 줄이 없다");
  else {
    const count = (v) => rows.filter((r) => r.result === v).length;
    const actual = [rows.length, count('통과'), count('실패'), count('실행 불가'), count('면제')];
    const written = m.slice(1, 6).map(Number);
    if (actual.some((v, k) => v !== written[k])) report.add('TST-10', P.testReport, '요약', `요약의 집계(${written.join('/')})가 결과 표(${actual.join('/')})와 다르다 — 수동 결과를 더한 뒤 요약을 갱신한다`);
  }

  // TST-08: TC 별 판정 없이 통과로 적은 자동 시나리오 (결과 파일이 설정되지 않음)
  if (last && !last.perTc) {
    const auto = d.tcs.filter((t) => t.exec !== 'manual' && (byId.get(t.id) || {}).result === '통과').map((t) => t.id);
    if (auto.length) report.add('TST-08', P.testReport, '', `자동 시나리오 ${auto.length}개가 TC 별 판정 없이 통과로 적혔다 (명령 표에 결과 파일이 없어 전체 실행 통과와 코드의 TC ID 로만 확인했다). 인수 승인 화면에 드러낸다`);
  }

  // TST-05: 모든 인수 기준이 통과한 시나리오로 확인된다 (모두 면제면 경고)
  if (d.spec) {
    for (const ac of d.spec.acs) {
      const mine = d.tcs.filter((t) => t.basis.includes(ac.id)).map((t) => byId.get(t.id)).filter(Boolean);
      if (mine.some((r) => r.result === '통과')) continue;
      if (mine.length && mine.every((r) => r.result === '면제')) report.add('TST-07', P.testReport, ac.id, `${ac.id}(${ac.fr})의 시나리오가 모두 면제다. 인수 승인 화면에 드러낸다`);
      else report.add('TST-05', P.testReport, ac.id, `${ac.id}(${ac.fr})를 통과로 확인한 시나리오가 없다`);
    }
  }
}

module.exports = { run, approval, RAN, RESULTS, readResults };
