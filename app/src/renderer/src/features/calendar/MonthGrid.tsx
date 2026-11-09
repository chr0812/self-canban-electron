import type { Card, DateString } from '@shared/types/card'
import { buildMonthGrid, cardsInCell } from '../../model/calendar-model'
import { DayCell } from './DayCell'
import './calendar.css'

// 월 격자 (SCR-003, FR-005). 일요일 시작, 4~6행의 날짜 칸. 이 달이 아닌 날은 카드 없는 흐린 칸이다.
// 요일 줄은 부르는 쪽(CalendarScreen)이 격자 위에 놓는다. 계산은 calendar-model 한 곳에서 한다.

export interface MonthGridProps {
  /** 기준 날짜. 이 날짜가 든 달을 그린다. */
  anchor: DateString
  today: DateString
  /** 마감일별 카드 (groupByDueDate 결과). */
  byDate: ReadonlyMap<DateString, Card[]>
  onOpenCard: (cardId: string) => void
  onShowMore: (date: DateString, anchor: HTMLElement) => void
  /** 더 보기 팝업이 열려 있는 날짜. */
  popoverDate?: DateString | null
  /** 끌기 관련: CalendarScreen 이 내려 주는 것을 DayCell 에 그대로 전달만 한다. 이 달 밖 칸에도 놓을 수 있다. */
  draggingId?: string | null
  onChipDragStart?: (cardId: string) => void
  onChipDragEnd?: () => void
  onDropCard?: (cardId: string, date: DateString) => void
}

export function MonthGrid({
  anchor,
  today,
  byDate,
  onOpenCard,
  onShowMore,
  popoverDate = null,
  draggingId = null,
  onChipDragStart,
  onChipDragEnd,
  onDropCard,
}: MonthGridProps) {
  const cells = buildMonthGrid(anchor).flat()
  return (
    <div className="calendar-grid" data-mode="month">
      {cells.map((cell) => (
        <DayCell
          key={cell.date}
          cell={cell}
          cards={cardsInCell(cell, byDate)}
          today={today}
          mode="month"
          onOpenCard={onOpenCard}
          onShowMore={onShowMore}
          popoverOpen={popoverDate === cell.date}
          draggingId={draggingId}
          onDragStart={onChipDragStart}
          onDragEnd={onChipDragEnd}
          onDropCard={onDropCard}
        />
      ))}
    </div>
  )
}
