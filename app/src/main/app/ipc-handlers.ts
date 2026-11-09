// IPC 채널 등록, 호출 프레임 확인, 예외 경계, 처리 중 요청 대기 (docs/05-design/05-architecture.md IpcHandlers).
// 예상하지 못한 예외를 잡는 유일한 경계다. 그 밖의 모듈은 예외를 Result 로 바꿔 돌려준다.

import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-contract'
import type { IpcChannelKey } from '../../shared/ipc-contract'
import { fail } from '../../shared/domain/rule-support'
import type { CardCreateInput, CardPatch, CardQuery, ProgressInput, Status, Theme } from '../../shared/types/card'
import type { KanbanStore } from '../store/store-types'

export type IpcHandlerOptions = {
  /** 호출을 받아들일 프레임 주소 접두사. NetworkGuard 의 앱 번들 폴더 접두사와 같은 값이다 (RK-008). */
  appUrlPrefix: string
}

export type IpcHandlers = {
  /**
   * 호출 시점에 이미 받은 요청이 모두 끝나면 이행된다 (창 닫기 대기, NFR-002).
   * 호출한 뒤 새로 도착하는 요청은 기다리지 않는다. 요청이 없으면 바로 이행된다.
   */
  whenIdle(): Promise<void>
}

/**
 * 화면에서 온 인자는 믿지 않는다. 타입 이름은 KanbanStore 시그니처를 맞추려는 것이고,
 * 값의 검증은 KanbanStore(CardRules)가 한다.
 */
type Handler = (store: KanbanStore, args: unknown[]) => unknown

const HANDLERS: Record<IpcChannelKey, Handler> = {
  'store.getStatus': (store) => store.getStatus(),
  'store.retryOpen': (store) => store.retryOpen(),
  'cards.list': (store, a) => store.list(a[0] as CardQuery),
  'cards.get': (store, a) => store.get(a[0] as string),
  'cards.create': (store, a) => store.create(a[0] as CardCreateInput),
  'cards.update': (store, a) => store.update(a[0] as string, a[1] as CardPatch),
  'cards.changeStatus': (store, a) => store.changeStatus(a[0] as string, a[1] as Status),
  'cards.archive': (store, a) => store.archive(a[0] as string),
  'cards.delete': (store, a) => store.delete(a[0] as string),
  'progress.add': (store, a) => store.addProgress(a[0] as string, a[1] as ProgressInput),
  'settings.get': (store) => store.getSettings(),
  'settings.setTheme': (store, a) => store.setTheme(a[0] as Theme),
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/** Windows 의 file: 주소는 대소문자를 가리지 않아 file: 만 소문자로 맞춰 비교한다 (NetworkGuard 와 같은 규칙). */
function normalize(url: URL): string {
  return url.protocol === 'file:' ? url.href.toLowerCase() : url.href
}

/** 접두사를 한 번만 정리한다. 끝에 `/`가 없으면 붙여 `renderer-evil` 같은 이웃 폴더가 접두사에 걸리지 않게 한다. */
function prepareAllowedPrefix(raw: string): string | null {
  const url = parseUrl(raw)
  if (url === null) return null
  url.hash = ''
  url.search = ''
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`
  return normalize(url)
}

function isAppFrame(event: IpcMainInvokeEvent, prefix: string | null): boolean {
  if (prefix === null) return false
  // senderFrame 은 프레임이 이미 사라졌으면 null 이다. 확인할 수 없으면 거절한다.
  const frameUrl = event.senderFrame?.url
  if (typeof frameUrl !== 'string') return false
  const url = parseUrl(frameUrl)
  if (url === null) return false
  return normalize(url).startsWith(prefix)
}

function describeError(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) return { message: error.message, stack: error.stack ?? '(스택 없음)' }
  return { message: String(error), stack: '(스택 없음)' }
}

/** INTERNAL 을 만들면서 채널 이름·message·stack 을 main 콘솔에 남긴다. 로그 파일은 만들지 않는다 (FE-007, RK-012). */
function internalError(channel: string, error: unknown) {
  const { message, stack } = describeError(error)
  console.error(`[ipc] INTERNAL 채널=${channel} message=${message}\n${stack}`)
  return fail('INTERNAL', `${channel} 처리 중 예상하지 못한 오류: ${message}`)
}

/**
 * IPC_CHANNELS 의 열두 채널만 등록한다.
 * 호출 프레임이 앱 주소가 아니면 저장소를 부르지 않고 INTERNAL 로 거절한다.
 */
export function registerIpcHandlers(store: KanbanStore, options: IpcHandlerOptions): IpcHandlers {
  const prefix = prepareAllowedPrefix(options.appUrlPrefix)
  const inFlight = new Set<Promise<void>>()

  const run = async (channel: string, handler: Handler, event: IpcMainInvokeEvent, args: unknown[]) => {
    if (!isAppFrame(event, prefix)) {
      console.error(`[ipc] 거절 채널=${channel} 앱 주소가 아닌 프레임: ${String(event.senderFrame?.url)}`)
      return fail('INTERNAL', `${channel}: 앱 화면이 아닌 프레임의 호출은 처리하지 않는다`)
    }
    try {
      return await handler(store, args)
    } catch (error) {
      return internalError(channel, error)
    }
  }

  for (const key of Object.keys(HANDLERS) as IpcChannelKey[]) {
    const channel = IPC_CHANNELS[key]
    const handler = HANDLERS[key]
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      // 저장소 호출은 run 안에서 동기로 시작하므로, 요청은 도착한 즉시 센다.
      const request = run(channel, handler, event, args)
      const tracked: Promise<void> = request.then(
        () => undefined,
        () => undefined,
      )
      inFlight.add(tracked)
      void tracked.then(() => inFlight.delete(tracked))
      return request
    })
  }

  return {
    whenIdle() {
      // 지금 있는 요청만 기다린다. 이 뒤에 도착하는 요청은 목록에 없다.
      return Promise.all([...inFlight]).then(() => undefined)
    },
  }
}
