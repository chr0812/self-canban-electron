import { useId, useRef, useState } from 'react'
import type { KanbanApi } from '@shared/types/api'
import type { ReadFailure, StoreStatus } from '@shared/types/result'
import { Button } from '../../common/Button'
import { Icon } from '../../common/Icon'
import { useDispatch } from '../../state/app-state'
import type { Action } from '../../state/state-types'
import {
  READ_FAILURE_DESCRIPTION,
  READ_FAILURE_RETRY_LABEL,
  READ_FAILURE_TITLE,
  backupStateText,
  errorText,
  manualStepsText,
  preMigrationCopyLine,
  readFailureCauseLine,
  readFailureFileLine,
} from '../../text/labels'
import './load-error.css'

// 읽기 실패 패널 (SCR-001 에러: 읽기 실패, AC-032). 본문 전체를 대체하며 빈 보드와 모양·문구가 다르다.
// 위에서 아래로: 오류 아이콘 + 제목 / 설명 / 안내 줄(읽지 못한 파일, 오류와 OS 코드, 직전 저장본, 변환 전 사본, 수동 절차) / `다시 읽기`.
// 앱 안에는 직전 저장본으로 열거나 파일을 옮기는 동작이 없고, 파일을 지우거나 쓰지 않는다 (사용자 결정 D3).
// 벗어나는 길은 `다시 읽기`(store.retryOpen)뿐이다. retryOpen 은 파일을 읽기만 한다.

export interface ReadFailurePanelProps {
  failure: ReadFailure
}

/**
 * `다시 읽기` 한 번의 결과.
 *  - recovered: 읽기에 성공해 목록과 판을 받아 화면 상태를 정상으로 바꿨다.
 *  - still_failed: 여전히 읽을 수 없다. 최신 ReadFailure 로 패널을 갱신했다.
 *  - error: 호출이나 목록 읽기가 실패했다 (프레임 거절 등 StoreStatus 가 아닌 응답 포함). 패널은 그대로이고 문구만 보인다.
 */
export type RetryOutcome = { kind: 'recovered' } | { kind: 'still_failed' } | { kind: 'error'; message: string }

function isStoreStatus(value: unknown): value is StoreStatus {
  if (typeof value !== 'object' || value === null) return false
  const state = (value as { state?: unknown }).state
  return state === 'ready' || state === 'read_failed'
}

/** 상태를 바꾸는 쪽은 Bootstrap 이므로 이 함수는 Bootstrap 의 데이터 읽기 단계와 같은 순서(settings -> board -> archive)를 따른다. */
export async function retryReading(api: KanbanApi, dispatch: (action: Action) => void): Promise<RetryOutcome> {
  const internal = errorText('INTERNAL')
  let status: unknown
  try {
    // 프레임 거절·예외는 StoreStatus 가 아닌 INTERNAL Result 로 올 수 있다.
    status = await api.store.retryOpen()
  } catch {
    return { kind: 'error', message: internal }
  }
  if (!isStoreStatus(status)) return { kind: 'error', message: internal }
  if (status.state === 'read_failed') {
    dispatch({ type: 'data/read_failed', failure: status.failure })
    return { kind: 'still_failed' }
  }
  try {
    const [settings, board, archive] = await Promise.all([
      api.settings.get(),
      api.cards.list({ scope: 'board' }),
      api.cards.list({ scope: 'archive' }),
    ])
    if (!settings.ok) return { kind: 'error', message: errorText(settings.error.code) }
    if (!board.ok) return { kind: 'error', message: errorText(board.error.code) }
    if (!archive.ok) return { kind: 'error', message: errorText(archive.error.code) }
    dispatch({ type: 'data/loaded', boardCards: board.value, archiveCards: archive.value, theme: settings.value.theme })
    dispatch({ type: 'save/reset' })
    return { kind: 'recovered' }
  } catch {
    return { kind: 'error', message: internal }
  }
}

export function ReadFailurePanel({ failure }: ReadFailurePanelProps) {
  const titleId = useId()
  const dispatch = useDispatch()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inFlight = useRef(false)

  const manualSteps = manualStepsText(failure.backup)

  async function handleRetry(): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setMessage(null)
    try {
      const outcome = await retryReading(window.kanban, dispatch)
      // recovered 이면 AppShell 이 이 패널을 내리므로 상태를 건드리지 않는다.
      if (outcome.kind === 'error') setMessage(outcome.message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <section className="read-failure" aria-labelledby={titleId}>
      <div className="read-failure__panel">
        <div className="read-failure__head">
          <Icon name="error" size={20} />
          <h2 id={titleId} className="read-failure__title">
            {READ_FAILURE_TITLE}
          </h2>
        </div>
        <p className="read-failure__description">{READ_FAILURE_DESCRIPTION}</p>
        <ul className="read-failure__lines">
          <li className="read-failure__path">{readFailureFileLine(failure.dataFilePath)}</li>
          <li>{readFailureCauseLine(failure)}</li>
          <li className="read-failure__path">{backupStateText(failure.backup, failure.backupPath)}</li>
          {failure.preMigrationCopies.map((path) => (
            <li key={path} className="read-failure__path">
              {preMigrationCopyLine(path)}
            </li>
          ))}
          {manualSteps ? <li className="read-failure__steps">{manualSteps}</li> : null}
        </ul>
        <div className="read-failure__actions">
          <Button variant="primary" disabled={busy} onClick={() => void handleRetry()}>
            {READ_FAILURE_RETRY_LABEL}
          </Button>
        </div>
        {message ? (
          <p className="read-failure__message" role="alert">
            <Icon name="error" />
            <span>{message}</span>
          </p>
        ) : null}
      </div>
    </section>
  )
}
