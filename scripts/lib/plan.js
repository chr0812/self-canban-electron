'use strict';
// 단계 계획(.claude/plans/<이름>.md)을 읽고 검증하고, 지금 실행할 노드를 계산한다.
// 계획은 사람이 검토하는 마크다운 표이고, 체크포인트 기록은 기계 전용 JSON(docs/_gate/progress.json)이다.
const fs = require('fs');
const path = require('path');
const { Doc } = require('./markdown');
const { runGate } = require('./run');
const { STAGES } = require('./stages');
const P = require('./paths');

const PLAN_DIR = '.claude/plans';
const PROGRESS = P.progress;
const KINDS = ['role', 'reconcile', 'gate', 'review'];
const PROTOCOL = 'contracts/role-protocol.md';

class PlanError extends Error {}

const list = (cell) => (cell || '').split(',').map((s) => s.trim()).filter((s) => s && s !== '-');

// "키=값; 키=값" 형태의 옵션 칸
function options(cell) {
  const out = {};
  for (const part of (cell || '').split(';')) {
    const m = /^\s*([^=\s]+)\s*=\s*(.*?)\s*$/.exec(part);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// 게이트 노드의 skip 옵션 (쉼표로 구분한 규칙 접두사)
const skipOf = (n) => (n.options.skip || '').split(',').map((x) => x.trim()).filter(Boolean);

const colOf = (table, name) => table.headers.findIndex((h) => h.trim() === name);

function listPlans(root) {
  const dir = path.join(root, PLAN_DIR);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort() : [];
}

// 계획 파일을 읽는다. 검증은 check() 가 한다.
function load(root, name) {
  const rel = `${PLAN_DIR}/${name}.md`;
  const doc = Doc.load(root, rel);
  if (!doc) throw new PlanError(`계획 파일이 없다: ${rel}`);
  const table = doc.tables().find((t) => ['id', 'kind', 'after', 'outputs'].every((c) => colOf(t, c) >= 0));
  if (!table) throw new PlanError(`${rel}: id, kind, after, outputs 열을 가진 표가 없다`);
  const c = Object.fromEntries(['id', 'kind', 'role', 'after', 'outputs', 'checkpoint', '옵션'].map((n) => [n, colOf(table, n)]));
  const get = (row, n) => (c[n] >= 0 ? (row.cells[c[n]] || '').trim() : '');
  const nodes = table.rows.map((row) => ({
    id: get(row, 'id'),
    kind: get(row, 'kind'),
    role: get(row, 'role') === '-' ? '' : get(row, 'role'),
    after: list(get(row, 'after')),
    outputs: list(get(row, 'outputs')),
    checkpoint: get(row, 'checkpoint') === '-' ? '' : get(row, 'checkpoint'),
    options: options(get(row, '옵션')),
    line: row.line,
  }));
  return { name, file: rel, nodes, inputs: list((doc.meta()['입력'] || '').replace(/·/g, ',')) };
}

const overlaps = (a, b) => {
  const x = a.replace(/\/$/, '');
  const y = b.replace(/\/$/, '');
  return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`);
};

// 계획 검증. 문제 목록 [{ line, msg }] 을 돌려준다.
function check(root, name) {
  const problems = [];
  let plan;
  try {
    plan = load(root, name);
  } catch (e) {
    if (e instanceof PlanError) return [{ line: 0, msg: e.message }];
    throw e;
  }
  const add = (line, msg) => problems.push({ line, msg });
  const ids = new Map();
  const checkpoints = new Map();

  for (const n of plan.nodes) {
    if (!/^[a-z][a-z0-9_-]*$/.test(n.id)) add(n.line, `id '${n.id}'는 영문 소문자로 시작하는 소문자·숫자·-·_ 여야 한다`);
    if (ids.has(n.id)) add(n.line, `id '${n.id}'가 중복된다`);
    ids.set(n.id, n);
    if (!KINDS.includes(n.kind)) add(n.line, `${n.id}: kind '${n.kind}'는 ${KINDS.join(' / ')} 중 하나여야 한다`);
    if (n.checkpoint) {
      if (checkpoints.has(n.checkpoint)) add(n.line, `체크포인트 '${n.checkpoint}'가 중복된다`);
      checkpoints.set(n.checkpoint, n.id);
    }

    if (n.kind === 'role' || n.kind === 'review') {
      if (!n.role) add(n.line, `${n.id}: role 이 필요하다`);
      else {
        const agent = path.join(root, '.claude', 'agents', `${n.role}.md`);
        if (!fs.existsSync(agent)) add(n.line, `${n.id}: 역할 에이전트 파일이 없다 (.claude/agents/${n.role}.md)`);
        else if (!fs.readFileSync(agent, 'utf8').includes(PROTOCOL)) add(n.line, `${n.id}: 역할 ${n.role}가 공통 규약(${PROTOCOL})을 참조하지 않는다`);
      }
      if (n.outputs.length === 0) add(n.line, `${n.id}: outputs 가 필요하다`);
    }
    for (const o of n.outputs) {
      if (!o.startsWith('docs/') || o.includes('..')) add(n.line, `${n.id}: 출력 경로 '${o}'는 docs/ 아래의 상대경로여야 한다`);
    }
    if (n.kind === 'gate') {
      if (!n.options.stage) add(n.line, `${n.id}: 옵션 stage=<단계> 가 필요하다`);
      else if (!STAGES[n.options.stage]) add(n.line, `${n.id}: 알 수 없는 단계 '${n.options.stage}'`);
    }
    if (n.kind === 'review') {
      const ps = (n.options.perspectives || '').split('/').map((s) => s.trim()).filter(Boolean);
      if (ps.length === 0) add(n.line, `${n.id}: 옵션 perspectives=관점1/관점2 가 필요하다`);
      for (const p of ps) {
        const guide = `contracts/reviewers/${plan.name}-${p}.md`;
        if (!fs.existsSync(path.join(root, guide))) add(n.line, `${n.id}: 관점 '${p}'의 지침 파일이 없다 (${guide})`);
      }
      if (n.outputs.length !== 1 || !n.outputs[0].endsWith('/')) add(n.line, `${n.id}: review 의 outputs 는 디렉토리 하나(끝에 /)여야 한다`);
    }
    if (n.kind === 'reconcile' && n.options.maxRounds && !/^\d+$/.test(n.options.maxRounds)) {
      add(n.line, `${n.id}: maxRounds 는 정수여야 한다`);
    }
  }

  // after 참조와 순환
  for (const n of plan.nodes) {
    for (const a of n.after) if (!ids.has(a)) add(n.line, `${n.id}: after '${a}'가 계획에 없다`);
  }
  const reach = new Map(); // id -> 선행 노드 전체
  const visiting = new Set();
  let cyclic = false;
  const ancestors = (id) => {
    if (reach.has(id)) return reach.get(id);
    if (visiting.has(id)) { cyclic = true; return new Set(); }
    visiting.add(id);
    const set = new Set();
    for (const a of (ids.get(id) || { after: [] }).after) {
      if (!ids.has(a)) continue;
      set.add(a);
      for (const x of ancestors(a)) set.add(x);
    }
    visiting.delete(id);
    reach.set(id, set);
    return set;
  };
  for (const n of plan.nodes) ancestors(n.id);
  if (cyclic) add(0, '선행 관계(after)에 순환이 있다');

  // 출력 겹침: 서로 다른 노드가 같은 경로나 포함 관계의 경로를 쓰면 안 된다
  for (let i = 0; i < plan.nodes.length; i++) {
    for (let j = i + 1; j < plan.nodes.length; j++) {
      const a = plan.nodes[i];
      const b = plan.nodes[j];
      for (const x of a.outputs) {
        for (const y of b.outputs) {
          if (overlaps(x, y)) add(b.line, `${a.id}와 ${b.id}의 출력이 겹친다 (${x} ↔ ${y})`);
        }
      }
    }
  }
  return problems;
}

// ── 진행 기록 (기계 전용 JSON) ─────────────────────────────

function readProgress(root) {
  const p = path.join(root, PROGRESS);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { throw new PlanError(`${PROGRESS}를 읽을 수 없다 (JSON 형식 오류)`); }
}

function writeProgress(root, data) {
  const p = path.join(root, PROGRESS);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const entryOf = (progress, name) => {
  const e = progress[name] || {};
  return { confirmed: e.confirmed || [], completed: e.completed || [] };
};

// ── 노드 상태와 다음 실행 ──────────────────────────────

const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const nonEmptyDir = (root, rel) => {
  const p = path.join(root, rel);
  return fs.existsSync(p) && fs.statSync(p).isDirectory() && fs.readdirSync(p).length > 0;
};

function outputsExist(root, outputs) {
  return outputs.length > 0 && outputs.every((o) => (o.endsWith('/') ? nonEmptyDir(root, o) : exists(root, o)));
}

// 계획의 현재 상태를 계산한다 (파일 존재와 기록에서만 계산하므로 세션이 끊겨도 이어진다)
function state(root, name) {
  const plan = load(root, name);
  const prog = entryOf(readProgress(root), name);
  const byId = new Map(plan.nodes.map((n) => [n.id, n]));
  const status = new Map(); // id -> { produced, done }

  const evaluate = (n) => {
    if (status.has(n.id)) return status.get(n.id);
    const depsDone = n.after.every((a) => byId.has(a) && evaluate(byId.get(a)).done);
    let produced = false;
    if (n.kind === 'role') produced = outputsExist(root, n.outputs);
    else if (n.kind === 'review') {
      const dir = n.outputs[0] || '';
      const ps = (n.options.perspectives || '').split('/').map((s) => s.trim()).filter(Boolean);
      produced = ps.length > 0 && ps.every((p) => exists(root, `${dir}${p}.json`));
    } else if (n.kind === 'gate') {
      produced = depsDone && STAGES[n.options.stage] ? runGate({ root, stage: n.options.stage, log: false, skip: skipOf(n) }).exitCode === 0 : false;
    } else if (n.kind === 'reconcile') produced = prog.completed.includes(n.id);
    const confirmed = !n.checkpoint || prog.confirmed.includes(n.checkpoint);
    // 선행 노드가 끝나지 않았으면 산출물이 있어도 끝난 것이 아니다 (선행이 바뀌면 이 산출물이 낡았을 수 있다)
    const s = { produced, depsDone, done: produced && confirmed && depsDone, awaiting: produced && !confirmed };
    status.set(n.id, s);
    return s;
  };
  plan.nodes.forEach(evaluate);
  return { plan, status, progress: prog };
}

function next(root, name) {
  const { plan, status } = state(root, name);
  const runnable = [];
  const awaiting = [];
  const blocked = [];
  const complete = [];
  for (const n of plan.nodes) {
    const s = status.get(n.id);
    if (s.done) complete.push(n.id);
    else if (s.awaiting && s.depsDone) awaiting.push({ id: n.id, checkpoint: n.checkpoint, role: n.role, outputs: n.outputs });
    else if (!s.produced && s.depsDone) runnable.push({ id: n.id, kind: n.kind, role: n.role, outputs: n.outputs, checkpoint: n.checkpoint, options: n.options });
    else blocked.push({ id: n.id, waitingFor: n.after.filter((a) => !status.get(a).done) });
  }
  return { plan: name, complete, runnable, awaiting, blocked, finished: complete.length === plan.nodes.length };
}

function confirm(root, name, checkpoint) {
  const { plan, status } = state(root, name);
  const node = plan.nodes.find((n) => n.checkpoint === checkpoint);
  if (!node) throw new PlanError(`계획 '${name}'에 체크포인트 '${checkpoint}'가 없다`);
  const st = status.get(node.id);
  if (!st.produced) throw new PlanError(`체크포인트 '${checkpoint}'의 노드 '${node.id}'가 아직 완료되지 않았다`);
  if (!st.depsDone) throw new PlanError(`체크포인트 '${checkpoint}'의 노드 '${node.id}'는 선행 노드가 아직 끝나지 않았다. 선행 노드부터 끝낸다`);
  const progress = readProgress(root);
  const e = entryOf(progress, name);
  if (!e.confirmed.includes(checkpoint)) e.confirmed.push(checkpoint);
  progress[name] = e;
  writeProgress(root, progress);
  return e;
}

// 파일로 완료를 알 수 없는 노드(reconcile)의 완료를 기록한다
function markDone(root, name, nodeId) {
  const { plan, status } = state(root, name);
  const node = plan.nodes.find((n) => n.id === nodeId);
  if (!node) throw new PlanError(`계획 '${name}'에 노드 '${nodeId}'가 없다`);
  if (node.kind !== 'reconcile') throw new PlanError(`'${nodeId}'(${node.kind})의 완료는 산출물로 판정한다. 기록할 수 있는 노드는 reconcile 뿐이다`);
  if (!status.get(nodeId).depsDone) throw new PlanError(`'${nodeId}'의 선행 노드가 아직 끝나지 않았다`);
  const progress = readProgress(root);
  const e = entryOf(progress, name);
  if (!e.completed.includes(nodeId)) e.completed.push(nodeId);
  progress[name] = e;
  writeProgress(root, progress);
  return e;
}

function reset(root, name) {
  load(root, name);
  const progress = readProgress(root);
  delete progress[name];
  writeProgress(root, progress);
}

function render(result) {
  const lines = [`계획 ${result.plan}: 완료 ${result.complete.length}개${result.finished ? ' (모두 끝남)' : ''}`];
  if (result.runnable.length) {
    const par = result.runnable.length > 1 ? '  ← 동시에 호출 가능' : '';
    lines.push(`  실행 가능: ${result.runnable.map((n) => `${n.id}(${n.role || n.kind})`).join(', ')}${par}`);
  }
  if (result.awaiting.length) lines.push(`  사용자 확인 대기: ${result.awaiting.map((n) => `${n.id} → 체크포인트 ${n.checkpoint}`).join(', ')}`);
  if (!result.runnable.length && !result.awaiting.length && !result.finished) {
    lines.push(`  대기 중: ${result.blocked.map((n) => `${n.id}(${n.waitingFor.join(', ')} 필요)`).join(', ')}`);
  }
  return lines.join('\n');
}

module.exports = { PlanError, listPlans, load, check, state, next, confirm, markDone, reset, render, PLAN_DIR, PROGRESS };
