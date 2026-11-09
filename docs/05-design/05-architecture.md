# 아키텍처 설계

> 작성일: 2026-11-03
> 수정: 2026-11-05 (명세 v4 반영, `검증 기록` 참고)
> 입력: docs/04-spec/spec.md (v4), docs/05-design/01-tech-stack.md (후보 A: Electron 45.2.1 + React 19.3.1 + TypeScript 6.0.3 + electron-vite 6.0.0, 코드는 `app/` 안에만), docs/05-design/02-data-model.md, docs/05-design/03-api-spec.md, docs/05-design/04-ui-spec.md

이 문서는 앞선 설계 네 개를 하나의 구조로 묶는다. 어디에 무엇을 두고, 누가 누구를 부를 수 있는지, 데이터가 어떻게 흐르는지, NFR을 어느 컴포넌트가 지키는지를 정한다. 엔티티·인터페이스·화면의 이름은 앞선 문서의 것을 그대로 쓰고 새로 만들지 않았다. 새로 도입한 이름은 모두 내부 컴포넌트(코드 모듈)이고 요구사항 ID가 아니다. 파일 단위 계획(파일 목록, 생성 순서)은 `06-file-map.md`의 몫이라 이 문서의 `디렉토리 구조`는 폴더와 시험 위치까지만 정한다.

## 설계 근거

### 기술 스택 선정 근거

> 실행 형태는 사용자가 후보 A(Electron, 저장은 앱 데이터 폴더의 JSON 파일 1개 구성 포함)를 골랐다 (CON-002). 이 문서가 다시 고른 것은 아니고, 구조 결정에 쓰인 근거만 옮겼다.

| 기술 | 대안 검토 | 선정 이유 | 출처 |
|------|----------|----------|------|
| Electron (실행 껍데기) | 설치형 PWA, Tauri | 데이터가 브라우저 저장소가 아니라 일반 파일이라 RISK-005를 구조적으로 피한다. 파일 저장과 강제 종료 시험을 Node에서 직접 흉내 낼 수 있어 NFR-002를 시험하기 쉽다. 외부 요청을 앱이 직접 차단할 수 있다 (NFR-001). 추가 언어가 필요 없다. 대가: 설치 크기·메모리, 수동 보안 업데이트 | 01-tech-stack.md `후보 비교` |
| JSON 파일 1개 (설정 포함) | IndexedDB, SQLite, 설정 별도 파일 | 네이티브 모듈이 없고 수백~수천 건(ASM-010)에 충분하다고 추정한다 (측정하지 않음). 한 문서의 한 번 교체로 카드와 설정이 같은 시점을 유지한다. SQLite는 파일이 수십 MB가 되거나 자동 이력(Q-002)이 들어올 때 다시 검토한다 | 02-data-model.md `설계 메모`, 01-tech-stack.md `호환성 참고사항` |
| React 19 (화면) | 프레임워크 없이 DOM 직접 조작 | 화면 4개가 보드·대화상자·사이드바 필터·저장 상태 같은 상태를 여럿 공유한다. 손으로 DOM과 동기화하면 코드가 늘고 어긋나기 쉽다고 판단했다 (판단, 측정하지 않음). 세 후보 공통의 화면 기술로 01에서 이미 정해졌다 | 01-tech-stack.md `프로젝트 기술 요구사항` |
| electron-vite | Vite와 별도 main 번들을 직접 구성 | main·preload·renderer 세 곳을 한 설정으로 빌드한다. 직접 구성은 설정이 늘어난다는 점만 다르다 | 01-tech-stack.md `추천 스택` |
| React 내장 상태 (Context + useReducer) | 상태 관리 라이브러리 | 패키지 표에 없는 라이브러리는 추가하지 않는 규칙이다. 상태 종류가 적다 (ADR-006) | 01-tech-stack.md `패키지 의존성`, 04-ui-spec.md `상태 관리 흐름` |
| Vitest (cli) + Playwright `_electron` (browser) | 한 도구로 통일 | 도메인·저장은 Electron 없이 Node에서, 화면 흐름과 재시작·요청 관찰은 실제 창에서 본다. 두 실행 위치는 01에서 확인된 것이다 | 01-tech-stack.md `시험 환경` |

### 아키텍처 패턴 선정 근거

| 패턴 | 장점 | 단점 | 적합도 |
|------|------|------|--------|
| 플랫 단일 모듈 (프로세스 구분만 두고 규칙을 화면·main에 흩어 둠) | 파일이 적다 | 같은 규칙(검증, 검색, 마감 지남)을 화면과 main이 따로 구현하게 되어 어긋난다. 저장 규칙을 Electron 없이 시험하기 어렵다 | 낮음 |
| 프로세스 경계로 나눈 레이어드 + 순수 도메인 코어 + 저장 포트 주입 | Electron이 강제하는 경계(renderer / preload / main)를 그대로 레이어로 쓴다. 규칙을 한 벌의 순수 모듈로 두어 화면·main·시험이 공유한다. 파일 접근을 포트 하나로 좁혀 결함 주입 시험이 된다 | 모듈 사이 규칙(의존 방향)을 린트로 지켜야 한다 | 높음 |
| 클린/헥사고널 전체 (엔티티·유스케이스·게이트웨이·어댑터 계층) | 변경에 강하다 | 사용자 1명, 엔티티 3개, 인터페이스 12개 규모에 비해 계층과 변환 코드가 많다. "3회 미만이면 인라인" 원칙에 어긋난다 | 낮음 |

### 설계 결정 요약

- 선정 패턴: 프로세스 경계 레이어드 + 순수 도메인 코어 + 저장 포트 주입 (ADR-001)
- 핵심 이유: 규칙은 한 벌로 Node에서 시험하고, 파일 접근과 Electron 접근은 얇은 가장자리에 둔다. 포트(`FileSystemPort`)는 `03-api-spec.md`가 이미 정한 하나뿐이고 그 밖의 추상화는 만들지 않는다.
- 기각 대안: 플랫 단일 모듈 (규칙이 중복되어 어긋난다), 클린/헥사고널 전체 (이 규모에 과하다)

## 아키텍처 개요

- **패턴**: 세 프로세스(main, preload, renderer)로 나뉜 레이어드 구조. 모든 규칙은 Electron·Node·DOM을 모르는 순수 도메인 모듈(`shared/domain`)에 있고, main의 저장소(`KanbanStore`)는 그 규칙으로 새 문서를 만든 뒤 `FileSystemPort`를 통해서만 디스크에 쓴다. 화면은 `window.kanban`의 12개 함수만으로 저장소에 닿는다.
- **근거**:
  - 정본은 main의 메모리 문서 한 벌이다 (`02-data-model.md`). renderer는 사본과 화면 상태만 들고, 파일·Node에 닿지 못한다 (contextIsolation, 좁은 preload).
  - 마감 지남 판정, 검증, 검색·필터, 보관 규칙은 화면과 main이 같은 구현을 쓴다 (`03-api-spec.md`의 도메인 함수). 그래서 `cli` 시험이 Electron 없이 그 규칙을 그대로 시험한다.
  - 저장 절차(임시 파일 → 교체 + 직전 저장본)와 읽기 실패 잠금은 `KanbanStore`와 `DataFileRepository`에 모여 있다. `FileSystemPort`만 가짜로 바꾸면 모든 중단 시점을 시험할 수 있다 (NFR-002, AC-031, AC-032).
  - 서버, 계정, 외부 API가 없다 (CON-001). 네트워크를 쓰는 컴포넌트는 없고, 오히려 네트워크를 막는 컴포넌트(`NetworkGuard`)가 있다 (NFR-001).

## 시스템 구조

### 레이어 구성

```
 사용자 (마우스·키보드)
        │
┌───────▼───────────────────────────────────────────────────────┐
│ renderer 프로세스 (Chromium, 파일·Node 접근 없음)                  │
│   features(화면) → state(AppState, ChangeRunner) → model(표시 모델)  │
│   (Bootstrap의 오류 경계가 화면 전체를 감싼다)                    │
│        │  window.kanban.* 만 사용                                │
└────────┼───────────────────────────────────────────────────────┘
         │  contextBridge   ← preload (PreloadBridge: 12개 함수만 노출)
┌────────▼───────────────────────────────────────────────────────┐
│ main 프로세스                                                   │
│   IpcHandlers ─→ KanbanStore ─→ DataFileRepository              │
│   (채널 12개)      │  (줄 세우기,     │ (읽기·저장·버전 변환)           │
│                   │   메모리 문서)   └─→ FileSystemPort ← NodeFileSystem
│   AppLifecycle · WindowFactory · NetworkGuard   (앱 데이터 폴더)   │
└────────────────────┼───────────────────────────────────────────┘
                     ▼ 함수 호출 (순수)
       shared/domain  (Electron·Node·DOM 없음: 검증, 마감 지남, 검색, 카드 규칙, 날짜)
       shared/types · shared/ipc-contract
```

### 의존 규칙

| 모듈 | 의존해도 되는 것 | 의존하면 안 되는 것 | 강제 수단 |
|------|-----------------|--------------------|----------|
| `src/shared/**` | 자기 안의 모듈 | `electron`, `node:*`, `react`, `window`, `document`, `process` | ESLint `no-restricted-imports`, `no-restricted-globals` (폴더별 override) |
| `src/main/store/**` | `shared`. `node:fs/promises`는 `NodeFileSystem` 한 모듈만 (나머지는 파일 접근을 `FileSystemPort`로만 한다) | `electron`, `react`, `renderer`, `preload` | ESLint `no-restricted-imports` (`NodeFileSystem`만 예외) |
| `src/main/**` 전체 | `node:path` (경로 합치기. 파일에 접근하지 않는 순수 문자열 처리라 "파일 접근은 포트로만"의 의도를 해치지 않는다). 아이디는 전역 `crypto.randomUUID()`, 경로 기준은 `import.meta.dirname`·`import.meta.url`(import 없음) | `node:path` 외의 `node:*` (`NodeFileSystem`의 `node:fs/promises` 한 곳만 예외) | ESLint `no-restricted-imports` |
| `src/main/app/**` (+ `src/main/index.ts`) | `electron`, `main/store`, `shared` | `renderer`, `preload` | 같음 |
| `src/preload/**` | `electron`(`contextBridge`, `ipcRenderer`), `shared/ipc-contract`, `shared/types` | `main`, `renderer`, `node:*` | 같음 |
| `src/renderer/**` | `shared`, `window.kanban`(타입은 `shared/types`) | `electron`, `node:*`, `main`, `preload` | 같음 |
| `src/renderer/src/model/**` | `shared` | `react`, DOM 전역 | 같음 (Node에서 시험하려고) |

`tsconfig`는 둘로 나눈다. Node 쪽(`tsconfig.node.json`: main, preload, `tests/cli`)과 웹 쪽(`tsconfig.web.json`: renderer, 그리고 React 상태 파일을 불러오는 `tests/cli/state`)이 `shared`를 함께 본다. 루트 `tsconfig.json`은 에디터용 `{ "files": [] }`이고 `build` 스크립트는 두 하위 설정을 `tsc -p`로 각각 검사한다 (`01-tech-stack.md`). `shared`에는 DOM·Node 전용 API를 쓰지 않는다.

### 컴포넌트 설계

> 컴포넌트 이름은 코드 모듈 단위의 이름이다. `KanbanApi`, `KanbanStore`, `FileSystemPort`, 도메인 함수 이름은 `03-api-spec.md`, 화면·컴포넌트 이름은 `04-ui-spec.md`, 엔티티·필드 이름은 `02-data-model.md`와 같다. 컴포넌트는 모두 31개다 (공유 6, main 저장소 5, main 앱 4, preload 1, renderer 15).

#### 공유 계층 (`src/shared`, 순수)

##### SharedTypes
- **책임**: `03-api-spec.md`의 타입(`Card`, `ProgressEntry`, `Settings`, `Result`, `AppError`, `ErrorCode`, `StoreStatus`, `ReadFailure`, `CardQuery`, `CardCreateInput`, `CardPatch`, `Violation`, `KanbanApi` 등)과 `DataFile`, 값 목록 상수를 한 곳에 둔다. 매직 넘버·문자열 금지 원칙의 자리다.
- **의존**: 없음
- **인터페이스**:
  - `type DataFile = { schemaVersion: number; settings: Settings; cards: Card[]; progressEntries: ProgressEntry[] }`
  - `STATUSES`, `KINDS`, `PRIORITIES`, `THEMES` (허용 값 목록), `DEFAULT_THEME = 'light'` (명세 v4, ASM-017. 이미 저장된 값은 그대로 읽는다), `CURRENT_SCHEMA_VERSION = 2`
  - `PRIORITIES = ['low', 'medium', 'high']`: 배열 순서가 곧 화면 표시 순서(낮음, 중간, 높음)다. 사이드바 필터와 카드 입력의 분할 버튼이 이 배열을 `map`으로 펼치므로 순서를 한 곳에 둔다. 검증은 포함 여부만 보고 저장 파일에 순서가 남지 않아 스키마 영향이 없다 (`02-data-model.md` 설계 메모). `없음`은 값이 아니라 입력 화면 분할 버튼의 맨 앞 항목(`null`)이다
  - `CREATE_STATUSES = ['todo', 'in_progress']`: 생성 때 허용하는 상태 목록. `Validation`의 `create` 모드와 카드 입력의 새 카드 상태 선택이 같은 목록을 쓴다. `CardCreateInput.status?`의 타입이 이 목록의 원소다 (AC-041, AC-042). `Status` 전체(`done` 포함, `STATUSES`)는 `CardPatch`와 `Card`만 쓴다

##### IpcContract
- **책임**: 채널 이름 표를 한 곳에 두어 preload와 main이 같은 표에서 만든다 (표가 두 곳에서 어긋나지 않게).
- **의존**: SharedTypes
- **인터페이스**:
  - `IPC_CHANNELS`: 열두 항목. 예: `'cards.changeStatus' → 'kanban:cards:changeStatus'`. 목록은 `03-api-spec.md`의 채널 이름과 같다.
  - `type KanbanApi` (`SharedTypes`에서 재수출)

##### DateRules
- **책임**: 날짜만 다루는 모든 계산과 마감 지남 판정 (FR-012). PC 현지 날짜는 `todayLocal` 한 곳에서만 만든다.
- **의존**: SharedTypes
- **인터페이스**:
  - `todayLocal(now: Date): DateString` — 현지 시간대의 연·월·일 (UTC 아님)
  - `isRealDate(value: string): boolean` — `YYYY-MM-DD` 형식이고 달력에 있는 날짜 (윤년 반영)
  - `isOverdue(card: Pick<Card, 'dueDate' | 'status'>, today: DateString): boolean` — `dueDate !== null && dueDate < today && status !== 'done'`
  - `overdueDays(card, today): number | null` — 화면의 `N일 지남` 글자용. 지남이 아니면 `null`
  - `diffDays(from, to)`, `addDays(date, n)`, `weekdayOf(date)`, `daysInMonth(year, month)` — 달력 계산용. 모두 `Date.UTC` 기준이라 시간대·여름시간과 무관하다

##### Validation
- **책임**: `02-data-model.md`의 `검증 규칙과 제약 매핑` 표를 코드로 옮긴다. 입력은 모두 `unknown`으로 받아 모양부터 확인한다 (IPC 경계의 값은 믿지 않는다). 위반은 모아서 돌려준다.
- **의존**: SharedTypes, DateRules
- **인터페이스**:
  - `validateCardInput(input: unknown, mode: 'create' | 'update'): Violation[]` — `create` 모드는 `status`를 `todo`·`in_progress`만 허용하고 `done`을 포함한 그 밖의 값은 `status` / `INVALID_VALUE`로 모은다 (AC-042, 새 오류 코드 없음). `update` 모드는 세 값 모두 허용
  - `validateProgressInput(input: unknown): Violation[]`
  - `validateCardQuery(query: unknown): Violation[]` (`scope`, `kind`, `priority`, `text`)
  - `validateStatus(v)`, `validateTheme(v)`, `validateId(v)` — 값 하나짜리 인터페이스(`changeStatus`, `setTheme`, `get`)용
  - `normalizeTitle(s)`, 기록 내용도 같은 공백 제거 규칙을 쓴다 (앞뒤 공백 제거)

##### QueryFilter
- **책임**: 검색·필터 조건 판정 한 곳 (ASM-012). 제목 부분 일치, 대소문자 무시, 앞뒤 공백 제거, 종류·우선순위 일치, 모든 조건 AND, `scope`에 따른 보관 구분.
- **의존**: SharedTypes
- **인터페이스**: `matchesQuery(card: Card, query: CardQuery): boolean`. main의 `cards.list`와 renderer의 화면 필터가 같은 함수를 쓴다.

##### CardRules
- **책임**: 카드·기록·설정의 모든 변경 규칙을 "문서를 받아 새 문서를 돌려주는 순수 함수"로 둔다 (상태 전이, 보관 조건, 읽기 전용, 삭제 시 기록 함께 삭제, `statusAtTime` 채우기). 디스크와 시계를 직접 모른다. 시각과 아이디는 인자로 받는다. 입력 검증 → 대상 확인(`CARD_NOT_FOUND`) → 보관 확인(`CARD_ARCHIVED`) → 동작별 조건(`ARCHIVE_NOT_ALLOWED`) 순서는 `03-api-spec.md`의 `변경 동작의 공통 순서`와 같다. 저장소 상태 확인(`STORE_LOCKED`)과 저장은 이 모듈의 일이 아니다.
- **의존**: SharedTypes, Validation, DateRules
- **인터페이스**:
  - `type RuleContext = { now: () => Date; newId: () => string }`
  - `type RuleOutcome<T> = Result<{ next: DataFile; value: T; changed: boolean }>` — `changed: false`면 저장하지 않는다 (같은 status, 빈 patch, 같은 theme)
  - `createCard(doc, input: unknown, ctx)` (입력의 `status`를 그대로 쓰고 없으면 `todo`. 진행 중으로 만들어도 진행 기록은 만들지 않는다 — AC-041, ASM-004), `updateCard(doc, id, patch: unknown, ctx)`, `changeStatus(doc, id, status: unknown)`, `archiveCard(doc, id, ctx)`, `deleteCard(doc, id)`, `addProgress(doc, cardId, input: unknown, ctx)`, `setTheme(doc, theme: unknown)`
  - 조회용: `listCards(doc, query)`, `getCardDetail(doc, id)`

#### main 저장소 (`src/main/store`, Electron 금지)

##### KanbanStore
- **책임**: 화면 함수의 실제 구현 (`03-api-spec.md`의 `KanbanStore` 인터페이스 그대로). 상태 두 가지를 가진다: `ready`(메모리 문서 + 인덱스) 또는 `read_failed`(원인). 모든 변경을 한 줄로 세워 한 번에 하나씩 처리하고, 저장이 성공한 뒤에만 메모리 문서를 새 문서로 바꾼다 (ADR-003). 읽기 실패 상태에서는 변경·조회를 모두 `STORE_LOCKED`로 거절하고 파일에 쓰는 포트 동작을 부르지 않는다 (AC-032).
- **의존**: CardRules, DataFileRepository, QueryFilter, SharedTypes
- **인터페이스**: `createKanbanStore(deps: { dataDir; fs: FileSystemPort; clock: () => Date; newId: () => string }): KanbanStore` — `open`, `getStatus`, `retryOpen`, `list`, `get`, `create`, `update`, `changeStatus`, `archive`, `delete`, `addProgress`, `getSettings`, `setTheme`, `close`. 조회(`list`, `get`, `getSettings`)는 줄을 타지 않고 마지막으로 저장에 성공한 문서를 읽는다.
- **내부 규칙**: 변경 한 번의 흐름은 `큐에 넣기 → 상태 확인(STORE_LOCKED) → CardRules → changed면 DataFileRepository.save → 성공하면 문서·인덱스 교체`. 인덱스(`id → Card`, `cardId → ProgressEntry[]`)는 문서를 바꿀 때마다 다시 만든다 (카드 수천 건에서 문제없다고 추정, 측정하지 않음).

##### DataFileRepository
- **책임**: 저장 파일의 읽기와 저장 절차를 `FileSystemPort`로만 수행한다. 읽기: 본 파일 → 없으면 `.bak` → 둘 다 없으면 처음 실행, 실패 원인 분류(`ReadFailure.code` 여섯 가지), `.bak` 상태 조사(`absent`/`valid`/`invalid`). 저장: `write_temp → verify → backup → replace` 네 단계 (`02-data-model.md`의 `저장`). `write_temp`는 `writeFileSynced` 한 호출로 임시 파일 쓰기와 fsync를 함께 하므로 디스크 반영 실패도 `write_temp`로 보고한다. 이전 버전에서 변환된 문서를 처음 저장할 때는 `backup` 단계에 `kanban-data.pre-v{N}.json` 복사(없을 때만)를 포함한다. 읽지 못한 파일은 지우거나 덮어쓰지 않는다. 읽기 단계의 예상 못한 예외는 데이터를 쓰지 않는 쪽(읽기 실패)으로 처리하고 코드는 단계에 맞춰 정한다 (파싱 `JSON_PARSE_FAILED`, 변환 `MIGRATION_FAILED`, 검증 `SCHEMA_INVALID`).
- **의존**: SchemaMigrations, DataFileValidator, SharedTypes
- **인터페이스**:
  - `read(): Promise<ReadOutcome>` — `{ ok: true; doc; firstRun; recoveredFromBackup; migratedFromVersion } | { ok: false; failure: ReadFailure }`. 파일을 쓰지 않는다.
  - `save(next: DataFile, ctx: { migratedFromVersion: number | null }): Promise<{ ok: true } | { ok: false; stage: 'write_temp' | 'verify' | 'backup' | 'replace'; osCode?: string }>`
  - 파일 이름은 이 모듈의 상수 한 곳에 둔다: `kanban-data.json`, `kanban-data.json.<프로세스 id>.tmp`, `kanban-data.json.bak`, `kanban-data.pre-v{N}.json`, 데이터 폴더 이름 `APP_DATA_FOLDER`. 임시 파일 이름에 프로세스 id를 붙여 같은 폴더를 쓰는 두 실행의 임시 파일이 겹치지 않게 한다 (동시 실행을 막지는 않는다. 비정상 종료로 남은 고아 `.tmp`는 읽을 때 무시하고 앱이 지우지 않는다). 프로세스 id는 `save`의 인자로 받아 시험이 고정 값을 줄 수 있다.
  - 읽기 실패의 `ReadFailure`에는 읽지 못한 파일 경로(`dataFilePath`), 직전 저장본의 경로(`backupPath`)와 상태(`backup`), 있는 버전 변환 전 사본의 경로(`preMigrationCopies`)를 담는다 (`exists`로 확인하고 파일 목록 조회 동작을 포트에 더하지 않는다).

##### DataFileValidator
- **책임**: 읽은 문서의 모양과 불변식 검사 (`02-data-model.md`의 구조 불변식: id 중복 없음, `cardId` 존재, `archivedAt ≠ null`이면 `status = done`, 시각 형식, 현재 버전 파일의 `settings.theme`). 조용히 고치거나 버리지 않고 `SCHEMA_INVALID` 또는 `INTEGRITY_VIOLATED`로 돌려준다. 필드 단위 규칙은 `Validation`을 재사용한다.
- **의존**: Validation, SharedTypes
- **인터페이스**: `validateDataFile(value: unknown): { ok: true; doc: DataFile } | { ok: false; code: 'SCHEMA_INVALID' | 'INTEGRITY_VIOLATED'; issues: string[] }`. 저장의 `verify` 단계도 같은 함수를 쓴다.

##### SchemaMigrations
- **책임**: 스키마 버전 변환 사슬 (NFR-003). `schemaVersion`을 읽어 현재 버전까지 `N → N+1` 함수를 차례로 적용한다. 변환은 메모리에서만 일어난다. 버전 1 → 2는 `settings = { theme: DEFAULT_THEME }`(`light`, 명세 v4)를 채운다. 이미 `settings.theme`가 저장된 버전 2 파일의 값(`dark` 포함)은 바꾸지 않고 마이그레이션도 새로 두지 않는다 (`schemaVersion`은 2 그대로). 현재보다 높은 버전은 `SCHEMA_TOO_NEW`. 한 번 배포한 변환 함수는 지우지 않는다.
- **의존**: SharedTypes
- **인터페이스**: `migrate(raw: unknown): { ok: true; doc: unknown; fromVersion: number | null } | { ok: false; code: 'SCHEMA_TOO_NEW' | 'MIGRATION_FAILED' | 'SCHEMA_INVALID'; fileSchemaVersion?: number }`, `MIGRATIONS: Record<number, (doc) => unknown>`

##### NodeFileSystem
- **책임**: `FileSystemPort`의 실제 구현. Node `fs/promises`로 다섯 동작만 한다. `writeFileSynced`는 열고 쓰고 fsync하고 닫는다. `rename`은 같은 폴더 안에서 기존 파일을 덮어쓴다. Windows에서 백신·검색 색인·클라우드 동기화가 대상 파일을 잠깐 잡으면 `rename`이 간헐적으로 `EPERM`/`EBUSY`/`EACCES`로 실패할 수 있어, `rename` 안에서만 이 세 코드에 한해 20~50ms 간격으로 최대 3~5회 다시 시도하고 모두 실패하면 마지막 오류를 던진다 (`SAVE_FAILED`, stage `replace`). 포트 인터페이스와 `DataFileRepository`의 절차는 바뀌지 않고, 다시 시도 간격·횟수는 구현 첫 Task에서 정한다 (RK-013). 오류는 OS 오류 코드(`code`)를 보존한 채 그대로 던진다 (위 `DataFileRepository`가 단계와 함께 변환한다).
- **의존**: `node:fs/promises` (이 컴포넌트만 Node에 직접 닿는다)
- **인터페이스**: `FileSystemPort` — `readFile`, `exists`, `writeFileSynced`, `copyFile`, `rename`

#### main 앱 (`src/main/app`, `src/main/index.ts`, Electron 사용)

##### AppLifecycle
- **책임**: 조립 지점(composition root). 순서: ⓪ (`app.ready` 전) 데이터 폴더 고정 — 시험이 주는 `--user-data-dir` 스위치가 없을 때만(`app.commandLine.hasSwitch('user-data-dir')`) `app.setPath('userData', join(app.getPath('appData'), APP_DATA_FOLDER))`로 지정한다. 개발 실행(`!app.isPackaged`)은 `APP_DATA_FOLDER + '-dev'`를 쓴다. 데이터 폴더 이름이 표시용 앱 이름(`package.json`의 `name`/`productName`)과 분리되어, 앱 이름을 나중에 정하거나 바꿔도 데이터 위치가 바뀌지 않고 개발 중 코드가 실제 데이터 파일에 닿지 않는다 (RK-004, ADR-012). ① 데이터 폴더(`app.getPath('userData')`)가 없으면 만든다 (포트 밖의 한 번짜리 `mkdir`) ② `NodeFileSystem`, 시계(`() => new Date()`), 아이디(`crypto.randomUUID`), 프로세스 id(`process.pid`)를 주입해 `KanbanStore` 생성·`open()` ③ `NetworkGuard` 설치 ④ `IpcHandlers` 등록 ⑤ 저장된 판을 읽어(읽기 실패이면 `DEFAULT_THEME`, 곧 밝은 판) `WindowFactory`로 창 생성. `autoUpdater`, 원격 분석, 충돌 보고를 쓰지 않는다 (NFR-001). 단일 실행 잠금을 쓰지 않는다 (명세가 기각한 기능).
  - **경로**: main은 ESM이라 `__dirname`이 없다. `import.meta.dirname`과 `node:path`의 `join`으로 preload(`../preload/index.cjs`)와 renderer 문서(`../renderer/index.html`) 경로를 만들고(빌드 결과 `out/main/index.js` 기준), 앱 주소 접두사는 `new URL('../renderer/', import.meta.url).href`로 만든다 (`node:url` 불필요). 개발 실행 판정은 `process.env['ELECTRON_RENDERER_URL']` 유무 하나다: 있으면 `loadURL`, 없으면 `loadFile`. 이 환경 변수와 `import.meta.dirname`이 electron-vite 6 번들에서 기대대로인지는 구현 첫 Task에서 확인한다 (확인하지 못함).
  - **창을 닫을 때 (RK-002, 사용자 결정 D2)**: 변경 요청은 renderer에서 대기하지 않고 즉시 보내진다. 창 `close` 이벤트에서 `IpcHandlers.whenIdle()`을 확인해, 이미 받은 요청이 처리 중이면 `event.preventDefault()`로 한 번 닫기를 미루고 모두 끝난 뒤 창을 다시 닫는다. 그 뒤 정상 종료(`before-quit`)는 한 번 멈춰 세우고 `store.close()`(줄 서 있는 저장 완료)를 기다린 뒤 종료한다 (NFR-002). 창이 닫히는 순간 아직 main에 도착하지 않은 요청이 있을 수 있는지는 확인하지 못했다(구현 뒤 `browser` 시험으로 확인).
  - **예상 못한 오류 (FE-007)**: `process.on('uncaughtException')`은 `console.error`로 message·stack을 남기고 `dialog.showErrorBox`로 알린다 (핸들러를 등록하면 Electron 기본 오류 창이 뜨지 않기 때문). 앱을 강제로 끝내지 않는다. `process.on('unhandledRejection')`은 `console.error`만 한다. 저장 중 예외여도 `KanbanStore`가 이전 문서를 지키므로 데이터는 바뀌지 않는다. 로그 파일은 만들지 않는다 (요구가 없고 파일 쓰기 표면이 늘어난다).
  - **Chromium 자체의 요청**: `app.ready` 전에 `restrictChromiumNetwork`(`NetworkGuard`)를 부른다.
- **의존**: KanbanStore, NodeFileSystem, IpcHandlers, WindowFactory, NetworkGuard, DataFileRepository(`data-file-names.ts`의 이름 상수만)
- **인터페이스**: 없음 (진입점)

##### WindowFactory
- **책임**: `BrowserWindow` 생성과 보안 기본값. 크기 1280x920(`WINDOW_HEIGHT` 920. 제목 표시줄을 포함한 바깥 크기의 설계 기본값이고, 구현에서 실측해 확정한다 — `04-ui-spec.md` `결정 필요` 12, AC-048), 최소 1200x700 (`WINDOW_MIN_HEIGHT` 700 그대로), `show: false`로 만들고 `ready-to-show`에서 보인다. 창 바탕색은 저장된 판의 `bg-app` 값(어두운 판 #1F1814, 밝은 판 #FAF3EE)으로 정한다. 초기 판은 `additionalArguments`로 preload에 넘긴다 (ADR-008). 저장된 값이 없거나 읽기 실패이면 기본값(`DEFAULT_THEME` = 밝은 판, 바탕색 #FAF3EE. 어두운 판을 저장한 사용자에게는 어두운 바탕으로 연다). 경로(preload 파일, renderer 진입)는 `AppLifecycle`이 만들어 넘긴다. 창 수명 오류 처리 (FE-007): `webContents`의 `render-process-gone`과 주 프레임의 `did-fail-load`를 받으면 `console.error`로 이유(`reason`, `errorCode`, `errorDescription`, `validatedURL`)를 남기고 `dialog.showErrorBox`로 알린 뒤 `app.quit()`한다 (저장은 `before-quit`에서 줄을 비운 뒤 끝난다). 빈 창을 그냥 두지 않는 것이 목적이다.
- **의존**: Electron
- **인터페이스**: `createMainWindow(options: { initialTheme: Theme; preloadPath: string; rendererEntry: { kind: 'file'; path: string } | { kind: 'url'; url: string } }): BrowserWindow`. `webPreferences`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, `webviewTag: false`, `allowRunningInsecureContent: false`, `preload`는 빌드된 preload 하나.

##### NetworkGuard
- **책임**: NFR-001의 차단 장치. (1) `session.webRequest.onBeforeRequest`에서 허용 목록 밖의 요청을 취소한다. 허용 목록은 `file:` 전체가 아니라 앱 번들 폴더(`out/renderer`)의 URL 접두사 하나(`AppLifecycle`이 `new URL('../renderer/', import.meta.url).href`로 만든다), `devtools://`, 개발 실행일 때만 개발 서버 주소(`ELECTRON_RENDERER_URL`의 `http:` 주소와 같은 호스트의 `ws:` 주소, HMR 연결용)다 (RK-008). Windows의 `file:` 주소 대소문자·퍼센트 인코딩이 접두사 비교와 어긋나지 않는지는 구현 첫 Task에서 확인한다 (확인하지 못함) (2) 창에서 새 창 열기 거부(`setWindowOpenHandler`), 앱 주소 밖으로의 이동 거부(`will-navigate`, `will-redirect`) (3) 권한 요청(카메라, 알림 등) 모두 거부 (4) `will-attach-webview` 거부 (5) Chromium 프로세스 자체의 요청(WPAD 프록시 자동 감지, DNS 선조회 등)은 위 (1)~(4)가 닿지 않는다 (RK-007). **구현 첫 Task에서 확인할 완화 후보이며 이 설계는 실행해 확인하지 못했다**: `app.ready` 전 `app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND, EXCLUDE localhost')` (개발 서버를 위해 `localhost`는 예외), 세션에 `setProxy({ mode: 'direct' })`(프록시 자동 감지 제거). Electron 45에서 먹히는지, 개발 서버·Playwright 구동을 깨지 않는지는 구현에서 `--log-net-log`로 요청이 0건인지 읽어 확인한다 (`07-test-plan.md`의 수동 확인). 효과가 없거나 부작용이 있으면 적용하지 않고 `ADR-005`대로 넷로그로 관찰만 한다.
- **의존**: Electron
- **인터페이스**: `installNetworkGuard(session: Session, options: { allowedPrefixes: string[]; dev: boolean }): void`, `lockWindowNavigation(win: BrowserWindow): void`, `restrictChromiumNetwork(app: App, options: { dev: boolean }): void`

##### IpcHandlers
- **책임**: `IPC_CHANNELS`의 열두 채널만 `ipcMain.handle`로 등록한다. 목록에 없는 채널은 만들지 않는다. 각 핸들러는 (1) 호출한 프레임이 앱의 렌더러 주소인지 확인(`event.senderFrame`)하고 아니면 거절 (2) 인자를 `unknown`으로 `KanbanStore` 메서드에 넘김 (3) 예상 못한 예외를 `{ ok: false, error: { code: 'INTERNAL', message } }`로 바꿔 던지지 않는다. `INTERNAL`을 만들 때 main의 `console.error`로 채널 이름·`message`·stack을 남긴다 (포장 앱은 `--enable-logging`으로 볼 수 있다. 로그 파일은 만들지 않는다. FE-007, RK-012). 화면에는 일반 문구와 접힌 `자세히`로 `message`를 보인다. (4) 처리 중인 요청 수를 센다 (`whenIdle`). 이 모듈이 예외를 잡는 유일한 경계다. 호출 프레임 확인의 `appUrlPrefix`는 `NetworkGuard`의 앱 번들 폴더 URL 접두사와 같은 값이다 (RK-008).
- **의존**: KanbanStore, IpcContract
- **인터페이스**: `registerIpcHandlers(store: KanbanStore, options: { appUrlPrefix: string }): { whenIdle(): Promise<void> }` — `whenIdle`은 이미 받은 요청이 모두 끝나면 이행되는 promise (창 닫기 대기용, 새로 도착하는 요청은 기다리지 않는다)

#### preload (`src/preload`)

##### PreloadBridge
- **책임**: `contextBridge.exposeInMainWorld('kanban', api)`로 열두 함수만 노출한다. 각 함수는 `ipcRenderer.invoke(채널, ...인자)` 한 줄이다. `ipcRenderer`, 채널 이름, Node 객체를 노출하지 않는다. 한 가지 부수 동작: `additionalArguments`로 받은 초기 판(저장된 값, 없거나 읽기 실패면 `DEFAULT_THEME` = 밝은 판)을 `<html data-theme>`에 적는다 (ADR-008). 인자가 없거나 알 수 없는 값이면 아무것도 적지 않고 기본 판은 CSS `:root`(밝은 판, ADR-008)가 정한다. preload는 문서 시작 때 실행되어 `document.documentElement`가 아직 없을 수 있다. 있으면 바로 적고, 없으면 `document`에 `MutationObserver`(`childList`)를 걸어 `<html>`이 생기는 즉시 한 번 적고 끊는다 (`DOMContentLoaded`는 너무 늦다). 이 적기가 어긋나도 데이터는 안전하다: 창은 `show: false`로 만들어 `ready-to-show`에서 보이고 창 바탕색이 판에 맞아 있으며, `Bootstrap`의 `settings.get()` 확정이 마지막 안전망이다. 허용 기준은 "첫 그림이 저장된 판과 다른 판으로 한 번 보이지 않으면 충분, 보이면 안전망으로 맞춘다"이고 첫 화면 색 깜빡임은 수동 확인에 포함한다. 로직이나 검증을 두지 않는다. 출력은 CJS `index.cjs`다 (ADR-005).
- **의존**: IpcContract, SharedTypes, `electron`
- **인터페이스**: `window.kanban: KanbanApi` (`store` 2, `cards` 7, `progress` 1, `settings` 2)

#### renderer (`src/renderer`)

##### Bootstrap
- **책임**: 시작 순서. `store.getStatus()` → `ready`면 `settings.get()`으로 `data-theme` 확정 → 보관하지 않은 카드와 보관한 카드 목록을 받아 `AppState`를 채운 뒤 화면을 그린다. `read_failed`면 데이터 호출을 하지 않고 읽기 실패 화면으로 간다. 읽는 중이 200ms를 넘을 때만 `저장된 카드를 불러오는 중`을 보인다. 화면 전체를 감싸는 React 오류 경계 한 개를 같은 파일(`main.tsx`)에 둔다 (`AppShell` 바깥): 렌더 오류를 잡아 `console.error`로 남기고 `Labels`의 문구 `화면을 그리지 못했습니다`와 접힌 `자세히`(오류 message)만 보인다 (FE-007). 오류 경계는 클래스 컴포넌트만 가능해서 `코딩 스타일`의 "클래스 컴포넌트 금지"의 유일한 예외다. `window`의 `error`·`unhandledrejection`은 `console.error`만 한다.
- **의존**: AppState, ThemeController, Labels, `window.kanban`
- **인터페이스**: 진입점 (`main.tsx`)

##### AppState
- **책임**: renderer의 상태 보관. 세 덩어리를 `Context + useReducer`로 둔다 (ADR-006): `DataState`(boot 상태, 보드 카드 목록, 보관함 카드 목록, 판. 초기 판은 `DEFAULT_THEME` = 밝은 판이고 `Bootstrap`이 저장된 값으로 확정한다), `UiState`(현재 화면 키, 보드·보관함 조건, 캘린더 보기·기간, 열린 대화상자), `SaveState`(`saved`/`saving`/`failed`/`unavailable`, 재시도 대상). 화면 조건은 저장하지 않는다 (앱이 켜져 있는 동안만).
- **의존**: SharedTypes, BoardModel, CalendarModel
- **인터페이스**: `useData()`, `useUi()`, `useSaveState()` 훅과 reducer 액션. 상태를 바꾸는 쪽은 `ChangeRunner`와 `Bootstrap`뿐이다.

##### ChangeRunner
- **책임**: 화면에서 일어나는 모든 변경 호출을 한 곳에서 실행한다. (1) 변경을 renderer에 쌓지 않고 즉시 `window.kanban`으로 보내고 결과만 기다린다. 보낸 순서는 IPC가 지키고 main의 줄이 한 번에 하나씩 처리하므로 renderer 대기열이 필요 없다 (RK-002). (2) 판 전환(`setTheme`)만 낙관적이다: 화면을 먼저 바꾸고 저장하며 실패해도 되돌리지 않는다 (UC-011 Alt Flow 1). 칸 이동, 캘린더 끌기(마감일 변경), 보관, 삭제, 만들기, 수정, 기록 추가는 낙관적으로 반영하지 않는다: 요청을 보내는 동안 `SaveState`를 `saving`으로 두고, `ok: true`를 받은 뒤에만 반환된 값으로 화면 사본을 바꾼다 (사용자 결정 D2). (3) `SAVE_FAILED`면 화면 사본은 바뀌지 않고 `SaveState`를 `failed`로 바꿔 저장 실패 안내를 보인다. `다시 저장`은 실패한 요청 한 건을 그대로 다시 보낸다 (AC-031). 화면과 저장소가 같은 상태이므로 롤백, 재동기화, 쌓아 둔 변경이 필요 없다 (판 전환만 화면이 앞서 있다). (4) 그 밖의 오류: `VALIDATION_FAILED`는 `Result`로 돌려줘 대화상자가 입력 칸에 붙인다. `CARD_NOT_FOUND`, `CARD_ARCHIVED`, `ARCHIVE_NOT_ALLOWED`는 화면 사본이 오래된 것이므로 main의 목록을 다시 받아 사본만 맞춘다 (되돌릴 낙관적 반영이 없다). (4-1) 변경 요청 종류(`state-types.ts`의 `ChangeRequest`)에 `moveDueDate`(카드 id, 새 마감일)를 더한다. `cards.update(id, { dueDate })` 한 호출이고 성공 처리는 `updateCard`와 같지만(반환된 카드로 사본 교체) 종류를 따로 두는 이유는 실패 안내 위치가 다르기 때문이다: 대화상자 저장(`updateCard`)의 실패는 대화상자 안 알림이 맡고, 캘린더 끌기(`moveDueDate`)의 실패는 칸 이동·보관·삭제처럼 본문 위 알림 줄(`AppShell`의 `saveFailureMessage`)과 `다시 저장`이 맡는다 (AC-046). 놓은 날짜가 카드의 현재 마감일과 같으면 호출하지 않는 판단은 놓기를 받는 `CalendarScreen`의 일이다 (AC-045). (5) 호출이 거절되거나 예외로 실패하면(IPC 자체 실패) `INTERNAL`로 바꿔 같은 경로를 탄다. (6) `STORE_LOCKED`를 받으면 읽기 실패 화면으로 간다. 진행 중인 요청 수가 0이 되면 `SaveState`는 `saved`로 돌아간다 (마지막 요청이 실패였으면 `failed`).
- **의존**: AppState, `window.kanban`
- **인터페이스**: `useChanges()` → `createCard(input)`, `updateCard(id, patch)`, `moveCard(id, status)`, `moveDueDate(id, dueDate)`, `archiveCard(id)`, `deleteCard(id)`, `addProgress(cardId, content)`, `setTheme(theme)`, `retryFailed()`. 각 함수는 `Result`를 돌려주어 대화상자가 `VALIDATION_FAILED.details.violations`의 `field`를 입력 칸에 붙일 수 있다.

##### ThemeController
- **책임**: `<html data-theme>` 적용과 판 전환 연결 (FR-014, UC-011). 판 전환을 선택하면 즉시 `data-theme`를 바꾸고 `ChangeRunner.setTheme`으로 저장한다. 저장이 실패해도 판을 되돌리지 않고 이번 실행 동안 유지한다. 읽기 실패 상태에서는 `STORE_LOCKED`를 받아도 이번 실행에만 적용한다 (`04-ui-spec.md`의 읽기 실패 화면).
- **의존**: AppState, ChangeRunner
- **인터페이스**: `useTheme(): { theme: Theme; setTheme(theme: Theme): void }`, `applyTheme(theme: Theme): void`

##### BoardModel
- **책임**: 보드·보관함·사이드바가 쓰는 표시 모델 계산 (React 없음, 순수). 상태별 칸 나누기, 조건 적용(`matchesQuery`), 사이드바 건수(`countFilters`: 범위 전체 `total`, 종류별, 우선순위별. 모두 같은 범위(보드는 보관하지 않은 카드, 보관함은 보관한 카드) 전체에서 센 값이고 검색·필터의 영향을 받지 않는다. `전체` 항목의 건수가 `total`이다 — AC-047), 칸 머리 건수(`2 / 6`), 마감 지난 카드 수, 화면에 보일 순서. 보여 줄 순서는 사용자가 정하지 않았으므로(CAND-005) 순서 함수를 한 곳(`orderForDisplay`)에 두고 `04-ui-spec.md`의 임시 가정(보드는 만든 순서의 최신이 위, 보관함은 보관한 날 최신이 위)을 그대로 쓴다. 정렬이 정해지면 이 함수만 바뀐다.
- **의존**: QueryFilter, DateRules, SharedTypes
- **인터페이스**: `splitByStatus(cards)`, `applyConditions(cards, query)`, `countFilters(cards)`, `columnCounts(all, shown)`, `overdueCount(cards, today)`, `orderForDisplay(cards, scope)`

##### CalendarModel
- **책임**: 캘린더 격자 계산 (ADR-009). 월 격자(일요일 시작, 4~6행), 주 한 줄, 날짜별 카드 묶기(마감일이 있는 카드만), 칸당 칩 3개와 `+N건 더 보기` 나누기, 이전·다음·오늘로 이동, 마감일이 없는 카드 수, 해당 월에 마감인 카드 수.
- **의존**: DateRules, SharedTypes
- **인터페이스**: `buildMonthGrid(anchor: DateString): CalendarCell[][]`, `buildWeek(anchor): CalendarCell[]`, `groupByDueDate(cards): Map<DateString, Card[]>`, `splitVisible(cards, limit): { shown: Card[]; hiddenCount: number }`, `shiftPeriod(mode, anchor, delta): DateString`, `periodTitle(mode, anchor): string`

##### AppShell
- **책임**: 사이드바(이동 3항목, 종류·우선순위 필터, 화면 밝기, 저장 상태), 상단 막대(`TopBar`), 하단 줄, 저장 실패 알림 줄(`Banner`)의 자리와 현재 화면 전환. 사이드바 필터(`FilterGroup`)는 종류·우선순위 두 목록 모두 맨 위에 `전체` 항목을 두고(건수는 `countFilters`의 `total`), 처음 `전체`가 선택되어 있다. 한 목록에서는 라디오처럼 항목 하나만 선택되고, 선택된 항목을 다시 눌러도 해제하지 않는다(해제 동작 없음). `전체`를 고르면 그 조건을 `undefined`로 돌려 조건을 없앤다(별도 조건 값 없음, AC-047). 우선순위 목록은 `전체`, `낮음`, `중간`, `높음` 순서이고 `없음`은 목록에 없다. 알림 줄의 문구는 `saveFailureMessage`가 실패한 요청 종류로 고른다: `setTheme`은 밝기 전환 문구, `moveCard`·`moveDueDate`·`archiveCard`·`deleteCard`는 카드 변경 문구(`저장하지 못했습니다. 카드는 바뀌지 않았습니다.`), 대화상자 안에서 난 실패(`createCard`·`updateCard`·`addProgress`)는 대화상자가 맡아 알림 줄에 나오지 않는다. **상단 막대와 하단 줄의 소유자는 `AppShell`이다.** 세 화면 컴포넌트는 막대와 하단 줄을 그리지 않고 본문만 그린다. 캘린더 화면에서는 기간 이동(`PeriodNav`)과 `월 | 주` 분할 버튼(`SegmentedControl`)을 `AppShell`이 `TopBar`의 children으로 넣고, 기준 날짜와 보기는 `UiState.calendar`에서 읽어 바꾼다. 하단 줄 내용은 현재 화면에 따라 `AppShell`이 정한다: 보드 `카드 N건 · 보관함 N건`, 캘린더 `N월에 마감인 카드 N건`(`CalendarModel`로 센다), 보관함 `보관함 N건`. 화면 키(`board`, `calendar`, `archive`)에 따라 본문을 바꾸고 카드 대화상자를 본문 위에 얹는다. 읽기 실패이면 본문 전체를 `ReadFailurePanel`로 대체하고 이동·검색·필터·`카드 만들기`를 비활성화한다.
- **의존**: AppState, ThemeController, CalendarModel, DateRules, BoardScreen, CalendarScreen, ArchiveScreen, CardDialog, ReadFailurePanel, CommonUi
- **인터페이스**: `<AppShell />` (Sidebar, TopBar, 하단 줄. 캘린더의 `PeriodNav`는 `features/calendar/`에 있고 `AppShell`이 쓴다)

##### BoardScreen
- **책임**: SCR-001. 칸 3개, 카드, 정보 줄(오늘, 마감 지난 카드 요약), 조건 줄, 끌어다 놓기와 `⋯` 상태 이동 메뉴, 완료 카드 보관의 인라인 확인, 빈 칸·결과 없음 표시. 상단 막대(검색, `카드 만들기`)와 하단 줄은 `AppShell`의 `TopBar`와 하단 줄이 그리고 이 화면은 그리지 않는다. 마감 지남은 화면을 그릴 때마다 `todayLocal(new Date())`로 새로 구한 오늘로 판정한다 (저장하지 않음).
- **의존**: AppState, ChangeRunner, BoardModel, DateRules, CommonUi
- **인터페이스**: `<BoardScreen />` (Board, Column, CardItem, CardMoveMenu, ArchiveConfirm, ConditionBar, OverdueSummary)

##### CardDialog
- **책임**: SCR-002. 모드 `new` / `edit` / `readonly`. 열 때 `cards.get(id)`로 카드와 기록을 받는다. 입력 검증은 저장 전에 `Validation`으로 미리 보여 주고(AC-002, AC-029, AC-035), 최종 판단은 main의 `VALIDATION_FAILED`에 따른다. 상태 선택은 새 카드 모드에서 잠기지 않고 `할 일`(처음)·`진행 중` 두 항목뿐이며(`완료` 없음), 고른 값이 `createCard` 입력의 `status`로 간다. 상세(편집) 모드는 세 항목이다 (AC-041, AC-042). 마감일 칸은 브라우저 기본 날짜 입력(`input type="date"`, 값 `YYYY-MM-DD`, 날짜 라이브러리 없음)이고, 입력하다 만 값(`validity.badInput`)은 값이 비어 보이므로 `CardForm`이 이를 감지해 기존 `dueDate` 오류 문구(AC-029)를 보이고 저장하지 않는다 (`04-ui-spec.md` `결정 필요` 13의 임시 가정). 마감일 칸에 입력하다 만 값이 있을 때와 칸을 비운 것(마감 없음, `null`)은 `card-form-state`가 구분한다. 저장 실패 시 대화상자를 열어 두고 입력을 지우지 않는다 (AC-031). 삭제는 바닥 줄 확인 뒤에만 `deleteCard`를 부른다 (AC-033). 진행 기록 추가는 카드 저장과 별개로 즉시 저장한다. 닫으면 미저장 입력은 버려진다.
- **의존**: AppState, ChangeRunner, Validation, CommonUi
- **인터페이스**: `<CardDialog mode cardId onClose />` (CardForm, ProgressLog, ProgressInput, DeleteConfirmBar). 브라우저 내장 `<dialog>`와 `showModal()`을 쓴다 (ADR-011).

##### CalendarScreen
- **책임**: SCR-003. 날짜 칸의 칩, `+N건 더 보기` 팝업, 범례, 마감일 없는 카드 안내. 칩을 누르면 `CardDialog`를 연다 (AC-030). 칩을 끌어 다른 날짜 칸에 놓아 마감일을 바꾸는 놓기 처리(`onDropCard(cardId, date)`)를 소유한다: 월·주 보기 모두, 이 달 밖 칸에도 놓을 수 있다 (AC-044). 끌리는 카드 id는 화면 안의 지역 상태 하나로 쥐고(보드와 달리 `UiState`에 두지 않는다), 놓인 날짜가 그 카드의 현재 마감일과 같거나 날짜 칸 밖이면 호출하지 않으며(AC-045), 아니면 `ChangeRunner.moveDueDate(id, date)`를 부른다. 낙관적 반영 없이 저장 성공 뒤에 칩이 새 칸으로 옮겨 가고, 실패하면 화면은 그대로이고 알림 줄 `다시 저장`이 같은 요청을 다시 보낸다 (AC-046). `+N건 더 보기` 팝업(`DayPopover`) 안의 칩은 끌 수 없다 (끌지 않는 방법: 칩을 눌러 카드 입력 화면의 마감일 칸에서 고친다, AC-043). 보관한 카드는 목록에 없어 나타나지 않는다 (AC-019). 사이드바 필터와 보드의 조건은 영향을 주지 않는다. 상단 막대(`보드로 돌아가기`, 기간 이동, `월 | 주` 분할 버튼)와 하단 줄(`N월에 마감인 카드 N건`)은 `AppShell`이 그리고 이 화면은 그리지 않는다.
- **의존**: AppState, ChangeRunner, CalendarModel, DateRules, CommonUi (ChangeRunner는 명세 v4의 끌기 때문에 더해졌다)
- **인터페이스**: `<CalendarScreen />` (CalendarView, MonthGrid, WeekGrid, DayCell(놓는 곳), CalendarChip(끄는 것. `draggable`, 팝업 안은 `false`), DayPopover. `PeriodNav`는 같은 폴더에 두지만 `AppShell`이 `TopBar`에 넣는다)

##### ArchiveScreen
- **책임**: SCR-004. 보관한 카드 목록, 검색·필터, 결과 없음·빈 목록 표시, 행을 눌러 보기 전용 `CardDialog` 열기, 행의 `삭제`와 인라인 삭제 확인(AC-040: 보관한 카드도 확인 단계 뒤 삭제, 진행 기록 함께 삭제). 삭제는 `ChangeRunner.deleteCard`를 확인 뒤에만 부르고, 저장이 성공해야 행이 사라지며 실패하면 행은 확인 줄 그대로 남는다. 읽는 화면이라 마감 지남 표시를 쓰지 않는다. 상단 막대(`보드로 돌아가기`, 제목, 검색)와 하단 줄(`보관함 N건`)은 `AppShell`이 그리고 이 화면은 그리지 않는다.
- **의존**: AppState, ChangeRunner, BoardModel, CommonUi
- **인터페이스**: `<ArchiveScreen />` (ArchiveList, ArchiveRow)

##### ReadFailurePanel
- **책임**: AC-032의 화면. 빈 보드와 모양이 다른 오류 패널: 원인 문장(`ReadFailure.code`의 화면 문구와 OS 오류 코드), 읽지 못한 파일 경로(`dataFilePath`), 직전 저장본(`backupPath`)의 경로와 상태(`backup`), 있는 버전 변환 전 사본 경로, 직전 저장본이 `valid`일 때의 수동 절차 문구(`앱을 닫고 폴더에서 kanban-data.json을 다른 이름으로 바꾼 뒤 다시 열면 직전 저장본으로 열립니다`), `다시 읽기` 버튼(`store.retryOpen`). 앱 안에는 직전 저장본으로 열기나 파일 옮기기 동작을 넣지 않고 파일을 지우거나 쓰지 않는다 (사용자 결정 D3). 성공하면 `Bootstrap`의 데이터 읽기 단계로 돌아간다.
- **의존**: AppState, CommonUi
- **인터페이스**: `<ReadFailurePanel failure />`

##### CommonUi
- **책임**: 화면이 공유하는 조각: `Button`, `IconButton`, `TextInput`, `TextArea`, `SegmentedControl`, `RadioRow`, `Chip`, `KindChip`, `PriorityMark`, `DueText`, `Icon`(인라인 SVG), `Banner`, `Menu`/`Popover`, `EmptyState`, `SearchBox`. NFR-004의 색 외 구분(`KindChip`의 아이콘+글자, `DueText`의 삼각형+`N일 지남`)이 여기서 한 번만 구현된다.
- **의존**: Labels, Styles
- **인터페이스**: `04-ui-spec.md`의 `재사용 컴포넌트 목록`과 같은 이름·props

##### Labels
- **책임**: 화면 문구 상수. 값 이름(`todo`, `bug`, `high` 등)을 화면 글자(할 일, 개발 버그, 높음)로 바꾸는 표(`PRIORITY_LABEL`: `low` 낮음, `medium` 중간 — 명세 v4에서 `보통`이 `중간`으로 바뀌었다, 저장 값은 그대로 —, `high` 높음. 사이드바 필터의 `전체` 문구도 여기 한 곳), 오류 코드를 사용자 문구로 바꾸는 표 (`AppError.message`는 진단용이라 화면에 그대로 보이지 않는다). 한국어 고정 (ASM-016).
- **의존**: SharedTypes
- **인터페이스**: `STATUS_LABEL`, `KIND_LABEL`, `PRIORITY_LABEL`, `errorText(code)`, `violationText(violation)`

##### Styles
- **책임**: `tokens.css`(두 판의 CSS 변수와 `color-scheme`), 기본 스타일, 글꼴 `@font-face`. 글꼴 파일과 라이선스 문구 파일을 앱에 포함한다 (NFR-001). 컬러 값은 `04-ui-spec.md`의 토큰 이름과 값을 그대로 옮긴다.
- **의존**: 없음
- **인터페이스**: CSS 변수 이름 (`--bg-app`, `--text`, `--accent`, `--overdue` 등)

## 데이터 흐름

화면이 저장소에 닿는 길은 `window.kanban` 하나다. 아래 번호는 시간 순서다.

### 앱 시작과 읽기 (AC-011, AC-032)

1. `AppLifecycle`이 (`app.ready` 전에) 데이터 폴더를 고정하고 `KanbanStore.open()`을 부른다. `DataFileRepository.read()`가 본 파일 → 없으면 `.bak` → 둘 다 없으면 처음 실행 순으로 읽고, `SchemaMigrations`로 현재 버전까지 올린 뒤(메모리에서만) `DataFileValidator`로 검사한다.
2. 통과하면 `ready`(문서와 인덱스를 메모리에 올림). 하나라도 실패하면 `read_failed`: 파일은 건드리지 않는다.
3. `AppLifecycle`이 `getSettings()`로 저장된 판을 읽어(읽기 실패면 기본값 `light`) 창을 만든다. 창 바탕색과 `data-theme`가 처음부터 맞는다 (ADR-008).
4. `Bootstrap`이 `store.getStatus()`를 부른다. `ready`면 `settings.get()`, `cards.list({ scope: 'board' })`, `cards.list({ scope: 'archive' })`를 받아 `AppState`를 채우고 보드를 그린다. `read_failed`면 `ReadFailurePanel`을 그린다.
5. `다시 읽기`를 누르면 `store.retryOpen()`이 파일을 다시 읽는다 (쓰지 않음). 성공하면 4번의 `ready` 경로로 이어진다.

### 카드 만들기 / 수정 (대화상자, AC-001, AC-002, AC-031)

1. `CardDialog`가 `Validation`으로 미리 검사해 오류를 칸 아래에 보인다 (마감일 칸에 입력하다 만 값이 있으면 `CardForm`이 `validity.badInput`으로 감지해 같은 마감일 오류 문구를 보이고 저장하지 않는다). 통과하면 `ChangeRunner.createCard(input)`. 새 카드 모드의 상태 선택(`할 일`/`진행 중`)이 `input.status`가 된다 (AC-041).
2. `window.kanban.cards.create` → IPC → `IpcHandlers` → `KanbanStore.create`. 큐에 들어가 차례가 오면 상태 확인 → `CardRules.createCard`(검증 — `status`는 `todo`·`in_progress`만, 기본값 `todo`, `id`·`createdAt` 부여) → `DataFileRepository.save`(임시 파일 쓰기·fsync·검증·`.bak` 복사·교체).
3. 저장이 성공하면 메모리 문서를 바꾸고 `ok: true`와 새 카드를 돌려준다. 대화상자가 닫히고 `AppState`가 목록에 새 카드를 반영한다.
4. `VALIDATION_FAILED`면 `violations[].field`를 입력 칸에 붙인다. `SAVE_FAILED`면 대화상자를 열어 둔 채 알림 줄을 보이고 입력값을 유지한다 (메모리·파일은 이전 그대로).

### 끌어다 놓기로 상태 변경 (낙관적 반영 없음, AC-003)

1. `CardItem`이 끌리고 `Column`에 놓이면 `ChangeRunner.moveCard(id, status)`가 `cards.changeStatus`를 즉시 보낸다 (같은 칸이면 아무 일도 없음). 화면은 그대로이고 `SaveState`가 `saving`이다.
2. 성공(`ok: true`)하면 반환된 카드로 사본을 바꿔 카드가 새 칸으로 간다. `SAVE_FAILED`면 화면은 바뀌지 않고(카드는 원래 칸) 알림 줄과 `다시 저장`을 보인다. 그 밖의 오류면 목록을 main에서 다시 받아 사본을 맞춘다.
3. `⋯` 메뉴도 같은 `moveCard`를 쓴다. 보관(`archiveCard`)과 삭제(`deleteCard`)도 같은 흐름이다: 저장이 성공한 뒤에 카드가 보드에서(또는 보관함 행이) 사라진다.

### 캘린더 끌기로 마감일 변경 (낙관적 반영 없음, AC-044, AC-045, AC-046)

화면의 이벤트가 위에서 아래로 한 방향으로 흐르고, 놓기 처리는 한 곳(`CalendarScreen`)에만 있다.

1. `CalendarScreen`이 `onDropCard(cardId, date)` 콜백과 끌리는 카드 id(지역 상태)를 쥐고, `MonthGrid`/`WeekGrid`에 내려 보낸다. 두 격자는 그대로 `DayCell`에 내려 보낸다 (격자는 끌기를 해석하지 않는다).
2. `CalendarChip`(`draggable`, 팝업 안은 제외)이 `dragstart`에서 카드 id를 `dataTransfer`(`CHIP_DRAG_TYPE`, ADR-013)와 `onDragStart`로 올린다. `DayCell`이 `dragover`에서 놓을 수 있다는 표시(점선 윤곽)를 켜고 `drop`에서 자기 날짜와 함께 `onDropCard(cardId, cell.date)`를 부른다. 이 달 밖의 칸도 같다.
3. `CalendarScreen`은 놓인 날짜가 그 카드의 현재 마감일과 같거나 날짜 칸 밖이면 아무 일도 하지 않는다 (AC-045). 아니면 `ChangeRunner.moveDueDate(id, date)`가 `cards.update(id, { dueDate })`를 즉시 보낸다. 화면은 그대로이고 `SaveState`가 `saving`이다.
4. 성공(`ok: true`)하면 반환된 카드로 사본을 바꿔 칩이 새 칸으로 옮겨 간다. `SAVE_FAILED`면 화면은 바뀌지 않고(칩은 원래 칸) 알림 줄과 `다시 저장`을 보인다 (AC-046). `CARD_NOT_FOUND`·`CARD_ARCHIVED`면 목록을 main에서 다시 받아 사본을 맞춘다.

### 보관함에서 삭제 (AC-040, AC-033, AC-034)

1. 보관함 행의 `삭제`를 누르면 `ArchiveRow`가 그 자리에서 삭제 확인(`삭제 확인` / `취소`)으로 바뀐다. `취소`면 원래대로, 카드는 그대로다.
2. `삭제 확인`이면 `ChangeRunner.deleteCard(id)` → `cards.delete` → `KanbanStore.delete` → `CardRules.deleteCard`(보관 여부를 보지 않는다)가 카드와 그 카드의 진행 기록을 한 문서에서 함께 지우고 한 번의 저장으로 쓴다.
3. 성공하면 사본에서 카드를 지워 행이 사라지고 건수가 줄어든다. `SAVE_FAILED`면 행은 확인 줄 그대로 남고 알림 줄 `다시 저장`이 같은 요청을 다시 보낸다 (카드와 기록 모두 남아 있다). 보관 카드의 수정·기록 추가는 여전히 `CARD_ARCHIVED`다.

### 저장 실패 (AC-031)

1. `DataFileRepository.save`가 네 단계 중 하나에서 실패하면 `KanbanStore`는 메모리를 바꾸지 않고 `SAVE_FAILED { stage, osCode?, dataFilePath }`를 돌려준다. 본 파일은 이전 저장본 그대로다.
2. `ChangeRunner`가 `SaveState`를 `failed`로 바꾼다 (사이드바 `저장하지 못함`, 알림 줄). 칸 이동·캘린더 끌기·보관·삭제는 화면이 바뀌지 않은 채 그대로이고, 판 전환만 화면에 바뀐 판이 남는다. `다시 저장`이 같은 호출을 다시 보낸다.

### 판 전환 (FR-014, UC-011)

1. 사이드바 라디오 선택 즉시 `ThemeController`가 `data-theme`를 바꾼다 (모든 화면이 바뀜).
2. `ChangeRunner.setTheme` → `settings.setTheme`. 저장 성공이면 다음 실행도 그 판이다. `SAVE_FAILED`면 판은 유지하고 저장 실패 알림만 보인다. 저장소는 마지막으로 저장에 성공한 값을 들고 있으므로 이후 카드 저장이 실패한 판을 몰래 함께 저장하지 않는다.

### 검색·필터·마감 지남 (FR-012, FR-013)

1. 보드는 조건 없이 `scope: 'board'` 목록을 한 번 받아 두고, 검색어·종류·우선순위가 바뀔 때마다 renderer에서 `matchesQuery`로 거른다 (사이드바에서 `전체`를 고르면 그 조건을 `undefined`로 돌릴 뿐이라 `matchesQuery`에 새 값이 없다, AC-047) (칸 머리 건수, 사이드바 건수가 전체와 결과를 함께 보여야 해서 목록을 두 번 받지 않는다). 보관함도 같다. `cards.list`의 조건 인자는 main이 같은 `matchesQuery`로 지원하며 시험이 직접 쓴다.
2. 마감 지남은 화면을 그릴 때마다 `todayLocal(new Date())`와 `isOverdue`로 계산한다. 자정에 자동 갱신하지 않는다. 화면 전환, 데이터 다시 받기, 창 다시 불러오기 때 새 날짜로 판정된다 (UC-008 Alt Flow 2).

### 정상 종료 (NFR-002)

1. 변경 요청은 renderer에 쌓이지 않고 사용자가 조작한 즉시 main으로 간다. 창을 닫으면 `AppLifecycle`이 `IpcHandlers.whenIdle()`로 이미 받은 요청이 끝나기를 기다린 뒤 창을 닫고, 앱이 종료 직전에 멈춰 `KanbanStore.close()`로 줄 서 있는 저장이 끝나기를 기다린 뒤 종료한다. 정상 종료 직전의 변경도 잃지 않는다.

### 예상 못한 오류 (FE-007, RK-012)

1. `IpcHandlers`가 예상 못한 예외를 `INTERNAL`로 바꿀 때 main의 `console.error`로 message·stack을 남기고, 화면은 일반 문구와 접힌 `자세히`(message)를 보인다.
2. main의 `uncaughtException`/`unhandledRejection`은 `console.error`로 남기고(전자는 `dialog.showErrorBox`로 알림), 렌더러가 죽거나(`render-process-gone`) 문서를 불러오지 못하면(`did-fail-load`) 안내 후 앱을 종료한다. React 렌더 오류는 `Bootstrap`의 오류 경계가 안내 화면으로 바꾼다. 어느 경우에도 데이터는 바뀌지 않는다. 로그 파일은 만들지 않는다.
2. 프로세스를 강제 종료하면 `02-data-model.md`의 중단 시점별 표대로 직전 저장본 또는 새 저장본으로 열린다.

## NFR 대응 설계

> 사용자가 수치를 말한 성능 NFR은 없다 (CAND-002). 수백~수천 건(ASM-010)은 메모리 배열을 한 번 훑는 선형 처리로 두었고 측정하지 않았다. 따라서 성능 표는 없다.

### 오프라인·보안

| NFR ID | 요구사항 | 대응 설계 | 관련 컴포넌트 |
|--------|----------|----------|--------------|
| NFR-001 | 설치 뒤 모든 기능이 외부 네트워크 요청 0건. 외부 글꼴·라이브러리 금지 | (1) 앱 화면은 `loadFile`로 읽은 로컬 파일뿐이다. 서버·외부 주소를 부르는 코드가 없다. (2) `NetworkGuard`가 앱 번들 폴더 URL 접두사·`devtools://`(개발 실행일 때만 개발 서버) 밖의 모든 요청을 취소하고, 새 창·이동·권한·`webview`를 거부한다. Chromium 자체 요청의 완화 후보는 `NetworkGuard` 항목(구현 첫 Task에서 확인). (3) 화면의 CSP 메타 태그는 production build에만 주입한다 (`electron.vite.config.ts`의 renderer 플러그인이 `transformIndexHtml`로, 빌드일 때만. `src/renderer/index.html` 원본에는 CSP를 두지 않아 개발 서버의 인라인 refresh 스크립트와 HMR WebSocket이 막히지 않는다): `default-src 'self'; connect-src 'none'; font-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'` (`style-src`는 React의 style 속성 때문에 `'unsafe-inline'` 허용, 정확한 값은 구현에서 확인). 빌드 결과(`out/renderer/index.html`)에 들어갔는지는 시험이 확인한다. (4) 글꼴(SUIT woff2)과 아이콘(인라인 SVG)은 앱 번들에 포함하고 외부 주소 `@font-face`를 쓰지 않는다. (5) `autoUpdater`·`electron-updater`·원격 분석·`crashReporter`를 쓰지 않고, `electron-builder`에 `publish` 설정을 두지 않는다. (6) 시험: `browser`에서 화면 동작 전체의 요청이 앱 번들 폴더의 `file:`뿐임을 관찰하고, 화면에서 외부 주소 `fetch`가 거절됨을 확인한다 | NetworkGuard, WindowFactory, AppLifecycle, Styles, CommonUi(Icon) |

보안 기본값 (`01-tech-stack.md`의 "화면 코드 보안 기본값"을 구체 위치에 연결):

| 항목 | 값 | 위치 |
|------|----|------|
| `contextIsolation` | `true` | WindowFactory |
| `nodeIntegration` | `false` (워커도 `false`) | WindowFactory |
| `sandbox` | `true` (이 문서가 더한 값, `결정 필요` 4) | WindowFactory |
| 노출 범위 | `window.kanban` 열두 함수만. `ipcRenderer`·채널 이름·Node 객체 비노출 | PreloadBridge |
| IPC 채널 | `IPC_CHANNELS` 열두 개만 등록, 그 밖의 채널 없음. 호출 프레임 주소 확인 | IpcHandlers |
| 입력 | 모든 IPC 인자를 `unknown`으로 받아 main이 다시 검증. `id`·`archivedAt`·`createdAt`·`statusAtTime`은 main이 정함 | Validation, CardRules |
| 외부 이동·새 창·권한 | 모두 거부 | NetworkGuard |
| 퓨즈 | 개발 실행과 시험(Playwright)은 기본값을 유지한다. 포장 설정(`electron-builder.yml`)에서만 `RunAsNode`·`EnableNodeOptionsEnvironmentVariable`·`EnableNodeCliInspectArguments`를 끄는 방법을 구현에서 확인한다 (`electronFuses` 설정이 electron-builder 26.18.0에서 되는지는 확인하지 못함. 별도 패키지가 필요하면 `01-tech-stack.md` 표에 먼저 추가한다. 필수는 아니다). 시험은 포장 전의 `out/`을 구동하므로 영향이 없다 (RK-008) | electron-builder 설정 |
| 시험 전용 코드 | 앱에 넣지 않는다. 결함 주입은 `cli`에서 `FileSystemPort` 대역으로, 데이터 폴더 분리는 `--user-data-dir`로 한다 | AppLifecycle |

### 데이터 보존·안정성

| NFR ID | 요구사항 | 대응 설계 | 관련 컴포넌트 |
|--------|----------|----------|--------------|
| NFR-002 | 저장 완료 표시 뒤 정상/강제 종료해도 100% 유지. 저장 중 강제 종료여도 직전 저장본으로 열림 | 모든 변경이 "새 문서 만들기 → `.tmp`에 쓰고 fsync → `.tmp`를 다시 읽어 검증 → 본 파일을 `.bak`로 복사 → 이름 바꿔 교체 → 성공해야 메모리 반영 → 그 뒤에만 화면에 저장됨 표시" 한 경로를 지난다. 변경은 한 줄로 직렬 처리해 두 저장이 파일을 동시에 쓰지 않는다. 설정(판)도 같은 경로를 쓰고 별도 저장 경로가 없다. 정상 종료는 줄을 비운 뒤 닫는다. 시험: `cli`에서 `FileSystemPort` 대역으로 다섯 동작을 n번째 호출에서 실패·중단시켜 (1) `SAVE_FAILED` (2) 메모리·본 파일 불변 (3) 다시 열면 직전 저장본인지 확인 | KanbanStore, DataFileRepository, NodeFileSystem, AppLifecycle |
| AC-031 | 저장 실패 시 실패 문구, 입력 내용 유지 | `SAVE_FAILED`는 상태 변경 없이 반환된다. 대화상자 저장과 칸 이동·캘린더 끌기·보관·삭제는 낙관적 반영 없이 결과를 기다리므로 실패하면 입력과 화면이 그대로이고 알림 줄과 `다시 저장`을 보인다. 판 전환만 화면을 되돌리지 않고 이번 실행 동안 유지하며 알림을 보인다 (UC-011 Alt Flow 1). 사이드바 저장 상태가 `저장하지 못함`이 된다 | ChangeRunner, CardDialog, AppShell(Banner), KanbanStore |
| AC-032 | 읽기 실패 시 빈 보드와 구분되는 안내, 읽지 못한 데이터는 새 저장으로 덮어쓰이지 않음 | 읽기 실패는 `KanbanStore`의 `read_failed` 상태다. 이 상태에서 모든 목록·조회·변경은 `STORE_LOCKED`로 거절되고 `FileSystemPort`의 쓰기 동작(`writeFileSynced`, `copyFile`, `rename`)은 한 번도 불리지 않는다 (시험이 호출 기록으로 확인). 파일을 지우는 코드가 저장소에 없다. 화면은 `ReadFailurePanel`로 본문 전체를 대체한다. 벗어나는 길은 `다시 읽기`뿐이고, 패널이 읽지 못한 파일 경로와 직전 저장본(`.bak`)·버전 변환 전 사본의 경로·상태와 수동 절차 문구(앱을 닫고 `kanban-data.json`을 다른 이름으로 바꾸면 직전 저장본으로 열린다)를 보여 준다. 앱은 파일을 지우거나 쓰지 않는다 (사용자 결정 D3) | KanbanStore, DataFileRepository, ReadFailurePanel, AppShell |

### 호환성

| NFR ID | 요구사항 | 대응 설계 | 관련 컴포넌트 |
|--------|----------|----------|--------------|
| NFR-003 | 새 버전으로 바꿔도 이전 버전 저장 데이터 100% 읽힘 | 파일 최상위 `schemaVersion`과 `N → N+1` 변환 사슬. 읽을 때만 메모리에서 변환하고 파일은 첫 변경 저장 때 새 버전으로 쓰이며, 그 직전에 변환 전 원본을 `kanban-data.pre-v{N}.json`으로 한 번 복사한다. 더 새로운 버전은 `SCHEMA_TOO_NEW`로 읽지 않는다. 버전 1 → 2 변환과 "버전 1 파일 → 버전 2" 시험 데이터(`tests/cli/support`의 고정 파일)를 처음부터 둔다 | SchemaMigrations, DataFileRepository, DataFileValidator |

### 접근성

| NFR ID | 요구사항 | 대응 설계 | 관련 컴포넌트 |
|--------|----------|----------|--------------|
| NFR-004 | 카드 종류 2가지와 마감 지난 표시를 색 외 글자나 아이콘으로도 구분 (두 판 모두, AC-039) | 구분을 만드는 코드는 `KindChip`(벌레/체크 아이콘 + 글자, 채움/테두리)와 `DueText`(삼각형 아이콘 + `MM/DD · N일 지남` 글자 + 2px 테두리) 두 곳뿐이고 모양·글자는 `data-theme`와 무관하다. 판은 CSS 변수 값만 바꾼다. 구분 값(`kind`, `isOverdue`)은 판과 무관하다. 시험: `browser`에서 두 판 각각 칩의 글자·아이콘 존재와 `aria-label` 확인. 흑백 화면에서의 확인은 수동 | CommonUi(KindChip, DueText, Icon), Styles(tokens.css), DateRules, ThemeController |

## 요구사항 추적

모든 FR이 어느 컴포넌트에서 처리되는지 (P0는 FR-001~FR-006).

| FR | 우선순위 | 처리하는 컴포넌트 |
|----|---------|------------------|
| FR-001 카드 만들기 | P0 | CardDialog(CardForm의 상태 선택: 새 카드는 `할 일`/`진행 중`, AC-041) → ChangeRunner → IpcHandlers → KanbanStore → CardRules(`createCard`, 입력 `status`), Validation(`create` 모드의 `status` 제한, AC-042) |
| FR-002 상태 변경 | P0 | BoardScreen(끌기, `⋯` 메뉴), CardDialog(상태 선택) → ChangeRunner → KanbanStore → CardRules(`changeStatus`, `updateCard`) |
| FR-003 상태별 보드 | P0 | BoardScreen, BoardModel(`splitByStatus`), `cards.list` |
| FR-004 마감일 | P0 | Validation + DateRules(`isRealDate`), CardForm(`input type="date"` 입력, 입력하다 만 값 감지 — AC-043, AC-029), DueText, CalendarModel |
| FR-005 캘린더 | P0 | CalendarScreen(놓기 처리), DayCell(놓는 곳)·CalendarChip(끄는 것), ChangeRunner(`moveDueDate`) → KanbanStore → CardRules(`updateCard`) (AC-044~AC-046), CalendarModel, `cards.list`, `cards.get`(칩 → CardDialog), WindowFactory(기본 창 높이 920, AC-048) |
| FR-006 로컬 저장·오프라인 | P0 | KanbanStore, DataFileRepository, NodeFileSystem, SchemaMigrations, DataFileValidator, NetworkGuard, ReadFailurePanel, 사이드바 저장 상태(AppShell, ChangeRunner) |
| FR-007 종류 표시 | P1 | CardForm(종류 분할 버튼), CommonUi(KindChip), CardRules(기본값 `task`) |
| FR-008 설명·우선순위·메모 | P1 | CardForm, CommonUi(PriorityMark), CardRules, Labels(`PRIORITY_LABEL` 낮음·중간·높음), SharedTypes(`PRIORITIES` 표시 순서) |
| FR-009 진행 기록 | P1 | CardDialog(ProgressLog, ProgressInput), CardRules(`addProgress`, `statusAtTime`) |
| FR-010 보관 | P1 | BoardScreen(ArchiveConfirm), CardDialog, CardRules(`archiveCard`), ArchiveScreen |
| FR-011 수정·삭제 | P1 | CardDialog(DeleteConfirmBar), ArchiveScreen(ArchiveRow의 삭제와 확인), CardRules(`updateCard`, `deleteCard`) |
| FR-012 마감 지남 | P1 | DateRules(`isOverdue`, `todayLocal`, `overdueDays`), DueText, BoardScreen(OverdueSummary), CalendarScreen(붉은 칩) |
| FR-013 검색·필터 | P1 | QueryFilter, BoardModel(`countFilters`), SearchBox, ConditionBar, AppShell(사이드바 필터: `전체` 항목·라디오·해제 없음, AC-047), ArchiveScreen |
| FR-014 밝기 전환 | P1 | ThemeController, Styles(tokens.css), AppShell(ThemeSwitch), CardRules(`setTheme`), WindowFactory(초기 판), SharedTypes(`DEFAULT_THEME = 'light'`), SchemaMigrations(1 → 2 기본값) |

## 디렉토리 구조

> 폴더와 시험 위치까지만 정한다. 파일 단위의 목록과 생성 순서는 `06-file-map.md`가 정한다. 아래 파일 이름은 설정 파일과 진입점만 적었다. 코드와 `package.json`은 `app/` 안에만 둔다 (`docs/05-design/` 안에는 앱 폴더를 만들지 않는다).

```
app/
├── package.json                  # "main": "out/main/index.js", "type": "module", engines, 스크립트는 01-tech-stack.md
├── package-lock.json
├── electron.vite.config.ts       # main · preload(CJS 출력) · renderer(production에만 CSP 주입) 세 곳, 별칭 @shared → src/shared
├── tsconfig.json                 # 에디터용 루트 (files: [])
├── tsconfig.node.json            # main · preload · shared · tests (build가 tsc -p로 검사)
├── tsconfig.web.json             # renderer · shared (build가 tsc -p로 검사)
├── eslint.config.js              # 폴더별 의존 규칙 (no-restricted-imports / globals)
├── prettier.config.js
├── vitest.config.ts              # include: tests/cli/**/*.test.ts, 별칭은 electron.vite와 같게
├── playwright.config.ts          # testDir: tests/browser, 결과 reports/e2e.xml, workers 1
├── electron-builder.yml          # publish 설정 없음 (NFR-001), 포장 퓨즈 설정
├── src/
│   ├── shared/                   # 순수. Electron · Node · DOM 금지
│   │   ├── types/                # SharedTypes (Card, Result, StoreStatus, KanbanApi ...)
│   │   ├── constants.ts          # 허용 값 목록, CURRENT_SCHEMA_VERSION
│   │   ├── ipc-contract.ts       # IpcContract (IPC_CHANNELS)
│   │   └── domain/               # DateRules, Validation, QueryFilter, CardRules
│   ├── main/
│   │   ├── index.ts              # AppLifecycle (조립 지점, 데이터 폴더 고정, 프로세스 오류 처리)
│   │   ├── store/                # Electron 금지
│   │   │   ├── ...               # KanbanStore, DataFileRepository, DataFileValidator, NodeFileSystem
│   │   │   └── migrations/       # SchemaMigrations (버전별 변환 함수)
│   │   └── app/                  # Electron 사용: WindowFactory, NetworkGuard, IpcHandlers
│   ├── preload/
│   │   └── index.ts              # PreloadBridge (출력 out/preload/index.cjs)
│   └── renderer/
│       ├── index.html            # 뼈대만 (CSP는 production build에서 주입)
│       └── src/
│           ├── main.tsx          # Bootstrap (React 오류 경계 포함)
│           ├── env.d.ts          # window.kanban: KanbanApi 선언
│           ├── state/            # AppState, ChangeRunner, ThemeController
│           ├── model/            # BoardModel, CalendarModel (순수, React 금지)
│           ├── text/             # Labels
│           ├── styles/           # Styles: tokens.css, base.css, fonts/ (woff2 + 라이선스 문구)
│           ├── common/           # CommonUi
│           ├── layout/           # AppShell (Sidebar, TopBar, 하단 줄, SaveStatus, Banner 자리)
│           └── features/
│               ├── board/        # BoardScreen
│               ├── card-dialog/  # CardDialog
│               ├── calendar/     # CalendarScreen
│               ├── archive/      # ArchiveScreen
│               └── load-error/   # ReadFailurePanel
├── tests/
│   ├── cli/                      # Vitest (실행 위치 cli). 파일 이름 *.test.ts
│   │   ├── domain/               # DateRules, Validation, QueryFilter, CardRules
│   │   ├── store/                # KanbanStore, DataFileRepository (중단·실패 주입), 읽기 실패 잠금
│   │   ├── migrations/           # 버전 1 → 2, SCHEMA_TOO_NEW
│   │   ├── model/                # BoardModel, CalendarModel, card-form-state (소스는 features/card-dialog)
│   │   ├── state/                # reducer 세 개, ChangeRunner (가짜 KanbanApi 주입. tsconfig.web.json이 검사)
│   │   ├── text/                 # Labels (모든 값·오류 코드에 문구가 있음)
│   │   ├── ipc/                  # IpcContract와 03-api-spec.md 채널 목록 일치, IpcHandlers
│   │   └── support/              # 메모리 FileSystemPort, 결함 주입 대역, 고정 데이터 파일(fixtures)
│   └── browser/                  # Playwright _electron (실행 위치 browser). 파일 이름 *.spec.ts
│       ├── support/              # 임시 --user-data-dir로 앱 실행·종료·재실행 도우미
│       └── ...                   # 화면 흐름, 재시작 유지, 요청 관찰, 읽기 실패 화면
├── out/                          # 빌드 결과 (버전 관리 제외)
├── release/                      # 포장 결과 (버전 관리 제외)
├── reports/                      # junit.xml, e2e.xml (버전 관리 제외)
└── test-results/                 # Playwright 증거 (버전 관리 제외)
```

- 시험 위치 규칙: Electron 없이 Node에서 도는 것(도메인, 저장, 변환, 표시 모델)은 `tests/cli`, 실제 창이 필요한 것(화면 흐름, 재시작 뒤 유지, 외부 요청 관찰, 두 판)은 `tests/browser`. React 컴포넌트를 jsdom에서 그리는 시험은 두지 않는다 (패키지 표에 없다). 화면 로직은 `model/`로 빼서 `cli`에서 시험하고, 그리기는 `browser`에서 확인한다.
- 시험 이름에는 시험 계획(`07-test-plan.md`)의 시나리오 ID를 넣는다 (구현 단계 역할 규약).
- `shared`·`main/store`·`renderer/src/model`이 Electron 없이 시험된다는 성질은 의존 규칙(ESLint)이 지킨다.

## 코딩 스타일

기본 원칙을 쓴다. 명세에 코딩 스타일의 사용자 지정은 없다 (화면 문구는 한국어, ASM-016).

- 불필요한 추상화 금지: 쓰는 곳이 3곳 미만이면 인라인. 유틸은 2곳 이상에서 쓸 때만 분리한다. 이 구조에서 추상화는 `FileSystemPort`와 `IPC_CHANNELS` 표 둘뿐이다.
- 함수는 단일 책임으로 50줄 안팎, 파일은 300줄 이하를 목표로 하고, 중첩은 3단계 이내로 한다.
- 이름은 의도를 드러낸다. 식별자는 영문, 파일은 kebab-case, React 컴포넌트 파일과 타입은 PascalCase, 상수는 UPPER_SNAKE (프레임워크 관례 우선).
- 주석은 "왜"만 쓴다. 코드가 말하는 "무엇"은 적지 않는다.
- 매직 넘버·문자열 금지: 허용 값, 버전, 파일 이름, 칩 3개 같은 값은 상수로 이름을 붙인다.
- 예상 가능한 실패는 `Result`로 돌려주고, 예외는 예상 못한 오류에만 쓰며 `IpcHandlers`가 유일한 경계에서 잡는다.
- 경계(IPC, 파일, JSON)에서 들어온 값은 `unknown`으로 받아 검증한 뒤 좁힌다. `any`를 쓰지 않는다. TypeScript는 엄격 모드.
- 시계, 아이디, 파일은 주입받는다. `new Date()`·`Date.now()`·`crypto.randomUUID()`·`fs`를 도메인과 저장소 코드에서 직접 부르지 않는다 (`AppLifecycle`과 화면 가장자리만 예외).
- React는 함수 컴포넌트와 훅을 쓰고, 상태는 가장 가까운 곳에 둔다. 클래스 컴포넌트는 쓰지 않는다. 단 React 오류 경계는 클래스로만 만들 수 있어 `Bootstrap`(`main.tsx`)의 오류 경계 한 개만 예외다.
- 린트·포맷은 ESLint 10 + typescript-eslint 8.72.1, Prettier 3.9.10 (`01-tech-stack.md`).

## 기술 결정 기록 (ADR)

### ADR-001: 프로세스 경계 레이어드 + 순수 도메인 코어 + 저장 포트 주입
- **상태**: Accepted
- **맥락**: Electron은 renderer / preload / main으로 코드가 나뉘고 renderer는 파일에 닿지 못한다. 같은 규칙(검증, 검색, 마감 지남)을 화면과 main이 모두 필요로 하고, NFR-002·NFR-003·AC-032는 Electron 없이 시험되어야 한다.
- **결정**: 규칙을 `shared/domain`의 순수 함수로 두고, main의 `KanbanStore`는 그 함수로 새 문서를 만든 뒤 `FileSystemPort`로만 쓴다. 조립은 `AppLifecycle` 한 곳에서 한다 (시계, 아이디, 파일 시스템 주입). 의존 방향은 린트로 강제한다.
- **기각한 대안**: 플랫 단일 모듈 (규칙 중복), 클린/헥사고널 전체 (이 규모에 과함. 엔티티 3개, 화면 함수 12개).
- **결과**: 규칙 시험이 `cli`에서 빠르게 돈다. 대가: 폴더별 의존 규칙을 설정하고 지켜야 한다.
- **관련 NFR**: NFR-002, NFR-003

### ADR-002: 최소 저장 형식 — JSON 파일 1개, 설정은 같은 파일
- **상태**: Accepted
- **맥락**: 사용자가 후보 A(저장은 앱 데이터 폴더의 JSON 파일 1개 구성 포함)를 골랐다 (01-tech-stack, 02-data-model). 설정(`theme`)을 어디에 둘지는 설계에 맡겨졌다.
- **결정**: `kanban-data.json` 하나에 `schemaVersion`, `settings`, `cards`, `progressEntries`를 둔다. 임시 파일(`.<프로세스 id>.tmp`), 직전 저장본(`.bak`), 변환 전 원본(`.pre-v{N}`)만 같은 폴더에 둔다. 설정을 위한 별도 파일은 만들지 않는다.
- **기각한 대안**: 설정 별도 파일 (임시 파일·`.bak`·버전 변환·읽기 실패를 한 벌 더 설계하고, 카드와 설정이 서로 다른 시점이 될 수 있다), IndexedDB(웹 후보라 탈락), SQLite (네이티브 모듈이 필요하거나 `node:sqlite` 지원을 확인하지 못했다).
- **결과**: NFR-002·NFR-003이 한 절차로 설정까지 덮는다. 대가: 판 전환 저장도 카드 전체를 다시 쓰고, 데이터 파일이 읽기 실패이면 저장된 판도 읽지 못한다 (기본값 밝은 판으로 안내를 보임. 어두운 판을 저장한 사용자도 이때는 밝은 판으로 보인다). 파일이 수십 MB가 되거나 자동 이력(Q-002)이 들어오면 SQLite를 다시 검토한다.
- **관련 NFR**: NFR-002, NFR-003

### ADR-003: 변경은 한 줄로 직렬 처리하고, 저장에 성공한 뒤에만 메모리를 바꾼다
- **상태**: Accepted
- **맥락**: 저장 실패 때 메모리와 파일이 어긋나면 AC-031의 "저장소는 마지막으로 저장에 성공한 값"이 깨지고, 두 변경이 동시에 파일을 쓰면 NFR-002가 깨진다.
- **결정**: 메모리 문서는 불변으로 다룬다. `CardRules`가 새 문서를 돌려주고, `DataFileRepository.save`가 성공하면 `KanbanStore`가 문서와 인덱스를 통째로 교체한다. 변경 호출은 모두 하나의 promise 줄에 들어가 한 번에 하나씩 처리된다 (카드 변경과 설정 변경이 같은 줄). 조회는 줄을 타지 않고 마지막 교체된 문서를 읽는다. `changed: false`인 호출은 저장하지 않는다.
- **기각한 대안**: 메모리를 먼저 고치고 실패하면 되돌리기 (되돌리기 코드가 저장 실패 경로마다 필요하고 부분 변경이 남을 수 있다), 변경마다 파일을 직접 쓰는 잠금 없는 구조.
- **결과**: 실패 경로가 "아무것도 안 바꿈" 하나뿐이다. 대가: 변경마다 문서 배열을 복사한다 (수천 건에서 문제없다고 추정, 측정하지 않음).
- **관련 NFR**: NFR-002, AC-031

### ADR-004: IPC 계약 — 채널 표 한 벌, `Result` 반환, 던지지 않는 핸들러
- **상태**: Accepted
- **맥락**: IPC를 건너면 예외가 원래 형태를 잃는다. preload와 main의 채널 이름이 어긋나면 조용히 실패한다. 열두 함수 말고는 화면이 저장소에 닿지 못해야 한다.
- **결정**: `IPC_CHANNELS` 표를 `shared`에 두고 preload는 이 표로 `window.kanban`을 만들고 main은 같은 표로 핸들러를 등록한다. 모든 함수는 `Result`를 돌려주고(`store.getStatus`·`retryOpen`은 `StoreStatus`), 핸들러는 예상 못한 예외를 `INTERNAL`로 바꾼다. 인자는 `unknown`으로 받아 main이 검증하고, 호출 프레임이 앱 주소인지 확인한다. 이 표와 `03-api-spec.md`의 채널 목록이 같은지 `cli`에서 시험한다.
- **기각한 대안**: preload와 main이 각자 채널 이름을 쓰는 구조 (어긋남), 일반화된 `invoke(channel, ...args)`를 노출하는 구조 (좁은 preload 위반).
- **결과**: 화면 쪽 오류 처리 경로가 하나다. 대가: 함수가 늘면 표와 타입을 함께 고쳐야 한다.
- **관련 NFR**: NFR-001 (보안 기본값)

### ADR-005: 보안 기본값과 외부 요청 차단
- **상태**: Accepted
- **맥락**: NFR-001은 설치 뒤 외부 요청 0건, 외부 글꼴·라이브러리 금지를 요구한다. 업데이트가 없으니 외부 입력(외부 페이지 로드)을 아예 막는 편이 안전하다.
- **결정**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`. 화면은 `loadFile`로 읽는 로컬 파일뿐이다. `NetworkGuard`가 허용 목록 밖의 요청·이동·새 창·권한을 거부하고, CSP 메타 태그가 `connect-src 'none'`으로 한 번 더 막는다. 글꼴은 앱에 포함하고(`font-src 'self'`) 아이콘은 인라인 SVG다. `autoUpdater`, `electron-updater`, 원격 분석, `crashReporter`를 쓰지 않는다. 개발자 도구는 막지 않는다 (명세가 NFR-001 확인 수단으로 개발자 도구를 든다). 허용 목록은 앱 번들 폴더의 URL 접두사로 좁힌다 (`file:` 전체가 아니다). CSP는 production build에만 주입한다 (개발 서버 HMR 허용).
  - **preload 출력 (확정값, 실행해 확인하지 못함)**: 샌드박스 preload는 ESM이 될 수 없는데 `package.json`이 `"type": "module"`이라 electron-vite가 `.mjs`로 내보낼 수 있다. 그래서 `electron.vite.config.ts`의 preload에 `build.rollupOptions.output = { format: 'cjs', entryFileNames: '[name].cjs' }`를 두어 `out/preload/index.cjs`로 내보내고, `window-factory`의 `preload`는 `join(import.meta.dirname, '../preload/index.cjs')`다. 출력 파일 이름(`out/preload/index.cjs`)은 구현 첫 Task의 `build`에서 확인하고, `window.kanban`이 실제로 노출되는지는 첫 Electron 구동(`AppLifecycle`·`WindowFactory`·preload가 모두 있는 뒤의 스모크 시험)에서 확인한다 (첫 Task에는 창도 preload 내용도 없어 구동으로 확인할 수 없다). **대안 한 가지**: 위 설정이 electron-vite 6에서 먹히지 않으면 `build.lib`의 `formats: ['cjs']`와 `fileName: () => 'index.cjs'`로 같은 결과를 낸다. 둘 다 안 되면 `package.json`의 `"type": "module"`을 빼서 main도 CJS로 쓴다 (`01-tech-stack.md`의 스크립트 변경과 재승인이 필요하다).
- **기각한 대안**: 허용 목록 없이 CSP만 쓰기 (CSP는 화면 안의 요청만 막는다), 외부 주소 CDN 글꼴 (NFR-001 위반).
- **결과**: 요청 0건이 코드 구조로 보장되고 시험으로 관찰된다. 대가: 보안 수정을 받으려면 사용자가 새 Electron 메이저로 올려 다시 빌드해야 한다 (01-tech-stack 참고). Chromium 프로세스 자체의 요청(DNS 선조회 등)은 Playwright로 보이지 않아 넷로그 확인은 구현 단계에서 하고, 요청이 보이면 이 결정을 고친다 (확인하지 못한 추정).
- **관련 NFR**: NFR-001

### ADR-006: 상태 관리 — React 내장 Context + useReducer, 정본은 main
- **상태**: Accepted
- **맥락**: 상태 종류가 적다: 카드 사본, 화면 조건, 저장 상태, 대화상자. 새 패키지는 추가하지 않는다. 사용자는 칸 이동·보관·삭제(명세 v4부터 캘린더 끌기 포함)를 낙관적으로 반영하지 않고 저장 성공 뒤에 화면을 바꾸기로 정했다 (D2). 낙관적 반영과 "저장 실패여도 화면을 되돌리지 않음"은 UC-011 Alt Flow 1의 판 전환에만 남는다.
- **결정**: 정본은 main의 문서 한 벌이고 renderer는 사본이다. 사본은 저장이 성공한 결과로만 바뀐다 (판 전환 제외). `DataState`, `UiState`, `SaveState` 세 reducer를 Context로 나누어 검색어 입력이 데이터 전체를 다시 그리지 않게 한다. 변경은 `ChangeRunner`만 하고 상태를 직접 쓰는 컴포넌트가 없다. 필터는 서버에 묻지 않고 사본에 `matchesQuery`를 적용한다. `CardItem`은 메모이제이션한다. 목록이 매우 길어 느려지면 그때 창 나누기(windowing)를 직접 구현하되 패키지는 추가하지 않는다.
- **기각한 대안**: Redux/Zustand 같은 라이브러리 (패키지 표에 없다), 컴포넌트마다 `window.kanban`을 직접 호출 (결과 처리와 실패 처리가 흩어진다), 하나의 거대 Context (타이핑마다 전체 재그림).
- **결과**: 의존이 없고 변경 경로가 하나다. 대가: reducer와 훅을 직접 짜야 한다. 변경이 낙관적이지 않아 저장 실패 뒤에도 화면과 저장소가 같고 롤백이 필요 없다 (판 전환만 예외).
- **관련 NFR**: AC-031

### ADR-007: 날짜 처리 — 현지 날짜 문자열, 시각 없음, UTC 기준 계산
- **상태**: Accepted
- **맥락**: 마감일은 날짜만 가지고 시각이 없다 (ASM-005). 마감 지남은 PC 현지 날짜 기준이다 (ASM-014). `new Date('2026-11-03')`은 UTC 자정으로 해석되어 현지 날짜가 하루 어긋날 수 있다.
- **결정**: `dueDate`는 `YYYY-MM-DD` 문자열 그대로 저장·비교한다 (문자열 비교가 날짜 순서와 같다). 오늘은 `todayLocal(now)`가 현지 시간대의 연·월·일 getter로 만든다 (유일한 현지 날짜 생성 지점). 존재하는 날짜 검사, 일수 차이, 요일, 월 격자는 `Date.UTC` 기준 산술로 계산해 시간대·여름시간과 무관하게 한다. 문자열을 `new Date(문자열)`로 해석하지 않는다. 생성·보관 시각(`createdAt`, `archivedAt`, 기록 `createdAt`)은 `toISOString()`의 UTC 문자열로 저장하고, 화면에서 보일 때만 현지로 바꾼다 (`MM/DD HH:mm`). 자정 자동 갱신은 하지 않는다 (UC-008 Alt Flow 2).
- **기각한 대안**: Date 객체나 타임스탬프로 마감일을 저장 (시간대 변환 오류 위험), 날짜 라이브러리 추가 (패키지 표에 없고 필요한 계산이 작다).
- **결과**: 시간대와 무관한 시험이 가능하다 (`todayLocal`에 고정된 `Date`를 넣는다). 대가: 날짜 산술을 직접 짠 만큼 `cli` 시험으로 윤년·월말을 고정해야 한다.
- **관련 NFR**: 해당 없음 (FR-012, AC-024, AC-025, AC-029)

### ADR-008: 테마 적용 — CSS 변수와 `data-theme`, 초기 깜빡임 방지
- **상태**: Accepted
- **맥락**: 두 판(어두운, 밝은)의 색 토큰이 `04-ui-spec.md`에 정의되어 있다. 판은 전환 즉시 모든 화면에 적용되고, 저장된 판은 처음 그리기 전에 맞아야 한다 (흰 화면 번쩍임 금지). `api-spec`의 `settings.get`은 화면이 시작할 때 한 번 부르는 함수다.
- **결정**: 모든 색은 CSS 변수(기능 이름 토큰)다. 기본 판이 밝은 판이 되었으므로(명세 v4, ASM-017) `:root`가 밝은 판 값(기본)이고 `[data-theme="dark"]`가 어두운 판 값을 덮으며, `color-scheme`도 함께 바꾼다. `data-theme`가 아직 적히지 않은 순간에도 기본 판(밝은 판)으로 그려지므로 기본 사용자의 첫 그림이 어두운 판으로 번쩍이지 않는다. `<html data-theme>` 하나만 바꾸면 전환된다. 처음 그리기 전 맞추기: `AppLifecycle`이 창을 만들기 전에 `store.getSettings()`로 저장된 판을 읽어 (1) 창 바탕색을 그 판의 `bg-app` 값으로 하고 (2) `webPreferences.additionalArguments`로 preload에 넘기면 `PreloadBridge`가 `data-theme`를 적는다 (`document.documentElement`가 없으면 `MutationObserver`로 `<html>` 생성 직후 한 번 적는다). `window.kanban`에 함수를 더하지 않는다 (열두 개 유지). `Bootstrap`은 `settings.get()` 결과로 한 번 더 확정한다 (정본). 저장된 값이 없거나 읽기 실패이면 밝은 판(`DEFAULT_THEME`), 어두운 판을 골라 저장한 사용자는 저장된 값대로 어두운 판과 어두운 창 바탕색으로 연다. 움직임 줄이기 설정이면 전환 시간 0ms.
- **기각한 대안**: JS에서 색을 계산해 인라인 스타일 (유지가 어렵다), CSS 클래스 토글 (동작은 같고 값 목록이 `dark`·`light`로 닫혀 있어 속성 값이 더 읽기 쉽다고 판단), `index.html` 인라인 스크립트로 판 적용 (CSP의 `script-src 'self'`와 충돌).
- **결과**: 두 판의 구분 모양·글자는 같고 색 값만 바뀐다 (NFR-004). 대가: preload가 문서 시작에 속성을 적는 부수 동작을 한다. 이 타이밍이 `sandbox: true`에서 동작하는지, 창 바탕색이 페이지 첫 그림 전 화면에 쓰이는지는 구현에서 확인한다 (확인하지 못함). 어긋나도 `Bootstrap`의 `settings.get()` 확정이 마지막 안전망이라 데이터는 안전하고, 첫 화면 색 깜빡임은 수동 확인에 포함한다.
- **관련 NFR**: NFR-004

### ADR-009: 캘린더는 라이브러리 없이 직접 구현한다
- **상태**: Accepted
- **맥락**: 월/주 보기, 일요일 시작, 날짜 칸 칩, `+N건 더 보기` 팝업, 마감 지난 칩 같은 `04-ui-spec.md`의 요구가 구체적이다. `01-tech-stack.md`에 달력 라이브러리가 없고 패키지 추가는 그 문서를 먼저 고쳐야 한다.
- **결정**: `CalendarModel`(순수 계산)과 `CalendarScreen`(그리기)을 직접 만든다. 날짜 칸은 `카드가 마감일을 가진다` 한 방향으로만 읽는다. 월 이동은 기준 날짜를 달의 1일로 맞춰 31일 같은 월말 넘침을 피한다. 달력 날짜 선택기(입력용)는 직접 만들지 않는다: 카드 입력의 마감일은 브라우저 기본 `<input type="date">`를 쓰고(명세 v4 AC-043, 외부 라이브러리 없음) 격자 계산(`CalendarModel`)과 무관하다. 칩을 끌어 마감일을 바꾸는 동작은 ADR-013.
- **기각한 대안**: 달력 라이브러리 추가 (기본 스타일을 거의 전부 덮어써야 하고 패키지 표에 없다), 달력 모델 없이 컴포넌트 안에서 계산 (`cli`에서 시험할 수 없다).
- **결과**: 격자·묶기·이동이 Node에서 시험된다. 새 패키지 없음 (결정 필요 아님).
- **관련 NFR**: NFR-001 (외부 라이브러리 없음)

### ADR-010: 끌어다 놓기는 내장 HTML5 Drag and Drop, 대안은 `⋯` 메뉴
- **상태**: Accepted
- **맥락**: 놓는 위치는 칸만 본다 (칸 안 순서는 미정, CAND-005). 끌기에는 끌지 않는 대안이 있어야 한다 (WCAG 2.5.7, `04-ui-spec.md`). 새 패키지는 금지다.
- **결정**: 카드는 `draggable`, 칸은 `dragover`(허용 표시)와 `drop`(상태 변경)을 받는다. 끌리는 카드의 id는 드래그 시작 때 `dataTransfer`와 UI 상태 양쪽에 둔다 (`dragover` 중에는 `getData`가 비어 있어서). 놓은 칸의 상태가 지금과 같거나 칸 밖이면 아무 일도 없다. 같은 동작을 `⋯` 메뉴가 `moveCard`로 한다. 명세 v4의 캘린더 칩 끌기도 같은 HTML5 방식이다 (ADR-013).
- **기각한 대안**: 포인터 이벤트로 직접 구현 (충돌 판정·자동 스크롤·접근성 코드가 늘고 칸 단위 놓기에 과하다), 끌기 라이브러리 (패키지 금지).
- **결과**: 코드가 적다. 대가: 칸 안 위치를 놓는 방식의 직접 정렬(CAND-005의 직접 정렬 선택지)이 선택되면 이 결정을 다시 본다. Electron 창에서 HTML5 끌기가 의도대로 도는지는 구현에서 확인한다 (확인하지 못함).
- **관련 NFR**: 해당 없음 (FR-002, AC-003)

### ADR-011: 화면 전환은 상태 키, 대화상자는 내장 `<dialog>`, 팝업은 `popover`
- **상태**: Accepted
- **맥락**: Electron 렌더러에는 주소 표시줄이 없다. 화면은 셋(보드, 캘린더, 보관함)이고 카드 대화상자는 세 화면 위에 같은 방식으로 열려야 한다. `04-ui-spec.md`가 해시 라우터 대 상태 전환을 아키텍처에 맡겼다.
- **결정**: 화면 키(`board`, `calendar`, `archive`)를 `UiState`에 두고 `AppShell`이 고른다. 라우터 라이브러리와 해시 라우팅을 쓰지 않는다. 카드 대화상자는 `<dialog>`와 `showModal()`로 연다 (포커스 가두기, Esc 닫기, 닫을 때 포커스 복귀 내장). 날짜 팝업·상태 이동 메뉴는 `popover` 속성 또는 직접 구현이다. 화면 전환으로 대화상자가 닫히지 않고, 대화상자를 닫으면 연 화면의 스크롤·조건·기간이 그대로다.
- **기각한 대안**: 해시 라우터 (되돌아가기 버튼도 주소도 없어 얻는 것이 없다), 대화상자를 직접 만들기 (포커스 관리를 다시 짜야 한다).
- **결과**: 화면 위치가 메모리에만 있어 앱을 다시 열면 보드에서 시작한다 (명세와 일치). `<dialog>`·`popover`의 Electron 동작은 구현에서 확인한다 (확인하지 못함).
- **관련 NFR**: 해당 없음 (AC-030)

### ADR-012: 데이터 폴더는 userData, 시험 격리는 `--user-data-dir`
- **상태**: Accepted
- **맥락**: `02-data-model.md`가 저장 위치를 `app.getPath('userData')`로 정했고, 폴더 지정 방식(시험용 임시 폴더 포함)을 아키텍처에 맡겼다. 시험은 이전 데이터를 재사용하지 않아야 한다 (`01-tech-stack.md`). 앱에 시험 전용 분기를 넣고 싶지 않다.
- **결정**: 앱 코드는 `app.getPath('userData')`만 쓰되, `app.ready` 전에 `AppLifecycle`이 이 위치를 고정 상수 폴더로 지정한다: `join(app.getPath('appData'), APP_DATA_FOLDER)` (개발 실행 `!app.isPackaged`는 `APP_DATA_FOLDER + '-dev'`). `--user-data-dir` 스위치가 주어지면 건드리지 않는다. 표시용 앱 이름과 데이터 폴더 이름이 분리되고, 개발 실행이 실제 데이터 파일을 읽고 쓰지 않는다 (RK-004). `APP_DATA_FOLDER`의 값은 구현 시작 전에 정하고 한 번 정하면 바꾸지 않는다 (앱 표시 이름은 `결정 필요` 3대로 미정). 시험은 Electron(Chromium)의 `--user-data-dir=<임시 폴더>` 스위치로 이 위치를 바꾼다 (시험 도우미가 `electron.launch`의 args로 넘김). 앱에 환경 변수나 별도 인자 처리 코드를 두지 않는다. `cli` 시험은 `createKanbanStore`의 `dataDir`에 임시 폴더를 직접 준다. 폴더가 없으면 `AppLifecycle`이 포트 밖에서 한 번 만든다 (`FileSystemPort`에 동작을 더하지 않는다).
- **기각한 대안**: 앱이 `KANBAN_DATA_DIR` 환경 변수를 읽기 (시험 전용 분기가 생긴다. 스위치가 동작하지 않을 때만 대안으로 쓴다), 데이터 폴더를 userData 하위 폴더로 옮기기 (02에서 정한 위치와 다르다).
- **결과**: 앱 코드가 시험 사정을 모른다. 대가: Chromium 자체 파일도 같은 폴더에 쌓인다. `--user-data-dir`이 `getPath('userData')`에 반영되는지는 구현에서 확인한다 (확인하지 못함). 폴더 이름이 상수라서 앱 표시 이름을 나중에 바꿔도 데이터 위치는 바뀌지 않는다. `app.setPath('userData')`가 `--user-data-dir`과 어떻게 상호작용하는지(스위치가 있을 때 건드리지 않는 조건)는 구현에서 확인한다 (확인하지 못함). `ADR-012`의 "시험 전용 분기 없음" 원칙은 시험 격리를 말하고, 개발/포장 구분(`-dev`)은 별개다.
- **관련 NFR**: NFR-002

### ADR-013: 캘린더 끌기 — 보드와 같은 HTML5 방식, 별도 드래그 타입, 놓기는 `CalendarScreen`이 소유
- **상태**: Accepted (명세 v4, 2026-11-05)
- **맥락**: 캘린더 칩을 다른 날짜 칸에 끌어 놓으면 마감일이 바뀐다 (AC-044~AC-046). 보드의 카드 끌기(ADR-010)는 `CardItem`이 `CARD_DRAG_TYPE`(`features/board/CardItem.tsx`가 export)으로 `dataTransfer`에 id를 싣는다. 새 함수·새 오류 코드·새 스키마는 없다 (`03-api-spec.md`).
- **결정**: (1) 칩(`CalendarChip`)은 `draggable`이고 날짜 칸(`DayCell`)은 `dragover`(놓을 수 있다는 표시)와 `drop`을 받는다. `DayPopover` 안의 칩은 끌 수 없다. (2) 드래그 데이터 타입은 보드의 `CARD_DRAG_TYPE`을 가져다 쓰지 않고 `CalendarChip.tsx`가 export하는 별도 상수(`CHIP_DRAG_TYPE`)로 둔다. 캘린더가 `features/board`를 import하는 방향을 만들지 않고(보관함이 `ConditionBar`를 board에서 import하는 한 곳이 예외로 이미 있다), 두 화면의 끌기가 서로 섞이지 않는다. 공용 상수로 올리면 `shared`나 `common`에 화면 전용 문자열이 생긴다. (3) 놓기 처리(`onDropCard(cardId, date)`)는 `CalendarScreen`이 소유하고 이벤트는 `MonthGrid`/`WeekGrid` → `DayCell` → `CalendarChip`으로 흐른다 (`데이터 흐름`의 `캘린더 끌기로 마감일 변경`). (4) 변경은 `ChangeRunner.moveDueDate` → `cards.update(id, { dueDate })`이며 저장 성공 뒤에만 화면이 바뀐다 (낙관적 반영 없음). (5) 같은 날짜 칸이나 칸 밖에 놓으면 아무 호출도 하지 않는다. 이 달 밖 칸에도 놓을 수 있다.
- **기각한 대안**: `CARD_DRAG_TYPE` 재사용 (calendar → board 의존이 생기고 한 화면의 끌기가 다른 화면의 놓기 대상으로 해석될 여지), `shared`에 공용 드래그 상수 (매직 문자열 두 개를 위해 공유 계층에 화면 상수를 둔다), 낙관적 반영 (D2와 AC-046에 어긋난다).
- **결과**: 새 패키지·함수·채널이 없다. 대가: 드래그 타입 상수가 두 곳이다. 끌지 않는 대안은 칩을 눌러 카드 입력 화면의 마감일 칸에서 고치는 것이다 (WCAG 2.5.7, AC-043). Electron 창에서의 동작은 ADR-010과 같이 구현에서 확인한다 (확인하지 못함).
- **관련 NFR**: 해당 없음 (FR-005, AC-044, AC-045, AC-046)

## 결정 필요

사용자가 말하지 않은 정책은 만들지 않았다. 아래는 앞선 설계 문서 사이에서 발견한 모순과 아키텍처가 정하지 못한 항목이다.

| 번호 | 항목 | 지금 설계 | 선택지 | 권고 |
|------|------|----------|--------|------|
| 1 | 보관한 카드의 삭제 허용 여부 | 해소됨 (사용자 결정 D1, 명세 v3: UC-009 선행 조건 수정, AC-040). 보관한 카드도 보관함에서 확인 단계 뒤 삭제할 수 있고 진행 기록이 함께 삭제된다. `CardRules.deleteCard`는 보관 여부를 보지 않고, 보관함 행의 `삭제`와 보기 전용 상세의 `삭제`가 있다. 수정·기록 추가는 보관 카드에서 불가 | - | - |
| 2 | 저장에 실패한 뒤 화면과 저장소가 다른 상태에서의 추가 조작 | 해소됨 (사용자 결정 D2). 칸 이동·보관·삭제는 낙관적으로 반영하지 않는다: 요청을 즉시 보내 `저장 중`을 보이고, 저장이 성공한 뒤에 화면을 바꾼다. `SAVE_FAILED`면 화면은 바뀌지 않고 저장 실패 안내가 보이며 사용자가 다시 시도한다. 그래서 화면과 저장소가 어긋나는 구간이 없고 롤백·재동기화가 필요 없다. 판 전환만 UC-011 Alt Flow 1대로 즉시 바꾸고 저장 실패를 알린다 | - | - |
| 3 | 앱 이름 (표시 이름) | 명세와 설계 어디에도 앱 이름이 없다 (와이어프레임의 `스케줄 칸반보드`는 임시 문구). 이 이름이 `package.json`의 `name`/`productName`과 화면 표시가 된다. 데이터 폴더 이름은 이 이름과 분리한 상수(`APP_DATA_FOLDER`, ADR-012)라서 이름을 나중에 바꿔도 데이터 위치는 바뀌지 않는다. 상수의 값은 구현 시작 전에 정한다 | (a) 구현 시작 전에 이름을 정한다 (b) 임시 이름으로 시작하고 나중에 바꾼다 (데이터 폴더는 영향 없음) | 사용자가 정한다. 표시 이름이 폴더에 영향을 주지 않아 급하지 않다 |
| 4 | `sandbox: true` 유지 가능 여부 | 사용자 지정 보안 기본값(contextIsolation, nodeIntegration, 좁은 preload)에 이 문서가 `sandbox: true`를 더했다. 샌드박스 preload는 ESM이 될 수 없어 preload를 CJS(`index.cjs`)로 내보내는 설정을 확정값으로 적었다 (ADR-005. 실행해 확인하지 못했고 구현 첫 Task에서 `window.kanban` 노출로 확인한다. 대안과 마지막 수단도 ADR-005에 적었다) | (a) 유지한다. 확인해 안 맞으면 대안 설정으로, 그래도 안 되면 설계 결함으로 보고한다 (b) `sandbox: false`로 낮추고 나머지 값을 유지한다 | 사용자 결정 전까지 (a). 낮추는 것은 사용자와 설계 승인 문서 변경이 필요하다 |
| 5 | 사용자가 정하지 않은 정책 (이 문서가 정하지 않음) | 칸 안 정렬(CAND-005)은 `BoardModel.orderForDisplay` 한 곳, 보관 해제(CAND-003)는 `CardRules`에 함수 하나와 `cards.unarchive` 채널·`IPC_CHANNELS` 항목 하나, 자동 이력(Q-002)은 새 엔티티·스키마 버전 3·`SchemaMigrations` 변환 함수 하나, 진행 기록 수정·삭제(CAND-009)는 `CardRules` 함수와 채널, 읽기 실패 화면의 판은 `KanbanStore`·`DataFileRepository` 확장으로 들어온다. (읽기 실패에서 벗어나는 앱 안의 동작은 만들지 않기로 사용자가 정했다. 수동 절차 안내 문구만 둔다.) 지금은 모두 만들지 않았고 보드·보관함 순서는 `04-ui-spec.md`의 임시 가정을 그대로 쓴다 | `02-data-model.md`, `03-api-spec.md`, `04-ui-spec.md`의 `결정 필요`와 같다 | 사용자가 정한다. 바뀌면 위 위치만 고치면 되도록 구조를 잡았다 |
| 6 | 명세 v4가 남긴 UI 쪽 결정 (`04-ui-spec.md` 결정 필요 12~14: 기본 창 높이 920의 실측 확정, 마감일 칸에 입력하다 만 값의 처리, 그 밖의 UI 항목) | 이 문서는 참조만 한다. 기본 창 높이는 920 (`WindowFactory`), 입력하다 만 값은 오류 문구를 보이고 저장하지 않는다 (`CardForm`) | `04-ui-spec.md`의 선택지와 같다 | 사용자가 정한다. 바뀌면 `WindowFactory`의 상수 또는 `CardForm`·`card-form-state`만 고친다 |
| 7 | 이 문서가 정한 v4 구조 결정 세 가지 (사용자가 말한 것이 아니라 구조 선택) | (a) `PRIORITIES` 배열 순서를 낮음, 중간, 높음으로 바꾼다 (SharedTypes). (b) 캘린더 끌기의 드래그 타입은 보드의 `CARD_DRAG_TYPE`을 쓰지 않고 `CalendarChip.tsx`의 별도 `CHIP_DRAG_TYPE` (ADR-013). (c) `tokens.css`는 `:root`를 밝은 판, `[data-theme="dark"]`를 어두운 판으로 뒤집는다 (ADR-008). 모두 화면 동작과 저장 형식을 바꾸지 않는다 | (a) 배열은 그대로 두고 화면 코드가 별도 표시 순서를 갖는다 (b) 공용 상수 (c) `:root` 어두운 판 유지 | 문서의 지금 선택을 권고한다 |

## 검증 기록

- 2026-11-05, 명세 v4 반영(AC-041~AC-048, ASM-004/008/017/018): `CardCreateInput.status`(`todo`·`in_progress`만, `done`은 `status` / `INVALID_VALUE`), 마감일 `input type="date"`와 입력하다 만 값 처리, 우선순위 표시 이름 `보통` → `중간`과 `PRIORITIES` 순서(낮음, 중간, 높음), 사이드바 필터의 `전체` 항목(라디오, 해제 없음), 캘린더 칩 끌기(ADR-013, `ChangeRunner.moveDueDate`, `CalendarScreen`이 놓기 소유), 기본 판 light(`DEFAULT_THEME`, 1 → 2 변환, 창 바탕색, `tokens.css` 방향), 기본 창 1280x920을 반영했다. 컴포넌트 31개·화면 함수 12개·ADR 번호는 유지하고 ADR-013과 `결정 필요` 6~7을 더했다. 파일을 더하지 않았다 (`06-file-map.md`).

- 설계 결함 수정(BI-003, 구현 중 보고): 저장 단계에서 `sync`를 따로 두지 않고 `write_temp`에 포함해 `write_temp`, `verify`, `backup`, `replace` 네 단계로 고쳤다(`writeFileSynced` 한 호출이 쓰기와 fsync를 함께 한다). 저장 단계 수만 5에서 4로 바뀌었고 파일·컴포넌트·Wave·TC·인터페이스 수는 그대로다.
- 설계 결함 수정(BI-004, 구현 중 보고): 상단 막대(`TopBar`)와 하단 줄의 소유자를 `AppShell`로 분명히 했다. 세 화면 컴포넌트는 막대·하단 줄을 그리지 않고, 캘린더의 `PeriodNav`와 `월 | 주` 버튼은 `AppShell`이 `TopBar`의 children으로 넣는다. 파일·컴포넌트·Wave·TC 수는 그대로다.
- 체크리스트 (`.claude/agents/design-architecture.md`):
  - 모든 P0 FR(FR-001~FR-006)과 Should 8개(FR-007~FR-014)가 `요구사항 추적` 표에서 컴포넌트로 이어진다.
  - NFR-001~NFR-004 모두 `NFR 대응 설계`에 대응이 있고, AC-031, AC-032, AC-039와 보안 기본값을 같은 표에 연결했다.
  - 컴포넌트 이름: 엔티티·필드(`Card`, `ProgressEntry`, `Settings`, `DataFile`, `status`, `archivedAt` 등)는 `02-data-model.md`, `KanbanApi`·`KanbanStore`·`FileSystemPort`·도메인 함수 이름과 채널 열두 개는 `03-api-spec.md`, 화면·화면 컴포넌트(`BoardScreen`은 SCR-001, `CardDialog`는 SCR-002 등)와 컴포넌트 트리 이름은 `04-ui-spec.md`와 같게 썼다.
  - 새로 만든 이름은 모두 내부 코드 모듈이다 (`DateRules`, `CardRules`, `ChangeRunner`, `NetworkGuard` 등). 새 요구사항 ID, 새 엔티티, 새 화면 함수를 만들지 않았다. `ADR-NNN`만 이 문서 안의 기록 번호다.
  - 추상화는 `FileSystemPort`와 `IPC_CHANNELS` 표 둘뿐이다. 클린/헥사고널 전체, 상태 관리 라이브러리, 라우터, 달력 라이브러리를 기각했다.
  - 패키지는 `01-tech-stack.md`의 표에서 하나도 추가하지 않았다.
- 입력 사이의 모순 중 `결정 필요` 1(보관 카드 삭제)과 2(저장 실패 뒤 화면과 저장소 불일치)는 사용자 결정으로 해소했다 (D1, D2).
- 파일 목록, Wave, 생성 순서를 만들지 않았다 (`design-filemap`의 일). `디렉토리 구조`의 파일 이름은 설정 파일과 진입점만 적었다.
- 사용자가 말하지 않은 정책(CAND-005, CAND-003, Q-002, CAND-009)을 만들지 않았다. 읽기 실패 탈출 동작은 앱 안에 만들지 않기로 사용자가 정했다. 보드 순서는 `04-ui-spec.md`의 임시 가정을 한 함수에 격리했다.
- 이 설계는 실행해 보지 않았다. 확인하지 못한 것:
  - 샌드박스 preload와 `"type": "module"` + electron-vite 6 출력 형식의 호환: `build.rollupOptions.output`의 CJS 설정이 먹히는지 (`결정 필요` 4, ADR-005).
  - `import.meta.dirname`·`import.meta.url`로 만든 preload·renderer 경로와 앱 주소 접두사, `ELECTRON_RENDERER_URL`이 번들에서 기대대로인지.
  - `app.setPath('userData')`를 `--user-data-dir` 없을 때만 부르는 조건이 기대대로 동작하는지 (ADR-012).
  - Chromium 자체 요청의 완화 후보(`host-resolver-rules`, `setProxy`)가 Electron 45에서 먹히는지와 개발 서버를 깨지 않는지 (`NetworkGuard`).
  - 포장 설정의 퓨즈(`electronFuses`)가 electron-builder 26.18.0에서 되는지.
  - 창이 닫히는 순간 main에 아직 도착하지 않은 요청이 있을 수 있는지 (`AppLifecycle`).
  - preload가 문서 시작에 `data-theme`를 적는 타이밍, 창 바탕색이 첫 그림 전에 쓰이는지 (ADR-008).
  - `--user-data-dir` 스위치가 `app.getPath('userData')`에 반영되는지 (ADR-012).
  - Electron 창에서 HTML5 끌기, `<dialog>`, `popover`의 동작 (ADR-010, ADR-011).
  - `style-src 'unsafe-inline'`이 필요한지와 CSP 정확한 값 (CSP는 production build에만 주입하므로 개발 서버는 영향 없음).
  - Chromium 프로세스 자체의 네트워크 요청 (넷로그 확인, ADR-005).
  - 단일 실행 잠금을 쓰지 않을 때 같은 데이터 폴더로 앱을 두 번 실행하면 일어나는 일 (명세는 덮어쓰기를 감수했다. Chromium의 프로필 잠금 동작은 확인하지 못했다).
  - Windows에서 이름 바꾸기의 덮어쓰기 동작과 `fsync` 뒤 동작 (`02-data-model.md`와 같은 미확인 사항, `cli` 시험으로 확인).
  - 카드 수천 건에서 문서 복사와 인덱스 재생성 비용 (측정하지 않은 추정).
