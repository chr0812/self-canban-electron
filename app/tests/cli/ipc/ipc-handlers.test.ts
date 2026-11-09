import type * as Fs from 'node:fs'
import type * as FsPromises from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KanbanStore } from '../../../src/main/store/store-types'
import type { Card } from '../../../src/shared/types/card'
import { IPC_CHANNELS } from '../../../src/shared/ipc-contract'
import { makeCard } from '../support/builders'

// electron 모듈 대역: ipcMain.handle 로 등록된 핸들러를 모아 두고 시험이 직접 부른다.
type RegisteredHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>
const hoisted = vi.hoisted(() => ({
  handlers: new Map<string, unknown>(),
  fileWrites: [] as string[],
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: unknown) => {
      hoisted.handlers.set(channel, handler)
    },
  },
}))

// 파일 쓰기 대역: 쓰기 계열 함수가 불리면 기록한다 (TC-141 은 로그 파일을 만들지 않음을 확인한다).
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  return {
    ...actual,
    writeFile: (...args: Parameters<typeof actual.writeFile>) => {
      hoisted.fileWrites.push(`writeFile ${String(args[0])}`)
      return actual.writeFile(...args)
    },
    appendFile: (...args: Parameters<typeof actual.appendFile>) => {
      hoisted.fileWrites.push(`appendFile ${String(args[0])}`)
      return actual.appendFile(...args)
    },
  }
})
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof Fs>()
  return {
    ...actual,
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      hoisted.fileWrites.push(`writeFileSync ${String(args[0])}`)
      return actual.writeFileSync(...args)
    },
    appendFileSync: (...args: Parameters<typeof actual.appendFileSync>) => {
      hoisted.fileWrites.push(`appendFileSync ${String(args[0])}`)
      return actual.appendFileSync(...args)
    },
    createWriteStream: (...args: Parameters<typeof actual.createWriteStream>) => {
      hoisted.fileWrites.push(`createWriteStream ${String(args[0])}`)
      return actual.createWriteStream(...args)
    },
  }
})

import { registerIpcHandlers } from '../../../src/main/app/ipc-handlers'

const APP_PREFIX = 'file:///C:/app/out/renderer/'
const APP_FRAME = { url: 'file:///C:/app/out/renderer/index.html' }
const appEvent = { senderFrame: APP_FRAME }

const CHANNEL_LIST = IPC_CHANNELS['cards.list']
const CHANNEL_CREATE = IPC_CHANNELS['cards.create']

function callChannel(channel: string, event: unknown, ...args: unknown[]): Promise<unknown> {
  const handler = hoisted.handlers.get(channel) as RegisteredHandler | undefined
  if (handler === undefined) throw new Error(`등록되지 않은 채널: ${channel}`)
  return handler(event, ...args)
}

type StoreMocks = { [K in keyof KanbanStore]: ReturnType<typeof vi.fn> }

/** 호출 기록이 있는 저장소 대역. 각 메서드의 기본 동작은 성공 값을 돌려주는 것이다. */
function makeStore(overrides: Partial<StoreMocks> = {}): { store: KanbanStore; mocks: StoreMocks } {
  const card: Card = makeCard()
  const readyStatus = { state: 'ready', firstRun: false, recoveredFromBackup: false, migratedFromVersion: null }
  const mocks: StoreMocks = {
    open: vi.fn(async () => readyStatus),
    getStatus: vi.fn(() => readyStatus),
    retryOpen: vi.fn(async () => readyStatus),
    list: vi.fn(() => ({ ok: true, value: [card] })),
    get: vi.fn(() => ({ ok: true, value: { card, progressEntries: [] } })),
    create: vi.fn(async () => ({ ok: true, value: card })),
    update: vi.fn(async () => ({ ok: true, value: card })),
    changeStatus: vi.fn(async () => ({ ok: true, value: card })),
    archive: vi.fn(async () => ({ ok: true, value: card })),
    delete: vi.fn(async () => ({ ok: true, value: { deletedCardId: card.id, deletedProgressCount: 0 } })),
    addProgress: vi.fn(async () => ({ ok: true, value: {} })),
    getSettings: vi.fn(() => ({ ok: true, value: { theme: 'dark' } })),
    setTheme: vi.fn(async () => ({ ok: true, value: { theme: 'light' } })),
    close: vi.fn(async () => undefined),
    ...overrides,
  }
  return { store: mocks as unknown as KanbanStore, mocks }
}

function totalStoreCalls(mocks: StoreMocks): number {
  return Object.values(mocks).reduce((sum, fn) => sum + fn.mock.calls.length, 0)
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** 마이크로태스크를 충분히 흘려보낸다. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  hoisted.handlers.clear()
  hoisted.fileWrites.length = 0
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('IpcHandlers', () => {
  it('TC-065 번들 폴더 안 프레임만 처리하고 밖의 file: 주소와 외부 주소 프레임은 거절하며 등록된 채널은 열두 개뿐이다', async () => {
    const { store, mocks } = makeStore()
    registerIpcHandlers(store, { appUrlPrefix: APP_PREFIX })

    // 등록된 채널은 IPC_CHANNELS 열두 개뿐이다.
    expect(hoisted.handlers.size).toBe(12)
    expect([...hoisted.handlers.keys()].sort()).toEqual(Object.values(IPC_CHANNELS).sort())

    // 번들 폴더 안 주소의 프레임은 처리된다.
    const accepted = await callChannel(CHANNEL_LIST, appEvent, { archived: false })
    expect(accepted).toEqual({ ok: true, value: [makeCard()] })
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(mocks.list).toHaveBeenCalledWith({ archived: false })

    // 거절될 프레임들. 준비 조건: 저장소 호출 기록이 실제로 한 번만 쌓여 있다.
    expect(totalStoreCalls(mocks)).toBe(1)
    const rejectedFrames: Array<[string, unknown]> = [
      ['번들 폴더 밖의 file: 주소', { senderFrame: { url: 'file:///C:/app/out/other/index.html' } }],
      ['이름만 비슷한 이웃 폴더', { senderFrame: { url: 'file:///C:/app/out/renderer-evil/index.html' } }],
      ['`..` 로 번들 폴더를 벗어난 주소', { senderFrame: { url: 'file:///C:/app/out/renderer/../secret.html' } }],
      ['외부 https 주소', { senderFrame: { url: 'https://example.com/' } }],
      ['주소를 읽을 수 없는 프레임', { senderFrame: { url: 'not a url' } }],
      ['이미 사라진 프레임(senderFrame null)', { senderFrame: null }],
    ]
    for (const [label, event] of rejectedFrames) {
      const result = (await callChannel(CHANNEL_LIST, event, { archived: false })) as {
        ok: boolean
        error?: { code: string }
      }
      expect(result.ok, label).toBe(false)
      expect(result.error?.code, label).toBe('INTERNAL')
    }
    // 거절된 호출은 저장소 호출을 일으키지 않는다.
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(totalStoreCalls(mocks)).toBe(1)

    // 데이터를 바꾸는 채널도 같은 규칙이다.
    const externalCreate = (await callChannel(
      CHANNEL_CREATE,
      { senderFrame: { url: 'https://example.com/' } },
      { title: 'x' },
    )) as { ok: boolean }
    expect(externalCreate.ok).toBe(false)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('TC-065 열두 채널이 각각 알맞은 저장소 메서드를 부른다', async () => {
    const { store, mocks } = makeStore()
    registerIpcHandlers(store, { appUrlPrefix: APP_PREFIX })
    expect(hoisted.handlers.size).toBe(12)

    await callChannel(IPC_CHANNELS['store.getStatus'], appEvent)
    await callChannel(IPC_CHANNELS['store.retryOpen'], appEvent)
    await callChannel(IPC_CHANNELS['cards.list'], appEvent, { q: 1 })
    await callChannel(IPC_CHANNELS['cards.get'], appEvent, 'c1')
    await callChannel(IPC_CHANNELS['cards.create'], appEvent, { title: 't' })
    await callChannel(IPC_CHANNELS['cards.update'], appEvent, 'c1', { title: 'u' })
    await callChannel(IPC_CHANNELS['cards.changeStatus'], appEvent, 'c1', 'done')
    await callChannel(IPC_CHANNELS['cards.archive'], appEvent, 'c1')
    await callChannel(IPC_CHANNELS['cards.delete'], appEvent, 'c1')
    await callChannel(IPC_CHANNELS['progress.add'], appEvent, 'c1', { content: 'p' })
    await callChannel(IPC_CHANNELS['settings.get'], appEvent)
    await callChannel(IPC_CHANNELS['settings.setTheme'], appEvent, 'light')

    expect(mocks.getStatus).toHaveBeenCalledWith()
    expect(mocks.retryOpen).toHaveBeenCalledWith()
    expect(mocks.list).toHaveBeenCalledWith({ q: 1 })
    expect(mocks.get).toHaveBeenCalledWith('c1')
    expect(mocks.create).toHaveBeenCalledWith({ title: 't' })
    expect(mocks.update).toHaveBeenCalledWith('c1', { title: 'u' })
    expect(mocks.changeStatus).toHaveBeenCalledWith('c1', 'done')
    expect(mocks.archive).toHaveBeenCalledWith('c1')
    expect(mocks.delete).toHaveBeenCalledWith('c1')
    expect(mocks.addProgress).toHaveBeenCalledWith('c1', { content: 'p' })
    expect(mocks.getSettings).toHaveBeenCalledWith()
    expect(mocks.setTheme).toHaveBeenCalledWith('light')
    expect(totalStoreCalls(mocks)).toBe(12)
  })

  it('TC-066 저장소가 예상하지 못한 오류를 던져도 핸들러는 던지지 않고 INTERNAL을 돌려준다', async () => {
    const thrower = vi.fn(async () => {
      throw new Error('예상하지 못한 오류')
    })
    const { store, mocks } = makeStore({ create: thrower })
    registerIpcHandlers(store, { appUrlPrefix: APP_PREFIX })

    // 준비 조건: 대역이 실제로 불리고 던진다.
    const result = (await callChannel(CHANNEL_CREATE, appEvent, { title: '새 카드' })) as {
      ok: boolean
      error?: { code: string; message: string }
    }
    expect(thrower).toHaveBeenCalledTimes(1)

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INTERNAL')
    expect(result.error?.message).toContain('예상하지 못한 오류')
    // 데이터를 바꾸는 다른 저장소 호출이 추가로 일어나지 않는다 (다시 시도하지 않는다).
    expect(totalStoreCalls(mocks)).toBe(1)
  })

  it('TC-141 예상하지 못한 오류가 INTERNAL이 될 때 채널 이름, 메시지, 스택이 콘솔에 기록되고 파일은 쓰지 않는다', async () => {
    const boom = new Error('boom')
    const { store, mocks } = makeStore({
      create: vi.fn(async () => {
        throw boom
      }),
      list: vi.fn(() => {
        throw boom
      }),
    })
    registerIpcHandlers(store, { appUrlPrefix: APP_PREFIX })
    expect(boom.stack).toBeTypeOf('string')

    const created = (await callChannel(CHANNEL_CREATE, appEvent, { title: 'x' })) as {
      ok: boolean
      error?: { code: string; message: string }
    }
    // 변경 채널 한 번의 호출만으로 콘솔 기록이 한 번 이상 생긴다.
    expect(mocks.create).toHaveBeenCalledTimes(1)
    const callsAfterCreate = errorSpy.mock.calls.length
    expect(callsAfterCreate).toBeGreaterThanOrEqual(1)

    const listed = (await callChannel(CHANNEL_LIST, appEvent, { archived: false })) as {
      ok: boolean
      error?: { code: string; message: string }
    }
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls.length).toBeGreaterThan(callsAfterCreate)

    for (const result of [created, listed]) {
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('INTERNAL')
      expect(result.error?.message).toContain('boom')
    }

    const logOf = (calls: unknown[][]): string => calls.map((args) => args.map((a) => String(a)).join(' ')).join('\n')
    const createLog = logOf(errorSpy.mock.calls.slice(0, callsAfterCreate))
    const listLog = logOf(errorSpy.mock.calls.slice(callsAfterCreate))
    expect(createLog).toContain(CHANNEL_CREATE)
    expect(listLog).toContain(CHANNEL_LIST)
    for (const log of [createLog, listLog]) {
      expect(log).toContain('boom')
      expect(log).toContain(boom.stack as string)
    }

    // 로그 파일을 만들지 않는다.
    expect(hoisted.fileWrites).toEqual([])
  })

  it('TC-142 whenIdle은 요청이 없으면 즉시 이행되고 처리 중인 요청이 끝난 뒤에 이행되며 이후 도착한 요청은 기다리지 않는다', async () => {
    const first = deferred<unknown>()
    const second = deferred<unknown>()
    const pending = [first, second]
    const create = vi.fn(() => pending[create.mock.calls.length - 1]!.promise)
    const { store } = makeStore({ create })
    const handlers = registerIpcHandlers(store, { appUrlPrefix: APP_PREFIX })
    const ok = { ok: true, value: makeCard() }

    // 1. 요청이 없으면 즉시 이행된다.
    let idle0 = false
    void handlers.whenIdle().then(() => {
      idle0 = true
    })
    await flush()
    expect(idle0).toBe(true)

    // 2. 끝나지 않은 요청이 있으면 이행되지 않는다.
    const request1 = callChannel(CHANNEL_CREATE, appEvent, { title: '하나' })
    expect(create).toHaveBeenCalledTimes(1) // 준비 조건: 요청이 실제로 처리 중이다.
    let idle1 = false
    const idlePromise1 = handlers.whenIdle().then(() => {
      idle1 = true
    })
    await flush()
    expect(idle1).toBe(false)

    // 3. whenIdle() 뒤에 도착한 요청은 기다리지 않는다.
    const request2 = callChannel(CHANNEL_CREATE, appEvent, { title: '둘' })
    expect(create).toHaveBeenCalledTimes(2)
    await flush()
    expect(idle1).toBe(false)

    // 4. 첫 요청이 끝나면 whenIdle() 이 이행된다. 둘째 요청은 아직 끝나지 않았다.
    first.resolve(ok)
    await request1
    await idlePromise1
    expect(idle1).toBe(true)

    // 5. 둘째 요청이 끝난 뒤 새로 부른 whenIdle() 도 이행된다.
    let idle2 = false
    const idlePromise2 = handlers.whenIdle().then(() => {
      idle2 = true
    })
    await flush()
    expect(idle2).toBe(false)
    second.resolve(ok)
    await request2
    await idlePromise2
    expect(idle2).toBe(true)
  })

  it('TC-142 처리 중 요청이 INTERNAL로 끝나도 whenIdle은 이행된다', async () => {
    const gate = deferred<unknown>()
    const { store } = makeStore({
      create: vi.fn(async () => {
        await gate.promise
        throw new Error('늦은 오류')
      }),
    })
    const handlers = registerIpcHandlers(store, { appUrlPrefix: APP_PREFIX })

    const request = callChannel(CHANNEL_CREATE, appEvent, { title: 'x' })
    let idle = false
    const idlePromise = handlers.whenIdle().then(() => {
      idle = true
    })
    await flush()
    expect(idle).toBe(false)

    gate.resolve(undefined)
    expect(((await request) as { ok: boolean }).ok).toBe(false)
    await idlePromise
    expect(idle).toBe(true)
  })
})
