// KanbanStore 인터페이스와 createKanbanStore 인자 타입 (docs/05-design/03-api-spec.md 저장 모듈 인터페이스).
// IpcHandlers 가 구현(kanban-store.ts) 없이 이 인터페이스만 의존한다. 타입만 있다.

import type {
  Card,
  CardCreateInput,
  CardDetail,
  CardPatch,
  CardQuery,
  ProgressEntry,
  ProgressInput,
  Settings,
  Status,
  Theme,
} from '../../shared/types/card'
import type { Result, StoreStatus } from '../../shared/types/result'
import type { DeleteCardValue } from '../../shared/types/api'
import type { FileSystemPort } from './file-system-port'

/** 화면 함수의 실제 구현. 공개 함수 이름은 화면 함수와 1:1 (addProgress=progress.add, getSettings=settings.get, setTheme=settings.setTheme). */
export interface KanbanStore {
  /** 앱 시작 때 한 번. 읽기·검증·버전 변환. 파일을 쓰지 않는다 (AC-011, AC-032, NFR-003). */
  open(): Promise<StoreStatus>
  getStatus(): StoreStatus
  retryOpen(): Promise<StoreStatus>
  list(query: CardQuery): Result<Card[]>
  get(id: string): Result<CardDetail>
  create(input: CardCreateInput): Promise<Result<Card>>
  update(id: string, patch: CardPatch): Promise<Result<Card>>
  changeStatus(id: string, status: Status): Promise<Result<Card>>
  archive(id: string): Promise<Result<Card>>
  delete(id: string): Promise<Result<DeleteCardValue>>
  addProgress(cardId: string, input: ProgressInput): Promise<Result<ProgressEntry>>
  getSettings(): Result<Settings>
  setTheme(theme: Theme): Promise<Result<Settings>>
  /** 줄 서 있는 저장이 모두 끝날 때까지 기다린다 (정상 종료, NFR-002). */
  close(): Promise<void>
}

/** createKanbanStore 인자. */
export type KanbanStoreDeps = {
  /** 앱 데이터 폴더 (시험은 임시 폴더). */
  dataDir: string
  /** 파일 접근 (시험에서 실패·강제 종료 주입). */
  fs: FileSystemPort
  /** createdAt, archivedAt 시각. */
  clock: () => Date
  /** UUID v4. 시험은 고정 값. */
  newId: () => string
}
