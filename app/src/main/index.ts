// main 진입: 조립 지점 (docs/05-design/05-architecture.md AppLifecycle).
// 순서: 데이터 폴더 고정(app.ready 전) -> 폴더 만들기 -> 저장소 열기 -> 외부 요청 차단 -> IPC 등록 -> 창 생성.
// autoUpdater, 원격 분석, 충돌 보고, 단일 실행 잠금을 쓰지 않는다 (NFR-001). 시험 전용 분기를 두지 않는다 (ADR-012).

import { join } from 'node:path'
import { app, dialog, session } from 'electron'
import type { BrowserWindow } from 'electron'
import { DEFAULT_THEME } from '../shared/constants'
import type { Theme } from '../shared/types/card'
import { lockWindowNavigation, installNetworkGuard, restrictChromiumNetwork } from './app/network-guard'
import { registerIpcHandlers } from './app/ipc-handlers'
import type { IpcHandlers } from './app/ipc-handlers'
import { createMainWindow } from './app/window-factory'
import { dataFolderName } from './store/data-file-names'
import { createKanbanStore } from './store/kanban-store'
import { createNodeFileSystem, ensureDirectory } from './store/node-file-system'
import type { KanbanStore } from './store/store-types'

/** electron-vite dev 가 넣는 개발 서버 주소. 있으면 개발 실행이다 (없으면 loadFile). */
const devServerUrl = process.env['ELECTRON_RENDERER_URL']
const isDevServer = devServerUrl !== undefined && devServerUrl !== ''

// ⓪ app.ready 전: 데이터 폴더 고정. --user-data-dir 이 주어지면 건드리지 않는다 (시험이 임시 폴더를 준다).
// 폴더 이름은 표시용 앱 이름이 아닌 상수라서 앱 이름을 바꿔도 데이터 위치가 바뀌지 않는다 (RK-004).
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), dataFolderName(app.isPackaged)))
}

// Chromium 자체의 요청 줄이기 (RK-007). app.ready 전에 불러야 한다.
restrictChromiumNetwork(app, { dev: isDevServer })

let store: KanbanStore | null = null
let ipc: IpcHandlers | null = null
/** before-quit 에서 저장 대기를 마친 뒤 true. 이 뒤의 종료는 막지 않는다. */
let quitApproved = false
let quitting = false

function describe(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error)
}

// 예상하지 못한 오류 (FE-007). 핸들러를 등록하면 Electron 기본 오류 창이 뜨지 않아 직접 알린다. 앱을 끝내지 않는다.
process.on('uncaughtException', (error) => {
  console.error('[main] uncaughtException', error)
  dialog.showErrorBox(app.getName(), `예상하지 못한 오류가 발생했습니다.\n\n${describe(error)}`)
})
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection', reason)
})

/** 창 close: 이미 받은 요청이 모두 끝난 뒤에 닫는다 (NFR-002). 닫기를 한 번 미루고 다시 닫는다. */
function deferCloseUntilIdle(win: BrowserWindow, handlers: IpcHandlers): void {
  let waiting = false
  let approved = false
  win.on('close', (event) => {
    if (approved) return
    event.preventDefault()
    if (waiting) return
    waiting = true
    handlers
      .whenIdle()
      .catch((error: unknown) => {
        console.error('[main] whenIdle failed', error)
      })
      .finally(() => {
        approved = true
        if (!win.isDestroyed()) win.close()
      })
  })
}

async function startup(): Promise<void> {
  const dataDir = app.getPath('userData')
  await ensureDirectory(dataDir)

  const kanbanStore = createKanbanStore({
    dataDir,
    fs: createNodeFileSystem(),
    clock: () => new Date(),
    newId: () => crypto.randomUUID(),
    processId: process.pid,
  })
  store = kanbanStore
  await kanbanStore.open()

  // 앱 번들 폴더(out/renderer/)의 주소 접두사. 빌드 결과 out/main/index.js 기준이다 (RK-008).
  const bundlePrefix = new URL('../renderer/', import.meta.url).href
  const allowedPrefixes = isDevServer ? [bundlePrefix, devServerUrl] : [bundlePrefix]
  installNetworkGuard(session.defaultSession, { allowedPrefixes, dev: isDevServer })

  // 개발 실행의 화면 주소는 개발 서버라서 IPC 호출 프레임 접두사도 그 주소다.
  ipc = registerIpcHandlers(kanbanStore, { appUrlPrefix: isDevServer ? devServerUrl : bundlePrefix })

  // 저장된 판으로 창을 만든다. 읽기 실패이면 기본 판.
  const settings = kanbanStore.getSettings()
  const initialTheme: Theme = settings.ok ? settings.value.theme : DEFAULT_THEME

  const win = createMainWindow({
    initialTheme,
    preloadPath: join(import.meta.dirname, '../preload/index.cjs'),
    // 포장 실행의 화면도 허용 접두사와 같은 출처(import.meta.url)에서 만든 주소로 연다.
    // loadFile(경로)은 경로의 '%'를 그대로 두지만 접두사는 '%25'로 인코딩되어, 설치 경로에 '%'가 있으면 허용 판정이 어긋난다.
    rendererEntry: { kind: 'url', url: isDevServer ? devServerUrl : new URL('index.html', bundlePrefix).href },
  })
  lockWindowNavigation(win)
  deferCloseUntilIdle(win, ipc)
}

// 창이 모두 닫히면 종료한다 (Windows 전용 앱).
app.on('window-all-closed', () => {
  app.quit()
})

// 정상 종료: 줄 서 있는 저장이 끝난 뒤에 끝낸다 (NFR-002).
app.on('before-quit', (event) => {
  if (quitApproved) return
  event.preventDefault()
  if (quitting) return
  quitting = true
  const waitIdle = ipc === null ? Promise.resolve() : ipc.whenIdle()
  waitIdle
    .then(() => (store === null ? undefined : store.close()))
    .catch((error: unknown) => {
      console.error('[main] 종료 전 저장 대기 실패', error)
    })
    .finally(() => {
      quitApproved = true
      app.quit()
    })
})

app
  .whenReady()
  .then(startup)
  .catch((error: unknown) => {
    console.error('[main] startup failed', error)
    dialog.showErrorBox(app.getName(), `앱을 시작하지 못했습니다.\n\n${describe(error)}`)
    app.quit()
  })
