import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Card, DateString } from '@shared/types/card'
import { todayLocal } from '@shared/domain/date-rules'
import { EmptyState } from '../../common/EmptyState'
import { Icon } from '../../common/Icon'
import type { IconName } from '../../common/Icon'
import { countWithoutDueDate, groupByDueDate } from '../../model/calendar-model'
import type { CalendarMode } from '../../model/calendar-model'
import { useData, useDispatch, useUi } from '../../state/app-state'
import { useChanges } from '../../state/change-runner'
import { DayPopover } from './DayPopover'
import { MonthGrid } from './MonthGrid'
import { WeekGrid } from './WeekGrid'
import './calendar.css'

// SCR-003 캘린더 화면 (FR-005, UC-004). 마감일이 있는 카드를 그 날짜 칸에 칩으로 보인다 (AC-009).
//   - 읽는 카드는 보관하지 않은 카드(DataState.boardCards)뿐이다: 마감일 없는 카드(AC-010)와 보관한 카드(AC-019)는 나타나지 않는다.
//   - 보드·보관함의 검색·필터 조건과 사이드바 필터는 영향을 주지 않는다 (설계 `결정 필요` 7의 임시 가정).
//   - 보기(월/주)와 기준 날짜는 UiState.calendar 에 있다 (메모리에만, 저장하지 않는다).
//   - 칩을 누르면 카드 대화상자를 `edit` 모드로 연다. 닫으면 같은 기간·보기가 그대로다 (AC-030).
//   - 칩 끌기 (명세 v4, AC-044~046, ADR-013): 끌리는 카드 id 는 이 화면의 지역 상태(draggingId)다. 놓기(onDropCard)는 여기서 처리한다:
//     그 카드의 현재 마감일과 같은 날짜면 아무것도 하지 않고(AC-045), 아니면 ChangeRunner.moveDueDate 를 부른다.
//     낙관적 반영 없음: 성공한 뒤에만 칩이 새 칸에 나타난다. 실패하면 화면은 그대로고 저장 실패 안내는 AppShell 의 알림 줄이 보인다 (AC-046).
//   - 오늘은 그릴 때마다 todayLocal(new Date())로 새로 구한다 (자정 자동 갱신 없음, UC-008 Alt Flow 2).
// 상단 막대(보드로 돌아가기, 기간 이동 PeriodNav, 월|주 분할 버튼)와 하단 줄(`N월에 마감인 카드 N건`)은
// AppShell 이 그린다 (BI-004). 기준 날짜·보기는 UiState.calendar 에 있어 AppShell 이 바꾸고 이 화면은 읽기만 한다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const EMPTY_MESSAGE = '마감일이 있는 카드가 없습니다. 카드에 마감일을 적으면 이 달력에 나타납니다.'

const LEGEND: readonly { key: string; icon: IconName; label: string; color: string }[] = [
  { key: 'bug', icon: 'bug', label: '개발 버그', color: 'var(--text-sub)' },
  { key: 'task', icon: 'task', label: '할 일', color: 'var(--text-sub)' },
  { key: 'overdue', icon: 'warning', label: '마감 지남', color: 'var(--overdue)' },
  { key: 'done', icon: 'check-circle', label: '완료', color: 'var(--status-done)' },
]

export interface CalendarViewProps {
  mode: CalendarMode
  anchor: DateString
  today: DateString
  byDate: ReadonlyMap<DateString, Card[]>
  onOpenCard: (cardId: string) => void
  onShowMore: (date: DateString, anchor: HTMLElement) => void
  popoverDate: DateString | null
  draggingId?: string | null
  onChipDragStart?: (cardId: string) => void
  onChipDragEnd?: () => void
  onDropCard?: (cardId: string, date: DateString) => void
}

/** 월 또는 주 격자 (보기 선택에 따라). */
export function CalendarView({
  mode,
  anchor,
  today,
  byDate,
  onOpenCard,
  onShowMore,
  popoverDate,
  draggingId = null,
  onChipDragStart,
  onChipDragEnd,
  onDropCard,
}: CalendarViewProps) {
  if (mode === 'week') {
    return (
      <WeekGrid
        anchor={anchor}
        today={today}
        byDate={byDate}
        onOpenCard={onOpenCard}
        draggingId={draggingId}
        onChipDragStart={onChipDragStart}
        onChipDragEnd={onChipDragEnd}
        onDropCard={onDropCard}
      />
    )
  }
  return (
    <MonthGrid
      anchor={anchor}
      today={today}
      byDate={byDate}
      onOpenCard={onOpenCard}
      onShowMore={onShowMore}
      popoverDate={popoverDate}
      draggingId={draggingId}
      onChipDragStart={onChipDragStart}
      onChipDragEnd={onChipDragEnd}
      onDropCard={onDropCard}
    />
  )
}

export function CalendarScreen() {
  const data = useData()
  const ui = useUi()
  const dispatch = useDispatch()
  const changes = useChanges()
  const { mode, anchor } = ui.calendar
  const today = todayLocal(new Date())

  // 로딩 중에는 격자 뼈대만 보이고 칩은 없다. 읽기 실패 때는 AppShell 이 이 화면을 대체한다.
  const ready = data.boot.phase === 'ready'
  const cards = useMemo<readonly Card[]>(() => (ready ? data.boardCards : []), [ready, data.boardCards])
  const byDate = useMemo(() => groupByDueDate(cards), [cards])

  // `+N건 더 보기` 팝업: 열린 날짜와 기준 버튼. 기간·보기가 바뀌면 닫는다.
  const [popoverDate, setPopoverDate] = useState<DateString | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)

  const openCard = useCallback(
    (cardId: string) => dispatch({ type: 'ui/dialog_opened', dialog: { mode: 'edit', cardId } }),
    [dispatch],
  )
  const showMore = useCallback((date: DateString, button: HTMLElement) => {
    anchorRef.current = button
    setPopoverDate((current) => (current === date ? null : date))
  }, [])
  const closePopover = useCallback(() => setPopoverDate(null), [])

  // 칩 끌기: 끌리는 카드 id (UiState 에 올리지 않는다).
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const endDrag = useCallback(() => setDraggingId(null), [])
  const dropCard = useCallback(
    (cardId: string, date: DateString) => {
      setDraggingId(null)
      const card = cards.find((item) => item.id === cardId)
      if (card === undefined || card.dueDate === date) return // 목록에 없는 카드, 같은 날짜: 호출도 저장도 없다 (AC-045)
      void changes.moveDueDate(cardId, date)
    },
    [cards, changes],
  )

  // 기간·보기는 AppShell 이 바꾼다. 바뀌면 열려 있던 팝업을 닫는다.
  useEffect(() => {
    setPopoverDate(null)
  }, [anchor, mode])

  const withoutDue = countWithoutDueDate(cards)
  const showEmpty = ready && byDate.size === 0

  return (
    <section className="calendar-screen" aria-label="캘린더">
      <div className="calendar-body">
        {showEmpty ? <EmptyState message={EMPTY_MESSAGE} /> : null}
        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((name) => (
            <span key={name} className="calendar-weekdays__day">
              {name}
            </span>
          ))}
        </div>
        <CalendarView
          mode={mode}
          anchor={anchor}
          today={today}
          byDate={byDate}
          onOpenCard={openCard}
          onShowMore={showMore}
          popoverDate={popoverDate}
          draggingId={draggingId}
          onChipDragStart={setDraggingId}
          onChipDragEnd={endDrag}
          onDropCard={dropCard}
        />
        <div className="calendar-legend">
          <ul className="calendar-legend__items" aria-label="범례">
            {LEGEND.map((item) => (
              <li key={item.key} className="calendar-legend__item">
                <span style={{ display: 'inline-flex', color: item.color } satisfies CSSProperties}>
                  <Icon name={item.icon} />
                </span>
                {item.label}
              </li>
            ))}
          </ul>
          {withoutDue > 0 ? (
            <span className="calendar-legend__note">{`마감일이 없는 카드 ${withoutDue}건은 보드에서만 보입니다`}</span>
          ) : null}
        </div>
      </div>

      {popoverDate !== null ? (
        <DayPopover
          open
          onClose={closePopover}
          anchorRef={anchorRef}
          date={popoverDate}
          cards={byDate.get(popoverDate) ?? []}
          today={today}
          onOpenCard={openCard}
        />
      ) : null}
    </section>
  )
}
