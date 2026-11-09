'use strict';

// 접두사 목록은 contracts/artifact-contract.md 의 ID 체계와 같다.
const PREFIXES = ['NFR', 'CON', 'ASM', 'SCR', 'CAND', 'RISK', 'KPI', 'RC', 'SC', 'PF', 'FR', 'US', 'UC', 'MS', 'AC', 'TC', 'BI', 'D', 'A', 'C', 'Q', 'T'];
const ALT = PREFIXES.join('|');

const ID_PATTERN = `\\b(${ALT})-(\\d{3})\\b`;
// 형식 오류: 자릿수가 3이 아니거나 접두사가 소문자
const BAD_DIGITS_PATTERN = `\\b(?:${ALT})-(?:\\d{1,2}|\\d{4,})\\b`;
const LOWER_PATTERN = `\\b(?:${PREFIXES.map((p) => p.toLowerCase()).join('|')})-\\d{3}\\b`;

// [인터뷰: RC-001] / [PRD: PF-001] 형태의 근거 태그
const TAG_PATTERN = '\\[(인터뷰|PRD)\\s*:\\s*([^\\]]*)\\]';

function idsIn(text) {
  const out = [];
  const re = new RegExp(ID_PATTERN, 'g');
  let m;
  while ((m = re.exec(text))) out.push(`${m[1]}-${m[2]}`);
  return out;
}

// 근거 태그 안의 ID들. tagName 이 주어지면 그 종류의 태그만.
function tagIds(text, tagName = null) {
  const out = [];
  const re = new RegExp(TAG_PATTERN, 'g');
  let m;
  while ((m = re.exec(text))) {
    if (tagName && m[1] !== tagName) continue;
    out.push(...idsIn(m[2]));
  }
  return out;
}

// 문서(코드 블록 제외)에서 ID 출현을 모두 센다. stripTags 면 근거 태그 안은 제외한다.
function scan(doc, { stripTags = false } = {}) {
  const out = [];
  const tagRe = new RegExp(TAG_PATTERN, 'g');
  doc.lines.forEach((line, i) => {
    if (doc.fenced[i]) return;
    const text = stripTags ? line.replace(tagRe, ' ') : line;
    for (const id of idsIn(text)) out.push({ id, line: i + 1 });
  });
  return out;
}

module.exports = { PREFIXES, ID_PATTERN, BAD_DIGITS_PATTERN, LOWER_PATTERN, idsIn, tagIds, scan };
