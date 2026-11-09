'use strict';
const fs = require('fs');
const path = require('path');
const { Doc, sha256 } = require('../markdown');
const { idsIn } = require('../ids');
const common = require('../common');
const approvalLib = require('../approval');

const P = require('../paths');

const FILE = P.interview;

const REQUIRED = [
  '요약', '문제와 배경', '사용자', '핵심 시나리오', '요구사항 후보', '범위', '성공 기준',
  '제약과 가정', '결정 사항', '열린 질문', '조사 필요 항목', '확인되지 않은 추론', '커버리지',
];
const PRIORITIES = ['Must', 'Should', 'Could', "Won't"];
const MUST_CONFIRM = ['T1', 'T3', 'T4'];
// 0.16 에서 더한 선택 섹션. 필수가 아니다 (옛 정리본은 검사하지 않고, 확정한 정리본에 없으면 VAL-19 경고)
const REALIZE_SECTION = '실현 요건 점검';
// 실현 요건 점검의 처리 → 결과가 남아야 하는 곳의 ID 접두사 (수락 → 요구사항 후보, 기각 → 결정, 보류 → 열린 질문)
const REALIZE_ACTIONS = { 수락: 'RC', 기각: 'D', 보류: 'Q' };
// ID를 정의하는 표가 있는 섹션과 그 섹션이 정의할 수 있는 접두사
const DEF_SECTIONS = [
  { name: '요구사항 후보', kinds: ['RC'] },
  { name: '결정 사항', kinds: ['D'] },
  { name: '제약과 가정', kinds: ['C', 'A'] },
  { name: '열린 질문', kinds: ['Q'] },
];
// 출처 태그가 필요한 항목 (열린 질문은 제외)
const TAGGED = new Set(['RC', 'D', 'C', 'A', 'SC']);

// 셀의 첫 낱말 ("수락 (R5)" → "수락"). 서식 기호는 뗀다.
const word = (s) => (s || '').replace(/[`*]/g, '').trim().split(/[\s(（,]/)[0];

const normPriority = (s) => (s || '').replace(/[’‘`*]/g, (c) => (c === '*' || c === '`' ? '' : "'")).replace(/\s+/g, '');

// 인터뷰 문서에서 정의와 표 데이터를 뽑는다 (검사하지 않는다)
function read(doc) {
  const data = { sections: {}, defs: [], rc: [], coverage: new Map() };
  for (const name of [...REQUIRED, REALIZE_SECTION]) data.sections[name] = doc.findHeading(name);

  for (const { name, kinds } of DEF_SECTIONS) {
    const sec = data.sections[name];
    if (!sec) continue;
    for (const table of doc.tables(sec)) {
      const idCol = table.col('ID') >= 0 ? table.col('ID') : 0;
      for (const row of table.rows) {
        const id = row.cells[idCol] || '';
        const m = /^([A-Z]+)-(\d{3})$/.exec(id);
        if (!m || !kinds.includes(m[1])) continue;
        const def = { id, kind: m[1], file: doc.file, line: row.line, table, row };
        data.defs.push(def);
        if (m[1] === 'RC') {
          const pc = table.col('우선순위');
          def.priority = pc >= 0 ? normPriority(row.cells[pc]) : null;
          data.rc.push(def);
        }
      }
    }
  }

  const sc = data.sections['핵심 시나리오'];
  if (sc) {
    for (const h of doc.headings) {
      if (h.level !== 3 || h.line < sc.start || h.line >= sc.end) continue;
      const m = /^(SC-\d{3})\b/.exec(h.clean);
      if (!m) continue;
      const next = doc.headings.find((x) => x.line > h.line && x.level <= 3);
      data.defs.push({ id: m[1], kind: 'SC', file: doc.file, line: h.line + 1, block: { start: h.line + 1, end: next ? next.line : doc.lines.length } });
    }
  }

  const cov = data.sections['커버리지'];
  if (cov) {
    for (const table of doc.tables(cov)) {
      const ic = table.col('ID');
      const sc2 = table.col('상태');
      if (ic < 0 || sc2 < 0) continue;
      for (const row of table.rows) data.coverage.set(row.cells[ic], row.cells[sc2]);
    }
  }
  return data;
}

function statusOf(doc) {
  return (doc.meta()['상태'] || '').split(/\s+/)[0];
}

// 머리의 '라운드: N'(지금까지 진행한 라운드)과 '확정 라운드: N'(사용자가 확정한 시점의 라운드)
function roundsOf(doc) {
  const out = { current: null, confirmed: null };
  for (let i = 0; i < Math.min(doc.lines.length, 25); i++) {
    const line = doc.lines[i];
    if (!line.startsWith('>')) continue;
    const c = /확정 라운드\s*[:：]\s*(\d+)/.exec(line);
    if (c) { out.confirmed = Number(c[1]); continue; }
    const n = /라운드\s*[:：]\s*(\d+)/.exec(line);
    if (n && out.current === null) out.current = Number(n[1]);
  }
  return out;
}

// 확정한 뒤 라운드가 늘었다 = 확정 뒤에 내용을 보강했다. 다시 확정을 받아야 한다.
// '확정 라운드' 줄이 없는 옛 정리본은 검사하지 않는다. 문제가 있으면 안내 문장, 없으면 null.
function staleConfirmation(doc) {
  const r = roundsOf(doc);
  if (statusOf(doc) !== '확정' || r.confirmed === null || r.current === null || r.confirmed === r.current) return null;
  return `확정 라운드(${r.confirmed})와 현재 라운드(${r.current})가 다르다. 확정 뒤에 바뀐 내용을 사용자에게 보여 주고 다시 확정을 받는다`;
}

// 이 프로젝트에서 사용자가 확정한 기록 (gate.js confirm interview). 다른 프로젝트에서 가져온 정리본도 여기서 확정(재사용 승인)을 받는다.
const confirmation = { file: P.interviewConfirm, targets: [FILE], title: '인터뷰 확정' };

// 상태가 '확정'인데 확정 기록이 없거나 확정 뒤 정리본이 바뀌었으면 안내 문장, 아니면 null
function confirmationProblem(root, doc) {
  if (statusOf(doc) !== '확정') return null;
  const p = path.join(root, confirmation.file);
  if (!fs.existsSync(p)) return `이 프로젝트에서 확정한 기록(${confirmation.file})이 없다. 사용자 확정 뒤 'node scripts/gate.js confirm interview --by <이름>'으로 남긴다 (다른 프로젝트에서 가져온 정리본은 재사용을 확인받고 --note 에 출처를 적는다)`;
  const a = approvalLib.parse(fs.readFileSync(p, 'utf8'));
  const recorded = a.hashes.get(FILE) || a.hashes.get('');
  if (a.approved !== '예' || !recorded) return `확정 기록(${confirmation.file})이 온전하지 않다`;
  if (recorded !== sha256(fs.readFileSync(path.join(root, FILE), 'utf8'))) return '확정한 뒤 정리본이 바뀌었다. 바뀐 내용을 보여 주고 다시 확정을 받는다';
  return null;
}

// 머리의 '사전 자료:'와 본문의 [조사: 경로]가 가리키는 로컬 파일이 있는가 (역사적 인용이 아니라 지금 입력으로 쓰는 참조)
function missingRefs(root, doc) {
  const refs = new Set();
  for (const raw of (doc.meta()['사전 자료'] || '').split(/[,，]/)) {
    const v = raw.replace(/`/g, '').trim();
    if (/^(docs|app)\/\S+$/.test(v)) refs.add(v);
  }
  doc.lines.forEach((l, i) => {
    if (doc.fenced[i]) return;
    for (const m of l.matchAll(/\[조사\s*:\s*(docs\/[^\]\s#]+)/g)) refs.add(m[1]);
  });
  return [...refs].filter((r) => !fs.existsSync(path.join(root, r)));
}

// VAL-19: 확정한 인터뷰에 실현 요건 점검 섹션이 있고, 점검 표의 처리와 연결이 맞다 (경고)
function checkRealization(doc, data, report) {
  const f = doc.file;
  if (statusOf(doc) === '확정') {
    const sec = data.sections[REALIZE_SECTION];
    if (!sec) report.add('VAL-19', f, REALIZE_SECTION, `확정한 인터뷰에 '${REALIZE_SECTION}' 섹션이 없다 (해당 없으면 '해당 없음'이라고 쓴다)`);
    else if (!doc.hasBody(sec)) report.add('VAL-19', f, REALIZE_SECTION, `섹션 '${REALIZE_SECTION}'의 본문이 비어 있다 (해당 없으면 '해당 없음'이라고 쓴다)`);
  }
  const sec = data.sections[REALIZE_SECTION];
  if (!sec) return;
  const defined = new Set(data.defs.map((d) => d.id));
  for (const table of doc.tables(sec)) {
    const ac = table.col('처리');
    const lc = table.col('연결');
    if (ac < 0) continue;
    for (const row of table.rows) {
      const item = row.cells[0] || `${f}:${row.line}`;
      const action = word(row.cells[ac]);
      if (!(action in REALIZE_ACTIONS)) {
        report.add('VAL-19', f, item, `'${item}'의 처리 '${action || '비어 있음'}'는 ${Object.keys(REALIZE_ACTIONS).join(' / ')} 중 하나여야 한다`);
        continue;
      }
      // 수락 → 요구사항 후보(RC), 기각 → 결정(D), 보류 → 열린 질문(Q)에 남아야 사라지는 항목이 없다
      const want = REALIZE_ACTIONS[action];
      const links = lc >= 0 ? idsIn(row.cells[lc] || '').filter((x) => x.startsWith(`${want}-`)) : [];
      if (!links.length) report.add('VAL-19', f, item, `'${item}'는 ${action}인데 연결 열에 ${want}-NNN 이 없다`);
      else for (const l of links) if (!defined.has(l)) report.add('VAL-19', f, item, `'${item}'가 연결한 ${l}가 정의되어 있지 않다`);
    }
  }
}

const RAN = ['FMT-01', 'VAL-01', 'VAL-02', 'VAL-03', 'VAL-08', 'VAL-10', 'VAL-12', 'VAL-17', 'VAL-18', 'VAL-19'];

function run(root, report) {
  const doc = Doc.load(root, FILE);
  report.run(...RAN);
  if (!doc) {
    report.add('FMT-01', FILE, '', '인터뷰 정리본이 없다 (/interview 를 먼저 실행한다)');
    return;
  }
  const f = doc.file;
  const data = read(doc);

  // FMT-01: 필수 섹션
  for (const name of REQUIRED) {
    const sec = data.sections[name];
    if (!sec) report.add('FMT-01', f, name, `필수 섹션 '${name}'이 없다`);
    else if (!doc.hasBody(sec)) report.add('FMT-01', f, name, `섹션 '${name}'의 본문이 비어 있다 (해당 없으면 '해당 없음'이라고 쓴다)`);
  }
  if (data.sections['요구사항 후보'] && data.rc.length === 0) {
    report.add('FMT-01', f, '요구사항 후보', '요구사항 후보가 1건도 없다 (PRD로 옮길 항목이 없다)');
  }
  common.checkHeadings(doc, report);
  common.checkDate(doc, report);

  // VAL-10: 상태 확정
  const status = statusOf(doc);
  if (status !== '확정') report.add('VAL-10', f, '상태', `머리의 '> 상태:'가 '확정'이 아니다 (현재: ${status || '없음'})`);

  // VAL-12: 확정 뒤 보강 (판정은 staleConfirmation)
  const stale = staleConfirmation(doc);
  if (stale) report.add('VAL-12', f, '확정 라운드', stale);

  // VAL-17: 이 프로젝트의 확정 기록 / VAL-18: 지금 입력으로 쓰는 조사 참조가 있다
  const conf = confirmationProblem(root, doc);
  if (conf) report.add('VAL-17', confirmation.file, '확정 기록', conf);
  for (const r of missingRefs(root, doc)) report.add('VAL-18', f, r, `참조한 조사 자료 ${r}가 없다 (지웠다면 참조를 정리하고, 다른 프로젝트의 자료라면 출처로만 적는다)`);

  // VAL-19: 실현 요건 점검
  checkRealization(doc, data, report);

  // VAL-02: 출처 태그
  const noColumn = new Set();
  for (const d of data.defs) {
    if (!TAGGED.has(d.kind)) continue;
    if (d.kind === 'SC') {
      const text = doc.textOf(d.block);
      if (!/출처\s*[:：][^\n]*\[(U|S|I)\]/.test(text)) report.add('VAL-02', f, d.id, `${d.id}에 '- 출처: [U|S|I]' 줄이 없다`);
      continue;
    }
    const col = d.table.col('출처');
    if (col < 0) {
      if (!noColumn.has(d.table)) {
        noColumn.add(d.table);
        report.add('VAL-02', f, d.id, `${d.kind} 항목 표에 '출처' 열이 없다`);
      }
    } else if (!/\[(U|S|I)\]/.test(d.row.cells[col] || '')) {
      report.add('VAL-02', f, d.id, `${d.id}의 출처 태그([U]/[S]/[I])가 없다`);
    }
  }

  // VAL-03 / VAL-01: 요구사항 후보 표
  const noPriority = new Set();
  for (const d of data.rc) {
    const sc = d.table.col('출처');
    if (sc >= 0 && /\[I\]/.test(d.row.cells[sc] || '')) {
      report.add('VAL-03', f, d.id, `${d.id}는 출처가 [I](미확인 추론)인데 요구사항 후보 표에 있다. 사용자 확인 후 [S]로 바꾸거나 '확인되지 않은 추론'으로 옮긴다`);
    }
    if (d.priority === null) {
      if (!noPriority.has(d.table)) {
        noPriority.add(d.table);
        report.add('VAL-01', f, d.id, "요구사항 후보 표에 '우선순위' 열이 없다");
      }
    } else if (!PRIORITIES.includes(d.priority)) {
      const hint = /^(Nice|P2)$/.test(d.priority) ? ' (Nice는 Could로 쓴다)' : /^P[01]$/.test(d.priority) ? ' (P0/P1/P2는 명세 표기다. 여기서는 Must/Should/Could)' : '';
      report.add('VAL-01', f, d.id, `${d.id}의 우선순위 '${d.priority || '비어 있음'}'는 허용 값(${PRIORITIES.join(' / ')})이 아니다${hint}`);
    }
  }

  // VAL-08: 필수 토픽 확정
  for (const t of MUST_CONFIRM) {
    const s = data.coverage.get(t);
    if (s === undefined) report.add('VAL-08', f, t, `커버리지 표에 ${t} 행이 없다`);
    else if (s !== '확정') report.add('VAL-08', f, t, `필수 토픽 ${t}의 상태가 '확정'이 아니다 (현재: ${s || '비어 있음'})`);
  }

  common.checkIds(report, { scanDocs: [doc], defs: data.defs, gapDocs: [doc] });
}

module.exports = { FILE, read, run, statusOf, staleConfirmation, confirmation, confirmationProblem };
