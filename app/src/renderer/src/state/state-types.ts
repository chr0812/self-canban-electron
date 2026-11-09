// renderer 상태의 모양과 액션 (docs/05-design/05-architecture.md AppState).
// DataState: main 문서의 사본. 저장 성공 결과로만 바뀐다 (판 전환 제외).
// UiState: 화면 키, 보드·보관함 조건, 캘린더 보기·기간, 열린 대화상자. 앱이 켜져 있는 동안만 산다.
// SaveState: 진행 중 요청 수와 다시 보낼 요청 한 건.
// 순수 타입 모듈이다 (React·DOM 없음).

import type { Card, CardCreateInput, CardPatch, DateString, ProgressInput, Status, Theme } from '@shared/types/card'
import type { AppError, ReadFailure } from '@shared/types/result'
import type { Conditions } from '../model/board-model'
import type { CalendarMode } from '../model/calendar-model'

export type ScreenKey = 'board' | 'calendar' | 'archive'

/** 조건이 걸리는 목록: 보드 또는 보관함. */
export type ConditionScope = 'board' | 'archive'

export type BootState = { phase: 'loading' } | { phase: 'ready' } | { phase: 'read_failed'; failure: ReadFailure }

export type DataState = {
  boot: BootState
  /** 보관하지 않은 카드 (조건 없이 받은 전체). */
  boardCards: Card[]
  /** 보관한 카드 (조건 없이 받은 전체). */
  archiveCards: Card[]
  theme: Theme
}

export type DialogState = {
  mode: 'new' | 'edit' | 'readonly'
  /** new 모드에서는 null. */
  cardId: string | null
}

export type UiState = {
  screen: ScreenKey
  board: Conditions
  archive: Conditions
  calendar: { mode: CalendarMode; anchor: DateString }
  dialog: DialogState | null
}

/** 화면이 보낸 변경 요청. 실패하면 이 모양 그대로 한 건을 기억했다가 다시 보낸다. */
export type ChangeRequest =
  | { kind: 'createCard'; input: CardCreateInput }
  | { kind: 'updateCard'; id: string; patch: CardPatch }
  | { kind: 'moveCard'; id: string; status: Status }
  | { kind: 'moveDueDate'; id: string; dueDate: DateString }
  | { kind: 'archiveCard'; id: string }
  | { kind: 'deleteCard'; id: string }
  | { kind: 'addProgress'; cardId: string; input: ProgressInput }
  | { kind: 'setTheme'; theme: Theme }

export type SaveState = {
  /** saved: 대기 없음·마지막 성공 / saving: 요청 진행 중 / failed: 마지막 요청이 실패 / unavailable: 읽기 실패로 잠김. */
  status: 'saved' | 'saving' | 'failed' | 'unavailable'
  /** 보냈고 아직 결과를 받지 못한 요청 수. */
  pending: number
  /** 끝난 마지막 요청의 결과. 요청 수가 0이 될 때 saved 인지 failed 인지를 정한다. */
  lastOutcome: 'ok' | 'failed'
  /** 다시 보낼 요청 한 건 (lastOutcome 이 failed 일 때). */
  failedRequest: ChangeRequest | null
  /** 실패한 요청의 오류 (알림 줄 문구와 `자세히`에 쓴다). */
  error: AppError | null
}

export type DataAction =
  | { type: 'data/loaded'; boardCards: Card[]; archiveCards: Card[]; theme: Theme }
  | { type: 'data/read_failed'; failure: ReadFailure }
  | { type: 'data/lists_replaced'; boardCards: Card[]; archiveCards: Card[] }
  | { type: 'data/card_added'; card: Card }
  | { type: 'data/card_replaced'; card: Card }
  | { type: 'data/card_archived'; card: Card }
  | { type: 'data/card_deleted'; id: string }
  | { type: 'data/theme_set'; theme: Theme }

export type UiAction =
  | { type: 'ui/screen_set'; screen: ScreenKey }
  /** patch 에서 undefined 인 키는 그 조건을 지운다. */
  | { type: 'ui/conditions_changed'; scope: ConditionScope; patch: Conditions }
  | { type: 'ui/conditions_cleared'; scope: ConditionScope }
  | { type: 'ui/calendar_mode_set'; mode: CalendarMode }
  | { type: 'ui/calendar_anchor_set'; anchor: DateString }
  | { type: 'ui/dialog_opened'; dialog: DialogState }
  | { type: 'ui/dialog_closed' }

export type SaveAction =
  | { type: 'save/started' }
  | { type: 'save/succeeded' }
  /** 저장 실패 등 다시 보낼 수 있는 실패. request 를 한 건 기억한다. */
  | { type: 'save/failed'; request: ChangeRequest; error: AppError }
  /** 저장 결과와 무관하게 끝난 요청 (검증 실패, 목록을 다시 받은 오류). 직전 결과를 바꾸지 않는다. */
  | { type: 'save/ended' }
  /** 읽기 실패(STORE_LOCKED). 다시 읽기에 성공해 reset 할 때까지 유지한다. */
  | { type: 'save/locked' }
  | { type: 'save/reset' }

export type Action = DataAction | UiAction | SaveAction

export function isDataAction(action: Action): action is DataAction {
  return action.type.startsWith('data/')
}

export function isUiAction(action: Action): action is UiAction {
  return action.type.startsWith('ui/')
}

export function isSaveAction(action: Action): action is SaveAction {
  return action.type.startsWith('save/')
}
