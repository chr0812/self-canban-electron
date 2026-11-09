# 08-tasks.md 템플릿

task-planner가 사용하는 출력 형식. 구현 진행 체크 + 누락 검증 기준.

```markdown
# 구현 작업 Task

> 입력: spec.md 요구사항 + 설계 산출물(architecture/file-map/data-model/api-spec/ui-spec)
> 용도: 순서대로 구현 + 완료 체크 + 요구사항 커버리지(누락) 검증

## 요약
- 총 Task: {N}개  |  Wave/Phase: {N}개
- 커버리지: FR {n}/{전체} · SCR {n}/{전체} · NFR {n}/{전체}
- ⚠️ 누락 경고: {없음 | 아래 N건}

## Task 목록 (의존성 순서)

### Wave 1 — {설명}
- [ ] **T-001** {작업}  (covers: FR-001 / data: {엔티티} / file: {경로} / check: TC-001, TC-002)  deps: 없음
- [ ] **T-002** {작업}  (covers: NFR-007 / check: -)  deps: T-001

### Wave 2 — {설명}
- [ ] **T-003** {작업}  (covers: FR-004, SCR-005 / api: {인터페이스} / check: TC-005)  deps: T-001

(... Wave N, 진입점/통합 Task까지)

## 요구사항 커버리지 점검표

> 모든 P0 요구사항이 최소 1개 Task에 매핑되어야 함. (없음 = ⚠️ 누락)

| 요구사항 | 유형 | 커버 Task | 상태 |
|---------|------|----------|------|
| FR-001 | P0 | T-001, T-005 | ✅ |
| FR-007 | P1 | T-015 | ✅ |
| NFR-006 | - | (없음) | ⚠️ 누락 |
| SCR-003 | - | T-009 | ✅ |

- `check:` = 그 Task가 테스트 코드로 함께 구현할 시험 시나리오(`07-test-plan.md`의 TC). 담당 TC가 없으면 `check: -`. `manual`이 아닌 TC는 모두 어떤 Task에 있어야 한다.
- 체크박스는 설계에서 `- [ ]`로 두고 구현 중에도 바꾸지 않는다 (설계 승인 해시 대상).

### ⚠️ 누락 항목 (있을 경우)
- {요구사항 ID}: 어떤 Task에도 매핑 안 됨 → 조치 필요(Task 추가 또는 범위 제외 명시)
```
