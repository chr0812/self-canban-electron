'use strict';
// 파일 묶음의 지문(해시). 앱 코드(시험 근거·검증 중 변경 감지)와 하네스 파일(프로젝트 안 패치 감지)에 쓴다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sha256 } = require('./markdown');
const P = require('./paths');

// 앱 지문에서 빼는 것: 의존성·빌드 결과·시험 결과물·캐시 (실행할 때마다 바뀌어 근거가 아니다)
const GENERATED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.dart_tool', '.gradle', 'target', 'vendor', '__pycache__', '.venv',
  'reports', 'test-results', 'playwright-report', 'blob-report', '.nyc_output', '.cache', '.pytest_cache', '.next', '.turbo',
]);

const fileHash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');

// dir 아래 파일들의 { 상대경로: 해시 }. skipDir(name) 이 참인 폴더, skipFile(relPath) 가 참인 파일은 뺀다.
function walk(root, dir, { skipDir = () => false, skipFile = () => false } = {}) {
  const out = {};
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) return out;
  if (fs.statSync(base).isFile()) { out[dir] = fileHash(base); return out; }
  const go = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!skipDir(e.name, rel(root, p))) go(p); }
      else if (e.isFile() && !skipFile(rel(root, p))) out[rel(root, p)] = fileHash(p);
    }
  };
  go(base);
  return out;
}

const digest = (files) => sha256(Object.keys(files).sort().map((k) => `${k} ${files[k]}`).join('\n'));

// 앱 코드 지문. extraSkip: 결과 파일 경로처럼 시험이 만드는 파일 (앱 루트 기준)
function appFiles(root, extraSkip = []) {
  const skip = new Set(extraSkip.map((x) => `${P.app}/${x.replace(/^\.\//, '')}`));
  return walk(root, P.app, {
    skipDir: (name) => GENERATED_DIRS.has(name),
    skipFile: (r) => skip.has(r) || /\.log$/.test(r),
  });
}
const app = (root, extraSkip = []) => digest(appFiles(root, extraSkip));

// 하네스 파일: 프로젝트에 복사된 규칙·역할·계획·오케스트레이터·스크립트 (하네스 자체 시험은 뺀다)
const HARNESS_ROOTS = ['scripts', '.claude/agents', '.claude/skills', '.claude/plans', '.claude/layers.json', 'contracts', 'CLAUDE.md'];
function harnessFiles(root) {
  const out = {};
  for (const r of HARNESS_ROOTS) Object.assign(out, walk(root, r, { skipDir: (name, relPath) => relPath === 'scripts/test' || name === 'node_modules' }));
  return out;
}

// 기록과 현재를 비교해 바뀐·생긴·없어진 파일 목록을 돌려준다
function diff(recorded, current) {
  const changed = [];
  for (const k of new Set([...Object.keys(recorded), ...Object.keys(current)])) {
    if (recorded[k] !== current[k]) changed.push(k);
  }
  return changed.sort();
}

// 하네스 지문 기록 (docs/_gate/harness.json). 없을 때만 만든다.
function recordHarness(root, now = new Date()) {
  const p = path.join(root, P.harnessState);
  if (fs.existsSync(p)) return { created: false };
  const files = harnessFiles(root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify({ at: now.toISOString(), hash: digest(files), files }, null, 2)}\n`, 'utf8');
  return { created: true };
}

function readHarness(root) {
  const p = path.join(root, P.harnessState);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

module.exports = { GENERATED_DIRS, walk, digest, appFiles, app, harnessFiles, diff, recordHarness, readHarness };
