// window.kanban 이 가진 열두 함수의 타입 (docs/05-design/03-api-spec.md API / 인터페이스).
// 타입만 있다. 값을 export 하지 않는다.

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
} from './card'
import type { Result, StoreStatus } from './result'

/** cards.delete 의 성공 값. */
export type DeleteCardValue = { deletedCardId: string; deletedProgressCount: number }

/** 화면이 부르는 열두 함수: store 2, cards 7, progress 1, settings 2. */
export interface KanbanApi {
  store: {
    getStatus(): Promise<StoreStatus>
    retryOpen(): Promise<StoreStatus>
  }
  cards: {
    list(query: CardQuery): Promise<Result<Card[]>>
    get(id: string): Promise<Result<CardDetail>>
    create(input: CardCreateInput): Promise<Result<Card>>
    update(id: string, patch: CardPatch): Promise<Result<Card>>
    changeStatus(id: string, status: Status): Promise<Result<Card>>
    archive(id: string): Promise<Result<Card>>
    delete(id: string): Promise<Result<DeleteCardValue>>
  }
  progress: {
    add(cardId: string, input: ProgressInput): Promise<Result<ProgressEntry>>
  }
  settings: {
    get(): Promise<Result<Settings>>
    setTheme(theme: Theme): Promise<Result<Settings>>
  }
}
