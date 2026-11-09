'use strict';
const { Doc } = require('../markdown');
const { idsIn, tagIds, scan } = require('../ids');
const common = require('../common');
const interview = require('./interview');

const P = require('../paths');

const FILE = P.prd;

const REQUIRED = ['배경', '비전 및 목표', '타겟 사용자', '핵심 기능', '범위 및 제약', '열린 질문', '요구사항 후보 처리 현황'];
const PF_PRIORITIES = ['Must', 'Should', 'Could'];
const HANDLING = ['PF', '제외', '질문'];

const RAN = ['FMT-01', 'VAL-01', 'VAL-09', 'VAL-10', 'VAL-12', 'VAL-17', 'TRC-01', 'TRC-03', 'TRC-05'];

// 승인 대상. gate approve 와 --approved 가 이 값을 쓴다.
const approval = { file: P.approval('prd'), targets: [FILE], upstream: [P.interview], title: 'PRD' };

function firstTable(doc, sec, required) {
  for (const t of doc.tables(sec)) if (required.every((n) => t.col(n) >= 0)) return t;
  return null;
}

// 핵심 기능 표에서 PF 정의를 읽는다 (검사하지 않는다). spec·design 단계도 쓴다.
function readPfs(doc) {
  const sec = doc.findHeading('핵심 기능');
  const table = sec ? firstTable(doc, sec, ['ID', '우선순위', '근거']) : null;
  const pfs = [];
  if (table) {
    const ci = table.col('ID');
    const cp = table.col('우선순위');
    const cb = table.col('근거');
    for (const row of table.rows) {
      const id = row.cells[ci] || '';
      if (!/^PF-\d{3}$/.test(id)) continue;
      const basis = row.cells[cb] || '';
      pfs.push({
        id, kind: 'PF', file: doc.file, line: row.line,
        priority: (row.cells[cp] || '').replace(/[’‘]/g, "'").trim(),
        basis,
        rcs: tagIds(basis, '인터뷰').filter((x) => x.startsWith('RC-')),
      });
    }
  }
  return { table, pfs };
}

function run(root, report) {
  report.run(...RAN);
  const prd = Doc.load(root, FILE);
  if (!prd) {
    report.add('FMT-01', FILE, '', 'PRD 파일이 없다 (prd-writer 로 먼저 작성한다)');
    return;
  }
  const f = prd.file;

  // FMT-01: 필수 섹션
  const sections = {};
  for (const name of REQUIRED) {
    const sec = prd.findHeading(name);
    sections[name] = sec;
    if (!sec) report.add('FMT-01', f, name, `필수 섹션 '${name}'이 없다`);
    else if (!prd.hasBody(sec)) report.add('FMT-01', f, name, `섹션 '${name}'의 본문이 비어 있다 (해당 없으면 '해당 없음'이라고 쓴다)`);
  }
  common.checkHeadings(prd, report);
  common.checkDate(prd, report);

  // PF 정의 (핵심 기능 표)
  const feat = readPfs(prd);
  if (sections['핵심 기능'] && !feat.table) {
    report.add('FMT-01', f, '핵심 기능', "'핵심 기능' 표에 ID·우선순위·근거 열이 없다");
  }
  const pfs = feat.pfs;

  // VAL-01 / VAL-09
  for (const pf of pfs) {
    if (!PF_PRIORITIES.includes(pf.priority)) {
      const hint = pf.priority === "Won't" ? " (Won't는 핵심 기능 표가 아니라 제외 범위에 쓴다)" : /^(Nice|P\d)$/.test(pf.priority) ? ' (Nice는 Could, P0/P1/P2는 명세 표기)' : '';
      report.add('VAL-01', f, pf.id, `${pf.id}의 우선순위 '${pf.priority || '비어 있음'}'는 허용 값(${PF_PRIORITIES.join(' / ')})이 아니다${hint}`);
    }
    if (pf.rcs.length === 0) report.add('VAL-09', f, pf.id, `${pf.id}의 근거에 [인터뷰: RC-NNN] 태그가 없다`);
  }

  // 상류: 인터뷰 정리본
  const itv = Doc.load(root, interview.FILE);
  if (!itv) {
    report.add('FMT-01', interview.FILE, '', 'PRD의 상류인 인터뷰 정리본이 없다');
    common.checkIds(report, { scanDocs: [prd], defs: pfs, gapDocs: [prd] });
    return;
  }
  if (interview.statusOf(itv) !== '확정') {
    report.add('VAL-10', itv.file, '상태', `인터뷰 정리본의 '> 상태:'가 '확정'이 아니다 (현재: ${interview.statusOf(itv) || '없음'})`);
  }
  const stale = interview.staleConfirmation(itv);
  if (stale) report.add('VAL-12', itv.file, '확정 라운드', `인터뷰 정리본: ${stale}`);
  const conf = interview.confirmationProblem(root, itv);
  if (conf) report.add('VAL-17', interview.confirmation.file, '확정 기록', `인터뷰: ${conf}`);
  const idata = interview.read(itv);
  const rcInfo = new Map(idata.rc.map((d) => [d.id, d]));
  const itvIds = new Set(idata.defs.map((d) => d.id));
  const pfById = new Map(pfs.map((p) => [p.id, p]));

  // TRC-03: 근거 태그가 가리키는 ID가 실존한다
  prd.lines.forEach((line, i) => {
    if (prd.fenced[i]) return;
    for (const id of tagIds(line, '인터뷰')) {
      if (!itvIds.has(id)) report.add('TRC-03', f, id, `${f}:${i + 1} [인터뷰: ${id}]가 인터뷰 정리본에 없다`);
    }
    for (const id of tagIds(line, 'PRD')) {
      if (!pfById.has(id)) report.add('TRC-03', f, id, `${f}:${i + 1} [PRD: ${id}]가 PRD에 없다`);
    }
  });

  // 처리 현황 표
  const handledBy = new Map(); // RC -> [{ handling, links, line }]
  const procSec = sections['요구사항 후보 처리 현황'];
  const procTable = procSec ? firstTable(prd, procSec, ['RC', '처리']) : null;
  if (procSec && !procTable) {
    report.add('FMT-01', f, '요구사항 후보 처리 현황', "처리 현황 표에 'RC'·'처리' 열이 없다");
  }
  if (procTable) {
    const ri = procTable.col('RC');
    const pi = procTable.col('처리');
    const li = procTable.col('연결');
    for (const row of procTable.rows) {
      const rc = (row.cells[ri] || '').trim();
      if (!/^RC-\d{3}$/.test(rc)) continue;
      const entry = { handling: (row.cells[pi] || '').trim(), links: li >= 0 ? idsIn(row.cells[li] || '') : [], line: row.line };
      if (!handledBy.has(rc)) handledBy.set(rc, []);
      handledBy.get(rc).push(entry);
    }

    // TRC-01: 사라진 후보 / 중복 / 처리 값
    for (const rc of rcInfo.keys()) {
      const rows = handledBy.get(rc) || [];
      if (rows.length === 0) report.add('TRC-01', f, rc, `${rc}가 처리 현황에 없다 (사라진 요구사항 후보)`);
      else if (rows.length > 1) report.add('TRC-01', f, rc, `${rc}가 처리 현황에 ${rows.length}번 나온다 (정확히 한 번이어야 한다)`);
    }
    for (const [rc, rows] of handledBy) {
      if (!rcInfo.has(rc)) report.add('TRC-03', f, rc, `처리 현황의 ${rc}가 인터뷰 정리본에 없다`);
      for (const e of rows) {
        if (!HANDLING.includes(e.handling)) {
          report.add('TRC-01', f, rc, `${rc}의 처리 값 '${e.handling || '비어 있음'}'는 ${HANDLING.join(' / ')} 중 하나여야 한다`);
        }
      }
    }

    // 처리 종류별 일관성
    const exSec = prd.findHeading('제외 범위', 3, sections['범위 및 제약']) || sections['범위 및 제약'];
    const excludeText = exSec ? prd.textOf(exSec) : '';
    const questionText = sections['열린 질문'] ? prd.textOf(sections['열린 질문']) : '';
    for (const [rc, rows] of handledBy) {
      if (!rcInfo.has(rc)) continue;
      for (const e of rows) {
        if (e.handling === 'PF') {
          const links = e.links.filter((x) => x.startsWith('PF-'));
          if (links.length === 0) report.add('TRC-01', f, rc, `${rc}는 처리가 PF인데 '연결'에 PF-ID가 없다`);
          for (const pid of links) {
            const pf = pfById.get(pid);
            if (!pf) report.add('TRC-01', f, rc, `${rc}가 연결한 ${pid}가 핵심 기능 표에 없다`);
            else if (!pf.rcs.includes(rc)) report.add('TRC-01', f, rc, `${rc}가 ${pid}에 연결되어 있지만 ${pid}의 근거에 [인터뷰: ${rc}]가 없다`);
          }
        } else if (e.handling === '제외') {
          if (!tagIds(excludeText, '인터뷰').includes(rc)) {
            report.add('TRC-01', f, rc, `${rc}는 처리가 제외인데 제외 범위에 [인터뷰: ${rc}] 항목이 없다`);
          }
        } else if (e.handling === '질문') {
          if (!new RegExp(`\\b${rc}\\b`).test(questionText)) {
            report.add('TRC-01', f, rc, `${rc}는 처리가 질문인데 열린 질문에 ${rc}를 가리키는 항목이 없다`);
          }
        }
      }
    }
  }

  // 역방향: PF의 근거에 적은 RC가 처리 현황에서 그 PF로 연결되어 있는가
  if (procTable) {
    for (const pf of pfs) {
      for (const rc of pf.rcs) {
        const rows = handledBy.get(rc) || [];
        if (!rows.some((e) => e.handling === 'PF' && e.links.includes(pf.id))) {
          report.add('TRC-01', f, pf.id, `${pf.id}의 근거에 ${rc}가 있지만 처리 현황에서 ${rc}가 ${pf.id}로 연결되어 있지 않다`);
        }
      }
    }
  }

  // TRC-05: Won't 가 PF가 되지 않았다
  for (const [rc, d] of rcInfo) {
    if (d.priority !== "Won't") continue;
    const asPf = (handledBy.get(rc) || []).some((e) => e.handling === 'PF');
    const inBasis = pfs.filter((p) => p.rcs.includes(rc));
    if (asPf || inBasis.length) {
      report.add('TRC-05', f, rc, `${rc}는 인터뷰에서 Won't 인데 PF로 올라갔다${inBasis.length ? ` (${inBasis.map((p) => p.id).join(', ')})` : ''}`);
    }
  }

  common.checkIds(report, { scanDocs: [prd], defs: [...idata.defs, ...pfs], gapDocs: [prd] });
}

module.exports = { FILE, run, approval, readPfs };
