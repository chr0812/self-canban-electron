'use strict';
const fs = require('fs');
const path = require('path');
const { sha256 } = require('./markdown');

const pad = (n) => String(n).padStart(2, '0');
const dateOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stampOf = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

// _approval.md 의 "키: 값" 줄을 읽는다
function parse(text) {
  const out = { approved: null, by: null, date: null, hashes: new Map(), upstream: new Map() };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    let m;
    if ((m = /^승인\s*:\s*(.*)$/.exec(line))) out.approved = m[1].trim();
    else if ((m = /^승인자\s*:\s*(.*)$/.exec(line))) out.by = m[1].trim();
    else if ((m = /^승인일\s*:\s*(.*)$/.exec(line))) out.date = m[1].trim();
    else if ((m = /^상류 해시\s*:\s*(\S+)\s+sha256:([0-9a-f]{64})\s*$/.exec(line))) out.upstream.set(m[1], m[2]);
    else if ((m = /^대상 해시\s*:\s*(?:(\S+)\s+)?sha256:([0-9a-f]{64})\s*$/.exec(line))) out.hashes.set(m[1] || '', m[2]);
  }
  return out;
}

// 승인 대상 목록. desc.targets 가 함수면 현재 파일 상태로 계산한다 (예: 와이어프레임 개수가 가변).
const targetsOf = (root, desc) => (typeof desc.targets === 'function' ? desc.targets(root) : desc.targets);

// 상류 문서(승인 시점에 이 단계가 근거로 삼은 문서)의 현재 해시. 파일이 없으면 null.
const upstreamHash = (root, rel) => {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? sha256(fs.readFileSync(p, 'utf8')) : null;
};

// 승인 때 기록한 상류 해시와 현재를 비교해 바뀐 상류 문서 목록을 돌려준다. 기록이 없는(옛) 승인은 null.
function upstreamChanges(root, parsed) {
  if (parsed.upstream.size === 0) return null;
  const changed = [];
  for (const [rel, recorded] of parsed.upstream) {
    if (upstreamHash(root, rel) !== recorded) changed.push(rel);
  }
  return changed;
}

// APR-01 / APR-02 / APR-03
function check(root, desc, report) {
  report.run('APR-01', 'APR-02', 'APR-03');
  const p = path.join(root, desc.file);
  if (!fs.existsSync(p)) {
    report.add('APR-01', desc.file, '', `승인 파일이 없다 — 사용자가 승인하면 'gate approve'로 만든다`);
    return;
  }
  const a = parse(fs.readFileSync(p, 'utf8'));
  for (const rel of upstreamChanges(root, a) || []) {
    report.add('APR-03', desc.file, rel, `승인 뒤에 상류 문서 ${rel}가 바뀌었다. 영향을 재검토하고 다시 승인을 받아야 한다`);
  }
  if (a.approved !== '예') report.add('APR-01', desc.file, '', `'승인: 예'가 아니다 (현재: ${a.approved || '없음'})`);
  const targets = targetsOf(root, desc);
  for (const target of targets) {
    const tp = path.join(root, target);
    if (!fs.existsSync(tp)) {
      report.add('APR-02', target, '', '승인 대상 파일이 없다');
      continue;
    }
    const recorded = a.hashes.get(target) || (targets.length === 1 ? a.hashes.get('') : undefined);
    if (!recorded) {
      report.add('APR-02', desc.file, target, `승인 파일에 ${target}의 해시가 없다`);
    } else if (recorded !== sha256(fs.readFileSync(tp, 'utf8'))) {
      report.add('APR-02', target, '', '승인 후 문서가 바뀌었다 (해시 불일치). 다시 승인을 받아야 한다');
    }
  }
}

// _approval.md 를 쓴다. 기존 파일은 .bak 으로 보존한다.
function write(root, desc, { by, note = '', now = new Date() }) {
  const p = path.join(root, desc.file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p)) {
    fs.renameSync(p, p.replace(/\.md$/, `.${stampOf(now)}.bak.md`));
  }
  const targets = targetsOf(root, desc);
  const hashLines = targets.map((t) => {
    const h = sha256(fs.readFileSync(path.join(root, t), 'utf8'));
    return targets.length === 1 ? `대상 해시: sha256:${h}` : `대상 해시: ${t} sha256:${h}`;
  });
  const upstreamLines = (desc.upstream || [])
    .map((rel) => [rel, upstreamHash(root, rel)])
    .filter(([, h]) => h)
    .map(([rel, h]) => `상류 해시: ${rel} sha256:${h}`);
  const text = [
    `# 승인: ${desc.title}`,
    '',
    '승인: 예',
    `승인자: ${by}`,
    `승인일: ${dateOf(now)}`,
    `대상: ${targets.join(', ')}`,
    ...hashLines,
    ...upstreamLines,
    `비고: ${note || '없음'}`,
    '',
  ].join('\n');
  fs.writeFileSync(p, text, 'utf8');
  return p;
}

module.exports = { check, write, parse, upstreamChanges, stampOf, dateOf };
