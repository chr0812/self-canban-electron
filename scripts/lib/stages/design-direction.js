'use strict';
// 설계 단계의 디자인 방향 검사 (DSN-01 ~ DSN-05, 계약 0.16).
// 시안 비교표(_variants/directions.md)와 UI 명세의 '디자인 방향'·'디자인 토큰'·화면 상세를 읽는다.
// 모두 경고다: 형식과 완결성만 보고, 시안이 실제로 다른지·좋은지는 사용자가 고른다.
const fs = require('fs');
const path = require('path');
const { Doc } = require('../markdown');
const P = require('../paths');

const RAN = ['DSN-01', 'DSN-02', 'DSN-03', 'DSN-04', 'DSN-05'];

const MIN_VARIANTS = 2;
const MIN_AXIS_DIFF = 5; // 시안 두 개가 서로 다른 축의 최소 개수
const TOKEN_KINDS = ['색', '글꼴', '글자 크기', '간격', '모서리', '움직임'];
// 기본값으로 굳은 글꼴. contracts/design/anti-slop.md 의 '기본값 글꼴' 목록과 같아야 한다 (테스트가 일치를 확인한다).
// Inter·Geist 는 Impeccable 공개 카탈로그(impeccable.style/slop)가 이름을 든 것이고, 나머지는 이 하네스가 더한 범용·시스템 기본 글꼴이다.
const OVERUSED_FONTS = ['Inter', 'Geist', 'Arial', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '시스템 기본'];
const USER_REASON = /\[사용자 입력\]/;

const plain = (s) => (s || '').replace(/[`*]/g, '').trim();
const norm = (s) => plain(s).toLowerCase().replace(/\s+/g, ' ');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
// 영문 낱말 경계: Inter 는 Interstate 와 다르다
const fontRe = (name) => new RegExp(`(^|[^a-z0-9-])${esc(name.toLowerCase())}([^a-z0-9-]|$)`, 'i');

// _variants/directions.md 의 '축 비교' 표: 헤더가 V-A, V-B … 로 시작하는 열이 시안이다
function readDirections(root) {
  const doc = Doc.load(root, P.directions);
  if (!doc) return null;
  const sec = doc.findHeading('축 비교');
  const table = sec && doc.tables(sec).find((t) => t.headers.some((h) => /^V-[A-Z]\b/.test(plain(h))));
  if (!table) return { doc, variants: [], axes: [] };
  const variants = table.headers
    .map((h, col) => ({ id: (/^(V-[A-Z])\b/.exec(plain(h)) || [])[1], col }))
    .filter((v) => v.id);
  const axes = table.rows.map((r) => ({ axis: plain(r.cells[0]), values: variants.map((v) => norm(r.cells[v.col])) }));
  return { doc, variants, axes };
}

const variantFiles = (root) => {
  const d = path.join(root, P.variants);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.svg')) : [];
};

// DSN-02: 시안이 둘 이상, 서로 다른 축이 충분, 시안마다 화면 파일
function checkVariants(root, dirs, report) {
  if (!dirs) {
    report.add('DSN-02', P.directions, '', "시안 비교표(_variants/directions.md)가 없다. 시안을 만들고 '축 비교' 표로 서로 다른 점을 적는다");
    return;
  }
  const { variants, axes } = dirs;
  if (variants.length < MIN_VARIANTS) {
    report.add('DSN-02', P.directions, '축 비교', `'축 비교' 표에 시안 열(V-A, V-B …)이 ${variants.length}개뿐이다 (최소 ${MIN_VARIANTS}개)`);
    return;
  }
  for (let a = 0; a < variants.length; a++) {
    for (let b = a + 1; b < variants.length; b++) {
      const diff = axes.filter((x) => x.values[a] && x.values[b] && x.values[a] !== x.values[b]).length;
      if (diff < MIN_AXIS_DIFF) {
        report.add('DSN-02', P.directions, `${variants[a].id}~${variants[b].id}`, `${variants[a].id}와 ${variants[b].id}가 서로 다른 축이 ${diff}개뿐이다 (최소 ${MIN_AXIS_DIFF}개). 같은 틀에서 색만 바꾼 시안이 아닌지 본다`);
      }
    }
  }
  const files = variantFiles(root);
  for (const v of variants) {
    if (!files.some((f) => f.startsWith(`${v.id}-`))) report.add('DSN-02', P.variants, v.id, `${v.id}의 화면 파일(${v.id}-SCR-NNN.svg)이 _variants/ 에 없다`);
  }
}

// DSN-01: 디자인 방향에 선택한 시안과 기각한 시안의 사유
function checkChoice(ui, dirs, report) {
  const sec = ui.findHeading('디자인 방향');
  if (!sec) {
    report.add('DSN-01', ui.file, '디자인 방향', "UI 명세에 '디자인 방향' 섹션이 없다 (선택한 시안과 기각한 시안의 사유를 적는다)");
    return;
  }
  const field = (name) => {
    const re = new RegExp(`^\\s*[-*]\\s*\\**${name}\\**\\s*[:：]\\s*(.*)$`);
    for (let i = sec.start; i < sec.end; i++) {
      if (ui.fenced[i]) continue;
      const m = re.exec(ui.lines[i]);
      if (m) return m[1].trim();
    }
    return null;
  };
  const choice = field('선택');
  const reject = field('기각');
  const chosen = [...new Set((choice || '').match(/V-[A-Z]\b/g) || [])];
  if (!chosen.length) {
    report.add('DSN-01', ui.file, '선택', "'- 선택: V-A' 줄이 없다 (고른 시안 ID. 조합이면 여러 개)");
    return;
  }
  const known = dirs ? dirs.variants.map((v) => v.id) : null;
  if (known) for (const c of chosen) if (!known.includes(c)) report.add('DSN-01', ui.file, c, `선택한 ${c}가 시안 비교표에 없다`);
  const others = (known || []).filter((v) => !chosen.includes(v));
  if (!others.length) return;
  if (reject === null) {
    report.add('DSN-01', ui.file, '기각', `'- 기각: ${others.join(', ')} (사유)' 줄이 없다`);
    return;
  }
  const parts = reject.split(/(?=V-[A-Z]\b)/);
  for (const o of others) {
    const part = parts.find((p) => p.startsWith(o));
    // 사유: ID 뒤의 문장 부호·공백을 뺀 글자가 있어야 한다
    const reason = part ? part.slice(o.length).replace(/[\s,;:()（）\-–—.]/g, '') : '';
    if (reason.length < 2) report.add('DSN-01', ui.file, o, `기각한 ${o}의 사유가 없다`);
  }
}

// DSN-03 / DSN-04: 디자인 토큰 표
function checkTokens(ui, report) {
  const sec = ui.findHeading('디자인 토큰');
  if (!sec) {
    report.add('DSN-04', ui.file, '디자인 토큰', `UI 명세에 '디자인 토큰' 섹션이 없다 (${TOKEN_KINDS.join(', ')})`);
    return;
  }
  const rows = [];
  for (const t of ui.tables(sec)) {
    const kc = t.col('구분');
    const vc = t.col('값');
    if (kc < 0 || vc < 0) continue;
    for (const r of t.rows) rows.push({ kind: plain(r.cells[kc]), value: plain(r.cells[vc]), text: r.cells.join(' ') });
  }
  for (const kind of TOKEN_KINDS) {
    const row = rows.find((r) => r.kind === kind);
    if (!row || !row.value || row.value === '-') report.add('DSN-04', ui.file, kind, `디자인 토큰 표에 '${kind}' 값이 없다 ('| 구분 | 값 |' 열이 있는 표)`);
  }
  const font = rows.find((r) => r.kind === '글꼴');
  if (font) {
    const hit = OVERUSED_FONTS.find((n) => fontRe(n).test(font.value));
    if (hit && !USER_REASON.test(font.text)) {
      report.add('DSN-03', ui.file, hit, `글꼴 '${hit}'은 기본값으로 굳은 글꼴이다. 쓰려면 같은 줄에 [사용자 입력]과 사유(브랜드 지정 등)를 적고, 아니면 시안의 글자 축에 맞는 다른 글꼴을 고른다`);
    }
  }
}

// DSN-05: 화면 상세마다 시선 위계
function checkHierarchy(ui, scrs, report) {
  const sec = ui.findHeading('화면 상세');
  if (!sec) return; // 섹션 누락은 FMT-01 이 본다
  for (const s of scrs) {
    const h = ui.headings.find((x) => x.level === 3 && x.line >= sec.start && x.line < sec.end && x.clean.startsWith(s.id));
    if (!h) {
      report.add('DSN-05', ui.file, s.id, `화면 상세에 '### ${s.id}' 블록이 없어 시선 위계를 확인할 수 없다`);
      continue;
    }
    const next = ui.headings.find((x) => x.line > h.line && x.level <= 3);
    if (!/시선 위계/.test(ui.textOf({ start: h.line + 1, end: next ? next.line : ui.lines.length }))) {
      report.add('DSN-05', ui.file, s.id, `${s.id}에 '시선 위계'(화면에서 먼저 보여야 할 것의 순서)가 없다`);
    }
  }
}

function check(root, ui, scrs, report) {
  const dirs = readDirections(root);
  checkVariants(root, dirs, report);
  if (!ui) return; // UI 명세 누락은 FMT-01 이 본다
  checkChoice(ui, dirs, report);
  checkTokens(ui, report);
  checkHierarchy(ui, scrs, report);
}

module.exports = { RAN, check, OVERUSED_FONTS, MIN_AXIS_DIFF, TOKEN_KINDS };
