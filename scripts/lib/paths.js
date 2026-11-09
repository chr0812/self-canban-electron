'use strict';
// 산출물 경로의 단일 출처. 이름 규칙은 contracts/artifact-contract.md "경로와 이름".
// 폴더 번호는 작성 순서이고 고정이다 (선택 단계를 건너뛰어도 번호를 당기지 않는다).
// `_` 접두사는 하네스가 만드는 기록이다 (사람이 직접 고치지 않고, 구현 때 보지 않는다).

const DIR = {
  interview: 'docs/01-interview',
  research: 'docs/02-research',
  prd: 'docs/03-prd',
  spec: 'docs/04-spec',
  design: 'docs/05-design',
  build: 'docs/06-build',
  test: 'docs/07-test',
  gate: 'docs/_gate',
};

// 설계 문서: 개념 이름 → 파일 이름 (번호는 작성 순서. 읽는 순서는 README.md가 안내한다)
const DESIGN_FILE = {
  'tech-stack': '01-tech-stack.md',
  'data-model': '02-data-model.md',
  'api-spec': '03-api-spec.md',
  'ui-spec': '04-ui-spec.md',
  architecture: '05-architecture.md',
  'file-map': '06-file-map.md',
  'test-plan': '07-test-plan.md',
  tasks: '08-tasks.md',
  README: 'README.md',
};

const P = {
  DIR,
  DESIGN_FILE,
  guide: 'docs/README.md',
  interview: `${DIR.interview}/interview.md`,
  interviewLog: `${DIR.interview}/interview-log.md`,
  prd: `${DIR.prd}/prd.md`,
  spec: `${DIR.spec}/spec.md`,
  wireframes: `${DIR.design}/wireframes`,
  review: `${DIR.design}/_review`,
  variants: `${DIR.design}/_variants`,
  directions: `${DIR.design}/_variants/directions.md`,
  progress: `${DIR.gate}/progress.json`,
  waivers: `${DIR.gate}/waivers.md`,
  // 구현·시험 (앱 코드는 프로젝트 루트의 app/ 에 둔다. 명령 표의 명령은 app/ 에서 실행한다)
  app: 'app',
  buildLog: `${DIR.build}/build-log.md`,
  issues: `${DIR.build}/issues.md`,
  buildState: `${DIR.gate}/build.json`,
  buildLock: `${DIR.gate}/build.lock`,
  harnessState: `${DIR.gate}/harness.json`,
  interviewConfirm: `${DIR.interview}/_confirmation.md`,
  buildRuns: `${DIR.gate}/build`,
  testReport: `${DIR.test}/test-report.md`,
  testState: `${DIR.gate}/test.json`,
  evidence: `${DIR.test}/_evidence`,
  approval: (stage) => `${DIR[stage]}/_approval.md`,
  design: (name) => `${DIR.design}/${DESIGN_FILE[name]}`,
};

module.exports = P;
