// 엔티티, 입력, 조회 조건, 저장 문서 타입 (docs/05-design/02-data-model.md, 03-api-spec.md).

import type { CREATE_STATUSES, KINDS, PRIORITIES, STATUSES, THEMES } from '../constants'

export type Status = (typeof STATUSES)[number]
/** 카드를 만들 때 고를 수 있는 상태: 'todo' | 'in_progress'. */
export type CreateStatus = (typeof CREATE_STATUSES)[number]
export type Kind = (typeof KINDS)[number]
export type Priority = (typeof PRIORITIES)[number]
export type Theme = (typeof THEMES)[number]

/** 'YYYY-MM-DD' (PC 현지 날짜, 시각 없음). */
export type DateString = string

/** UTC 시각 문자열. 예: '2026-11-03T09:12:34.567Z'. */
export type Instant = string

export type Card = {
  id: string
  title: string
  status: Status
  kind: Kind
  description: string
  dueDate: DateString | null
  priority: Priority | null
  memo: string
  archivedAt: Instant | null
  createdAt: Instant
}

export type ProgressEntry = {
  id: string
  cardId: string
  content: string
  statusAtTime: Status
  createdAt: Instant
}

/** 앱 하나에 한 건. 저장된 값이 없으면 { theme: 'light' }. */
export type Settings = { theme: Theme }

/** 저장 파일의 루트 문서. */
export type DataFile = {
  schemaVersion: number
  settings: Settings
  cards: Card[]
  progressEntries: ProgressEntry[]
}

/** progress 는 남긴 순서. */
export type CardDetail = { card: Card; progress: ProgressEntry[] }

export type CardQuery = {
  /** board: archivedAt 이 null 인 카드, archive: archivedAt 이 있는 카드. */
  scope: 'board' | 'archive'
  /** 제목에 들어 있는 글자. */
  text?: string
  kind?: Kind
  priority?: Priority
}

export type CardCreateInput = {
  title: string
  /** 생략하면 'todo'. 'done' 으로는 만들 수 없다 (AC-041, AC-042). */
  status?: CreateStatus
  kind?: Kind
  description?: string
  dueDate?: DateString | null
  priority?: Priority | null
  memo?: string
}

/** 보낸 필드만 바꾼다. 이 일곱 개 밖의 필드는 거부 (UNKNOWN_FIELD). */
export type CardPatch = Partial<{
  title: string
  kind: Kind
  status: Status
  description: string
  dueDate: DateString | null
  priority: Priority | null
  memo: string
}>

export type ProgressInput = { content: string }
