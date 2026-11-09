import { describe, expect, test } from 'vitest'
import { DEFAULT_THEME } from '../../../src/shared/constants'
import {
  dataReducer,
  initialDataState,
  initialSaveState,
  initialUiState,
  saveReducer,
  uiReducer,
} from '../../../src/renderer/src/state/reducers'
import type { ChangeRequest, DataState, SaveState } from '../../../src/renderer/src/state/state-types'
import type { AppError } from '../../../src/shared/types/result'
import { BASE_INSTANT, makeCard } from '../support/builders'

const CARD_A = makeCard({ id: 'a', title: '할 일 카드', status: 'todo' })
const CARD_B = makeCard({ id: 'b', title: '완료 카드', status: 'done' })
const CARD_C = makeCard({ id: 'c', title: '보관된 카드', status: 'done', archivedAt: BASE_INSTANT })

function readyData(): DataState {
  return { boot: { phase: 'ready' }, boardCards: [CARD_A, CARD_B], archiveCards: [CARD_C], theme: 'dark' }
}

const SAVE_ERROR: AppError = { code: 'SAVE_FAILED', message: '저장 실패', details: { stage: 'replace' } }
const MOVE_A: ChangeRequest = { kind: 'moveCard', id: 'a', status: 'in_progress' }

/** 상태 객체가 reducer 안에서 바뀌지 않았는지 보려고 깊이 얼린다. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

describe('initialDataState', () => {
  test('TC-143 초기 DataState 의 판은 기본 판 light(DEFAULT_THEME)다 (AC-038)', () => {
    expect(DEFAULT_THEME).toBe('light')
    const initial = initialDataState()
    expect(initial.theme).toBe(DEFAULT_THEME)
    expect(initial.theme).toBe('light')
    expect(initial).toMatchObject({ boot: { phase: 'loading' }, boardCards: [], archiveCards: [] })
  })
})

describe('saveReducer', () => {
  test('TC-143 요청 시작마다 진행 중 요청 수가 늘고 0이 되었을 때 마지막 요청이 성공이면 saved 다', () => {
    const initial = deepFreeze(initialSaveState())
    expect(initial).toMatchObject({ status: 'saved', pending: 0 })

    const one = saveReducer(initial, { type: 'save/started' })
    const two = saveReducer(one, { type: 'save/started' })
    expect(one).toMatchObject({ status: 'saving', pending: 1 })
    expect(two).toMatchObject({ status: 'saving', pending: 2 })
    expect(initial.pending).toBe(0) // 입력 객체는 그대로

    const afterFirst = saveReducer(two, { type: 'save/succeeded' })
    expect(afterFirst).toMatchObject({ status: 'saving', pending: 1 })
    const afterSecond = saveReducer(afterFirst, { type: 'save/succeeded' })
    expect(afterSecond).toMatchObject({ status: 'saved', pending: 0, failedRequest: null })
  })

  test('TC-143 요청 수가 0이 되었을 때 마지막 요청이 실패면 failed 와 다시 보낼 요청 한 건을 갖는다', () => {
    const started = deepFreeze(
      saveReducer(saveReducer(initialSaveState(), { type: 'save/started' }), { type: 'save/started' }),
    )
    const succeeded = saveReducer(started, { type: 'save/succeeded' })
    // 실패가 아직 끝나지 않은 다른 요청이 있으면 saving 이다
    const midFailed = saveReducer(started, { type: 'save/failed', request: MOVE_A, error: SAVE_ERROR })
    expect(midFailed).toMatchObject({ status: 'saving', pending: 1, failedRequest: MOVE_A })

    const failed: SaveState = saveReducer(succeeded, { type: 'save/failed', request: MOVE_A, error: SAVE_ERROR })
    expect(failed).toMatchObject({ status: 'failed', pending: 0, failedRequest: MOVE_A, error: SAVE_ERROR })
    expect(succeeded.failedRequest).toBeNull()

    // 실패 뒤 다시 보내는 중에는 saving, 성공하면 saved 이고 다시 보낼 요청이 없어진다
    const retrying = saveReducer(failed, { type: 'save/started' })
    expect(retrying).toMatchObject({ status: 'saving', pending: 1 })
    expect(saveReducer(retrying, { type: 'save/succeeded' })).toMatchObject({ status: 'saved', failedRequest: null })

    // 검증 실패처럼 결과와 무관하게 끝난 요청은 직전 결과(failed)를 바꾸지 않는다
    const ended = saveReducer(saveReducer(failed, { type: 'save/started' }), { type: 'save/ended' })
    expect(ended).toMatchObject({ status: 'failed', failedRequest: MOVE_A })
  })

  test('읽기 실패로 잠기면 reset 전까지 unavailable 을 유지한다', () => {
    const started = saveReducer(initialSaveState(), { type: 'save/started' })
    const locked = saveReducer(started, { type: 'save/locked' })
    expect(locked).toMatchObject({ status: 'unavailable', pending: 0 })
    const again = saveReducer(saveReducer(locked, { type: 'save/started' }), { type: 'save/succeeded' })
    expect(again.status).toBe('unavailable')
    expect(saveReducer(again, { type: 'save/reset' })).toEqual(initialSaveState())
  })
})

describe('dataReducer', () => {
  test('TC-143 상태를 바꾼 카드로 교체하면 그 카드만 바뀌고 입력 상태는 그대로다', () => {
    const state = deepFreeze(readyData())
    const moved = { ...CARD_A, status: 'in_progress' as const }
    const next = dataReducer(state, { type: 'data/card_replaced', card: moved })

    expect(next.boardCards.map((c) => [c.id, c.status])).toEqual([
      ['a', 'in_progress'],
      ['b', 'done'],
    ])
    expect(next.boardCards[1]).toBe(CARD_B) // 교체하지 않은 카드는 같은 객체
    expect(next.archiveCards).toBe(state.archiveCards)
    expect(next).not.toBe(state)
    expect(state.boardCards[0]).toBe(CARD_A)
  })

  test('TC-143 카드를 삭제하면 목록에서 사라진다', () => {
    const state = deepFreeze(readyData())
    const fromBoard = dataReducer(state, { type: 'data/card_deleted', id: 'a' })
    expect(fromBoard.boardCards.map((c) => c.id)).toEqual(['b'])
    expect(fromBoard.archiveCards.map((c) => c.id)).toEqual(['c'])

    const fromArchive = dataReducer(state, { type: 'data/card_deleted', id: 'c' })
    expect(fromArchive.boardCards.map((c) => c.id)).toEqual(['a', 'b'])
    expect(fromArchive.archiveCards).toEqual([])
    expect(state.archiveCards).toHaveLength(1)
  })

  test('TC-143 보관하면 보드 목록에서 빠지고 보관함 목록에 들어간다', () => {
    const state = deepFreeze(readyData())
    const archived = { ...CARD_B, archivedAt: BASE_INSTANT }
    const next = dataReducer(state, { type: 'data/card_archived', card: archived })

    expect(next.boardCards.map((c) => c.id)).toEqual(['a'])
    expect(next.archiveCards.map((c) => c.id)).toEqual(['c', 'b'])
    expect(next.archiveCards[1]).toBe(archived)
    expect(state.boardCards).toHaveLength(2)
  })

  test('카드를 만들면 보드 목록에 더해지고, 판·읽기 실패·목록 교체가 반영된다', () => {
    const state = deepFreeze(readyData())
    const created = makeCard({ id: 'n' })
    expect(dataReducer(state, { type: 'data/card_added', card: created }).boardCards.map((c) => c.id)).toEqual([
      'a',
      'b',
      'n',
    ])
    expect(dataReducer(state, { type: 'data/theme_set', theme: 'light' }).theme).toBe('light')

    const failure = {
      code: 'JSON_PARSE_FAILED' as const,
      message: 'x',
      dataFilePath: '/d.json',
      backupPath: '/d.bak',
      preMigrationCopies: [],
      backup: 'absent' as const,
    }
    expect(dataReducer(state, { type: 'data/read_failed', failure }).boot).toEqual({ phase: 'read_failed', failure })
    const replaced = dataReducer(state, { type: 'data/lists_replaced', boardCards: [CARD_B], archiveCards: [] })
    expect(replaced.boardCards).toEqual([CARD_B])
    expect(replaced.archiveCards).toEqual([])
  })
})

describe('uiReducer', () => {
  test('TC-143 검색어와 종류 조건을 담고 모두 지우면 빈 조건이 된다', () => {
    const initial = deepFreeze(initialUiState('2026-11-04'))
    expect(initial.board).toEqual({})

    const withText = uiReducer(initial, { type: 'ui/conditions_changed', scope: 'board', patch: { text: '세금' } })
    const withKind = uiReducer(withText, { type: 'ui/conditions_changed', scope: 'board', patch: { kind: 'bug' } })
    expect(withKind.board).toEqual({ text: '세금', kind: 'bug' })
    expect(withKind.archive).toEqual({}) // 보관함 조건은 따로다
    expect(initial.board).toEqual({})

    const cleared = uiReducer(withKind, { type: 'ui/conditions_cleared', scope: 'board' })
    expect(cleared.board).toEqual({})
    expect(withKind.board).toEqual({ text: '세금', kind: 'bug' })
  })

  test('조건 하나만 지우거나 화면·캘린더·대화상자를 바꾼다', () => {
    const initial = initialUiState('2026-11-04')
    const two = uiReducer(initial, {
      type: 'ui/conditions_changed',
      scope: 'archive',
      patch: { text: 'a', priority: 'high' },
    })
    expect(
      uiReducer(two, { type: 'ui/conditions_changed', scope: 'archive', patch: { text: undefined } }).archive,
    ).toEqual({
      priority: 'high',
    })

    expect(initial).toMatchObject({ screen: 'board', calendar: { mode: 'month', anchor: '2026-11-04' }, dialog: null })
    expect(uiReducer(initial, { type: 'ui/screen_set', screen: 'calendar' }).screen).toBe('calendar')
    expect(uiReducer(initial, { type: 'ui/calendar_mode_set', mode: 'week' }).calendar.mode).toBe('week')
    expect(uiReducer(initial, { type: 'ui/calendar_anchor_set', anchor: '2026-12-01' }).calendar.anchor).toBe(
      '2026-12-01',
    )
    const opened = uiReducer(initial, { type: 'ui/dialog_opened', dialog: { mode: 'edit', cardId: 'a' } })
    expect(opened.dialog).toEqual({ mode: 'edit', cardId: 'a' })
    expect(uiReducer(opened, { type: 'ui/dialog_closed' }).dialog).toBeNull()
  })
})
