'use strict';
// 산출물 폴더 준비: docs/README.md(산출물 안내)를 템플릿에서 만든다. 있으면 두고 건드리지 않는다.
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const fp = require('./fingerprint');

const TEMPLATE = 'contracts/templates/docs-readme.md';

// 하네스 지문(docs/_gate/harness.json)도 없으면 기록한다 — 프로젝트 안에서 하네스 파일을 고치면 구현 게이트가 알아챈다.
function init({ root, now = new Date() }) {
  const harness = fp.recordHarness(root, now).created;
  const dest = path.join(root, P.guide);
  if (fs.existsSync(dest)) return { created: false, harness, file: P.guide };
  const src = path.join(root, TEMPLATE);
  if (!fs.existsSync(src)) throw new Error(`안내 템플릿이 없다: ${TEMPLATE}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return { created: true, harness, file: P.guide };
}

module.exports = { init, TEMPLATE };
