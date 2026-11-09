// KanbanStore 구현: 화면 함수 열두 개 (docs/05-design/03-api-spec.md 저장 모듈 인터페이스, 05-architecture.md KanbanStore).
// 상태는 ready(메모리 문서) 또는 read_failed(원인). 변경은 한 줄로 세워 한 번에 하나씩 처리하고,
// 저장이 성공한 뒤에만 메모리 문서를 새 문서로 바꾼다 (ADR-003). 조회는 줄을 타지 않고 마지막으로 저장된 문서를 읽는다.
// 읽기 실패 상태에서는 모든 호출을 STORE_LOCKED 로 거절하고 파일에 쓰는 포트 동작을 부르지 않는다 (AC-032).

import type { DataFile } from '../../shared/types/card'
import type { DeleteCardValue } from '../../shared/types/api'
import type { Result, StoreStatus } from '../../shared/types/result'
import { archiveCard, changeStatus, createCard, deleteCard, updateCard } from '../../shared/domain/card-rules'
import { getCardDetail, listCards } from '../../shared/domain/card-queries'
import { addProgress } from '../../shared/domain/progress-rules'
import { fail, ok, type RuleContext, type RuleOutcome } from '../../shared/domain/rule-support'
import { getSettings, setTheme } from '../../shared/domain/settings-rules'
import { createDataFileRepository } from './data-file-repository'
import { DATA_FILE_NAME, dataFilePath } from './data-file-names'
import type { KanbanStore, KanbanStoreDeps } from './store-types'

/** createKanbanStore 인자. processId 는 임시 파일 이름용이고 생략하면 process.pid 다 (시험이 고정 값을 줄 수 있다). */
export type KanbanStoreOptions = KanbanStoreDeps & { processId?: number }

/** open 전에는 문서가 없다. */
type State =
  | { kind: 'unopened' }
  | {
      kind: 'ready'
      doc: DataFile
      status: Extract<StoreStatus, { state: 'ready' }>
      migratedFromVersion: number | null
    }
  | { kind: 'read_failed'; status: Extract<StoreStatus, { state: 'read_failed' }> }

const noop = (): void => undefined

export function createKanbanStore(deps: KanbanStoreOptions): KanbanStore {
  const { dataDir, fs, clock, newId } = deps
  const repo = createDataFileRepository({ fs, dataDir, processId: deps.processId ?? process.pid })
  const mainPath = dataFilePath(dataDir, DATA_FILE_NAME)
  const ctx: RuleContext = { now: clock, newId }

  let state: State = { kind: 'unopened' }
  let reading: Promise<StoreStatus> | null = null
  let tail: Promise<unknown> = Promise.resolve()

  const locked = (): Result<never> =>
    fail('STORE_LOCKED', '저장 파일을 읽지 못한 상태라 요청을 처리하지 않는다. 다시 읽기(retryOpen)만 할 수 있다')

  /** 파일을 읽어 상태를 정한다. 읽기만 하고 쓰지 않는다. 동시에 부르면 한 번의 읽기를 함께 기다린다. */
  function load(): Promise<StoreStatus> {
    reading ??= (async (): Promise<StoreStatus> => {
      const outcome = await repo.read()
      if (!outcome.ok) {
        const status: Extract<StoreStatus, { state: 'read_failed' }> = {
          state: 'read_failed',
          failure: outcome.failure,
        }
        state = { kind: 'read_failed', status }
        return status
      }
      const status: Extract<StoreStatus, { state: 'ready' }> = {
        state: 'ready',
        firstRun: outcome.firstRun,
        recoveredFromBackup: outcome.recoveredFromBackup,
        migratedFromVersion: outcome.migratedFromVersion,
      }
      state = { kind: 'ready', doc: outcome.doc, status, migratedFromVersion: outcome.migratedFromVersion }
      return status
    })().finally(() => {
      reading = null
    })
    return reading
  }

  /** 줄 세우기: 앞 작업이 (성공이든 실패든) 끝난 뒤에 실행한다. 앞 작업의 실패가 줄을 멈추지 않는다. */
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = tail.then(job)
    tail = run.then(noop, noop)
    return run
  }

  /** 변경 동작의 공통 순서 (api-spec): 상태 확인 → 규칙(검증·대상·조건) → 저장 → 저장 성공 뒤에만 메모리 교체. */
  function mutate<T>(rule: (doc: DataFile) => RuleOutcome<T>): Promise<Result<T>> {
    return enqueue(async (): Promise<Result<T>> => {
      const current = state
      if (current.kind !== 'ready') return locked()
      const outcome = rule(current.doc)
      if (!outcome.ok) return outcome
      const { next, value, changed } = outcome.value
      if (!changed) return ok(value)

      const saved = await repo.save(next, { migratedFromVersion: current.migratedFromVersion })
      if (!saved.ok) {
        const details =
          saved.osCode === undefined
            ? { stage: saved.stage, dataFilePath: mainPath }
            : { stage: saved.stage, osCode: saved.osCode, dataFilePath: mainPath }
        return fail('SAVE_FAILED', `저장하지 못했다 (${saved.stage})`, details)
      }
      // 이 문서는 이제 현재 버전으로 저장되었으므로 변환 전 사본 복사는 다시 필요 없다.
      state = { ...current, doc: next, migratedFromVersion: null }
      return ok(value)
    })
  }

  /** 조회: 줄을 타지 않고 마지막으로 저장에 성공한 문서를 읽는다. */
  function read<T>(query: (doc: DataFile) => Result<T>): Result<T> {
    return state.kind === 'ready' ? query(state.doc) : locked()
  }

  return {
    open: load,
    getStatus() {
      if (state.kind === 'unopened') throw new Error('open() 을 먼저 불러야 한다')
      return state.status
    },
    retryOpen() {
      // 이미 정상이면 읽지 않고 현재 상태를 돌려준다.
      if (state.kind === 'ready') return Promise.resolve(state.status)
      return load()
    },
    list: (query) => read((doc) => listCards(doc, query)),
    get: (id) => read((doc) => getCardDetail(doc, id)),
    create: (input) => mutate((doc) => createCard(doc, input, ctx)),
    update: (id, patch) => mutate((doc) => updateCard(doc, id, patch, ctx)),
    changeStatus: (id, status) => mutate((doc) => changeStatus(doc, id, status)),
    archive: (id) => mutate((doc) => archiveCard(doc, id, ctx)),
    delete: (id) => mutate<DeleteCardValue>((doc) => deleteCard(doc, id)),
    addProgress: (cardId, input) => mutate((doc) => addProgress(doc, cardId, input, ctx)),
    getSettings: () => read((doc) => getSettings(doc)),
    setTheme: (theme) => mutate((doc) => setTheme(doc, theme)),
    async close() {
      // 기다리는 동안 새로 줄에 들어온 작업까지 끝날 때까지 기다린다.
      let seen: Promise<unknown>
      do {
        seen = tail
        await seen
      } while (seen !== tail)
    },
  }
}
