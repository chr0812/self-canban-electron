# 단계 계획: design

> 입력: docs/04-spec/spec.md
> 순서·병렬·체크포인트만 선언한다. 절차는 적지 않는다. 변경은 하네스 저장소에서 검토를 거친다.

| id | kind | role | after | outputs | checkpoint | 옵션 |
|----|------|------|-------|---------|------------|------|
| tech | role | design-tech-stack | - | docs/05-design/01-tech-stack.md | stack | |
| data | role | design-data-api | tech | docs/05-design/02-data-model.md, docs/05-design/03-api-spec.md | | |
| ui-direction | role | design-ui-direction | tech | docs/05-design/_variants/ | direction | |
| ui | role | design-ui | ui-direction | docs/05-design/04-ui-spec.md, docs/05-design/wireframes/ | | |
| recon | reconcile | - | data, ui | - | data-ui | maxRounds=2 |
| arch | role | design-architecture | recon | docs/05-design/05-architecture.md | | |
| map | role | design-filemap | arch | docs/05-design/06-file-map.md | | |
| test | role | design-test | map | docs/05-design/07-test-plan.md | | |
| tasks | role | design-tasks | test | docs/05-design/08-tasks.md, docs/05-design/README.md | plan | |
| gate1 | gate | - | tasks | - | | stage=design; skip=REV |
| review | review | design-reviewer | gate1 | docs/05-design/_review/ | | perspectives=consistency/feasibility/risk |
| gate2 | gate | - | review | - | | stage=design |

## 노드 종류

| kind | 하는 일 | 완료 판정 |
|------|---------|-----------|
| role | `role` 에이전트를 호출한다 | `outputs`가 모두 존재 (그리고 체크포인트가 있으면 사용자 확인) |
| reconcile | 병렬 산출물의 이름·어휘를 맞춘다 | `plan.js done`으로 기록 |
| gate | `gate.js <stage>` 내용 검사를 실행한다 | 검사가 통과 |
| review | `role`을 관점마다 병렬 호출한다 (관점은 `perspectives`) | `outputs` 디렉토리에 관점별 `<관점>.json`이 모두 존재 |

## 메모

- `recon`의 자동 대사(스크립트)는 마이그레이션 5단계에서 추가된다. 그 전에는 허브가 `ui-spec`, `data-model`, `api-spec`의 이름과 어휘가 `spec`과 맞는지 점검하고, 맞추면 `plan.js done design recon`으로 완료를 기록한다.
- `data`와 `ui`는 서로의 산출물을 읽지 않는다. 같은 `spec`의 어휘로 맞춘다.
- `gate1`은 `skip=REV`로 리뷰 규칙을 건너뛴다 (리뷰는 그 뒤 노드라서). 리뷰 뒤 `resolution.md`(지적별 유형·처리·근거, `contracts/review-handling.md`)를 쓰고 `gate2`가 `REV-01`~`REV-03`까지 검사한다.
- `test`는 명세의 인수 기준(AC)·UC·NFR을 시험 시나리오(TC)로 펼친다. `tasks`는 Task마다 담당 TC를 `check:`에 적으므로 `test` 뒤에 온다.
- 체크포인트 4곳: `stack`(기술 스택 **후보를 보고 고른다**), `direction`(화면 **시안을 보고 고른다**), `data-ui`(데이터·API와 UI), `plan`(시험 계획과 작업 목록).
- `ui-direction`은 `data`와 병렬이다(서로 읽지 않는다). 사용자가 `direction`에서 시안을 고르면 오케스트레이터가 `docs/05-design/_variants/choice.md`를 쓰고(선택·기각 사유), 그 뒤에 `ui`가 선택된 방향으로 화면을 설계한다. 시안 선택은 계획의 일부이므로 `ui`는 `choice.md` 없이 시작하지 않는다.
- 계획 실행기(파일럿 4단계)는 아직 없다. 지금 실제로 도는 흐름은 `design-architect` 스킬이고, 같은 확인(기술 스택 후보, 시안 선택)을 그 스킬이 한다.
