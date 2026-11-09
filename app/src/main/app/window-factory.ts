// BrowserWindow 생성과 보안 기본값, 렌더러 종료·로드 실패 처리 (docs/05-design/05-architecture.md WindowFactory).
// preload 파일 경로와 renderer 진입은 AppLifecycle 이 import.meta.dirname 으로 만들어 넘긴다.

import { app, BrowserWindow, dialog } from 'electron'
import { THEME_ARGUMENT_PREFIX } from '../../shared/constants'
import type { Theme } from '../../shared/types/card'

/** 창 바탕색. renderer 의 tokens.css `bg-app` 값과 같다. 값이 바뀌면 두 곳을 함께 고친다. */
export const WINDOW_BACKGROUND_DARK = '#1F1814'
export const WINDOW_BACKGROUND_LIGHT = '#FAF3EE'

const WINDOW_WIDTH = 1280
// 920: 5주인 달의 월 보기 캘린더가 스크롤 없이 보이는 높이의 설계 기본값 (AC-048, 04-ui-spec 월 보기 높이 계산표, 결정 필요 12). 실측으로 확정한다.
const WINDOW_HEIGHT = 920
const WINDOW_MIN_WIDTH = 1200
const WINDOW_MIN_HEIGHT = 700

/** 이동이 다른 이동으로 바뀌며 취소된 로드 (ERR_ABORTED). 실패로 보지 않는다. */
const ERR_ABORTED = -3

export type RendererEntry = { kind: 'file'; path: string } | { kind: 'url'; url: string }

export type CreateMainWindowOptions = {
  initialTheme: Theme
  preloadPath: string
  rendererEntry: RendererEntry
}

export function backgroundColorFor(theme: Theme): string {
  return theme === 'light' ? WINDOW_BACKGROUND_LIGHT : WINDOW_BACKGROUND_DARK
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    show: false,
    backgroundColor: backgroundColorFor(options.initialTheme),
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      additionalArguments: [`${THEME_ARGUMENT_PREFIX}${options.initialTheme}`],
    },
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  // 빈 창을 그냥 두지 않는다 (FE-007). 저장은 before-quit 에서 줄을 비운 뒤 끝난다.
  let failed = false
  const fail = (title: string, detail: Record<string, unknown>): void => {
    console.error(`[window] ${title}`, detail)
    if (failed) return
    failed = true
    dialog.showErrorBox(app.getName(), `${title}\n\n${JSON.stringify(detail, null, 2)}`)
    app.quit()
  }

  win.webContents.on('render-process-gone', (_event, details) => {
    // 정상 종료(clean-exit)는 창을 닫는 평소 흐름이라 오류로 보지 않는다.
    if (details.reason === 'clean-exit') return
    fail('화면 프로세스가 종료되었습니다.', { reason: details.reason, exitCode: details.exitCode })
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === ERR_ABORTED) return
    fail('화면을 불러오지 못했습니다.', { errorCode, errorDescription, validatedURL })
  })

  const entry = options.rendererEntry
  const loading = entry.kind === 'file' ? win.loadFile(entry.path) : win.loadURL(entry.url)
  loading.catch((error: unknown) => {
    // 로드 실패는 did-fail-load 가 처리한다. 그 밖의 거부는 여기서 남긴다.
    console.error('[window] load rejected', error)
  })

  return win
}
