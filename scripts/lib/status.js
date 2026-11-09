'use strict';
// 파이프라인 진행 상태. 산출물·게이트·승인 파일에서 계산하므로 별도 상태 파일이 없다.
const fs = require('fs');
const path = require('path');
const { runGate } = require('./run');
const { STAGES } = require('./stages');
const approvalLib = require('./approval');
const P = require('./paths');

const { PROGRESS_RULES } = require('./stages/build');

const ORDER = ['interview', 'prd', 'spec', 'design', 'build', 'test'];
// 기획 허브(discover-to-design)가 맡는 단계. 그 뒤는 구현 허브(design-to-build)
const PLANNING = new Set(['interview', 'prd', 'spec', 'design']);
const MAIN_FILE = {
  interview: P.interview,
  prd: P.prd,
  spec: P.spec,
  design: P.design('tasks'),
  build: P.buildLog,
  test: P.testReport,
};
// 승인이 의존하는 상류 파일. 이 파일이 승인 파일보다 나중에 바뀌었으면 승인이 낡았을 수 있다.
const UPSTREAM_FILE = {
  prd: MAIN_FILE.interview,
  spec: P.approval('prd'),
  design: P.approval('spec'),
};
const TOLERANCE_MS = 2000;
// 인터뷰에서 이 규칙들만 어긋났으면 오류가 아니라 '확정 전'이다 (VAL-10 확정 아님, VAL-12 확정 뒤 보강)
const CONFIRM_RULES = new Set(['VAL-10', 'VAL-12', 'VAL-17']);
const inProgress = (s) => s.stage === 'build' && s.content.rules.every((r) => PROGRESS_RULES.has(r));

const mtime = (root, rel) => {
  try { return fs.statSync(path.join(root, rel)).mtimeMs; } catch { return null; }
};

function stageStatus(root, name) {
  const def = STAGES[name];
  const exists = fs.existsSync(path.join(root, MAIN_FILE[name]));
  const s = {
    stage: name, label: def.label, file: MAIN_FILE[name], exists,
    content: null, approval: def.approval ? 'none' : 'n/a',
    approvedBy: null, approvedDate: null, stale: false, staleBy: [], blockedBy: null,
  };
  if (!exists) return s;

  const content = runGate({ root, stage: name, log: false });
  s.content = {
    errors: content.errors.length,
    warnings: content.warnings.length,
    rules: [...new Set(content.errors.map((e) => e.rule))],
    first: content.errors.slice(0, 3).map((e) => `${e.rule} ${e.target || e.file}: ${e.message}`),
  };

  if (def.approval && fs.existsSync(path.join(root, def.approval.file))) {
    const a = approvalLib.parse(fs.readFileSync(path.join(root, def.approval.file), 'utf8'));
    const all = runGate({ root, stage: name, approved: true, log: false }).errors.filter((e) => e.rule.startsWith('APR'));
    const apr = all.filter((e) => e.rule !== 'APR-03');
    s.approvedBy = a.by;
    s.approvedDate = a.date;
    s.approval = apr.length === 0 ? 'valid' : apr.some((e) => e.rule === 'APR-02') ? 'invalid' : 'none';
    if (s.approval === 'valid') {
      // 승인 때 상류 해시를 기록했다면 그것으로, 기록이 없는 옛 승인은 수정 시각으로 판단한다
      const changed = approvalLib.upstreamChanges(root, a);
      if (changed) {
        if (changed.length) { s.stale = true; s.staleBy = changed; }
      } else {
        const up = UPSTREAM_FILE[name] ? mtime(root, UPSTREAM_FILE[name]) : null;
        const own = mtime(root, def.approval.file);
        if (up !== null && own !== null && up > own + TOLERANCE_MS) { s.stale = true; s.staleBy = [UPSTREAM_FILE[name]]; }
      }
    }
  }
  return s;
}

// 처음으로 막힌 단계를 찾아 다음 할 일을 정한다
function nextAction(stages) {
  for (const s of stages) {
    if (!s.exists) {
      if (s.stage === 'interview') return { action: 'start_interview', stage: s.stage, message: '인터뷰를 시작한다.' };
      if (s.stage === 'build') return { action: 'start_build', stage: s.stage, message: '설계 승인까지 끝났다. 사용자가 원하면 구현을 시작한다 (/design-to-build).' };
      if (s.stage === 'test') return { action: 'start_test', stage: s.stage, message: '구현이 끝났다. 시험을 시작한다 (/design-to-build).' };
      return { action: `write_${s.stage}`, stage: s.stage, message: `${s.label} 산출물을 작성한다.` };
    }
    if (s.content.errors > 0) {
      if (inProgress(s)) return { action: 'continue_build', stage: s.stage, message: `구현을 이어 간다 (검증 안 된 Task ${s.content.errors}개).` };
      if (s.stage === 'interview' && s.content.rules.every((r) => CONFIRM_RULES.has(r))) {
        const rules = s.content.rules;
        const message = rules.includes('VAL-12')
          ? '확정 뒤에 인터뷰 내용이 바뀌었다. 바뀐 내용을 보여 주고 다시 확정을 받는다.'
          : rules.includes('VAL-10')
            ? '인터뷰가 아직 확정되지 않았다. 인터뷰를 이어서 확정한다.'
            : '이 프로젝트에서 확정한 기록이 없거나 확정 뒤 정리본이 바뀌었다. 정리본(가져온 것이면 출처)을 보여 주고 확정을 받아 기록한다.';
        return { action: 'confirm_interview', stage: s.stage, message };
      }
      return { action: 'fix', stage: s.stage, message: `${s.label}의 내용 검사 오류 ${s.content.errors}건을 고친다.` };
    }
    if (s.approval === 'none') return { action: 'request_approval', stage: s.stage, message: `${s.label} 승인을 요청한다.` };
    if (s.approval === 'invalid') return { action: 'reapprove', stage: s.stage, message: `${s.label}가 승인 뒤에 바뀌었다. 변경을 확인하고 다시 승인받는다.` };
    if (s.stale) return { action: 'recheck_stale', stage: s.stage, message: `${s.label}의 상류 문서(${s.staleBy.join(', ')})가 승인 뒤에 바뀌었다. 영향을 재검토하고 다시 승인받는다.` };
  }
  return { action: 'done', stage: null, message: '인수 승인까지 끝났다.' };
}

function status({ root }) {
  const stages = ORDER.map((n) => stageStatus(root, n));
  const next = nextAction(stages);
  // 막힌 단계 뒤에 있는 승인은 상류가 해소될 때까지 믿을 수 없다
  const firstOpen = stages.findIndex((s) => s.stage === next.stage);
  if (firstOpen >= 0) {
    stages.forEach((s, i) => {
      if (i > firstOpen && s.exists) s.blockedBy = stages[firstOpen].stage;
    });
  }
  return { root, stages, next };
}

function describe(s) {
  if (!s.exists) return '아직 없음';
  if (s.content.errors > 0) {
    if (s.stage === 'interview' && s.content.rules.every((r) => CONFIRM_RULES.has(r))) return '진행 중 (확정 전)';
    if (inProgress(s)) return `진행 중 (검증 안 된 Task ${s.content.errors}개)`;
    return `수정 필요 (오류 ${s.content.errors}건)`;
  }
  if (s.approval === 'n/a') return '완료 (확정)';
  if (s.approval === 'none') return '승인 대기';
  if (s.approval === 'invalid') return '승인 무효 (승인 뒤 문서가 바뀜)';
  const who = [s.approvedBy, s.approvedDate].filter(Boolean).join(', ');
  return `승인됨${who ? ` (${who})` : ''}${s.stale ? ` · 상류 변경 감지(${s.staleBy.join(', ')}), 재검토 필요` : ''}`;
}

function render(result) {
  const lines = ['파이프라인 상태'];
  for (const s of result.stages) {
    const blocked = s.blockedBy ? `  ※ 상류(${result.stages.find((x) => x.stage === s.blockedBy).label}) 미해결, 재검토 필요` : '';
    lines.push(`  ${s.label} (${s.file}): ${describe(s)}${blocked}`);
    if (s.exists && s.content.errors > 0) for (const f of s.content.first) lines.push(`      - ${f}`);
  }
  lines.push(`다음 할 일: ${result.next.message}`);
  return lines.join('\n');
}

module.exports = { status, render, ORDER, MAIN_FILE, PLANNING };
