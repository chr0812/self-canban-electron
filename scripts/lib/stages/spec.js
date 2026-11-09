'use strict';
const { Doc } = require('../markdown');
const { idsIn, tagIds } = require('../ids');
const common = require('../common');
const interview = require('./interview');
const prdStage = require('./prd');

const P = require('../paths');

const FILE = P.spec;

// 계약의 명세 섹션 20개 + 범위 제외
const SECTIONS = [
  '프로젝트 개요', '조사 근거', '기능 요구사항', '범위 제외', '유스케이스 명세', '비기능 요구사항',
  '제약 조건', '가정', '사용자 스토리', '권한 매트릭스', '화면 구조', '데이터 모델 (개념)', '상태 전이',
  '외부 시스템 카탈로그', '도메인 규칙', 'Candidate Requirements', 'Risk Assessment', 'KPI', '마일스톤',
  '검증 기록', '변경 이력',
];
const PRIORITY_OF = { Must: 'P0', Should: 'P1', Could: 'P2' };
const RANK = { Must: 0, Should: 1, Could: 2 };
const VAGUE = /빠르게|쉽게|편하게|안정적|원활/;
const DESIGN_IMPACTS = ['높음', '보통', '낮음'];

const RAN = ['FMT-01', 'VAL-01', 'VAL-04', 'VAL-05', 'VAL-06', 'VAL-07', 'VAL-11', 'VAL-13', 'VAL-20', 'REF-01', 'REF-02', 'REF-03', 'TRC-02', 'TRC-03', 'TRC-04', 'TRC-05'];

const approval = { file: P.approval('spec'), targets: [FILE], upstream: [P.prd], title: '명세' };

// 줄 첫머리의 "- **ID**" 불릿과 그 아래 들여쓴 줄을 한 덩어리로 읽는다
function bullets(doc, sec, prefix, withPriority = false) {
  const list = [];
  if (!sec) return list;
  const re = new RegExp(`^- \\*\\*(${prefix}-\\d{3})\\*\\*`);
  let prio = null;
  let cur = null;
  for (let i = sec.start; i < sec.end; i++) {
    if (doc.fenced[i]) continue;
    const l = doc.lines[i];
    if (withPriority) {
      const h = /^###\s+(.*)$/.exec(l);
      if (h) {
        const p = /^P([012])\b/.exec(h[1]);
        prio = p ? `P${p[1]}` : null;
        cur = null;
        continue;
      }
    }
    const m = re.exec(l);
    if (m) {
      cur = { id: m[1], kind: prefix, file: doc.file, line: i + 1, prio, lines: [l] };
      list.push(cur);
    } else if (cur && /^\s+\S/.test(l)) cur.lines.push(l);
    else if (cur && l.trim()) cur = null;
  }
  return list;
}

// "### ID 제목" 헤딩으로 정의되고 아래 본문이 이어지는 블록 (US, UC)
function headingBlocks(doc, sec, prefix) {
  const list = [];
  if (!sec) return list;
  const re = new RegExp(`^(${prefix}-\\d{3})`);
  for (const h of doc.headings) {
    if (h.level !== 3 || h.line < sec.start || h.line >= sec.end) continue;
    const m = re.exec(h.clean);
    if (!m) continue;
    const next = doc.headings.find((x) => x.line > h.line && x.level <= 3);
    list.push({ id: m[1], kind: prefix, file: doc.file, line: h.line + 1, text: doc.textOf({ start: h.line + 1, end: next ? next.line : doc.lines.length }) });
  }
  return list;
}

// 표 첫 열로 정의되는 ID (SCR). 관련 FR 열이 있으면 함께 읽는다.
function tableDefs(doc, sec, prefix) {
  const list = [];
  if (!sec) return list;
  const re = new RegExp(`^(${prefix}-\\d{3})$`);
  for (const t of doc.tables(sec)) {
    const fc = t.col('관련 FR');
    for (const r of t.rows) {
      const m = re.exec(r.cells[0] || '');
      if (m) list.push({ id: m[1], kind: prefix, file: doc.file, line: r.line, frs: fc >= 0 ? idsIn(r.cells[fc] || '').filter((x) => x.startsWith('FR-')) : [] });
    }
  }
  return list;
}

// FR 불릿 아래 들여쓴 "- AC-NNN: 기준" 줄 (인수 기준). 어느 FR 아래인지 함께 읽는다.
function acceptance(doc, sec) {
  const list = [];
  if (!sec) return list;
  let fr = null;
  for (let i = sec.start; i < sec.end; i++) {
    if (doc.fenced[i]) continue;
    const l = doc.lines[i];
    const f = /^- \*\*(FR-\d{3})\*\*/.exec(l);
    if (f) { fr = f[1]; continue; }
    if (/^#/.test(l) || /^\S/.test(l)) { fr = null; continue; }
    const a = /^\s+[-*]\s+\**(AC-\d{3})\**\s*[:：]\s*(.*)$/.exec(l);
    if (a && fr) list.push({ id: a[1], kind: 'AC', file: doc.file, line: i + 1, fr, text: a[2].trim() });
  }
  return list;
}

// 줄 첫머리에서 정의되는 ID (CAND·RISK·KPI·MS: 불릿, 표 행, ### 헤딩 어느 쪽이든)
function looseDefs(doc, sec, prefix) {
  const list = [];
  if (!sec) return list;
  const re = new RegExp(`^(?:- \\*\\*|\\| ?|### )(${prefix}-\\d{3})`);
  for (let i = sec.start; i < sec.end; i++) {
    if (doc.fenced[i]) continue;
    const m = re.exec(doc.lines[i]);
    if (m) list.push({ id: m[1], kind: prefix, file: doc.file, line: i + 1 });
  }
  return list;
}

// 명세 문서에서 정의를 뽑는다 (검사하지 않는다). design 단계도 쓴다.
function read(doc) {
  const sec = (n) => doc.findHeading(n);
  const data = {
    sections: Object.fromEntries(SECTIONS.map((n) => [n, sec(n)])),
    frs: bullets(doc, sec('기능 요구사항'), 'FR', true),
    acs: acceptance(doc, sec('기능 요구사항')),
    nfrs: bullets(doc, sec('비기능 요구사항'), 'NFR'),
    cons: bullets(doc, sec('제약 조건'), 'CON'),
    asms: bullets(doc, sec('가정'), 'ASM'),
    uss: headingBlocks(doc, sec('사용자 스토리'), 'US'),
    ucs: headingBlocks(doc, sec('유스케이스 명세'), 'UC'),
    scrs: tableDefs(doc, sec('화면 구조'), 'SCR'),
    cands: looseDefs(doc, sec('Candidate Requirements'), 'CAND'),
    risks: looseDefs(doc, sec('Risk Assessment'), 'RISK'),
    kpis: looseDefs(doc, sec('KPI'), 'KPI'),
    mss: looseDefs(doc, sec('마일스톤'), 'MS'),
  };
  data.defs = [...data.frs, ...data.acs, ...data.nfrs, ...data.cons, ...data.asms, ...data.uss, ...data.ucs, ...data.scrs, ...data.cands, ...data.risks, ...data.kpis, ...data.mss]
    .map((d) => ({ id: d.id, kind: d.kind, file: d.file, line: d.line }));
  return data;
}

const refRule = (line) => (/관련\s*(US|UC|SCR|FR)/.test(line) ? 'REF-01' : 'IDN-02');

// `범위 제외`에서 사용자가 제외하기로 한 PF 를 읽는다.
// 목록 항목 또는 표 행 한 줄에 [PRD: PF-NNN] 과 [사용자 입력] 이 함께 있어야 한다.
// HTML 주석, 코드(블록·인라인), 인용문, escape 한 태그는 읽지 않는다.
function userExclusions(doc, range) {
  const out = new Set();
  if (!range) return out;
  let inComment = false;
  for (let i = range.start; i < range.end; i++) {
    if (doc.fenced[i]) continue;
    let text = doc.lines[i];
    // HTML 주석 제거 (여러 줄 포함)
    let clean = '';
    while (text.length) {
      if (inComment) {
        const end = text.indexOf('-->');
        if (end < 0) { text = ''; break; }
        inComment = false;
        text = text.slice(end + 3);
      } else {
        const start = text.indexOf('<!--');
        if (start < 0) { clean += text; text = ''; break; }
        clean += text.slice(0, start);
        inComment = true;
        text = text.slice(start + 4);
      }
    }
    clean = clean.replace(/`[^`]*`/g, '').replace(/\\\[/g, '');
    if (!/^\s*(?:[-*+]\s|\d+\.\s|\|)/.test(clean)) continue; // 목록 항목 또는 표 행만 (인용문 '>' 제외)
    if (!clean.includes('[사용자 입력]')) continue;
    for (const id of tagIds(clean, 'PRD')) out.add(id);
  }
  return out;
}

function run(root, report) {
  report.run(...RAN);
  const spec = Doc.load(root, FILE);
  if (!spec) {
    report.add('FMT-01', FILE, '', '명세 파일이 없다 (spec-planner 로 먼저 작성한다)');
    return;
  }
  const f = spec.file;
  const d = read(spec);

  // FMT-01 / FMT-02 / FMT-04
  for (const name of SECTIONS) {
    const s = d.sections[name];
    if (!s) report.add('FMT-01', f, name, `필수 섹션 '${name}'이 없다`);
    else if (!spec.hasBody(s)) report.add('FMT-01', f, name, `섹션 '${name}'의 본문이 비어 있다 (해당 없으면 '해당 없음'이라고 쓴다)`);
  }
  common.checkHeadings(spec, report);
  common.checkDate(spec, report);

  // 상류 문서
  const itv = Doc.load(root, interview.FILE);
  const prd = Doc.load(root, prdStage.FILE);
  if (!itv) report.add('FMT-01', interview.FILE, '', '명세의 상류인 인터뷰 정리본이 없다');
  if (!prd) report.add('FMT-01', prdStage.FILE, '', '명세의 상류인 PRD가 없다');
  const idata = itv ? interview.read(itv) : null;
  const pfs = prd ? prdStage.readPfs(prd).pfs : [];
  const rcPriority = new Map(idata ? idata.rc.map((x) => [x.id, x.priority]) : []);
  const itvIds = new Set(idata ? idata.defs.map((x) => x.id) : []);
  const pfById = new Map(pfs.map((p) => [p.id, p]));
  const upstream = Boolean(itv && prd);

  // VAL-01 / VAL-04 / TRC-04 / TRC-05: FR
  const frBasis = new Map();
  for (const fr of d.frs) {
    if (!fr.prio) report.add('VAL-01', f, fr.id, `${fr.id}가 P0/P1/P2 소제목 아래에 있지 않다`);
    const basisLine = fr.lines.find((l) => /근거\s*[:：]/.test(l)) || '';
    const basisText = basisLine.replace(/^.*?근거\s*[:：]/, '').trim();
    if (!basisText) {
      report.add('VAL-04', f, fr.id, `${fr.id}에 '근거:' 필드가 없거나 비어 있다`);
      continue;
    }
    const rc = tagIds(basisText, '인터뷰').filter((x) => x.startsWith('RC-'));
    const pf = tagIds(basisText, 'PRD').filter((x) => x.startsWith('PF-'));
    const user = /\[사용자 입력\]/.test(basisText);
    frBasis.set(fr.id, { rc, pf });
    if (!rc.length && !pf.length && !user) {
      report.add('TRC-04', f, fr.id, `${fr.id}에 사용자 유래 근거([인터뷰: RC-NNN] / [PRD: PF-NNN] / [사용자 입력])가 없다. 조사·여정만 근거인 항목은 CAND 로 둔다`);
    }
    for (const r of rc) {
      if (rcPriority.get(r) === "Won't") report.add('TRC-05', f, fr.id, `${fr.id}가 인터뷰에서 Won't 로 정한 ${r}를 근거로 한다`);
    }
  }

  // TRC-03: 근거 태그가 가리키는 ID가 실존한다
  if (upstream) {
    spec.lines.forEach((line, i) => {
      if (spec.fenced[i]) return;
      for (const id of tagIds(line, '인터뷰')) if (!itvIds.has(id)) report.add('TRC-03', f, id, `${f}:${i + 1} [인터뷰: ${id}]가 인터뷰 정리본에 없다`);
      for (const id of tagIds(line, 'PRD')) if (!pfById.has(id)) report.add('TRC-03', f, id, `${f}:${i + 1} [PRD: ${id}]가 PRD에 없다`);
    });
  }

  // TRC-02: Must PF 는 FR 근거에 나온다 / VAL-11: 우선순위 번역
  const pfToFrs = new Map();
  for (const [fid, b] of frBasis) for (const p of b.pf) pfToFrs.set(p, [...(pfToFrs.get(p) || []), fid]);
  // 승인된 변경으로 제외한 PF: `범위 제외`에 [PRD: PF-NNN] 과 [사용자 입력] 이 한 줄에 함께 있다 (PRD 는 동결이라 고치지 않는다)
  const excludedByUser = userExclusions(spec, d.sections['범위 제외']);
  if (prd) {
    for (const pf of pfs) {
      if (pf.priority === 'Must' && !pfToFrs.has(pf.id) && !excludedByUser.has(pf.id)) {
        report.add('TRC-02', f, pf.id, `Must 인 ${pf.id}가 어떤 FR의 근거에도 나오지 않는다. 사용자가 제외하기로 했다면 '범위 제외'에 [PRD: ${pf.id}] 와 [사용자 입력] 을 한 줄에 함께 적는다`);
      }
    }
    for (const fr of d.frs) {
      const b = frBasis.get(fr.id);
      const prios = (b ? b.pf : []).map((p) => pfById.get(p)).filter(Boolean).map((p) => p.priority).filter((p) => p in RANK).sort((a, c) => RANK[a] - RANK[c]);
      if (!prios.length || !fr.prio) continue;
      const expected = PRIORITY_OF[prios[0]];
      if (fr.prio !== expected) {
        report.add('VAL-11', f, fr.id, `${fr.id}는 ${fr.prio}인데 근거 PF의 우선순위는 ${prios[0]}(=${expected})이다. 명세에서 바꾸려면 사용자 확인이 필요하고 승인 비고에 기록한다`);
      }
    }
  }

  // VAL-13: P0·P1 FR 은 인수 기준(AC)이 1개 이상 있다
  const acsOf = new Set(d.acs.map((a) => a.fr));
  for (const fr of d.frs) {
    if ((fr.prio === 'P0' || fr.prio === 'P1') && !acsOf.has(fr.id)) {
      report.add('VAL-13', f, fr.id, `${fr.prio}인 ${fr.id}에 인수 기준이 없다 ('  - 인수 기준:' 아래 '    - AC-NNN: 기준' 줄)`);
    }
  }
  for (const a of d.acs) if (!a.text) report.add('VAL-13', f, a.id, `${a.id}의 기준 문장이 비어 있다`);

  // VAL-05 / VAL-06 / VAL-07
  for (const a of d.asms) if (!/\[가정\]/.test(a.lines.join('\n'))) report.add('VAL-05', f, a.id, `${a.id}에 [가정] 태그가 없다`);

  // VAL-20: 가정이 설계에 얼마나 영향을 주는지 (명세 승인 화면이 영향 높은 가정을 따로 보여 주는 근거)
  for (const a of d.asms) {
    const m = /설계 영향\s*[:：]\s*([^\n]*)/.exec(a.lines.join('\n'));
    const value = m ? m[1].replace(/[`*]/g, '').trim().split(/[\s(（,—–:]/)[0] : null;
    if (value === null) report.add('VAL-20', f, a.id, `${a.id}에 '- 설계 영향: 높음|보통|낮음' 줄이 없다 (이 가정이 틀리면 설계가 얼마나 뒤집히는가)`);
    else if (!DESIGN_IMPACTS.includes(value)) report.add('VAL-20', f, a.id, `${a.id}의 설계 영향 '${value || '비어 있음'}'은 ${DESIGN_IMPACTS.join(' / ')} 중 하나여야 한다`);
  }
  for (const n of d.nfrs) {
    const text = n.lines.join('\n').replace(/NFR-\d{3}/g, '');
    if (!/\d/.test(text)) report.add('VAL-06', f, n.id, `${n.id}에 측정 수치(숫자)가 없다`);
    if (VAGUE.test(text)) report.add('VAL-07', f, n.id, `${n.id}에 모호한 표현이 있다`);
  }

  // REF-02 / REF-03: P0 FR 의 SCR·UC 매핑과 권한 매트릭스
  const link = (m, k, v) => m.set(k, (m.get(k) || new Set()).add(v));
  const frToScr = new Map();
  const frToUc = new Map();
  for (const fr of d.frs) {
    for (const l of fr.lines) {
      if (/관련\s*SCR/.test(l)) idsIn(l).filter((x) => x.startsWith('SCR-')).forEach((s) => link(frToScr, fr.id, s));
      if (/관련\s*UC/.test(l)) idsIn(l).filter((x) => x.startsWith('UC-')).forEach((u) => link(frToUc, fr.id, u));
    }
  }
  for (const s of d.scrs) s.frs.forEach((x) => link(frToScr, x, s.id));
  for (const u of d.ucs) {
    const fl = u.text.split('\n').filter((l) => /관련\s*FR/.test(l));
    const sl = u.text.split('\n').filter((l) => /관련\s*SCR/.test(l));
    const frsOfUc = fl.flatMap((l) => idsIn(l).filter((x) => x.startsWith('FR-')));
    const scrsOfUc = sl.flatMap((l) => idsIn(l).filter((x) => x.startsWith('SCR-')));
    for (const x of frsOfUc) {
      link(frToUc, x, u.id);
      scrsOfUc.forEach((s) => link(frToScr, x, s));
    }
  }
  const perm = d.sections['권한 매트릭스'] ? spec.textOf(d.sections['권한 매트릭스']) : '';
  for (const fr of d.frs) {
    if (fr.prio !== 'P0') continue;
    if (!(frToScr.get(fr.id) || new Set()).size) report.add('REF-02', f, fr.id, `P0인 ${fr.id}에 매핑된 SCR이 없다`);
    if (!(frToUc.get(fr.id) || new Set()).size) report.add('REF-02', f, fr.id, `P0인 ${fr.id}에 매핑된 UC가 없다`);
    if (!new RegExp(`\\b${fr.id}\\b`).test(perm)) report.add('REF-03', f, fr.id, `P0인 ${fr.id}가 권한 매트릭스에 없다`);
  }

  // ID 규칙 (REF-01 은 관련 ... 줄의 정의 없는 ID)
  common.checkIds(report, {
    scanDocs: [spec],
    defs: [...d.defs, ...(idata ? idata.defs : []), ...pfs],
    gapDocs: [spec],
    refRule,
    // 변경 이력의 '삭제 ID' 열에는 이미 없는 ID가 적히므로 정의 없는 ID 검사에서 뺀다
    skipRef: (doc, line) => {
      const s = d.sections['변경 이력'];
      return Boolean(s) && line - 1 >= s.start && line - 1 < s.end;
    },
  });
}

module.exports = { FILE, run, read, approval, SECTIONS };
