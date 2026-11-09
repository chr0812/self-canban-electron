# 시험 보고서

> 작성일: 2026-11-09 (명세 v4 개선 7건 반영 뒤 다시 시험. 이전 판: 2026-11-04·05, TC 155개 기준)
> 시험 실행: docs/_gate/test.json (증거: docs/07-test/_evidence/)

## 요약

- 시나리오 175개: 통과 175 · 실패 0 · 실행 불가 0 · 면제 0
- 사람 확인: 수동 5개(TC-131, TC-132, TC-133, TC-134, TC-155)는 2026-11-09에 사용자가 명세 v4 반영 포장본으로 확인해 통과로 기록했다. TC-131·132·134는 사용자 직접 확인이고, TC-133·155는 오케스트레이터가 포장본의 파일·퓨즈 값을 읽기 전용으로 점검한 결과를 사용자가 인정했다(환경 변수·--inspect로 실행해 포트를 보는 절차는 하지 않음). 이전 판(2026-11-05) 확인은 이번 결과로 쓰지 않았다
- 자동 실행: install, lint, build, test, test:e2e → 통과 (증거 로그 docs/07-test/_evidence/run-20261109-091507.log). 판정: TC 별(결과 파일). cli 86개와 browser 84개 모두 결과 파일에서 통과 (Vitest 344개 테스트, Playwright 85개 테스트, 실패·건너뜀 0). 같은 날 먼저 한 실행(docs/07-test/_evidence/run-20261109-090812.log)은 Playwright 85개 중 1개(TC-110)가 실패해 suite 실패였고 나머지 169개 TC는 통과였다. 같은 코드·같은 시험으로 `build.js test-run`을 다시 하자 전부 통과했다. 간헐 실패이며 `발견 사항` A에 적었다. 이 보고서의 표는 마지막 실행(091507)을 기준으로 한다
- 화면 시험: Playwright 1.64.1 `_electron`, 실제 Electron 45.2.1 창(headless 아님), 빌드 결과 `out/main/index.js`를 실제 구동(`npm run test:e2e` = 빌드 후 `playwright test`, 작업자 1개, 재시도 0). 시험마다 새 임시 `--user-data-dir`을 씀. 마지막 실행은 실패가 없어 trace·스크린샷이 남지 않았다(보관본: docs/07-test/_evidence/test-e2e-20261109-091507, `.last-run.json`만 있음). 먼저 한 실행의 실패 증거(스크린샷·trace·error-context)는 docs/07-test/_evidence/test-e2e-20261109-090812 에 있다. 결과 파일: docs/07-test/_evidence/junit-20261109-091507.xml, docs/07-test/_evidence/e2e-20261109-091507.xml (먼저 한 실행: junit-20261109-090812.xml, e2e-20261109-090812.xml)
- 인수 기준: 48/48 확인됨 (AC마다 통과한 자동 TC가 1개 이상 있음). AC-012·AC-038·AC-039와 NFR-001·NFR-002·NFR-004의 사람 확인 보완 항목 5개(TC-131~TC-134, TC-155)는 2026-11-09에 사용자가 확인해 통과로 기록했다(`사람 확인 목록`)
- 시험 뒤 정리: 시험이 띄운 electron 프로세스는 `tasklist` 확인에서 남아 있지 않음. 시험은 임시 `--user-data-dir`만 썼고 %APPDATA%\self-canban 의 `kanban-data.json`(수정 2026-11-05 09:03)은 이번 시험이 바꾸지 않았다. 이 폴더는 2026-11-05 08:58에 생긴 것으로 이번 시험이 만들지 않았다(이전 판 보고서는 "만들어지지도 않았다"고 적었으나 그 뒤 생겼다. 원인은 확인하지 못했고 내용은 읽지 않았다). `%TEMP%`에 `self-canban-e2e-*` 폴더 4개가 남아 있다(탐색 시험 5번)

## 시나리오 결과

| TC | 실행 | 결과 | 증거 | 확인자 | 비고 |
|----|------|------|------|--------|------|
| TC-001 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/date-rules.test.ts | - |  |
| TC-002 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/date-rules.test.ts | - |  |
| TC-003 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/date-rules.test.ts | - |  |
| TC-004 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/date-rules.test.ts | - |  |
| TC-005 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/date-rules.test.ts | - |  |
| TC-006 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/validation.test.ts | - |  |
| TC-007 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-008 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/validation.test.ts | - |  |
| TC-009 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/validation.test.ts | - |  |
| TC-010 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-011 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - | 명세 v4 반영 (새 카드는 할 일, 진행 중으로는 만들 수 있고 완료로는 만들 수 없음) |
| TC-012 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-013 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-014 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-015 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-016 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-017 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-018 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-019 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-020 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-021 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-022 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-queries.test.ts | - |  |
| TC-023 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-queries.test.ts | - |  |
| TC-024 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/progress-rules.test.ts | - |  |
| TC-025 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/progress-rules.test.ts | - |  |
| TC-026 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/progress-rules.test.ts | - |  |
| TC-027 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/settings-rules.test.ts | - | 명세 v4 반영 (기본 판이 밝은 판) |
| TC-028 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/settings-rules.test.ts | - |  |
| TC-029 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/query-filter.test.ts | - |  |
| TC-030 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/query-filter.test.ts | - |  |
| TC-031 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/query-filter.test.ts | - |  |
| TC-032 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-validator.test.ts | - |  |
| TC-033 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-validator.test.ts | - | 명세 v4 반영 (설정이 없거나 판 값이 목록 밖이면 기본 판으로 채우지 않고 SCHEMA_INVALID) |
| TC-034 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-save.test.ts | - | 저장 단계는 네 단계(BI-003 수정 반영). 첫 저장의 복사 생략도 같은 TC 이름의 별도 테스트로 확인 |
| TC-035 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-save.test.ts | - | 단계별 실패 주입이 실제로 일어났는지(callLog의 fail 기록)를 단언함. fsync 실패는 write_temp로 보고됨을 확인 |
| TC-036 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-037 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - | 명세 v4 반영 (기본 판이 밝은 판) |
| TC-038 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-039 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-040 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-041 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-042 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-043 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-044 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-045 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/migrations/schema-migrations.test.ts | - |  |
| TC-046 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/migrations/schema-migrations.test.ts | - | 명세 v4 반영 (버전 1 파일의 설정은 밝은 판, 이미 저장된 어두운 판은 그대로) |
| TC-047 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store.test.ts | - |  |
| TC-048 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store.test.ts | - |  |
| TC-049 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store.test.ts | - |  |
| TC-050 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store.test.ts | - |  |
| TC-051 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store-faults.test.ts | - | 명세 v4 반영 (마감일 수정 실패 시 카드의 마감일이 그대로임을 포함) |
| TC-052 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store-faults.test.ts | - | 교체 앞 중단은 직전본 또는 새 저장본 어느 쪽이든 통과하도록 짜여 있어 정확한 단계별 기대값은 확인하지 못함 (BI-008, 기록) |
| TC-053 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store-faults.test.ts | - |  |
| TC-054 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store-locked.test.ts | - |  |
| TC-055 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store-locked.test.ts | - |  |
| TC-056 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/node-file-system.test.ts | - |  |
| TC-057 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/board-model.test.ts | - |  |
| TC-058 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/board-model.test.ts | - |  |
| TC-059 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/calendar-model.test.ts | - |  |
| TC-060 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/calendar-model.test.ts | - |  |
| TC-061 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/card-form-state.test.ts | - | 명세 v4 반영 (날짜 입력칸 값 변환(비움은 null)) |
| TC-062 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/card-form-state.test.ts | - | 명세 v4 반영 (입력하다 만 값은 마감일 칸 오류) |
| TC-063 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/text/labels.test.ts | - | 문구 표의 모든 값·오류 코드 확인. 명세 v4 반영 (우선순위 낮음·중간·높음 순서와 `중간` 표시) |
| TC-064 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/ipc/ipc-contract.test.ts | - |  |
| TC-065 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/ipc/ipc-handlers.test.ts | - |  |
| TC-066 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/ipc/ipc-handlers.test.ts | - |  |
| TC-067 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - | TC 이름이 붙은 테스트 2개(본 시나리오 + 상단 막대 카드 만들기 버튼 하나 보조 확인), 모두 통과. 명세 v4 반영 (새 카드는 할 일 칸에 나타남) |
| TC-068 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - |  |
| TC-069 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-070 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - |  |
| TC-071 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - |  |
| TC-072 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - |  |
| TC-073 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - | 명세 v4 반영 (상세 모드 상태 선택은 세 값뿐) |
| TC-074 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - |  |
| TC-075 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - |  |
| TC-076 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - |  |
| TC-077 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - |  |
| TC-078 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - | 명세 v4 반영 (마감일 입력칸의 값으로 확인) |
| TC-079 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-080 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - | 명세 v4 반영 (날짜 입력칸에서 입력하다 만 값(연도 비움)을 저장 직전에 읽어 오류로 처리(BI-015 수정 뒤 07 절차대로 복원)) |
| TC-081 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-082 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - | 명세 v4 반영 (우선순위 선택지 순서(없음, 낮음, 중간, 높음)와 `중간` 표시) |
| TC-083 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-084 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-085 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-086 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-087 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-088 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-089 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-090 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-091 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/archive.spec.ts | - |  |
| TC-092 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/archive.spec.ts | - |  |
| TC-093 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/archive.spec.ts | - | 보기 전용 대화상자는 입력칸이 아니라 읽기 전용 글자로 값을 보이고 테스트도 그 기준(04-ui-spec 462행). 07-test-plan의 "입력칸은 읽기 전용"과 문구가 다름 (탐색 시험 참고) |
| TC-094 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/archive.spec.ts | - |  |
| TC-095 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - |  |
| TC-096 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - |  |
| TC-097 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - |  |
| TC-098 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - |  |
| TC-099 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - |  |
| TC-100 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - |  |
| TC-101 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - |  |
| TC-102 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/overdue.spec.ts | - |  |
| TC-103 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/overdue.spec.ts | - |  |
| TC-104 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/overdue.spec.ts | - |  |
| TC-105 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/search-filter.spec.ts | - |  |
| TC-106 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/search-filter.spec.ts | - | 명세 v4 반영 (`전체` 항목과 우선순위 순서(낮음, 중간, 높음)) |
| TC-107 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/search-filter.spec.ts | - | 명세 v4 반영 (`전체` 항목과 우선순위 순서(낮음, 중간, 높음)) |
| TC-108 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/search-filter.spec.ts | - |  |
| TC-109 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/search-filter.spec.ts | - |  |
| TC-110 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/persistence.spec.ts | - | 시험 기대값은 BI-016에서 기본 판 변경에 맞춰 수정됨. 먼저 한 실행(run-20261109-090812)에서 한 번 실패했고(둘째 카드의 저장이 5초 안에 끝나지 않음) 다시 실행하자 통과. 간헐 실패(발견 사항 A) |
| TC-111 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/persistence.spec.ts | - | 작업 관리자 대신 taskkill /T /F로 이 시험이 띄운 PID 트리만 종료. 종료 뒤 main PID가 사라졌는지와 저장 파일 불변까지 단언 |
| TC-112 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/persistence.spec.ts | - | 명세 v4 반영 (기본 판이 밝은 판) |
| TC-113 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/persistence.spec.ts | - | 명세 v4 반영 (기본 판이 밝은 판) |
| TC-114 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/save-failure.spec.ts | - | 쓰기 실패 유도(.bak 폴더, 직전본 복사 단계 실패)가 Windows 11에서 실제로 성립함을 매 시험 단언(본 파일 불변, 임시 파일 존재, .bak 폴더 존재) |
| TC-115 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/save-failure.spec.ts | - | 같은 유도 방식. 재시도(다시 저장)·재구동까지 확인 |
| TC-116 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/save-failure.spec.ts | - | 같은 유도 방식. 명세 v4 반영 (처음 판이 밝은 판이고 어두운 판 전환 저장 실패 뒤 재구동하면 밝은 판) |
| TC-117 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/read-failure.spec.ts | - |  |
| TC-118 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/read-failure.spec.ts | - | 시험 기대값은 BI-016에서 기본 판 변경에 맞춰 수정됨 |
| TC-119 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/read-failure.spec.ts | - |  |
| TC-120 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/read-failure.spec.ts | - |  |
| TC-121 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/theme.spec.ts | - | 명세 v4 반영 (처음 실행은 밝은 판, 저장된 어두운 판은 그대로 열림) |
| TC-122 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/theme.spec.ts | - | 명세 v4 반영 (기본 판이 밝은 판) |
| TC-123 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/theme.spec.ts | - | 색 외 구분 요소(글자·아이콘·모양)의 존재 확인. 사람이 실제로 구분되는지는 TC-131(사람 확인) |
| TC-124 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/theme.spec.ts | - | 색 외 구분 요소(글자·삼각형 아이콘·2px 테두리) 확인. 흑백 시각 구분은 TC-131(사람 확인) |
| TC-125 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/offline.spec.ts | - | Playwright 창 단위 관찰만 함. Chromium 프로세스 자체의 요청은 TC-132(사람 확인). 시험 기대값은 BI-016에서 기본 판 변경에 맞춰 수정됨 |
| TC-126 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/offline.spec.ts | - | CSP 위반 이벤트로 차단 장치가 실제로 일했음을 단언. 빌드 결과 index.html의 CSP 메타 태그도 확인 |
| TC-127 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/offline.spec.ts | - | setOffline(true)가 동작하고 navigator.onLine이 false임을 단언. 실제 네트워크 차단은 TC-132(사람 확인) |
| TC-128 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/offline.spec.ts | - | 글꼴 요청이 번들 폴더의 file: woff2로 관찰되고 SUIT 글꼴이 loaded임을 단언. 포장 결과 포함 여부는 TC-133(사람 확인) |
| TC-129 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/app-security.spec.ts | - | 이 시험이 첫 Electron 구동이라 Electron 바이너리 내려받기(약 9.7초)가 시간에 포함됨 |
| TC-130 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/app-security.spec.ts | - |  |
| TC-131 | manual | 통과 | 사용자 확인 | chr0812 | 2026-11-09 사용자가 명세 v4 반영 포장본(C:/Users/cho/kanban-package-v4/win-unpacked/일정관리.exe)으로 직접 확인. 기본 판이 밝은 판으로 바뀐 절차 기준. 자동 보조 시험 TC-123·TC-124도 통과 |
| TC-132 | manual | 통과 | 사용자 확인 | chr0812 | 2026-11-09 사용자가 명세 v4 반영 포장본으로 직접 확인. 자동 보조 시험 TC-125~TC-127도 통과. Chromium 자체 요청의 넷로그(--log-net-log)를 별도로 봤는지는 기록하지 않음 |
| TC-133 | manual | 통과 | 사용자 인정(오케스트레이터 점검 결과) | chr0812 | 2026-11-09 오케스트레이터가 새 포장본(C:/Users/cho/kanban-package-v4/win-unpacked)을 읽기 전용으로 점검: resources/licenses/SUIT-LICENSE.txt(4,380바이트, SIL OFL 1.1, SUNN 문구)가 있고 app.asar 안에 SUIT-Variable-*.woff2가 1개 있다. 사용자가 이 점검 결과를 인정하고 글꼴 표시는 직접 확인함 |
| TC-134 | manual | 통과 | 사용자 확인 | chr0812 | 2026-11-09 사용자가 명세 v4 반영 포장본으로 직접 확인. 자동 시험 TC-111·TC-051~TC-053도 통과 |
| TC-135 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/card-rules.test.ts | - |  |
| TC-136 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store.test.ts | - |  |
| TC-137 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-save.test.ts | - |  |
| TC-138 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-save.test.ts | - |  |
| TC-139 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/data-file-repository.test.ts | - |  |
| TC-140 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/node-file-system.test.ts | - | NodeFileSystem의 재시도(4회, 30ms)와 EBUSY 보존, ENOENT 즉시 실패 확인 |
| TC-141 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/ipc/ipc-handlers.test.ts | - |  |
| TC-142 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/ipc/ipc-handlers.test.ts | - |  |
| TC-143 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/state/reducers.test.ts | - | 명세 v4 반영 (초기 판은 밝은 판) |
| TC-144 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/state/change-runner.test.ts | - |  |
| TC-145 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/state/change-runner.test.ts | - |  |
| TC-146 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/state/change-runner.test.ts | - |  |
| TC-147 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/state/change-runner.test.ts | - |  |
| TC-148 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/archive.spec.ts | - |  |
| TC-149 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/archive.spec.ts | - |  |
| TC-150 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-151 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/card-dialog.spec.ts | - |  |
| TC-152 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/persistence.spec.ts | - | 창 닫기 경로(close, whenIdle, window-all-closed, quit)로 종료 코드 0과 다섯 건 저장까지 확인 |
| TC-153 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/read-failure.spec.ts | - | 본 파일 자리의 폴더를 읽을 때 Windows의 실제 오류 코드가 EISDIR임을 확인(설계가 확인하지 못했던 점) |
| TC-154 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/app-security.spec.ts | - | 차단이 CSP가 아니라 main의 요청 차단 장치와 will-navigate임을 stderr 로그로 단언. Windows file: 주소 대소문자·인코딩 비교 이상 없음 |
| TC-155 | manual | 통과 | 사용자 인정(오케스트레이터 점검 결과) | chr0812 | 2026-11-09 오케스트레이터가 새 포장본의 퓨즈를 @electron/fuses로 읽어 확인: RunAsNode, EnableNodeOptionsEnvironmentVariable, EnableNodeCliInspectArguments 모두 Disabled. 환경 변수(ELECTRON_RUN_AS_NODE, NODE_OPTIONS)와 --inspect 인자로 실행해 디버그 포트를 netstat으로 보는 절차는 하지 않았고 사용자가 이 정적 점검 결과를 인정함 |
| TC-156 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/domain/validation.test.ts | - | 명세 v4 신규(AC-041·042). 만들기 입력의 status는 할 일·진행 중·생략만 받고 done·archived·빈 문자열·숫자·null은 status/INVALID_VALUE(UNKNOWN_FIELD 아님)임을 단언. 같은 done이 수정 입력에서는 허용됨도 확인 |
| TC-157 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store.test.ts | - | 명세 v4 신규. 진행 중으로 만든 카드의 저장과 재열기, 진행 기록 0건, 완료 시도는 거부되고 쓰기 0건·저장 파일 불변까지 단언. 앞선 저장이 실제로 일어났음(writeCalls)을 준비 조건으로 단언 |
| TC-158 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/card-form-state.test.ts | - | 명세 v4 신규. 처음 상태 todo, 고른 상태가 만들기 입력의 상태가 됨, 완료는 거부, 수정 모드는 카드의 현재 상태 그대로 |
| TC-159 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/card-form-state.test.ts | - | 명세 v4 신규. 달력으로 고른 값과 직접 입력한 값이 같은 입력이 된다는 비교는 같은 문자열을 두 번 변환해 비교하는 형태라 두 경로를 구분하지 못한다(탐색 시험 충실성 점검). 칸 지움(null)과 일부만 채움(INVALID_DATE, 값 없음)은 실제로 단언함. 두 경로의 실제 확인은 TC-165 |
| TC-160 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/store/kanban-store.test.ts | - | 명세 v4 신규. 마감일만 바뀌고 나머지·진행 기록 그대로, 같은 날짜는 쓰기 0건, 다른 달·완료 카드 가능, 보관 카드는 CARD_ARCHIVED. 앞선 저장이 실제로 일어났음을 준비 조건으로 단언 |
| TC-161 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/state/change-runner.test.ts | - | 명세 v4 신규. 응답을 보류한 동안 화면 사본 불변, 성공 뒤에만 바뀜, 실패하면 불변이고 같은 요청 한 건을 기억, 다시 저장이 같은 인자로 재전송 |
| TC-162 | cli | 통과 | docs/07-test/_evidence/junit-20261109-091507.xml, app/tests/cli/model/board-model.test.ts | - | 명세 v4 신규. 사이드바 건수 `전체`가 범위 전체, 우선순위 목록 순서. 이 시험 본문은 읽지 않았다(이름·단언 유무만 확인) |
| TC-163 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - | 명세 v4 신규. 선택지가 할 일·진행 중 두 개뿐(완료·보관 없음), 처음 할 일, 잠기지 않음(disabled 거짓), 키보드로 전환 |
| TC-164 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/board.spec.ts | - | 명세 v4 신규. 진행 중으로 만든 카드가 진행 중 칸에 나타나고 칸별 건수 1·1·0, 진행 기록 0건, 재구동 뒤에도 유지 |
| TC-165 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar-drag.spec.ts | - | 명세 v4 신규. 브라우저의 달력 팝업은 DOM 밖이라 열거나 누르지 못해 값 설정(fill)과 키보드 직접 입력으로 확인함(07도 이 한계를 적음). 팝업의 모양·클릭은 자동 시험이 확인하지 못함(사람 확인 목록의 참고). 입력하다 만 상태(badInput 참)가 만들어졌음을 저장 전에 단언하고 저장 파일이 바뀌지 않았음을 확인 |
| TC-166 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar-drag.spec.ts | - | 명세 v4 신규. HTML5 끌기(dragTo)가 Electron에서 동작함. 칩 위치, 카드 필드·설명·메모·진행 기록 보존, 완료 카드도 끌림, 하단 줄 건수, 재구동 유지를 단언 |
| TC-167 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar-drag.spec.ts | - | 명세 v4 신규. 주 보기에서 칩을 끌어 놓은 뒤 카드 필드 보존과 월 보기 전환 확인 |
| TC-168 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar-drag.spec.ts | - | 명세 v4 신규. 12월 1일 칸이 이 달 밖 칸(data-outside)임을 준비 조건으로 단언. 놓은 직후 11월 보기의 칩 처리는 07 결정 필요 7이라 단언하지 않음 |
| TC-169 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar-drag.spec.ts | - | 명세 v4 신규. 자기 칸·요일 줄·범례 줄·사이드바·상단 막대 다섯 곳에 놓은 뒤 저장 파일 해시·수정 시각·파일 목록 불변과 놓는 곳 표시 0을 단언. 없음을 확인하는 단계라 고정 대기(waitForTimeout 1000ms)를 씀 |
| TC-170 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar-drag.spec.ts | - | 명세 v4 신규. 칸 칩 draggable 참, 팝업 칩 거짓, 마우스로 직접 끌어도 놓는 곳 표시가 켜지지 않음, 저장 파일 해시 불변. 07 절차의 20일 칸은 팝업이 덮어 16일 칸 시도를 더했다(발견 사항 C). 고정 대기 500ms 사용 |
| TC-171 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - | 명세 v4 신규. 실측(이 PC): 창 1280x920, 본문 scrollHeight 763 = clientHeight 763, 마지막 칸 아래 779 < 본문 아래 819(여유 약 40px). 07 결정 필요 8(창 높이 920)이 이 PC에서 성립함. 창 크기와 12일 칸의 칩 3개·`+2건 더 보기`, 저장 실패 알림 줄 없음을 준비 조건으로 단언 |
| TC-172 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/calendar.spec.ts | - | 명세 v4 신규. 창을 1200x700으로 줄인 뒤 scrollHeight 742 > clientHeight 543, 본문을 끝까지 스크롤하면 마지막 칸이 보임, 상단 막대·하단 줄 위치 고정, 문서 전체 스크롤 없음. 시작 상태(스크롤 없음)와 줄어든 창 크기를 준비 조건으로 단언 |
| TC-173 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/save-failure.spec.ts | - | 명세 v4 신규. 쓰기 실패가 backup 단계에서 났음을 준비 조건으로 단언(expectBackupStageFailure), 실패 뒤 칩이 제자리에 있고 실패 문구, `.bak` 폴더를 지우고 다시 저장하면 같은 요청이 가서 18일 칸으로 이동, 재구동 뒤에도 유지 |
| TC-174 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/search-filter.spec.ts | - | 명세 v4 신규. 보드와 보관함 모두에서 `전체`가 처음 선택, 우선순위 순서 전체·낮음·중간·높음, 보관 카드는 보드 건수에서 제외 |
| TC-175 | browser | 통과 | docs/07-test/_evidence/e2e-20261109-091507.xml, app/tests/browser/search-filter.spec.ts | - | 명세 v4 신규. 한 목록에 하나만 선택, `전체`로 풀림, 선택된 항목을 다시 눌러도 유지(고정 대기 300ms 사용), 보관함 필터도 확인 |

## 탐색 시험

계획에 없던 확인과 설계 대 코드 대조다. 일회성 확인은 증거 위치와 "자동 회귀 시험에 남지 않음"을 함께 적는다. 2026-11-09 갱신: 명세 v4로 더해진 TC와 바뀐 부분을 다시 보았다. 이전 판(2026-11-04)에서 확인한 항목은 상태가 바뀐 줄에만 적었다.

**테스트의 충실성 점검** (코드를 읽고 판단함. 설정을 일부러 틀리게 만들어 시험이 실패하는지 보는 확인은 앱 코드·테스트를 고치지 않는 규칙 때문에 하지 못함)
- 2026-11-09 추가로 본문을 읽은 시험: browser는 calendar-drag(TC-165~170 전부), calendar(TC-171·172), save-failure의 TC-173·TC-116, board의 TC-163·164, search-filter의 TC-174·175, persistence의 TC-110. cli는 validation의 TC-156, card-form-state의 TC-158·159, kanban-store의 TC-157·160, change-runner의 TC-161. 읽은 범위에서는 기대 결과를 실제로 단언한다(TC-159 한 곳은 아래 약점). 읽지 않은 것: board-model의 TC-162, 그리고 명세 v4로 기대값만 바뀐 기존 TC 가운데 TC-011, 027, 033, 037, 046, 051, 061~063, 067, 073, 078, 080, 082, 106, 107, 112, 113, 121, 122, 143은 이름·결과 파일·단언 유무만 보았다.
- 이전 판에서 본문을 읽은 시험: browser는 app-security, offline, save-failure, read-failure, persistence, theme, overdue(TC-102~104), archive(TC-093~094), board(TC-067~074), cli는 ipc-handlers, data-file-save(TC-034·035·137·138), kanban-store(TC-047~050). 나머지는 이름과 단언 유무만 훑었고 본문을 하나하나 읽지는 않았다.
- 읽은 범위에서는 모두 `기대 결과`를 실제로 단언했다. 차단·실패 주입을 설정한 시험은 그 설정이 일어났음을 따로 단언한다: 차단 장치가 일했다는 main stderr 로그(TC-130, TC-154), CSP 위반 이벤트(TC-126), 요청 관찰이 실제로 번들 요청을 봤다는 단언(TC-125, TC-127, TC-128의 `observeWithReload`), `navigator.onLine === false`(TC-127), 실패 주입이 실제로 일어났다는 `callLog`의 fail 기록(TC-035, TC-138), 쓰기 실패가 직전본 복사 단계에서 났다는 본 파일 불변·임시 파일 존재·`.bak` 폴더 존재(TC-114~116).
- 새 시험의 준비 조건·차단 조건 단언: TC-165(입력하다 만 상태 `badInput` 참을 저장 전에 단언하고 저장 파일 불변), TC-168(12월 1일 칸이 `data-outside`), TC-169(심은 폴더에 저장 파일 하나뿐임을 기록하고 놓은 뒤 해시·수정 시각·파일 목록 동일, 놓는 곳 표시 0), TC-170(칸 칩 `draggable` 참, 팝업 칩 거짓, 끌기 중 놓는 곳 표시 0), TC-171(창 1280x920, 12일 칸 칩 3개와 `+2건 더 보기`, 저장 실패 알림 줄 없음), TC-172(시작 상태 스크롤 없음, 줄어든 창 크기와 `innerHeight` 감소), TC-173(쓰기 실패가 backup 단계에서 났음 `expectBackupStageFailure`), TC-157·160(앞선 저장이 실제로 일어났음 `writeCalls`). 설정을 지우거나 틀리게 만들어 시험이 실패하는지는 보지 못했다(앱 코드·시험 수정 금지).
- 약점 1, TC-159(단위): "달력으로 고른 값과 직접 입력한 값이 같은 마감일 입력으로 변환된다"를 같은 문자열 `2026-11-20`을 두 번 변환해 서로 비교한다. 두 경로를 구분하는 입력이 없어 이 비교는 무엇도 증명하지 못한다(단위 수준에서 두 경로는 둘 다 문자열이라 같을 수밖에 없다). 칸을 지운 경우(null)와 일부만 채운 경우(`INVALID_DATE`, 저장 값 없음)는 실제로 단언한다. 두 경로의 차이는 TC-165(browser)가 값 설정과 키보드 입력으로 따로 본다. 통과로 적었으나 이 부분은 기대 결과를 확인하지 못한 것이다(발견 사항 B).
- 약점 2, 고정 대기: 이전 판의 "`waitForTimeout`을 찾지 못했다"는 낡았다. 지금은 5곳이다(calendar-drag.spec.ts 354행 1000ms·408행 500ms, search-filter.spec.ts 294·319·342행 300ms). 모두 "아무것도 바뀌지 않았다"를 확인하는 단언(TC-169, TC-170, TC-175) 앞의 대기이고, 대기 시간이 모자라도 시험이 거짓으로 통과할 수 있는 위치다(다만 TC-169는 데이터 파일 해시·수정 시각까지 함께 보므로 거짓 통과 가능성이 낮다). 건너뜀·`.only`·`fixme`·`test.skip`은 `app/tests`에서 찾지 못했다.
- 약점 3, TC-165의 한계: 브라우저가 그리는 달력 팝업은 열 수 없어 값 설정과 키보드 입력으로 대신했다(07에도 적혀 있다). 날짜 입력칸의 달력 아이콘, 팝업 모양, 날짜 고르기는 자동 시험이 확인하지 못한다.
- 일회성 확인 1건: 먼저 한 실행에서 실패한 TC-110을 `cd app` 뒤 `npx playwright test -c playwright.config.ts tests/browser/persistence.spec.ts -g TC-110 --repeat-each=6 --reporter=list`로 6번 돌려 6번 통과했다(출력만 확인하고 증거 파일은 남기지 않았다. 결과 파일은 시험자 임시 폴더로 보냈다). 자동 회귀 시험에는 남지 않았다. 표의 판정은 이 일회성 확인이 아니라 `build.js test-run`의 결과 파일(091507)이다.

**설계 문서와 실제 코드를 대조해 확인한 것**
1. 설계의 미확인 가정이 시험으로 확인됨: `--user-data-dir`이 `userData`에 반영됨, 쓰기 실패 유도(`.bak` 폴더)와 읽기 실패 유도(`kanban-data.json` 자리의 폴더, 코드 `EISDIR`)가 Windows 11에서 성립함, `file:` 허용 접두사의 대소문자·퍼센트 인코딩 비교가 이 PC에서 어긋나지 않음(TC-154), `setOffline(true)`가 동작함(TC-127), 창 닫기 직전에 main에 도착하지 못한 요청은 보이지 않음(TC-152).
2. 포장 퓨즈 지원(TC-155의 전제): 설치된 electron-builder 26.18.0의 `app-builder-lib`가 `electronFuses`(`runAsNode`, `enableNodeOptionsEnvironmentVariable`, `enableNodeCliInspectArguments`)를 지원하고 `app/electron-builder.yml`에 세 값이 `false`로 설정되어 있음을 `app/node_modules/app-builder-lib/out/configuration.d.ts`와 `platformPackager.js`에서 확인했다. 일회성 정적 확인이고 자동 회귀 시험에 남지 않았다. 포장 결과의 실제 동작은 TC-155(사람 확인)가 본다.
3. 글꼴 라이선스 포함(TC-133의 전제): `app/electron-builder.yml`의 `extraResources`가 `src/renderer/src/styles/fonts/SUIT-LICENSE.txt`를 `licenses/SUIT-LICENSE.txt`로 복사하게 되어 있고, 이 파일은 사용자가 넣은 `LICENSE`와 바이트가 같다(`cmp`). 빌드 결과 `app/out/renderer/assets/SUIT-Variable-gqD86R3M.woff2`가 만들어진다. 일회성 확인이고 자동 회귀에 남지 않았다. `app/release/`는 아직 없다(포장은 하지 않았다).
4. 설치와 첫 구동: 설계(`01-tech-stack.md` install 행)는 "첫 설치는 Electron 바이너리 다운로드로 네트워크 필요"라고 적었으나, 이번 `npm ci` 뒤 Electron 바이너리는 설치 중이 아니라 첫 Electron 구동 때(`electron/index.js`의 "Downloading Electron binary...") 내려받아졌다. e2e 첫 시험(TC-129)이 약 9.7초 걸린 것이 이 때문이다. 오프라인 환경에서 `test-run`을 처음 돌리면 이 지점에서 막힌다. 앱 결함은 아니고 시험 환경 참고사항이다.
5. 이전 실행의 흔적(2026-11-09 갱신): `%TEMP%\self-canban-e2e-b76wvt`(2026-11-04 13:55)가 계속 남아 있고, `self-canban-e2e-0q1Caa`, `self-canban-e2e-E39NFf`, `self-canban-e2e-Hb8aAr` 3개가 더 있다. 3개의 안에는 2026-11-05 날짜의 Chromium 캐시 폴더(`Shared Dictionary`, `GPUPersistentCache`)만 있고 카드 데이터는 없다. 폴더 수정 시각이 2026-11-09 09:15라 이번 시험의 정리 과정이 건드렸을 수 있으나, 폴더 이름은 이번 실행이 만든 이름과 구분되지 않아 어느 실행이 남겼는지는 확인하지 못했다. 이번 실행이 직접 남긴 것인지 이전 실행의 잔재인지 가려내지 못한다. 지우지 않았다.
6. `app/src/renderer/src/styles/fonts/`에 설계 파일 맵에 없는 `LICENSE`, `SUIT-Variable.css`, `__MACOSX/._LICENSE`, `__MACOSX/._SUIT-Variable.css`가 있다. 어디에서도 참조하지 않고 빌드 결과에도 들어가지 않는다(빌드 출력은 woff2뿐). `build-log.md`의 T-004 기록에 "정리 여부는 사용자 확인"으로 적혀 있고 `issues.md`에는 없다.
7. 설계 문서끼리의 문구 차이: `07-test-plan.md` TC-093은 "입력칸은 읽기 전용"이라 적었고 `04-ui-spec.md`(462행)는 "입력 칸 대신 읽기 전용 글자로 값을 보인다"라고 적었다. 구현과 테스트(`archive.spec.ts`, 대화상자 안 입력 요소 0개)는 04를 따른다. TC-093은 통과했으나 07의 문장은 04와 맞지 않는다. `build-log.md`(T-041)에 "해석 확인 필요"로만 적혀 있다.

8. (2026-11-09) 기본 창 높이 920의 실측(07 결정 필요 8, `04-ui-spec.md` 결정 필요 12): TC-171 실행에서 창 1280x920, 화면 안쪽 높이 855, 캘린더 본문 clientHeight 763에 scrollHeight 763(스크롤 없음), 5주 격자의 마지막 칸 아래 가장자리 778.98 < 본문 아래 819(여유 약 40px). 설계의 계산값 920이 이 PC에서 성립한다. 창을 1200x700으로 줄이면(TC-172) scrollHeight 742 > clientHeight 543이고 문서 전체 스크롤은 없다. 화면이 더 작은 PC나 표시 배율이 다른 환경에서의 값은 확인하지 못했다. 근거: docs/07-test/_evidence/run-20261109-091507.log 195·198행(시험이 남긴 콘솔 출력, 자동 회귀 시험에도 같은 단언이 있다).
9. (2026-11-09) 포장 결과가 오래되었다: 이전 판의 수동 확인에 쓴 `C:/Users/cho/kanban-package/win-unpacked`는 2026-11-04 17:59에 만든 것이라 명세 v4 구현 이전의 앱이다. `app/release/`는 지금도 없다. 사람 확인(TC-131~134, TC-155)에는 새로 포장한 앱을 써야 한다. 시험자는 포장하지 않았다.
10. (2026-11-09) 사용자 데이터 폴더: `%APPDATA%\self-canban`이 있다(2026-11-05 08:58 생성, `kanban-data.json` 수정 2026-11-05 09:03, `DIPS-wal` 수정 2026-11-09 09:00). 이번 시험은 임시 `--user-data-dir`만 써서 이 폴더의 데이터 파일을 바꾸지 않았다(수정 시각으로 확인). 누가 어떤 실행으로 만들었는지는 모른다. 내용은 읽지 않았다. 사람 확인용 앱은 `--user-data-dir=<임시 폴더>`로 실행하는 것을 권한다.
11. (2026-11-09) 시험 지원 파일 `app/tests/browser/support/board-page.ts`가 `06-file-map.md`에 없다. 지도에는 `launch-app.ts`, `network-observer.ts`만 있고 시험 파일 대부분이 `board-page.ts`를 가져다 쓴다(`calendar-drag.spec.ts` 등). 동작에는 영향이 없다(발견 사항 D).
12. (2026-11-09) TC-170의 절차와 시험이 다르다: 07은 "팝업 안 칩 하나를 11월 20일 칸으로 끌어다 놓기"라 했으나 시험 주석에 따르면 팝업이 20일 칸을 덮고 있어 팝업에 가려지지 않은 16일 칸으로도 같은 시도를 한다(20일과 16일 둘 다 시도). 시험은 07의 기대 결과를 모두 단언하고 통과했다. 07의 절차 문장만 현실과 맞지 않는다(발견 사항 C).
13. (2026-11-09) 이전 판 7번의 하네스 문제(발견 사항 C, `TST-06`이 BI-012 면제를 적용하지 않음)는 이번 `node scripts/gate.js test`에서 `TST-06` 오류가 나오지 않아 해소된 것으로 보인다(BI-012는 `원본 반영`). 이전 판 발견 사항 A·B는 각각 BI-013·BI-014로 올라가 있다.

화면 확인 의견(참고): 이번 시험은 와이어프레임과 화면 모양을 눈으로 비교하지 않았고 요소·문구·속성으로만 확인했다. 시각 품질은 TC-131(사람 확인)에서 본다. 명세 v4의 화면(날짜 입력칸, 칩 끌기, 사이드바 `전체`, 새 카드 상태 선택)도 요소·문구·속성·위치 수치로만 확인했다. 먼저 한 실행에서 실패한 TC-110의 스크린샷(docs/07-test/_evidence/test-e2e-20261109-090812)은 카드 만들기 대화상자가 저장 중(사이드바 `저장 중`, 입력칸이 비활성으로 흐리게 보임)인 상태였고 레이아웃에 눈에 띄는 문제는 없었다. 칩 끌기의 손맛, 놓을 칸 강조 표시, 달력 팝업은 사람이 직접 보아야 한다(`사람 확인 목록`의 참고).

## 사람 확인 목록

시험자는 아래 5개를 통과로 적지 않는다. 확인자(사용자)가 수행하고 결과를 오케스트레이터가 표에 더한다. 이전 판(2026-11-05)의 확인 결과는 앱이 바뀌어(기본 판이 밝은 판으로 바뀜, 저장·화면 변경 7건) 이번 결과로 쓰지 않는다(아래 `이전 판 기준`). 절차와 기대 결과는 `docs/05-design/07-test-plan.md`의 현재 문구(판 4, 2026-11-05)다.

공통 준비: 지금 앱으로 새로 포장한다. `app/`에서 `npm run package`를 실행하면 `app/release/win-unpacked/`가 만들어진다(이번 시험에서는 만들지 않았다. 이전 판은 Orca가 `app/` 안 부산물을 잡아 포장이 실패해서 `app/` 밖 출력 폴더 `C:/Users/cho/kanban-package`에 만들었다. 그 폴더의 2026-11-04 17:59 판은 명세 v4 이전 앱이니 쓰지 않는다). electron-builder가 Electron 배포본을 내려받을 수 있으니 포장은 네트워크가 연결된 상태에서 먼저 하고 TC-132 때 끊는다. 실행 파일은 `<포장 폴더>/win-unpacked/일정관리.exe`. 실제 카드 데이터(`%APPDATA%\self-canban`)를 건드리지 않도록 모든 실행에 `--user-data-dir=<임시 폴더>`를 붙인다(개발 실행 `npm run dev`는 `%APPDATA%\self-canban-dev`를 쓴다).

| TC | 앱 실행(명령·주소) | 대상 | 절차 | 기대 결과 |
|----|-------------------|------|------|-----------|
| TC-131 | `<포장 폴더>/win-unpacked/일정관리.exe --user-data-dir=<임시 폴더>` (또는 `cd app` 뒤 `npm run dev`) | Windows 11, 색 필터 `회색조` | (1) 개발 버그 카드, 할 일 카드, 어제 마감한 미완료 카드, 오늘 마감 카드를 만든다. (2) Windows 설정 > 접근성 > 색 필터에서 `회색조`를 켠다. (3) 어두운 판과 밝은 판 각각에서 보드와 캘린더를 본다. (4) 판을 어두운 판으로 저장해 둔 채 앱을 닫았다 여러 번 다시 열며, 창이 처음 그려지는 순간 밝은 색(처음 실행의 기본 판)이 잠깐 비치는지 본다. (5) 밝은 판도 같은 방법으로 보고, 저장 파일이 없는 처음 실행(빈 `--user-data-dir`)에서도 어두운 색이 비치지 않는지 본다 | 두 판 모두에서 개발 버그와 할 일 카드가 아이콘 모양·글자·칩 모양(채움/테두리)으로 구분되고, 마감 지난 카드가 삼각형 아이콘·`N일 지남` 글자·굵은 테두리로 마감이 지나지 않은 카드와 구분된다. 앱을 다시 열 때 첫 화면부터 저장된 판의 바탕색이고 다른 판의 색이 눈에 띄게 비치지 않는다. 비치면 구현 Task가 preload의 판 적기를 고친다(`Bootstrap`의 판 확정이 안전망이라 데이터는 안전하다) |
| TC-132 | `<포장 폴더>/win-unpacked/일정관리.exe --user-data-dir=<임시 폴더> --log-net-log=<넷로그 파일 경로>` | Windows 11, 패키징한 앱, Wi-Fi·유선 모두 끊음 | 네트워크를 끊고 앱을 실행해 카드 만들기, 수정, 상태 변경, 기록 추가, 보관·보관함, 삭제, 검색·필터, 캘린더, 판 전환을 한 번씩 한다. 앱을 닫고 다시 연다. 닫은 뒤 넷로그 파일(JSON)에서 연결·주소 조회·프록시 자동 감지(WPAD) 이벤트를 훑는다 | 모든 기능이 오류나 지연 안내 없이 동작하고 다시 열어도 카드가 그대로이며 글꼴이 깨지지 않는다. 넷로그에 외부 호스트로 향하는 연결·주소 조회·프록시 조회 이벤트가 없다(`localhost` 제외). 있으면 `NetworkGuard`의 Chromium 요청 완화 후보를 구현하거나 설계를 고친다 |
| TC-133 | `<포장 폴더>/win-unpacked/일정관리.exe --user-data-dir=<임시 폴더>` | Windows 11, 패키징한 앱. 이 PC에 SUIT 글꼴이 설치되어 있지 않음, 네트워크 끊음 | (1) `<포장 폴더>/win-unpacked/resources/licenses/SUIT-LICENSE.txt` 파일이 있는지, 내용에 SIL Open Font License 1.1과 `SUNN` 저작권 문구가 있는지 연다. (2) `resources/app.asar` 안에 `out/renderer/assets/SUIT-Variable-*.woff2`가 있는지 확인한다(예: `npx asar list app.asar`에서 woff2 검색). (3) 네트워크를 끊고 앱을 실행해 한글 문구의 글꼴을 눈으로 본다 | 글꼴 파일(woff2)과 라이선스 원문 파일이 포장 결과에 있고, 네트워크가 없어도 한글 문구가 앱 글꼴 모양으로 보인다 |
| TC-134 | `<포장 폴더>/win-unpacked/일정관리.exe --user-data-dir=<임시 폴더>` (카드 수십 건과 기록이 든 `kanban-data.json`을 그 폴더에 미리 둔다) | Windows 11, 작업 관리자 | 카드를 연속으로 만들거나 상태를 연달아 바꾸는 도중에 작업 관리자의 `작업 끝내기`로 앱 프로세스를 끝낸다. 앱을 다시 실행한다. 이를 여러 번 반복한다 | 매번 읽기 실패 안내 없이 열리고, 저장 완료가 표시되었던 변경은 모두 보이며, 열린 보드가 직전 저장본 또는 새 저장본 중 하나와 같다(반쪽짜리 카드·기록이 없다) |
| TC-155 | `<포장 폴더>/win-unpacked/일정관리.exe` (환경 변수·인자는 절차대로) | Windows 11, 패키징한 앱 | (1) PowerShell에서 `$env:ELECTRON_RUN_AS_NODE=1` 설정 후 실행 파일을 실행한다. (2) 그 변수를 지우고 `$env:NODE_OPTIONS='--inspect=9230'` 설정 후 실행한다. (3) 환경 변수를 지우고 인자 `--inspect=9229`로 실행한다. 각 실행 중 `netstat -ano`로 9229, 9230 포트가 열렸는지 본다. 끝나면 환경 변수를 모두 지운다 | (1)은 Node 모드로 동작하지 않고 앱 창이 일반 앱처럼 뜬다. (2)와 (3)에서 디버그 포트가 열리지 않는다 |

표의 절차와 기대 결과는 07의 현재 문구를 따랐다. 시험자의 권고(07 문구 아님): v4에서 늘어난 기능(새 카드의 진행 중 상태, 날짜 입력칸의 달력, 캘린더 칩 끌기)도 TC-132의 "한 번씩" 기능과 TC-134의 연속 변경에 포함해 보면 좋다.

수동 사유와 확인할 위치:
- TC-131: 사람이 흑백에서 실제로 구분할 수 있는가는 지각 판단이고 명세에 자동 측정 기준이 없다. 첫 화면 색 깜빡임은 프레임 단위로 자동 시험이 잡지 못한다. 보조 자동 TC는 TC-123, TC-124, TC-121(통과). 07의 최신 판에서 절차가 바뀌었다: 기본 판이 밝은 판이 되어 "어두운 판으로 저장해 둔 채 다시 열 때 밝은 색이 비치는지"가 핵심 점검이고 밝은 판과 저장 파일이 없는 처음 실행도 본다(이전 판은 밝은 판으로 저장해 두고 어두운 색이 비치는지를 보았다). 확인할 코드: `app/src/preload/index.ts`(`applyInitialTheme`), `app/src/main/app/window-factory.ts`(`backgroundColor`: 밝은 판 #FAF3EE, 어두운 판 #1F1814, `DEFAULT_THEME`은 `light`).
- TC-132: 자동 TC(TC-125~127)는 앱 창의 요청만 보고 Chromium 프로세스 자체의 요청(주소 사전 조회 등)은 보지 못한다. 네트워크를 실제로 끊는 조작은 자동화 범위 밖이다. 확인할 코드: `app/src/main/app/network-guard.ts`.
- TC-133: 포장은 검증 필수 명령이 아니라서 자동 시험이 포장 결과를 보지 않는다. 포장 설정은 `app/electron-builder.yml`의 `extraResources`(소스 `src/renderer/src/styles/fonts/SUIT-LICENSE.txt`, 포장 시 `release/win-unpacked/resources/licenses/SUIT-LICENSE.txt`). 글꼴이 번들에서 로드되는 동작 자체는 TC-128(통과).
- TC-134: 저장이 진행되는 짧은 순간에 맞춰 프로세스를 끝내는 시점을 시험 코드가 정확히 맞출 수 없다. 모든 중단 지점은 TC-051~053이 대역으로, 저장 완료 표시 뒤의 강제 종료는 TC-111이 자동으로 확인했다(통과). 이 TC는 실제 운영체제 파일 시스템에서의 확인이다.
- TC-155: 퓨즈는 포장 단계에서 포장된 실행 파일에만 적용되어 개발 실행과 Playwright(`out/`)로는 볼 수 없다. 설정은 `app/electron-builder.yml`의 `electronFuses`(세 값 false)이고 electron-builder 26.18.0이 이 설정을 지원함을 정적으로 확인했다. 지원 여부 때문에 `면제`할 사유는 없다.

이전 판 기준 (2026-11-05, 참고용이며 이번 결과가 아니다):
- TC-131: 사용자가 포장된 일정관리.exe(C:/Users/cho/kanban-package/win-unpacked)로 직접 확인, 확인자 chr0812. 당시 기본 판은 어두운 판이었다.
- TC-132: 사용자가 포장된 일정관리.exe로 직접 확인. Chromium 자체 요청의 넷로그(`--log-net-log`)는 별도로 보지 않았다.
- TC-133: 오케스트레이터가 포장 결과를 읽기 전용으로 확인(SUIT-LICENSE.txt 4,380바이트와 app.asar 안 SUIT-Variable-*.woff2)한 결과를 사용자가 인정. 네트워크를 끊고 글꼴 모양을 눈으로 보는 절차는 하지 않았다.
- TC-134: 사용자가 포장된 일정관리.exe로 직접 확인.
- TC-155: 오케스트레이터가 포장된 일정관리.exe의 퓨즈 값을 @electron/fuses로 읽어 확인(RunAsNode, EnableNodeOptionsEnvironmentVariable, EnableNodeCliInspectArguments 모두 Disabled)한 결과를 사용자가 인정. 환경 변수·`--inspect` 인자로 실행해 포트를 보는 절차는 하지 않았다.

참고(수동 TC 아님, 07이 "인수 단계의 사람 확인이 맡는다"고 한 부분): 명세 v4의 날짜 입력칸은 브라우저가 그리는 달력 팝업을 자동 시험이 열지 못한다. 앱(포장 또는 `npm run dev`, 임시 `--user-data-dir`)에서 (a) 카드 만들기·수정 대화상자의 마감일 칸에서 달력 아이콘을 눌러 팝업이 열리고 날짜를 골라 칸에 들어가는지, 직접 숫자를 입력해도 되는지, (b) 캘린더에서 칩을 끌 때 놓을 칸이 눈에 보이게 표시되고 놓으면 그 칸으로 가는지를 눈으로 본다. 두 판(밝은 판, 어두운 판) 모두에서 달력 아이콘이 보이는지도 함께 본다(`tokens.css`가 판마다 `color-scheme`을 둔다).

## 발견 사항

2026-11-09 시험: 마지막 실행(091507)에서 실패한 시나리오는 없다. 아래는 간헐 실패 1건과, 승인된 설계와 코드가 다르거나 시험이 기대 결과를 완전히 확인하지 못하는 곳 가운데 `issues.md`에 아직 없는 것이다. 새 BI 항목으로 올릴지는 오케스트레이터가 정한다(시험자는 `issues.md`를 고치지 않는다). 이전 판 후보 A(TC-093 문구)는 BI-013, B(글꼴 폴더 잔여 파일)는 BI-014로 올라가 있고, C(하네스 `TST-06`)는 해소된 것으로 보인다(탐색 시험 13번).

| 후보 | 유형 제안 | 영향 Task | 내용 | 증거 |
|------|-----------|-----------|------|------|
| A | 코드 결함 또는 시험 결함(원인 미확정, 간헐) | T-042(TC-110 소유). 저장 경로를 따진다면 T-028, T-030 | `build.js test-run` 첫 실행에서 TC-110(`persistence.spec.ts`)이 실패했다. 카드 세 장을 연달아 만드는 중 둘째 카드의 `저장` 뒤 대화상자가 5초(기본 `expect` 제한) 안에 닫히지 않았다. 스크린샷은 사이드바가 `저장 중`이고 대화상자 입력칸이 비활성인 상태로, 오류 안내는 없었다(저장 실패가 아니라 저장이 5초 넘게 끝나지 않은 것). 첫 카드의 저장과 대화상자 닫힘은 약 0.2초 만에 끝났다. 같은 코드로 이어서 한 TC-110 6회 반복과 둘째 `test-run` 전체(85개)는 모두 통과해 재현하지 못했다. 첫 실행은 전체 3.0분, 둘째는 2.5분이고 다른 시험의 시간도 길어(TC-122 6.1초 대 2.2초) 그 시간대에 이 PC가 느렸을 가능성이 있으나, 저장 큐가 멈췄을 가능성도 배제하지 못했다. 두 가능성을 가르지 못했다. 결정: 원인을 조사할지(저장 중 상태가 오래 이어질 수 있는 경로: 임시 파일 쓰기·fsync·이름 바꾸기 재시도), 시험의 대기 시간을 늘릴지, 기록으로 둘지 | 첫 실행: docs/07-test/_evidence/run-20261109-090812.log(`1) tests\browser\persistence.spec.ts:101`, 실패 지점 `support/board-page.ts:111`), docs/07-test/_evidence/test-e2e-20261109-090812/(스크린샷·trace·error-context). trace 타임라인: 둘째 카드의 `저장` 클릭 후 5.02초 대기 뒤 실패. 재실행: docs/07-test/_evidence/run-20261109-091507.log 250행 `ok 61 … TC-110 (3.4s)` |
| B | 설계 결함(경미) | T-024 | `07-test-plan.md` TC-159의 "달력으로 고르든 직접 입력하든 같은 마감일 입력으로 변환된다"는 단위(cli) 수준에서 구분할 입력이 없다(입력칸이 주는 값은 둘 다 같은 형식의 문자열). 시험은 같은 값을 두 번 변환해 비교해 이 문장을 형식적으로만 충족한다. 이 문장의 실제 확인은 TC-165(browser, 값 설정과 키보드 입력)에 있다. 07에서 TC-159의 기대 결과를 "입력칸 값이 마감일 입력으로 변환되고 비움·일부만 채움은 각각 null·오류"로 좁히면 시험과 맞는다 | `docs/05-design/07-test-plan.md` TC-159(676행 근처), `app/tests/cli/model/card-form-state.test.ts` 185~190행 |
| C | 설계 결함(경미) | T-041 | `07-test-plan.md` TC-170 절차는 팝업 안 칩을 "11월 20일 칸"으로 끌어다 놓는다고 하나, 시험 주석에 따르면 팝업이 20일 칸을 덮어 팝업에 가려지지 않은 16일 칸으로도 같은 시도를 한다. 시험은 기대 결과를 모두 단언하고 통과했다. 07의 절차 문장을 현실에 맞게 고치면 된다 | `docs/05-design/07-test-plan.md` TC-170(1220~1227행), `app/tests/browser/calendar-drag.spec.ts` 393~412행 |
| D | 구현 차이(경미) | T-041 등 browser 시험 Task | 시험 지원 파일 `app/tests/browser/support/board-page.ts`가 `06-file-map.md`에 없고(지도에는 `launch-app.ts`, `network-observer.ts`만 있음), 시험 파일의 의존 열에도 안 적혀 있다. 동작에는 영향 없음 | `docs/05-design/06-file-map.md` 301·302행과 시험 파일 표, `app/tests/browser/*.spec.ts`의 `./support/board-page` import |

이미 `issues.md`에 있는 BI-001~BI-017은 다시 올리지 않았다. BI-007(시험 이름·기대값의 `sync` 잔재)은 `change-runner.test.ts`의 TC-145에서 그대로 보인다(`stage: 'sync'`). BI-008은 TC-052의 비고에 적었다.

## 검증 기록

- 2026-11-09 갱신(명세 v4 개선 7건 반영): `build.js test-run`을 두 번 실행했다. 첫 실행(2026-11-09T00:08Z, 증거 090812): suite 실패, TC-110 한 건 실패, 나머지 자동 169개 통과. 둘째 실행(00:15Z, 증거 091507): suite 통과, 자동 170개 모두 통과. 표는 둘째 실행을 기준으로 한다. 둘째를 한 이유는 첫 실행의 실패 원인이 코드 변경이 아니라 간헐 지연으로 보여서이다(근거는 발견 사항 A). 앱 코드·시험은 고치지 않았다. 새 TC-156~TC-175 20개 행을 더했고, 수동 5개(TC-131~134, TC-155) 행은 "통과" 근거였던 2026-11-05 확인이 이전 판 앱 기준이라 표에서 빼고 `사람 확인 목록`으로 옮겼다. 표에는 자동 시나리오만 두는 규칙(역할 지침)에 따른 것이고, 이 때문에 `TST-01`이 수동 5개의 행 없음을 오류로 올린다(정상).
- 2026-11-05 갱신(이전 판): 사람 확인 5건을 면제에서 통과로 바꾸고 요약 집계를 고쳤다(155/155). 앱 코드와 시험 결과는 바꾸지 않았다. 포장 앱은 app/ 밖(C:/Users/cho/kanban-package)에 만들었다. 이 기록은 이전 판 기준이다.
- `node scripts/build.js test-run --json` 둘째 실행: lint passed, build passed, test passed(Vitest 344개), test:e2e passed(Playwright 85개). `docs/_gate/test.json`: `suite: passed`, `perTc: true`, `changedDuring: false`. 시험 계획의 TC 175개 중 자동 170개(cli 86, browser 84)가 결과 파일에서 통과, 수동 5개는 `perTc`에서 결과 없음(`null`). 이전 판의 install 단계는 이번 `test.json`에서 `install: passed`.
- Vitest 결과 파일은 TC ID가 붙은 테스트로 86개 TC를, Playwright 결과 파일은 84개 TC를 덮는다. TC-067만 같은 TC의 테스트가 둘이고(Playwright 85개 = 84 TC + 1) 모두 통과했다. TC ID가 없는 보조 테스트도 Vitest에 있고 모두 통과했다.
- `node scripts/gate.js test --no-log`(보고서 작성 뒤): 오류 5 · 경고 0 · 면제 0. 오류는 모두 `TST-01`로 수동 TC-131·132·133·134·155의 결과 행이 표에 없어서이다(수동 확인 전이라 정상이며 사용자 확인 뒤 오케스트레이터가 행을 더하면 해소된다). `TST-02`·`TST-05`(AC 48개 모두 통과한 시나리오 있음)·`TST-09`·`TST-10`과 형식 검사는 오류가 없다. 이전 판에 있던 `TST-06` 오류(BI-012)는 나오지 않는다.
- 시험 뒤 `tasklist`에서 electron 프로세스가 없다. `%APPDATA%\self-canban`은 2026-11-05에 생긴 폴더로 이번 시험이 바꾸지 않았다(요약, 탐색 시험 10번). 시험자는 별도 서버·프로세스를 띄우지 않았다(Playwright가 시험마다 띄우고 닫는 Electron만).
- 2026-11-09: 사용자 확인 뒤 수동 시나리오 5건(TC-131~134, TC-155)을 표에 더하고 요약 집계를 175/175로 고쳤다. 포장본은 app/ 밖(C:/Users/cho/kanban-package-v4)에 만들었고 앱 코드와 자동 시험 결과는 바꾸지 않았다.
- 한계: 포장 결과(`app/release/`)는 만들지 않았다. 수동 TC-131~TC-134·TC-155는 시험자가 확인할 수 없다. 설정을 틀리게 만들어 시험이 실패하는지 보는 확인은 코드 수정 금지 규칙 때문에 하지 못했고, 시험 코드를 읽어 판단했다. 시험 코드 전체를 읽은 것은 아니다(읽은 범위는 탐색 시험). TC-110 간헐 실패의 원인은 가리지 못했다. 이 PC 한 대에서 두 번 돌린 결과이고 다른 환경(느린 디스크, 다른 화면 크기·배율)에서의 값은 확인하지 못했다.
