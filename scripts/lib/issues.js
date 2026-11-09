'use strict';
// 구현 중 보고(docs/06-build/issues.md)를 읽고, 행 단위로 안전하게 더하고 고친다.
// 고치기 전에 구조를 검사하고, 고친 뒤 다시 읽어 제목·다른 행이 그대로인지 확인한다. 실패하면 원본을 되돌린다.
const fs = require('fs');
const path = require('path');
const { Doc } = require('./markdown');
const { idsIn } = require('./ids');
const P = require('./paths');

class IssueError extends Error {}

const TITLE = '# 구현 중 보고';
const COLS = ['ID', '발견', '유형', '영향', '상태', '내용', '처리'];
const TYPES = ['코드 결함', '구현 차이', '설계 결함', '명세 결함', '하네스 결함'];
// 유형별 허용 상태. 하네스 결함은 프로젝트 안의 임시 패치와 하네스 원본 반영을 구분한다.
const STATES = {
  '코드 결함': ['미해결', '해결', '기록'],
  '구현 차이': ['미해결', '해결', '기록'],
  '설계 결함': ['미해결', '해결'],
  '명세 결함': ['미해결', '해결'],
  '하네스 결함': ['미해결', '임시 패치', '원본 반영'],
};
// 미해결이면 영향 Task 를 멈추는 유형 (검증을 믿을 수 없거나 근거가 틀렸다)
const BLOCKING = ['설계 결함', '명세 결함', '하네스 결함'];

const cellText = (v) => String(v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();

// 문서 구조를 읽는다. problems 가 비어 있지 않으면 고치지 않는다.
function parse(text, file = P.issues) {
  const doc = new Doc(file, text);
  const problems = [];
  const h1 = doc.headings.find((h) => h.level === 1);
  if (!h1 || `# ${h1.text}` !== TITLE) problems.push(`제목이 '${TITLE}'가 아니다 (현재: '${h1 ? `# ${h1.text}` : '없음'}')`);
  const tables = doc.tables().filter((t) => COLS.every((c) => t.col(c) >= 0));
  if (tables.length === 0) problems.push(`'| ${COLS.join(' | ')} |' 표가 없다`);
  if (tables.length > 1) problems.push('보고 표가 둘 이상이다');
  const table = tables[0] || null;
  const issues = [];
  if (table) {
    const c = Object.fromEntries(COLS.map((n) => [n, table.col(n)]));
    const seen = new Set();
    for (const r of table.rows) {
      if (r.cells.length !== table.headers.length) problems.push(`${r.line}행의 칸 수(${r.cells.length})가 머리(${table.headers.length})와 다르다`);
      const get = (n) => (r.cells[c[n]] || '').trim();
      const id = get('ID');
      if (!/^BI-\d{3}$/.test(id)) { problems.push(`${r.line}행의 ID '${id}'가 BI-NNN 형식이 아니다`); continue; }
      if (seen.has(id)) problems.push(`${id}가 두 번 있다`);
      seen.add(id);
      const scope = get('영향');
      issues.push({ id, line: r.line, type: get('유형'), state: get('상태'), found: get('발견'), scope, all: /전체/.test(scope), tasks: idsIn(scope).filter((x) => x.startsWith('T-')), text: get('내용'), action: get('처리') });
    }
  }
  return { doc, table, issues, problems };
}

function load(root) {
  const p = path.join(root, P.issues);
  if (!fs.existsSync(p)) return null;
  return parse(fs.readFileSync(p, 'utf8'));
}

// 값 검사 (게이트 BLD-03 과 같은 기준)
function valueProblems(i) {
  const out = [];
  if (!TYPES.includes(i.type)) out.push(`${i.id}의 유형 '${i.type}'은 ${TYPES.join(' / ')} 중 하나여야 한다`);
  else if (!STATES[i.type].includes(i.state)) out.push(`${i.id}(${i.type})의 상태 '${i.state}'는 ${STATES[i.type].join(' / ')} 중 하나여야 한다`);
  if (i.state && i.state !== '미해결' && !i.action) out.push(`${i.id}가 닫혔는데 '처리' 칸이 비어 있다`);
  return out;
}

// 수정 → 다시 읽기 → 검사. 실패하면 원본으로 되돌린다.
function commit(root, before, after, check) {
  const p = path.join(root, P.issues);
  fs.writeFileSync(p, after, 'utf8');
  const parsed = parse(fs.readFileSync(p, 'utf8'));
  const why = [...parsed.problems, ...check(parsed)];
  if (why.length) {
    fs.writeFileSync(p, before, 'utf8');
    throw new IssueError(`보고 문서 수정을 취소했다 (원본 보존): ${why.join('; ')}`);
  }
  return parsed;
}

function open(root) {
  const p = path.join(root, P.issues);
  if (!fs.existsSync(p)) throw new IssueError(`${P.issues}가 없다 (node scripts/build.js init)`);
  const text = fs.readFileSync(p, 'utf8');
  const parsed = parse(text);
  if (parsed.problems.length) throw new IssueError(`보고 문서 구조가 깨져 있어 고치지 않는다: ${parsed.problems.join('; ')}`);
  return { text, parsed };
}

// 보고를 더한다. 번호는 이어서 쓴다. 새 ID 를 돌려준다.
function add(root, { type, found = '', scope = '', text: content, state = '미해결', action = '' }) {
  if (!content) throw new IssueError('내용(--text)이 필요하다');
  const { text, parsed } = open(root);
  const max = parsed.issues.reduce((m, i) => Math.max(m, Number(i.id.slice(3))), 0);
  const id = `BI-${String(max + 1).padStart(3, '0')}`;
  const issue = { id, type, state, found, scope, text: content, action };
  const bad = valueProblems(issue);
  if (bad.length) throw new IssueError(bad.join('; '));
  const t = parsed.table;
  const cells = t.headers.map((h) => {
    const name = COLS.find((c) => h.includes(c));
    return cellText({ ID: id, 발견: found, 유형: type, 영향: scope, 상태: state, 내용: content, 처리: action }[name] || '');
  });
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const lastLine = t.rows.length ? t.rows[t.rows.length - 1].line : t.line + 1; // 1부터: 마지막 행 또는 구분선
  lines.splice(lastLine, 0, `| ${cells.join(' | ')} |`);
  const beforeRows = parsed.issues.map((i) => i.id);
  commit(root, text, lines.join('\n'), (p) => {
    const ids = p.issues.map((i) => i.id);
    return ids.length === beforeRows.length + 1 && beforeRows.every((x, k) => ids[k] === x) && ids[ids.length - 1] === id ? [] : ['다른 행이 바뀌었다'];
  });
  return { id };
}

// 한 보고의 상태·처리를 바꾼다. 다른 행과 제목은 건드리지 않는다.
function set(root, id, { state, action }) {
  const { text, parsed } = open(root);
  const target = parsed.issues.find((i) => i.id === id);
  if (!target) throw new IssueError(`${id}가 ${P.issues}에 없다`);
  const next = { ...target, state: state || target.state, action: action !== undefined ? action : target.action };
  const bad = valueProblems(next);
  if (bad.length) throw new IssueError(bad.join('; '));
  const t = parsed.table;
  const row = t.rows.find((r) => r.line === target.line);
  const cells = row.cells.slice();
  cells[t.col('상태')] = cellText(next.state);
  cells[t.col('처리')] = cellText(next.action);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const oldLines = lines.slice();
  lines[target.line - 1] = `| ${cells.join(' | ')} |`;
  commit(root, text, lines.join('\n'), () => {
    const now = fs.readFileSync(path.join(root, P.issues), 'utf8').replace(/\r\n?/g, '\n').split('\n');
    return now.length === oldLines.length && now.every((l, k) => k === target.line - 1 || l === oldLines[k]) ? [] : ['다른 줄이 바뀌었다'];
  });
  return { id, state: next.state };
}

module.exports = { IssueError, TITLE, COLS, TYPES, STATES, BLOCKING, parse, load, valueProblems, add, set };
