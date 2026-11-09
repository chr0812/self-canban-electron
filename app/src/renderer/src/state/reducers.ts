// 세 상태의 reducer (순수). 입력 상태 객체를 바꾸지 않고 새 객체를 돌려준다.
// 화면 사본(DataState)은 저장 성공 결과로만 바뀐다. 판 전환(data/theme_set)만 응답 전에 먼저 부른다.

import { DEFAULT_THEME } from '@shared/constants'
import { todayLocal } from '@shared/domain/date-rules'
import type { Card, DateString } from '@shared/types/card'
import type { Conditions } from '../model/board-model'
import type { DataAction, DataState, SaveAction, SaveState, UiAction, UiState } from './state-types'

export function initialDataState(): DataState {
  return { boot: { phase: 'loading' }, boardCards: [], archiveCards: [], theme: DEFAULT_THEME }
}

export function initialUiState(today: DateString = todayLocal(new Date())): UiState {
  return {
    screen: 'board',
    board: {},
    archive: {},
    calendar: { mode: 'month', anchor: today },
    dialog: null,
  }
}

export function initialSaveState(): SaveState {
  return { status: 'saved', pending: 0, lastOutcome: 'ok', failedRequest: null, error: null }
}

function upsert(cards: readonly Card[], card: Card): Card[] {
  const found = cards.some((item) => item.id === card.id)
  return found ? cards.map((item) => (item.id === card.id ? card : item)) : [...cards, card]
}

function without(cards: readonly Card[], id: string): Card[] {
  return cards.filter((item) => item.id !== id)
}

export function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'data/loaded':
      return {
        boot: { phase: 'ready' },
        boardCards: action.boardCards,
        archiveCards: action.archiveCards,
        theme: action.theme,
      }
    case 'data/read_failed':
      return { ...state, boot: { phase: 'read_failed', failure: action.failure } }
    case 'data/lists_replaced':
      return { ...state, boardCards: action.boardCards, archiveCards: action.archiveCards }
    case 'data/card_added':
      return { ...state, boardCards: upsert(state.boardCards, action.card) }
    case 'data/card_replaced': {
      // 카드가 들어 있는 목록에서 바꾼다. 어느 목록에도 없으면 보관 여부로 목록을 정한다.
      const inArchive = state.archiveCards.some((card) => card.id === action.card.id)
      const archived =
        inArchive || (action.card.archivedAt !== null && !state.boardCards.some((c) => c.id === action.card.id))
      return archived
        ? { ...state, archiveCards: upsert(state.archiveCards, action.card) }
        : { ...state, boardCards: upsert(state.boardCards, action.card) }
    }
    case 'data/card_archived':
      return {
        ...state,
        boardCards: without(state.boardCards, action.card.id),
        archiveCards: upsert(state.archiveCards, action.card),
      }
    case 'data/card_deleted':
      return {
        ...state,
        boardCards: without(state.boardCards, action.id),
        archiveCards: without(state.archiveCards, action.id),
      }
    case 'data/theme_set':
      return { ...state, theme: action.theme }
  }
}

/** patch 의 undefined 는 그 조건을 지운다. 빈 문자열 검색어는 그대로 담고, 걸러내기는 buildBoardModel 이 한다. */
function mergeConditions(current: Conditions, patch: Conditions): Conditions {
  const merged: Conditions = { ...current }
  for (const key of ['text', 'kind', 'priority'] as const) {
    if (!(key in patch)) continue
    if (patch[key] === undefined) delete merged[key]
    else Object.assign(merged, { [key]: patch[key] })
  }
  return merged
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'ui/screen_set':
      return { ...state, screen: action.screen }
    case 'ui/conditions_changed':
      return { ...state, [action.scope]: mergeConditions(state[action.scope], action.patch) }
    case 'ui/conditions_cleared':
      return { ...state, [action.scope]: {} }
    case 'ui/calendar_mode_set':
      return { ...state, calendar: { ...state.calendar, mode: action.mode } }
    case 'ui/calendar_anchor_set':
      return { ...state, calendar: { ...state.calendar, anchor: action.anchor } }
    case 'ui/dialog_opened':
      return { ...state, dialog: action.dialog }
    case 'ui/dialog_closed':
      return { ...state, dialog: null }
  }
}

/** 요청 수와 마지막 결과로 status 를 정한다. 읽기 실패로 잠긴 동안은 unavailable 을 유지한다. */
function settle(state: SaveState, next: Omit<SaveState, 'status'>): SaveState {
  if (state.status === 'unavailable') return { ...next, status: 'unavailable' }
  if (next.pending > 0) return { ...next, status: 'saving' }
  return { ...next, status: next.lastOutcome === 'ok' ? 'saved' : 'failed' }
}

export function saveReducer(state: SaveState, action: SaveAction): SaveState {
  const finished = Math.max(0, state.pending - 1)
  switch (action.type) {
    case 'save/started':
      return settle(state, { ...state, pending: state.pending + 1 })
    case 'save/succeeded':
      return settle(state, { pending: finished, lastOutcome: 'ok', failedRequest: null, error: null })
    case 'save/failed':
      return settle(state, {
        pending: finished,
        lastOutcome: 'failed',
        failedRequest: action.request,
        error: action.error,
      })
    case 'save/ended':
      return settle(state, { ...state, pending: finished })
    case 'save/locked':
      return { ...state, status: 'unavailable', pending: finished }
    case 'save/reset':
      return initialSaveState()
  }
}
