# API / 데이터 접근 설계

> 작성일: 2026-11-03
> 유형: 로컬 전용 (서버·HTTP 엔드포인트 없음, CON-001). 내부 인터페이스 두 겹으로 구성한다: (1) Electron의 renderer ↔ main 사이 좁은 함수(preload가 노출) (2) main 프로세스 안의 저장 모듈과 도메인 함수.
> 입력: docs/04-spec/spec.md (v4), docs/05-design/01-tech-stack.md, docs/05-design/02-data-model.md (엔티티·필드·제약·저장 절차의 이름은 이 문서를 그대로 쓴다)

## 외부 시스템 연동

없음. 서버, 계정, 외부 API가 없고 인터페이스 어디에서도 네트워크를 쓰지 않는다 (CON-001, NFR-001). 명세의 외부 시스템 카탈로그에 있는 PC 알림(운영체제 알림)은 현재 요구 범위 밖이라 인터페이스를 만들지 않았다 (ASM-011).

## 구조

```text
renderer (React 화면, 파일·Node 접근 없음)
   │  window.kanban.*  ← preload가 contextBridge로 노출하는 함수 묶음 (이 문서의 인터페이스)
   ▼
preload (ipcRenderer.invoke 호출만 한다)
   │  채널 이름 kanban:<그룹>:<동작>
   ▼
main (ipcMain.handle → 입력 검증 → KanbanStore 호출)
   ▼
KanbanStore (메모리 상태 + 저장 모듈) ── FileSystemPort ── 앱 데이터 폴더의 JSON 파일
```

- 화면은 `window.kanban` 말고는 저장소에 닿을 방법이 없다 (`contextIsolation: true`, `nodeIntegration: false`, `01-tech-stack.md`의 보안 기본값). 이 문서 밖의 채널은 만들지 않는다.
- main은 화면에서 온 입력을 믿지 않고 항상 다시 검증한다. 아이디, 보관 시각, 만든 시각, 기록의 `statusAtTime`은 main이 정한다.
- `KanbanStore`와 도메인 함수는 Electron에 의존하지 않는 순수 TypeScript 모듈이다. 그래서 `cli` 시험(Vitest)에서 임시 폴더와 가짜 파일 시스템으로 저장 절차, 강제 종료, 버전 변환을 시험할 수 있다. 폴더 위치와 구체 파일 배치는 아키텍처·파일 맵 설계가 정한다.
- 모든 호출은 비동기이고, 화면에서 오는 호출은 구조화 복제로 값을 주고받는다 (함수·클래스 인스턴스를 넘기지 않는다).

## 공통 규약

### 결과 형식

모든 `window.kanban.*` 함수는 예외를 던지지 않고 `Result`를 돌려준다. (IPC를 건너면 예외가 원래 형태를 잃기 때문이다.)

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

type AppError = {
  code: ErrorCode;          // 에러 카탈로그의 값
  message: string;          // 개발자용 진단 문장. 화면에 그대로 보이는 문구가 아니다 (화면 문구는 UI 설계)
  details?: unknown;        // 코드별 추가 정보 (아래 각 인터페이스와 에러 카탈로그)
};

type ErrorCode =
  | 'VALIDATION_FAILED' | 'CARD_NOT_FOUND' | 'CARD_ARCHIVED'
  | 'ARCHIVE_NOT_ALLOWED' | 'SAVE_FAILED' | 'STORE_LOCKED' | 'INTERNAL';
```

### 타입

```ts
type Status   = 'todo' | 'in_progress' | 'done';      // 할 일 / 진행 중 / 완료
type Kind     = 'bug' | 'task';                       // 개발 버그 / 할 일
type Priority = 'high' | 'medium' | 'low';            // 높음 / 중간 / 낮음 (화면은 없음(null), 낮음, 중간, 높음 순서. 'medium'의 이전 이름은 보통이고 저장 값은 그대로)
type Theme    = 'dark' | 'light';                     // 어두운 판 / 밝은 판
type DateString = string;                              // 'YYYY-MM-DD' (PC 현지 날짜, 시각 없음)
type Instant    = string;                              // UTC 시각 문자열, 예: '2026-11-03T09:12:34.567Z'

type Card = {
  id: string; title: string; status: Status; kind: Kind;
  description: string; dueDate: DateString | null; priority: Priority | null;
  memo: string; archivedAt: Instant | null; createdAt: Instant;
};

type ProgressEntry = {
  id: string; cardId: string; content: string;
  statusAtTime: Status; createdAt: Instant;
};

type Settings = { theme: Theme };                      // 앱 하나에 한 건. 저장된 값이 없으면 { theme: 'light' }

type CardDetail = { card: Card; progress: ProgressEntry[] };   // progress는 남긴 순서

type CardQuery = {
  scope: 'board' | 'archive';   // board: archivedAt이 null인 카드, archive: archivedAt이 있는 카드
  text?: string;                // 제목에 들어 있는 글자
  kind?: Kind;
  priority?: Priority;
};

type CardCreateInput = {
  title: string;                 // 필수
  status?: 'todo' | 'in_progress';  // 없으면 'todo'. 'done'을 포함한 그 밖의 값은 거부 (AC-042)
  kind?: Kind;                   // 없으면 'task'
  description?: string;          // 없으면 ''
  dueDate?: DateString | null;   // 없으면 null
  priority?: Priority | null;    // 없으면 null
  memo?: string;                 // 없으면 ''
};

type CardPatch = Partial<{         // 보낸 필드만 바꾼다. 이 일곱 개 밖의 필드는 거부 (UNKNOWN_FIELD)
  title: string; kind: Kind; status: Status; description: string;
  dueDate: DateString | null; priority: Priority | null; memo: string;
}>;

type ProgressInput = { content: string };

type Violation = {
  field: string;                 // 'title' | 'kind' | 'status' | 'priority' | 'dueDate' | 'description' | 'memo' | 'content' | 'id' | 'text' | 'theme' | 그 밖의 입력 필드 이름
  reason: 'REQUIRED' | 'INVALID_VALUE' | 'INVALID_DATE' | 'INVALID_TYPE' | 'UNKNOWN_FIELD';
};
```

### 권한

사용자는 본인 1명이고 로그인이 없다 (권한 매트릭스: 역할 User 하나, 모든 기능 허용). 그래서 인증은 없고, 아래 `카드 상태에 따른 허용` 표처럼 카드의 상태와 저장소의 상태에 따라서만 동작이 막힌다.

| 동작 | 보관 안 된 카드 | 보관된 카드 | 저장소가 읽기 실패 상태 |
|------|---------------|-----------|---------------------|
| `cards.list`, `cards.get` | 가능 | 가능 | 거절 (`STORE_LOCKED`) |
| `cards.create` | - | - | 거절 (`STORE_LOCKED`) |
| `cards.update`, `cards.changeStatus` | 가능 | 거절 (`CARD_ARCHIVED`) | 거절 (`STORE_LOCKED`) |
| `progress.add` | 가능 | 거절 (`CARD_ARCHIVED`) | 거절 (`STORE_LOCKED`) |
| `cards.archive` | 완료 카드만 가능, 아니면 `ARCHIVE_NOT_ALLOWED` | 거절 (`CARD_ARCHIVED`) | 거절 (`STORE_LOCKED`) |
| `cards.delete` | 가능 | 가능 (AC-040) | 거절 (`STORE_LOCKED`) |
| `settings.get`, `settings.setTheme` | 가능 (카드와 무관) | 가능 (카드와 무관) | 거절 (`STORE_LOCKED`) |
| `store.getStatus`, `store.retryOpen` | 언제나 가능 | | |

### 변경 동작의 공통 순서

`cards.create`, `cards.update`, `cards.changeStatus`, `cards.archive`, `cards.delete`, `progress.add`, `settings.setTheme`는 모두 같은 순서로 처리하고, 한 번에 하나씩 줄을 세워 실행한다 (02-data-model.md의 `저장` 절차). 카드 변경과 설정 변경은 같은 줄을 쓴다.

1. 저장소 상태 확인 (읽기 실패 상태면 `STORE_LOCKED`)
2. 입력 검증 (모든 위반을 모아 `VALIDATION_FAILED`)
3. 대상 카드 확인 (`CARD_NOT_FOUND`), 보관 여부 확인 (`CARD_ARCHIVED`), 동작별 조건 확인 (`settings.setTheme`은 대상 카드가 없어 이 단계를 건너뛴다)
4. 새 문서를 메모리에 만들고 디스크에 저장
5. 저장이 성공했을 때만 메모리 상태를 바꾸고 `ok: true`를 돌려준다. 저장이 실패하면 `SAVE_FAILED`를 돌려주고 메모리·파일 모두 바뀌지 않는다
- 화면은 칸 이동(`cards.changeStatus`), 보관(`cards.archive`), 삭제(`cards.delete`), 캘린더 끌기(`cards.update`의 `dueDate`)를 낙관적으로 반영하지 않는다. 요청을 보내 `저장 중`을 보이다가 `ok: true`를 받은 뒤에 화면을 바꾸고, `SAVE_FAILED`면 화면은 바뀌지 않고 저장 실패 안내를 보인다 (사용자 결정 D2, AC-044, AC-046). 판 전환(`settings.setTheme`)만 UC-011 Alt Flow 1에 따라 즉시 반영하고 실패를 알린다. 그래서 화면과 저장소가 어긋나는 구간은 판 전환 하나뿐이다.
- 바뀐 것이 없는 호출(같은 status로 바꾸기, 빈 patch, 지금과 같은 `theme`으로 바꾸기)은 4~5를 건너뛰고 현재 값으로 성공한다. 저장하지 않는다.

## API / 인터페이스

화면이 부르는 함수는 열두 개다 (`window.kanban`: `store` 2, `cards` 7, `progress` 1, `settings` 2). 명세 v4에서 새 함수는 늘지 않았다. 이어서 저장 모듈의 인터페이스와 순수 도메인 함수를 정의한다.

```ts
interface KanbanApi {
  store: {
    getStatus(): Promise<StoreStatus>;
    retryOpen(): Promise<StoreStatus>;
  };
  cards: {
    list(query: CardQuery): Promise<Result<Card[]>>;
    get(id: string): Promise<Result<CardDetail>>;
    create(input: CardCreateInput): Promise<Result<Card>>;
    update(id: string, patch: CardPatch): Promise<Result<Card>>;
    changeStatus(id: string, status: Status): Promise<Result<Card>>;
    archive(id: string): Promise<Result<Card>>;
    delete(id: string): Promise<Result<{ deletedCardId: string; deletedProgressCount: number }>>;
  };
  progress: {
    add(cardId: string, input: ProgressInput): Promise<Result<ProgressEntry>>;
  };
  settings: {
    get(): Promise<Result<Settings>>;
    setTheme(theme: Theme): Promise<Result<Settings>>;
  };
}
```

IPC 채널 이름은 `kanban:store:getStatus`, `kanban:store:retryOpen`, `kanban:cards:list`, `kanban:cards:get`, `kanban:cards:create`, `kanban:cards:update`, `kanban:cards:changeStatus`, `kanban:cards:archive`, `kanban:cards:delete`, `kanban:progress:add`, `kanban:settings:get`, `kanban:settings:setTheme`이다. 함수 이름과 같은 규칙으로 채널을 만들고, 목록에 없는 채널은 main이 등록하지 않는다.

### 앱 시작 상태

#### store.getStatus()

- 유형: `window.kanban.store.getStatus()` → IPC `kanban:store:getStatus` → `KanbanStore.getStatus()`
- 관련 FR: FR-006 (AC-011, AC-031, AC-032), NFR-002, NFR-003
- 요청: 없음
- 응답: `Promise<StoreStatus>` (`Result`로 감싸지 않는다. 읽기 실패도 정상적으로 보고할 상태이기 때문이다)

```ts
type StoreStatus =
  | { state: 'ready';
      firstRun: boolean;               // 저장 파일이 아직 없어 빈 보드로 시작했다
      recoveredFromBackup: boolean;    // 본 파일이 없어 직전 저장본(.bak)으로 열었다
      migratedFromVersion: number | null; } // 이전 버전 파일을 변환해 열었으면 원래 버전
  | { state: 'read_failed'; failure: ReadFailure };

type ReadFailure = {
  code: 'FILE_UNREADABLE' | 'JSON_PARSE_FAILED' | 'SCHEMA_INVALID'
      | 'INTEGRITY_VIOLATED' | 'SCHEMA_TOO_NEW' | 'MIGRATION_FAILED';
  message: string;                      // 진단 문장
  dataFilePath: string;                 // 읽지 못한 본 파일(또는 .bak)의 전체 경로. 오류 안내에 보여 사용자가 찾을 수 있게 한다
  backupPath: string;                   // 직전 저장본(.bak)의 전체 경로 (있든 없든 안내용)
  preMigrationCopies: string[];         // 있는 버전 변환 전 사본(kanban-data.pre-v{N}.json, N = 1..현재 버전-1)의 전체 경로. 없으면 빈 배열
  osCode?: string;                      // FILE_UNREADABLE일 때 OS 오류 코드 (예: 'EACCES')
  issues?: string[];                    // SCHEMA_INVALID·INTEGRITY_VIOLATED일 때 위반 위치 요약 (최대 몇 건만)
  fileSchemaVersion?: number;           // SCHEMA_TOO_NEW일 때 파일의 버전
  backup: 'absent' | 'valid' | 'invalid'; // 직전 저장본(.bak) 상태 안내용. 자동으로 쓰지 않는다
};
```

- 인증/권한: 언제나 호출 가능.
- 동작: 앱이 켜질 때 main이 `open()`으로 파일을 읽고 결과를 보관한다. 이 함수는 그 결과를 돌려준다. 화면은 시작할 때 이 함수를 먼저 부르고, `ready`일 때만 카드 목록을 부른다.
- `read_failed`이면 화면은 빈 보드와 구분되는 오류 안내를 보이고 (AC-032), 다른 인터페이스는 모두 `STORE_LOCKED`다. 읽지 못한 파일은 저장으로 덮어쓰이지 않는다.
- 에러: 던지지 않는다. 읽기 실패 원인 값은 `ReadFailure.code`이고 `02-data-model.md`의 읽기 실패 원인 값 표와 같다.

#### store.retryOpen()

- 유형: `window.kanban.store.retryOpen()` → IPC `kanban:store:retryOpen` → `KanbanStore.retryOpen()`
- 관련 FR: FR-006 (AC-032)
- 요청: 없음
- 응답: `Promise<StoreStatus>`
- 인증/권한: 언제나 호출 가능.
- 동작: 저장소가 `read_failed`일 때만 파일을 다시 읽는다 (사용자가 파일을 직접 고치거나 잠금을 푼 뒤). 성공하면 `ready`가 되고, 다시 실패하면 `read_failed`(새 원인)다. 이미 `ready`이면 아무것도 하지 않고 현재 상태를 돌려준다. 이 함수는 파일을 쓰지 않는다.
- 에러: 던지지 않는다.
- 읽기 실패에서 벗어나는 다른 동작(직전 저장본으로 열기, 손상 파일 보존 후 새로 시작)은 만들지 않기로 사용자가 정했다 (D3). 화면은 `ReadFailure`의 경로·상태로 수동 절차 안내 문구만 보인다 (`04-ui-spec.md` SCR-001 `에러: 읽기 실패`). 앱은 파일을 지우거나 쓰지 않는다.

### 카드 조회

#### cards.list

- 유형: `window.kanban.cards.list(query)` → IPC `kanban:cards:list` → `KanbanStore.list(query)`
- 관련 FR: FR-003, FR-005, FR-010, FR-012, FR-013 (AC-005, AC-006, AC-009, AC-010, AC-019, AC-020, AC-026, AC-027, AC-028, AC-036)
- 요청: `CardQuery`
  - `scope: 'board'` → `archivedAt`이 `null`인 카드만. 보드와 캘린더가 쓴다 (AC-019). `scope: 'archive'` → 보관한 카드만. 보관함이 쓴다 (AC-020). 두 범위는 서로 섞이지 않는다 (AC-028).
  - `text` → 제목에 그 글자가 들어 있는 카드. 대소문자를 구분하지 않고, 앞뒤 공백을 뺀 뒤 비교하며, 빈 문자열이면 조건 없음 (ASM-012, AC-026)
  - `kind`, `priority` → 그 값을 가진 카드만 (AC-027). 우선순위가 비어 있는 카드를 고르는 조건은 없다 (명세에 없음). 사이드바의 "전체" 항목(AC-047)은 이 조건을 주지 않는 것(조건 제거)과 같고 별도 값이 없다.
  - 조건을 여러 개 주면 모두 만족하는 카드만 (AND). 조건을 모두 빼면 해당 범위의 모든 카드 (AC-027).
- 응답: `Card[]`. 저장 순서(만든 순서)로 돌려준다. 맞는 카드가 없으면 빈 배열이고 오류가 아니다 (AC-006, AC-036). 어떤 순서로 보여 줄지는 화면이 정하며 정해지지 않았다 (CAND-005).
- 화면 쪽 사용 방법:
  - 보드: `scope: 'board'`로 받아 `status`별로 세 칸에 나눈다 (AC-005, 각 카드는 자기 상태의 칸에만 있다).
  - 캘린더: `scope: 'board'`로 받아 `dueDate`가 있는 카드를 그 날짜에 놓는다. `dueDate`가 `null`인 카드는 캘린더에 올리지 않는다 (AC-009, AC-010). 캘린더는 검색·필터 대상 화면이 아니라 조건 없이 부른다.
  - 보관함: `scope: 'archive'`로 한 번 받아 renderer가 `matchesQuery`로 거른다 (보드와 같은 방식, `05-architecture.md` 데이터 흐름. AC-028은 `scope` 구분, 검색은 `matchesQuery`). `cards.list`의 `text`·`kind`·`priority` 조건 인자는 화면이 쓰지 않고 `cli` 시험과 main 보조용이다.
  - 검색 결과 없음 표시(AC-036)에서 보여 줄 "적용 중인 검색어·조건"은 화면이 가진 `CardQuery` 값이다. 이 함수는 조건을 되돌려 보내지 않는다.
- 인증/권한: 읽기 전용. 저장소가 읽기 실패 상태면 `STORE_LOCKED`.
- 에러: `STORE_LOCKED`, `VALIDATION_FAILED` (`scope`가 두 값이 아님: `scope` / `INVALID_VALUE`, `kind`·`priority`가 목록 밖의 값: `INVALID_VALUE`, `text`가 문자열이 아님: `text` / `INVALID_TYPE`)

#### cards.get

- 유형: `window.kanban.cards.get(id)` → IPC `kanban:cards:get` → `KanbanStore.get(id)`
- 관련 FR: FR-004, FR-005 (AC-030), FR-008 (AC-015), FR-009 (AC-017, AC-018), FR-010 (AC-020), FR-011
- 요청: `id` (카드 아이디)
- 응답: `CardDetail` = 카드 한 장과 그 카드의 진행 기록 목록 (남긴 순서, 다른 카드의 기록은 들어 있지 않다, AC-017). 보관한 카드도 읽을 수 있다 (AC-020). 캘린더에서 카드를 고르거나 보드에서 카드를 열 때 쓴다 (AC-030, AC-007).
- 인증/권한: 읽기 전용.
- 에러: `CARD_NOT_FOUND` (`details: { id }`), `STORE_LOCKED`, `VALIDATION_FAILED` (`id` / `INVALID_TYPE`)

### 카드 변경

#### cards.create

- 유형: `window.kanban.cards.create(input)` → IPC `kanban:cards:create` → `KanbanStore.create(input)`
- 관련 FR: FR-001 (AC-001, AC-002, AC-041, AC-042), FR-004 (AC-007, AC-008, AC-029), FR-007 (AC-013, AC-014), FR-008 (AC-015, AC-016)
- 요청: `CardCreateInput`. `title`만 필수다. 없는 필드는 기본값(`status = 'todo'`, `kind = 'task'`, `description = ''`, `dueDate = null`, `priority = null`, `memo = ''`)으로 채운다 (ASM-004, ASM-005, ASM-007, ASM-008). `status`는 `'todo'` 또는 `'in_progress'`만 받는다 (AC-041, AC-042). `'done'`이나 그 밖의 값(`'archived'`, 목록 밖의 문자열, 문자열이 아닌 값 포함)은 `status` / `INVALID_VALUE`로 거절한다.
- 응답: 만들어진 `Card`. `status`는 입력한 값(없으면 `'todo'`), `archivedAt = null`이고 `id`, `createdAt`은 main이 정했다 (AC-001, AC-041, ASM-004). 진행 중으로 만들어도 `ProgressEntry`는 만들어지지 않는다. `statusAtTime`은 `progress.add`가 그 순간의 카드 상태를 읽을 때만 정해지므로 영향이 없다 (AC-018).
- 인증/권한: 읽기 실패 상태면 거절.
- 에러:
  - `VALIDATION_FAILED` (`details: { violations: Violation[] }`): 제목이 비었거나 공백뿐이면 `title` / `REQUIRED` (AC-002). 존재하지 않는 날짜면 `dueDate` / `INVALID_DATE` (AC-029). `kind`·`priority` 값이 목록 밖이면 `INVALID_VALUE`. `status`가 `'todo'`·`'in_progress'` 밖이면(`'done'` 포함) `status` / `INVALID_VALUE` (AC-042). 여러 위반은 한 번에 모두 돌려준다. 카드는 만들어지지 않는다.
  - `SAVE_FAILED`, `STORE_LOCKED`

#### cards.update

- 유형: `window.kanban.cards.update(id, patch)` → IPC `kanban:cards:update` → `KanbanStore.update(id, patch)`
- 관련 FR: FR-011 (AC-022, AC-035), FR-002 (AC-003), FR-004 (AC-029), FR-005 (AC-044, AC-045, AC-046), FR-007, FR-008
- 요청: `id`, `CardPatch`. patch에 있는 필드만 바꾼다. `dueDate: null`과 `priority: null`은 값을 비운다. `title`을 보내면 새로 검증한다. `id`, `archivedAt`, `createdAt`은 바꿀 수 없다 (`UNKNOWN_FIELD`). 캘린더에서 카드를 끌어 마감일만 바꿀 때도 같은 호출(`cards.update(id, { dueDate })`)이다. 새 함수는 없고, 놓은 날짜가 원래 날짜이거나 날짜 칸 밖이면 화면이 호출하지 않으며 (AC-045), 보낸 `dueDate`가 현재 값과 같으면 아래 "바뀐 것이 없으면"처럼 저장하지 않는다.
- 응답: 바뀐 `Card`. 바뀐 것이 없으면 현재 카드 그대로 (저장하지 않음).
- 인증/권한: 보관된 카드는 거절한다 (ASM-015). 보관되지 않은 카드는 상태와 무관하게 허용하며 완료 카드의 끌기도 같다 (ASM-018).
- 에러:
  - `VALIDATION_FAILED`: 수정하다가 제목을 비우면 `title` / `REQUIRED` (AC-035). 날짜 오류는 `dueDate` / `INVALID_DATE`. `status`에 `'archived'` 같은 목록 밖의 값을 넣으면 `status` / `INVALID_VALUE` (AC-004). 위반이면 카드는 바뀌지 않는다.
  - `CARD_NOT_FOUND`, `CARD_ARCHIVED`, `SAVE_FAILED` (끌기의 저장 실패이면 카드와 마감일은 그대로다, AC-046), `STORE_LOCKED`
- 참고: 생성 때만 `status`가 `todo`·`in_progress`로 제한된다 (`cards.create`). 이 함수의 `status`는 세 값 모두 허용한다.

#### cards.changeStatus

- 유형: `window.kanban.cards.changeStatus(id, status)` → IPC `kanban:cards:changeStatus` → `KanbanStore.changeStatus(id, status)`
- 관련 FR: FR-002 (AC-003, AC-004), FR-003
- 요청: `id`, `status` (`todo` | `in_progress` | `done`). 세 값 사이에서 어느 방향으로든 바꿀 수 있다 (ASM-004). 완료에서 되돌리기도 같은 함수다.
- 응답: 바뀐 `Card`. 같은 상태로 바꾸면 현재 카드 그대로, 저장하지 않는다 (UC-002 Alt Flow 1).
- 인증/권한: 보관된 카드는 거절한다 (ASM-015). 보관된 카드의 `status`는 `done`으로 유지된다.
- 에러: `VALIDATION_FAILED` (`status` / `INVALID_VALUE`, 보관은 상태 값이 아니라서 `'archived'`도 이 오류), `CARD_NOT_FOUND`, `CARD_ARCHIVED`, `SAVE_FAILED`, `STORE_LOCKED`
- 참고: `cards.update`의 `status` 필드와 같은 규칙을 쓴다. 보드의 상태 변경 조작은 이 함수를 쓰고, 입력 화면에서 상태를 같이 고칠 때는 `cards.update` 한 번에 보낸다 (두 호출로 쪼개면 중간 상태가 저장될 수 있다).

#### cards.archive

- 유형: `window.kanban.cards.archive(id)` → IPC `kanban:cards:archive` → `KanbanStore.archive(id)`
- 관련 FR: FR-010 (AC-019, AC-021)
- 요청: `id`
- 응답: `archivedAt`이 채워진 `Card`. `status`는 `done` 그대로다 (AC-004). 이후 `cards.list({ scope: 'board' })`에 나오지 않고 `scope: 'archive'`에만 나온다 (AC-019, AC-020).
- 인증/권한: `status = done`이고 아직 보관되지 않은 카드에만 허용한다 (ASM-013).
- 에러: `ARCHIVE_NOT_ALLOWED` (`details: { status }` — 완료가 아닌 카드, AC-021. 카드는 바뀌지 않는다), `CARD_ARCHIVED` (이미 보관됨), `CARD_NOT_FOUND`, `SAVE_FAILED`, `STORE_LOCKED`
- 보관을 되돌리는 함수는 만들지 않았다 (CAND-003, `결정 필요`).

#### cards.delete

- 유형: `window.kanban.cards.delete(id)` → IPC `kanban:cards:delete` → `KanbanStore.delete(id)`
- 관련 FR: FR-011 (AC-023, AC-034, AC-040). 삭제 전 확인 단계(AC-033)는 화면의 책임이다.
- 요청: `id`
- 응답: `{ deletedCardId, deletedProgressCount }`. 카드와 그 카드의 진행 기록을 같은 한 번의 저장에서 함께 지운다 (AC-034). 지운 뒤에는 앱을 다시 열어도 나타나지 않는다 (AC-023). 되돌리는 기능은 없다.
- 인증/권한: 보관된 카드도 삭제할 수 있다 (AC-040, UC-009, 명세의 상태 전이: 보관됨 → 삭제됨. 사용자가 정했다). 보관 카드의 수정·상태 변경·기록 추가는 거절한다 (ASM-015).
- 에러: `CARD_NOT_FOUND`, `SAVE_FAILED` (저장 실패 시 카드와 기록 모두 남아 있다), `STORE_LOCKED`
- 확인 단계는 인터페이스에 넣지 않았다. 이 함수는 호출되면 지운다. "삭제를 선택하면 확인 단계가 보이고, 취소하면 카드가 그대로 남는다"(AC-033)는 화면이 이 함수를 확인 뒤에만 호출하는 방식으로 지킨다.

### 진행 기록

#### progress.add

- 유형: `window.kanban.progress.add(cardId, input)` → IPC `kanban:progress:add` → `KanbanStore.addProgress(cardId, input)`
- 관련 FR: FR-009 (AC-017, AC-018)
- 요청: `cardId`, `ProgressInput { content }`
- 응답: 만들어진 `ProgressEntry`. `statusAtTime`은 main이 그 순간의 카드 `status`로 채운다 (AC-018). 기록 목록 맨 뒤에 붙어 남긴 순서대로 쌓이고, 다른 카드의 목록에는 나타나지 않는다 (AC-017). 기록 목록은 `cards.get`으로 읽는다.
- 인증/권한: 보관된 카드에는 추가할 수 없다 (ASM-015, UC-006 사전 조건). 할 일, 진행 중, 완료 상태의 보관 안 된 카드에는 모두 추가할 수 있다.
- 에러: `VALIDATION_FAILED` (내용이 비었거나 공백뿐이면 `content` / `REQUIRED`: 빈 기록은 추가되지 않는다), `CARD_NOT_FOUND`, `CARD_ARCHIVED`, `SAVE_FAILED`, `STORE_LOCKED`
- 자동으로 남기는 이력(상태 변경 기록 등)은 이 인터페이스에 없다. 다른 인터페이스(`cards.create`, `cards.changeStatus` 등)가 기록을 만들지 않는다 (ASM-009, Q-002).
- 진행 기록의 수정·삭제 함수는 없다 (CAND-009). 카드를 삭제할 때만 함께 지워진다.

### 설정

설정은 카드·기록과 같은 저장 파일의 `settings` 객체다 (`02-data-model.md`). 별도 저장 경로가 없어 저장 실패·읽기 실패·버전 변환의 규칙이 카드와 같다.

#### settings.get

- 유형: `window.kanban.settings.get()` → IPC `kanban:settings:get` → `KanbanStore.getSettings()`
- 관련 FR: FR-014 (AC-037, AC-038), FR-006
- 요청: 없음
- 응답: `Settings` = `{ theme }`. 저장된 판을 돌려준다. 처음 실행(저장 파일 없음)이거나 설정이 없던 이전 버전 파일이면 `{ theme: 'light' }`다 (ASM-017, AC-038. 이전 버전 파일의 기본값 규칙은 `02-data-model.md`의 `스키마 버전과 이전 버전 변환`). 이미 저장된 `theme`는 `dark`이든 `light`이든 그대로 돌려주며 기본값으로 바꾸지 않는다 (마이그레이션 없음). 파일을 읽거나 쓰지 않고 메모리의 값을 돌려준다.
- 사용 방법: 화면은 시작할 때 `store.getStatus()`가 `ready`인 것을 확인한 뒤 이 함수를 한 번 불러 첫 판을 정한다. 그 뒤 현재 판은 화면 상태가 들고 있으며, 판을 바꿀 때마다 다시 부르지 않는다 (아래 `settings.setTheme`의 저장 실패 규칙 때문이다).
- 인증/권한: 읽기 전용. 저장소가 읽기 실패 상태면 `STORE_LOCKED` (`결정 필요`의 "읽기 실패 화면의 판" 참고).
- 에러: `STORE_LOCKED`

#### settings.setTheme

- 유형: `window.kanban.settings.setTheme(theme)` → IPC `kanban:settings:setTheme` → `KanbanStore.setTheme(theme)`
- 관련 FR: FR-014 (AC-037, AC-038), FR-006 (NFR-002, NFR-003). UC-011.
- 요청: `theme` (`'dark'` | `'light'`). 두 값 사이에서 어느 방향으로든 바꿀 수 있다. 값 하나만 받으므로 객체 입력의 `UNKNOWN_FIELD`는 해당하지 않는다.
- 응답: 저장된 `Settings`. 지금과 같은 값으로 바꾸면 현재 설정 그대로 성공하고 저장하지 않는다.
- 인증/권한: 읽기 실패 상태면 거절 (`STORE_LOCKED`). 카드와 무관하므로 보관 여부 확인이 없다.
- 동작: `공통 순서`로 처리한다. 새 문서(`settings.theme`만 바뀜)를 만들어 `저장` 절차(임시 파일 → 교체 + 직전 저장본, NFR-002)로 쓰고, 성공해야 저장소의 설정을 바꾼다. 다음 실행은 이 값으로 열린다 (AC-038).
- 에러:
  - `VALIDATION_FAILED` (`details: { violations }`): `theme`이 목록 밖의 값이면 `theme` / `INVALID_VALUE`, 문자열이 아니면 `theme` / `INVALID_TYPE`. 저장하지 않는다.
  - `SAVE_FAILED` (`details: { stage, osCode?, dataFilePath }`), `STORE_LOCKED`
- **저장 실패 시 화면 동작 (UC-011 Alt Flow 1, AC-031과 같은 방식)**:
  - 화면은 사용자가 판 전환을 선택하는 즉시 모든 화면을 선택한 판으로 바꾸고 (AC-037), 그 뒤에 `settings.setTheme`을 부른다. 결과가 `SAVE_FAILED`여도 화면은 판을 되돌리지 않고 이번 실행이 끝날 때까지 선택한 판으로 보인다. 그와 함께 저장 실패 문구를 보인다 (문구는 UI 설계).
  - 이 함수가 실패해도 저장소의 설정과 파일은 이전 그대로다 (`공통 순서` 5, 카드 변경과 같은 규칙). 이번 실행 동안 바뀐 판을 들고 있는 것은 화면 상태이고 저장소가 아니다. 그래서 이후의 카드 저장이 저장되지 않은 판을 몰래 함께 저장하지 않는다.
  - 결과적으로 저장에 실패한 채 앱을 닫으면 다음 실행은 마지막으로 저장에 성공한 판(없으면 밝은 판)으로 열린다.
  - 같은 실행 중 사용자가 판을 다시 전환하면 새로 `settings.setTheme`을 부르며, 저장이 성공하면 그 값이 저장된다 (줄 세워 순서대로 처리).
- 판의 색 자체와 전환 조작의 모양은 UI 설계가 정한다 (ASM-017). 이 함수는 값 `dark`·`light`만 다룬다.

### 도메인 함수 (순수 함수, IPC 아님)

화면(renderer)과 main, `cli` 시험이 같은 구현을 공유하는 순수 함수다. 파일이나 시계를 직접 읽지 않고 필요한 값을 인자로 받는다.

#### isOverdue / todayLocal

- 유형: `isOverdue(card: Pick<Card, 'dueDate' | 'status'>, today: DateString): boolean`, `todayLocal(now: Date): DateString`
- 관련 FR: FR-012 (AC-024, AC-025)
- 판정식: `card.dueDate !== null && card.dueDate < today && card.status !== 'done'`. 날짜 문자열은 `YYYY-MM-DD`라서 문자열 비교가 날짜 순서와 같다. 마감일 당일은 지난 것이 아니다 (ASM-014). 완료 카드는 마감일이 지나도 `false` (AC-025). 보관한 카드는 항상 완료라서 `false`.
- `todayLocal`은 PC의 현지 시간대 기준 오늘 날짜를 만든다 (UTC가 아니다). 화면은 보드를 열거나 화면을 다시 불러올 때마다 `todayLocal(new Date())`로 오늘을 새로 구해 판정한다. 자정에 자동으로 다시 판정하는 것은 요구하지 않는다 (UC-008 Alt Flow 2). 판정 결과를 저장하지 않는다 (`02-data-model.md`).
- 마감이 지난 표시를 색 외에 글자나 아이콘으로도 구분하는 것(NFR-004)은 UI 설계의 몫이고, 이 함수는 불리언 하나만 돌려준다.

#### 검증과 조건 함수

- `validateCardInput(input, mode: 'create' | 'update'): Violation[]`, `validateProgressInput(input): Violation[]`: `02-data-model.md`의 `검증 규칙과 제약 매핑` 표를 코드로 옮긴 것이다. `mode: 'create'`에서는 `status`를 `todo`·`in_progress`만 허용하고(`done`은 `status` / `INVALID_VALUE`), `mode: 'update'`에서는 세 값을 모두 허용한다. 위반이 없으면 빈 배열. 화면이 저장 전에 같은 검사를 미리 해 오류 문구를 보여 줄 수 있지만 (AC-002, AC-029, AC-035), 최종 판단은 항상 main의 검증이다.
- `matchesQuery(card, query): boolean`: `cards.list`가 쓰는 검색·필터 조건 판정 (제목 부분 일치·대소문자 무시·앞뒤 공백 제거, 종류·우선순위 일치, 모든 조건 AND, ASM-012). 화면이 같은 조건 검사를 다시 구현하지 않게 공유한다.

## 저장 모듈 인터페이스 (main 내부)

`KanbanStore`는 화면이 부르는 함수의 실제 구현이고, 파일 시스템 접근은 `FileSystemPort`를 통해서만 한다. 그래서 `cli` 시험이 어느 단계에서든 일부러 실패시키거나 강제 종료를 흉내 낼 수 있다 (NFR-002, NFR-003, AC-031, AC-032).

```ts
interface KanbanStore {
  open(): Promise<StoreStatus>;          // 앱 시작 때 한 번. 읽기·검증·버전 변환. 파일을 쓰지 않는다 (AC-011, AC-032, NFR-003)
  getStatus(): StoreStatus;
  retryOpen(): Promise<StoreStatus>;
  list(query: CardQuery): Result<Card[]>;
  get(id: string): Result<CardDetail>;
  create(input: CardCreateInput): Promise<Result<Card>>;
  update(id: string, patch: CardPatch): Promise<Result<Card>>;
  changeStatus(id: string, status: Status): Promise<Result<Card>>;
  archive(id: string): Promise<Result<Card>>;
  delete(id: string): Promise<Result<{ deletedCardId: string; deletedProgressCount: number }>>;
  addProgress(cardId: string, input: ProgressInput): Promise<Result<ProgressEntry>>;
  getSettings(): Result<Settings>;
  setTheme(theme: Theme): Promise<Result<Settings>>;
  close(): Promise<void>;                // 줄 서 있는 저장이 모두 끝날 때까지 기다린다 (정상 종료, NFR-002)
}

function createKanbanStore(deps: {
  dataDir: string;                       // 앱 데이터 폴더 (시험은 임시 폴더). 지정 방식은 아키텍처 설계
  fs: FileSystemPort;                    // 파일 접근 (시험에서 실패·강제 종료 주입)
  clock: () => Date;                     // createdAt, archivedAt 시각
  newId: () => string;                   // UUID v4. 시험은 고정 값
}): KanbanStore;

interface FileSystemPort {
  readFile(path: string): Promise<string>;                // 없으면 오류 코드 ENOENT
  exists(path: string): Promise<boolean>;
  writeFileSynced(path: string, data: string): Promise<void>;   // 쓰고 fsync하고 닫는다 (덮어쓰기)
  copyFile(from: string, to: string): Promise<void>;      // 덮어쓰기
  rename(from: string, to: string): Promise<void>;        // 덮어쓰기 허용
}
```

- 저장 단계 이름 (`SAVE_FAILED.details.stage`): `write_temp`, `verify`, `backup`, `replace` 네 가지 (절차는 `02-data-model.md`의 `저장`). 임시 파일 쓰기와 디스크 반영(fsync)은 `writeFileSynced` 한 호출이라 별도 단계 없이 `write_temp`에 포함하며, 디스크 반영 실패도 `write_temp`로 보고한다. `details`는 `{ stage, osCode?, dataFilePath }`.
- 저장은 `FileSystemPort`의 위 다섯 동작만으로 이루어진다. 시험에서 각 동작을 n번째 호출에서 실패시키거나 던지게 하여, 모든 중단 시점에서 (1) 호출자가 `SAVE_FAILED`를 받고 (2) 메모리와 본 파일이 이전 그대로이며 (3) 다시 열면 직전 저장본으로 열리는지 확인한다.
- 읽기 실패 상태의 `KanbanStore`는 `FileSystemPort`로 쓰기 동작(`writeFileSynced`, `copyFile`, `rename`)을 호출하지 않는다 (AC-032). 시험이 이를 호출 기록으로 확인한다.
- 이 모듈의 공개 함수는 화면 함수의 이름과 1:1이다 (`addProgress`는 `progress.add`, `getSettings`는 `settings.get`, `setTheme`은 `settings.setTheme`에 대응).
- 설정을 바꾸는 저장(`setTheme`)도 위 네 단계와 `FileSystemPort`의 같은 다섯 동작만 쓴다. 설정을 위한 별도 파일 접근이 없다. 시험은 `setTheme`에서도 각 동작의 실패·강제 종료를 흉내 내어 `SAVE_FAILED`와 설정·파일 불변을 확인하고, 버전 1 파일(설정 없음)을 읽어 `getSettings()`가 `{ theme: 'light' }`를 돌려주는지, 이미 `{ theme: 'dark' }`가 저장된 버전 2 파일은 `dark`로 읽히는지 확인한다 (NFR-002, NFR-003). 여기서 새 동작을 늘리면 이 문서의 화면 인터페이스에도 추가해야 한다.

## 에러 카탈로그

### 호출 오류 (`Result`의 `error.code`)

| 코드 | 상황 | 처리 (호출자·화면) | 관련 |
|------|------|------------------|------|
| `VALIDATION_FAILED` | 입력이 검증 규칙을 어김. `details.violations`에 `{ field, reason }`을 모두 담는다 | 저장하지 않는다. 화면은 `field`에 해당하는 입력 칸에 오류 문구를 보인다 (제목 `REQUIRED`, 마감일 `INVALID_DATE`). 입력은 지우지 않는다 | AC-002, AC-004, AC-029, AC-035, AC-042 |
| `CARD_NOT_FOUND` | 아이디의 카드가 없음 (이미 삭제됨 등). `details: { id }` | 화면은 목록을 다시 불러온다 | FR-011 |
| `CARD_ARCHIVED` | 보관된 카드를 수정, 상태 변경, 기록 추가, 다시 보관하려 함 | 변경하지 않는다. 보관 카드는 읽기 전용이다. 화면은 보관함에서 해당 조작을 보이지 않는 것이 기본이고, 이 오류는 안전장치다 | ASM-015 |
| `ARCHIVE_NOT_ALLOWED` | 완료가 아닌 카드를 보관하려 함. `details: { status }` | 보관하지 않는다 | ASM-013, AC-021 |
| `SAVE_FAILED` | 디스크에 저장하지 못함. `details: { stage, osCode?, dataFilePath }` | 메모리와 파일은 이전 그대로다. 화면은 저장 실패 문구를 보이고 입력한 내용을 지우지 않아 사용자가 다시 시도할 수 있다. 칸 이동·보관·삭제·캘린더 끌기는 화면도 바뀌지 않은 채 그대로다. `settings.setTheme`이면 화면은 선택한 판을 이번 실행 동안 유지하고 저장 실패 문구를 보인다 | AC-031, AC-046, NFR-002, UC-011 Alt Flow 1 |
| `STORE_LOCKED` | 저장소가 읽기 실패 상태라 요청을 처리하지 않음 | 화면은 오류 안내 화면에 머문다. 아무것도 저장되지 않는다 | AC-032 |
| `INTERNAL` | 예상하지 못한 오류 (`message`에 진단). 데이터는 바뀌지 않는다 | main은 이 오류를 만들 때 `console.error`로 `message`와 stack을 남긴다 (로그 파일은 만들지 않는다). 화면은 일반 오류 문구를 보이고 `message`는 접힌 `자세히`로 보여 준다 | - |

### 검증 위반 값 (`VALIDATION_FAILED.details.violations[].reason`)

| field | reason | 상황 |
|-------|--------|------|
| `title` | `REQUIRED` | 비었거나 공백뿐 |
| `title`, `description`, `memo`, `content`, `text`, `id`, `dueDate`, `theme` | `INVALID_TYPE` | 문자열이 아니거나, `dueDate`가 문자열·`null`이 아님 |
| `kind`, `status`, `priority`, `scope`, `theme` | `INVALID_VALUE` | 허용 목록 밖의 값 (`status`에 `'archived'` 포함, 생성 입력의 `status`가 `'todo'`·`'in_progress'` 밖(`'done'` 포함), `theme`은 `dark`·`light` 밖의 값) |
| `dueDate` | `INVALID_DATE` | `YYYY-MM-DD` 형식이 아니거나 달력에 없는 날짜 (예: `2026-02-30`) |
| `content` | `REQUIRED` | 진행 기록 내용이 비었거나 공백뿐 |
| 입력에 정의되지 않은 필드 이름 | `UNKNOWN_FIELD` | `id`, `archivedAt`, `createdAt` 등. 생성 입력의 `status`는 정의된 필드라 이 오류가 아니다 (명세 v4 이전에는 `UNKNOWN_FIELD`였다) |

### 읽기 실패 값 (`StoreStatus.failure.code`)

`02-data-model.md`의 읽기 실패 원인 값 표와 같다: `FILE_UNREADABLE`, `JSON_PARSE_FAILED`, `SCHEMA_INVALID`, `INTEGRITY_VIOLATED`, `SCHEMA_TOO_NEW`, `MIGRATION_FAILED`. 이 값들은 호출 오류가 아니라 `store.getStatus()`의 상태로 보고한다.

## 추적성

### FR별 인터페이스

| FR | 인터페이스 |
|----|-----------|
| FR-001 | `cards.create` (처음 상태 할 일 또는 진행 중) |
| FR-002 | `cards.changeStatus`, `cards.update` |
| FR-003 | `cards.list` (보드) |
| FR-004 | `cards.create`, `cards.update`, `cards.get` (마감일. 달력으로 날짜 고르기는 화면 입력 방식이고 같은 `dueDate`를 보낸다) |
| FR-005 | `cards.list` (캘린더), `cards.get` (캘린더에서 카드 열기), `cards.update` (캘린더에서 끌어 마감일 변경) |
| FR-006 | `store.getStatus`, `store.retryOpen`, 저장 모듈 (`open`, 저장 절차, `SAVE_FAILED`, `STORE_LOCKED`. 설정도 같은 파일·같은 절차) |
| FR-007 | `cards.create` (종류), `cards.update`, `cards.list` (종류 필터) |
| FR-008 | `cards.create`, `cards.update`, `cards.get` (설명·우선순위·메모) |
| FR-009 | `progress.add`, `cards.get` (기록 목록) |
| FR-010 | `cards.archive`, `cards.list` (`scope: 'archive'`), `cards.get` |
| FR-011 | `cards.update`, `cards.delete` |
| FR-012 | `isOverdue`, `todayLocal` |
| FR-013 | `cards.list` (`text`, `kind`, `priority`, `scope`), `matchesQuery` |
| FR-014 | `settings.get`, `settings.setTheme` |

### AC별 인터페이스

| AC | 인터페이스 · 근거 |
|----|-----------------|
| AC-001 | `cards.create` — 상태를 고르지 않으면 새 카드 `status = todo` |
| AC-002 | `cards.create` — `title` / `REQUIRED` |
| AC-003 | `cards.changeStatus`, `cards.update`, 이후 `cards.list` |
| AC-004 | `Status` 타입 세 값. `'archived'`는 `status` / `INVALID_VALUE` |
| AC-005 | `cards.list`가 카드마다 `status` 하나를 돌려주고 화면이 칸으로 나눈다 |
| AC-006 | `cards.list`가 빈 배열을 오류 없이 돌려준다 |
| AC-007 | `cards.create`·`cards.update`의 `dueDate`, `cards.get` |
| AC-008 | `dueDate` 생략·`null` 허용 |
| AC-009 | `cards.list` (`scope: 'board'`) 의 `dueDate`로 화면이 날짜에 배치 |
| AC-010 | `dueDate: null` 카드도 `cards.list`에 있고 화면이 캘린더에서만 제외 |
| AC-011 | `store.getStatus`, 저장 절차, 읽기 절차 |
| AC-012 | 네트워크를 쓰는 인터페이스가 없다 (`외부 시스템 연동: 없음`) |
| AC-013 | `cards.create`의 `kind`, `cards.list` |
| AC-014 | `cards.create` — `kind` 기본값 `task` |
| AC-015 | `cards.create`·`cards.update`·`cards.get` |
| AC-016 | `priority` 세 값 또는 `null` (생략 가능). 화면 표시 순서(없음, 낮음, 중간, 높음)와 이름 중간은 화면의 일이고 저장 값 `medium`은 그대로 |
| AC-017 | `progress.add`, `cards.get`의 카드별 기록 목록 |
| AC-018 | `progress.add` — `statusAtTime` (진행 중으로 만든 카드도 이 규칙 그대로) |
| AC-019 | `cards.archive`, `cards.list` (`scope: 'board'`에서 제외) |
| AC-020 | `cards.list` (`scope: 'archive'`), `cards.get` |
| AC-021 | `cards.archive` — `ARCHIVE_NOT_ALLOWED` |
| AC-022 | `cards.update` |
| AC-023 | `cards.delete` — 저장 후 재시작해도 없음 |
| AC-024 | `isOverdue` |
| AC-025 | `isOverdue` — 완료는 `false` |
| AC-026 | `matchesQuery` (화면이 거름), `cards.list`의 `text` (시험·main 보조) |
| AC-027 | `matchesQuery` (화면이 거름), `cards.list`의 `kind`·`priority` AND 결합 (시험·main 보조). 전체는 조건 제거 |
| AC-028 | `cards.list`의 `scope` 구분 (화면은 `scope: 'archive'`로 받아 `matchesQuery`로 거름) |
| AC-029 | `dueDate` / `INVALID_DATE` (`cards.create`, `cards.update`) |
| AC-030 | `cards.get` |
| AC-031 | `SAVE_FAILED` + 메모리·파일 불변 |
| AC-032 | `StoreStatus.read_failed`, `STORE_LOCKED`, 읽기 실패 시 쓰기 금지 |
| AC-033 | 화면이 확인 뒤에만 `cards.delete`를 호출 (인터페이스에는 확인 인자 없음) |
| AC-034 | `cards.delete` — 카드와 기록을 한 번에 삭제 |
| AC-035 | `cards.update` — `title` / `REQUIRED` |
| AC-036 | `cards.list`의 빈 결과. 적용 중인 조건은 화면이 가진 `CardQuery` |
| AC-037 | `settings.setTheme` — 선택한 `theme` 저장. 화면이 선택 즉시 모든 화면에 적용 (저장 실패여도 이번 실행 동안 유지, UC-011 Alt Flow 1) |
| AC-038 | `settings.get` — 저장된 판, 없으면 `light` (처음 실행·설정 없는 이전 버전 파일). 이미 저장된 값은 바꾸지 않는다. `settings.setTheme` — 저장 후 재실행해도 유지 |
| AC-039 | 인터페이스 영향 없음. `kind`와 `isOverdue`의 값이 `theme`과 무관하게 같아 두 판 모두에서 UI가 글자·아이콘으로 구분할 수 있다 (구분 방법은 UI 설계) |
| AC-040 | `cards.delete` — 보관된 카드도 거절하지 않고 카드와 기록을 한 번에 삭제 (확인 단계는 화면, 보관 카드의 수정·기록 추가는 `CARD_ARCHIVED`로 거절) |
| AC-041 | `cards.create` — `status: 'in_progress'`로 만들면 진행 중 칸에 나타남 |
| AC-042 | `cards.create` — `status`는 `todo`·`in_progress`만, `done`은 `status` / `INVALID_VALUE`. 처음 선택 값이 할 일인 것은 입력 생략 시 기본값 `todo`와 화면의 초기 선택 |
| AC-043 | 인터페이스 영향 없음. 달력으로 고르든 직접 입력하든 같은 `dueDate` 문자열을 `cards.create`·`cards.update`에 보낸다 (검증 `INVALID_DATE`는 그대로) |
| AC-044 | `cards.update(id, { dueDate })` — 저장 성공 뒤에 화면이 바꾼다. 상태와 다른 필드는 patch에 없으므로 바뀌지 않는다 |
| AC-045 | 화면이 호출하지 않는다 (원래 날짜 칸 또는 날짜 칸 밖). 같은 `dueDate`로 호출돼도 저장하지 않고 현재 카드를 돌려준다 |
| AC-046 | `cards.update` — `SAVE_FAILED`, 카드·마감일 불변. 화면은 원래 날짜 칸에 두고 저장 실패 문구를 보인다 |
| AC-047 | 인터페이스 영향 없음. 전체 항목은 `CardQuery`의 `kind`·`priority`를 생략하는 것(조건 제거)이고 항목 순서는 화면의 일이다 |
| AC-048 | 인터페이스 영향 없음 (캘린더 레이아웃과 창 크기, 화면의 일) |

### NFR

| NFR | 반영 |
|-----|------|
| NFR-001 | 네트워크·외부 자원을 쓰는 인터페이스 없음. 화면은 `window.kanban` 말고 외부에 닿지 않는다 |
| NFR-002 | 저장 절차(임시 파일 → 교체 + 직전 저장본), `SAVE_FAILED`, 저장 모듈의 `FileSystemPort` 주입으로 강제 종료 흉내 시험. `settings.setTheme`과 캘린더 끌기(`cards.update`)도 같은 절차 |
| NFR-003 | `open()`의 버전 변환(설정 없는 버전 1 파일 → `theme = light`), `SCHEMA_TOO_NEW`, `MIGRATION_FAILED`. 명세 v4는 저장 형식을 바꾸지 않아 스키마 버전은 2 그대로 |
| NFR-004 | 인터페이스 영향 없음 (`kind`와 `isOverdue`의 값을 UI가 두 판 모두에서 글자·아이콘으로도 구분) |

### 인터페이스 없는 엔티티

- 모든 엔티티(`Card`, `ProgressEntry`, `Settings`, 루트 `DataFile`)가 위 인터페이스에 나온다. `DataFile`은 화면에 노출되지 않고 저장 모듈 안에서만 쓰인다.

## 결정 필요

| 항목 | 지금 설계 | 선택지 | 권고 |
|------|----------|--------|------|
| 읽기 실패에서 벗어나는 동작 | 해소됨 (사용자 결정 D3): `store.retryOpen`(다시 읽기)뿐이다. 앱 안에 복구 동작을 넣지 않고 `ReadFailure`의 경로·상태로 수동 절차 안내 문구만 보인다 | (a) 지금 그대로(안내 문구 보강) (b) `store.openFromBackup` 같은 "직전 저장본으로 열기" 추가 (c) "손상 파일을 옆으로 옮겨 보존하고 빈 보드로 시작" 추가 | 사용자가 (a)를 골랐다 |
| 보관 해제 (CAND-003) | `cards.unarchive` 없음 | (a) 없음 (b) 해제 허용 | 사용자가 정한다 |
| 칸 안 정렬 (CAND-005) | `cards.list`는 저장 순서(만든 순서)로 돌려줄 뿐 정렬 인자가 없다 | (a) 만든 순서 (b) 마감일 순 (c) 우선순위 순 (d) 직접 정렬(순서 변경 함수 필요) | 사용자가 정한다 |
| 자동 이력 (Q-002) | 없음. `progress.add`만 있다 | (a) 직접 기록만 (b) 자동 이력 추가 | 사용자가 정한다 (ASM-009) |
| 진행 기록 수정·삭제 (CAND-009) | `progress.update`, `progress.delete` 없음 | (a) 추가만 (b) 수정·삭제 허용 | 사용자가 정한다 |
| 검색 범위 (CAND-008) | 제목만 (ASM-012) | 설명·메모까지 넓힐지 | 사용자가 정한다 |
| 읽기 실패 화면의 판 (FR-014) | 설정이 데이터 파일 안에 있어 읽기 실패이면 `settings.get`·`settings.setTheme`도 `STORE_LOCKED`다. 화면은 기본값(밝은 판)으로 오류 안내를 보인다 | (a) 지금 그대로 (b) 설정을 별도 파일로 분리해 읽기 실패에서도 판을 읽고 바꾼다 (`02-data-model.md`의 같은 항목) | 사용자가 정한다. 말한 바가 없어 (a) |
| 버전 1 파일의 기본 판 (AC-038) | 설정 없는 버전 1 파일의 1→2 변환은 `light`를 채운다 (`02-data-model.md`의 같은 항목) | (a) `light` (b) 이전 설계대로 `dark` | 사용자가 정한다. 처음 실행과 같은 기본값이 일관되어 (a) |

## 검증 기록

- 설계 결함 수정(BI-003, 구현 중 보고): 저장 단계에서 `sync`를 따로 두지 않고 `write_temp`에 포함해 `write_temp`, `verify`, `backup`, `replace` 네 단계로 고쳤다(`writeFileSynced` 한 호출이 쓰기와 fsync를 함께 한다). 저장 단계 수만 5에서 4로 바뀌었고 파일·컴포넌트·Wave·TC·인터페이스 수는 그대로다.
- 2026-11-05 명세 v4 반영(AC-041~AC-048, ASM-004/008/017/018): `CardCreateInput`에 `status?: 'todo' | 'in_progress'`를 추가하고 그 밖의 값은 기존 코드 `status` / `INVALID_VALUE`로 거절(새 코드 없음, 이전의 생성 입력 `status` → `UNKNOWN_FIELD` 규칙 폐기), 우선순위 표시 이름 보통→중간과 표시 순서(저장 값 `medium` 그대로), `settings.get` 기본값 `dark`→`light`(이미 저장된 값은 바꾸지 않음), 캘린더 끌기는 기존 `cards.update(id, { dueDate })`를 쓰는 것으로 명시했다. 인터페이스 수(12개)는 그대로이고 AC-041~AC-048이 추적성 표에 들어갔다. 아래 기록 중 "AC 40개"와 "어두운 판 기본" 서술은 이 수정 전의 것이다.
- 유형을 로컬 전용으로 확정했다. HTTP 엔드포인트와 인증이 없고, 외부 API 연동도 없다 (명세의 외부 시스템 카탈로그에 PC 알림 하나뿐이며 ASM-011로 범위 밖). `외부 시스템 연동` 섹션은 "없음"과 사유를 적었다.
- 화면 함수 12개(`store` 2, `cards` 7, `progress` 1, `settings` 2)가 FR-001~FR-014를 모두 덮는다. FR-012는 순수 함수(`isOverdue`)가 맡는다. 추적성 표에서 FR 14개와 AC 48개가 모두 인터페이스에 매핑되었다 (AC-033은 확인 단계가 화면 책임, AC-039·AC-043·AC-047·AC-048은 인터페이스 영향 없음이라고 명시, AC-040은 `cards.delete`가 보관 카드도 허용).
- UC-011 Alt Flow 1(판 선택 저장 실패)을 `settings.setTheme`의 계약에 넣었다: 저장소와 파일은 이전 그대로이고(`SAVE_FAILED`), 이번 실행 동안 바뀐 판으로 보이게 하는 일과 저장 실패 문구는 화면이 맡는다.
- 설정은 `DataFile.settings`로 같은 파일·같은 저장 절차를 쓰므로 새 오류 코드와 새 저장 경로가 없다. 새 엔티티는 명세의 Settings 하나이고 새 요구사항 ID는 만들지 않았다.
- 모든 인터페이스의 요청·응답·에러가 `02-data-model.md`의 필드 이름·값(`status`, `kind`, `priority`, `dueDate`, `archivedAt`, `statusAtTime`)과 같다. 새 엔티티와 새 요구사항 ID를 만들지 않았다. 에러 코드 이름은 요구사항 ID 형식이 아니다.
- 저장 실패(`SAVE_FAILED`)와 읽기 실패(`read_failed` + `STORE_LOCKED`)의 오류 계약을 정했다. 읽기 실패 상태에서는 쓰기 동작을 부르지 않는다는 규칙을 `FileSystemPort` 호출 기록으로 시험할 수 있다.
- 검증 규칙의 위반 오류 값은 `{ field, reason }` 쌍으로 정의하고 `02-data-model.md`의 규칙 표와 일치시켰다.
- 자동 이력, 칸 안 정렬, 보관 해제, 진행 기록 수정·삭제는 인터페이스로 만들지 않고 `결정 필요`에 남겼다.
- 이 설계는 실행해 보지 않았다. 이름 바꾸기가 Windows에서 기존 파일을 한 번에 교체하는지, `fsync` 이후의 동작은 구현 단계의 `cli` 시험으로 확인한다.
- `04-ui-spec.md`는 읽지 않았다. 화면 문구와 칸 안 순서는 UI 설계가 정하고, 이 문서는 값과 오류 코드까지만 정한다.
