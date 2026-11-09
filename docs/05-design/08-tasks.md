# 구현 작업 Task

> 작성일: 2026-11-03
> 수정: 2026-11-05 (명세 v4 반영, `검증 기록` 참고)
> 입력: docs/04-spec/spec.md (v4) 요구사항 + docs/05-design/ 의 01-tech-stack.md, 02-data-model.md, 03-api-spec.md, 04-ui-spec.md, 05-architecture.md, 06-file-map.md (141개 파일, Wave 15개), 07-test-plan.md (TC 175개)
> 용도: 순서대로 구현 + 요구사항 커버리지(누락) 검증. 체크박스는 설계 승인 대상이라 구현 중에도 바꾸지 않는다.

이 문서는 `06-file-map.md`의 파일 141개를 개발자가 한 번에 하나씩 끝낼 수 있는 Task 44개로 묶고, 요구사항과 시험 시나리오(TC)를 Task에 연결한다. 새 요구사항 ID, 새 파일, 새 정책을 만들지 않았다. 파일 경로는 `file-map`과 같이 앱 루트 `app/` 기준이다. Task 번호는 처음 정한 T-001~T-042를 바꾸지 않고, 설계 리뷰에서 더한 Task는 T-043부터 이어 붙였다. 그래서 번호 순서와 Wave 순서가 완전히 같지는 않다(Wave 소제목 아래 위치가 실행 순서다).

## 요약

- 총 Task: 44개  |  Wave/Phase: 12개
- 커버리지: FR 14/14 (P0 FR-001~FR-006은 6/6) · SCR 4/4 · NFR 4/4 · UC 11/11
- ⚠️ 누락 경고: 없음
- 담당 시험: 자동 TC 170개(cli 86, browser 84)가 모두 어떤 Task의 `check:`에 한 번씩 들어 있다. 수동 TC 5개(TC-131, TC-132, TC-133, TC-134, TC-155)는 어느 Task에도 넣지 않았다. 구현 단계의 인수 확인(사람이 하는 시험) 대상이다.
- 명세 v4 반영: 새 Task는 없다(T-001~T-044 그대로). 새 TC 20개(TC-156~TC-175)는 시험 파일을 가진 기존 Task의 `check:`에 붙였고, 이미 구현된 파일의 재작업은 해당 Task 줄의 `명세 v4 반영 재작업`에 적었다. 새 시험 파일 `tests/browser/calendar-drag.spec.ts`는 T-041이 맡는다.
- 파일: 141개가 각각 한 Task에 있다. 진입 파일 4개는 스텁을 T-001이 만들고 T-023(preload), T-037(main 진입), T-040(renderer 진입), T-041(index.html)이 완성한다. 그래서 이 4개는 두 Task에 나온다.

구성 원칙:

- **Wave 순서**: Task의 Wave는 `file-map`의 Wave 순서를 따른다. Task는 자기 파일이 의존하는 파일이 모두 같거나 앞선 Wave의 Task에 있도록 놓았다(`deps`는 같거나 앞선 Wave만 가리킨다).
- **시험 파일은 구현과 같은 Task**: `file-map` Wave 13~15의 시험 파일은 시험 대상 구현 파일과 같은 Task에 둔다. TC는 그 동작을 구현하는 Task가 시험 코드와 함께 맡는다. 시험 파일만 만드는 Task는 TC를 맡지 않는다(게이트 REF-12). 시험 이름(testcase)에는 TC ID를 넣는다.
- **시험 지원 파일을 앞으로 당김**: `builders.ts`, `memory-fs.ts`, `fault-fs.ts`(T-007), 고정 데이터 `data-v1.json`·`data-v2.json`(T-015)은 의존이 Wave 3 이하라 `file-map`의 Wave 13보다 앞선 Wave에 둔다. 이 파일들은 TC를 맡지 않는다.
- **앱이 처음 뜨는 시점**: main 조립(T-037)이 끝나면 스텁 renderer로도 Electron 창을 띄울 수 있다. 그래서 스모크 Task T-043이 구동 도우미와 앱 구동·보안 시험(스텁 renderer로 되는 TC)을 먼저 맡는다. 화면 시험의 나머지는 renderer 진입(`main.tsx`)이 완성된 뒤(Wave 12의 T-040, T-041, T-042)에만 돌릴 수 있다.
- **명세 v4 반영 시 새 시험 파일의 배치**: `tests/browser/calendar-drag.spec.ts`를 시험 파일만 만드는 새 Task로 두면 REF-12 경고가 나고(캘린더 끌기를 구현하는 파일은 새로 생기지 않고 T-027·T-033이 이미 갖고 있다), 구현 파일 없이 TC 6개를 앞 Task에서 떼어 가게 된다. 그래서 같은 캘린더 화면 흐름을 시험하는 T-041에 붙였다. T-041은 파일 5개 → 6개(한도 6 이하), TC 22개 → 32개가 된다. 같은 크기의 T-040(TC 31개)과 비슷하다.
- **첫 Task 조건**: T-001이 끝났을 때 `npm ci`, `npm run lint`, `npm run build`(두 `tsc -p ... --noEmit`와 `electron-vite build`), test 명령이 빈 프로젝트에서도 통과해야 한다(`01-tech-stack.md`의 `프로젝트 초기화`). 이후 모든 Task도 lint와 build가 통과한 채로 끝난다.
- **임시 가정 표시**: `file-map`, 아키텍처, UI 설계의 `결정 필요` 항목 가운데 임시 가정이 걸린 Task에는 그 사실을 한 줄로 적었다. 보관한 카드의 삭제(명세 v3 AC-040), 칸 이동·보관·삭제의 낙관적 반영 없음, 읽기 실패 안내 보강은 사용자가 정해 임시 가정이 아니다. 사용자가 정하지 않은 항목(CAND 후보들)은 Task로 만들지 않았다.

## Task 목록 (의존성 순서)

### Wave 1 — 프로젝트 초기화, 공통 상수·타입, 도구 설정
- [ ] **T-001** 프로젝트 초기화: package.json(핀 버전 17개, 스크립트 8개, engines), tsconfig 3개(루트는 에디터용 빈 설정, node·web은 types 명시), electron-vite 설정(preload는 CJS 출력, production build에서만 CSP 메타 태그를 넣는 플러그인), ESLint(src/main/** 에서 node:path만 허용)·Vitest 설정, 네 진입 파일 스텁(index.html에는 CSP를 두지 않는다). npm ci, lint, build, test가 빈 상태에서 통과해야 한다. build 뒤 out/preload/index.cjs 존재를 확인하고, npm ci를 돌린 Node 버전을 기록하고, npm view eslint@10.14.0 engines로 Node 요구를 확인한다. 임시 가정: 앱 이름과 데이터 폴더 상수 APP_DATA_FOLDER의 값은 구현 전에 사용자가 준다(file-map 결정 필요 3). sandbox와 type module의 호환은 첫 Electron 구동(T-043)에서 확인하고 어긋나면 설계 결함으로 보고한다(결정 필요 4)  (covers: NFR-001 / file: package.json, .gitignore, tsconfig.json, tsconfig.node.json, tsconfig.web.json, electron.vite.config.ts, eslint.config.js, vitest.config.ts, src/main/index.ts, src/preload/index.ts, src/renderer/index.html, src/renderer/src/main.tsx / check: -)  deps: 없음
- [ ] **T-002** 공통 상수·타입·저장소 포트: 허용 값 목록과 상수, Result·오류·읽기 실패 타입, Card·ProgressEntry·Settings·저장 파일 타입, FileSystemPort 인터페이스, 저장 파일 이름(임시 파일은 프로세스 아이디 포함 tempFileName)·데이터 폴더 상수 APP_DATA_FOLDER와 path.join 기반 경로 합치기. 명세 v4 반영 재작업: constants.ts의 DEFAULT_THEME를 light로, PRIORITIES를 낮음·중간·높음 순서로, CREATE_STATUSES 추가, types/card.ts의 CardCreateInput에 status? 추가  (covers: FR-001, FR-004, FR-006, FR-008, FR-013, FR-014 / data: DataFile, Card, ProgressEntry, Settings / file: src/shared/constants.ts, src/shared/types/result.ts, src/shared/types/card.ts, src/main/store/file-system-port.ts, src/main/store/data-file-names.ts / check: -)  deps: T-001
- [ ] **T-003** 도구 설정 보강: Prettier 설정. Playwright 화면 시험 설정(playwright.config.ts)은 처음 쓰는 T-043이 만든다  (covers: - / file: prettier.config.js / check: -)  deps: T-001

### Wave 2 — 스타일 자산, 파일 시스템 구현, 공통 UI 기본
- [ ] **T-004** 스타일 자산: 두 판의 색 토큰, SUIT 글꼴 woff2와 라이선스 문구 파일, @font-face와 기본 스타일. 외부 주소로 글꼴을 부르지 않는다. 임시 가정: woff2 확보 방법과 라이선스 원문은 사용자가 정한다(file-map 결정 필요 7). 명세 v4 반영 재작업: tokens.css의 :root를 밝은 판, [data-theme='dark']를 어두운 판으로 뒤집는다(값·토큰 이름 그대로)  (covers: FR-014, NFR-001, NFR-004 / file: src/renderer/src/styles/tokens.css, src/renderer/src/styles/fonts/SUIT-Variable.woff2, src/renderer/src/styles/fonts/SUIT-LICENSE.txt, src/renderer/src/styles/base.css / check: -)  deps: T-001
- [ ] **T-005** FileSystemPort 실제 구현: UTF-8 읽기, 존재 확인, 디스크 반영 쓰기, 덮어쓰기 복사, 덮어쓰기 이름 바꾸기(EPERM·EBUSY·EACCES 일시 오류는 이름 바꾸기 안에서만 짧게 다시 시도, 포트는 그대로), 폴더 만들기. 실제 임시 폴더에서 다섯 동작과 Windows의 이름 바꾸기 덮어쓰기, 일시 오류 재시도를 확인한다  (covers: FR-006, NFR-002 / api: FileSystemPort / file: src/main/store/node-file-system.ts, tests/cli/store/node-file-system.test.ts / check: TC-056, TC-140)  deps: T-002
- [ ] **T-006** 공통 UI 기본: 인라인 SVG 아이콘, 분할 버튼, 라디오 행, 메뉴·팝오버, 공통 스타일(포커스 링, 칩, 버튼, 입력칸). 임시 가정: 아이콘 도형은 직접 작성한다(file-map 결정 필요 7). popover 동작은 Electron 창에서 확인하지 못했다  (covers: FR-002, FR-014, NFR-004 / file: src/renderer/src/common/Icon.tsx, src/renderer/src/common/SegmentedControl.tsx, src/renderer/src/common/RadioRow.tsx, src/renderer/src/common/Menu.tsx, src/renderer/src/common/common.css / check: -)  deps: T-001

### Wave 3 — 규칙 공통 지원과 cli 시험 지원, 날짜·검색 규칙, 문구, 타입, 창 생성·외부 요청 차단
- [ ] **T-007** 규칙 공통 지원과 cli 시험 지원: 규칙 함수 공통 타입·결과 만들기, 카드·문서·시계·아이디 빌더, 메모리 파일 시스템, n번째 호출 실패·중단 주입과 호출 기록을 가진 파일 시스템 대역. 시험 지원 파일이라 담당 TC는 없고 뒤 Task의 시험이 쓴다  (covers: FR-006, NFR-002 / file: src/shared/domain/rule-support.ts, tests/cli/support/builders.ts, tests/cli/support/memory-fs.ts, tests/cli/support/fault-fs.ts / check: -)  deps: T-002
- [ ] **T-008** 날짜 규칙: PC 현지 날짜로 오늘 계산, 마감 지남 판정(당일·완료 카드 제외), 존재하지 않는 날짜 검사(윤년·월말), 날짜 계산  (covers: FR-004, FR-012, UC-001, UC-008 / data: Card / file: src/shared/domain/date-rules.ts, tests/cli/domain/date-rules.test.ts / check: TC-001, TC-002, TC-003, TC-004, TC-005)  deps: T-002
- [ ] **T-009** 검색·필터 조건 판정: 제목 부분 일치(대소문자·앞뒤 공백 무시), 종류·우선순위 조건, 여러 조건은 모두 만족(AND)  (covers: FR-013, UC-010 / file: src/shared/domain/query-filter.ts, tests/cli/domain/query-filter.test.ts / check: TC-029, TC-030, TC-031)  deps: T-002, T-007
- [ ] **T-010** 화면 문구 표: 상태·종류·우선순위·판 이름, 호출 오류 코드·읽기 실패 원인·저장 단계·직전 저장본 상태·수동 절차의 문구. 모든 값에 문구가 있는지 확인한다. 명세 v4 반영 재작업: PRIORITY_LABEL.medium을 보통에서 중간으로, 필터 전체 문구 상수 추가. 명세 v4 반영: 시험 기대값 수정(TC-063)  (covers: FR-001, FR-006, FR-008, FR-013 / file: src/renderer/src/text/labels.ts, tests/cli/text/labels.test.ts / check: TC-063)  deps: T-002
- [ ] **T-011** 화면 함수·저장소 인터페이스 타입: KanbanApi 화면 함수 12개 타입, KanbanStore 인터페이스와 생성 인자 타입  (covers: FR-006, NFR-001 / api: KanbanApi, KanbanStore / file: src/shared/types/api.ts, src/main/store/store-types.ts / check: -)  deps: T-002
- [ ] **T-012** 창 생성과 외부 요청 차단: contextIsolation·nodeIntegration 끔·sandbox 보안 기본값의 BrowserWindow 생성(preload는 out/preload/index.cjs, 경로는 main 진입이 import.meta.dirname으로 만들어 넘김), 렌더러 종료(render-process-gone)·로드 실패(did-fail-load) 때 console.error와 오류 대화상자 후 종료, 앱 번들 폴더의 주소 접두사 밖 요청·이동·새 창·권한 차단, Chromium 자체 요청 완화 후보(구현 첫 구동에서 넷로그로 확인). 임시 가정: sandbox true를 유지한다(file-map 결정 필요 4). 명세 v4 반영 재작업: window-factory.ts의 WINDOW_HEIGHT 800을 920으로(WINDOW_MIN_HEIGHT 700 유지, 5주인 달 스크롤 없음 AC-048)  (covers: NFR-001, FR-005, SCR-003, UC-004 / file: src/main/app/window-factory.ts, src/main/app/network-guard.ts / check: -)  deps: T-002

### Wave 4 — 입력 검증, IPC 계약, 버전 변환, 표시 모델, 공통 UI
- [ ] **T-013** 입력 검증: 제목 필수, 날짜, 상태·종류·우선순위 허용 값, 알 수 없는 필드, 위반을 모아서 돌려주기. TC-010은 카드 만들기 규칙이 필요해 시험 파일(card-rules.test.ts)과 함께 T-020이 맡는다. 명세 v4 반영 재작업: validation.ts의 생성 모드 status 검증(todo·in_progress만 허용, 그 밖은 status / INVALID_VALUE)과 이전 UNKNOWN_FIELD 규칙 제거, validation.test.ts에 TC-156  (covers: FR-001, FR-002, FR-004, FR-007, FR-008, FR-011, UC-001, UC-002 / data: Card, ProgressEntry / file: src/shared/domain/validation.ts, tests/cli/domain/validation.test.ts / check: TC-006, TC-008, TC-009, TC-156)  deps: T-002, T-007, T-008
- [ ] **T-014** IPC 계약: 채널 이름 표 12개, window.kanban 타입 선언. 채널 12개가 api-spec 목록과 같은지 확인한다  (covers: FR-006, NFR-001 / api: IPC 채널 12개 / file: src/shared/ipc-contract.ts, src/renderer/src/env.d.ts, tests/cli/ipc/ipc-contract.test.ts / check: TC-064)  deps: T-011
- [ ] **T-015** 버전 변환 사슬과 고정 데이터: 버전 1에서 2로 올리는 변환(설정 없음은 어두운 판), 변환 사슬, 고정 데이터 data-v1.json·data-v2.json(가짜 카드만). 변환 실패는 원본을 바꾸지 않는다. 명세 v4 반영: 시험 기대값 수정(TC-046, 설정 없음은 밝은 판, v1-to-v2.ts 코드는 DEFAULT_THEME 값을 따라 바뀜)  (covers: FR-006, FR-014, NFR-003 / data: DataFile / file: src/main/store/migrations/v1-to-v2.ts, src/main/store/migrations/index.ts, tests/cli/support/fixtures/data-v1.json, tests/cli/support/fixtures/data-v2.json, tests/cli/migrations/schema-migrations.test.ts / check: TC-045, TC-046)  deps: T-002
- [ ] **T-016** 보드 표시 모델: 칸 나누기, 조건 적용, 칸 건수, 결과 없음 표시값, 표시 순서. 임시 가정: 칸 안 순서는 정렬 정책이 정해지지 않아 orderForDisplay 한 곳에 보드는 만든 순서의 최신이 위, 보관함은 보관한 날 최신이 위로 둔다(04-ui-spec 결정 필요 1). 보드와 보관함 모두 조건 없이 범위 목록을 받아 이 모델이 matchesQuery로 거른다. 명세 v4 반영 재작업: 코드 변경은 없을 수 있다(FilterCounts.total이 이미 범위 전체 수). board-model.test.ts에 TC-162 추가  (covers: FR-003, FR-012, FR-013, SCR-001, UC-003, UC-010 / file: src/renderer/src/model/board-model.ts, tests/cli/model/board-model.test.ts / check: TC-057, TC-058, TC-162)  deps: T-007, T-008, T-009
- [ ] **T-017** 캘린더 표시 모델: 월·주 격자(일요일 시작, 4~6행), 날짜별 묶기, 칸당 칩 3개와 더 보기, 기간 이동. 마감일 없는 카드는 격자에 없다  (covers: FR-004, FR-005, SCR-003, UC-004 / file: src/renderer/src/model/calendar-model.ts, tests/cli/model/calendar-model.test.ts / check: TC-059, TC-060)  deps: T-007, T-008
- [ ] **T-018** 입력·알림 공통 UI: 버튼, 글·여러 줄 입력(라벨·오류 줄), 검색 입력, 저장 실패 알림 줄, 빈 칸·결과 없음 안내  (covers: FR-001, FR-003, FR-006, FR-013 / file: src/renderer/src/common/Button.tsx, src/renderer/src/common/TextFields.tsx, src/renderer/src/common/SearchBox.tsx, src/renderer/src/common/Banner.tsx, src/renderer/src/common/EmptyState.tsx / check: -)  deps: T-006
- [ ] **T-019** 종류 칩·마감 표시: 종류 칩(아이콘+글자, 채움/테두리), 우선순위 표시, 마감일 글자와 마감 지남 모양(삼각형+N일 지남+굵은 테두리). 색 외 구분을 만드는 두 곳  (covers: FR-007, FR-012, NFR-004 / file: src/renderer/src/common/Chips.tsx, src/renderer/src/common/DueText.tsx / check: -)  deps: T-006, T-008, T-010

### Wave 5 — 카드·기록·조회·설정 규칙, 저장 문서 검증, IPC 핸들러·preload, 대화상자·보드·캘린더 조각
- [ ] **T-020** 카드 규칙: 카드 만들기·수정·상태 변경·보관·삭제(삭제 때 기록도 함께, 보관한 카드도 삭제할 수 있다 AC-040), 보관 카드의 수정·상태 변경 거부. TC-020이 보관 카드의 기록 추가 거부를 함께 확인하므로 진행 기록 규칙(T-044)에 의존한다. TC-010의 시험 코드는 이 Task가 card-rules.test.ts에 쓴다. 명세 v4 반영 재작업: card-rules.ts의 createCard가 검증된 입력 status를 새 카드에 쓴다(진행 중으로 만들어도 진행 기록 없음). 명세 v4 반영: 시험 기대값 수정(TC-011)  (covers: FR-001, FR-002, FR-004, FR-007, FR-008, FR-010, FR-011, UC-001, UC-002, UC-007, UC-009 / data: Card, ProgressEntry / api: cards.create, cards.update, cards.changeStatus, cards.archive, cards.delete / file: src/shared/domain/card-rules.ts, tests/cli/domain/card-rules.test.ts / check: TC-007, TC-010, TC-011, TC-012, TC-013, TC-014, TC-015, TC-016, TC-017, TC-018, TC-019, TC-020, TC-021, TC-135)  deps: T-002, T-007, T-008, T-013, T-044
- [ ] **T-021** 조회·설정 규칙: 보드·보관함 범위의 목록·상세 조회, 화면 밝기 설정 조회·전환(설정 없으면 어두운 판, 같은 값은 바뀐 것 없음). 명세 v4 반영: 시험 기대값 수정(TC-027, 설정 없으면 밝은 판, settings-rules.ts 코드는 DEFAULT_THEME 값을 따라 바뀜)  (covers: FR-003, FR-010, FR-013, FR-014, UC-003, UC-007, UC-011 / data: Settings / api: cards.list, cards.get, settings.get, settings.setTheme / file: src/shared/domain/card-queries.ts, src/shared/domain/settings-rules.ts, tests/cli/domain/card-queries.test.ts, tests/cli/domain/settings-rules.test.ts / check: TC-022, TC-023, TC-027, TC-028)  deps: T-007, T-009, T-013
- [ ] **T-022** 저장 문서 검증: 읽은 문서의 모양과 구조 불변식 검사(중복 아이디, 없는 카드를 가리키는 기록, 보관 표시와 상태 어긋남), 설정 없음·목록 밖 판 값은 고치지 않고 거부. 명세 v4 반영: 시험 기대값 수정(TC-033)  (covers: FR-006, FR-014, NFR-002, NFR-003 / data: DataFile / file: src/main/store/data-file-validator.ts, tests/cli/store/data-file-validator.test.ts / check: TC-032, TC-033)  deps: T-007, T-013, T-015
- [ ] **T-023** IPC 핸들러와 preload 완성: 열두 채널 등록, 앱 번들 폴더의 주소 접두사가 아닌 프레임 거절, 예외를 INTERNAL로 돌려주며 채널 이름·message·stack을 console.error로 남김, 처리 중인 요청을 세어 whenIdle 제공(창 닫기 대기), preload의 window.kanban 열두 함수 노출과 초기 판 적기(html이 아직 없으면 MutationObserver). 임시 가정: sandbox true와 type module 호환은 첫 Electron 구동(T-043)에서 확인한다(file-map 결정 필요 4)  (covers: FR-006, NFR-001, NFR-002 / api: IPC 채널 12개, window.kanban / file: src/main/app/ipc-handlers.ts, src/preload/index.ts, tests/cli/ipc/ipc-handlers.test.ts / check: TC-065, TC-066, TC-141, TC-142)  deps: T-001, T-007, T-011, T-014
- [ ] **T-024** 카드 입력칸 값 변환(순수): 입력칸 값을 만들기·수정 값으로 바꾸기, 비운 마감일·우선순위는 null, 제목·마감일 오류를 입력칸 이름과 함께 돌려주기. 명세 v4 반영 재작업: card-form-state.ts에 새 카드 status(FormValues, toCreateInput)와 마감일 입력하다 만 값 플래그·fieldErrors. 명세 v4 반영: 시험 기대값 수정(TC-061, TC-062)  (covers: FR-001, FR-004, FR-008, FR-011, SCR-002, UC-001 / file: src/renderer/src/features/card-dialog/card-form-state.ts, tests/cli/model/card-form-state.test.ts / check: TC-061, TC-062, TC-158, TC-159)  deps: T-007, T-013
- [ ] **T-025** 카드 대화상자 조각: 진행 기록 목록, 진행 기록 입력(빈 내용이면 버튼 비활성), 삭제 확인 바닥 줄(보관한 카드의 보기 전용 모드에서도 나온다 AC-040), 대화상자 스타일  (covers: FR-009, FR-011, SCR-002, UC-006, UC-009 / file: src/renderer/src/features/card-dialog/ProgressLog.tsx, src/renderer/src/features/card-dialog/ProgressInput.tsx, src/renderer/src/features/card-dialog/DeleteConfirmBar.tsx, src/renderer/src/features/card-dialog/card-dialog.css / check: -)  deps: T-010, T-018, T-019
- [ ] **T-026** 보드 조각: 상태 이동 메뉴, 보관 인라인 확인, 마감 지난 카드 요약, 검색·필터 조건 줄(보드와 보관함이 공유), 보드 스타일. 임시 가정: 종류·우선순위 필터는 묶음마다 하나만 고르고 두 묶음은 AND(04-ui-spec 결정 필요 9)  (covers: FR-002, FR-010, FR-012, FR-013, SCR-001, UC-002, UC-007 / file: src/renderer/src/features/board/CardMoveMenu.tsx, src/renderer/src/features/board/ArchiveConfirm.tsx, src/renderer/src/features/board/OverdueSummary.tsx, src/renderer/src/features/board/ConditionBar.tsx, src/renderer/src/features/board/board.css / check: -)  deps: T-006, T-010, T-018, T-019
- [ ] **T-027** 캘린더 조각: 날짜 칸의 카드 칩, 이전·다음·오늘로 이동과 기간 제목, 캘린더 스타일. 임시 가정: 완료 카드는 흐린 제목과 원 안 체크, 캘린더에는 검색·필터를 적용하지 않는다(04-ui-spec 결정 필요 6, 7). 명세 v4 반영 재작업: CalendarChip.tsx에 끌기(draggable, CHIP_DRAG_TYPE, onDragStart, 팝업 변형은 끌기 없음), calendar.css에 끌리는 칩 투명도 50%와 놓을 수 있는 칸의 점선 윤곽  (covers: FR-005, SCR-003, UC-004 / file: src/renderer/src/features/calendar/CalendarChip.tsx, src/renderer/src/features/calendar/PeriodNav.tsx, src/renderer/src/features/calendar/calendar.css / check: -)  deps: T-006, T-008, T-010, T-017, T-018
- [ ] **T-044** 진행 기록 규칙: 진행 기록 추가(남긴 순서, 남긴 때의 카드 상태, 빈 내용 거부, 보관 카드에는 거부). 시험은 카드 상태를 시험 데이터로 준비해 카드 규칙 함수에 의존하지 않는다. 설계 리뷰(FE-005)에서 T-020에서 나눈 Task다  (covers: FR-009, UC-006 / data: ProgressEntry / api: progress.add / file: src/shared/domain/progress-rules.ts, tests/cli/domain/progress-rules.test.ts / check: TC-024, TC-025, TC-026)  deps: T-002, T-007, T-013

### Wave 6 — 저장 절차
- [ ] **T-028** 저장 네 단계: 임시 파일 쓰기와 디스크 반영(한 호출, 파일 이름에 프로세스 아이디), 검증, 직전본 복사, 교체. 단계별 실패는 SAVE_FAILED와 단계 이름을 돌려주고 본 파일은 그대로다. 다른 실행의 남은 임시 파일은 건드리지 않는다  (covers: FR-006, NFR-002, NFR-003 / data: DataFile / file: src/main/store/data-file-save.ts, tests/cli/store/data-file-save.test.ts / check: TC-034, TC-035, TC-137, TC-138)  deps: T-002, T-007, T-022

### Wave 7 — 저장소 읽기
- [ ] **T-029** 저장소 읽기와 읽기 실패 분류: 본 파일, 직전 저장본, 처음 실행 순서, 임시 파일은 읽지 않음, 여섯 가지 읽기 실패 원인과 읽지 못한 파일 경로·직전 저장본의 경로와 상태·변환 전 사본 경로, 더 새로운 버전 거부, 읽기만으로는 어떤 파일도 쓰지 않음. TC-036의 시험 코드(변환 전 원본 복사)는 저장소를 여는 절차가 필요해 이 Task가 data-file-repository.test.ts에 쓴다. 명세 v4 반영: 시험 기대값 수정(TC-037, 처음 실행의 빈 문서 설정은 밝은 판, data-file-repository.ts 코드는 DEFAULT_THEME 값을 따라 바뀜)  (covers: FR-006, FR-014, NFR-002, NFR-003, UC-005 / data: DataFile / api: StoreStatus / file: src/main/store/data-file-repository.ts, tests/cli/store/data-file-repository.test.ts / check: TC-036, TC-037, TC-038, TC-039, TC-040, TC-041, TC-042, TC-043, TC-044, TC-139)  deps: T-007, T-015, T-022, T-028

### Wave 8 — 저장소 본체, 앱 상태, 상단 막대·읽기 실패, 캘린더 화면
- [ ] **T-030** KanbanStore 본체: 상태 관리, 변경을 한 줄로 차례대로 저장, 메모리 문서, 열두 화면 함수 구현, 바뀐 것 없는 호출은 저장 안 함, 보관한 카드의 삭제를 막지 않음(AC-040), 읽기 실패 잠금(STORE_LOCKED)과 다시 읽기, close. 파일이 300줄에 가까워 넘기면 한 줄 처리 부분을 별도 파일로 뺀다. 구현 파일이 하나뿐이라 시험 파일만 따로 맡는 Task로 나누지 않았다(결정 필요 3). 명세 v4 반영: kanban-store.ts 코드 변경은 없다(생성 입력의 status와 { dueDate } 수정은 규칙 함수가 처리). 시험만 추가·수정한다(kanban-store.test.ts에 TC-157, TC-160, kanban-store-faults.test.ts의 TC-051 기대값 수정)  (covers: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-009, FR-010, FR-011, FR-014, NFR-002, UC-001, UC-002, UC-004, UC-005, UC-009, UC-011 / data: DataFile, Card, ProgressEntry, Settings / api: KanbanStore 열두 화면 함수 / file: src/main/store/kanban-store.ts, tests/cli/store/kanban-store.test.ts, tests/cli/store/kanban-store-faults.test.ts, tests/cli/store/kanban-store-locked.test.ts / check: TC-047, TC-048, TC-049, TC-050, TC-051, TC-052, TC-053, TC-054, TC-055, TC-136, TC-157, TC-160)  deps: T-007, T-011, T-020, T-021, T-029, T-044
- [ ] **T-031** 앱 상태와 변경 실행기: DataState·UiState·SaveState 모양과 reducer, Context와 훅, 변경 실행기. 변경 호출은 쌓지 않고 즉시 보내 결과를 기다린다. 칸 이동·보관·삭제·만들기·수정·기록 추가는 저장 성공 뒤에만 화면 사본을 바꾸고(낙관적 반영 없음), 판 전환만 낙관적이다. SAVE_FAILED면 화면이 그대로이고 다시 저장은 실패한 요청 한 건을 그대로 다시 보낸다. 변경 실행기는 KanbanApi를 인자로 받는 순수 함수(createChangeRunner)로 두어 가짜 KanbanApi로 시험한다. reducer와 변경 실행기의 cli 시험(FE-006)을 이 Task가 쓰고 tsconfig.web.json이 검사한다. 파일이 300줄에 가까워 넘기면 오류 매핑 부분을 뺀다. 명세 v4 반영 재작업: reducers.ts의 DataState 초기 theme을 DEFAULT_THEME(light)로, state-types.ts의 ChangeRequest에 moveDueDate 추가, change-runner.ts에 moveDueDate(id, dueDate) 구현(cards.update(id, { dueDate }), 성공 뒤에만 화면 사본 변경)과 useChanges() 목록 추가. 명세 v4 반영: 시험 기대값 수정(TC-143, reducers.test.ts)과 TC-161 추가(change-runner.test.ts)  (covers: FR-002, FR-003, FR-005, FR-006, FR-010, FR-011, FR-014, UC-004, UC-005, UC-011 / data: DataState, UiState, SaveState / file: src/renderer/src/state/state-types.ts, src/renderer/src/state/reducers.ts, src/renderer/src/state/app-state.tsx, src/renderer/src/state/change-runner.ts, tests/cli/state/reducers.test.ts, tests/cli/state/change-runner.test.ts / check: TC-143, TC-144, TC-145, TC-146, TC-147, TC-161)  deps: T-002, T-007, T-011, T-014, T-016, T-017
- [ ] **T-032** 상단 막대와 읽기 실패 패널: 화면 제목·검색·카드 만들기 막대, 읽지 못한 파일 경로·오류 문구와 OS 코드·직전 저장본 경로와 상태·변환 전 사본 경로·수동 절차 문구와 다시 읽기를 보이는 패널(앱 안 복구 버튼 없음), 레이아웃·읽기 실패 스타일. 읽기 실패 때 조작은 비활성이다  (covers: FR-001, FR-006, FR-013, SCR-001, UC-005 / file: src/renderer/src/layout/TopBar.tsx, src/renderer/src/features/load-error/ReadFailurePanel.tsx, src/renderer/src/layout/layout.css, src/renderer/src/features/load-error/load-error.css / check: -)  deps: T-006, T-010, T-018, T-031
- [ ] **T-033** 캘린더 화면 조립: 날짜 칸(칩 3개와 더 보기), 더 보기 팝업, 월 격자, 주 한 줄, 캘린더 화면 본문(빈 안내, 범례). 월·주 전환 버튼과 기간 이동·상단 막대·하단 줄은 앱 껍데기(T-039)가 그린다. 현재 구현이 자체 막대·하단 줄을 그리는 부분은 구현 단계에서 이 Task를 재작업해 AppShell로 옮긴다. 명세 v4 반영 재작업: DayCell.tsx에 dragover 표시와 drop → onDropCard(cardId, date), MonthGrid.tsx·WeekGrid.tsx에 끌기 props 전달, DayPopover.tsx의 칩을 끌 수 없게(variant popover), CalendarScreen.tsx에 끌리는 카드 id 지역 상태와 onDropCard(같은 날짜·칸 밖은 무동작, 아니면 moveDueDate). CalendarScreen.tsx는 06 file-map에서 ChangeRunner 의존 때문에 Wave 9 파일이지만 이 Task의 deps가 T-031이라 Task는 Wave 8에 그대로 둔다  (covers: FR-004, FR-005, SCR-003, UC-004 / file: src/renderer/src/features/calendar/DayCell.tsx, src/renderer/src/features/calendar/DayPopover.tsx, src/renderer/src/features/calendar/MonthGrid.tsx, src/renderer/src/features/calendar/WeekGrid.tsx, src/renderer/src/features/calendar/CalendarScreen.tsx / check: -)  deps: T-006, T-008, T-017, T-018, T-027, T-031

### Wave 9 — 보관함·보드 화면, 카드 대화상자, main 진입 완성, 앱 구동 스모크
- [ ] **T-034** 보관함 화면: 보관함 목록 행(행의 삭제 버튼과 인라인 삭제 확인, AC-040), 보관함 화면(보관 범위 목록을 한 번 받아 검색·필터 조건 줄을 재사용해 거르기, 결과 없음·빈 목록 안내, 행의 삭제를 변경 실행기의 deleteCard에 연결), 보관함 스타일. 상단 막대·하단 줄은 앱 껍데기(T-039)가 그린다. 현재 구현이 자체 하단 줄을 그리는 부분은 구현 단계에서 이 Task를 재작업해 AppShell로 옮긴다. 변경 실행기(T-031)에 의존해서 Wave 9에 둔다  (covers: FR-010, FR-011, FR-013, SCR-004, UC-007, UC-009, UC-010 / file: src/renderer/src/features/archive/ArchiveRow.tsx, src/renderer/src/features/archive/ArchiveScreen.tsx, src/renderer/src/features/archive/archive.css / check: -)  deps: T-016, T-018, T-019, T-026, T-031
- [ ] **T-035** 보드 화면 조립: 카드 한 장(끌기, 이동 메뉴, 보관 확인), 칸 하나(머리·건수·놓기·빈 칸 안내), 칸 세 개를 배치한 보드 화면. 놓기·이동·보관은 저장이 성공해야 새 칸으로 바뀐다  (covers: FR-002, FR-003, FR-007, FR-010, FR-012, SCR-001, UC-002, UC-003, UC-008 / file: src/renderer/src/features/board/CardItem.tsx, src/renderer/src/features/board/Column.tsx, src/renderer/src/features/board/BoardScreen.tsx / check: -)  deps: T-008, T-016, T-018, T-019, T-026, T-031
- [ ] **T-036** 카드 대화상자 조립: 카드 입력칸 묶음과 대화상자(dialog 요소: 만들기·수정·보관한 카드 보기 전용, 저장 실패 알림). 보기 전용 모드에는 닫기와 삭제만 있다(AC-040). 입력 중 닫기 경고는 없다(04-ui-spec 결정 필요 5의 임시 가정). Electron 창에서 dialog 동작은 확인하지 못했다. 명세 v4 반영 재작업: CardForm.tsx에 상태 select(새 카드는 할 일·진행 중 두 항목, 잠금 없음), 마감일을 input type="date"로(badInput 감지), 우선순위 분할 버튼 순서(없음, 낮음, 중간, 높음). CardDialog.tsx는 새 카드 상태 선택값을 createCard로 전달  (covers: FR-001, FR-004, FR-007, FR-008, FR-009, FR-010, FR-011, SCR-002, UC-001, UC-006, UC-009 / file: src/renderer/src/features/card-dialog/CardForm.tsx, src/renderer/src/features/card-dialog/CardDialog.tsx / check: -)  deps: T-006, T-018, T-024, T-025, T-031
- [ ] **T-037** main 진입 완성: app.ready 전에 데이터 폴더 고정(--user-data-dir이 없을 때만 APP_DATA_FOLDER, 개발 실행은 -dev 접미사), 저장소·파일 시스템·IPC 핸들러·창 생성·외부 요청 차단 조립(경로는 import.meta.dirname과 path.join, 앱 주소 접두사는 new URL('../renderer/', import.meta.url)), 창 close에서 whenIdle 대기 뒤 닫기, 종료 때 close로 줄 서 있는 저장 기다리기, 프로세스 오류(uncaughtException, unhandledRejection) 처리. 임시 가정: 앱 이름과 APP_DATA_FOLDER 값은 사용자가 준 값을 쓴다(file-map 결정 필요 3)  (covers: FR-006, NFR-001, NFR-002 / file: src/main/index.ts / check: -)  deps: T-002, T-005, T-012, T-023, T-030
- [ ] **T-043** 앱 구동 스모크: 스텁 renderer로 Electron 창을 임시 --user-data-dir로 띄워 main 조립 순서(데이터 폴더 고정, 저장소 열기, 요청 차단, 핸들러 등록, 창 생성)가 동작하고 preload가 out/preload/index.cjs로 불려 열두 함수만 노출되는지 처음 확인한다. Playwright 설정(workers 1, 순차, 제한 시간 30초), 구동 도우미(실패해도 종료 보장, 임시 폴더 정리), 요청 관찰 도우미를 만들고 이 Task부터 test:e2e를 돌린다. 어긋나면 설계 결함으로 보고한다(file-map 결정 필요 4). 이 Task의 시험이 검증하는 구현 Task: T-012, T-023, T-037  (covers: NFR-001 / file: playwright.config.ts, tests/browser/support/launch-app.ts, tests/browser/support/network-observer.ts, tests/browser/app-security.spec.ts / check: TC-129, TC-130, TC-154)  deps: T-001, T-037

### Wave 10 — 사이드바와 판 전환
- [ ] **T-038** 사이드바와 판 전환 연결: data-theme 적용과 판 전환, 사이드바(이동 3항목과 보관함 건수, 종류·우선순위 필터, 화면 밝기 라디오, 저장 상태). 임시 가정: 앱 이름 표시는 이름 상수 한 곳에서 가져온다(file-map 결정 필요 3). 명세 v4 반영 재작업: Sidebar.tsx의 FilterGroup에 맨 위 전체 항목(total 건수, 처음 선택)을 더하고 선택된 항목 재클릭 해제를 없앤다(전체는 undefined), 우선순위 목록은 전체·낮음·중간·높음  (covers: FR-010, FR-013, FR-014, UC-010, UC-011 / file: src/renderer/src/state/theme-controller.ts, src/renderer/src/layout/Sidebar.tsx / check: -)  deps: T-006, T-010, T-016, T-031

### Wave 11 — 앱 껍데기
- [ ] **T-039** 앱 껍데기: 사이드바·상단 막대·본문·하단 줄 배치(막대와 하단 줄은 AppShell이 소유: 캘린더의 기간 이동·월|주 버튼을 상단 막대 children으로 넣고, 하단 줄 문구를 화면별로 정한다), 화면 전환, 읽기 실패 때 패널 표시, 저장 실패 알림 줄(다시 저장). 저장 실패 뒤에도 새 조작을 막지 않는다(칸 이동·보관·삭제는 화면이 저장소와 같아 막을 필요가 없다). 명세 v4 반영 재작업: AppShell.tsx의 saveFailureMessage에 moveDueDate(카드 변경 문구) 추가  (covers: FR-003, FR-005, FR-006, FR-010, SCR-001, SCR-002, SCR-003, SCR-004, UC-004 / file: src/renderer/src/layout/AppShell.tsx / check: -)  deps: T-018, T-031, T-032, T-033, T-034, T-035, T-036, T-038

### Wave 12 — 렌더러 진입 완성과 화면 흐름 E2E
- [ ] **T-040** 렌더러 진입 완성과 보드·카드 대화상자·마감 지남 화면 시험: Bootstrap(시작 순서, 전역 CSS, data-theme 확정, 렌더, 오류 경계)을 완성한다. 이 Task의 E2E가 검증하는 구현 Task: T-016, T-019, T-020, T-024, T-025, T-026, T-035, T-036, T-044, T-039. 가정: user-data-dir이 앱 데이터 폴더에 반영되고 마감일은 실행하는 날 기준으로 계산한다. 보관 카드의 보기 전용 모드 삭제(TC-150)는 보관함 행을 거쳐 열므로 T-034에도 걸린다. 명세 v4 반영: 시험 기대값 수정(TC-067, TC-073, TC-078, TC-080, TC-082)과 TC-163, TC-164 추가(board.spec.ts, card-dialog.spec.ts)  (covers: FR-001, FR-002, FR-003, FR-004, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, NFR-004, SCR-001, SCR-002, UC-001, UC-002, UC-003, UC-005, UC-006, UC-008, UC-009 / file: src/renderer/src/main.tsx, tests/browser/board.spec.ts, tests/browser/card-dialog.spec.ts, tests/browser/overdue.spec.ts / check: TC-067, TC-068, TC-069, TC-070, TC-071, TC-072, TC-073, TC-074, TC-075, TC-076, TC-077, TC-078, TC-079, TC-080, TC-081, TC-082, TC-083, TC-084, TC-085, TC-086, TC-087, TC-088, TC-089, TC-090, TC-102, TC-103, TC-104, TC-150, TC-151, TC-163, TC-164)  deps: T-004, T-014, T-023, T-034, T-037, T-038, T-039, T-043
- [ ] **T-041** index.html 완성과 보관함·캘린더·검색·판 전환 화면 시험: 제목과 루트 요소를 완성한다(CSP는 T-001의 electron.vite.config.ts 플러그인이 production build에만 주입하므로 원본에 두지 않는다). 이 Task의 E2E가 검증하는 구현 Task: T-009, T-021, T-026, T-027, T-033, T-034, T-038, T-016, T-024, T-031, T-036, T-012. 임시 가정: 제목의 앱 이름은 사용자가 준 값이다(file-map 결정 필요 3). 캘린더는 마감일을 실행하는 날 기준으로 계산한다. 명세 v4 반영: 시험 기대값 수정(TC-106, TC-107, TC-121, TC-122)과 새 시험 파일 calendar-drag.spec.ts(TC-165~TC-170, 검증하는 구현 Task에 T-024, T-031, T-036, 창 높이 TC-171의 T-012 추가), calendar.spec.ts에 TC-171, TC-172, search-filter.spec.ts에 TC-174, TC-175 추가  (covers: FR-004, FR-005, FR-006, FR-010, FR-011, FR-013, FR-014, NFR-004, SCR-003, SCR-004, UC-004, UC-007, UC-009, UC-010, UC-011 / file: src/renderer/index.html, tests/browser/archive.spec.ts, tests/browser/calendar.spec.ts, tests/browser/calendar-drag.spec.ts, tests/browser/search-filter.spec.ts, tests/browser/theme.spec.ts / check: TC-091, TC-092, TC-093, TC-094, TC-095, TC-096, TC-097, TC-098, TC-099, TC-100, TC-101, TC-105, TC-106, TC-107, TC-108, TC-109, TC-121, TC-122, TC-123, TC-124, TC-148, TC-149, TC-165, TC-166, TC-167, TC-168, TC-169, TC-170, TC-171, TC-172, TC-174, TC-175)  deps: T-040
- [ ] **T-042** 오프라인·데이터 보존·실패 경로 화면 시험과 포장 설정: 재시작·강제 종료·변경 직후 창 닫기·이전 버전 파일·판 유지, 저장 실패, 읽기 실패, 외부 요청 0건과 오프라인·글꼴 로드의 화면 시험과 electron-builder 설정(publish 없음, 서명 안 함, 포장 퓨즈는 지원되는 경우에만). 이 Task의 E2E가 검증하는 구현 Task: T-005, T-015, T-022, T-028, T-029, T-030, T-031, T-032, T-037, T-012, T-004. 임시 가정: 저장 실패는 유효한 저장 파일 옆에 kanban-data.json.bak 폴더를 만들어 직전본 복사 단계를 실패시켜 유도하며 Windows에서 실제로 되는지는 확인하지 못했다(안 되면 해당 TC를 cli의 대역으로 옮기는 것을 보고한다). 앱 이름과 앱 아이콘은 미정이다(결정 필요 3, 7). 명세 v4 반영: 시험 기대값 수정(TC-112, TC-113, TC-116)과 TC-173 추가(save-failure.spec.ts, 캘린더 끌기 저장 실패)  (covers: FR-001, FR-002, FR-003, FR-005, FR-006, FR-010, FR-011, FR-014, NFR-001, NFR-002, NFR-003, UC-004, UC-005, UC-011 / file: electron-builder.yml, tests/browser/offline.spec.ts, tests/browser/persistence.spec.ts, tests/browser/save-failure.spec.ts, tests/browser/read-failure.spec.ts / check: TC-110, TC-111, TC-112, TC-113, TC-114, TC-115, TC-116, TC-117, TC-118, TC-119, TC-120, TC-125, TC-126, TC-127, TC-128, TC-152, TC-153, TC-173)  deps: T-015, T-040

## 요구사항 커버리지 점검표

> 모든 P0 요구사항이 최소 1개 Task에 매핑되어야 함. (없음 = ⚠️ 누락)
> 유형은 기능 요구사항(FR)의 우선순위다. SCR, NFR, UC는 `-`로 둔다.

| 요구사항 | 유형 | 커버 Task | 상태 |
|---------|------|----------|------|
| FR-001 | P0 | T-002, T-010, T-013, T-018, T-020, T-024, T-030, T-032, T-036, T-040, T-042 | ✅ |
| FR-002 | P0 | T-006, T-013, T-020, T-026, T-030, T-031, T-035, T-040, T-042 | ✅ |
| FR-003 | P0 | T-016, T-018, T-021, T-030, T-031, T-035, T-039, T-040, T-042 | ✅ |
| FR-004 | P0 | T-002, T-008, T-013, T-017, T-020, T-024, T-030, T-033, T-036, T-040, T-041 | ✅ |
| FR-005 | P0 | T-012, T-017, T-027, T-030, T-031, T-033, T-039, T-041, T-042 | ✅ |
| FR-006 | P0 | T-002, T-005, T-007, T-010, T-011, T-014, T-015, T-018, T-022, T-023, T-028, T-029, T-030, T-031, T-032, T-037, T-039, T-040, T-041, T-042 | ✅ |
| FR-007 | P1 | T-013, T-019, T-020, T-035, T-036, T-040 | ✅ |
| FR-008 | P1 | T-002, T-010, T-013, T-020, T-024, T-036, T-040 | ✅ |
| FR-009 | P1 | T-025, T-044, T-030, T-036, T-040 | ✅ |
| FR-010 | P1 | T-020, T-021, T-026, T-030, T-031, T-034, T-035, T-036, T-038, T-039, T-040, T-041, T-042 | ✅ |
| FR-011 | P1 | T-013, T-020, T-024, T-025, T-030, T-031, T-034, T-036, T-040, T-041, T-042 | ✅ |
| FR-012 | P1 | T-008, T-016, T-019, T-026, T-035, T-040 | ✅ |
| FR-013 | P1 | T-002, T-009, T-010, T-016, T-018, T-021, T-026, T-032, T-034, T-038, T-041 | ✅ |
| FR-014 | P1 | T-002, T-004, T-006, T-015, T-021, T-022, T-029, T-030, T-031, T-038, T-041, T-042 | ✅ |
| SCR-001 | - | T-016, T-026, T-032, T-035, T-039, T-040 | ✅ |
| SCR-002 | - | T-024, T-025, T-036, T-039, T-040 | ✅ |
| SCR-003 | - | T-012, T-017, T-027, T-033, T-039, T-041 | ✅ |
| SCR-004 | - | T-034, T-039, T-041 | ✅ |
| NFR-001 | - | T-001, T-004, T-011, T-012, T-014, T-023, T-037, T-043, T-042 | ✅ |
| NFR-002 | - | T-005, T-007, T-022, T-023, T-028, T-029, T-030, T-037, T-042 | ✅ |
| NFR-003 | - | T-015, T-022, T-028, T-029, T-042 | ✅ |
| NFR-004 | - | T-004, T-006, T-019, T-040, T-041 | ✅ |
| UC-001 | - | T-008, T-013, T-020, T-024, T-030, T-036, T-040 | ✅ |
| UC-002 | - | T-013, T-020, T-026, T-030, T-035, T-040 | ✅ |
| UC-003 | - | T-016, T-021, T-035, T-040 | ✅ |
| UC-004 | - | T-012, T-017, T-027, T-030, T-031, T-033, T-039, T-041, T-042 | ✅ |
| UC-005 | - | T-029, T-030, T-031, T-032, T-040, T-042 | ✅ |
| UC-006 | - | T-025, T-044, T-036, T-040 | ✅ |
| UC-007 | - | T-020, T-021, T-026, T-034, T-041 | ✅ |
| UC-008 | - | T-008, T-035, T-040 | ✅ |
| UC-009 | - | T-020, T-025, T-030, T-034, T-036, T-040, T-041 | ✅ |
| UC-010 | - | T-009, T-016, T-034, T-038, T-041 | ✅ |
| UC-011 | - | T-021, T-030, T-031, T-038, T-041, T-042 | ✅ |

- `check:` = 그 Task가 테스트 코드로 함께 구현할 시험 시나리오(`07-test-plan.md`의 TC). 담당 TC가 없으면 `check: -`. `manual`이 아닌 TC는 모두 어떤 Task에 있다.
- 체크박스는 설계에서 `- [ ]`로 두고 구현 중에도 바꾸지 않는다 (설계 승인 해시 대상).

### 담당 시험 배분

| 구분 | TC | 담당 Task |
|------|----|-----------|
| cli 단위·통합 86개 | TC-001~TC-066, TC-135~TC-147, TC-156~TC-162 | T-005, T-008, T-009, T-010, T-013, T-014, T-015, T-016, T-017, T-020, T-021, T-022, T-023, T-024, T-028, T-029, T-030, T-031, T-044 |
| browser E2E 84개 | TC-067~TC-130, TC-148~TC-154, TC-163~TC-175 | T-043 (3개), T-040 (31개), T-041 (32개), T-042 (18개) |
| 수동 5개 | TC-131~TC-134, TC-155 | 어느 Task에도 넣지 않음. 구현 단계의 인수 확인 대상 |

### ⚠️ 누락 항목

- 없음. 모든 FR, SCR, NFR, UC가 1개 이상의 Task에 있다.

## 검증 기록

- 설계 결함 수정(BI-003, 구현 중 보고): 저장 단계에서 `sync`를 따로 두지 않고 `write_temp`에 포함해 `write_temp`, `verify`, `backup`, `replace` 네 단계로 고쳤다(`writeFileSynced` 한 호출이 쓰기와 fsync를 함께 한다). 저장 단계 수만 5에서 4로 바뀌었고 파일·컴포넌트·Wave·TC·인터페이스 수는 그대로다.
- 설계 결함 수정(BI-004, 구현 중 보고): 상단 막대(`TopBar`)와 하단 줄의 소유자를 `AppShell`로 분명히 했다. 세 화면 컴포넌트는 막대·하단 줄을 그리지 않고, 캘린더의 `PeriodNav`와 `월 | 주` 버튼은 `AppShell`이 `TopBar`의 children으로 넣는다. 파일·컴포넌트·Wave·TC 수는 그대로다.
- 게이트 `node scripts/gate.js design --skip REV`(리뷰 기록 규칙 REV 제외)를 이 PC에서 실행했고 오류 0 · 경고 0이었다. 이 줄을 쓴 뒤 다시 실행해 같은 결과를 확인했다.
- Task 수: T-001~T-044 연속 44개, Wave 12개. `요약`의 총 Task와 같다.
- 파일 배정: `file-map`의 파일 141개(구현·설정·자산 98, 시험 지원 7, cli 시험 23, browser 시험 13)가 각각 한 Task의 `file:`에 있다. 스텁 완성 4건(`src/preload/index.ts`, `src/main/index.ts`, `src/renderer/src/main.tsx`, `src/renderer/index.html`)만 두 Task에 나온다.
- 담당 시험: cli 86개와 browser 84개, 합 170개가 `check:`에 한 번씩 있다(cli 시험 파일 23개, browser 시험 파일 13개 모두 한 Task에 있다). 시험 파일만 만드는 Task는 없다(시험 지원 Task T-007은 `check: -`이고, T-043·T-040~T-042는 구현 파일 하나 이상을 가진다).
- 의존: 모든 `deps`는 같거나 앞선 Wave의 Task를 가리키고, 각 Task 파일의 `file-map` 의존 파일이 `deps` 또는 같은 Task 안에 있다. 순환은 없다.
- 요구사항: `covers`의 ID는 모두 `spec.md`의 FR-001~FR-014, SCR-001~SCR-004, NFR-001~NFR-004, UC-001~UC-011이다. 점검표의 커버 Task는 각 Task의 `covers`를 거꾸로 모은 것이다. 각 Task가 맡은 TC의 근거(AC의 FR, UC, NFR)는 그 Task의 `covers`에 모두 들어 있다. P0 FR 6개 모두 1개 이상의 Task에 있다.
- 사용자가 정하지 않은 항목(CAND 후보들)은 Task로 만들지 않았다. 임시 가정이 걸린 Task에는 그 사실을 적었다.
- 2026-11-05, 명세 v4 반영: 새 Task 없이 T-001~T-044를 유지했다(ID·deps·Wave·체크박스 불변). 새 TC 20개(cli TC-156~TC-162, browser TC-163~TC-175)를 시험 파일을 가진 Task의 `check:`에 붙였다(T-013 1, T-016 1, T-024 2, T-030 2, T-031 1, T-040 2, T-041 10, T-042 1). `tests/browser/calendar-drag.spec.ts`는 T-041에 붙였다(시험만 만드는 새 Task는 REF-12 경고). 기대 결과를 바꾼 기존 TC 23개는 담당 Task 줄에 `명세 v4 반영: 시험 기대값 수정`으로 표시했다(T-010, T-015, T-020, T-021, T-022, T-024, T-029, T-030, T-031, T-040, T-041, T-042). 이미 구현된 코드의 재작업은 T-002, T-004, T-010, T-012, T-013, T-020, T-024, T-027, T-031, T-033, T-036, T-038, T-039 줄에 `명세 v4 반영 재작업`으로 적었다. 새 AC의 FR·UC가 빠진 Task에는 `covers`를 보태고 점검표를 다시 만들었다(새 AC 8개 포함 AC 48개의 FR·UC·NFR이 모두 Task에 있고, 자동 TC 170개가 모두 Task의 `check:`에 있다). TC-131은 수동이라 Task가 없다.
- 2026-11-05, 명세 v4 반영 뒤 게이트 `node scripts/gate.js design`(내용 검사)을 이 PC에서 실행해 오류 0 · 경고 0이었다.
- 승인 여부나 진행 상태를 적지 않았다.

## 결정 필요

설계 문서끼리 어긋나거나 이 문서가 정하지 못한 것이다. 사용자가 정해야 하는 정책은 각 설계 문서의 `결정 필요`와 `README.md`의 미해결 사항에 있다.

| 번호 | 항목 | 지금 이 문서의 배치 | 선택지 | 권고 |
|------|------|--------------------|--------|------|
| 1 | 기능별 CSS 5개(`board.css`, `card-dialog.css`, `calendar.css`, `archive.css`, `load-error.css`)를 누가 import하는지 `file-map`에 없다. `main.tsx`는 전역 CSS 4개만 import한다 | 각 CSS를 그 화면의 첫 Task(T-026, T-025, T-027, T-034, T-032)에 두었다. 화면 컴포넌트가 직접 import하는 것으로 구현 때 정한다 | (a) 화면 컴포넌트가 import (b) `main.tsx`가 import (파일 맵 의존 변경) | (a) |
| 2 | E2E를 더 잘게 나누고 싶어도 시험 파일만 만드는 Task가 TC를 맡을 수 없다(게이트 REF-12). 구현 파일이 있는 Task는 renderer 진입(T-040), `index.html`(T-041), 포장 설정(T-042), 구동 스모크(T-043)뿐이다 | browser TC 84개를 T-043(3개), T-040(31개), T-041(32개), T-042(18개)로 나눴다. 화면 흐름 기준(T-040 보드·대화상자, T-041 보관함·캘린더·캘린더 끌기·검색·판 전환, T-042 오프라인·보존·실패 경로). 명세 v4로 T-041이 TC 32개·파일 6개로 가장 커졌다 | (a) 지금 배치 (b) 구현 단계에서 더 잘게 나눈다 (구현 파일이 있는 Task를 늘리면 파일 맵 변경이 필요하고, 시험만 만드는 Task는 REF-12 경고가 난다) | (a) |
| 3 | T-030(`kanban-store.ts`와 시험 파일 3개)과 T-031(상태 파일 4개와 시험 파일 2개)은 크지만 나누지 않았다. 구현 파일 하나를 더 쪼개려면 큐 파일 같은 새 파일이 필요한데 이 설계는 파일 수를 늘리지 않았고, 시험 파일만 따로 맡는 Task는 TC를 맡을 수 없다(REF-12) | 한 Task로 둔다. `kanban-store.ts`가 300줄에 가까우면 구현 중에 한 줄 처리 부분을 별도 파일로 빼는 방법을 파일 명세에 적어 두었다 | (a) 지금 배치 (b) 큐 파일을 파일 맵에 더해 T-030을 둘로 나눈다 (설계 승인 문서 변경) | (a) |

## 변경 이력

| 판 | 날짜 | 내용 | 삭제 ID |
|----|------|------|---------|
| 1 | 2026-11-03 | 최초 작성. T-001~T-042 | - |
| 2 | 2026-11-03 | 설계 리뷰와 사용자 결정(D1~D3) 반영. T-043(앱 구동 스모크), T-044(진행 기록 규칙, T-020에서 나눔) 추가. T-034를 Wave 9로 옮기고 변경 실행기에 의존. T-031에 reducer·변경 실행기 시험(FE-006) 추가. T-040~T-042의 TC·시험 파일 재배분 | - |
| 3 | 2026-11-04 | 구현 중 설계 결함 수정 BI-003(저장 단계에서 `sync` 제거, 네 단계), BI-004(상단 막대·하단 줄은 AppShell 소유). 새 ID와 번호 변경 없음 | - |
| 4 | 2026-11-05 | 명세 v4 반영. 새 Task 없음. TC-156~TC-175를 담당 Task의 `check:`에 추가, `calendar-drag.spec.ts`는 T-041, 재작업 대상 Task에 `명세 v4 반영 재작업` 표시, `covers`·점검표·수치 갱신(파일 141, TC 175, 자동 170). 기존 Task ID·deps·Wave 불변 | - |
