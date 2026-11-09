#!/usr/bin/env node
'use strict';
// 스킬·에이전트 점검. 참조 경로가 실제로 있는지, 전역 스킬과 이름이 겹치지 않는지 본다.
//   node scripts/lint-skills.js [--root <경로>]
// 종료 코드: 0 문제 없음 · 1 문제 있음
const fs = require('fs');
const os = require('os');
const path = require('path');
const { listPlans, check: checkPlan } = require('./lib/plan');

// 하네스가 소유한 경로 접두사 (존재해야 한다)
const OWNED = ['.claude/', 'contracts/', 'scripts/'];
// 실행 중에 생기는 산출물 경로 (존재를 검사하지 않는다)
const RUNTIME = ['docs/'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function frontmatterName(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n?/g, '\n'));
  if (!m) return null;
  const n = /^name:\s*(.+)$/m.exec(m[1]);
  return n ? n[1].trim() : null;
}

function lint({ root, globalSkillsDir = path.join(os.homedir(), '.claude', 'skills') }) {
  const problems = [];
  const add = (file, line, msg) => problems.push({ file: path.relative(root, file).split(path.sep).join('/'), line, msg });

  const skillsDir = path.join(root, '.claude', 'skills');
  const agentsDir = path.join(root, '.claude', 'agents');

  // 1) 이름: frontmatter name == 폴더/파일 이름, 전역 스킬과 겹치지 않음
  const globalNames = fs.existsSync(globalSkillsDir) ? new Set(fs.readdirSync(globalSkillsDir)) : new Set();
  if (fs.existsSync(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const skillFile = path.join(skillsDir, d.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) { add(path.join(skillsDir, d.name), 0, 'SKILL.md 가 없다'); continue; }
      const name = frontmatterName(fs.readFileSync(skillFile, 'utf8'));
      if (name !== d.name) add(skillFile, 1, `frontmatter name '${name}' 이 폴더 이름 '${d.name}' 과 다르다`);
      if (globalNames.has(d.name)) add(skillFile, 1, `전역 스킬 '${d.name}' 과 이름이 겹친다. 전역이 우선해 이 프로젝트 사본이 가려질 수 있다`);
    }
  }
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      if (!f.endsWith('.md')) continue;
      const file = path.join(agentsDir, f);
      const name = frontmatterName(fs.readFileSync(file, 'utf8'));
      if (name !== f.replace(/\.md$/, '')) add(file, 1, `frontmatter name '${name}' 이 파일 이름 '${f}' 과 다르다`);
    }
  }

  // 2) 경로 참조
  const files = [...walk(skillsDir), ...walk(agentsDir)];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n');
    let fenced = false;
    lines.forEach((line, i) => {
      const n = i + 1;
      // Read(<경로>) 호출 표기
      for (const m of line.matchAll(/Read\(([^)\s]+)/g)) checkPath(file, n, m[1], true);
      // 백틱으로 감싼 하네스 경로
      for (const m of line.matchAll(/`((?:\.claude|contracts|scripts)\/[^`\s]+)`/g)) checkPath(file, n, m[1], false);
    });
    void fenced;
  }

  function checkPath(file, n, raw, isRead) {
    const p = raw.replace(/[,;:]+$/, '');
    if (/^(~|[A-Za-z]:|\/)/.test(p)) { add(file, n, `프로젝트 밖 경로를 읽는다: ${p}`); return; }
    if (RUNTIME.some((r) => p.startsWith(r))) return;
    if (!OWNED.some((o) => p.startsWith(o))) {
      // 스킬 내부 참조 폴더를 기준 없이 쓴 경우만 문제로 본다 (실행 중 산출물 표기는 제외)
      if (isRead && /^(references|templates|agents)\//.test(p)) {
        add(file, n, `기준 없는 상대경로 '${p}' — 프로젝트 루트 기준 경로(.claude/skills/<스킬>/...)로 쓴다`);
      }
      return;
    }
    if (/[{}*]/.test(p)) return; // 자리표시자·글롭은 존재 검사 생략
    if (!fs.existsSync(path.join(root, p))) add(file, n, `존재하지 않는 경로: ${p}`);
  }

  checkLayers();
  return problems;

  // 레이어 점검: Agent·Skill·Task 호출은 오케스트레이터(허브)만 한다.
  // 아직 정리되지 않은 곳은 .claude/layers.json 의 예외 목록에 사유와 정리 시점을 적어 둔다.
  function checkLayers() {
    const layersFile = path.join(root, '.claude', 'layers.json');
    let layers = { orchestrators: [], exceptions: [] };
    if (fs.existsSync(layersFile)) {
      try {
        layers = { ...layers, ...JSON.parse(fs.readFileSync(layersFile, 'utf8')) };
      } catch {
        add(layersFile, 1, 'layers.json 의 JSON 형식이 잘못됐다');
        return;
      }
    }
    const rel = (f) => path.relative(root, f).split(path.sep).join('/');
    const orchestrators = new Set(layers.orchestrators || []);
    for (const o of orchestrators) {
      if (!fs.existsSync(path.join(skillsDir, o, 'SKILL.md'))) add(layersFile, 0, `오케스트레이터 스킬 '${o}'가 없다`);
    }
    const exceptions = new Map((layers.exceptions || []).map((e) => [e.path, e]));
    for (const [p, e] of exceptions) {
      if (!e.reason || !e.until) add(layersFile, 0, `예외 ${p}에 reason 과 until 이 모두 필요하다`);
    }

    const CALL = /\b(?:Agent|Skill|Task)\(|subagent_type/;
    const targets = [
      ...walk(agentsDir),
      ...walk(skillsDir).filter((f) => !orchestrators.has(rel(f).split('/')[2])),
    ];
    const used = new Set();
    for (const file of targets) {
      const lines = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n');
      const at = lines.findIndex((l) => CALL.test(l));
      if (at < 0) continue;
      if (exceptions.has(rel(file))) { used.add(rel(file)); continue; }
      const where = file.startsWith(agentsDir) ? '역할 에이전트' : '오케스트레이터가 아닌 스킬';
      add(file, at + 1, `${where}가 Agent·Skill·Task 를 호출한다. 호출은 오케스트레이터(${[...orchestrators].join(', ') || '허브'})만 한다`);
    }
    for (const [p] of exceptions) {
      if (!fs.existsSync(path.join(root, p))) add(layersFile, 0, `예외 대상 파일이 없다: ${p}`);
      else if (!used.has(p)) add(layersFile, 0, `예외 ${p}는 더 이상 필요 없다 (호출 표기가 없다). 목록에서 지운다`);
    }

    // 단계 계획 검증
    for (const name of listPlans(root)) {
      for (const pr of checkPlan(root, name)) add(path.join(root, '.claude', 'plans', `${name}.md`), pr.line, pr.msg);
    }
  }
}

module.exports = { lint };

if (require.main === module) {
  const i = process.argv.indexOf('--root');
  const root = i >= 0 ? path.resolve(process.argv[i + 1]) : process.cwd();
  const problems = lint({ root });
  for (const p of problems) console.log(`${p.file}${p.line ? ':' + p.line : ''}  ${p.msg}`);
  console.log(problems.length ? `\n스킬 점검: ${problems.length}건` : '스킬 점검: 문제 없음');
  process.exit(problems.length ? 1 : 0);
}
