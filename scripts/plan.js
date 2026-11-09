#!/usr/bin/env node
'use strict';
// 단계 계획 도구. 사용법은 아래 USAGE 참고.
const path = require('path');
const plan = require('./lib/plan');

const USAGE = [
  '사용법:',
  '  node scripts/plan.js check [<계획>] [--root <경로>]        계획 검증 (생략하면 전부)',
  '  node scripts/plan.js next <계획> [--json] [--root <경로>]   지금 실행할 노드',
  '  node scripts/plan.js confirm <계획> <체크포인트>            사용자가 확인했음을 기록',
  '  node scripts/plan.js done <계획> <노드>                     reconcile 노드의 완료를 기록',
  '  node scripts/plan.js reset <계획>                           진행 기록을 지움',
  '종료 코드: 0 정상 · 1 계획 문제 또는 실행 불가 · 2 사용법 오류',
].join('\n');

function parse(argv) {
  const o = { pos: [], root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') {
      if (i + 1 >= argv.length) throw new plan.PlanError('--root 에 값이 필요하다');
      o.root = path.resolve(argv[++i]);
    } else if (a === '--json') o.json = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a.startsWith('--')) throw new plan.PlanError(`알 수 없는 옵션 ${a}`);
    else o.pos.push(a);
  }
  return o;
}

function main() {
  const o = parse(process.argv.slice(2));
  const [cmd, name, arg] = o.pos;
  if (o.help || !cmd) { console.log(USAGE); process.exit(o.help ? 0 : 2); }

  if (cmd === 'check') {
    const names = name ? [name] : plan.listPlans(o.root);
    if (names.length === 0) { console.log('검사할 계획이 없다 (.claude/plans/*.md)'); process.exit(0); }
    let bad = 0;
    for (const n of names) {
      const problems = plan.check(o.root, n);
      if (problems.length === 0) console.log(`계획 ${n}: 문제 없음`);
      for (const p of problems) { bad++; console.log(`계획 ${n}${p.line ? `:${p.line}` : ''}  ${p.msg}`); }
    }
    process.exit(bad ? 1 : 0);
  }

  if (!name) throw new plan.PlanError('계획 이름이 필요하다');
  const problems = plan.check(o.root, name);
  if (problems.length && cmd !== 'reset') {
    for (const p of problems) console.log(`계획 ${name}${p.line ? `:${p.line}` : ''}  ${p.msg}`);
    console.log('계획에 문제가 있어 실행할 수 없다 (node scripts/plan.js check)');
    process.exit(1);
  }

  if (cmd === 'next') {
    const r = plan.next(o.root, name);
    console.log(o.json ? JSON.stringify(r, null, 2) : plan.render(r));
  } else if (cmd === 'confirm') {
    if (!arg) throw new plan.PlanError('체크포인트 이름이 필요하다');
    plan.confirm(o.root, name, arg);
    console.log(`확인 기록: ${name} / ${arg}`);
  } else if (cmd === 'done') {
    if (!arg) throw new plan.PlanError('노드 이름이 필요하다');
    plan.markDone(o.root, name, arg);
    console.log(`완료 기록: ${name} / ${arg}`);
  } else if (cmd === 'reset') {
    plan.reset(o.root, name);
    console.log(`진행 기록 삭제: ${name}`);
  } else {
    throw new plan.PlanError(`알 수 없는 명령 ${cmd}`);
  }
}

try {
  main();
} catch (e) {
  if (e instanceof plan.PlanError) {
    console.error(`오류: ${e.message}`);
    process.exit(e.message.startsWith('알 수 없는') || e.message.includes('필요하다') ? 2 : 1);
  }
  throw e;
}
