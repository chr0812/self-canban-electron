import { describe, expect, test, vi } from 'vitest'
import { createChangeRunner } from '../../../src/renderer/src/state/change-runner'
import { dataReducer, initialSaveState, saveReducer } from '../../../src/renderer/src/state/reducers'
import { isDataAction, isSaveAction } from '../../../src/renderer/src/state/state-types'
import type { Action, DataState, SaveState } from '../../../src/renderer/src/state/state-types'
import type { DeleteCardValue, KanbanApi } from '../../../src/shared/types/api'
import type { Card, Settings } from '../../../src/shared/types/card'
import type { AppError, ReadFailure, Result, StoreStatus } from '../../../src/shared/types/result'
import { BASE_INSTANT, makeCard } from '../support/builders'

// 호출마다 응답을 시험이 정하고 보류할 수 있는 가짜 KanbanApi 와, reducer 를 그대로 쓰는 작은 상태 저장소.

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void }

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value })
const fail = (code: AppError['code'], details?: unknown): Result<never> => ({
  ok: false,
  error: { code, message: `${code} 시험 오류`, details },
})

const CARD_A = makeCard({ id: 'A', title: '카드 A', status: 'todo' })
const CARD_B = makeCard({ id: 'B', title: '카드 B', status: 'done' })
const CARD_C = makeCard({ id: 'C', title: '카드 C', status: 'done', archivedAt: BASE_INSTANT })

const READ_FAILURE: ReadFailure = {
  code: 'JSON_PARSE_FAILED',
  message: '읽지 못함',
  dataFilePath: '/data/kanban-data.json',
  backupPath: '/data/kanban-data.json.bak',
  preMigrationCopies: [],
  backup: 'absent',
}

function makeApi() {
  return {
    store: {
      getStatus: vi.fn<KanbanApi['store']['getStatus']>(),
      retryOpen: vi.fn<KanbanApi['store']['retryOpen']>(),
    },
    cards: {
      list: vi.fn<KanbanApi['cards']['list']>(),
      get: vi.fn<KanbanApi['cards']['get']>(),
      create: vi.fn<KanbanApi['cards']['create']>(),
      update: vi.fn<KanbanApi['cards']['update']>(),
      changeStatus: vi.fn<KanbanApi['cards']['changeStatus']>(),
      archive: vi.fn<KanbanApi['cards']['archive']>(),
      delete: vi.fn<KanbanApi['cards']['delete']>(),
    },
    progress: { add: vi.fn<KanbanApi['progress']['add']>() },
    settings: {
      get: vi.fn<KanbanApi['settings']['get']>(),
      setTheme: vi.fn<KanbanApi['settings']['setTheme']>(),
    },
  }
}

function setup() {
  const api = makeApi()
  let data: DataState = {
    boot: { phase: 'ready' },
    boardCards: [CARD_A, CARD_B],
    archiveCards: [CARD_C],
    theme: 'dark',
  }
  let save: SaveState = initialSaveState()
  const actions: Action[] = []
  const dispatch = (action: Action): void => {
    actions.push(action)
    if (isDataAction(action)) data = dataReducer(data, action)
    else if (isSaveAction(action)) save = saveReducer(save, action)
  }
  const runner = createChangeRunner({ api, getData: () => data, getSave: () => save, dispatch })
  const board = (id: string): Card | undefined => data.boardCards.find((card) => card.id === id)
  const archived = (id: string): Card | undefined => data.archiveCards.find((card) => card.id === id)
  return { api, runner, actions, data: () => data, save: () => save, board, archived }
}

describe('저장 성공 뒤에만 화면 사본이 바뀐다', () => {
  test('TC-144 칸 이동·보관·삭제는 저장 성공 결과를 받은 뒤에만 화면 사본이 바뀐다', async () => {
    const t = setup()

    // A 를 진행 중으로 옮긴다: 응답을 보류한 동안 화면은 그대로, 저장 중
    const move = deferred<Result<Card>>()
    t.api.cards.changeStatus.mockReturnValueOnce(move.promise)
    const movePromise = t.runner.moveCard('A', 'in_progress')
    expect(t.api.cards.changeStatus).toHaveBeenCalledTimes(1) // 쌓지 않고 즉시 보냈다
    expect(t.api.cards.changeStatus).toHaveBeenCalledWith('A', 'in_progress')
    expect(t.save()).toMatchObject({ status: 'saving', pending: 1 })
    expect(t.board('A')?.status).toBe('todo')
    move.resolve(ok({ ...CARD_A, status: 'in_progress' }))
    await movePromise
    expect(t.board('A')?.status).toBe('in_progress')
    expect(t.save()).toMatchObject({ status: 'saved', pending: 0 })

    // B 를 보관한다
    const archive = deferred<Result<Card>>()
    t.api.cards.archive.mockReturnValueOnce(archive.promise)
    const archivePromise = t.runner.archiveCard('B')
    expect(t.api.cards.archive).toHaveBeenCalledTimes(1)
    expect(t.save().status).toBe('saving')
    expect(t.board('B')).toBeDefined()
    expect(t.archived('B')).toBeUndefined()
    archive.resolve(ok({ ...CARD_B, archivedAt: BASE_INSTANT }))
    await archivePromise
    expect(t.board('B')).toBeUndefined()
    expect(t.archived('B')?.archivedAt).toBe(BASE_INSTANT)
    expect(t.save().status).toBe('saved')

    // 보관된 C 를 삭제한다 (AC-040)
    const remove = deferred<Result<DeleteCardValue>>()
    t.api.cards.delete.mockReturnValueOnce(remove.promise)
    const removePromise = t.runner.deleteCard('C')
    expect(t.api.cards.delete).toHaveBeenCalledTimes(1)
    expect(t.save().status).toBe('saving')
    expect(t.archived('C')).toBeDefined()
    remove.resolve(ok({ deletedCardId: 'C', deletedProgressCount: 2 }))
    await removePromise
    expect(t.archived('C')).toBeUndefined()
    expect(t.save().status).toBe('saved')

    // 가짜 API 는 호출마다 한 번씩만 불렸고, 목록을 다시 받지 않았다
    expect(t.api.cards.changeStatus).toHaveBeenCalledTimes(1)
    expect(t.api.cards.archive).toHaveBeenCalledTimes(1)
    expect(t.api.cards.delete).toHaveBeenCalledTimes(1)
    expect(t.api.cards.list).not.toHaveBeenCalled()
  })

  test('같은 칸으로 옮기면 아무것도 보내지 않고, 만들기·수정·기록 추가도 성공 뒤에 반영된다', async () => {
    const t = setup()
    const same = await t.runner.moveCard('A', 'todo')
    expect(same).toEqual({ ok: true, value: CARD_A })
    expect(t.api.cards.changeStatus).not.toHaveBeenCalled()
    expect(t.save().status).toBe('saved')

    const created = makeCard({ id: 'N', title: '새 카드' })
    t.api.cards.create.mockResolvedValueOnce(ok(created))
    await t.runner.createCard({ title: '새 카드' })
    expect(t.board('N')).toEqual(created)

    t.api.cards.update.mockResolvedValueOnce(ok({ ...CARD_A, title: '고침' }))
    await t.runner.updateCard('A', { title: '고침' })
    expect(t.board('A')?.title).toBe('고침')

    const entry = { id: 'e1', cardId: 'A', content: '진행', statusAtTime: 'todo' as const, createdAt: BASE_INSTANT }
    t.api.progress.add.mockResolvedValueOnce(ok(entry))
    const added = await t.runner.addProgress('A', '진행')
    expect(added).toEqual(ok(entry))
    expect(t.api.progress.add).toHaveBeenCalledWith('A', { content: '진행' })
    expect(t.save()).toMatchObject({ status: 'saved', pending: 0 })
  })
})

describe('마감일 변경 (캘린더 끌기)', () => {
  test('TC-161 moveDueDate 는 성공 뒤에만 사본이 바뀌고, 실패하면 불변이며 다시 저장이 같은 요청을 다시 보낸다', async () => {
    const t = setup()
    const before = t.data()

    // 성공: 응답을 보류한 동안 화면은 그대로, 저장 중. cards.update(id, { dueDate }) 한 번.
    const pending = deferred<Result<Card>>()
    t.api.cards.update.mockReturnValueOnce(pending.promise)
    const movePromise = t.runner.moveDueDate('A', '2026-11-20')
    expect(t.api.cards.update).toHaveBeenCalledTimes(1)
    expect(t.api.cards.update).toHaveBeenCalledWith('A', { dueDate: '2026-11-20' })
    expect(t.save()).toMatchObject({ status: 'saving', pending: 1 })
    expect(t.data()).toEqual(before)
    expect(t.board('A')?.dueDate).toBe(CARD_A.dueDate)
    pending.resolve(ok({ ...CARD_A, dueDate: '2026-11-20' }))
    const done = await movePromise
    expect(done.ok).toBe(true)
    expect(t.board('A')?.dueDate).toBe('2026-11-20')
    expect(t.save()).toMatchObject({ status: 'saved', pending: 0 })

    // 실패: 사본 불변, 같은 요청 한 건을 기억
    const afterSuccess = t.data()
    t.api.cards.update.mockResolvedValueOnce(fail('SAVE_FAILED', { stage: 'replace' }))
    const failed = await t.runner.moveDueDate('A', '2026-11-25')
    expect(failed.ok).toBe(false)
    expect(t.data()).toEqual(afterSuccess)
    expect(t.board('A')?.dueDate).toBe('2026-11-20')
    expect(t.save()).toMatchObject({
      status: 'failed',
      failedRequest: { kind: 'moveDueDate', id: 'A', dueDate: '2026-11-25' },
    })

    // 다시 저장: 같은 인자로 다시 보내고, 성공하면 사본이 바뀐다
    t.api.cards.update.mockResolvedValueOnce(ok({ ...CARD_A, dueDate: '2026-11-25' }))
    const retried = await t.runner.retryFailed()
    expect(retried?.ok).toBe(true)
    expect(t.api.cards.update).toHaveBeenCalledTimes(3)
    expect(t.api.cards.update).toHaveBeenNthCalledWith(2, 'A', { dueDate: '2026-11-25' })
    expect(t.api.cards.update).toHaveBeenNthCalledWith(3, 'A', { dueDate: '2026-11-25' })
    expect(t.board('A')?.dueDate).toBe('2026-11-25')
    expect(t.save()).toMatchObject({ status: 'saved', failedRequest: null })
    expect(t.api.cards.changeStatus).not.toHaveBeenCalled()
    expect(t.api.cards.list).not.toHaveBeenCalled()
  })
})

describe('저장 실패', () => {
  test('TC-145 저장에 실패하면 화면 사본은 그대로이고 다시 저장이 실패한 요청 한 건을 그대로 다시 보낸다', async () => {
    const t = setup()
    const before = t.data()

    t.api.cards.changeStatus.mockResolvedValueOnce(fail('SAVE_FAILED', { stage: 'replace' }))
    await t.runner.moveCard('A', 'in_progress')
    expect(t.data()).toEqual(before)
    expect(t.board('A')?.status).toBe('todo')
    expect(t.save()).toMatchObject({
      status: 'failed',
      failedRequest: { kind: 'moveCard', id: 'A', status: 'in_progress' },
    })

    t.api.cards.delete.mockResolvedValueOnce(fail('SAVE_FAILED', { stage: 'sync' }))
    await t.runner.deleteCard('C')
    expect(t.data()).toEqual(before)
    expect(t.archived('C')).toBeDefined()
    expect(t.save()).toMatchObject({ status: 'failed', failedRequest: { kind: 'deleteCard', id: 'C' } })

    // 다시 저장: 마지막으로 실패한 요청(C 삭제) 한 건만, 같은 인자로
    t.api.cards.delete.mockResolvedValueOnce(ok({ deletedCardId: 'C', deletedProgressCount: 0 }))
    const retried = await t.runner.retryFailed()
    expect(retried?.ok).toBe(true)
    expect(t.api.cards.delete).toHaveBeenCalledTimes(2)
    expect(t.api.cards.delete).toHaveBeenNthCalledWith(1, 'C')
    expect(t.api.cards.delete).toHaveBeenNthCalledWith(2, 'C')
    expect(t.archived('C')).toBeUndefined()
    expect(t.save()).toMatchObject({ status: 'saved', failedRequest: null })
    expect(t.api.cards.changeStatus).toHaveBeenCalledTimes(1) // A 의 이동은 다시 보내지 않았다
    expect(t.board('A')?.status).toBe('todo')
  })

  test('다시 보낼 요청이 없으면 retryFailed 는 아무것도 보내지 않는다', async () => {
    const t = setup()
    expect(await t.runner.retryFailed()).toBeNull()
    expect(t.api.cards.changeStatus).not.toHaveBeenCalled()
  })

  test('호출이 예외로 실패하면 INTERNAL 로 바꿔 실패로 기억하고 화면은 그대로다', async () => {
    const t = setup()
    const before = t.data()
    t.api.cards.archive.mockRejectedValueOnce(new Error('프레임 거절'))
    const result = await t.runner.archiveCard('B')
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL', message: '프레임 거절' } })
    expect(t.data()).toEqual(before)
    expect(t.save()).toMatchObject({ status: 'failed', failedRequest: { kind: 'archiveCard', id: 'B' } })
  })

  test('검증 실패는 Result 로 돌려주고 저장 실패로 기억하지 않는다', async () => {
    const t = setup()
    const failure = fail('VALIDATION_FAILED', { violations: [{ field: 'title', reason: 'REQUIRED' }] })
    t.api.cards.update.mockResolvedValueOnce(failure)
    const result = await t.runner.updateCard('A', { title: '' })
    expect(result).toEqual(failure)
    expect(t.save()).toMatchObject({ status: 'saved', pending: 0, failedRequest: null })
  })
})

describe('화면 사본이 오래되어 나는 오류와 읽기 실패', () => {
  test('TC-146 화면 사본이 오래되어 나는 도메인 오류는 목록을 다시 받아 사본만 맞추고 읽기 잠금은 읽기 실패 상태로 보낸다', async () => {
    const t = setup()
    const freshBoard = [
      makeCard({ id: 'A', status: 'in_progress' }),
      makeCard({ id: 'D', title: '다른 곳에서 만든 카드' }),
    ]
    const freshArchive = [CARD_C, CARD_B]
    t.api.cards.list.mockImplementation((query) =>
      Promise.resolve(ok(query.scope === 'board' ? freshBoard : freshArchive)),
    )

    const cases: Array<[string, () => Promise<Result<unknown>>]> = [
      [
        'CARD_NOT_FOUND',
        () => (t.api.cards.changeStatus.mockResolvedValueOnce(fail('CARD_NOT_FOUND')), t.runner.moveCard('A', 'done')),
      ],
      [
        'ARCHIVE_NOT_ALLOWED',
        () => (
          t.api.cards.archive.mockResolvedValueOnce(fail('ARCHIVE_NOT_ALLOWED', { status: 'in_progress' })),
          t.runner.archiveCard('A')
        ),
      ],
      [
        'CARD_ARCHIVED',
        () => (
          t.api.cards.update.mockResolvedValueOnce(fail('CARD_ARCHIVED')),
          t.runner.updateCard('C', { memo: 'x' })
        ),
      ],
    ]
    for (const [code, send] of cases) {
      t.api.cards.list.mockClear()
      const result = await send()
      expect(result.ok, code).toBe(false)
      expect(t.api.cards.list, code).toHaveBeenCalledWith({ scope: 'board' })
      expect(t.api.cards.list, code).toHaveBeenCalledWith({ scope: 'archive' })
      expect(t.data().boardCards, code).toEqual(freshBoard)
      expect(t.data().archiveCards, code).toEqual(freshArchive)
      expect(t.save(), code).toMatchObject({ status: 'saved', pending: 0, failedRequest: null })
    }

    // 읽기 잠금: 읽기 실패 정보를 받아 데이터 상태가 읽기 실패로 바뀐다
    t.api.cards.create.mockResolvedValueOnce(fail('STORE_LOCKED'))
    t.api.store.getStatus.mockResolvedValueOnce({ state: 'read_failed', failure: READ_FAILURE })
    const locked = await t.runner.createCard({ title: '새 카드' })
    expect(locked.ok).toBe(false)
    expect(t.api.store.getStatus).toHaveBeenCalledTimes(1)
    expect(t.data().boot).toEqual({ phase: 'read_failed', failure: READ_FAILURE })
    expect(t.save()).toMatchObject({ status: 'unavailable', pending: 0 })
  })

  test('STORE_LOCKED 인데 읽기 실패 정보를 받지 못하면(INTERNAL 모양·예외) 다시 보낼 수 있는 실패로 둔다', async () => {
    // T-023 은 getStatus 의 프레임 거절·예외를 INTERNAL Result 모양으로 돌려준다 (BI-002).
    const internalShaped = { ok: false, error: { code: 'INTERNAL', message: 'x' } } as unknown as StoreStatus
    for (const status of [internalShaped, new Error('끊김')]) {
      const t = setup()
      t.api.cards.delete.mockResolvedValueOnce(fail('STORE_LOCKED'))
      if (status instanceof Error) t.api.store.getStatus.mockRejectedValueOnce(status)
      else t.api.store.getStatus.mockResolvedValueOnce(status)
      await t.runner.deleteCard('C')
      expect(t.data().boot).toEqual({ phase: 'ready' })
      expect(t.archived('C')).toBeDefined()
      expect(t.save()).toMatchObject({ status: 'failed', failedRequest: { kind: 'deleteCard', id: 'C' } })
    }
  })
})

describe('판 전환', () => {
  test('TC-147 판 전환만 낙관적으로 먼저 반영되고 저장에 실패해도 되돌리지 않는다', async () => {
    const t = setup()
    expect(t.data().theme).toBe('dark')

    const first = deferred<Result<Settings>>()
    t.api.settings.setTheme.mockReturnValueOnce(first.promise)
    const promise = t.runner.setTheme('light')
    expect(t.api.settings.setTheme).toHaveBeenCalledTimes(1)
    expect(t.api.settings.setTheme).toHaveBeenCalledWith('light')
    expect(t.data().theme).toBe('light') // 응답 전에 이미 바뀌었다
    expect(t.save().status).toBe('saving')

    first.resolve(fail('SAVE_FAILED', { stage: 'verify' }))
    await promise
    expect(t.data().theme).toBe('light') // 되돌리지 않는다
    expect(t.save()).toMatchObject({ status: 'failed', failedRequest: { kind: 'setTheme', theme: 'light' } })

    t.api.settings.setTheme.mockResolvedValueOnce(ok({ theme: 'light' }))
    await t.runner.retryFailed()
    expect(t.api.settings.setTheme).toHaveBeenCalledTimes(2)
    expect(t.api.settings.setTheme).toHaveBeenNthCalledWith(2, 'light')
    expect(t.data().theme).toBe('light')
    expect(t.save()).toMatchObject({ status: 'saved', failedRequest: null })
  })
})
