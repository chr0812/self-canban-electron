'use strict';
const fs = require('fs');
const path = require('path');
const { Report } = require('./report');
const { RULES } = require('./rules');
const { STAGES, PLANNED } = require('./stages');
const approvalLib = require('./approval');
const waiverLib = require('./waivers');
const P = require('./paths');

class UsageError extends Error {}

function resolveStage(stage) {
  if (STAGES[stage]) return STAGES[stage];
  if (PLANNED.includes(stage)) throw new UsageError(`'${stage}' 단계는 아직 구현되지 않았다 (구현된 단계: ${Object.keys(STAGES).join(', ')})`);
  throw new UsageError(`알 수 없는 단계 '${stage}' (구현된 단계: ${Object.keys(STAGES).join(', ')})`);
}

// 단계 게이트를 실행한다.
//   approved: 이 단계를 나가는 조건(승인 파일)까지 검사한다
//   log     : docs/_gate/ 에 로그를 남긴다
//   skip    : 이 접두사로 시작하는 규칙은 검사하지 않는다 (예: ['REV'] — 리뷰 전의 구조 검사)
function runGate({ root, stage, approved = false, log = true, skip = [], now = new Date() }) {
  const def = resolveStage(stage);
  const report = new Report();
  def.run(root, report);
  if (skip.length) {
    const skipped = (id) => skip.some((x) => id.startsWith(x));
    report.items = report.items.filter((i) => !skipped(i.rule));
    report.ran = new Set([...report.ran].filter((id) => !skipped(id)));
  }
  const mode = approved && def.approval ? '승인 포함' : '내용 검사';
  if (approved && def.approval) approvalLib.check(root, def.approval, report);

  const waivers = waiverLib.load(root);
  const errors = [];
  const warnings = [];
  const waived = [];
  for (const item of report.items) {
    if (item.level === 'warn') warnings.push(item);
    else {
      const w = waivers.find((x) => waiverLib.matches(x, stage, item));
      if (w) waived.push({ ...item, waiver: w });
      else errors.push(item);
    }
  }
  const exitCode = errors.length ? 1 : 0;
  const result = { stage, mode, exitCode, errors, warnings, waived, ran: [...report.ran].sort(), logPath: null };
  if (approved && !def.approval) result.note = `'${stage}' 단계는 승인 대상이 아니다 (--approved 무시)`;
  if (log) result.logPath = writeLog(root, result, now);
  return result;
}

// 사용자가 승인했다는 전제에서만 호출한다. 내용 검사가 통과해야 승인 파일을 만든다.
function approve({ root, stage, by, note = '', now = new Date() }) {
  const def = resolveStage(stage);
  if (!def.approval) throw new UsageError(`'${stage}' 단계는 승인 대상이 아니다`);
  if (!by) throw new UsageError('--by <승인자> 가 필요하다');
  const result = runGate({ root, stage, approved: false, log: true, now });
  if (result.exitCode !== 0) return { ok: false, result };
  const file = approvalLib.write(root, def.approval, { by, note, now });
  return { ok: true, result, approvalPath: path.relative(root, file).split(path.sep).join('/') };
}

// 사용자가 인터뷰를 확정(또는 가져온 정리본의 재사용을 승인)한 직후에만 호출한다.
// 정리본 상태가 '확정'이고 확정 기록 외의 내용 검사가 통과해야 기록을 남긴다.
function confirm({ root, stage, by, note = '', now = new Date() }) {
  if (stage !== 'interview') throw new UsageError(`확정 기록은 인터뷰만 남긴다 (받은 값: ${stage || '없음'})`);
  if (!by) throw new UsageError('--by <확정자> 가 필요하다');
  const { confirmation } = require('./stages/interview');
  const result = runGate({ root, stage, approved: false, log: true, now });
  const blocking = result.errors.filter((e) => e.rule !== 'VAL-17');
  if (blocking.length) return { ok: false, result: { ...result, errors: blocking, exitCode: 1 } };
  const file = approvalLib.write(root, confirmation, { by, note, now });
  return { ok: true, result, confirmationPath: path.relative(root, file).split(path.sep).join('/') };
}

function line(item) {
  const where = item.target ? `${item.file} ${item.target}` : item.file;
  return `${item.rule} ${where}: ${item.message}`;
}

function writeLog(root, result, now) {
  const dir = path.join(root, P.DIR.gate);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = approvalLib.stampOf(now);
  const p = path.join(dir, `${result.stage}-${stamp}.md`);
  const hh = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const byRule = (arr) => arr.filter(Boolean).length;
  const rows = result.ran.map((id) => {
    const e = result.errors.filter((x) => x.rule === id).length;
    const w = result.warnings.filter((x) => x.rule === id).length;
    const v = result.waived.filter((x) => x.rule === id).length;
    const status = e ? '실패' : v ? '면제' : w ? '경고' : '통과';
    return `| ${id} | ${RULES[id].level === 'warn' ? '경고' : '오류'} | ${status} | ${e + w + v} | ${RULES[id].title} |`;
  });
  const text = [
    `# 게이트 로그: ${result.stage}`,
    '',
    `- 실행: ${approvalLib.dateOf(now)} ${hh}`,
    `- 모드: ${result.mode}`,
    `- 종료 코드: ${result.exitCode}`,
    `- 결과: 오류 ${byRule(result.errors)} · 경고 ${byRule(result.warnings)} · 면제 ${byRule(result.waived)}`,
    '',
    '## 규칙별 결과',
    '',
    '| 규칙 | 수준 | 결과 | 건수 | 내용 |',
    '|------|------|------|------|------|',
    ...rows,
    '',
    '## 위반',
    '',
    ...(result.errors.length ? result.errors.map((i) => `- [오류] ${line(i)}`) : ['- 오류 없음']),
    ...result.warnings.map((i) => `- [경고] ${line(i)}`),
    ...result.waived.map((i) => `- [면제] ${line(i)} (사유: ${i.waiver.reason}, 승인자: ${i.waiver.approver})`),
    '',
  ].join('\n');
  fs.writeFileSync(p, text, 'utf8');
  return path.relative(root, p).split(path.sep).join('/');
}

function renderConsole(result) {
  const out = [`게이트: ${result.stage} (${result.mode})`];
  if (result.note) out.push(`  참고: ${result.note}`);
  for (const i of result.errors) out.push(`  [오류] ${line(i)}`);
  for (const i of result.warnings) out.push(`  [경고] ${line(i)}`);
  for (const i of result.waived) out.push(`  [면제] ${line(i)}`);
  out.push(`결과: 오류 ${result.errors.length} · 경고 ${result.warnings.length} · 면제 ${result.waived.length} → 종료 코드 ${result.exitCode}`);
  if (result.logPath) out.push(`로그: ${result.logPath}`);
  if (result.exitCode === 0 && result.mode === '내용 검사') out.push('다음: node scripts/gate.js status 로 다음 할 일을 확인한다');
  return out.join('\n');
}

module.exports = { runGate, approve, confirm, renderConsole, UsageError };
