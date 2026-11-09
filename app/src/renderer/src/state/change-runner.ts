import { useMemo, useRef } from 'react'
import type { DeleteCardValue, KanbanApi } from '@shared/types/api'
import type { Card, CardCreateInput, CardPatch, DateString, ProgressEntry, Status, Theme } from '@shared/types/card'
import type { AppError, Result, StoreStatus } from '@shared/types/result'
import { useData, useDispatch, useSaveState } from './app-state'
import type { Action, ChangeRequest, DataState, SaveState } from './state-types'

// 화면의 모든 변경 호출을 한 곳에서 실행한다 (ChangeRunner).
// - 변경을 renderer 에 쌓지 않고 즉시 보내 결과를 기다린다. 순서는 IPC 와 main 의 줄이 지킨다 (RK-002).
// - 판 전환(setTheme)만 낙관적이다. 나머지는 ok: true 를 받은 뒤에만 화면 사본(DataState)을 바꾼다.
// - SAVE_FAILED 면 화면은 그대로이고 실패한 요청 한 건을 SaveState 에 기억한다 (retryFailed 가 그대로 다시 보낸다).
// - 롤백과 쌓아 둔 변경 처리는 없다. 화면 사본과 저장소가 같기 때문이다.

export type ChangeRunnerDeps = {
  /** 호출 대상. 시험은 가짜를 넣고, 화면은 window.kanban 을 넣는다. window 를 읽지 않는다. */
  api: KanbanApi
  /** 호출 시점의 화면 사본 (같은 칸 이동 확인에 쓴다). */
  getData: () => DataState
  /** 다시 보낼 요청(failedRequest)을 읽는다. */
  getSave: () => SaveState
  dispatch: (action: Action) => void
}

export type ChangeRunner = {
  createCard(input: CardCreateInput): Promise<Result<Card>>
  updateCard(id: string, patch: CardPatch): Promise<Result<Card>>
  /** 같은 칸이면 아무것도 보내지 않고 지금 카드를 돌려준다. */
  moveCard(id: string, status: Status): Promise<Result<Card>>
  /** 캘린더 끌기: cards.update(id, { dueDate }) 한 번. 성공 뒤에만 사본을 바꾼다. 같은 날짜 판단은 호출하는 쪽 몫. */
  moveDueDate(id: string, dueDate: DateString): Promise<Result<Card>>
  archiveCard(id: string): Promise<Result<Card>>
  deleteCard(id: string): Promise<Result<DeleteCardValue>>
  addProgress(cardId: string, content: string): Promise<Result<ProgressEntry>>
  setTheme(theme: Theme): Promise<Result<unknown>>
  /** 마지막으로 실패한 요청 한 건을 같은 인자로 다시 보낸다. 다시 보낼 것이 없으면 null. */
  retryFailed(): Promise<Result<unknown> | null>
}

function internalError(message: string): Result<never> {
  return { ok: false, error: { code: 'INTERNAL', message } }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function isResult(value: unknown): value is Result<unknown> {
  if (typeof value !== 'object' || value === null) return false
  const { ok } = value as { ok?: unknown }
  return ok === true || (ok === false && typeof (value as { error?: unknown }).error === 'object')
}

export function createChangeRunner({ api, getData, getSave, dispatch }: ChangeRunnerDeps): ChangeRunner {
  function call(request: ChangeRequest): Promise<Result<unknown>> {
    switch (request.kind) {
      case 'createCard':
        return api.cards.create(request.input)
      case 'updateCard':
        return api.cards.update(request.id, request.patch)
      case 'moveCard':
        return api.cards.changeStatus(request.id, request.status)
      case 'moveDueDate':
        return api.cards.update(request.id, { dueDate: request.dueDate })
      case 'archiveCard':
        return api.cards.archive(request.id)
      case 'deleteCard':
        return api.cards.delete(request.id)
      case 'addProgress':
        return api.progress.add(request.cardId, request.input)
      case 'setTheme':
        return api.settings.setTheme(request.theme)
    }
  }

  /** 호출이 거절되거나 예외로 실패해도 Result 로 돌려준다 (IPC 자체 실패는 INTERNAL). */
  async function send(request: ChangeRequest): Promise<Result<unknown>> {
    try {
      const result: unknown = await call(request)
      return isResult(result) ? result : internalError('응답 모양이 Result 가 아닙니다')
    } catch (cause) {
      return internalError(describe(cause))
    }
  }

  /** 저장이 성공한 뒤에만 부른다. 반환된 값으로 화면 사본을 바꾼다. */
  function applySuccess(request: ChangeRequest, value: unknown): void {
    switch (request.kind) {
      case 'createCard':
        dispatch({ type: 'data/card_added', card: value as Card })
        return
      case 'updateCard':
      case 'moveCard':
      case 'moveDueDate':
        dispatch({ type: 'data/card_replaced', card: value as Card })
        return
      case 'archiveCard':
        dispatch({ type: 'data/card_archived', card: value as Card })
        return
      case 'deleteCard':
        dispatch({ type: 'data/card_deleted', id: (value as DeleteCardValue).deletedCardId })
        return
      case 'addProgress':
      case 'setTheme':
        return // 화면 사본에 바꿀 것이 없다 (판은 이미 바뀌어 있다)
    }
  }

  /** 화면 사본이 오래된 것이므로 main 의 목록을 다시 받아 사본만 맞춘다. 받지 못하면 사본은 그대로다. */
  async function resync(): Promise<void> {
    try {
      const [board, archive] = await Promise.all([
        api.cards.list({ scope: 'board' }),
        api.cards.list({ scope: 'archive' }),
      ])
      if (board.ok && archive.ok) {
        dispatch({ type: 'data/lists_replaced', boardCards: board.value, archiveCards: archive.value })
      }
    } catch {
      // 목록을 못 받으면 사본은 그대로 둔다.
    }
  }

  /** STORE_LOCKED: 읽기 실패 정보를 받아 읽기 실패 상태로 보낸다. 받지 못하면 다시 보낼 수 있는 실패로 둔다. */
  async function lockOut(request: ChangeRequest, error: AppError): Promise<void> {
    try {
      // 프레임 거절 등으로 StoreStatus 가 아닌 모양(INTERNAL Result)이 올 수 있어 state 를 직접 확인한다.
      const status = (await api.store.getStatus()) as StoreStatus | null | undefined
      if (status?.state === 'read_failed') {
        dispatch({ type: 'data/read_failed', failure: status.failure })
        dispatch({ type: 'save/locked' })
        return
      }
    } catch {
      // 아래에서 일반 실패로 처리한다.
    }
    dispatch({ type: 'save/failed', request, error })
  }

  async function handleError(request: ChangeRequest, error: AppError): Promise<void> {
    switch (error.code) {
      case 'SAVE_FAILED':
      case 'INTERNAL':
        dispatch({ type: 'save/failed', request, error })
        return
      case 'CARD_NOT_FOUND':
      case 'CARD_ARCHIVED':
      case 'ARCHIVE_NOT_ALLOWED':
        await resync()
        dispatch({ type: 'save/ended' })
        return
      case 'STORE_LOCKED':
        await lockOut(request, error)
        return
      case 'VALIDATION_FAILED':
        dispatch({ type: 'save/ended' }) // 호출한 쪽이 Result 의 violations 를 입력칸에 붙인다
        return
    }
  }

  async function run(request: ChangeRequest): Promise<Result<unknown>> {
    dispatch({ type: 'save/started' })
    const result = await send(request)
    if (result.ok) {
      applySuccess(request, result.value)
      dispatch({ type: 'save/succeeded' })
    } else {
      await handleError(request, result.error)
    }
    return result
  }

  return {
    createCard: (input) => run({ kind: 'createCard', input }) as Promise<Result<Card>>,
    updateCard: (id, patch) => run({ kind: 'updateCard', id, patch }) as Promise<Result<Card>>,
    moveCard: (id, status) => {
      const current = getData().boardCards.find((card) => card.id === id)
      if (current !== undefined && current.status === status) return Promise.resolve({ ok: true, value: current })
      return run({ kind: 'moveCard', id, status }) as Promise<Result<Card>>
    },
    moveDueDate: (id, dueDate) => run({ kind: 'moveDueDate', id, dueDate }) as Promise<Result<Card>>,
    archiveCard: (id) => run({ kind: 'archiveCard', id }) as Promise<Result<Card>>,
    deleteCard: (id) => run({ kind: 'deleteCard', id }) as Promise<Result<DeleteCardValue>>,
    addProgress: (cardId, content) =>
      run({ kind: 'addProgress', cardId, input: { content } }) as Promise<Result<ProgressEntry>>,
    setTheme: (theme) => {
      dispatch({ type: 'data/theme_set', theme }) // 판 전환만 응답 전에 먼저 반영한다 (UC-011)
      return run({ kind: 'setTheme', theme })
    },
    retryFailed: () => {
      const { status, failedRequest } = getSave()
      if (failedRequest === null || status === 'unavailable') return Promise.resolve(null)
      return run(failedRequest)
    },
  }
}

/** 화면이 쓰는 변경 함수들. window.kanban 을 createChangeRunner 에 넘긴다. */
export function useChanges(): ChangeRunner {
  const data = useData()
  const save = useSaveState()
  const dispatch = useDispatch()
  // 실행기는 한 번만 만들고, 읽을 때마다 가장 나중에 그려진 상태를 본다.
  const latest = useRef({ data, save })
  latest.current = { data, save }
  return useMemo(
    () =>
      createChangeRunner({
        api: window.kanban,
        getData: () => latest.current.data,
        getSave: () => latest.current.save,
        dispatch,
      }),
    [dispatch],
  )
}
