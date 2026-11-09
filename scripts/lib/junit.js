'use strict';
// JUnit XML 결과 파일에서 TC 별 결과를 읽는다. 테스트 러너마다 콘솔 출력이 달라, TC 별 판정은 이 표준 파일로만 한다.
// TC ID 는 testcase 의 name·classname 과 그것을 감싸는 testsuite 의 name 에서 찾는다
// (describe 를 testsuite 로 중첩하는 러너는 describe 이름의 TC ID 가 안의 테스트 전부에 적용된다).

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
  if (e[0] !== '#') return XML_ENT[e.toLowerCase()];
  return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
});
const attr = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? unxml(m[1] !== undefined ? m[1] : m[2]) : '';
};

// 속성 부분: 따옴표 안의 '>' 는 이스케이프하지 않아도 된다 (XML 규칙). 따옴표 안은 통째로 넘긴다.
const ATTRS = `((?:[^>"']|"[^"]*"|'[^']*')*?)`;
const TOKEN = new RegExp(
  `<testsuite\\b${ATTRS}(\\/?)>|<\\/testsuite\\s*>|<testcase\\b${ATTRS}(?:\\/>|>([\\s\\S]*?)<\\/testcase\\s*>)|<!--[\\s\\S]*?-->`,
  'g',
);
const TC = /\bTC-\d{3}\b/g;

function parse(text) {
  const byTc = new Map();
  const suites = [];
  let cases = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    const tok = m[0];
    if (tok.startsWith('<!--')) continue;
    if (tok.startsWith('</testsuite')) { suites.pop(); continue; }
    if (tok.startsWith('<testsuite')) { if (m[2] !== '/') suites.push(attr(m[1], 'name')); continue; }
    cases++;
    const a = m[3];
    const name = attr(a, 'name');
    const body = m[4] || '';
    const status = /<(failure|error)\b/.test(body) ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed';
    const where = [...suites, attr(a, 'classname'), name].join(' ');
    for (const id of new Set(where.match(TC) || [])) byTc.set(id, [...(byTc.get(id) || []), { name, status }]);
  }
  return { cases, byTc };
}

// 한 TC 의 테스트들을 합친다: 하나라도 실패 → failed, 통과가 있으면 passed, 모두 건너뜀 → skipped
const combine = (list) => (list.some((x) => x.status === 'failed') ? 'failed' : list.some((x) => x.status === 'passed') ? 'passed' : 'skipped');

module.exports = { parse, combine };
