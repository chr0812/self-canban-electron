import { Component, useEffect, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { KanbanApi } from '@shared/types/api'
import type { StoreStatus } from '@shared/types/result'
import { AppShell } from './layout/AppShell'
import { AppStateProvider, useData, useDispatch } from './state/app-state'
import type { Action } from './state/state-types'
import { applyTheme } from './state/theme-controller'
import { DETAILS_LABEL, LOADING_TEXT, RENDER_ERROR_TEXT, RENDER_ERROR_TITLE, errorText } from './text/labels'
import './styles/tokens.css'
import './styles/base.css'
import './common/common.css'
import './layout/layout.css'

// 렌더러 진입 (Bootstrap, docs/05-design/05-architecture.md).
// 시작 순서: store.getStatus() -> ready 이면 settings.get() 으로 data-theme 확정 -> 보드·보관함 목록 -> AppState 채우기 -> 그린다.
//          read_failed 이면 데이터 호출 없이 읽기 실패 화면(AppShell 이 ReadFailurePanel 로 대체)으로 간다.
// 읽는 중이 200ms 를 넘을 때만 `저장된 카드를 불러오는 중` 을 보인다. 그 전에는 빈 바탕만 있다 (빈 보드를 잠깐 보이지 않는다).
// React 오류 경계 한 개가 AppShell 바깥에서 렌더 오류를 잡는다 (클래스 컴포넌트 금지 규칙의 유일한 예외, FE-007).
// 시작 중 호출이 실패하면(StoreStatus 가 아닌 응답, 예외, 목록 읽기 실패) 같은 오류 경계로 보낸다. 데이터는 바뀌지 않는다.

/** 읽는 중 문구를 보이기까지 기다리는 시간. 이보다 빨리 끝나면 문구를 한 번도 보이지 않는다. */
const LOADING_DELAY_MS = 200

// 오류 경계

interface ErrorBoundaryState {
  error: Error | null
}

class RenderErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[renderer] 화면을 그리지 못했습니다', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children
    return (
      <div className="render-error" role="alert" style={{ padding: 24, maxWidth: 640 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 18, lineHeight: '28px' }}>{RENDER_ERROR_TITLE}</h1>
        <p style={{ margin: '0 0 12px' }}>{RENDER_ERROR_TEXT}</p>
        <details>
          <summary>{DETAILS_LABEL}</summary>
          <p style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{error.message}</p>
        </details>
      </div>
    )
  }
}

// 시작 순서

function isStoreStatus(value: unknown): value is StoreStatus {
  if (typeof value !== 'object' || value === null) return false
  const state = (value as { state?: unknown }).state
  return state === 'ready' || state === 'read_failed'
}

/** 호출 결과가 Result 실패 모양이면 그 오류를 사용자 문구로 바꿔 Error 로 던진다. */
function failure(message: string, cause?: unknown): Error {
  const detail = cause instanceof Error ? cause.message : cause === undefined ? '' : String(cause)
  return new Error(detail === '' ? message : `${message} (${detail})`)
}

/**
 * 시작 순서를 실행한다. 읽기 실패이면 데이터 호출 없이 read_failed 상태로 보낸다.
 * getStatus 의 정상 반환은 StoreStatus 이고, 프레임 거절·예외는 INTERNAL Result 모양으로 올 수 있어 두 모양을 구분한다.
 * ReadFailurePanel 의 retryReading 과 같은 순서(settings -> board -> archive)로 읽는다.
 */
async function bootstrap(api: KanbanApi, dispatch: (action: Action) => void): Promise<void> {
  let status: unknown
  try {
    status = await api.store.getStatus()
  } catch (cause) {
    throw failure(errorText('INTERNAL'), cause)
  }
  if (!isStoreStatus(status)) {
    const message = (status as { error?: { message?: unknown } } | null)?.error?.message
    throw failure(errorText('INTERNAL'), typeof message === 'string' ? message : undefined)
  }
  if (status.state === 'read_failed') {
    dispatch({ type: 'data/read_failed', failure: status.failure })
    dispatch({ type: 'save/locked' })
    return
  }

  const [settings, board, archive] = await Promise.all([
    api.settings.get(),
    api.cards.list({ scope: 'board' }),
    api.cards.list({ scope: 'archive' }),
  ])
  if (!settings.ok) throw failure(errorText(settings.error.code), settings.error.message)
  if (!board.ok) throw failure(errorText(board.error.code), board.error.message)
  if (!archive.ok) throw failure(errorText(archive.error.code), archive.error.message)

  applyTheme(settings.value.theme) // preload 가 적은 값이 어긋났어도 저장된 값이 정본이다 (ADR-008)
  dispatch({
    type: 'data/loaded',
    boardCards: board.value,
    archiveCards: archive.value,
    theme: settings.value.theme,
  })
  dispatch({ type: 'save/reset' })
}

function LoadingNotice() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), LOADING_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null
  return (
    <p className="boot-loading" role="status" style={{ margin: 0, padding: 24, color: 'var(--text-sub)' }}>
      {LOADING_TEXT}
    </p>
  )
}

function Bootstrap() {
  const { boot } = useData()
  const dispatch = useDispatch()
  const [startError, setStartError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true
    bootstrap(window.kanban, dispatch).catch((cause: unknown) => {
      if (alive) setStartError(cause instanceof Error ? cause : new Error(String(cause)))
    })
    return () => {
      alive = false
    }
  }, [dispatch])

  // 시작 실패는 렌더 오류와 같은 안내 화면으로 보낸다 (오류 경계가 console.error 와 자세히를 맡는다).
  if (startError !== null) throw startError
  if (boot.phase === 'loading') return <LoadingNotice />
  return <AppShell />
}

// 렌더 밖의 예상하지 못한 오류는 기록만 한다 (화면을 바꾸지 않는다).
window.addEventListener('error', (event) => {
  console.error('[renderer] error', event.error ?? event.message)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] unhandledrejection', event.reason)
})

const container = document.getElementById('root')
if (container === null) throw new Error('#root 요소가 없습니다')

createRoot(container).render(
  <RenderErrorBoundary>
    <AppStateProvider>
      <Bootstrap />
    </AppStateProvider>
  </RenderErrorBoundary>,
)
