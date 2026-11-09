// window.kanban 열두 함수 노출과 초기 판 적기 (docs/05-design/05-architecture.md PreloadBridge).
// 각 함수는 ipcRenderer.invoke 한 줄이다. 로직과 검증은 main(IpcHandlers, KanbanStore)에 있다.
// ipcRenderer, 채널 이름, Node 객체는 화면에 노출하지 않는다.

import { contextBridge, ipcRenderer } from 'electron'
import { THEME_ARGUMENT_PREFIX, THEMES } from '../shared/constants'
import { IPC_CHANNELS } from '../shared/ipc-contract'
import type { KanbanApi } from '../shared/types/api'

const api: KanbanApi = {
  store: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS['store.getStatus']),
    retryOpen: () => ipcRenderer.invoke(IPC_CHANNELS['store.retryOpen']),
  },
  cards: {
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS['cards.list'], query),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS['cards.get'], id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS['cards.create'], input),
    update: (id, patch) => ipcRenderer.invoke(IPC_CHANNELS['cards.update'], id, patch),
    changeStatus: (id, status) => ipcRenderer.invoke(IPC_CHANNELS['cards.changeStatus'], id, status),
    archive: (id) => ipcRenderer.invoke(IPC_CHANNELS['cards.archive'], id),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS['cards.delete'], id),
  },
  progress: {
    add: (cardId, input) => ipcRenderer.invoke(IPC_CHANNELS['progress.add'], cardId, input),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS['settings.get']),
    setTheme: (theme) => ipcRenderer.invoke(IPC_CHANNELS['settings.setTheme'], theme),
  },
}

contextBridge.exposeInMainWorld('kanban', api)

// 이 폴더의 tsconfig 는 DOM 타입이 없어 쓰는 부분만 좁게 적는다.
type HtmlElementLike = { setAttribute(name: string, value: string): void }
type DocumentLike = { documentElement: HtmlElementLike | null }
type ObserverLike = { observe(target: unknown, options: { childList: boolean }): void; disconnect(): void }
type DomGlobals = {
  document: DocumentLike
  MutationObserver: new (callback: () => void) => ObserverLike
}

/** main 이 additionalArguments 로 넘긴 초기 판. 없거나 알 수 없는 값이면 null (기본 판은 CSS 의 :root 가 정한다). */
function readInitialTheme(argv: readonly string[]): string | null {
  const argument = argv.find((item) => item.startsWith(THEME_ARGUMENT_PREFIX))
  if (argument === undefined) return null
  const value = argument.slice(THEME_ARGUMENT_PREFIX.length)
  return (THEMES as readonly string[]).includes(value) ? value : null
}

/**
 * <html data-theme> 에 초기 판을 적는다. preload 는 문서 시작 때 실행되어 <html> 이 아직 없을 수 있다.
 * 있으면 바로 적고, 없으면 <html> 이 생기는 즉시 한 번 적고 관찰을 끊는다.
 * 어긋나도 Bootstrap 의 settings.get() 확정이 안전망이다.
 */
function applyInitialTheme(theme: string | null): void {
  if (theme === null) return
  const dom = globalThis as unknown as DomGlobals
  const apply = (): boolean => {
    const root = dom.document.documentElement
    if (root === null) return false
    root.setAttribute('data-theme', theme)
    return true
  }
  if (apply()) return
  const observer = new dom.MutationObserver(() => {
    if (apply()) observer.disconnect()
  })
  observer.observe(dom.document, { childList: true })
}

applyInitialTheme(readInitialTheme(process.argv))
