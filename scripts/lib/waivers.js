'use strict';
const fs = require('fs');
const path = require('path');

const P = require('./paths');

const FILE = P.waivers;

// docs/_gate/waivers.md 를 읽는다. 형식:
//   ## YYYY-MM-DD <단계> <규칙 ID>
//   - 대상: ...
//   - 사유: ...
//   - 승인자: ...
// 사유나 승인자가 비어 있으면 무효이므로 목록에서 뺀다.
function load(root) {
  const p = path.join(root, FILE);
  if (!fs.existsSync(p)) return [];
  const waivers = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.reason && cur.approver) waivers.push(cur);
    cur = null;
  };
  for (const raw of fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
    let m;
    if ((m = /^##\s+(\d{4}-\d{2}-\d{2})\s+(\S+)\s+([A-Z]+-\d{2})\s*$/.exec(raw))) {
      flush();
      cur = { date: m[1], stage: m[2], rule: m[3], target: '', reason: '', approver: '' };
    } else if (cur && (m = /^-\s*대상\s*:\s*(.*)$/.exec(raw))) cur.target = m[1].trim();
    else if (cur && (m = /^-\s*사유\s*:\s*(.*)$/.exec(raw))) cur.reason = m[1].trim();
    else if (cur && (m = /^-\s*승인자\s*:\s*(.*)$/.exec(raw))) cur.approver = m[1].trim();
  }
  flush();
  return waivers;
}

// 같은 단계·규칙이고 대상이 위반의 대상(없으면 파일)을 포함하면 면제된다
function matches(waiver, stage, item) {
  if (waiver.stage !== stage || waiver.rule !== item.rule) return false;
  const key = item.target || item.file;
  return waiver.target.includes(key);
}

module.exports = { FILE, load, matches };
