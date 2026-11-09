import type { Card, DateString } from '@shared/types/card'
import { buildWeek, cardsInCell } from '../../model/calendar-model'
import { DayCell } from './DayCell'
import './calendar.css'

// 주 한 줄 (SCR-003, FR-005). 일요일~토요일 7칸이 세로로 길고, 칩 제목을 두 줄까지 줄바꿈해 전체를 보인다.
// 카드가 많으면 칸 안에서 세로로 스크롤한다 (더 보기 없음). 요일 줄은 부르는 쪽이 격자 위에 놓는다.

export interface WeekGridProps {
  /** 기준 날짜. 이 날짜가 든 주를 그린다. */
  anchor: DateString
  today: DateString
  /** 마감일별 카드 (groupByDueDate 결과). */
  byDate: ReadonlyMap<DateString, Card[]>
  onOpenCard: (cardId: string) => void
  /** 끌기 관련: CalendarScreen 이 내려 주는 것을 DayCell 에 그대로 전달만 한다. */
  draggingId?: string | null
  onChipDragStart?: (cardId: string) => void
  onChipDragEnd?: () => void
  onDropCard?: (cardId: string, date: DateString) => void
}

// 주 보기에는 더 보기 버튼이 없어 이 함수는 불리지 않는다.
function ignoreMore(): void {}

export function WeekGrid({
  anchor,
  today,
  byDate,
  onOpenCard,
  draggingId = null,
  onChipDragStart,
  onChipDragEnd,
  onDropCard,
}: WeekGridProps) {
  const cells = buildWeek(anchor)
  return (
    <div className="calendar-grid" data-mode="week">
      {cells.map((cell) => (
        <DayCell
          key={cell.date}
          cell={cell}
          cards={cardsInCell(cell, byDate)}
          today={today}
          mode="week"
          onOpenCard={onOpenCard}
          onShowMore={ignoreMore}
          draggingId={draggingId}
          onDragStart={onChipDragStart}
          onDragEnd={onChipDragEnd}
          onDropCard={onDropCard}
        />
      ))}
    </div>
  )
}
