#!/usr/bin/env node
'use strict';
// 단계 게이트. 사용법은 아래 USAGE 참고.
const path = require('path');
const { runGate, approve, confirm, renderConsole, UsageError } = require('./lib/run');
const { STAGES, PLANNED } = require('./lib/stages');
const { status, render: renderStatus } = require('./lib/status');
const { init } = require('./lib/init');

const USAGE = [
  '사용법:',
  '  node scripts/gate.js init [--root <경로>]            산출물 안내(docs/README.md)와 하네스 지문 기록을 만든다',
  '  node scripts/gate.js confirm interview --by <확정자> [--note <메모>]   사용자가 인터뷰를 확정한 기록',
  '  node scripts/gate.js status [--root <경로>] [--json]',
  '  node scripts/gate.js <단계> [--approved] [--skip <규칙 접두사>] [--root <경로>] [--json] [--no-log]',
  '  node scripts/gate.js approve <단계> --by <승인자> [--note <메모>] [--root <경로>]',
  '',
  `단계: ${Object.keys(STAGES).join(', ')} (예정: ${PLANNED.join(', ')})`,
  '종료 코드: 0 통과 · 1 규칙 위반 · 2 사용법 오류',
].join('\n');

function parse(argv) {
  const opts = { positional: [], root: process.cwd(), approved: false, json: false, log: true, skip: [], by: null, note: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${a} 에 값이 필요하다`);
      return argv[++i];
    };
    if (a === '--root') opts.root = path.resolve(val());
    else if (a === '--by') opts.by = val();
    else if (a === '--skip') opts.skip.push(...val().split(',').map((x) => x.trim()).filter(Boolean));
    else if (a === '--note') opts.note = val();
    else if (a === '--approved') opts.approved = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--no-log') opts.log = false;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--')) throw new UsageError(`알 수 없는 옵션 ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

function main() {
  const opts = parse(process.argv.slice(2));
  if (opts.help || opts.positional.length === 0) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }

  if (opts.positional[0] === 'init') {
    const r = init({ root: opts.root });
    console.log(r.created ? `산출물 안내를 만들었다: ${r.file}` : `산출물 안내가 이미 있다: ${r.file}`);
    if (r.harness) console.log('하네스 지문을 기록했다: docs/_gate/harness.json');
    process.exit(0);
  }

  if (opts.positional[0] === 'status') {
    const st = status({ root: opts.root });
    console.log(opts.json ? JSON.stringify(st, null, 2) : renderStatus(st));
    process.exit(0);
  }

  if (opts.positional[0] === 'confirm') {
    const res = confirm({ root: opts.root, stage: opts.positional[1], by: opts.by, note: opts.note });
    if (opts.json) console.log(JSON.stringify(res, null, 2));
    else {
      console.log(renderConsole(res.result));
      console.log(res.ok ? `확정 기록: ${res.confirmationPath}` : '내용 검사를 통과하지 못해 확정 기록을 남기지 않았다');
    }
    process.exit(res.ok ? 0 : 1);
  }

  if (opts.positional[0] === 'approve') {
    const stage = opts.positional[1];
    if (!stage) throw new UsageError('승인할 단계를 지정한다');
    const res = approve({ root: opts.root, stage, by: opts.by, note: opts.note });
    if (opts.json) console.log(JSON.stringify(res, null, 2));
    else {
      console.log(renderConsole(res.result));
      console.log(res.ok ? `승인 기록: ${res.approvalPath}` : '내용 검사를 통과하지 못해 승인 파일을 만들지 않았다');
    }
    process.exit(res.ok ? 0 : 1);
  }

  const result = runGate({ root: opts.root, stage: opts.positional[0], approved: opts.approved, log: opts.log, skip: opts.skip });
  console.log(opts.json ? JSON.stringify(result, null, 2) : renderConsole(result));
  process.exit(result.exitCode);
}

try {
  main();
} catch (e) {
  if (e instanceof UsageError) {
    console.error(`사용법 오류: ${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  throw e;
}
