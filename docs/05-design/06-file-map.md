# File Map

> 작성일: 2026-11-03
> 수정: 2026-11-05 (명세 v4 반영, `검증 기록` 참고)
> 입력: docs/04-spec/spec.md (v4), docs/05-design/01-tech-stack.md (후보 A: Electron + React + TypeScript, 코드는 `app/` 안에만), docs/05-design/02-data-model.md, docs/05-design/03-api-spec.md, docs/05-design/04-ui-spec.md, docs/05-design/05-architecture.md (컴포넌트 31개, ADR 13개)

이 문서는 아키텍처의 컴포넌트 31개를 구현 파일로 바꾸고, 의존성 순서(Wave)와 시험 파일 계획을 정한다. 새 요구사항 ID, 새 npm 패키지, 새 정책을 만들지 않았다. 시험 시나리오 ID(TC)는 `07-test-plan.md`가 정하므로 여기서는 시험 파일이 어느 FR/AC/NFR 범주를 맡는지만 적는다.

읽는 법:

- **경로 기준**: 이 문서의 모든 경로는 앱 루트 `app/`를 기준으로 한 상대 경로다 (`package.json`은 `app/package.json`). 명령도 `app/`에서 실행한다 (`01-tech-stack.md`의 `명령`). `../`, 절대 경로, `node_modules/`, `.git/`는 쓰지 않았다.
- **컴포넌트와 파일의 대응**: 컴포넌트마다 파일 하나, 또는 파일 묶음 하나를 둔다. 묶음이 되는 경우는 두 가지뿐이다. (1) `04-ui-spec.md`의 컴포넌트 트리가 화면 아래 하위 컴포넌트를 이미 나열한 경우, (2) 한 파일이 300줄을 넘을 것으로 보여 책임 단위로 나눈 경우. 모든 파일은 소유 컴포넌트가 하나이고, 컴포넌트 31개는 모두 파일이 있다. 컴포넌트에 속하지 않는 파일은 `초기화`(설정 파일), `시험 지원`, `시험`으로 표시했다.
- **진입 파일 스텁**: `01-tech-stack.md`의 첫 Task 조건(두 `tsc -p ... --noEmit`, `eslint .`, `electron-vite build`가 빈 프로젝트에서도 통과)을 맞추려고 Wave 1에 네 진입 파일(`src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`)을 비어 있는 상태(스텁)로 둔다. 같은 파일을 뒤 Wave에서 완성한다 (`수정(스텁 완성)`). 파일 수에는 한 번만 센다.
- **시험 파일 위치**: 시험 파일은 `tests/` 아래에 모았다 (`tests/cli`는 Vitest, `tests/browser`는 Playwright Electron). 각 시험 파일의 대상은 앞 Wave에 있으므로, `08-tasks.md`는 시험 파일을 대상 구현 파일과 같은 Task에 묶어도 의존 순서가 깨지지 않는다.

## 생성 계획 요약

- 총 파일 수: 141개 (구현·설정·자산 98개, 시험 지원 7개, cli 시험 23개, browser 시험 13개)
- Wave 수: 15개
- 예상 총 LOC: ~17,800줄 (구현·설정 약 10,250, 시험 지원·시험 약 7,550. 바이너리 글꼴 파일 제외, 라이선스 원문 파일은 길이 미확인 추정. 스텁은 완성본 크기로 한 번만 셈)
- 새 npm 패키지: 없음 (`package.json`은 `01-tech-stack.md`의 `패키지 의존성` 17개 그대로)
- 도구가 만드는 파일(`package-lock.json`, `out/`, `release/`, `reports/`, `test-results/`)은 위 수에 넣지 않았다. 아래 `도구가 만드는 파일`.

Wave 한눈에 보기:

| Wave | 내용 | 파일 수 |
|------|------|---------|
| 1 | 프로젝트 초기화, 진입 파일 스텁, 상수, 의존 없는 모듈, 글꼴·토큰 | 23 |
| 2 | 카드 타입, 정적 스타일, 파일 시스템 구현, 의존 없는 공통 UI | 14 |
| 3 | API 타입, 날짜 규칙, 검색 조건, 문구, 저장소 인터페이스, 창 생성, 공통 UI 1차 | 10 |
| 4 | 검증, IPC 계약, 표시 모델, 마이그레이션 사슬, 공통 UI 2차 | 11 |
| 5 | 카드·기록·설정 규칙, 저장 파일 검증, IPC 핸들러, preload 완성, 화면 조각 | 18 |
| 6 | 저장 절차, 상태 reducer, 카드 항목, 카드 입력 폼, 날짜 칸 | 6 |
| 7 | 저장소 읽기, 앱 상태, 칸, 월·주 격자 | 5 |
| 8 | 저장소 본체, 변경 실행기, 상단 막대, 읽기 실패 화면 | 4 |
| 9 | 판 전환 연결, 보드·캘린더·보관함 화면, 카드 대화상자, main 진입 완성 | 5 |
| 10 | 사이드바 | 1 |
| 11 | 앱 껍데기 | 1 |
| 12 | renderer 진입 완성 (Bootstrap, index.html) | 0 |
| 13 | 시험 지원 (대역, 고정 데이터, 앱 구동 도우미) | 7 |
| 14 | cli 시험 (Vitest) | 23 |
| 15 | browser 시험 (Playwright Electron) | 13 |

## 컴포넌트와 파일 대응

아키텍처의 컴포넌트 31개가 어느 파일(들)이 되는지의 표다. 소유 컴포넌트가 없는 구현 파일은 없다.

| 컴포넌트 | 파일 | 비고 |
|----------|------|------|
| SharedTypes | `src/shared/constants.ts`, `src/shared/types/card.ts`, `src/shared/types/result.ts`, `src/shared/types/api.ts` | 타입을 세 파일로 나눔 (한 파일 300줄 초과 방지, 책임: 엔티티와 입력 / 결과와 오류 / 화면 함수) |
| IpcContract | `src/shared/ipc-contract.ts` | |
| DateRules | `src/shared/domain/date-rules.ts` | |
| Validation | `src/shared/domain/validation.ts` | |
| QueryFilter | `src/shared/domain/query-filter.ts` | |
| CardRules | `src/shared/domain/rule-support.ts`, `src/shared/domain/card-rules.ts`, `src/shared/domain/card-queries.ts`, `src/shared/domain/progress-rules.ts`, `src/shared/domain/settings-rules.ts` | 규칙 함수 묶음을 대상별로 나눔 (한 파일 300줄 초과 방지) |
| KanbanStore | `src/main/store/store-types.ts`, `src/main/store/kanban-store.ts` | 인터페이스와 구현을 나눠 IpcHandlers가 구현 없이 인터페이스만 의존 |
| DataFileRepository | `src/main/store/data-file-names.ts`, `src/main/store/data-file-save.ts`, `src/main/store/data-file-repository.ts` | 파일 이름 상수 / 저장 절차 / 읽기와 조립 |
| DataFileValidator | `src/main/store/data-file-validator.ts` | |
| SchemaMigrations | `src/main/store/migrations/index.ts`, `src/main/store/migrations/v1-to-v2.ts` | 변환 함수는 버전별 파일 (한 번 배포한 변환은 지우지 않음) |
| NodeFileSystem | `src/main/store/file-system-port.ts`, `src/main/store/node-file-system.ts` | 포트(인터페이스)와 실제 구현 |
| AppLifecycle | `src/main/index.ts` | 진입점 |
| WindowFactory | `src/main/app/window-factory.ts` | |
| NetworkGuard | `src/main/app/network-guard.ts` | |
| IpcHandlers | `src/main/app/ipc-handlers.ts` | |
| PreloadBridge | `src/preload/index.ts` | 진입점 |
| Bootstrap | `src/renderer/src/main.tsx`, `src/renderer/index.html`, `src/renderer/src/env.d.ts` | 진입점(React 오류 경계 한 개 포함), 뼈대 html(CSP는 production build에서 주입), `window.kanban` 타입 선언 |
| AppState | `src/renderer/src/state/state-types.ts`, `src/renderer/src/state/reducers.ts`, `src/renderer/src/state/app-state.tsx` | 상태 모양 / reducer 세 개 / Context와 훅 |
| ChangeRunner | `src/renderer/src/state/change-runner.ts` | |
| ThemeController | `src/renderer/src/state/theme-controller.ts` | |
| BoardModel | `src/renderer/src/model/board-model.ts` | |
| CalendarModel | `src/renderer/src/model/calendar-model.ts` | |
| AppShell | `src/renderer/src/layout/AppShell.tsx`, `src/renderer/src/layout/Sidebar.tsx`, `src/renderer/src/layout/TopBar.tsx`, `src/renderer/src/layout/layout.css` | Sidebar에 NavList, FilterGroup, ThemeSwitch, SaveStatus를 함께 둠. 상단 막대(`TopBar`)와 하단 줄은 `AppShell`이 소유하고 화면 컴포넌트는 그리지 않음 |
| BoardScreen | `src/renderer/src/features/board/BoardScreen.tsx`, `Column.tsx`, `CardItem.tsx`, `CardMoveMenu.tsx`, `ArchiveConfirm.tsx`, `ConditionBar.tsx`, `OverdueSummary.tsx`, `board.css` | 같은 폴더. `Board`(칸 세 개 배치)는 `BoardScreen.tsx` 안에 둠 |
| CardDialog | `src/renderer/src/features/card-dialog/CardDialog.tsx`, `CardForm.tsx`, `card-form-state.ts`, `ProgressLog.tsx`, `ProgressInput.tsx`, `DeleteConfirmBar.tsx`, `card-dialog.css` | 같은 폴더. `card-form-state.ts`는 입력칸 값과 입력/수정 값의 변환(순수, React 없음) |
| CalendarScreen | `src/renderer/src/features/calendar/CalendarScreen.tsx`, `MonthGrid.tsx`, `WeekGrid.tsx`, `DayCell.tsx`, `CalendarChip.tsx`, `DayPopover.tsx`, `PeriodNav.tsx`, `calendar.css` | 같은 폴더. `CalendarView`는 `CalendarScreen.tsx` 안에 둠. 칩 끌기의 놓기 처리(`onDropCard`)는 `CalendarScreen.tsx`가 소유하고 `ChangeRunner.moveDueDate`를 부름 (ADR-013). 드래그 타입 상수 `CHIP_DRAG_TYPE`은 `CalendarChip.tsx`. `PeriodNav.tsx`는 이 폴더에 두지만 `AppShell`이 `TopBar`의 children으로 넣음 |
| ArchiveScreen | `src/renderer/src/features/archive/ArchiveScreen.tsx`, `ArchiveRow.tsx`, `archive.css` | 같은 폴더. `ArchiveList`는 `ArchiveScreen.tsx` 안에 둠. 행의 `삭제`와 인라인 삭제 확인은 `ArchiveRow.tsx`가 가짐 |
| ReadFailurePanel | `src/renderer/src/features/load-error/ReadFailurePanel.tsx`, `load-error.css` | |
| CommonUi | `src/renderer/src/common/Icon.tsx`, `Button.tsx`, `TextFields.tsx`, `SegmentedControl.tsx`, `RadioRow.tsx`, `Chips.tsx`, `DueText.tsx`, `Banner.tsx`, `Menu.tsx`, `EmptyState.tsx`, `SearchBox.tsx`, `common.css` | 같은 폴더. Button+IconButton, TextInput+TextArea, Chip+KindChip+PriorityMark, Menu+Popover는 각각 한 파일 |
| Labels | `src/renderer/src/text/labels.ts` | |
| Styles | `src/renderer/src/styles/tokens.css`, `base.css`, `fonts/SUIT-Variable.woff2`, `fonts/SUIT-LICENSE.txt` | |

## Directory Structure

> 아래는 디렉토리 경로만 나열한다 (앱 루트 `app/` 기준, `app/` 자체는 생략). 모두 이 문서의 파일 경로에서 뽑았다. 도구가 만드는 폴더(`out/`, `release/`, `reports/`, `test-results/`)는 파일 목록에 없으므로 넣지 않았다.

```
src/
src/shared/
src/shared/types/
src/shared/domain/
src/main/
src/main/store/
src/main/store/migrations/
src/main/app/
src/preload/
src/renderer/
src/renderer/src/
src/renderer/src/state/
src/renderer/src/model/
src/renderer/src/text/
src/renderer/src/styles/
src/renderer/src/styles/fonts/
src/renderer/src/common/
src/renderer/src/layout/
src/renderer/src/features/
src/renderer/src/features/board/
src/renderer/src/features/card-dialog/
src/renderer/src/features/calendar/
src/renderer/src/features/archive/
src/renderer/src/features/load-error/
tests/
tests/cli/
tests/cli/domain/
tests/cli/store/
tests/cli/migrations/
tests/cli/model/
tests/cli/state/
tests/cli/text/
tests/cli/ipc/
tests/cli/support/
tests/cli/support/fixtures/
tests/browser/
tests/browser/support/
```

## Wave 별 생성 순서

> 규칙: 각 파일은 앞 Wave에 있는 파일에만 의존한다 (같은 Wave 안의 의존 없음). 한 Wave 안의 파일은 병렬로 만들 수 있다. `의존` 열은 이 프로젝트의 파일만 적었다 (npm 패키지는 `package.json`이 정한다). 예상 LOC는 추정이다.

### Wave 1: 프로젝트 초기화와 의존 없는 모듈

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `package.json` | 신규 | 스크립트, 핀 버전 의존성, `main`, `engines` | - | ~50 |
| `.gitignore` | 신규 | 도구 산출물 제외 | - | ~8 |
| `tsconfig.json` | 신규 | 루트(에디터용, `files: []`) | - | ~5 |
| `tsconfig.node.json` | 신규 | main, preload, shared, 시험, 설정 파일 | - | ~25 |
| `tsconfig.web.json` | 신규 | renderer, shared | - | ~25 |
| `electron.vite.config.ts` | 신규 | main, preload(CJS 출력), renderer 빌드 설정, production에만 CSP를 넣는 플러그인 | - | ~90 |
| `eslint.config.js` | 신규 | 린트와 폴더별 의존 규칙 | - | ~150 |
| `prettier.config.js` | 신규 | 포맷 설정 | - | ~10 |
| `vitest.config.ts` | 신규 | cli 시험 설정 | - | ~25 |
| `playwright.config.ts` | 신규 | browser 시험 설정 (workers 1, 순차, 제한 시간) | - | ~40 |
| `electron-builder.yml` | 신규 | 포장 설정 (publish 없음, 포장 퓨즈) | - | ~30 |
| `src/main/index.ts` | 신규(스텁) | main 진입 (비어 있음) | - | ~3 |
| `src/preload/index.ts` | 신규(스텁) | preload 진입 (비어 있음) | - | ~3 |
| `src/renderer/index.html` | 신규(스텁) | renderer 문서 (뼈대만) | - | ~12 |
| `src/renderer/src/main.tsx` | 신규(스텁) | renderer 진입 (비어 있음) | - | ~3 |
| `src/shared/constants.ts` | 신규 | 허용 값 목록과 상수 | - | ~60 |
| `src/shared/types/result.ts` | 신규 | Result, 오류, 읽기 실패 타입 | - | ~70 |
| `src/main/store/file-system-port.ts` | 신규 | FileSystemPort 인터페이스 | - | ~15 |
| `src/main/store/data-file-names.ts` | 신규 | 저장 파일 이름·데이터 폴더 이름 상수, 경로 합치기(`node:path`) | - | ~25 |
| `src/main/app/network-guard.ts` | 신규 | 외부 요청·이동·권한 차단(앱 번들 폴더 접두사만 허용), Chromium 요청 완화 후보 | - | ~110 |
| `src/renderer/src/styles/tokens.css` | 신규 | 두 판의 색 토큰 | - | ~110 |
| `src/renderer/src/styles/fonts/SUIT-Variable.woff2` | 신규(자산) | SUIT Variable 글꼴 (바이너리) | - | - |
| `src/renderer/src/styles/fonts/SUIT-LICENSE.txt` | 신규(자산) | 글꼴 라이선스·저작권 문구 | - | ~100 |

### Wave 2: 카드 타입, 정적 스타일, 파일 시스템 구현, 독립 공통 UI

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/shared/types/card.ts` | 신규 | 엔티티, 입력, 조회 조건, 저장 문서 타입 | `src/shared/constants.ts` | ~90 |
| `src/renderer/src/styles/base.css` | 신규 | `@font-face`와 기본 스타일 | `src/renderer/src/styles/fonts/SUIT-Variable.woff2` | ~70 |
| `src/main/store/node-file-system.ts` | 신규 | FileSystemPort 실제 구현, 폴더 만들기, `rename` 일시 오류 재시도 | `src/main/store/file-system-port.ts` | ~90 |
| `src/renderer/src/common/Icon.tsx` | 신규 | 인라인 SVG 아이콘 약 16개 | - | ~150 |
| `src/renderer/src/common/SegmentedControl.tsx` | 신규 | 분할 버튼 | - | ~60 |
| `src/renderer/src/common/RadioRow.tsx` | 신규 | 라디오 행 | - | ~50 |
| `src/renderer/src/common/Menu.tsx` | 신규 | 메뉴, 팝오버 | - | ~120 |
| `src/renderer/src/common/common.css` | 신규 | 공통 UI 스타일 | - | ~250 |
| `src/renderer/src/layout/layout.css` | 신규 | 사이드바·상단 막대·본문·하단 줄 배치 스타일 (막대·하단 줄 클래스는 이 파일에만 둔다) | - | ~200 |
| `src/renderer/src/features/board/board.css` | 신규 | 보드 화면 스타일 (`*-topbar`, `*-statusbar` 클래스는 쓰지 않는다) | - | ~220 |
| `src/renderer/src/features/card-dialog/card-dialog.css` | 신규 | 카드 대화상자 스타일 | - | ~220 |
| `src/renderer/src/features/calendar/calendar.css` | 신규 | 캘린더 화면 스타일 (`*-topbar`, `*-statusbar` 클래스는 쓰지 않는다) | - | ~220 |
| `src/renderer/src/features/archive/archive.css` | 신규 | 보관함 화면 스타일 (`*-topbar`, `*-statusbar` 클래스는 쓰지 않는다) | - | ~80 |
| `src/renderer/src/features/load-error/load-error.css` | 신규 | 읽기 실패 패널 스타일 | - | ~50 |

### Wave 3: API 타입, 날짜·검색 규칙, 문구, 저장소 인터페이스, 창 생성, 공통 UI 1차

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/shared/types/api.ts` | 신규 | KanbanApi (화면 함수 12개) 타입 | `src/shared/types/card.ts`, `src/shared/types/result.ts` | ~80 |
| `src/shared/domain/date-rules.ts` | 신규 | 오늘, 마감 지남, 날짜 계산 | `src/shared/types/card.ts` | ~120 |
| `src/shared/domain/query-filter.ts` | 신규 | 검색·필터 조건 판정 | `src/shared/types/card.ts` | ~40 |
| `src/shared/domain/rule-support.ts` | 신규 | 규칙 함수 공통 타입과 결과 만들기 | `src/shared/types/card.ts`, `src/shared/types/result.ts` | ~60 |
| `src/renderer/src/text/labels.ts` | 신규 | 화면 문구 상수, 오류 문구 | `src/shared/types/card.ts`, `src/shared/types/result.ts` | ~90 |
| `src/main/store/store-types.ts` | 신규 | KanbanStore 인터페이스와 생성 인자 타입 | `src/shared/types/card.ts`, `src/shared/types/result.ts`, `src/main/store/file-system-port.ts` | ~60 |
| `src/main/app/window-factory.ts` | 신규 | BrowserWindow 생성과 보안 기본값(기본 크기 1280x920), 렌더러 종료·로드 실패 처리 | `src/shared/types/card.ts`, `src/shared/constants.ts` | ~110 |
| `src/main/store/migrations/v1-to-v2.ts` | 신규 | 버전 1 → 2 변환 | `src/shared/types/card.ts`, `src/shared/constants.ts` | ~25 |
| `src/renderer/src/common/Button.tsx` | 신규 | 버튼, 아이콘 버튼 | `src/renderer/src/common/Icon.tsx` | ~80 |
| `src/renderer/src/common/TextFields.tsx` | 신규 | 글 입력, 여러 줄 입력 (라벨, 오류 줄) | `src/renderer/src/common/Icon.tsx` | ~110 |

### Wave 4: 검증, IPC 계약, 표시 모델, 마이그레이션 사슬, 공통 UI 2차

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/shared/domain/validation.ts` | 신규 | 입력 검증 | `src/shared/types/card.ts`, `src/shared/types/result.ts`, `src/shared/constants.ts`, `src/shared/domain/date-rules.ts` | ~240 |
| `src/shared/ipc-contract.ts` | 신규 | 채널 이름 표 12개 | `src/shared/types/api.ts` | ~50 |
| `src/renderer/src/env.d.ts` | 신규 | `window.kanban` 타입, vite 클라이언트 타입 | `src/shared/types/api.ts` | ~12 |
| `src/renderer/src/model/board-model.ts` | 신규 | 칸 나누기, 조건 적용, 건수, 표시 순서 | `src/shared/domain/query-filter.ts`, `src/shared/domain/date-rules.ts`, `src/shared/types/card.ts` | ~150 |
| `src/renderer/src/model/calendar-model.ts` | 신규 | 월·주 격자, 날짜별 묶기, 기간 이동 | `src/shared/domain/date-rules.ts`, `src/shared/types/card.ts` | ~200 |
| `src/main/store/migrations/index.ts` | 신규 | 버전 변환 사슬 | `src/main/store/migrations/v1-to-v2.ts`, `src/shared/constants.ts` | ~80 |
| `src/renderer/src/common/Chips.tsx` | 신규 | 칩, 종류 칩, 우선순위 표시 | `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/types/card.ts` | ~130 |
| `src/renderer/src/common/DueText.tsx` | 신규 | 마감일 글자와 마감 지남 모양 | `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/domain/date-rules.ts` | ~70 |
| `src/renderer/src/common/Banner.tsx` | 신규 | 저장 실패 알림 줄 | `src/renderer/src/common/Icon.tsx`, `src/renderer/src/common/Button.tsx` | ~60 |
| `src/renderer/src/common/EmptyState.tsx` | 신규 | 빈 칸·빈 목록·결과 없음 문구 | `src/renderer/src/common/Button.tsx` | ~40 |
| `src/renderer/src/common/SearchBox.tsx` | 신규 | 검색 입력 | `src/renderer/src/common/Icon.tsx`, `src/renderer/src/common/TextFields.tsx` | ~70 |

### Wave 5: 카드·기록·설정 규칙, 저장 파일 검증, IPC 핸들러, preload 완성, 화면 조각

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/shared/domain/card-rules.ts` | 신규 | 카드 만들기·수정·상태·보관·삭제 규칙 | `src/shared/domain/validation.ts`, `src/shared/domain/date-rules.ts`, `src/shared/domain/rule-support.ts`, `src/shared/types/card.ts`, `src/shared/types/result.ts` | ~230 |
| `src/shared/domain/card-queries.ts` | 신규 | 목록·상세 조회 규칙 | `src/shared/domain/validation.ts`, `src/shared/domain/query-filter.ts`, `src/shared/domain/rule-support.ts` | ~60 |
| `src/shared/domain/progress-rules.ts` | 신규 | 진행 기록 추가 규칙 | `src/shared/domain/validation.ts`, `src/shared/domain/rule-support.ts` | ~70 |
| `src/shared/domain/settings-rules.ts` | 신규 | 화면 밝기 설정 규칙 | `src/shared/domain/validation.ts`, `src/shared/domain/rule-support.ts`, `src/shared/constants.ts` | ~40 |
| `src/main/store/data-file-validator.ts` | 신규 | 읽은 문서의 모양과 불변식 검사 | `src/shared/domain/validation.ts`, `src/shared/types/card.ts`, `src/shared/constants.ts` | ~220 |
| `src/main/app/ipc-handlers.ts` | 신규 | 열두 채널 등록, 예외 경계(`INTERNAL`을 콘솔에 기록), 처리 중 요청 대기(`whenIdle`) | `src/main/store/store-types.ts`, `src/shared/ipc-contract.ts`, `src/shared/domain/rule-support.ts`, `src/shared/types/result.ts` | ~160 |
| `src/preload/index.ts` | 수정(스텁 완성) | `window.kanban` 열두 함수 노출, 초기 판 적기(`<html>`이 없으면 `MutationObserver`) | `src/shared/ipc-contract.ts`, `src/shared/types/api.ts`, `src/shared/constants.ts` | ~90 |
| `src/renderer/src/state/state-types.ts` | 신규 | DataState, UiState, SaveState 모양과 액션, 변경 요청 종류(`ChangeRequest`, 마감일 변경 `moveDueDate` 포함) | `src/shared/types/card.ts`, `src/shared/types/result.ts`, `src/renderer/src/model/board-model.ts`, `src/renderer/src/model/calendar-model.ts` | ~105 |
| `src/renderer/src/features/board/CardMoveMenu.tsx` | 신규 | `⋯` 상태 이동 메뉴 | `src/renderer/src/common/Menu.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/types/card.ts` | ~70 |
| `src/renderer/src/features/board/ArchiveConfirm.tsx` | 신규 | 보관 인라인 확인 | `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts` | ~50 |
| `src/renderer/src/features/board/OverdueSummary.tsx` | 신규 | 마감 지난 카드 요약 | `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts` | ~50 |
| `src/renderer/src/features/board/ConditionBar.tsx` | 신규 | 검색·필터 조건 줄 (보드와 보관함이 공유) | `src/renderer/src/common/SearchBox.tsx`, `src/renderer/src/common/Chips.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts` | ~110 |
| `src/renderer/src/features/archive/ArchiveRow.tsx` | 신규 | 보관함 목록 행, 행의 `삭제`와 인라인 삭제 확인 | `src/renderer/src/common/Chips.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/types/card.ts` | ~130 |
| `src/renderer/src/features/calendar/CalendarChip.tsx` | 신규 | 날짜 칸의 카드 칩 (끄는 것: `draggable`, `CHIP_DRAG_TYPE`, 팝업 안 칩은 끌 수 없음) | `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/domain/date-rules.ts`, `src/shared/types/card.ts` | ~90 |
| `src/renderer/src/features/calendar/PeriodNav.tsx` | 신규 | 이전·다음·오늘로 이동, 기간 제목 (`AppShell`이 `TopBar`의 children으로 넣는다) | `src/renderer/src/common/Button.tsx`, `src/renderer/src/model/calendar-model.ts` | ~70 |
| `src/renderer/src/features/card-dialog/card-form-state.ts` | 신규 | 입력칸 값 ↔ 입력/수정 값 변환 (순수), 새 카드의 상태(`할 일`/`진행 중`), 마감일 입력하다 만 값 | `src/shared/domain/validation.ts`, `src/shared/types/card.ts`, `src/shared/types/result.ts` | ~130 |
| `src/renderer/src/features/card-dialog/ProgressLog.tsx` | 신규 | 진행 기록 목록 | `src/renderer/src/common/Chips.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/types/card.ts` | ~70 |
| `src/renderer/src/features/card-dialog/ProgressInput.tsx` | 신규 | 진행 기록 입력 | `src/renderer/src/common/TextFields.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts` | ~70 |
| `src/renderer/src/features/card-dialog/DeleteConfirmBar.tsx` | 신규 | 삭제 확인 바닥 줄 | `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts` | ~50 |

### Wave 6: 저장 절차, 상태 reducer, 카드 항목, 카드 입력 폼, 날짜 칸

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/main/store/data-file-save.ts` | 신규 | 저장 네 단계 | `src/main/store/data-file-validator.ts`, `src/main/store/data-file-names.ts`, `src/main/store/file-system-port.ts`, `src/shared/types/card.ts` | ~140 |
| `src/renderer/src/state/reducers.ts` | 신규 | DataState, UiState, SaveState reducer | `src/renderer/src/state/state-types.ts`, `src/renderer/src/model/calendar-model.ts`, `src/renderer/src/model/board-model.ts`, `src/shared/types/card.ts`, `src/shared/constants.ts` | ~170 |
| `src/renderer/src/features/board/CardItem.tsx` | 신규 | 카드 한 장 (끌기, 메뉴, 보관 확인) | `src/renderer/src/features/board/CardMoveMenu.tsx`, `src/renderer/src/features/board/ArchiveConfirm.tsx`, `src/renderer/src/common/Chips.tsx`, `src/renderer/src/common/DueText.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/domain/date-rules.ts` | ~150 |
| `src/renderer/src/features/calendar/DayCell.tsx` | 신규 | 날짜 칸 (칩 3개, 더 보기, 놓는 곳: `dragover` 표시와 `drop` → `onDropCard(cardId, date)`) | `src/renderer/src/features/calendar/CalendarChip.tsx`, `src/renderer/src/model/calendar-model.ts` | ~120 |
| `src/renderer/src/features/calendar/DayPopover.tsx` | 신규 | `+N건 더 보기` 팝업 | `src/renderer/src/features/calendar/CalendarChip.tsx`, `src/renderer/src/common/Menu.tsx` | ~100 |
| `src/renderer/src/features/card-dialog/CardForm.tsx` | 신규 | 카드 입력칸 묶음 (새 카드의 상태 선택, `input type="date"` 마감일, 우선순위 낮음·중간·높음) | `src/renderer/src/features/card-dialog/card-form-state.ts`, `src/renderer/src/common/TextFields.tsx`, `src/renderer/src/common/SegmentedControl.tsx`, `src/renderer/src/text/labels.ts` | ~250 |

### Wave 7: 저장소 읽기, 앱 상태, 칸, 월·주 격자

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/main/store/data-file-repository.ts` | 신규 | 읽기와 읽기 실패 분류, 저장 호출 조립 | `src/main/store/data-file-save.ts`, `src/main/store/data-file-validator.ts`, `src/main/store/migrations/index.ts`, `src/main/store/data-file-names.ts`, `src/main/store/file-system-port.ts`, `src/shared/types/result.ts` | ~210 |
| `src/renderer/src/state/app-state.tsx` | 신규 | Context, Provider, 훅 | `src/renderer/src/state/reducers.ts`, `src/renderer/src/state/state-types.ts` | ~110 |
| `src/renderer/src/features/board/Column.tsx` | 신규 | 칸 하나 (머리, 카드 목록, 놓기) | `src/renderer/src/features/board/CardItem.tsx`, `src/renderer/src/common/EmptyState.tsx`, `src/renderer/src/text/labels.ts` | ~110 |
| `src/renderer/src/features/calendar/MonthGrid.tsx` | 신규 | 월 격자 | `src/renderer/src/features/calendar/DayCell.tsx`, `src/renderer/src/model/calendar-model.ts` | ~100 |
| `src/renderer/src/features/calendar/WeekGrid.tsx` | 신규 | 주 한 줄 | `src/renderer/src/features/calendar/DayCell.tsx`, `src/renderer/src/model/calendar-model.ts` | ~80 |

### Wave 8: 저장소 본체, 변경 실행기, 상단 막대, 읽기 실패 화면

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/main/store/kanban-store.ts` | 신규 | 상태, 한 줄 처리, 메모리 문서, 화면 함수 구현 | `src/main/store/store-types.ts`, `src/main/store/data-file-repository.ts`, `src/shared/domain/card-rules.ts`, `src/shared/domain/card-queries.ts`, `src/shared/domain/progress-rules.ts`, `src/shared/domain/settings-rules.ts`, `src/shared/domain/rule-support.ts`, `src/shared/types/card.ts`, `src/shared/types/result.ts` | ~250 |
| `src/renderer/src/state/change-runner.ts` | 신규 | 변경 호출 즉시 전송·결과 대기(판 전환만 낙관적), 저장 실패 처리, 마감일 변경(`moveDueDate`) | `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/state-types.ts`, `src/renderer/src/env.d.ts`, `src/shared/types/result.ts` | ~240 |
| `src/renderer/src/layout/TopBar.tsx` | 신규 | 상단 막대 (화면 제목, 검색, 카드 만들기, 캘린더용 children 자리) | `src/renderer/src/state/app-state.tsx`, `src/renderer/src/common/SearchBox.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts` | ~90 |
| `src/renderer/src/features/load-error/ReadFailurePanel.tsx` | 신규 | 읽기 실패 오류 패널 (파일 경로, 직전 저장본·변환 전 사본 안내, 수동 절차 문구) | `src/renderer/src/state/app-state.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts` | ~100 |

### Wave 9: 판 전환 연결, 보드·캘린더·보관함 화면, 카드 대화상자, main 진입 완성

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/renderer/src/state/theme-controller.ts` | 신규 | `data-theme` 적용과 판 전환 | `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/shared/constants.ts` | ~60 |
| `src/renderer/src/features/board/BoardScreen.tsx` | 신규 | SCR-001 화면 본문 (상단 막대·하단 줄은 `AppShell`이 그린다), 칸 세 개 배치 | `src/renderer/src/features/board/Column.tsx`, `src/renderer/src/features/board/ConditionBar.tsx`, `src/renderer/src/features/board/OverdueSummary.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/model/board-model.ts`, `src/renderer/src/common/EmptyState.tsx`, `src/shared/domain/date-rules.ts` | ~170 |
| `src/renderer/src/features/card-dialog/CardDialog.tsx` | 신규 | SCR-002 대화상자 (`<dialog>`) | `src/renderer/src/features/card-dialog/CardForm.tsx`, `src/renderer/src/features/card-dialog/ProgressLog.tsx`, `src/renderer/src/features/card-dialog/ProgressInput.tsx`, `src/renderer/src/features/card-dialog/DeleteConfirmBar.tsx`, `src/renderer/src/features/card-dialog/card-form-state.ts`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/common/Banner.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts` | ~230 |
| `src/renderer/src/features/calendar/CalendarScreen.tsx` | 신규 | SCR-003 화면 본문 (상단 막대·하단 줄은 `AppShell`이 그린다), 칩 끌기의 놓기 처리 (`onDropCard` → `ChangeRunner.moveDueDate`). `ChangeRunner`(Wave 8)에 의존하게 되어 Wave 8에서 옮겼다 | `src/renderer/src/features/calendar/MonthGrid.tsx`, `src/renderer/src/features/calendar/WeekGrid.tsx`, `src/renderer/src/features/calendar/DayPopover.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/model/calendar-model.ts`, `src/renderer/src/common/EmptyState.tsx`, `src/shared/domain/date-rules.ts` | ~190 |
| `src/renderer/src/features/archive/ArchiveScreen.tsx` | 신규 | SCR-004 화면 본문 (상단 막대·하단 줄은 `AppShell`이 그린다), 행 삭제 연결 (`ChangeRunner.deleteCard`) | `src/renderer/src/features/archive/ArchiveRow.tsx`, `src/renderer/src/features/board/ConditionBar.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/model/board-model.ts`, `src/renderer/src/common/EmptyState.tsx` | ~140 |
| `src/main/index.ts` | 수정(스텁 완성) | 조립, 데이터 폴더 고정, 시작·종료 순서, 프로세스 오류 처리 | `src/main/store/kanban-store.ts`, `src/main/store/node-file-system.ts`, `src/main/store/data-file-names.ts`, `src/main/app/ipc-handlers.ts`, `src/main/app/window-factory.ts`, `src/main/app/network-guard.ts`, `src/shared/constants.ts` | ~170 |

### Wave 10: 사이드바

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/renderer/src/layout/Sidebar.tsx` | 신규 | 이동 3항목, 필터(각 목록 맨 위 `전체`, 라디오, 해제 없음), 화면 밝기, 저장 상태 | `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/theme-controller.ts`, `src/renderer/src/model/board-model.ts`, `src/renderer/src/common/RadioRow.tsx`, `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts` | ~240 |

### Wave 11: 앱 껍데기

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/renderer/src/layout/AppShell.tsx` | 신규 | 사이드바·상단 막대(`TopBar`)·본문·하단 줄(화면별 건수 문구), 캘린더 기간 이동·월·주 분할 버튼 주입, 화면 전환, 알림 줄 | `src/renderer/src/layout/Sidebar.tsx`, `src/renderer/src/layout/TopBar.tsx`, `src/renderer/src/features/calendar/PeriodNav.tsx`, `src/renderer/src/common/SegmentedControl.tsx`, `src/renderer/src/model/calendar-model.ts`, `src/shared/domain/date-rules.ts`, `src/renderer/src/features/board/BoardScreen.tsx`, `src/renderer/src/features/calendar/CalendarScreen.tsx`, `src/renderer/src/features/archive/ArchiveScreen.tsx`, `src/renderer/src/features/card-dialog/CardDialog.tsx`, `src/renderer/src/features/load-error/ReadFailurePanel.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/common/Banner.tsx` | ~160 |

### Wave 12: renderer 진입 완성 (최종 진입)

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/renderer/src/main.tsx` | 수정(스텁 완성) | Bootstrap: 시작 순서, 전역 CSS, 렌더, React 오류 경계 | `src/renderer/src/layout/AppShell.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/state/theme-controller.ts`, `src/renderer/src/styles/tokens.css`, `src/renderer/src/styles/base.css`, `src/renderer/src/common/common.css`, `src/renderer/src/layout/layout.css`, `src/renderer/src/text/labels.ts`, `src/renderer/src/env.d.ts` | ~140 |
| `src/renderer/index.html` | 수정(스텁 완성) | 제목, 루트 요소 (CSP는 production build가 주입) | - | ~15 |

### Wave 13: 시험 지원

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `tests/cli/support/memory-fs.ts` | 신규(시험 지원) | 메모리 FileSystemPort | `src/main/store/file-system-port.ts` | ~70 |
| `tests/cli/support/fault-fs.ts` | 신규(시험 지원) | n번째 호출 실패·중단 주입, 호출 기록 | `src/main/store/file-system-port.ts` | ~110 |
| `tests/cli/support/builders.ts` | 신규(시험 지원) | 카드·문서·시계·아이디 만들기 | `src/shared/types/card.ts`, `src/shared/constants.ts`, `src/shared/domain/rule-support.ts` | ~90 |
| `tests/cli/support/fixtures/data-v1.json` | 신규(시험 지원) | 버전 1 저장 파일 (설정 없음) | - | ~40 |
| `tests/cli/support/fixtures/data-v2.json` | 신규(시험 지원) | 현재 버전 저장 파일 | - | ~60 |
| `tests/browser/support/launch-app.ts` | 신규(시험 지원) | 임시 `--user-data-dir`로 앱 구동·종료·재구동(`try/finally` 종료, 임시 폴더 정리), 데이터 파일 넣기·읽기 | - | ~140 |
| `tests/browser/support/network-observer.ts` | 신규(시험 지원) | 요청 관찰과 외부 주소 `fetch` 시도 | - | ~70 |

### Wave 14: cli 시험 (Vitest)

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `tests/cli/domain/date-rules.test.ts` | 신규(시험) | 오늘, 마감 지남, 윤년·월말 | `src/shared/domain/date-rules.ts` | ~200 |
| `tests/cli/domain/validation.test.ts` | 신규(시험) | 검증 규칙 표 (`create` 모드의 `status` 허용·거부 포함) | `src/shared/domain/validation.ts`, `tests/cli/support/builders.ts` | ~290 |
| `tests/cli/domain/query-filter.test.ts` | 신규(시험) | 검색·필터 조건 | `src/shared/domain/query-filter.ts`, `tests/cli/support/builders.ts` | ~120 |
| `tests/cli/domain/card-rules.test.ts` | 신규(시험) | 카드 규칙, 상태 전이, 보관, 삭제 | `src/shared/domain/card-rules.ts`, `tests/cli/support/builders.ts` | ~300 |
| `tests/cli/domain/card-queries.test.ts` | 신규(시험) | 목록·상세 조회 규칙 | `src/shared/domain/card-queries.ts`, `tests/cli/support/builders.ts` | ~100 |
| `tests/cli/domain/progress-rules.test.ts` | 신규(시험) | 진행 기록 규칙 | `src/shared/domain/progress-rules.ts`, `tests/cli/support/builders.ts` | ~140 |
| `tests/cli/domain/settings-rules.test.ts` | 신규(시험) | 설정 규칙 (설정이 없는 문서의 기본 판 light) | `src/shared/domain/settings-rules.ts`, `tests/cli/support/builders.ts` | ~90 |
| `tests/cli/store/data-file-validator.test.ts` | 신규(시험) | 저장 문서 불변식 | `src/main/store/data-file-validator.ts`, `tests/cli/support/fixtures/data-v2.json`, `tests/cli/support/builders.ts` | ~200 |
| `tests/cli/store/data-file-save.test.ts` | 신규(시험) | 저장 네 단계와 변환 전 원본 복사 | `src/main/store/data-file-save.ts`, `tests/cli/support/memory-fs.ts`, `tests/cli/support/fault-fs.ts`, `tests/cli/support/builders.ts` | ~230 |
| `tests/cli/store/data-file-repository.test.ts` | 신규(시험) | 읽기 순서, 읽기 실패 분류 | `src/main/store/data-file-repository.ts`, `tests/cli/support/memory-fs.ts`, `tests/cli/support/fixtures/data-v1.json`, `tests/cli/support/fixtures/data-v2.json` | ~280 |
| `tests/cli/store/kanban-store.test.ts` | 신규(시험) | 화면 함수 12개 흐름, 한 줄 처리, 상태를 정해 만들기(`in_progress`는 기록 없이 저장, `done`은 거절되고 문서 불변) | `src/main/store/kanban-store.ts`, `tests/cli/support/memory-fs.ts`, `tests/cli/support/builders.ts` | ~300 |
| `tests/cli/store/kanban-store-faults.test.ts` | 신규(시험) | 모든 중단 시점의 저장 실패와 재열기 | `src/main/store/kanban-store.ts`, `tests/cli/support/fault-fs.ts`, `tests/cli/support/memory-fs.ts`, `tests/cli/support/builders.ts` | ~240 |
| `tests/cli/store/kanban-store-locked.test.ts` | 신규(시험) | 읽기 실패 잠금과 쓰기 호출 0건 | `src/main/store/kanban-store.ts`, `tests/cli/support/fault-fs.ts`, `tests/cli/support/memory-fs.ts` | ~130 |
| `tests/cli/store/node-file-system.test.ts` | 신규(시험) | 실제 임시 폴더에서 다섯 동작 | `src/main/store/node-file-system.ts` | ~150 |
| `tests/cli/migrations/schema-migrations.test.ts` | 신규(시험) | 버전 1 → 2(채우는 판은 light), 이미 저장된 dark 유지, 더 새로운 버전, 변환 실패 | `src/main/store/migrations/index.ts`, `tests/cli/support/fixtures/data-v1.json`, `tests/cli/support/fixtures/data-v2.json` | ~170 |
| `tests/cli/model/board-model.test.ts` | 신규(시험) | 칸 나누기, 조건, 건수(`total`은 범위 전체), 표시 순서 | `src/renderer/src/model/board-model.ts`, `tests/cli/support/builders.ts` | ~220 |
| `tests/cli/model/calendar-model.test.ts` | 신규(시험) | 월·주 격자, 묶기, 더 보기, 이동 | `src/renderer/src/model/calendar-model.ts`, `tests/cli/support/builders.ts` | ~260 |
| `tests/cli/model/card-form-state.test.ts` | 신규(시험) | 입력칸 값 변환 (새 카드 상태, 마감일 입력하다 만 값) | `src/renderer/src/features/card-dialog/card-form-state.ts`, `tests/cli/support/builders.ts` | ~160 |
| `tests/cli/state/reducers.test.ts` | 신규(시험) | 화면 상태 reducer 세 개 | `src/renderer/src/state/reducers.ts`, `tests/cli/support/builders.ts` | ~140 |
| `tests/cli/state/change-runner.test.ts` | 신규(시험) | 변경 실행기 (가짜 `KanbanApi` 주입, 마감일 변경 `moveDueDate` 포함) | `src/renderer/src/state/change-runner.ts`, `tests/cli/support/builders.ts` | ~290 |
| `tests/cli/text/labels.test.ts` | 신규(시험) | 모든 값·오류 코드에 문구가 있음 (`medium`은 `중간`) | `src/renderer/src/text/labels.ts` | ~70 |
| `tests/cli/ipc/ipc-contract.test.ts` | 신규(시험) | 채널 12개가 `03-api-spec.md` 목록과 같음 | `src/shared/ipc-contract.ts` | ~60 |
| `tests/cli/ipc/ipc-handlers.test.ts` | 신규(시험) | 호출 프레임 확인, 예외 → `INTERNAL` (electron 모듈 대역) | `src/main/app/ipc-handlers.ts`, `tests/cli/support/builders.ts` | ~190 |

### Wave 15: browser 시험 (Playwright Electron)

| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `tests/browser/board.spec.ts` | 신규(시험) | 카드 만들기(상태 선택으로 진행 중 칸에 만들기, 우선순위 순서·`중간` 표시), 칸 이동, 세 칸, 빈 칸 | `tests/browser/support/launch-app.ts` | ~280 |
| `tests/browser/card-dialog.spec.ts` | 신규(시험) | 입력·수정·삭제 확인, 진행 기록, 입력 오류 | `tests/browser/support/launch-app.ts` | ~290 |
| `tests/browser/archive.spec.ts` | 신규(시험) | 보관, 보관함 보기·검색 | `tests/browser/support/launch-app.ts` | ~200 |
| `tests/browser/calendar.spec.ts` | 신규(시험) | 날짜 칸, 마감 없는 카드, 칩 열기, 기본 창 크기에서 5주인 달의 월 보기가 스크롤 없이 보임 | `tests/browser/support/launch-app.ts` | ~250 |
| `tests/browser/overdue.spec.ts` | 신규(시험) | 마감 지남 표시와 색 외 구분 | `tests/browser/support/launch-app.ts` | ~150 |
| `tests/browser/search-filter.spec.ts` | 신규(시험) | 검색·필터·결과 없음, 사이드바 `전체` 항목(처음 선택, 다시 눌러도 해제 없음, 건수는 범위 전체) | `tests/browser/support/launch-app.ts` | ~230 |
| `tests/browser/persistence.spec.ts` | 신규(시험) | 재시작 유지, 강제 종료, 이전 버전 파일 | `tests/browser/support/launch-app.ts`, `tests/cli/support/fixtures/data-v1.json`, `tests/cli/support/fixtures/data-v2.json` | ~250 |
| `tests/browser/save-failure.spec.ts` | 신규(시험) | 저장 실패 알림과 입력 유지, 캘린더 끌기 저장 실패 | `tests/browser/support/launch-app.ts` | ~190 |
| `tests/browser/read-failure.spec.ts` | 신규(시험) | 읽기 실패 패널, 파일 불변 | `tests/browser/support/launch-app.ts` | ~150 |
| `tests/browser/theme.spec.ts` | 신규(시험) | 판 전환, 유지, 두 판의 구분 표시, 처음 실행은 밝은 판, 저장된 어두운 판 유지 | `tests/browser/support/launch-app.ts` | ~170 |
| `tests/browser/offline.spec.ts` | 신규(시험) | 외부 요청 0건, 외부 `fetch` 거절 | `tests/browser/support/launch-app.ts`, `tests/browser/support/network-observer.ts` | ~130 |
| `tests/browser/app-security.spec.ts` | 신규(시험) | 노출 범위, 격리, 새 창·이동 거부 | `tests/browser/support/launch-app.ts` | ~120 |
| `tests/browser/calendar-drag.spec.ts` | 신규(시험) | 캘린더 칩 끌기로 마감일 변경(월·주 보기, 이 달 밖 칸, 같은 칸·칸 밖 무동작, 팝업 안 칩은 끌 수 없음), 칩을 눌러 마감일 칸에서 고치기 | `tests/browser/support/launch-app.ts` | ~200 |

## 파일별 상세 명세

> 형식: 목적 / 주요 export / 의존 / 관련 (FR·AC·NFR, 예상 LOC) / 참고. `의존`은 위 Wave 표와 같다. 시험 파일의 상세는 맨 아래 `시험 파일 계획`의 표에 있다 (대상, 범주, LOC). `임시 가정`은 `결정 필요`를 정하지 않고 영향받는 파일에 표시한 것이다.

### 초기화 (설정 파일)

### `package.json`
- 목적: 스크립트, 핀 버전 의존성, 실행 진입
- 주요 export: `"main": "out/main/index.js"`, `"type": "module"`, `"engines": { "node": ">=22.13.0" }`(Node 22.13 이상. 사용자가 `01-tech-stack.md` 결정 필요 4에서 24를 고르면 `">=24.0.0"`으로 바꾼다), 스크립트 `dev`/`build`/`start`/`lint`/`format`/`test`/`test:e2e`/`package` (`01-tech-stack.md`의 `스크립트` 표 그대로). 패키지는 `01-tech-stack.md`의 `패키지 의존성` 17개를 `^`·`~` 없이 정확한 버전으로. electron은 devDependencies (그 표의 비고). 나머지 분류는 구현이 정한다.
- 의존: 없음
- 관련: FR 없음 (기반 파일), NFR-001 (`electron-updater`, 원격 분석 패키지를 넣지 않음) · 예상 LOC: ~50
- 참고: `name`/`productName`은 앱 이름 `결정 필요` 3에 걸린다. 임시 가정: 구현 시작 전에 사용자가 이름을 준다. `"type": "module"`과 샌드박스 preload 호환은 `결정 필요` 4. `build` 스크립트는 `tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit && electron-vite build`다 (`01-tech-stack.md`, `결정 필요` 5 해소). `npm ci`로 `package-lock.json`을 만든 Node 버전을 첫 Task 기록에 남기고, eslint 10.14.0의 `engines`를 `npm view`로 확인한다.

### `.gitignore`
- 목적: 도구가 만드는 폴더를 버전 관리에서 제외 (`05-architecture.md` 디렉토리 구조의 "버전 관리 제외")
- 주요 export: `out/`, `release/`, `reports/`, `test-results/`, `node_modules/`
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~8

### `tsconfig.json`
- 목적: 루트(에디터용). 검사에는 쓰지 않는다. 에디터가 하위 설정을 찾게 하는 빈 설정이다.
- 주요 export: `{ "files": [] }`. `references`는 두지 않는다 (`tsc`는 `-b` 없이 references를 검사하지 않고, references 대상은 `composite`가 필요해진다)
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~5
- 참고: `build` 스크립트가 `tsc -p tsconfig.node.json --noEmit`과 `tsc -p tsconfig.web.json --noEmit`를 각각 부른다 (`01-tech-stack.md`, `결정 필요` 5 해소). 두 호출이 빈 프로젝트에서도 통과하는지는 실행해 확인하지 못했고 첫 Task가 확인한다.

### `tsconfig.node.json`
- 목적: main, preload, shared, 설정 파일, 시험(`tests/cli`, `tests/browser`)의 타입 검사. 엄격 모드, `any` 금지.
- 주요 export: `include`: `src/main`, `src/preload`, `src/shared`, `tests`, `electron.vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`. 별칭 `@shared/*` → `src/shared/*`. DOM 라이브러리 없음. `exclude`: `tests/cli/state` (React 상태 파일을 불러오는 시험이라 웹 쪽이 검사한다). `types: ["node"]`를 명시한다 (TypeScript 6의 `types` 기본값 변화를 확인하지 못해 명시로 피한다).
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~25
- 참고: 아키텍처의 "Node 쪽(main, preload, tests/cli)"에 `tests/browser`와 설정 파일을 더했다. 타입 검사 대상이 없으면 TS18003이 나고 이 파일들도 검사해야 하기 때문이다.

### `tsconfig.web.json`
- 목적: renderer와 shared의 타입 검사
- 주요 export: `include`: `src/renderer/src`, `src/shared`, `tests/cli/state`. `lib`에 DOM, `jsx: react-jsx`, `types: ["vite/client"]`(명시), 별칭 `@shared/*`.
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~25

### `electron.vite.config.ts`
- 목적: main, preload, renderer 세 곳을 한 설정으로 빌드. 결과는 `out/`.
- 주요 export: `export default defineConfig({ main, preload, renderer })`. 별칭 `@shared` → `src/shared`, renderer root `src/renderer`, `@vitejs/plugin-react`. 확정값: (1) preload의 `build.rollupOptions.output = { format: 'cjs', entryFileNames: '[name].cjs' }` — 샌드박스 preload는 ESM이 될 수 없어 `out/preload/index.cjs`로 내보낸다. main은 ESM(`out/main/index.js`)이다. (2) renderer에 작은 인라인 플러그인을 두어 `transformIndexHtml`에서 `command === 'build'`일 때만 CSP 메타 태그를 `<head>`에 넣는다 (개발 서버 HMR을 막지 않으려는 것, FE-008. CSP 값은 `05-architecture.md` NFR-001).
- 의존: 없음
- 관련: FR 없음 (기반 파일), NFR-001 (외부 주소 로드 없음) · 예상 LOC: ~90
- 참고: preload CJS 출력 설정은 실행해 확인하지 못했다. 출력 파일 이름은 첫 Task의 `build`에서, `window.kanban` 노출은 첫 Electron 구동에서 확인한다. 안 먹히면 대안: `build.lib`의 `formats: ['cjs']`와 `fileName: () => 'index.cjs'`. 둘 다 안 되면 `package.json`에서 `"type": "module"`을 빼서 main도 CJS로 쓴다 (`01-tech-stack.md` 변경과 재승인 필요). `결정 필요` 4.

### `eslint.config.js`
- 목적: ESLint 10 flat config와 typescript-eslint 8.72.1. 폴더별 의존 규칙 (`05-architecture.md`의 `의존 규칙` 표)을 `no-restricted-imports`/`no-restricted-globals`로 강제.
- 주요 export: 설정 배열. `src/shared/**`는 `electron`, `node:*`, `react`, `window`, `document`, `process` 금지. `src/main/store/**`는 `electron`, `react`, `renderer`, `preload` 금지 (`node-file-system.ts`만 `node:fs/promises` 허용). `src/main/**` 전체는 `node:path`만 허용하고 그 밖의 `node:*`는 금지한다. `src/preload/**`, `src/renderer/**`, `src/renderer/src/model/**` 규칙도 같은 표. 무시 대상 `out/`, `release/`, `reports/`, `test-results/`, `node_modules/`.
- 의존: 없음
- 관련: FR 없음 (기반 파일), NFR-001 · 예상 LOC: ~150
- 참고: `globals` 패키지는 `01-tech-stack.md` 표에 없어 쓰지 않는다 (전역 이름은 설정에 직접 적는다). `node:path`는 `src/main/**`에서 허용하고 그 밖의 `node:*`는 금지한다 (`05-architecture.md` 의존 규칙, `결정 필요` 6 해소). 아이디는 전역 `crypto.randomUUID()`, 경로 기준은 `import.meta.dirname`·`import.meta.url`이라 import가 필요 없다.

### `prettier.config.js`
- 목적: 포맷 설정 (Prettier 3.9.10)
- 주요 export: 설정 객체
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~10

### `vitest.config.ts`
- 목적: cli 시험 설정. `include: tests/cli/**/*.test.ts`, 별칭 `@shared`, 실행 위치는 Node (jsdom 없음).
- 주요 export: `export default defineConfig(...)`
- 의존: 없음
- 관련: FR 없음 (기반 파일), NFR-002/NFR-003 (시험 실행 기반) · 예상 LOC: ~25
- 참고: JUnit 출력은 `01-tech-stack.md` `명령` 표의 명령 인자(`--reporter=junit --outputFile.junit=reports/junit.xml`)로 준다. 시험 파일이 없어도 통과(`--passWithNoTests`).

### `playwright.config.ts`
- 목적: browser 시험 설정. `testDir: tests/browser`, junit 리포터 `reports/e2e.xml`, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `outputDir: 'test-results'`, `workers: 1`, `fullyParallel: false`, `timeout: 30000`, `retries: 0`.
- 주요 export: `export default defineConfig(...)`
- 의존: 없음
- 관련: FR 없음 (기반 파일), NFR-001 (요청 관찰 기반) · 예상 LOC: ~40
- 참고: 시험마다 임시 데이터 폴더를 쓰고 이전 데이터를 재사용하지 않는다 (`launch-app.ts`가 맡음). 창이 뜨는 시험이라 헤드리스가 아니고, 병렬로 돌리면 창이 포커스를 뺏고 임시 폴더 정리·강제 종료 시험이 불안정해질 수 있어 한 번에 하나씩 순서대로 돌린다 (FE-011).

### `electron-builder.yml`
- 목적: Windows 실행 폴더 포장 설정. `publish` 설정을 두지 않는다 (NFR-001), 코드 서명 안 함.
- 주요 export: `appId`, `productName`, `files`(`out/**`), `win`, 포장 퓨즈 설정(`electronFuses`: `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`, `enableNodeCliInspectArguments: false`)
- 의존: 없음
- 관련: FR 없음 (기반 파일), NFR-001 · 예상 LOC: ~30
- 참고: `appId`/`productName`은 앱 이름 `결정 필요` 3. 앱 아이콘 파일은 계획에 없다 (`결정 필요` 7). `electronFuses` 키를 electron-builder 26.18.0이 지원하는지는 확인하지 못했다 (구현에서 확인, 안 되면 퓨즈 설정은 하지 않는다. 별도 패키지가 필요하면 `01-tech-stack.md` 표에 먼저 추가). 개발 실행과 시험은 포장 전 `out/`을 쓰므로 퓨즈의 영향이 없고 Playwright의 `EnableNodeCliInspectArguments` 요구와 충돌하지 않는다 (RK-008).

### 진입 파일 스텁 (Wave 1)

### `src/main/index.ts`
- 목적: (Wave 1) 비어 있는 main 진입. 빌드와 린트가 빈 대상 오류 없이 통과하게 한다. 최종 내용은 Wave 9에서 완성(아래 AppLifecycle).
- 주요 export: 없음
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~3 (완성본은 ~170)

### `src/preload/index.ts`
- 목적: (Wave 1) 비어 있는 preload 진입. 최종 내용은 Wave 5에서 완성(아래 PreloadBridge).
- 주요 export: 없음
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~3 (완성본은 ~90)

### `src/renderer/index.html`
- 목적: (Wave 1) renderer 문서 뼈대 (`<div id="root">`, `src/main.tsx` 스크립트). 제목은 Wave 12에서 완성. CSP는 원본에 두지 않는다 (production build가 주입).
- 주요 export: 없음
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~12 (완성본은 ~15)

### `src/renderer/src/main.tsx`
- 목적: (Wave 1) 비어 있는 renderer 진입. 최종 내용은 Wave 12에서 완성(아래 Bootstrap).
- 주요 export: 없음
- 의존: 없음
- 관련: FR 없음 (기반 파일) · 예상 LOC: ~3 (완성본은 ~140)

### 공유 계층 (`src/shared`, 소유: SharedTypes, IpcContract, DateRules, Validation, QueryFilter, CardRules)

### `src/shared/constants.ts`
- 목적: 허용 값 목록과 상수 (매직 넘버·문자열 금지의 자리). 소유: SharedTypes.
- 주요 export: `STATUSES`, `CREATE_STATUSES = ['todo', 'in_progress']` (생성 때 허용하는 상태. `Validation`의 `create` 모드와 카드 입력의 새 카드 상태 선택이 같은 목록을 쓰려는 이 파일 맵의 추가, AC-041·AC-042), `KINDS`, `PRIORITIES = ['low', 'medium', 'high']` (배열 순서 = 화면 표시 순서 낮음, 중간, 높음. 사이드바 필터와 카드 입력 분할 버튼이 이 순서로 `map`한다. 이전 `['high', 'medium', 'low']`에서 순서만 바뀐다. `05-architecture.md` SharedTypes), `THEMES`, `DEFAULT_THEME = 'light'` (명세 v4, ASM-017. 이전 `'dark'`), `CURRENT_SCHEMA_VERSION = 2`, `THEME_ARGUMENT_PREFIX` (main이 preload에 초기 판을 넘기는 `additionalArguments` 접두사. 두 곳이 같은 문자열을 쓰게 하려는 이 파일 맵의 추가)
- 의존: 없음
- 관련: FR-002 (AC-004), FR-007, FR-008 (AC-016, AC-047), FR-014 (AC-038), NFR-003 · 예상 LOC: ~60
- 참고 (명세 v4 재작업): 코드가 `['high', 'medium', 'low']`로 쓰여 있으면 배열 순서를 위 순서로 고친다. 검증은 포함 여부만 보므로 안전하다. `DEFAULT_THEME`은 `settings-rules.ts`, `v1-to-v2.ts`, `data-file-repository.ts`(빈 문서), `src/main/index.ts`(읽기 실패 기본값)가 쓰므로 값 하나로 따라 바뀐다.

### `src/shared/types/result.ts`
- 목적: `Result`, 오류, 검증 위반, 저장소 상태, 읽기 실패 타입 (`03-api-spec.md` 타입 절과 에러 카탈로그 그대로). 소유: SharedTypes.
- 주요 export: `Result<T>`, `AppError`, `ErrorCode`, `Violation`, `ViolationReason`, `StoreStatus`, `ReadFailure`, `ReadFailureCode`
- 의존: 없음
- 관련: FR-006 (AC-031, AC-032), FR-001, FR-011 (검증 오류 AC-002, AC-029, AC-035) · 예상 LOC: ~70

### `src/shared/types/card.ts`
- 목적: 엔티티, 입력, 조회 조건, 저장 문서 타입 (`02-data-model.md`, `03-api-spec.md`). 소유: SharedTypes.
- 주요 export: `Status`, `Kind`, `Priority`, `Theme`, `DateString`, `Card`, `ProgressEntry`, `Settings`, `DataFile`, `CardDetail`, `CardQuery`, `CardCreateInput` (`status?: 'todo' | 'in_progress'` 추가 — `CREATE_STATUSES`의 원소 타입, AC-041), `CardPatch`, `ProgressInput`
- 의존: `src/shared/constants.ts`
- 관련: FR-001 (AC-041, AC-042), FR-001 ~ FR-014 전반 · 예상 LOC: ~90

### `src/shared/types/api.ts`
- 목적: `window.kanban`이 가진 열두 함수의 타입. 소유: SharedTypes.
- 주요 export: `KanbanApi` (`store` 2, `cards` 7, `progress` 1, `settings` 2)
- 의존: `src/shared/types/card.ts`, `src/shared/types/result.ts`
- 관련: FR-001 ~ FR-014 전반 · 예상 LOC: ~80

### `src/shared/ipc-contract.ts`
- 목적: preload와 main이 같은 표에서 만드는 채널 이름 표. 소유: IpcContract.
- 주요 export: `IPC_CHANNELS` (열두 항목, 예 `'cards.changeStatus' → 'kanban:cards:changeStatus'`), `KanbanApi` 재수출
- 의존: `src/shared/types/api.ts`
- 관련: FR-006, FR-001 ~ FR-014 (모든 화면 함수가 이 표를 지난다), NFR-001 (보안 기본값) · 예상 LOC: ~50

### `src/shared/domain/date-rules.ts`
- 목적: 날짜만 다루는 계산과 마감 지남 판정. PC 현지 날짜는 `todayLocal` 한 곳에서만 만든다. 소유: DateRules.
- 주요 export: `todayLocal(now)`, `isRealDate(value)`, `isOverdue(card, today)`, `overdueDays(card, today)`, `diffDays`, `addDays`, `weekdayOf`, `daysInMonth`
- 의존: `src/shared/types/card.ts`
- 관련: FR-004 (AC-029), FR-005, FR-012 (AC-024, AC-025) · 예상 LOC: ~120

### `src/shared/domain/query-filter.ts`
- 목적: 검색·필터 조건 판정 한 곳 (main의 `cards.list`와 화면이 같은 함수를 쓴다). 소유: QueryFilter.
- 주요 export: `matchesQuery(card, query)`
- 의존: `src/shared/types/card.ts`
- 관련: FR-013 (AC-026, AC-027, AC-028, AC-036) · 예상 LOC: ~40
- 참고: 종류·우선순위 필터의 선택 방식(묶음마다 하나, 두 묶음은 AND)은 `04-ui-spec.md` 결정 필요 9의 임시 가정이다.

### `src/shared/domain/rule-support.ts`
- 목적: 규칙 함수가 공유하는 타입과 `Result` 만들기. 소유: CardRules.
- 주요 export: `RuleContext`, `RuleOutcome<T>`, `ok()`, `fail()`
- 의존: `src/shared/types/card.ts`, `src/shared/types/result.ts`
- 관련: FR-001, FR-002, FR-009, FR-010, FR-011, FR-014 (규칙 공통 기반) · 예상 LOC: ~60

### `src/shared/domain/validation.ts`
- 목적: `02-data-model.md`의 `검증 규칙과 제약 매핑` 표를 코드로 옮긴다. 모든 입력을 `unknown`으로 받아 모양부터 확인, 위반은 모아서 돌려준다. 소유: Validation.
- 주요 export: `validateCardInput(input, mode)`, `validateProgressInput`, `validateCardQuery`, `validateStatus`, `validateTheme`, `validateId`, `normalizeTitle`
- 의존: `src/shared/types/card.ts`, `src/shared/types/result.ts`, `src/shared/constants.ts`, `src/shared/domain/date-rules.ts`
- 관련: FR-001 (AC-002, AC-041, AC-042), FR-002 (AC-004), FR-004 (AC-029), FR-007 (AC-014), FR-008 (AC-016), FR-009, FR-011 (AC-035), FR-014 · 예상 LOC: ~240
- 참고: 제목·설명 등의 길이 상한은 `02-data-model.md`에서 정하지 않았으므로 두지 않는다. 명세 v4 재작업: `validateCardInput(input, 'create')`는 `status`를 `todo`·`in_progress`만 허용하고 `done`·목록 밖 값·문자열이 아닌 값을 `status` / `INVALID_VALUE`로 모은다. 이전의 "생성 입력의 `status` → `UNKNOWN_FIELD`" 규칙을 없앤다. `'update'` 모드는 세 값 모두 허용. 새 오류 코드·새 함수 없음.

### `src/shared/domain/card-rules.ts`
- 목적: 카드의 만들기·수정·상태 변경·보관·삭제를 "문서를 받아 새 문서를 돌려주는 순수 함수"로. 검증 → 대상 확인(`CARD_NOT_FOUND`) → 보관 확인(`CARD_ARCHIVED`) → 동작별 조건(`ARCHIVE_NOT_ALLOWED`) 순서. 소유: CardRules.
- 주요 export: `createCard(doc, input, ctx)`, `updateCard(doc, id, patch, ctx)`, `changeStatus(doc, id, status)`, `archiveCard(doc, id, ctx)`, `deleteCard(doc, id)`
- 의존: `src/shared/domain/validation.ts`, `src/shared/domain/date-rules.ts`, `src/shared/domain/rule-support.ts`, `src/shared/types/card.ts`, `src/shared/types/result.ts`
- 관련: FR-001 (AC-001, AC-002, AC-041, AC-042), FR-002 (AC-003, AC-004), FR-004 (AC-007, AC-008), FR-005 (AC-044: 마감일만 바꾸는 `updateCard`), FR-007 (AC-014), FR-008 (AC-016), FR-010 (AC-019, AC-021), FR-011 (AC-022, AC-023, AC-034, AC-035, AC-040) · 예상 LOC: ~230
- 참고: 명세 v4 재작업: `createCard`는 검증된 입력의 `status`(`todo` 또는 `in_progress`, 없으면 `todo`)를 새 카드의 `status`로 쓴다. 진행 중으로 만들어도 진행 기록·`statusAtTime`은 만들지 않는다 (AC-041). `updateCard`는 변경 없음 (캘린더 끌기는 `{ dueDate }` patch 한 번이고 보낸 값이 현재와 같으면 `changed: false`). `deleteCard`는 보관 여부를 보지 않는다: 보관한 카드도 삭제할 수 있다 (AC-040, 사용자 결정 D1, `결정 필요` 1 해소). `updateCard`·`changeStatus`·`archiveCard`는 보관 카드를 `CARD_ARCHIVED`로 거절한다 (`addProgress`는 `progress-rules.ts`).

### `src/shared/domain/card-queries.ts`
- 목적: 목록과 상세 조회 규칙. `scope`('board'/'archive')와 조건 적용. 소유: CardRules.
- 주요 export: `listCards(doc, query)`, `getCardDetail(doc, id)`
- 의존: `src/shared/domain/validation.ts`, `src/shared/domain/query-filter.ts`, `src/shared/domain/rule-support.ts`
- 관련: FR-003 (AC-005), FR-005 (AC-009), FR-010 (AC-019, AC-020), FR-013 (AC-028) · 예상 LOC: ~60

### `src/shared/domain/progress-rules.ts`
- 목적: 진행 기록 추가 규칙 (내용 검증, `statusAtTime`을 main이 채움, 보관 카드 거절). 소유: CardRules.
- 주요 export: `addProgress(doc, cardId, input, ctx)`
- 의존: `src/shared/domain/validation.ts`, `src/shared/domain/rule-support.ts`
- 관련: FR-009 (AC-017, AC-018) · 예상 LOC: ~70

### `src/shared/domain/settings-rules.ts`
- 목적: 화면 밝기 설정 규칙. 같은 값이면 `changed: false`. 문서에 `settings`가 없을 때의 현재 값은 `DEFAULT_THEME`(밝은 판)으로 본다. 소유: CardRules.
- 주요 export: `setTheme(doc, theme)`
- 의존: `src/shared/domain/validation.ts`, `src/shared/domain/rule-support.ts`, `src/shared/constants.ts`
- 관련: FR-014 (AC-037, AC-038) · 예상 LOC: ~40
- 참고: `DEFAULT_THEME`을 쓰므로 `constants.ts`(Wave 1)를 의존에 적었다 (이전 표의 빈틈, Wave 순서 영향 없음).

### main 저장소 (`src/main/store`, Electron 금지)

### `src/main/store/file-system-port.ts`
- 목적: 파일 접근을 좁히는 포트. 시험이 이 다섯 동작에 실패·중단을 주입한다. 소유: NodeFileSystem.
- 주요 export: `FileSystemPort` (`readFile`, `exists`, `writeFileSynced`, `copyFile`, `rename`)
- 의존: 없음
- 관련: FR-006, NFR-002, AC-031, AC-032 · 예상 LOC: ~15

### `src/main/store/data-file-names.ts`
- 목적: 저장 파일 이름 상수 한 곳 (`kanban-data.json`, `kanban-data.json.<프로세스 id>.tmp`, `kanban-data.json.bak`, `kanban-data.pre-v{N}.json`)과 데이터 폴더 이름 `APP_DATA_FOLDER`, 폴더·파일 이름 합치기(`node:path`의 `join`). 임시 파일 이름에 프로세스 id를 붙여 같은 폴더를 쓰는 두 실행의 `.tmp`가 겹치지 않게 한다 (RK-010). 소유: DataFileRepository.
- 주요 export: `DATA_FILE_NAME`, `tempFileName(processId)`, `BACKUP_SUFFIX`, `preVersionName(n)`, `APP_DATA_FOLDER`, `dataFilePath(dir, name)` (`path.join`)
- 의존: 없음
- 관련: FR-006, NFR-002, NFR-003 · 예상 LOC: ~25
- 참고: `node:path`는 파일에 접근하지 않는 순수 문자열 처리라 `src/main/**`에서 허용한다 (`05-architecture.md` 의존 규칙, `결정 필요` 6 해소). 자체 `joinPath`는 두지 않는다 (Windows에서 `/`와 `\`가 섞이는 것을 피한다). 프로세스 id는 `saveDataFile`의 인자로 받아 시험이 고정 값을 줄 수 있다. `APP_DATA_FOLDER`의 값은 구현 시작 전에 정하고 바꾸지 않는다 (표시용 앱 이름과 분리, ADR-012. 개발 실행의 `-dev` 접미사는 `AppLifecycle`이 붙인다). 고아 `.tmp`(다른 프로세스 id의 임시 파일)는 읽을 때 무시하고 앱이 지우지 않는다.

### `src/main/store/node-file-system.ts`
- 목적: `FileSystemPort`의 실제 구현 (`fs/promises`). OS 오류 코드를 보존해 던진다. `rename`에서만 `EPERM`/`EBUSY`/`EACCES`일 때 20~50ms 간격으로 최대 3~5회 다시 시도하고, 모두 실패하면 마지막 오류를 던진다 (백신·검색 색인·클라우드 동기화가 대상 파일을 잠깐 잡을 때의 간헐 오류 완화, RK-013·FE-015. 포트 인터페이스는 그대로). 소유: NodeFileSystem.
- 주요 export: `createNodeFileSystem(): FileSystemPort`, `ensureDirectory(path)` (포트 밖의 한 번짜리 폴더 만들기, `AppLifecycle`이 시작 때 호출)
- 의존: `src/main/store/file-system-port.ts`
- 관련: FR-006, NFR-002 · 예상 LOC: ~90
- 참고: 이 모듈만 `node:fs/promises`에 닿는다. 다시 시도의 정확한 간격과 횟수는 구현 첫 Task에서 정한다 (실패 주입은 `fault-fs.ts`가 하므로 기존 시험에 영향이 없고, 일시 오류 재시도는 `node-file-system.test.ts`가 확인). Windows에서 이름 바꾸기의 덮어쓰기 동작은 확인하지 못했다 (`02-data-model.md`와 같은 미확인, `node-file-system.test.ts`가 확인).

### `src/main/store/store-types.ts`
- 목적: `KanbanStore` 인터페이스와 `createKanbanStore` 인자 타입. IpcHandlers가 구현 없이 인터페이스만 의존하게 한다. 소유: KanbanStore.
- 주요 export: `KanbanStore`, `KanbanStoreDeps` (`dataDir`, `fs`, `clock`, `newId`)
- 의존: `src/shared/types/card.ts`, `src/shared/types/result.ts`, `src/main/store/file-system-port.ts`
- 관련: FR-006, FR-001 ~ FR-014 (모든 화면 함수의 구현 인터페이스) · 예상 LOC: ~60

### `src/main/store/migrations/v1-to-v2.ts`
- 목적: 버전 1 → 2 변환 (`settings = { theme: DEFAULT_THEME }` 채움, 값은 `light`). 한 번 배포한 변환 함수는 지우지 않는다. 이미 `settings`가 있는 문서의 값(`dark` 포함)은 바꾸지 않는다. 소유: SchemaMigrations.
- 주요 export: `migrateV1ToV2(doc)`
- 의존: `src/shared/types/card.ts`, `src/shared/constants.ts`
- 관련: FR-014 (AC-038), NFR-003 · 예상 LOC: ~25
- 참고: 상수 값이 `dark` → `light`로 바뀌어 코드는 그대로이고 시험(`schema-migrations.test.ts`, `data-v1.json` 기대값)만 고친다.

### `src/main/store/migrations/index.ts`
- 목적: `schemaVersion`을 읽어 현재 버전까지 `N → N+1`을 차례로 적용. 현재보다 높은 버전은 `SCHEMA_TOO_NEW`. 메모리에서만 변환. 소유: SchemaMigrations.
- 주요 export: `migrate(raw)`, `MIGRATIONS`
- 의존: `src/main/store/migrations/v1-to-v2.ts`, `src/shared/constants.ts`
- 관련: NFR-003, FR-006 (AC-011) · 예상 LOC: ~80

### `src/main/store/data-file-validator.ts`
- 목적: 읽은 문서의 모양과 불변식 검사 (id 중복 없음, `cardId` 존재, `archivedAt ≠ null`이면 `status = done`, 시각 형식, 현재 버전의 `settings.theme`). 조용히 고치지 않고 `SCHEMA_INVALID`/`INTEGRITY_VIOLATED`로 돌려준다. 소유: DataFileValidator.
- 주요 export: `validateDataFile(value)`
- 의존: `src/shared/domain/validation.ts`, `src/shared/types/card.ts`, `src/shared/constants.ts`
- 관련: FR-006 (AC-032), NFR-002 (저장의 verify 단계도 이 함수), NFR-003 · 예상 LOC: ~220

### `src/main/store/data-file-save.ts`
- 목적: 저장 네 단계 `write_temp → verify → backup → replace` (`write_temp`는 `writeFileSynced` 한 호출로 쓰기와 fsync를 함께 하므로 `sync` 단계는 따로 없고, 디스크 반영 실패도 `write_temp`로 보고한다). 변환된 문서의 첫 저장에는 `kanban-data.pre-v{N}.json` 복사(없을 때만)를 backup에 포함. 소유: DataFileRepository.
- 주요 export: `saveDataFile(deps, next, ctx)` → `{ ok: true } | { ok: false; stage; osCode? }`
- 의존: `src/main/store/data-file-validator.ts`, `src/main/store/data-file-names.ts`, `src/main/store/file-system-port.ts`, `src/shared/types/card.ts`
- 관련: FR-006 (AC-011, AC-031), NFR-002, NFR-003 · 예상 LOC: ~140

### `src/main/store/data-file-repository.ts`
- 목적: 읽기(본 파일 → `.bak` → 처음 실행. 처음 실행의 빈 문서 `settings.theme`은 `DEFAULT_THEME` = `light`), 읽기 실패 원인 분류(`ReadFailure.code` 여섯 가지), `.bak` 상태 조사, 저장 호출 조립. 읽지 못한 파일을 지우거나 덮어쓰지 않는다. 소유: DataFileRepository.
- 주요 export: `createDataFileRepository(deps)` → `{ read(): Promise<ReadOutcome>; save(next, ctx) }`
- 의존: `src/main/store/data-file-save.ts`, `src/main/store/data-file-validator.ts`, `src/main/store/migrations/index.ts`, `src/main/store/data-file-names.ts`, `src/main/store/file-system-port.ts`, `src/shared/types/result.ts`
- 관련: FR-006 (AC-011, AC-032), NFR-002, NFR-003 · 예상 LOC: ~210

### `src/main/store/kanban-store.ts`
- 목적: 화면 함수의 실제 구현. 상태 `ready`/`read_failed`, 변경을 한 줄로 직렬 처리, 저장 성공 뒤에만 메모리 문서와 인덱스 교체, 읽기 실패에서는 `STORE_LOCKED`로 거절하고 쓰기 동작을 부르지 않는다. 소유: KanbanStore.
- 주요 export: `createKanbanStore(deps): KanbanStore`
- 의존: `src/main/store/store-types.ts`, `src/main/store/data-file-repository.ts`, `src/shared/domain/card-rules.ts`, `src/shared/domain/card-queries.ts`, `src/shared/domain/progress-rules.ts`, `src/shared/domain/settings-rules.ts`, `src/shared/domain/rule-support.ts`, `src/shared/types/card.ts`, `src/shared/types/result.ts`
- 관련: FR-001 ~ FR-014 (모든 화면 함수), FR-006 (AC-011, AC-031, AC-032), NFR-002 · 예상 LOC: ~250
- 참고: 250줄 추정이 300줄에 가깝다. 넘기면 한 줄 처리(큐) 부분을 별도 파일로 뺀다 (구현 중 판단, 같은 컴포넌트 소유). 보관한 카드의 삭제를 막지 않는다 (AC-040, `결정 필요` 1 해소).

### main 앱 (`src/main/app`, `src/main/index.ts`)

### `src/main/app/network-guard.ts`
- 목적: 허용 목록(앱 번들 폴더 `out/renderer`의 URL 접두사, `devtools://`, 개발 실행일 때만 개발 서버의 `http:`·`ws:` 주소) 밖 요청 취소, 새 창·이동·권한·`webview` 거부. `file:` 전체를 허용하지 않는다 (RK-008). Chromium 프로세스 자체의 요청(WPAD, DNS 선조회)의 완화 후보를 `restrictChromiumNetwork`에 둔다 (RK-007). 소유: NetworkGuard.
- 주요 export: `installNetworkGuard(session, { allowedPrefixes, dev })`, `lockWindowNavigation(win)`, `restrictChromiumNetwork(app, { dev })`
- 의존: 없음 (electron 패키지)
- 관련: FR-006 (AC-012), NFR-001 · 예상 LOC: ~110
- 참고: `restrictChromiumNetwork`의 후보 — `app.ready` 전 `appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND, EXCLUDE localhost')`, `installNetworkGuard`에서 세션 `setProxy({ mode: 'direct' })` — 는 구현 첫 Task에서 `--log-net-log`로 요청이 0건인지 읽어 확인할 후보이고, 이 설계는 실행해 확인하지 못했다. 효과가 없거나 개발 서버·Playwright를 깨면 적용하지 않는다. Windows의 `file:` 주소 대소문자·퍼센트 인코딩이 접두사 비교와 어긋나지 않는지도 첫 Task에서 확인한다. 개발 실행 판정은 `AppLifecycle`이 `process.env['ELECTRON_RENDERER_URL']` 유무로 정해 `dev`로 넘긴다.

### `src/main/app/window-factory.ts`
- 목적: `BrowserWindow` 생성과 보안 기본값 (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, `webviewTag: false`). 1280x920(`WINDOW_WIDTH` 1280, `WINDOW_HEIGHT` 920. 제목 표시줄을 포함한 바깥 크기의 설계 기본값이고 구현에서 실측해 확정한다, `04-ui-spec.md` `결정 필요` 12, AC-048), 최소 1200x700(`WINDOW_MIN_WIDTH` 1200, `WINDOW_MIN_HEIGHT` 700 유지), `show: false` → `ready-to-show`. 창 바탕색은 저장된 판의 `bg-app`(저장된 값이 없거나 읽기 실패이면 `DEFAULT_THEME` = 밝은 판의 #FAF3EE). 초기 판은 `additionalArguments`로 넘긴다. preload 파일 경로(`join(import.meta.dirname, '../preload/index.cjs')`)와 renderer 진입은 `AppLifecycle`이 만들어 넘긴다. `render-process-gone`과 주 프레임 `did-fail-load`에서 `console.error`로 이유를 남기고 `dialog.showErrorBox`로 알린 뒤 `app.quit()`한다 (FE-007). 소유: WindowFactory.
- 주요 export: `createMainWindow({ initialTheme, preloadPath, rendererEntry })`
- 의존: `src/shared/types/card.ts`, `src/shared/constants.ts`
- 관련: FR-005 (AC-048), FR-014 (AC-037, AC-038), NFR-001 · 예상 LOC: ~110
- 참고 (명세 v4 재작업): 기존 코드의 `WINDOW_HEIGHT`가 800이면 920으로 고친다. 920이 5주인 달의 월 보기를 스크롤 없이 보이게 하는지는 구현에서 실측한다 (확인하지 못함, `04-ui-spec.md` 결정 필요 12). 창 바탕색 두 값(어두운 판 #1F1814, 밝은 판 #FAF3EE)은 `tokens.css`의 `bg-app`과 같은 값을 이름 붙은 상수로 중복해서 가진다 (CSS를 import할 수 없음). 값이 바뀌면 두 곳을 함께 고친다. `sandbox: true`는 `결정 필요` 4 (preload는 CJS `index.cjs`, `electron.vite.config.ts`). `loadFile`·preload 경로는 `AppLifecycle`이 `import.meta.dirname`과 `node:path`로 만든다 (`결정 필요` 6 해소).

### `src/main/app/ipc-handlers.ts`
- 목적: `IPC_CHANNELS`의 열두 채널만 `ipcMain.handle`로 등록. 호출 프레임이 앱 주소인지 확인, 인자를 `unknown`으로 넘김, 예상 못한 예외를 `INTERNAL`로 바꿔 던지지 않는다 (예외를 잡는 유일한 경계). `INTERNAL`을 만들 때 main의 `console.error`로 채널 이름·message·stack을 남긴다 (로그 파일은 만들지 않는다, FE-007·RK-012). 처리 중인 요청 수를 세어 `whenIdle()`을 돌려준다 (창 닫기 대기, RK-002). 소유: IpcHandlers.
- 주요 export: `registerIpcHandlers(store, { appUrlPrefix })` → `{ whenIdle(): Promise<void> }`
- 의존: `src/main/store/store-types.ts`, `src/shared/ipc-contract.ts`, `src/shared/domain/rule-support.ts`, `src/shared/types/result.ts`
- 관련: FR-001 ~ FR-014 (화면 함수 전부), NFR-001 · 예상 LOC: ~160

### `src/main/index.ts` (Wave 9 완성본)
- 목적: 조립 지점. 순서: ⓪(`app.ready` 전) 데이터 폴더 고정 — `--user-data-dir`이 없을 때만 `app.setPath('userData', join(app.getPath('appData'), APP_DATA_FOLDER))` (개발 실행 `!app.isPackaged`는 폴더 이름에 `-dev`를 붙인다, RK-004) → `ensureDirectory` → `NodeFileSystem`/시계/아이디/프로세스 id 주입으로 `KanbanStore` 생성·`open()` → `restrictChromiumNetwork`와 `NetworkGuard` 설치 → `IpcHandlers` 등록 → 저장된 판을 읽어(읽기 실패이면 `DEFAULT_THEME` = 밝은 판) 창 생성. preload·renderer 경로는 `import.meta.dirname`과 `join`으로, 앱 주소 접두사는 `new URL('../renderer/', import.meta.url).href`로 만들어 `WindowFactory`·`NetworkGuard`·`IpcHandlers`에 넘긴다 (`process.env['ELECTRON_RENDERER_URL']`이 있으면 개발 서버 주소로 `loadURL`). 창 `close`에서 `IpcHandlers.whenIdle()`이 끝난 뒤에 닫고, `before-quit`에서 `store.close()`를 기다린 뒤 종료. `process.on('uncaughtException')`은 `console.error` + `dialog.showErrorBox`, `process.on('unhandledRejection')`은 `console.error`. `autoUpdater`, 원격 분석, 충돌 보고, 단일 실행 잠금을 쓰지 않는다. 소유: AppLifecycle.
- 주요 export: 없음 (진입점)
- 의존: `src/main/store/kanban-store.ts`, `src/main/store/node-file-system.ts`, `src/main/store/data-file-names.ts`, `src/main/app/ipc-handlers.ts`, `src/main/app/window-factory.ts`, `src/main/app/network-guard.ts`, `src/shared/constants.ts`
- 관련: FR-006 (AC-011, AC-012), FR-014 (AC-038), NFR-001, NFR-002 · 예상 LOC: ~170
- 참고: 아이디는 전역 `crypto.randomUUID()`를 쓴다 (`node:crypto` import 없음). `node:path`는 허용된다 (`결정 필요` 6 해소). 데이터 폴더 이름은 표시용 앱 이름이 아니라 상수 `APP_DATA_FOLDER`라서 `결정 필요` 3의 앱 이름을 정하지 않아도 정해진다. 시험 전용 분기를 넣지 않는다 (ADR-012). `import.meta.dirname`·`ELECTRON_RENDERER_URL`·`app.setPath`와 `--user-data-dir`의 상호작용은 실행해 확인하지 못했다 (첫 Electron 구동에서 확인). 창이 닫히는 순간 main에 아직 도착하지 않은 요청이 있을 수 있는지도 확인하지 못했다 (`persistence.spec.ts`의 "변경 직후 닫기"로 확인).

### preload

### `src/preload/index.ts` (Wave 5 완성본)
- 목적: `contextBridge.exposeInMainWorld('kanban', api)`로 열두 함수만 노출. 각 함수는 `ipcRenderer.invoke(채널, ...인자)` 한 줄. `additionalArguments`로 받은 초기 판(없거나 알 수 없는 값이면 적지 않고 기본 판은 CSS `:root` = 밝은 판이 정한다)을 `<html data-theme>`에 적는다 (ADR-008): `document.documentElement`가 있으면 바로, 없으면 `MutationObserver`(`childList`)로 `<html>` 생성 직후 한 번 적고 끊는다. 이 적기가 어긋나도 `Bootstrap`의 `settings.get()` 확정이 안전망이다. 출력은 CJS `index.cjs`(`electron.vite.config.ts`). 로직·검증 없음. 소유: PreloadBridge.
- 주요 export: 없음 (진입점). `window.kanban: KanbanApi`
- 의존: `src/shared/ipc-contract.ts`, `src/shared/types/api.ts`, `src/shared/constants.ts`
- 관련: FR-001 ~ FR-014 (화면이 저장소에 닿는 유일한 길), FR-014 (AC-038), NFR-001 · 예상 LOC: ~90
- 참고: `sandbox: true`에서 이 파일의 CJS 출력과 `data-theme` 적기가 동작하는지는 확인하지 못했다 (`결정 필요` 4). 첫 화면 색 깜빡임 여부는 수동 확인에 포함한다.

### renderer 진입, 타입, 문구, 모델, 스타일

### `src/renderer/src/main.tsx` (Wave 12 완성본)
- 목적: Bootstrap. `store.getStatus()` → `ready`면 `settings.get()`으로 `data-theme` 확정 → 보드·보관함 목록을 받아 `AppState`를 채우고 그린다. `read_failed`면 데이터 호출 없이 읽기 실패 화면. 읽는 중이 200ms를 넘을 때만 `저장된 카드를 불러오는 중`을 보인다. 전역 CSS(`tokens.css`, `base.css`, `common.css`, `layout.css`)를 import. 같은 파일에 React 오류 경계 한 개(`AppShell` 바깥, 클래스 컴포넌트 - 규칙의 유일한 예외)를 두어 렌더 오류를 `console.error`로 남기고 `화면을 그리지 못했습니다`와 접힌 `자세히`만 보인다 (FE-007). `window`의 `error`·`unhandledrejection`은 `console.error`만 한다. 소유: Bootstrap.
- 주요 export: 없음 (진입점)
- 의존: `src/renderer/src/layout/AppShell.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/state/theme-controller.ts`, `src/renderer/src/styles/tokens.css`, `src/renderer/src/styles/base.css`, `src/renderer/src/common/common.css`, `src/renderer/src/layout/layout.css`, `src/renderer/src/text/labels.ts`, `src/renderer/src/env.d.ts`
- 관련: FR-006 (AC-011, AC-032), FR-014 (AC-038), FR-003 (AC-006) · 예상 LOC: ~140
- 참고: 아키텍처 `Bootstrap`의 의존 목록에는 `AppShell`이 없지만, 진입 파일이 화면 껍데기를 그리므로 import한다 (모순은 아니고 목록의 빈틈).

### `src/renderer/index.html` (Wave 12 완성본)
- 목적: 제목, 루트 요소. CSP 메타 태그는 이 원본에 두지 않는다: production build에서만 `electron.vite.config.ts`의 플러그인이 `<head>`에 넣는다 (`default-src 'self'; connect-src 'none'; font-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'`, `style-src`는 `'unsafe-inline'`을 쓸지 구현에서 확인). 개발 서버의 인라인 refresh 스크립트와 HMR WebSocket이 막히지 않게 하려는 것이다 (FE-008). 소유: Bootstrap.
- 주요 export: 없음
- 의존: 없음
- 관련: FR-006 (AC-012), NFR-001 · 예상 LOC: ~15
- 참고: CSP 정확한 값은 구현에서 확인한다. 빌드 결과(`out/renderer/index.html`)에 CSP가 들어갔는지를 시험이 확인한다. 제목은 앱 이름(표시용) `결정 필요` 3. 인라인 스크립트를 쓰지 않는다 (ADR-008).

### `src/renderer/src/env.d.ts`
- 목적: `window.kanban: KanbanApi` 선언과 `vite/client` 타입(CSS·글꼴 import). 소유: Bootstrap.
- 주요 export: `declare global { interface Window { kanban: KanbanApi } }`
- 의존: `src/shared/types/api.ts`
- 관련: FR-001 ~ FR-014 (화면의 호출 타입) · 예상 LOC: ~12

### `src/renderer/src/text/labels.ts`
- 목적: 화면 문구 상수 (한국어 고정, ASM-016). 값 이름 → 화면 글자, 오류 코드 → 사용자 문구. `AppError.message`는 진단용이라 화면에 그대로 쓰지 않는다. 소유: Labels.
- 주요 export: `STATUS_LABEL`, `KIND_LABEL`, `PRIORITY_LABEL` (`low` 낮음, `medium` **중간** — v4에서 `보통`이 바뀜, 저장 값은 그대로 —, `high` 높음), 사이드바 필터의 `전체` 문구 상수, `errorText(code)`, `violationText(violation)`, 화면 고정 문구 상수 (읽기 실패 패널의 안내·수동 절차 문구, 저장 실패 문구 두 가지(카드 변경 / 밝기 전환), 저장 단계 문구 `SAVE_STAGE_LABEL`(`write_temp`, `verify`, `backup`, `replace` 네 값. `write_temp`는 임시 파일 쓰기와 디스크 반영), 예상 못한 오류 문구와 `자세히`, 화면 오류 경계 문구, 보관함 삭제 확인 문구 포함)
- 의존: `src/shared/types/card.ts`, `src/shared/types/result.ts`
- 관련: FR-002, FR-007, FR-008 (AC-016), FR-013 (AC-036, AC-047), AC-002, AC-029, AC-031, AC-032, AC-035 · 예상 LOC: ~90
- 참고 (명세 v4 재작업): `PRIORITY_LABEL.medium`을 `보통` → `중간`으로 고친다. 저장 값(`medium`)과 검증은 그대로다. 화면 순서는 `labels.ts`가 아니라 `constants.PRIORITIES` 배열 순서가 정한다. 마감일 입력하다 만 값에는 새 문구를 만들지 않고 기존 `dueDate` 오류 문구(AC-029)를 쓴다.

### `src/renderer/src/model/board-model.ts`
- 목적: 보드·보관함·사이드바의 표시 모델 계산 (React·DOM 없음). 소유: BoardModel.
- 주요 export: `splitByStatus`, `applyConditions`, `countFilters`, `columnCounts`, `overdueCount`, `orderForDisplay(cards, scope)`
- 의존: `src/shared/domain/query-filter.ts`, `src/shared/domain/date-rules.ts`, `src/shared/types/card.ts`
- 관련: FR-003 (AC-005, AC-006), FR-012 (AC-024, AC-025), FR-013 (AC-026, AC-027, AC-028, AC-036, AC-047) · 예상 LOC: ~150
- 참고: `countFilters`가 돌려주는 `total`(범위 전체 수)이 사이드바 `전체` 항목의 건수다. 종류·우선순위별 건수와 같은 범위의 전체에서 센 값이고 검색·필터의 영향을 받지 않는다 (명세 v4 AC-047. 기존 `FilterCounts.total`이 이미 이 의미라 코드 변경은 없을 수 있다). 칸 안 순서는 사용자가 정하지 않았다(CAND-005). `orderForDisplay` 한 곳에 `04-ui-spec.md`의 임시 가정(보드: 만든 순서의 최신이 위, 보관함: 보관한 날 최신이 위)만 둔다.

### `src/renderer/src/model/calendar-model.ts`
- 목적: 캘린더 격자 계산 (ADR-009). 소유: CalendarModel.
- 주요 export: `buildMonthGrid`, `buildWeek`, `groupByDueDate`, `splitVisible(cards, limit)`, `shiftPeriod`, `periodTitle`, `CALENDAR_CHIP_LIMIT = 3`
- 의존: `src/shared/domain/date-rules.ts`, `src/shared/types/card.ts`
- 관련: FR-005 (AC-009, AC-010, AC-019) · 예상 LOC: ~200

### 스타일과 글꼴 (소유: Styles)

### `src/renderer/src/styles/tokens.css`
- 목적: 두 판의 CSS 변수와 `color-scheme`. 기본 판이 밝은 판이 되었으므로(명세 v4) `:root`가 밝은 판, `[data-theme="dark"]`가 어두운 판이다 (`05-architecture.md` ADR-008). `04-ui-spec.md`의 `디자인 토큰` 이름과 값을 그대로 옮긴다.
- 주요 export: `--bg-app`, `--bg-side`, `--text`, `--accent`, `--overdue`, `--status-*`, `--card-*` 등 CSS 변수
- 의존: 없음
- 관련: FR-014 (AC-037, AC-038, AC-039), NFR-004 · 예상 LOC: ~110
- 참고 (명세 v4 재작업): 기존 코드가 `:root`에 어두운 값, `[data-theme='light']`에 밝은 값을 두었다면 두 블록의 값을 서로 바꿔 선택자만 뒤집는다 (색 값과 토큰 이름은 그대로). 두 판의 값이 같은 `04-ui-spec.md` 표에서 온다.

### `src/renderer/src/styles/base.css`
- 목적: `@font-face`(앱에 포함한 woff2만, 외부 주소 없음)와 기본 스타일, 움직임 줄이기 설정.
- 주요 export: 없음 (전역 스타일)
- 의존: `src/renderer/src/styles/fonts/SUIT-Variable.woff2`
- 관련: FR-014, NFR-001 (외부 글꼴 금지), NFR-004 · 예상 LOC: ~70

### `src/renderer/src/styles/fonts/SUIT-Variable.woff2`
- 목적: SUIT Variable 글꼴 (굵기 400~700), 앱에 포함 (NFR-001)
- 주요 export: 바이너리 자산
- 의존: 없음
- 관련: NFR-001 · 예상 LOC: - (바이너리)
- 참고: 파일 출처, 용량, 확보 방법은 확인하지 못했다. `결정 필요` 7. 라이선스는 SIL OFL 1.1이라고 `04-ui-spec.md`가 저장소 README에서 확인했을 뿐 원문은 열어 보지 못했다.

### `src/renderer/src/styles/fonts/SUIT-LICENSE.txt`
- 목적: OFL 조건에 따라 글꼴과 함께 두는 저작권·라이선스 문구
- 주요 export: 텍스트 자산
- 의존: 없음
- 관련: NFR-001 · 예상 LOC: ~100 (원문 길이 미확인 추정)
- 참고: 내용은 글꼴 저장소의 원문이어야 한다. 이 설계 단계에서는 원문을 열어 보지 못했고 임의로 쓰지 않는다. `결정 필요` 7.

### 공통 UI (`src/renderer/src/common`, 소유: CommonUi)

### `src/renderer/src/common/Icon.tsx`
- 목적: 인라인 SVG 아이콘 약 16개 (14px 격자, 선 굵기 1.3~1.6). 아이콘 라이브러리를 들이지 않는다.
- 주요 export: `Icon` (`name` prop: 벌레, 체크, 삼각형(마감 지남), 오류, 체크 원, 달, 해, 더보기 `⋯` 등)
- 의존: 없음
- 관련: FR-007 (AC-013), FR-012 (AC-024), NFR-001 (외부 아이콘 없음), NFR-004 (AC-039) · 예상 LOC: ~150
- 참고: 도형의 출처(직접 그린 것인지, 외부 아이콘 세트에서 옮긴 것인지)는 설계 문서에 적혀 있지 않다. 임시 가정: 직접 작성한 도형이다. 외부 세트에서 옮기면 라이선스 확인이 필요하다 (`결정 필요` 7).

### `src/renderer/src/common/SegmentedControl.tsx`
- 목적: 분할 버튼 (종류, 우선순위, 월/주)
- 주요 export: `SegmentedControl`
- 의존: 없음
- 관련: FR-005, FR-007, FR-008 · 예상 LOC: ~60

### `src/renderer/src/common/RadioRow.tsx`
- 목적: 사이드바 필터(`전체` 행 포함)와 화면 밝기의 라디오 행
- 주요 export: `RadioRow`
- 의존: 없음
- 관련: FR-013 (AC-047), FR-014 · 예상 LOC: ~50

### `src/renderer/src/common/Menu.tsx`
- 목적: 상태 이동 메뉴와 날짜 팝업이 쓰는 메뉴·팝오버. `popover` 속성 또는 직접 구현 (ADR-011).
- 주요 export: `Menu`, `Popover`
- 의존: 없음
- 관련: FR-002, FR-005 · 예상 LOC: ~120
- 참고: Electron 창에서 `popover`의 동작은 확인하지 못했다 (ADR-011).

### `src/renderer/src/common/common.css`
- 목적: 공통 UI 스타일. 포커스 링, 칩, 버튼, 입력칸, 알림 줄 등.
- 주요 export: 없음
- 의존: 없음
- 관련: NFR-004 · 예상 LOC: ~250

### `src/renderer/src/common/Button.tsx`
- 목적: 주요·보조·글자 버튼과 아이콘 버튼 (높이 28~36, 포커스 링)
- 주요 export: `Button`, `IconButton`
- 의존: `src/renderer/src/common/Icon.tsx`
- 관련: FR-001, FR-002, FR-011 · 예상 LOC: ~80

### `src/renderer/src/common/TextFields.tsx`
- 목적: 글 입력과 여러 줄 입력. 항상 라벨, 오류 줄(오류 아이콘 + 문구, 2px 테두리).
- 주요 export: `TextInput`, `TextArea`
- 의존: `src/renderer/src/common/Icon.tsx`
- 관련: FR-001 (AC-002), FR-004 (AC-029), FR-008, FR-011 (AC-035) · 예상 LOC: ~110

### `src/renderer/src/common/Chips.tsx`
- 목적: 칩, 종류 칩(벌레/체크 아이콘 + 글자, 채움/테두리), 우선순위 표시(막대 3개 + 글자). 색 외 구분이 만들어지는 두 곳 중 하나.
- 주요 export: `Chip`, `KindChip`, `PriorityMark`
- 의존: `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/types/card.ts`
- 관련: FR-007 (AC-013), FR-008 (AC-016), FR-014 (AC-039), NFR-004 · 예상 LOC: ~130

### `src/renderer/src/common/DueText.tsx`
- 목적: `마감 11/06`, `마감 없음`, 마감 지남 모양(삼각형 아이콘 + `MM/DD · N일 지남` + 2px 테두리). 색 외 구분이 만들어지는 다른 한 곳.
- 주요 export: `DueText` (props: `dueDate`, `status`, `today`)
- 의존: `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/domain/date-rules.ts`
- 관련: FR-004 (AC-007), FR-012 (AC-024, AC-025), FR-014 (AC-039), NFR-004 · 예상 LOC: ~70

### `src/renderer/src/common/Banner.tsx`
- 목적: 저장 실패 알림 줄 (`role="alert"`) 또는 대화상자 안 알림. 예상 못한 오류(`INTERNAL`)는 일반 문구와 접힌 `자세히`(진단 문장)로 보인다
- 주요 export: `Banner` (props: `message`, `detail`(선택, 접힌 `자세히`), `actionLabel`, `onAction`)
- 의존: `src/renderer/src/common/Icon.tsx`, `src/renderer/src/common/Button.tsx`
- 관련: FR-006 (AC-031) · 예상 LOC: ~60
- 참고: `다시 저장`은 실패한 요청 한 건을 그대로 다시 보낸다 (`결정 필요` 2 해소: 칸 이동·보관·삭제는 화면이 바뀌지 않은 채 그대로라 쌓아 둘 변경이 없다).

### `src/renderer/src/common/EmptyState.tsx`
- 목적: 빈 칸·빈 목록·결과 없음 문구
- 주요 export: `EmptyState` (props: `message`, `actionLabel`)
- 의존: `src/renderer/src/common/Button.tsx`
- 관련: FR-003 (AC-006), FR-013 (AC-036) · 예상 LOC: ~40

### `src/renderer/src/common/SearchBox.tsx`
- 목적: 보드와 보관함이 공유하는 검색 입력
- 주요 export: `SearchBox` (props: `value`, `onChange`, `onClear`)
- 의존: `src/renderer/src/common/Icon.tsx`, `src/renderer/src/common/TextFields.tsx`
- 관련: FR-013 (AC-026, AC-028) · 예상 LOC: ~70

### 레이아웃 (`src/renderer/src/layout`, 소유: AppShell)

### `src/renderer/src/layout/layout.css`
- 목적: 사이드바(208px)·상단 막대·본문·하단 줄(36px) 배치 스타일. 막대·하단 줄 클래스(`.top-bar*`, `.app-shell__statusbar`)는 이 파일에만 둔다 (`AppShell`이 소유). 화면 CSS(`board.css`, `calendar.css`, `archive.css`)에는 `*-topbar`, `*-statusbar` 클래스를 두지 않는다.
- 주요 export: 없음
- 의존: 없음
- 관련: FR-003, FR-005, FR-010, FR-014 · 예상 LOC: ~200

### `src/renderer/src/layout/TopBar.tsx`
- 목적: 화면마다 다른 상단 막대 (제목, 검색, `카드 만들기`). 읽기 실패에서는 눌리지 않게(`disabled`). 캘린더 화면에서는 `보드로 돌아가기` 오른쪽에 `children`(`AppShell`이 넣는 `PeriodNav`와 `월 | 주` 분할 버튼)을 놓는다. 소유: AppShell.
- 주요 export: `TopBar`
- 의존: `src/renderer/src/state/app-state.tsx`, `src/renderer/src/common/SearchBox.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-001, FR-013 (AC-026) · 예상 LOC: ~90

### `src/renderer/src/layout/Sidebar.tsx`
- 목적: 앱 이름, 이동 3항목(건수), 종류·우선순위 필터(보드·보관함에서만. 두 목록 모두 맨 위에 `전체` 항목, 처음 `전체` 선택, 라디오 방식, 선택된 항목을 다시 눌러도 해제하지 않음. `전체`를 고르면 그 조건을 `undefined`로 돌린다. `전체`의 건수는 `countFilters`의 `total`, 우선순위 목록은 `전체`, `낮음`, `중간`, `높음` 순서 — `PRIORITIES` 배열 순서 — 로 `없음`은 없다. AC-047), 화면 밝기 라디오, 저장 상태(`내 PC에 저장됨`/`저장 중`/`저장하지 못함`/`읽지 못함`). NavList, FilterGroup, ThemeSwitch, SaveStatus를 한 파일에 둔다 (각 30~80줄).
- 주요 export: `Sidebar`
- 의존: `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/theme-controller.ts`, `src/renderer/src/model/board-model.ts`, `src/renderer/src/common/RadioRow.tsx`, `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-003, FR-006 (AC-011, AC-031), FR-010, FR-013 (AC-027, AC-047), FR-014 (AC-037, AC-038) · 예상 LOC: ~240
- 참고 (명세 v4 재작업): 기존 `FilterGroup`은 같은 항목을 다시 누르면 `undefined`로 해제하고 `전체` 항목이 없다. `전체` 항목을 목록 맨 위에 더하고 해제 동작을 없앤다. 앱 이름 표시는 `결정 필요` 3. 임시 가정: 이름 상수 한 곳(`labels.ts`)에서 가져온다. 저장 상태 표시: `saving`이면 `저장 중`, `failed`이면 `저장하지 못함` (`결정 필요` 2 해소).

### `src/renderer/src/layout/AppShell.tsx`
- 목적: 사이드바 + 상단 막대(`TopBar`) + 본문 + 하단 줄의 자리와 소유 (화면 컴포넌트는 막대·하단 줄을 그리지 않는다). 캘린더 화면에서는 `PeriodNav`와 `월 | 주` 분할 버튼(`SegmentedControl`)을 `TopBar`의 children으로 넣고 `UiState.calendar`의 기준 날짜·보기를 바꾼다. 하단 줄 내용은 현재 화면에 따라 정한다: 보드 `카드 N건 · 보관함 N건`, 캘린더 `N월에 마감인 카드 N건`, 보관함 `보관함 N건`. 저장 실패 알림 줄(`Banner`. 문구는 `saveFailureMessage(request)`가 실패한 요청 종류로 고른다: `setTheme`은 밝기 전환 문구, `moveCard`·`moveDueDate`·`archiveCard`·`deleteCard`는 카드 변경 문구, 대화상자 안의 `createCard`·`updateCard`·`addProgress` 실패는 알림 줄에 나오지 않는다 — `moveDueDate` 추가는 AC-046), 화면 키(`board`/`calendar`/`archive`)에 따른 본문 전환, 카드 대화상자를 본문 위에 얹기. 읽기 실패이면 본문 전체를 `ReadFailurePanel`로 대체하고 이동·검색·필터·`카드 만들기`를 비활성화.
- 주요 export: `AppShell`
- 의존: `src/renderer/src/layout/Sidebar.tsx`, `src/renderer/src/layout/TopBar.tsx`, `src/renderer/src/features/calendar/PeriodNav.tsx`, `src/renderer/src/common/SegmentedControl.tsx`, `src/renderer/src/model/calendar-model.ts`, `src/shared/domain/date-rules.ts`, `src/renderer/src/features/board/BoardScreen.tsx`, `src/renderer/src/features/calendar/CalendarScreen.tsx`, `src/renderer/src/features/archive/ArchiveScreen.tsx`, `src/renderer/src/features/card-dialog/CardDialog.tsx`, `src/renderer/src/features/load-error/ReadFailurePanel.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/common/Banner.tsx`
- 관련: FR-006 (AC-031, AC-032, AC-046), FR-003, FR-005, FR-010 · 예상 LOC: ~160
- 참고: 아키텍처 `AppShell`의 의존 목록에는 `ChangeRunner`가 없지만 알림 줄의 `다시 저장`이 `retryFailed`를 부르므로 import한다 (목록의 빈틈). 저장 실패 뒤에도 새 변경 조작을 막지 않는다 (`결정 필요` 2 해소: 칸 이동·보관·삭제는 낙관적이지 않아 실패해도 화면이 저장소와 같다).

### 상태 (`src/renderer/src/state`, 소유: AppState, ChangeRunner, ThemeController)

### `src/renderer/src/state/state-types.ts`
- 목적: `DataState`(boot 상태, 보드·보관함 카드 목록, 판), `UiState`(화면 키, 보드·보관함 조건, 캘린더 보기·기간, 열린 대화상자), `SaveState`(`saved`/`saving`/`failed`/`unavailable`, 재시도 대상)의 모양과 액션. 소유: AppState.
- 주요 export: `DataState`, `UiState`, `SaveState`, `Action`, `ScreenKey`, `ChangeRequest` (변경 요청 종류: `createCard`, `updateCard`, `moveCard`, **`moveDueDate`** (`{ id, dueDate }`, 명세 v4 캘린더 끌기), `archiveCard`, `deleteCard`, `addProgress`, `setTheme`)
- 의존: `src/shared/types/card.ts`, `src/shared/types/result.ts`, `src/renderer/src/model/board-model.ts`, `src/renderer/src/model/calendar-model.ts`
- 관련: FR-003, FR-005 (AC-044, AC-046), FR-006 (AC-031), FR-013 · 예상 LOC: ~105
- 참고: 캘린더 끌기에서 끌리는 카드 id는 `UiState`에 넣지 않고 `CalendarScreen`의 지역 상태로 쥐므로 UiState·reducer 변경은 없다.

### `src/renderer/src/state/reducers.ts`
- 목적: 세 상태의 reducer (순수). 화면 조건은 저장하지 않는다 (앱이 켜져 있는 동안만). 소유: AppState.
- 주요 export: `dataReducer`, `uiReducer`, `saveReducer`
- 의존: `src/renderer/src/state/state-types.ts`, `src/renderer/src/model/calendar-model.ts`, `src/renderer/src/model/board-model.ts`, `src/shared/types/card.ts`, `src/shared/constants.ts`
- 관련: FR-003, FR-005, FR-006 (AC-031), FR-013, FR-014 (AC-038) · 예상 LOC: ~170
- 참고: `DataState`의 초기 `theme`은 `DEFAULT_THEME`(`light`)이다 (부팅 중 `Bootstrap`이 `settings.get()`으로 확정하기 전의 값, 명세 v4). `SaveState`는 진행 중 요청 수(`saving`)와 다시 보낼 요청 한 건(`failed`)을 가진다. 칸 이동·보관·삭제·만들기·수정·기록 추가는 저장 성공 뒤에만 `DataState`에 반영되고, 판 전환만 먼저 반영된다 (`결정 필요` 2 해소).

### `src/renderer/src/state/app-state.tsx`
- 목적: Context 세 개(`DataState`, `UiState`, `SaveState`)와 Provider, 훅. 상태를 바꾸는 쪽은 `ChangeRunner`와 `Bootstrap`뿐. 소유: AppState.
- 주요 export: `AppStateProvider`, `useData()`, `useUi()`, `useSaveState()`, `useDispatch()`
- 의존: `src/renderer/src/state/reducers.ts`, `src/renderer/src/state/state-types.ts`
- 관련: FR-003, FR-005, FR-006, FR-013 · 예상 LOC: ~110

### `src/renderer/src/state/change-runner.ts`
- 목적: 화면의 모든 변경 호출을 한 곳에서 실행. 변경을 renderer에 쌓지 않고 즉시 `window.kanban`으로 보내 결과를 기다린다 (순서는 IPC와 main의 줄이 지킨다, RK-002). 판 전환(`setTheme`)만 낙관적이고 나머지(칸 이동·보관·삭제·만들기·수정·기록 추가)는 `ok: true`를 받은 뒤에만 화면 사본을 바꾼다 (사용자 결정 D2). `SaveState` 갱신, `SAVE_FAILED`면 화면이 바뀌지 않은 채 `다시 저장`을 위해 실패한 요청 한 건을 기억 (캘린더 끌기의 `moveDueDate`도 같다, AC-046), `CARD_NOT_FOUND`·`CARD_ARCHIVED`·`ARCHIVE_NOT_ALLOWED`는 main의 목록을 다시 받아 사본만 맞춤, `STORE_LOCKED`면 읽기 실패 화면으로. 롤백·쌓아 둔 변경 처리가 없다. 소유: ChangeRunner.
- 주요 export: `createChangeRunner({ api, getData, dispatch })` (`api`는 `KanbanApi`를 인자로 받아 시험이 가짜를 주입한다. `window`를 읽지 않는다) → `createCard`, `updateCard`, `moveCard`, `moveDueDate(id, dueDate)` (`cards.update(id, { dueDate })` 한 호출. 성공 처리는 `updateCard`와 같고 종류만 따로 두어 실패를 알림 줄로 알린다, `05-architecture.md` ChangeRunner), `archiveCard`, `deleteCard`, `addProgress`, `setTheme`, `retryFailed`. `useChanges()` 훅은 `app-state.tsx`의 훅으로 상태를 읽고 `window.kanban`을 `createChangeRunner`에 넘겨 같은 목록을 돌려준다.
- 의존: `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/state-types.ts`, `src/renderer/src/env.d.ts`, `src/shared/types/api.ts`, `src/shared/types/result.ts`
- 관련: FR-001 (AC-041), FR-002 (AC-003), FR-005 (AC-044, AC-046), FR-009, FR-010, FR-011, FR-014, FR-006 (AC-031, AC-032), FR-011 (AC-040) · 예상 LOC: ~240
- 참고: 낙관적 반영·롤백·재동기화가 없어져 단순해졌다 (판 전환만 낙관적). `createChangeRunner`를 순수 함수로 분리한 것은 `tests/cli/state/change-runner.test.ts`가 가짜 `KanbanApi`로 시험하기 위해서다 (FE-006). 이 시험 파일은 `app-state.tsx`(JSX)를 불러오므로 `tsconfig.web.json`이 검사한다 (`tsconfig.node.json`은 제외). `다시 저장`은 실패한 요청 한 건을 그대로 다시 보낸다 (`결정 필요` 2 해소). 창을 닫을 때 진행 중인 요청의 완료 대기는 main(`IpcHandlers.whenIdle`)이 맡는다.

### `src/renderer/src/state/theme-controller.ts`
- 목적: `<html data-theme>` 적용과 판 전환 연결. 판을 고르면 즉시 `data-theme`를 바꾸고 `setTheme`으로 저장. 저장이 실패하거나 읽기 실패 상태여도 이번 실행 동안 판을 유지. 소유: ThemeController.
- 주요 export: `useTheme(): { theme; setTheme }`, `applyTheme(theme)`
- 의존: `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/shared/constants.ts`
- 관련: FR-014 (AC-037, AC-038, AC-039) · 예상 LOC: ~60

### 화면: 보드 (`src/renderer/src/features/board`, 소유: BoardScreen)

### `src/renderer/src/features/board/board.css`
- 목적: 보드 화면 스타일 (칸, 카드, 칸 색, 마감 지남 테두리, 끌기 허용 표시). 상단 막대·하단 줄은 `AppShell`이 소유하므로 `.board-topbar*`, `.board-statusbar` 같은 `*-topbar`, `*-statusbar` 클래스는 쓰지 않는다 (이미 만든 CSS의 해당 클래스 제거는 재작업 Task 몫).
- 주요 export: 없음
- 의존: 없음
- 관련: FR-003, FR-012, NFR-004 · 예상 LOC: ~220

### `src/renderer/src/features/board/CardMoveMenu.tsx`
- 목적: 끌지 않는 대안인 `⋯` 상태 이동 메뉴 (WCAG 2.5.7)
- 주요 export: `CardMoveMenu` (props: `status`, `onMove`)
- 의존: `src/renderer/src/common/Menu.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/types/card.ts`
- 관련: FR-002 (AC-003) · 예상 LOC: ~70

### `src/renderer/src/features/board/ArchiveConfirm.tsx`
- 목적: 완료 카드 보관의 인라인 확인 (`04-ui-spec.md` 결정 필요 3의 임시 안전장치)
- 주요 export: `ArchiveConfirm`
- 의존: `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-010 (AC-019, AC-021) · 예상 LOC: ~50

### `src/renderer/src/features/board/OverdueSummary.tsx`
- 목적: 정보 줄의 마감 지난 카드 요약
- 주요 export: `OverdueSummary`
- 의존: `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-012 (AC-024) · 예상 LOC: ~50

### `src/renderer/src/features/board/ConditionBar.tsx`
- 목적: 검색어·종류·우선순위 조건 칩 줄, 결과 건수, `조건 모두 지우기`. 보드와 보관함이 공유.
- 주요 export: `ConditionBar` (props: `search`, `kind`, `priority`, `resultCount`, `totalCount`, `onClear`)
- 의존: `src/renderer/src/common/SearchBox.tsx`, `src/renderer/src/common/Chips.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-013 (AC-026, AC-027, AC-036) · 예상 LOC: ~110
- 참고: `ArchiveScreen`이 이 파일을 다른 feature 폴더에서 import한다 (아키텍처 컴포넌트 소유가 `BoardScreen`이라 그 폴더에 둠).

### `src/renderer/src/features/board/CardItem.tsx`
- 목적: 카드 한 장. 끌기(`draggable`), `⋯` 메뉴, 보관 확인, 종류 칩·우선순위·마감 표시. 메모이제이션 (ADR-006).
- 주요 export: `CardItem` (props: `card`, `overdue`, `onOpen`, `onMove`, `onArchive`)
- 의존: `src/renderer/src/features/board/CardMoveMenu.tsx`, `src/renderer/src/features/board/ArchiveConfirm.tsx`, `src/renderer/src/common/Chips.tsx`, `src/renderer/src/common/DueText.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/domain/date-rules.ts`
- 관련: FR-002 (AC-003), FR-007 (AC-013), FR-008, FR-010, FR-012 (AC-024, AC-025), FR-014 (AC-039) · 예상 LOC: ~150
- 참고: Electron 창에서 HTML5 끌기가 의도대로 도는지는 확인하지 못했다 (ADR-010).

### `src/renderer/src/features/board/Column.tsx`
- 목적: 칸 하나 (머리 `2 / 6` 건수, 카드 목록, `dragover`/`drop`으로 상태 변경). 끌리는 카드 id는 시작 때 `dataTransfer`와 UI 상태 양쪽에 둔다.
- 주요 export: `Column`
- 의존: `src/renderer/src/features/board/CardItem.tsx`, `src/renderer/src/common/EmptyState.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-002 (AC-003), FR-003 (AC-005, AC-006) · 예상 LOC: ~110

### `src/renderer/src/features/board/BoardScreen.tsx`
- 목적: SCR-001 본문. 칸 세 개 배치(`Board`), 정보 줄(오늘, 마감 지난 카드 요약), 조건 줄, 카드 열기, 결과 없음 표시. 상단 막대(검색, `카드 만들기`)와 하단 줄(`카드 N건 · 보관함 N건`)은 그리지 않는다 (`AppShell`이 소유). 마감 지남은 그릴 때마다 `todayLocal(new Date())`로 새로 구한 오늘로 판정 (저장하지 않음).
- 주요 export: `BoardScreen`
- 의존: `src/renderer/src/features/board/Column.tsx`, `src/renderer/src/features/board/ConditionBar.tsx`, `src/renderer/src/features/board/OverdueSummary.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/model/board-model.ts`, `src/renderer/src/common/EmptyState.tsx`, `src/shared/domain/date-rules.ts`
- 관련: FR-001, FR-002, FR-003 (AC-005, AC-006), FR-010, FR-012 (AC-024, AC-025), FR-013 (AC-026, AC-027, AC-036) · 예상 LOC: ~170

### 화면: 카드 대화상자 (`src/renderer/src/features/card-dialog`, 소유: CardDialog)

### `src/renderer/src/features/card-dialog/card-dialog.css`
- 목적: 대화상자 스타일 (`<dialog>`, 바닥 줄, 확인 줄)
- 주요 export: 없음
- 의존: 없음
- 관련: FR-001, FR-009, FR-011 · 예상 LOC: ~220

### `src/renderer/src/features/card-dialog/card-form-state.ts`
- 목적: 입력칸 값(문자열)과 `CardCreateInput`/`CardPatch` 사이의 변환, 저장 전 미리 검증(`Validation` 재사용), 빈 마감일/우선순위를 `null`로. React 없음 (cli에서 시험). 명세 v4: (1) 새 카드의 `status`(처음 `todo`, 선택 가능 값 `todo`·`in_progress`)를 `toCreateInput`이 입력의 `status`로 싣는다 (AC-041). (2) 마감일 값은 `YYYY-MM-DD` 문자열(날짜 입력 칸이 내는 값)이고, 입력하다 만 값(`validity.badInput`)이 있다는 표시(`FormValues`의 마감일 읽기 실패 플래그)가 켜져 있으면 `fieldErrors`가 기존 `dueDate` / `INVALID_DATE` 오류를 돌려 저장하지 않게 한다 (AC-029, `04-ui-spec.md` 결정 필요 13의 임시 가정).
- 주요 export: `FormValues`, `emptyForm()`, `formFromCard(card)`, `toCreateInput(values)`, `toPatch(values, card)`, `fieldErrors(values)` (새 카드 모드의 상태 선택 목록은 `constants.ts`의 `CREATE_STATUSES`를 쓴다)
- 의존: `src/shared/domain/validation.ts`, `src/shared/types/card.ts`, `src/shared/types/result.ts`
- 관련: FR-001 (AC-002, AC-041), FR-004 (AC-007, AC-008, AC-029, AC-043), FR-007 (AC-014), FR-008 (AC-015, AC-016), FR-011 (AC-022, AC-035) · 예상 LOC: ~130

### `src/renderer/src/features/card-dialog/ProgressLog.tsx`
- 목적: 진행 기록 목록 (오래된 것이 위, 기록마다 그때의 상태 칩)
- 주요 export: `ProgressLog`
- 의존: `src/renderer/src/common/Chips.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/types/card.ts`
- 관련: FR-009 (AC-017, AC-018) · 예상 LOC: ~70

### `src/renderer/src/features/card-dialog/ProgressInput.tsx`
- 목적: 진행 기록 입력과 `기록 추가` (카드 저장과 별개로 즉시 저장)
- 주요 export: `ProgressInput`
- 의존: `src/renderer/src/common/TextFields.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-009 (AC-017) · 예상 LOC: ~70

### `src/renderer/src/features/card-dialog/DeleteConfirmBar.tsx`
- 목적: 삭제 확인 바닥 줄 (`삭제 확인` / `취소`)
- 주요 export: `DeleteConfirmBar`
- 의존: `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-011 (AC-033) · 예상 LOC: ~50
- 참고: 보기 전용(보관한 카드) 모드에서도 삭제가 나온다 (AC-040, `결정 필요` 1 해소). 삭제 확인 뒤 저장이 성공해야 대화상자가 닫히고, 실패하면 확인 줄이 남는다 (낙관적 반영 없음).

### `src/renderer/src/features/card-dialog/CardForm.tsx`
- 목적: 입력칸 묶음 (제목, 종류 분할 버튼, 상태, 우선순위, 마감일, 설명, 메모). 모드가 `readonly`면 입력 불가. 명세 v4: (1) 상태는 내장 `select`이고 잠그지 않는다. 새 카드 모드는 `할 일`(처음 선택)·`진행 중` 두 항목뿐(`완료` 없음), 상세(편집) 모드는 세 항목 (AC-041, AC-042). (2) 마감일은 브라우저 기본 `<input type="date">`(달력 아이콘, 값 `YYYY-MM-DD`, 칸을 지우면 마감 없음)이고, 입력하다 만 값은 `validity.badInput`을 읽어 `card-form-state`의 플래그로 올려 기존 마감일 오류 문구를 보이게 한다 (AC-043, AC-029). 외부 날짜 라이브러리를 쓰지 않는다. (3) 우선순위 분할 버튼은 `없음`, `낮음`, `중간`, `높음` 순서이고 `없음` 뒤는 `PRIORITIES` 배열 순서를 `map`한 것이다.
- 주요 export: `CardForm` (props: `values`, `errors`, `mode`, `onChange`)
- 의존: `src/renderer/src/features/card-dialog/card-form-state.ts`, `src/renderer/src/common/TextFields.tsx`, `src/renderer/src/common/SegmentedControl.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-001 (AC-002, AC-041, AC-042), FR-004 (AC-007, AC-008, AC-029, AC-043), FR-007 (AC-013, AC-014), FR-008 (AC-015, AC-016), FR-011 (AC-035) · 예상 LOC: ~250

### `src/renderer/src/features/card-dialog/CardDialog.tsx`
- 목적: SCR-002. 모드 `new`/`edit`/`readonly`, 열 때 `cards.get(id)`로 카드와 기록 받기, `<dialog>` + `showModal()` (ADR-011), 새 카드 모드는 고른 상태(`할 일`/`진행 중`)를 `createCard` 입력의 `status`로 보내기 (AC-041), 저장 전 미리 검증(마감일에 입력하다 만 값이 있으면 저장하지 않음)과 `VALIDATION_FAILED`의 `field`를 입력칸에 붙이기, 저장 실패 시 열어 둔 채 입력 유지, 삭제는 확인 뒤에만, 닫으면 미저장 입력 버림.
- 주요 export: `CardDialog` (props: `mode`, `cardId`, `onClose`)
- 의존: `src/renderer/src/features/card-dialog/CardForm.tsx`, `src/renderer/src/features/card-dialog/ProgressLog.tsx`, `src/renderer/src/features/card-dialog/ProgressInput.tsx`, `src/renderer/src/features/card-dialog/DeleteConfirmBar.tsx`, `src/renderer/src/features/card-dialog/card-form-state.ts`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/common/Banner.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-001 (AC-001, AC-002, AC-041, AC-042), FR-002, FR-004 (AC-029, AC-043), FR-005 (AC-030), FR-008, FR-009, FR-010, FR-011 (AC-022, AC-023, AC-033, AC-034, AC-035, AC-040), FR-006 (AC-031) · 예상 LOC: ~230
- 참고: Electron 창에서 `<dialog>`의 동작은 확인하지 못했다 (ADR-011). 보관한 카드의 보기 전용 모드에 삭제를 둔다 (AC-040, `결정 필요` 1 해소). 입력 중 닫기 경고는 없다 (`04-ui-spec.md` 결정 필요 5의 임시 가정).

### 화면: 캘린더 (`src/renderer/src/features/calendar`, 소유: CalendarScreen)

### `src/renderer/src/features/calendar/calendar.css`
- 목적: 캘린더 스타일 (격자, 칩, 오늘 칸, 팝업, 범례, `.period-nav*`, 끌리는 칩 투명도 50%, 놓을 수 있는 칸의 점선 윤곽). 상단 막대·하단 줄은 `AppShell`이 소유하므로 `.calendar-topbar*`, `.calendar-statusbar` 같은 `*-topbar`, `*-statusbar` 클래스는 쓰지 않는다 (제거는 T-033 재작업 몫).
- 주요 export: 없음
- 의존: 없음
- 관련: FR-005, FR-012, NFR-004 · 예상 LOC: ~220

### `src/renderer/src/features/calendar/CalendarChip.tsx`
- 목적: 날짜 칸의 카드 칩 (종류 아이콘, 완료는 흐린 제목 + 원 안 체크, 마감 지난 카드는 붉은 칩). 명세 v4: 끄는 것. `draggable`이고 `dragstart`에서 카드 id를 `dataTransfer`(`CHIP_DRAG_TYPE`)에 싣고 `onDragStart`로 올린다. 끌리는 칩은 투명도 50%. `variant`가 `popover`(`DayPopover` 안)이면 끌 수 없다 (`draggable={false}`).
- 주요 export: `CalendarChip` (props: `card`, `today`, `variant`(month/week/popover), `onOpen`, `dragging`, `onDragStart`), `CHIP_DRAG_TYPE` (캘린더 칩 전용 드래그 데이터 타입 상수. 보드의 `CARD_DRAG_TYPE`을 쓰지 않는다, ADR-013)
- 의존: `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/domain/date-rules.ts`, `src/shared/types/card.ts`
- 관련: FR-005 (AC-009, AC-030, AC-044), FR-012, FR-007, NFR-004 · 예상 LOC: ~90

### `src/renderer/src/features/calendar/PeriodNav.tsx`
- 목적: 이전·다음·`오늘로 이동`, 기간 제목. `AppShell`이 `TopBar`의 children으로 넣고, `월 | 주` 분할 버튼은 `PeriodNav`의 children으로 받는다.
- 주요 export: `PeriodNav`
- 의존: `src/renderer/src/common/Button.tsx`, `src/renderer/src/model/calendar-model.ts`
- 관련: FR-005 · 예상 LOC: ~70

### `src/renderer/src/features/calendar/DayCell.tsx`
- 목적: 날짜 칸 (칩 3개 + `+N건 더 보기`). 명세 v4: 놓는 곳. `dragover`에서 놓을 수 있다는 표시(2px 점선 윤곽 + 옅은 바탕)를 켜고 `drop`에서 `onDropCard(cardId, cell.date)`를 부른다. 이 달 밖 칸에도 놓을 수 있다. 같은 날짜인지 판단하지 않고 부르기만 한다(판단은 `CalendarScreen`).
- 주요 export: `DayCell` (props: `cell`, `cards`, `today`, `mode`, `onOpenCard`, `onShowMore`, `draggingId`, `onDragStart`, `onDropCard`)
- 의존: `src/renderer/src/features/calendar/CalendarChip.tsx`, `src/renderer/src/model/calendar-model.ts`
- 관련: FR-005 (AC-009, AC-044, AC-045) · 예상 LOC: ~120

### `src/renderer/src/features/calendar/DayPopover.tsx`
- 목적: `+N건 더 보기` 팝업 (칸에 다 못 보인 카드 목록). 팝업 안의 칩은 끌 수 없다 (`variant="popover"`, 끌지 않는 방법은 칩을 눌러 카드 입력 화면에서 마감일을 고치는 것).
- 주요 export: `DayPopover`
- 의존: `src/renderer/src/features/calendar/CalendarChip.tsx`, `src/renderer/src/common/Menu.tsx`
- 관련: FR-005 (AC-009, AC-030, AC-043) · 예상 LOC: ~100

### `src/renderer/src/features/calendar/MonthGrid.tsx`
- 목적: 월 격자 (일요일 시작, 4~6행). 끌기 상태와 `onDropCard`는 `CalendarScreen`이 내려 주는 것을 `DayCell`에 그대로 전달만 한다 (끌기를 해석하지 않는다).
- 주요 export: `MonthGrid`
- 의존: `src/renderer/src/features/calendar/DayCell.tsx`, `src/renderer/src/model/calendar-model.ts`
- 관련: FR-005 (AC-009, AC-044) · 예상 LOC: ~100

### `src/renderer/src/features/calendar/WeekGrid.tsx`
- 목적: 주 한 줄. `MonthGrid`와 같이 끌기 관련 props를 `DayCell`에 전달만 한다.
- 주요 export: `WeekGrid`
- 의존: `src/renderer/src/features/calendar/DayCell.tsx`, `src/renderer/src/model/calendar-model.ts`
- 관련: FR-005 (AC-009, AC-044) · 예상 LOC: ~80

### `src/renderer/src/features/calendar/CalendarScreen.tsx`
- 목적: SCR-003 본문. `CalendarView`(월·주 선택), 범례, `마감일이 없는 카드 N건은 보드에서만 보입니다` 안내. 보관한 카드는 목록에 없어 나타나지 않는다. 사이드바 필터와 보드 조건은 영향을 주지 않는다. 상단 막대(`보드로 돌아가기`, 기간 이동, `월 | 주` 분할 버튼)와 하단 줄(`N월에 마감인 카드 N건`)은 그리지 않는다 (`AppShell`이 소유).
- 주요 export: `CalendarScreen`
- 의존: `src/renderer/src/features/calendar/MonthGrid.tsx`, `src/renderer/src/features/calendar/WeekGrid.tsx`, `src/renderer/src/features/calendar/DayPopover.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/model/calendar-model.ts`, `src/renderer/src/common/EmptyState.tsx`, `src/shared/domain/date-rules.ts`
- 관련: FR-005 (AC-009, AC-010, AC-030, AC-044, AC-045, AC-046), FR-010 (AC-019), FR-012 · 예상 LOC: ~190
- 참고 (명세 v4, ADR-013): 칩 끌기의 놓기 처리를 소유한다. 끌리는 카드 id를 지역 상태로 쥐고 `onDropCard(cardId, date)`를 `MonthGrid`/`WeekGrid` → `DayCell` → `CalendarChip` 방향으로 내려 준다. 놓은 날짜가 그 카드의 현재 마감일과 같거나 날짜 칸 밖이면 호출하지 않고(AC-045), 아니면 `ChangeRunner.moveDueDate(id, date)`를 부른다. 낙관적 반영 없음, 실패 시 화면 불변 + 알림 줄(`AppShell`)의 `다시 저장` (AC-046). `ChangeRunner`(Wave 8)에 의존하므로 이 파일은 Wave 9에 있다. 이 달 밖 칸에도 놓을 수 있다.
- 참고: 현재 구현이 자체 막대(`calendar-topbar`)와 하단 줄(`calendar-statusbar`)을 그리는 부분은 구현 단계에서 T-033을 재작업해 `AppShell`로 옮긴다 (`PeriodNav`와 `월 | 주` 버튼 주입, 하단 줄 문구, `calendar.css`의 해당 클래스 제거).

### 화면: 보관함, 읽기 실패 (소유: ArchiveScreen, ReadFailurePanel)

### `src/renderer/src/features/archive/archive.css`
- 목적: 보관함 목록 스타일. 상단 막대·하단 줄은 `AppShell`이 소유하므로 `.archive-statusbar` 같은 `*-topbar`, `*-statusbar` 클래스는 쓰지 않는다 (제거는 T-034 재작업 몫).
- 주요 export: 없음
- 의존: 없음
- 관련: FR-010 · 예상 LOC: ~80

### `src/renderer/src/features/archive/ArchiveRow.tsx`
- 목적: 보관함 목록 행 (제목, 종류, 마감, 우선순위, 보관한 날, `삭제` 버튼). `삭제`를 누르면 그 행이 삭제 확인 줄(`이 카드와 진행 기록이 삭제됩니다. 되돌릴 수 없습니다.` + `취소` + `삭제 확인`)로 바뀌고, `삭제 확인`일 때만 `onDelete`를 부른다 (AC-033, AC-040). `삭제` 버튼 클릭은 행 열기(`onOpen`)를 일으키지 않는다. 마감 지남 표시를 쓰지 않는다.
- 주요 export: `ArchiveRow` (props: `card`, `onOpen`, `onDelete`)
- 의존: `src/renderer/src/common/Chips.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/text/labels.ts`, `src/shared/types/card.ts`
- 관련: FR-010 (AC-020), FR-011 (AC-033, AC-040) · 예상 LOC: ~130
- 참고: 저장이 실패하면 행은 확인 줄 그대로 남는다 (낙관적 반영 없음, 행 제거는 `ArchiveScreen`이 `deleteCard` 성공 뒤 사본에서 카드를 지울 때 일어난다). 삭제 확인 줄은 `DeleteConfirmBar`와 모양이 달라(행 안, 높이 44) 별도로 둔다.

### `src/renderer/src/features/archive/ArchiveScreen.tsx`
- 목적: SCR-004 본문. 상단 막대(`보드로 돌아가기`, 제목, 검색)와 하단 줄(`보관함 N건`)은 그리지 않는다 (`AppShell`이 소유). 보관한 카드 목록(`ArchiveList`), 검색·필터(`scope: 'archive'` 목록을 한 번 받아 `matchesQuery`로 거른다), 결과 없음·빈 목록 표시, 행을 눌러 보기 전용 `CardDialog` 열기, 행의 삭제를 `ChangeRunner.deleteCard`에 연결 (AC-040).
- 주요 export: `ArchiveScreen`
- 의존: `src/renderer/src/features/archive/ArchiveRow.tsx`, `src/renderer/src/features/board/ConditionBar.tsx`, `src/renderer/src/state/app-state.tsx`, `src/renderer/src/state/change-runner.ts`, `src/renderer/src/model/board-model.ts`, `src/renderer/src/common/EmptyState.tsx`
- 관련: FR-010 (AC-020), FR-011 (AC-040), FR-013 (AC-028, AC-036) · 예상 LOC: ~140
- 참고: `ChangeRunner`(Wave 8)에 의존하므로 Wave 9에 둔다. 현재 구현이 자체 하단 줄(`archive-statusbar`)을 그리는 부분은 구현 단계에서 T-034를 재작업해 `AppShell`로 옮긴다.

### `src/renderer/src/features/load-error/load-error.css`
- 목적: 읽기 실패 패널 스타일 (빈 보드와 모양이 다르다)
- 주요 export: 없음
- 의존: 없음
- 관련: FR-006 (AC-032) · 예상 LOC: ~50

### `src/renderer/src/features/load-error/ReadFailurePanel.tsx`
- 목적: AC-032의 화면. 원인 문장(`ReadFailure.code`의 화면 문구 + OS 오류 코드), 읽지 못한 파일 경로(`dataFilePath`), 직전 저장본(`backupPath`)의 경로와 상태(`backup`), 있는 버전 변환 전 사본의 경로(`preMigrationCopies`), 직전 저장본이 `valid`일 때의 수동 절차 문구(`앱을 닫고 폴더에서 kanban-data.json을 다른 이름으로 바꾼 뒤 다시 열면 직전 저장본으로 열립니다`), `다시 읽기`(`store.retryOpen`). 앱 안에 복구 동작(직전 저장본으로 열기, 파일 옮기기)이 없고 파일을 지우거나 쓰지 않는다 (사용자 결정 D3). 성공하면 Bootstrap의 데이터 읽기 단계로 돌아간다.
- 주요 export: `ReadFailurePanel` (props: `failure`)
- 의존: `src/renderer/src/state/app-state.tsx`, `src/renderer/src/common/Button.tsx`, `src/renderer/src/common/Icon.tsx`, `src/renderer/src/text/labels.ts`
- 관련: FR-006 (AC-032) · 예상 LOC: ~100
- 참고: 읽기 실패에서 벗어나는 앱 안의 동작은 `다시 읽기`뿐이다 (그 밖의 복구 동작은 만들지 않기로 사용자가 정했다). 문구는 `04-ui-spec.md` SCR-001 `에러: 읽기 실패`가 정하고 와이어프레임은 없다.

### 설정·시험 지원 파일 (소유: 초기화, 시험 지원)

시험 지원 파일(`tests/cli/support/*`, `tests/browser/support/*`)의 목적·의존은 위 Wave 13 표에 있다. 아래는 주의할 점만 적는다.

### `tests/cli/support/memory-fs.ts`
- 목적: 메모리에서 도는 `FileSystemPort` (실제 디스크 없이 저장·읽기 시험)
- 주요 export: `createMemoryFileSystem(initialFiles?)`, `files` (현재 내용 조회)
- 의존: `src/main/store/file-system-port.ts`
- 관련: FR-006 (AC-011), NFR-002, NFR-003 · 예상 LOC: ~70

### `tests/cli/support/builders.ts`
- 목적: 시험 데이터 만들기 (카드, 진행 기록, 저장 문서, 고정 시계, 순번 아이디)
- 주요 export: `makeCard(overrides)`, `makeEntry(overrides)`, `makeDoc(overrides)`, `fixedClock(iso)`, `sequentialIds()`
- 의존: `src/shared/types/card.ts`, `src/shared/constants.ts`, `src/shared/domain/rule-support.ts`
- 관련: FR-001 ~ FR-014 (시험 공통) · 예상 LOC: ~90

### `tests/cli/support/fixtures/data-v1.json`
- 목적: 버전 1 저장 파일 (`settings` 없음). 이전 버전 읽기 시험의 고정 데이터.
- 주요 export: JSON 데이터
- 의존: 없음
- 관련: NFR-003, FR-014 (AC-038) · 예상 LOC: ~40

### `tests/cli/support/fixtures/data-v2.json`
- 목적: 현재 버전(2) 저장 파일. 보관 카드, 마감 지난 카드, 진행 기록을 포함한 정상 데이터.
- 주요 export: JSON 데이터
- 의존: 없음
- 관련: FR-006 (AC-011), FR-009, FR-010, NFR-003 · 예상 LOC: ~60

### `tests/browser/support/network-observer.ts`
- 목적: 앱 창의 요청을 기록하고, 화면에서 외부 주소 `fetch`를 시도해 거절되는지 보는 도우미
- 주요 export: `observeRequests(page)`, `tryExternalFetch(page, url)`
- 의존: 없음
- 관련: NFR-001, FR-006 (AC-012) · 예상 LOC: ~70
- 참고: Playwright는 앱 창의 요청만 본다. Chromium 프로세스 자체의 요청(DNS 선조회 등)은 보이지 않는다 (`01-tech-stack.md`).

### `tests/cli/support/fault-fs.ts`
- 목적: 어떤 `FileSystemPort`든 감싸서 다섯 동작을 n번째 호출에서 실패시키거나 중단(던지기)시키고, 호출 기록을 남긴다. 읽기 실패 상태에서 쓰기 동작이 한 번도 불리지 않았는지 확인하는 증거도 이 기록이다.
- 주요 export: `createFaultFileSystem(inner, plan)`, `callLog`
- 의존: `src/main/store/file-system-port.ts`
- 관련: FR-006 (AC-031, AC-032), NFR-002 · 예상 LOC: ~110

### `tests/browser/support/launch-app.ts`
- 목적: 시험마다 새 임시 폴더를 만들어 `--user-data-dir=<임시 폴더>`로 앱을 구동·종료·재구동하고, 구동 전에 데이터 파일을 넣거나 구동 뒤 파일을 읽는다. 앱에 시험 전용 코드를 두지 않는다 (ADR-012). 앱 종료는 `try/finally`로 보장해 시험이 실패해도 앱 프로세스가 남지 않게 하고, 시험이 끝나면 임시 폴더를 지운다 (FE-011).
- 주요 export: `launchApp(options)`, `closeApp(app)`, `seedDataFile(dir, json)`, `readDataFile(dir)`
- 의존: 없음
- 관련: FR-006 (AC-011), NFR-002, NFR-003 · 예상 LOC: ~140
- 참고: `--user-data-dir`이 `app.getPath('userData')`에 반영되는지는 확인하지 못했다 (ADR-012). 반영되지 않으면 이 파일과 `AppLifecycle`의 대안(환경 변수)이 설계 변경이다. `AppLifecycle`은 `--user-data-dir`이 주어지면 `userData`를 고정 폴더로 바꾸지 않는다 (ADR-012).

## 시험 파일 계획

> 시험 시나리오 ID(TC)는 `07-test-plan.md`가 정한다. 여기서는 시험 파일이 어느 FR/AC/NFR 범주를 맡는지와 실행 위치만 정한다. 시험 이름에 TC ID를 넣는 규칙은 구현 단계 역할 규약을 따른다. 시험 파일의 의존은 위 Wave 14·15 표와 같다.

### cli 시험 (실행 위치 cli, Vitest, `tests/cli/**/*.test.ts`)

| 시험 파일 | 시험 대상 | 범주 (FR / AC / NFR) | 예상 LOC |
|-----------|-----------|----------------------|----------|
| `tests/cli/domain/date-rules.test.ts` | `src/shared/domain/date-rules.ts` | FR-012 (AC-024, AC-025), FR-004 (AC-029), FR-005. 현지 날짜, 윤년·월말, 당일은 지남이 아님, 완료 카드 제외 | ~200 |
| `tests/cli/domain/validation.test.ts` | `src/shared/domain/validation.ts` | FR-001 (AC-002), FR-002 (AC-004), FR-004 (AC-029), FR-007 (AC-014), FR-008 (AC-016), FR-011 (AC-035), FR-001 (AC-041, AC-042: `create` 모드는 `status`가 `todo`·`in_progress`만 통과하고 `done`·`archived`·문자열 아닌 값은 `status` / `INVALID_VALUE`). 검증 규칙 표 전부, 모아서 돌려주기, 알 수 없는 필드 | ~290 |
| `tests/cli/domain/query-filter.test.ts` | `src/shared/domain/query-filter.ts` | FR-013 (AC-026, AC-027, AC-028). 부분 일치·대소문자·공백, AND, 보관 구분 | ~120 |
| `tests/cli/domain/card-rules.test.ts` | `src/shared/domain/card-rules.ts` | FR-001 (AC-001), FR-002 (AC-003, AC-004), FR-004 (AC-007, AC-008), FR-010 (AC-019, AC-021), FR-011 (AC-022, AC-023, AC-034, AC-040). 오류 판정 순서, 보관 카드 읽기 전용, 삭제 시 기록 함께 삭제, 보관한 카드도 삭제되고 기록이 함께 사라짐 (AC-040) | ~300 |
| `tests/cli/domain/card-queries.test.ts` | `src/shared/domain/card-queries.ts` | FR-003, FR-005, FR-010 (AC-019, AC-020), FR-013 (AC-028) | ~100 |
| `tests/cli/domain/progress-rules.test.ts` | `src/shared/domain/progress-rules.ts` | FR-009 (AC-017, AC-018), FR-010 (보관 카드에 기록 불가) | ~140 |
| `tests/cli/domain/settings-rules.test.ts` | `src/shared/domain/settings-rules.ts` | FR-014 (AC-037, AC-038), 같은 값은 저장하지 않음, 설정이 없는 문서의 기본 판은 light | ~90 |
| `tests/cli/store/data-file-validator.test.ts` | `src/main/store/data-file-validator.ts` | FR-006 (AC-032), NFR-003. 구조 불변식 위반이 조용히 고쳐지지 않음 | ~200 |
| `tests/cli/store/data-file-save.test.ts` | `src/main/store/data-file-save.ts` | NFR-002, AC-031, NFR-003. 네 단계 순서, 단계별 실패, 변환 전 원본 복사, 임시 파일 이름에 프로세스 id | ~230 |
| `tests/cli/store/data-file-repository.test.ts` | `src/main/store/data-file-repository.ts` | FR-006 (AC-011, AC-032), NFR-003. 본 파일 → `.bak` → 처음 실행, 여섯 가지 읽기 실패 분류, `ReadFailure`의 경로·직전 저장본 상태·변환 전 사본, 고아 `.tmp` 무시 | ~280 |
| `tests/cli/store/kanban-store.test.ts` | `src/main/store/kanban-store.ts` | FR-001 ~ FR-014의 화면 함수 흐름, 한 줄 처리, 저장 성공 뒤 메모리 반영, `changed: false`는 저장 안 함, FR-001 (AC-041, AC-042: 진행 중으로 만들어도 진행 기록 없음, `done`으로 만들기는 거절되고 문서·파일 불변), FR-005 (AC-044: `update(id, { dueDate })` 한 번으로 마감일만 바뀜) | ~300 |
| `tests/cli/store/kanban-store-faults.test.ts` | `src/main/store/kanban-store.ts` | NFR-002, AC-031. 모든 중단 시점에서 `SAVE_FAILED`, 메모리·본 파일 불변, 다시 열면 직전 저장본. 판 전환 저장도 포함 | ~240 |
| `tests/cli/store/kanban-store-locked.test.ts` | `src/main/store/kanban-store.ts` | AC-032, NFR-002. 읽기 실패에서 모든 호출이 `STORE_LOCKED`, 쓰기 동작 호출 0건 | ~130 |
| `tests/cli/store/node-file-system.test.ts` | `src/main/store/node-file-system.ts` | NFR-002. 실제 임시 폴더에서 다섯 동작, 이름 바꾸기의 덮어쓰기(Windows), `rename`의 `EPERM`/`EBUSY`/`EACCES` 일시 오류 재시도 | ~150 |
| `tests/cli/migrations/schema-migrations.test.ts` | `src/main/store/migrations/index.ts` | NFR-003, FR-014 (AC-038). 버전 1 → 2(채우는 판은 `light`), 이미 저장된 `dark`는 그대로(마이그레이션 없음), `SCHEMA_TOO_NEW`, 변환 실패 | ~170 |
| `tests/cli/model/board-model.test.ts` | `src/renderer/src/model/board-model.ts` | FR-003 (AC-005, AC-006), FR-012, FR-013 (AC-026, AC-027, AC-036, AC-047). 칸 나누기, 건수(`total`은 필터·검색과 무관한 범위 전체, 우선순위 없는 카드는 `total`에만 셈), 표시 순서(임시 가정) | ~220 |
| `tests/cli/model/calendar-model.test.ts` | `src/renderer/src/model/calendar-model.ts` | FR-005 (AC-009, AC-010). 월 격자(4~6행), 일요일 시작, 칸당 3개와 더 보기, 월말 이동 | ~260 |
| `tests/cli/model/card-form-state.test.ts` | `src/renderer/src/features/card-dialog/card-form-state.ts` | FR-001 (AC-002), FR-004 (AC-029), FR-008 (AC-016), FR-011 (AC-035), FR-001 (AC-041), FR-004 (AC-043). 빈 마감일·우선순위 → `null`, 새 카드의 상태 → 입력의 `status`, 마감일에 입력하다 만 값 → `dueDate` 오류 | ~160 |
| `tests/cli/state/reducers.test.ts` | `src/renderer/src/state/reducers.ts` | FR-003, FR-006 (AC-031). `saveReducer`의 요청 수·실패 기억, `dataReducer`의 카드 교체·삭제·이동, `uiReducer`의 조건. 순수 함수라 Node에서 시험 | ~140 |
| `tests/cli/state/change-runner.test.ts` | `src/renderer/src/state/change-runner.ts` | FR-006 (AC-031, AC-032), FR-002 (AC-003), FR-010 (AC-019, AC-021), FR-011 (AC-040), FR-014 (AC-037), FR-005 (AC-044, AC-046: `moveDueDate`는 성공 뒤에만 사본 변경, `SAVE_FAILED`면 화면 불변과 `다시 저장`). 가짜 `KanbanApi`를 주입해 성공(성공 뒤에만 화면 사본 변경)·`SAVE_FAILED`(화면 불변, `다시 저장`)·`CARD_NOT_FOUND`/`ARCHIVE_NOT_ALLOWED`(목록 다시 받기)·`STORE_LOCKED`, 판 전환만 낙관적 | ~290 |
| `tests/cli/text/labels.test.ts` | `src/renderer/src/text/labels.ts` | AC-031, AC-032, AC-002, AC-016. 모든 값 이름과 오류 코드에 화면 문구가 있음, `medium`의 표시 이름은 `중간`, `PRIORITIES` 순서는 낮음, 중간, 높음 | ~70 |
| `tests/cli/ipc/ipc-contract.test.ts` | `src/shared/ipc-contract.ts` | 보안 기본값 (ADR-004). 채널 12개가 `03-api-spec.md` 목록과 같음 (기대값을 시험에 적어 둔다) | ~60 |
| `tests/cli/ipc/ipc-handlers.test.ts` | `src/main/app/ipc-handlers.ts` | 보안 기본값 (ADR-004). 앱 주소가 아닌 프레임 거절, 예외 → `INTERNAL`(콘솔 기록), 열두 채널만 등록, `whenIdle`이 처리 중 요청이 끝난 뒤 이행됨 (`vi.mock`으로 electron 모듈 대체, 새 패키지 없음) | ~190 |

### browser 시험 (실행 위치 browser, Playwright `_electron`, `tests/browser/**/*.spec.ts`)

| 시험 파일 | 범주 (FR / AC / NFR) | 예상 LOC |
|-----------|----------------------|----------|
| `tests/browser/board.spec.ts` | FR-001 (AC-001, AC-002), FR-002 (AC-003, AC-004), FR-003 (AC-005, AC-006), FR-007 (AC-013, AC-014), FR-001 (AC-041, AC-042), FR-008 (AC-016). 만들기(새 카드 상태 선택은 잠기지 않고 `할 일`/`진행 중` 두 항목, `진행 중`으로 만들면 진행 중 칸에 나타남, 우선순위 분할 버튼 순서 없음·낮음·중간·높음), 끌기와 `⋯` 이동(저장이 성공해야 새 칸으로 이동), 빈 칸 | ~280 |
| `tests/browser/card-dialog.spec.ts` | FR-004 (AC-007, AC-008, AC-029), FR-008 (AC-015, AC-016), FR-009 (AC-017, AC-018), FR-011 (AC-022, AC-023, AC-033, AC-034, AC-035, AC-040). 보기 전용 모드의 삭제 확인과 삭제 (AC-040), 삭제 저장 실패 시 확인 줄이 남음 | ~290 |
| `tests/browser/archive.spec.ts` | FR-010 (AC-019, AC-020, AC-021), FR-011 (AC-033, AC-034, AC-040: 행의 삭제 확인과 삭제, 취소하면 그대로), FR-013 (AC-028) | ~200 |
| `tests/browser/calendar.spec.ts` | FR-005 (AC-009, AC-010, AC-030, AC-048), FR-010 (AC-019). 기본 창에서 5주인 달의 월 보기가 스크롤 없이 모두 보임(AC-048, 창 높이 920) | ~250 |
| `tests/browser/calendar-drag.spec.ts` | FR-005 (AC-043, AC-044, AC-045), FR-004 (AC-029, AC-043). 월·주 보기에서 칩을 다른 날짜 칸에 놓으면 마감일이 바뀌고(저장 성공 뒤 칩 이동, 이 달 밖 칸 포함), 같은 날짜 칸·칸 밖은 무동작(저장 호출 없음), 팝업 안 칩은 끌 수 없고, 칩을 눌러 카드 입력 화면의 날짜 입력 칸에서 마감일을 고칠 수 있음(입력하다 만 값은 오류). 저장 실패 시 끌기(AC-046)는 `save-failure.spec.ts` | ~200 |
| `tests/browser/overdue.spec.ts` | FR-012 (AC-024, AC-025), NFR-004 (AC-039) | ~150 |
| `tests/browser/search-filter.spec.ts` | FR-013 (AC-026, AC-027, AC-028, AC-036, AC-047). 사이드바 두 필터 목록 맨 위 `전체`(처음 선택, 우선순위 목록은 전체·낮음·중간·높음), 선택된 항목을 다시 눌러도 해제되지 않음, `전체`를 고르면 그 조건이 풀림, 보드와 보관함 모두 | ~230 |
| `tests/browser/persistence.spec.ts` | FR-006 (AC-011), NFR-002 (정상 종료·강제 종료 뒤 재열기, 변경을 연달아 한 직후 창 닫기 → 재구동 시 모두 남음), NFR-003 (버전 1 파일), FR-014 (AC-038) | ~250 |
| `tests/browser/save-failure.spec.ts` | FR-006 (AC-031), FR-005 (AC-046). 저장 실패 문구와 입력 유지, 칸 이동·보관·삭제·캘린더 끌기 저장 실패 시 화면이 바뀌지 않음(카드가 원래 칸·칩이 원래 날짜에 남음)과 `다시 저장`으로 재시도, 밝기 전환 실패 시 판 유지 | ~190 |
| `tests/browser/read-failure.spec.ts` | FR-006 (AC-032), NFR-002 (읽지 못한 파일 불변). 패널에 읽지 못한 파일 경로·직전 저장본 상태·수동 절차 문구가 보이고 앱 안 복구 버튼이 없음 | ~150 |
| `tests/browser/theme.spec.ts` | FR-014 (AC-037, AC-038, AC-039), NFR-004 (두 판). 데이터 파일이 없을 때 처음 열리는 판은 밝은 판, 어두운 판을 저장한 파일은 어두운 판으로 열림 | ~170 |
| `tests/browser/offline.spec.ts` | NFR-001, FR-006 (AC-012). 요청이 앱 번들 폴더의 `file:`뿐임을 관찰, 외부 주소 `fetch` 거절, 빌드 결과 `index.html`에 CSP가 들어 있음 | ~130 |
| `tests/browser/app-security.spec.ts` | NFR-001 (보안 기본값, ADR-004, ADR-005). `window.kanban` 열두 함수만, `require`/`process` 비노출, 새 창·이동 거부. `결정 필요` 4 (sandbox)의 영향을 받는다 | ~120 |

수동 확인으로 남는 것: 흑백 화면에서의 색 없는 구분 (NFR-004, `05-architecture.md` NFR 대응). 파일로 만들지 않는다.

시험 계획에서 확인하지 못한 점:

- `save-failure.spec.ts`와 `read-failure.spec.ts`는 앱 코드에 시험 전용 분기 없이 실패를 만들어야 한다 (손상된 `kanban-data.json` 넣기는 되지만, 쓰기 실패 유도는 방법이 바뀌었다). 임시 파일 이름에 프로세스 id가 붙어(`kanban-data.json.<프로세스 id>.tmp`) 같은 이름의 폴더를 미리 만들어 둘 수 없다. 대신 유효한 `kanban-data.json`을 두고 `kanban-data.json.bak`을 같은 이름의 폴더로 만들어 `backup` 단계 복사를 실패시키는 방법을 쓸 수 있다 (실제로 되는지는 확인하지 못했다). 안 되면 `07-test-plan.md`와 구현 Task가 `cli`의 `FileSystemPort` 대역으로 옮길지 정한다.
- `overdue.spec.ts`와 `calendar.spec.ts`는 앱 시계를 바꾸는 코드가 없으므로 시험이 실행하는 날의 실제 날짜를 기준으로 카드 마감일을 계산해 넣는다.
- `tests/browser/support/launch-app.ts`가 `electron.launch`로 `out/main/index.js`를 구동하므로 `test:e2e`는 빌드 뒤에만 의미가 있다 (`01-tech-stack.md`의 `test:e2e`가 빌드를 먼저 한다).

## 수정 대상 (기존 파일)

처음 계획 때는 설계 문서 폴더 밖의 기존 앱 파일이 없었다. 아래 첫 표는 이 계획 안에서 두 Wave에 걸쳐 만들어지는 파일이다. 구현이 끝난 뒤 명세 v4로 다시 고치는 기존 파일은 그 뒤의 `명세 v4 재작업 대상`에 있다.

| 파일 경로 | 변경 유형 | 변경 내용 | 영향 범위 |
|-----------|-----------|-----------|-----------|
| `src/preload/index.ts` | Wave 1 스텁 → Wave 5 완성 | 비어 있던 진입에 `window.kanban` 노출과 초기 판 적기를 채움 | `ipc-contract.ts`, `api.ts`, `env.d.ts`의 타입과 맞아야 함 |
| `src/main/index.ts` | Wave 1 스텁 → Wave 9 완성 | 조립과 시작·종료 순서를 채움 | `kanban-store.ts`, `ipc-handlers.ts`, `window-factory.ts`, `network-guard.ts` |
| `src/renderer/src/main.tsx` | Wave 1 스텁 → Wave 12 완성 | Bootstrap, 전역 CSS import, React 오류 경계를 채움 | `AppShell.tsx`, 상태 파일 |
| `src/renderer/index.html` | Wave 1 스텁 → Wave 12 완성 | 제목 (CSP는 production build가 주입) | NFR-001, 앱 이름 `결정 필요` 3 |

### 명세 v4 재작업 대상 (이미 구현된 파일, 2026-11-05)

구현이 `app/`에 이미 있다. 명세 v4(AC-041~AC-048)로 아래 기존 파일의 코드를 고쳐야 한다. 새 파일은 없고 경로·Wave는 바꾸지 않았다 (`CalendarScreen.tsx`만 `ChangeRunner` 의존 때문에 Wave 8 → 9). 파일 이름은 앱 루트 기준이다.

| 파일 경로 | 고칠 내용 | 근거 |
|-----------|----------|------|
| `src/shared/constants.ts` | `DEFAULT_THEME` `'dark'` → `'light'`, `PRIORITIES`를 `['low', 'medium', 'high']`로, `CREATE_STATUSES = ['todo', 'in_progress']` 추가 | ASM-017, AC-016, AC-047, AC-041 |
| `src/shared/types/card.ts` | `CardCreateInput.status?` 추가 | AC-041 |
| `src/shared/domain/validation.ts` | `create` 모드의 `status` 검증(허용 두 값, 그 밖은 `status` / `INVALID_VALUE`), 이전 생성 입력 `status` → `UNKNOWN_FIELD` 규칙 제거 | AC-042 |
| `src/shared/domain/card-rules.ts` | `createCard`가 입력 `status`를 새 카드에 사용 | AC-041 |
| `src/shared/domain/settings-rules.ts`, `src/main/store/migrations/v1-to-v2.ts`, `src/main/store/data-file-repository.ts` | 코드 변경 없음(`DEFAULT_THEME` 값이 따라 바뀜). 기대값이 `dark`인 시험만 `light`로 | ASM-017, AC-038 |
| `src/main/index.ts` | 코드 변경 없음(`DEFAULT_THEME` 값이 따라 바뀜). 읽기 실패 기본 판이 밝은 판이 됨을 확인 | AC-038 |
| `src/main/app/window-factory.ts` | `WINDOW_HEIGHT` 800 → 920 (`WINDOW_MIN_HEIGHT` 700 유지) | AC-048 |
| `src/preload/index.ts` | 코드 변경 없음. 초기 판 인자가 없거나 알 수 없으면 `data-theme`를 적지 않고 기본 판은 CSS `:root`가 정하므로 `tokens.css` 뒤집기(아래)가 이 경로의 기본 판을 밝게 만든다 | ASM-017, ADR-008 |
| `src/renderer/src/state/reducers.ts` | `DataState` 초기 `theme` `'dark'` → `DEFAULT_THEME`(`light`) | ASM-017 |
| `src/renderer/src/styles/tokens.css` | `:root`를 밝은 판, `[data-theme='dark']`를 어두운 판으로 선택자 뒤집기(값·토큰 이름 그대로) | ADR-008 |
| `src/renderer/src/text/labels.ts` | `PRIORITY_LABEL.medium` `보통` → `중간`, 필터 `전체` 문구 상수 | AC-016, AC-047 |
| `src/renderer/src/layout/Sidebar.tsx` | `FilterGroup`: 맨 위 `전체` 항목(`total` 건수), 처음 선택, 선택된 항목 재클릭 해제 제거, `전체` → `undefined`. 우선순위 목록은 낮음, 중간, 높음 | AC-047 |
| `src/renderer/src/layout/AppShell.tsx` | `saveFailureMessage`에 `moveDueDate`(카드 변경 문구) 추가 | AC-046 |
| `src/renderer/src/state/state-types.ts`, `src/renderer/src/state/change-runner.ts` | `ChangeRequest`에 `moveDueDate` 추가, `moveDueDate(id, dueDate)` 구현(`cards.update(id, { dueDate })`, `updateCard`와 같은 성공·오류 처리), `useChanges()` 목록에 추가 | AC-044, AC-046 |
| `src/renderer/src/features/card-dialog/card-form-state.ts` | 새 카드의 `status`를 `FormValues`와 `toCreateInput`에 반영, 마감일 입력하다 만 값 플래그와 `fieldErrors` | AC-041, AC-029, AC-043 |
| `src/renderer/src/features/card-dialog/CardForm.tsx` | 상태 select(새 카드는 두 항목·잠금 없음), 마감일을 `input type="date"`로(달력 아이콘, `badInput` 감지), 우선순위 분할 버튼 순서(없음, 낮음, 중간, 높음) | AC-041, AC-043, AC-016 |
| `src/renderer/src/features/card-dialog/CardDialog.tsx` | 새 카드 모드의 상태 선택값을 `createCard`로 전달 | AC-041 |
| `src/renderer/src/features/calendar/CalendarChip.tsx` | `draggable`, `CHIP_DRAG_TYPE`, `dragging`·`onDragStart`, 팝업 변형은 끌기 없음 | AC-044 |
| `src/renderer/src/features/calendar/DayCell.tsx` | `dragover` 표시, `drop` → `onDropCard(cardId, date)` | AC-044 |
| `src/renderer/src/features/calendar/MonthGrid.tsx`, `src/renderer/src/features/calendar/WeekGrid.tsx` | 끌기 props 전달 | AC-044 |
| `src/renderer/src/features/calendar/DayPopover.tsx` | 팝업 안 칩을 끌 수 없게(`variant="popover"`) | AC-043 |
| `src/renderer/src/features/calendar/CalendarScreen.tsx` | 끌리는 카드 id 지역 상태, `onDropCard`(같은 날짜·칸 밖 무동작, 아니면 `moveDueDate`) | AC-044, AC-045, AC-046 |
| `src/renderer/src/features/calendar/calendar.css` | 끌리는 칩 투명도 50%, 놓을 수 있는 칸의 점선 윤곽 | AC-044 |
| `src/renderer/src/model/board-model.ts` | 코드 변경 없음 가능(`FilterCounts.total`이 이미 범위 전체 수). 시험 보강만 | AC-047 |
| 시험: `tests/cli/domain/validation.test.ts`, `kanban-store.test.ts`, `settings-rules.test.ts`, `tests/cli/migrations/schema-migrations.test.ts`, `tests/cli/model/board-model.test.ts`, `card-form-state.test.ts`, `tests/cli/state/change-runner.test.ts`, `tests/cli/text/labels.test.ts`, `tests/browser/board.spec.ts`, `calendar.spec.ts`, `search-filter.spec.ts`, `save-failure.spec.ts`, `theme.spec.ts` + 새 `tests/browser/calendar-drag.spec.ts` | 위 변경에 맞는 시나리오 추가 또는 기대값 수정 (기본 판 light, `중간`, 우선순위 순서) | AC-041~AC-048 |
| 시험: `tests/browser/card-dialog.spec.ts` | 날짜 입력칸과 우선순위 이름·순서에 맞게 TC-078, TC-080, TC-082 기대값 수정 (07 `기대 결과를 바꾼 기존 TC`) | AC-016, AC-029, AC-043 |
| 시험: `tests/cli/state/reducers.test.ts` | `DataState` 초기 `theme`이 `light`임에 맞게 TC-143 기대값 수정 | AC-038, ASM-017 |

## 자산 파일과 라이선스 미확인 사항

| 파일 | 종류 | 상태 | 미확인 사항 |
|------|------|------|-------------|
| `src/renderer/src/styles/fonts/SUIT-Variable.woff2` | 글꼴 (바이너리) | 파일 자체는 이 계획에 없다 (구현 Task가 확보해야 함) | 출처 파일, 실제 용량(측정하지 못함), 한글 글리프 포함 범위, 확보 방법 (`결정 필요` 7) |
| `src/renderer/src/styles/fonts/SUIT-LICENSE.txt` | 라이선스 문구 | 글꼴 저장소의 원문이어야 한다 | SIL OFL 1.1이라는 것은 저장소 README에서만 확인했고 라이선스 파일 원문은 열어 보지 못했다 (`04-ui-spec.md` 결정 필요 11). 글꼴을 포함하려면 OFL 조건에 따라 저작권·라이선스 문구를 함께 둔다 |
| `src/renderer/src/common/Icon.tsx` | 인라인 SVG 코드 | 코드 파일 | 도형의 출처가 직접 작성인지 외부 아이콘 세트인지 설계 문서에 없음. 외부 세트에서 옮기면 그 라이선스 확인이 필요 (`결정 필요` 7) |
| (계획 없음) 앱 아이콘 `.ico` | 포장용 아이콘 | 설계 문서에 아이콘 요구가 없어 파일을 계획에 넣지 않았다 | `electron-builder`는 아이콘이 없으면 기본 Electron 아이콘을 쓸 것으로 보이나 확인하지 못했다 (`결정 필요` 7) |
| `tests/cli/support/fixtures/data-v1.json`, `data-v2.json` | 고정 데이터 | 시험 데이터. 구현 Task가 작성 | 외부 자산 없음. 임의의 가짜 카드만 담는다 |

## 도구가 만드는 파일

계획의 파일 수에 넣지 않았다. 직접 작성하지 않고, 버전 관리 대상은 `package-lock.json` 하나다.

| 경로 | 만드는 것 | 비고 |
|------|-----------|------|
| `package-lock.json` | `npm install` | `install` 명령(`npm ci`)이 필요로 한다. 첫 Task가 `npm install --save-exact`로 만들어 저장한다 |
| `node_modules/` | `npm ci` | 버전 관리 제외 |
| `out/` | `electron-vite build` | 버전 관리 제외 |
| `release/` | `electron-builder` | 버전 관리 제외 |
| `reports/` | `junit.xml`, `e2e.xml` | 버전 관리 제외 |
| `test-results/` | Playwright 증거 | 버전 관리 제외 |

## 결정 필요

사용자가 말하지 않은 정책은 정하지 않았다. 1, 2번은 사용자가 정해 해소됐다 (D1, D2). 3, 4번은 `05-architecture.md`의 `결정 필요`를 그대로 가져온 것이다. 5, 6번은 설계 리뷰 반영으로 해소됐고, 7번은 파일 맵을 만들며 드러난 항목이다.

| 번호 | 항목 | 지금 파일 맵의 임시 가정 | 영향받는 파일 | 선택지와 권고 |
|------|------|--------------------------|----------------|----------------|
| 1 | 보관한 카드의 삭제 허용 여부 (아키텍처 1) | 해소됨 (사용자 결정 D1, 명세 v3 AC-040): 허용한다 (`deleteCard`가 보관 여부를 보지 않고, 보기 전용 모드와 보관함 행에 삭제가 나온다) | `src/shared/domain/card-rules.ts`, `src/main/store/kanban-store.ts`, `src/renderer/src/features/card-dialog/CardDialog.tsx`, `src/renderer/src/features/card-dialog/DeleteConfirmBar.tsx`, `tests/cli/domain/card-rules.test.ts`, `tests/browser/card-dialog.spec.ts`, `tests/browser/archive.spec.ts`, `src/renderer/src/features/archive/ArchiveRow.tsx`, `src/renderer/src/features/archive/ArchiveScreen.tsx` | 사용자가 허용을 골랐다 |
| 2 | 저장 실패 뒤 화면과 저장소가 다른 상태에서의 추가 조작 (아키텍처 2) | 해소됨 (사용자 결정 D2): 칸 이동·보관·삭제는 낙관적으로 반영하지 않는다 (요청 즉시 전송, `저장 중`, 성공 뒤 화면 변경, 실패하면 화면 그대로). 판 전환만 낙관적. `다시 저장`은 실패한 요청 한 건을 다시 보낸다 | `src/renderer/src/state/change-runner.ts`, `src/renderer/src/state/reducers.ts`, `src/renderer/src/state/state-types.ts`, `src/renderer/src/common/Banner.tsx`, `src/renderer/src/layout/AppShell.tsx`, `src/renderer/src/layout/Sidebar.tsx`, `tests/browser/save-failure.spec.ts` | 사용자가 정했다 (D2) |
| 3 | 앱 이름(표시)과 데이터 폴더 이름 (아키텍처 3) | 표시 이름은 구현 시작 전에 사용자가 준다 (`package.json`의 `name`/`productName`, 화면 표시). 데이터 폴더 이름은 표시 이름과 분리한 상수 `APP_DATA_FOLDER`(값은 구현 시작 전에 정하고 바꾸지 않는다)라서 표시 이름을 나중에 바꿔도 데이터 위치가 바뀌지 않는다 (ADR-012) | `package.json`, `electron-builder.yml`, `src/renderer/index.html`, `src/renderer/src/layout/Sidebar.tsx`, `src/renderer/src/text/labels.ts`, `src/main/index.ts` | 표시 이름은 구현 전에 정하는 것이 좋지만 데이터 폴더에는 영향이 없다. 폴더 상수 값만 구현 시작 전에 정한다 |
| 4 | `sandbox: true`와 `"type": "module"`, electron-vite 6 preload 출력의 호환 (아키텍처 4) | 유지한다. preload를 CJS(`index.cjs`)로 내보내는 확정값(ADR-005)을 두었고, 출력 파일은 첫 Task의 `build`에서, 노출은 첫 Electron 구동에서 확인한다. 대안 설정과 마지막 수단은 `electron.vite.config.ts` 항목 | `electron.vite.config.ts`, `package.json`, `src/main/app/window-factory.ts`, `src/preload/index.ts`, `tests/browser/app-security.spec.ts` | (a) 유지 / (b) `sandbox: false`로 낮춤 (사용자와 설계 승인 문서 변경 필요) |
| 5 | `build` 스크립트가 분리된 tsconfig(`node`/`web`)를 실제로 검사하는가 | 해소됨: `build`는 `tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit && electron-vite build`로 `01-tech-stack.md`를 고쳤고, 루트 `tsconfig.json`은 에디터용 `{ "files": [] }`다 | `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `package.json` | 승인된 `01-tech-stack.md`의 스크립트 변경이라 재승인이 필요하다. 두 `tsc -p` 호출과 `types` 명시가 빈 프로젝트에서 통과하는지는 첫 Task가 확인한다 |
| 6 | `node:*` 금지 규칙과 AppLifecycle·WindowFactory·DataFileRepository의 실제 필요 | 해소됨: `node:fs/promises`는 `node-file-system.ts`만, `src/main/**`에서는 `node:path`만 허용한다 (`05-architecture.md` 의존 규칙). 경로 합치기는 `data-file-names.ts`가 `path.join`을 쓴다 (`joinPath` 삭제). 아이디는 전역 `crypto.randomUUID()` | `eslint.config.js`, `src/main/app/window-factory.ts`, `src/main/store/data-file-names.ts`, `src/main/index.ts` | `node:path`는 파일 접근이 아닌 문자열 처리라 허용한다 (설계 승인 때 확인) |
| 7 | 자산: 글꼴 woff2 확보 방법·용량·라이선스 원문, 아이콘 도형 출처, 앱 아이콘 | woff2는 구현 Task가 사용자가 정한 방법으로 확보한다. 라이선스 문구 파일은 원문을 넣는다. 아이콘 도형은 직접 작성한 것으로 가정한다. 앱 아이콘은 만들지 않는다 | `src/renderer/src/styles/fonts/SUIT-Variable.woff2`, `src/renderer/src/styles/fonts/SUIT-LICENSE.txt`, `src/renderer/src/common/Icon.tsx`, `electron-builder.yml` | 사용자가 글꼴 파일을 직접 주는지, 구현 Task가 저장소에서 내려받는지(개발 시점 인터넷 사용, 앱 실행은 오프라인) 정한다. 앱 아이콘이 필요한지 정한다 |

## 검증 기록

- 2026-11-05, 명세 v4 반영(AC-041~AC-048, ASM-004/008/017/018): 새 카드 상태(`CREATE_STATUSES`), 날짜 입력, 우선순위 `중간`과 `PRIORITIES` 순서, 사이드바 `전체`, 캘린더 칩 끌기(`CHIP_DRAG_TYPE`, `moveDueDate`), 기본 판 light, 기본 창 1280x920을 파일 명세·시험 계획에 반영했다. 새 구현 파일은 없고, `CalendarScreen.tsx`는 `ChangeRunner`에 의존하게 되어 Wave 8 → 9로 옮겼다 (Wave 8은 4개, Wave 9는 5개). 새 시험 파일 `tests/browser/calendar-drag.spec.ts` 한 개(Wave 15)를 더했다 (`calendar.spec.ts`가 300줄을 넘지 않게 분리). 총 140 → 141개, browser 시험 12 → 13개, LOC ~17,100 → ~17,800. 이미 구현된 파일의 재작업 목록은 `수정 대상 (기존 파일)`의 `명세 v4 재작업 대상`.
- 설계 결함 수정(BI-003, 구현 중 보고): 저장 단계에서 `sync`를 따로 두지 않고 `write_temp`에 포함해 `write_temp`, `verify`, `backup`, `replace` 네 단계로 고쳤다(`writeFileSynced` 한 호출이 쓰기와 fsync를 함께 한다). 저장 단계 수만 5에서 4로 바뀌었고 파일·컴포넌트·Wave·TC·인터페이스 수는 그대로다.
- 설계 결함 수정(BI-004, 구현 중 보고): 상단 막대(`TopBar`)와 하단 줄의 소유자를 `AppShell`로 분명히 했다. 세 화면 컴포넌트는 막대·하단 줄을 그리지 않고, 캘린더의 `PeriodNav`와 `월 | 주` 버튼은 `AppShell`이 `TopBar`의 children으로 넣는다. 파일·컴포넌트·Wave·TC 수는 그대로다.
- 체크리스트 (`.claude/agents/design-filemap.md`):
  - 모든 경로가 안전하다: `../`, 절대 경로, `node_modules/`, `.git/` 없음. 모든 경로는 앱 루트 `app/` 기준 상대 경로. (`.gitignore`는 파일 이름이고 `.git/` 폴더가 아니다.)
  - Wave 사이 순환 의존이 없다: 각 파일의 `의존`이 모두 앞 Wave에 있음을 스크립트로 확인했다 (아래 확인 결과).
  - 모든 파일에 관련 FR(또는 `FR 없음 (기반 파일)`)과 예상 LOC가 있다. 최대 약 300줄로 300줄 이하다 (바이너리 글꼴 파일은 LOC 해당 없음. 시험 파일 `card-rules.test.ts` 300줄이 최대). `kanban-store.ts`(250)에는 넘길 때의 분리 방법을 적었다. `change-runner.ts`는 낙관적 반영·롤백이 없어져 220줄로 줄었다.
  - 컴포넌트와 파일 대응: 아키텍처 컴포넌트 31개가 모두 `컴포넌트와 파일 대응` 표에 있고, 구현 파일은 모두 소유 컴포넌트(또는 `초기화`/`시험 지원`/`시험`)가 하나다. 고아 컴포넌트·파일 없음.
  - 실제 필요한 파일만 포함: 라이브러리 추상화, 라우터, 상태 관리 패키지를 만들지 않았다. 분리한 파일은 300줄 초과 방지(타입 3개, 규칙 5개, 저장 3개, 상태 3개), IpcHandlers의 구현 독립(`store-types.ts`), 순수 로직의 cli 시험(`card-form-state.ts`) 때문이다.
- 새 npm 패키지를 추가하지 않았다. `eslint.config.js`는 `01-tech-stack.md` 표에 없는 `globals` 패키지를 쓰지 않는다고 명시했다. `ipc-handlers.test.ts`는 Vitest 내장 `vi.mock`만 쓴다.
- 아키텍처의 `결정 필요` 중 보관 카드 삭제(1)와 저장 실패 뒤 추가 조작(2)은 사용자가 정해 반영했고(D1, D2), 앱 이름(3)과 sandbox(4)는 정하지 않고 영향받는 파일에 표시했다.
- 아키텍처 문서와 다르게 쓴 곳 (모순이 아니라 빈틈을 메운 것): (1) `Bootstrap`이 `AppShell`을, `AppShell`이 `ChangeRunner`를 import한다 (의존 목록에 빠짐). (2) `ConditionBar`를 보드 폴더에 두고 보관함이 import한다. (3) `tsconfig.node.json`이 `tests/browser`와 설정 파일을 함께 본다. (4) `THEME_ARGUMENT_PREFIX`를 `constants.ts`에 둔다. (5) `node:path` 사용 (`결정 필요` 6 해소). (6) `ArchiveScreen`이 삭제를 위해 `ChangeRunner`를 import해 Wave 9로 옮겼다 (파일 수는 같고 Wave 8은 5개, Wave 9는 4개). (7) React 오류 경계를 새 파일 없이 `main.tsx` 안에 두었다 (컴포넌트 31개·구현·설정·자산 파일 98개 유지). (8) 설계 리뷰 FE-006으로 시험 파일 2개(`tests/cli/state/reducers.test.ts`, `change-runner.test.ts`)를 더했다 (파일 138개 → 140개). `change-runner.ts`는 `createChangeRunner`를 순수 함수로 두고 `tsconfig.web.json`이 이 두 시험을 검사한다.
- 시험 시나리오 ID(TC)를 쓰지 않았다. 시험 파일은 FR/AC/NFR 범주로만 연결했다.
- 승인 여부나 진행 상태를 적지 않았다.
- 이 계획은 실행해 보지 않았다. 확인하지 못한 것: 두 `tsc -p` 호출과 `types` 명시의 통과(`결정 필요` 5, 첫 Task), `sandbox: true`와 preload CJS 출력 설정(`결정 필요` 4), `import.meta.dirname`·`ELECTRON_RENDERER_URL`·`app.setPath`와 `--user-data-dir`, Chromium 요청 완화 후보와 포장 퓨즈 설정(`electronFuses`), `rename` 재시도 간격, `--user-data-dir`이 `userData`에 반영되는지(ADR-012), 저장 실패·읽기 실패를 앱 코드 변경 없이 만드는 방법(`시험 계획에서 확인하지 못한 점`), 글꼴 파일 용량과 라이선스 원문(`결정 필요` 7), 각 파일의 LOC 추정(측정하지 않은 추정).
- 파일 수·LOC 합계·Wave 순서는 이 문서를 쓴 뒤 스크립트로 세어 확인했고, 설계 리뷰 반영 뒤에도 Wave 표를 다시 세어 확인했다 (140개: 구현·설정·자산 98, 시험 지원 7, cli 시험 23, browser 시험 12. Wave 8은 5개, Wave 9는 4개, Wave 14는 23개이고 Wave 합계가 140이다. LOC는 시험 파일 2개(~400줄)를 더해 ~17,100줄). 명세 v4 반영 뒤에는 141개(browser 시험 13), Wave 8은 4개, Wave 9는 5개, Wave 15는 13개이고 합계 141, LOC ~17,800이다.
