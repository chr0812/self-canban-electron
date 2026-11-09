# 하네스 프로젝트 규칙

기획~설계(`/discover-to-design`)와 구현~인수(`/design-to-build`) 하네스를 쓰는 프로젝트의 공통 규칙이다.
하네스 자체를 개발할 때는 아래 "파이프라인 실행 규칙" 중 구현 금지는 적용하지 않는다 (코드를 쓰는 것이 일이다).

## 파이프라인 실행 규칙

- 항상 **프로젝트 루트**에서 Claude Code를 실행한다. 스킬이 `.claude/skills/...` 상대경로를 읽는다.
- 기획은 `/discover-to-design`, 구현·시험은 `/design-to-build`로 시작하고 이어간다. 진행 상태는 `node scripts/gate.js status`.
- 기획 허브의 범위는 **설계 승인까지**다. 기획 중에는 구현(코드 작성)을 하지 않는다. 구현은 설계 승인 뒤 사용자가 원할 때 `/design-to-build`가 한다.
- 구현 중 코드는 `app/`에만 쓰고, 완료는 `node scripts/build.js verify`만 기록한다. 승인된 설계·명세는 사용자 결정 없이 고치지 않는다.
- 구현 진행은 `build.js start/handoff/pause`로 기록한다. 함께 개발은 의존 관계가 없고 파일이 겹치지 않을 때만, 검증은 한 번에 하나씩 한다.
- 구현 중 보고(`issues.md`)는 `build.js issue add|set`으로만 고친다. 프로젝트 안에서 하네스 파일을 고치면 `하네스 결함`(임시 패치)으로 보고한다.
- 사용자가 말하지 않은 것을 사실이나 요구사항으로 확정하지 않는다. 모르면 열린 질문으로 남긴다.
- 사용자 대신 승인하지 않는다.

## 산출물 규칙

- 형식·ID·태그·우선순위는 `contracts/artifact-contract.md`, 용어는 `contracts/glossary.md`가 정한다. 충돌하면 계약이 우선한다.
- 경로는 고정이다: `docs/01-interview`, `docs/02-research`, `docs/03-prd`, `docs/04-spec`, `docs/05-design`, `docs/_gate`. 이름 규칙은 계약의 "경로와 이름", 스크립트 경로는 `scripts/lib/paths.js` 한 곳이다.
- 파일 이름은 영문으로 쓴다. 한글 이름은 문서 첫 줄 제목과 `docs/README.md`(산출물 안내)에 둔다.
- `_`로 시작하는 파일·폴더(`_approval.md`, `_review/`, `_gate/`)는 하네스가 만드는 기록이다.
- `_approval.md`는 손으로 쓰지 않는다. 사용자가 승인한 뒤 `node scripts/gate.js approve <단계> --by <이름>`으로만 만든다.
- 리뷰 지적은 유형(불일치·구현·요구·정책·선호)이 처리 권한을 정한다. 합의 수가 아니다. 규칙과 기록 형식은 `contracts/review-handling.md`.
- 인터뷰를 확정한 뒤 보강하면 상태를 초안으로 되돌리고 다시 확정받는다 (`> 확정 라운드`, 게이트 `VAL-12`). 확정은 `node scripts/gate.js confirm interview --by <이름>`으로 기록한다 (`VAL-17`, 가져온 정리본도 재사용 확인 후 기록).
- 게이트를 피하려고 형식을 바꾸지 않는다 (ID 를 코드 블록에 숨기기 등). 삭제한 ID 는 `## 변경 이력`의 `삭제 ID` 열에 적는다.
- "다 됐다"의 기준은 명세의 인수 기준(`AC`)이고, 설계의 시험 계획(`TC`)과 Task의 `check:`로 이어진다. `08-tasks.md`의 체크박스는 설계 승인 대상이라 구현 중에도 바꾸지 않는다.
- 승인된 문서를 고치면 승인이 무효가 된다. 고치기 전에 사용자에게 알리고, 고친 뒤 재승인하고, 하류 단계를 재검토한다.
- 승인 상태·진행 상태를 해시 대상 문서 안에 적지 않는다.

## 검사 명령

| 명령 | 용도 |
|------|------|
| `node scripts/gate.js init` | 산출물 안내(`docs/README.md`)를 만든다 (있으면 그대로) |
| `node scripts/gate.js status` | 현재 진행 상태와 다음 할 일 |
| `node scripts/gate.js <interview\|prd\|spec\|design>` | 단계 내용 검사 |
| `node scripts/gate.js <단계> --approved` | 승인 포함 검사 |
| `node scripts/gate.js <단계> --skip <접두사>` | 규칙 묶음 제외 검사 (예: `--skip REV` = 리뷰 전 구조 검사) |
| `node scripts/plan.js next <계획>` | 단계 계획에서 지금 실행할 노드 (`check`로 계획 검증) |
| `node scripts/build.js status\|next\|brief\|start\|handoff\|pause\|verify\|test-run\|issue` | 구현 진행, 지금 할 일, Task 지시서, 개발 진행 기록, 명령 실행 검증, 시험 실행, 구현 중 보고 |
| `node scripts/gate.js confirm interview --by <이름>` | 사용자가 인터뷰를 확정한 기록 |
| `npm run lint` | 경로 참조, 이름 충돌, **층 규칙**(역할의 호출 금지), 계획 검증 |
| `npm test` | 하네스 자체 테스트 |

## 스킬 이름

프로젝트 스킬은 전역(`~/.claude/skills`) 스킬과 이름이 같으면 전역이 실행된다. 새 스킬은 전역과 겹치지 않는 이름을 쓴다 (`npm run lint`가 잡는다).

## 층 규칙

- `Agent`·`Skill`을 호출하는 것은 오케스트레이터(허브)뿐이다. 역할 에이전트(`.claude/agents/`)와 대화형 스킬은 호출하지 않는다. 역할은 사용자에게 질문하지 않고 `결정 필요`로 돌려준다 (`contracts/role-protocol.md`).
- 사람이 검토하는 문서는 마크다운, 기계만 읽고 쓰는 기록은 JSON이다.
- 아직 정리되지 않은 예외는 `.claude/layers.json`에 사유와 정리 시점을 적는다.
