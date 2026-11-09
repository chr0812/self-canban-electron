import { todayLocal } from '@shared/domain/date-rules'
import type { ReactNode } from 'react'
import { Banner } from '../common/Banner'
import { SegmentedControl } from '../common/SegmentedControl'
import type { SegmentedOption } from '../common/SegmentedControl'
import { ArchiveScreen } from '../features/archive/ArchiveScreen'
import { BoardScreen } from '../features/board/BoardScreen'
import { CalendarScreen } from '../features/calendar/CalendarScreen'
import { PeriodNav } from '../features/calendar/PeriodNav'
import { CardDialog } from '../features/card-dialog/CardDialog'
import { ReadFailurePanel } from '../features/load-error/ReadFailurePanel'
import { countDueInMonth } from '../model/calendar-model'
import type { CalendarMode } from '../model/calendar-model'
import { useData, useDispatch, useSaveState, useUi } from '../state/app-state'
import { useChanges } from '../state/change-runner'
import type { ChangeRequest, SaveState } from '../state/state-types'
import { RETRY_SAVE_LABEL, SAVE_FAILED_CARD_TEXT, SAVE_FAILED_THEME_TEXT, errorText } from '../text/labels'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

// 앱 껍데기: 사이드바 + 상단 막대(TopBar) + 알림 줄 + 본문 + 하단 줄 (SCR-001, SCR-003, SCR-004).
// 상단 막대와 하단 줄은 AppShell 이 소유한다. 화면(BoardScreen, CalendarScreen, ArchiveScreen)은 본문만 그린다.
// 캘린더의 기간 이동과 `월 | 주` 분할 버튼은 TopBar 의 children 으로 넣고 UiState.calendar 를 바꾼다.
// 읽기 실패이면 본문 전체를 ReadFailurePanel 로 대체한다 (이동·검색·필터·카드 만들기 비활성은 Sidebar 와 TopBar 가 한다).
// 스타일은 layout.css 이고 앱 진입점(main.tsx)이 한 번 불러온다.

const CALENDAR_MODE_OPTIONS: readonly SegmentedOption<CalendarMode>[] = [
  { value: 'month', label: '월' },
  { value: 'week', label: '주' },
]
const CALENDAR_MODE_LABEL = '보기'

/**
 * 알림 줄에 보일 저장 실패. 칸 이동·마감일 변경(캘린더 끌기, AC-046)·보관·삭제와 밝기 전환의 실패만 여기서 알린다.
 * 대화상자 안에서 난 실패(만들기·수정·기록 추가)는 대화상자 안 알림이 맡는다 (04-ui-spec 공통 구성).
 */
function saveFailureMessage(request: ChangeRequest | null): string | null {
  switch (request?.kind) {
    case 'setTheme':
      return SAVE_FAILED_THEME_TEXT
    case 'moveCard':
    case 'moveDueDate':
    case 'archiveCard':
    case 'deleteCard':
      return SAVE_FAILED_CARD_TEXT
    default:
      return null
  }
}

interface AlertLineProps {
  save: SaveState
  onRetry: () => void
}

/** 막대 바로 아래 알림 줄. 저장이 성공하면(status 가 failed 가 아니게 되면) 사라진다. */
function AlertLine({ save, onRetry }: AlertLineProps) {
  if (save.status !== 'failed' || save.error === null) return null
  if (save.error.code === 'INTERNAL') {
    // 예상하지 못한 오류: 일반 문구 + 접힌 `자세히`(진단 문장). 다시 시도 버튼은 없다.
    return <Banner message={errorText('INTERNAL')} detail={save.error.message} />
  }
  const message = saveFailureMessage(save.failedRequest)
  if (message === null) return null
  return <Banner message={message} actionLabel={RETRY_SAVE_LABEL} onAction={onRetry} />
}

export function AppShell() {
  const data = useData()
  const ui = useUi()
  const save = useSaveState()
  const dispatch = useDispatch()
  const changes = useChanges()

  const ready = data.boot.phase === 'ready'
  const readFailed = data.boot.phase === 'read_failed'
  const { mode, anchor } = ui.calendar

  // 하단 줄: 건수는 필터와 검색의 영향을 받지 않는다 (사이드바 숫자와 같다). 읽지 못했거나 읽는 중이면 비운다.
  let statusText = ''
  if (ready) {
    if (ui.screen === 'board') {
      statusText = `카드 ${data.boardCards.length}건 · 보관함 ${data.archiveCards.length}건`
    } else if (ui.screen === 'calendar') {
      statusText = `${Number(anchor.slice(5, 7))}월에 마감인 카드 ${countDueInMonth(data.boardCards, anchor)}건`
    } else {
      statusText = `보관함 ${data.archiveCards.length}건`
    }
  }

  let calendarBar: ReactNode = null
  if (ui.screen === 'calendar' && !readFailed) {
    calendarBar = (
      <PeriodNav
        mode={mode}
        anchor={anchor}
        today={todayLocal(new Date())}
        onAnchorChange={(next) => dispatch({ type: 'ui/calendar_anchor_set', anchor: next })}
      >
        <SegmentedControl
          options={CALENDAR_MODE_OPTIONS}
          value={mode}
          onChange={(next) => dispatch({ type: 'ui/calendar_mode_set', mode: next })}
          ariaLabel={CALENDAR_MODE_LABEL}
        />
      </PeriodNav>
    )
  }

  let body: ReactNode
  if (data.boot.phase === 'read_failed') {
    body = <ReadFailurePanel failure={data.boot.failure} />
  } else if (ui.screen === 'calendar') {
    body = <CalendarScreen />
  } else if (ui.screen === 'archive') {
    body = <ArchiveScreen />
  } else {
    body = <BoardScreen />
  }

  // 대화상자가 열려 있는 동안 그 안의 실패는 대화상자가 알린다. 읽기 실패 때는 알림 줄을 두지 않는다 (패널이 알린다).
  const showAlert = !readFailed && ui.dialog === null

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopBar>{calendarBar}</TopBar>
        <div className="app-shell__alert">
          {showAlert ? <AlertLine save={save} onRetry={() => void changes.retryFailed()} /> : null}
        </div>
        <main className="app-shell__body">
          {body}
          {ui.dialog !== null && !readFailed ? (
            <CardDialog
              mode={ui.dialog.mode}
              cardId={ui.dialog.cardId}
              onClose={() => dispatch({ type: 'ui/dialog_closed' })}
            />
          ) : null}
        </main>
        <div className="app-shell__statusbar">{statusText}</div>
      </div>
    </div>
  )
}
