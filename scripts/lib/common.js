'use strict';
const { BAD_DIGITS_PATTERN, LOWER_PATTERN, scan, idsIn } = require('./ids');

// FMT-02: 헤딩에 번호를 붙이지 않는다
function checkHeadings(doc, report) {
  report.run('FMT-02');
  for (const h of doc.headings) {
    if (h.level >= 2 && /^[^\p{L}\p{N}]*\d+[.)]\s/u.test(h.text)) {
      report.add('FMT-02', doc.file, h.text, `헤딩에 번호가 있다: '${h.text}'`);
    }
  }
}

// FMT-04: 문서 머리에 "> 작성일: YYYY-MM-DD" 줄
function checkDate(doc, report) {
  report.run('FMT-04');
  const value = doc.meta()['작성일'];
  if (!value || !/\d{4}-\d{2}-\d{2}/.test(value)) {
    report.add('FMT-04', doc.file, '작성일', "문서 머리에 '> 작성일: YYYY-MM-DD' 줄이 없다");
  }
}

// '변경 이력' 섹션 구간 (없으면 null). 이 구간의 ID 는 삭제·과거 기록이라 정의 없는 ID 검사에서 뺀다.
function changeLog(doc) {
  return doc.findHeading('변경 이력');
}
const inChangeLog = (doc, line) => {
  const s = changeLog(doc);
  return Boolean(s) && line - 1 >= s.start && line - 1 < s.end;
};

// '변경 이력' 표에서 헤더에 '삭제'가 든 열의 ID (삭제한 ID)
function deletedIds(doc) {
  const out = new Set();
  const s = changeLog(doc);
  if (!s) return out;
  for (const t of doc.tables(s)) {
    t.headers.forEach((h, k) => {
      if (!h.includes('삭제')) return;
      for (const r of t.rows) for (const id of idsIn(r.cells[k] || '')) out.add(id);
    });
  }
  return out;
}

// ID 규칙 묶음.
//   scanDocs : ID 출현을 검사할 문서들
//   defs     : 정의된 ID 전부 [{ id, kind, file, line }] (상류 문서 포함)
//   gapDocs  : 결번(IDN-03)을 검사할 문서들 (자기가 정의한 ID만 본다)
//   refRule  : 정의 없는 ID를 어느 규칙으로 보고할지 줄 내용으로 정한다 (기본 IDN-02)
//   skipRef  : (doc, 줄 번호) → true 면 그 줄의 정의 없는 ID를 보지 않는다 (삭제 이력을 적는 변경 이력 등)
function checkIds(report, { scanDocs, defs, gapDocs, refRule = () => 'IDN-02', skipRef = () => false }) {
  report.run('IDN-01', 'IDN-02', 'IDN-03', 'IDN-04');

  // IDN-01: 정의 위치 중복
  const seen = new Map();
  for (const d of defs) {
    const prev = seen.get(d.id);
    if (prev) report.add('IDN-01', d.file, d.id, `${d.id}가 두 곳에서 정의된다 (${prev.file}:${prev.line}, ${d.file}:${d.line})`);
    else seen.set(d.id, d);
  }

  for (const doc of scanDocs) {
    // IDN-02: 참조한 ID가 정의되어 있다 (근거 태그 안은 TRC-03 이 본다)
    const reported = new Set();
    for (const occ of scan(doc, { stripTags: true })) {
      if (seen.has(occ.id) || reported.has(occ.id) || skipRef(doc, occ.line)) continue;
      reported.add(occ.id);
      report.add(refRule(doc.lines[occ.line - 1]), doc.file, occ.id, `${doc.file}:${occ.line} 에서 참조한 ${occ.id}가 정의되어 있지 않다`);
    }

    // IDN-04: 자릿수·대소문자 오류
    const bad = new RegExp(BAD_DIGITS_PATTERN, 'gi');
    const lower = new RegExp(LOWER_PATTERN, 'g');
    const reportedBad = new Set();
    doc.lines.forEach((line, i) => {
      if (doc.fenced[i]) return;
      for (const re of [bad, lower]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
          if (reportedBad.has(m[0])) continue;
          reportedBad.add(m[0]);
          report.add('IDN-04', doc.file, m[0], `${doc.file}:${i + 1} ID 형식 오류 '${m[0]}' (대문자 접두사 + 3자리 숫자, 예: RC-001)`);
        }
      }
    });
  }

  // IDN-03: 결번 (삭제 이력이 없으면 경고). '변경 이력' 표의 '삭제' 열에 적힌 ID 는 결번이 아니다.
  for (const doc of gapDocs) {
    const deleted = deletedIds(doc);
    const byKind = new Map();
    for (const d of defs) {
      if (d.file !== doc.file) continue;
      const n = Number(d.id.split('-')[1]);
      if (!byKind.has(d.kind)) byKind.set(d.kind, new Set());
      byKind.get(d.kind).add(n);
    }
    for (const [kind, nums] of byKind) {
      const max = Math.max(...nums);
      const missing = [];
      for (let n = 1; n <= max; n++) {
        const id = `${kind}-${String(n).padStart(3, '0')}`;
        if (!nums.has(n) && !deleted.has(id)) missing.push(id);
      }
      if (missing.length) report.add('IDN-03', doc.file, kind, `결번: ${missing.join(', ')} (삭제한 것이면 변경 이력에 남긴다)`);
    }
  }
}

module.exports = { checkHeadings, checkDate, checkIds, deletedIds, inChangeLog };
