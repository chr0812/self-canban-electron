import { useState } from 'react'
import type { DragEvent } from 'react'
import type { Card, DateString } from '@shared/types/card'
import { weekdayOf } from '@shared/domain/date-rules'
import { splitVisible } from '../../model/calendar-model'
import type { CalendarCell } from '../../model/calendar-model'
import { CalendarChip, CHIP_DRAG_TYPE } from './CalendarChip'
import './calendar.css'

// 날짜 칸 한 개 (SCR-003, FR-005). 날짜 숫자 + 카드 칩 목록.
//   월 보기: 칩 3개까지, 나머지는 `+N건 더 보기` (누르면 부르는 쪽이 팝업을 연다, UC-004 Alt Flow 3)
//   주 보기: 칩 전체 (칸 안에서 세로 스크롤), 더 보기 없음
// 칸에 놓을 카드는 부르는 쪽이 cardsInCell 로 구해 넘긴다 (기준 달이 아닌 날은 빈 목록).
// 놓는 곳 (명세 v4, AC-044, ADR-013): 끌기가 진행 중(draggingId)이면 모든 날짜 칸(이 달 밖 칸 포함)이 놓을 수 있고,
//   dragover 중에는 2px 점선 윤곽 + 옅은 바탕(data-drop-target)을 켠다. drop 에서 onDropCard(카드 id, 이 칸의 날짜)를 부르기만 한다:
//   같은 날짜인지 판단은 CalendarScreen 이 한다. dragover 중에는 dataTransfer.getData 가 비므로 부모의 draggingId 를 쓴다.
// 모양은 calendar.css 의 .day-cell 규칙이 정한다. 오늘은 색만이 아니라 `오늘` 글자가 붙은 알약이다 (NFR-004).

export type DayCellMode = 'month' | 'week'

export interface DayCellProps {
  cell: CalendarCell
  /** 이 칸에 놓이는 카드 (마감일이 이 날짜인 보관하지 않은 카드). */
  cards: readonly Card[]
  /** 오늘 (PC 현지 날짜). */
  today: DateString
  mode: DayCellMode
  /** 칩을 눌렀을 때. 카드의 입력·상세 화면을 여는 쪽이 받는다. */
  onOpenCard: (cardId: string) => void
  /** `+N건 더 보기`를 눌렀을 때. 누른 버튼이 팝업의 기준 요소가 된다. */
  onShowMore: (date: DateString, anchor: HTMLElement) => void
  /** 이 칸의 더 보기 팝업이 열려 있는가 (aria-expanded). */
  popoverOpen?: boolean
  /** 지금 끌고 있는 카드 id. 없으면 null (끌기 진행 중이 아니면 놓는 곳이 아니다). */
  draggingId?: string | null
  /** 이 칸의 칩을 끌기 시작했을 때 / 끌기가 끝났을 때. */
  onDragStart?: (cardId: string) => void
  onDragEnd?: () => void
  /** 카드를 이 칸에 놓았을 때. 같은 날짜 여부는 부르는 쪽이 판단한다. */
  onDropCard?: (cardId: string, date: DateString) => void
}

const WEEKDAY_NAME = ['일', '월', '화', '수', '목', '금', '토']
const TODAY_LABEL = '오늘'

/** `11월 6일 금요일`. 칸을 스크린리더가 읽는 이름. */
function cellLabel(date: DateString): string {
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return `${month}월 ${day}일 ${WEEKDAY_NAME[weekdayOf(date)] ?? ''}요일`
}

export function DayCell({
  cell,
  cards,
  today,
  mode,
  onOpenCard,
  onShowMore,
  popoverOpen = false,
  draggingId = null,
  onDragStart,
  onDragEnd,
  onDropCard,
}: DayCellProps) {
  const [over, setOver] = useState(false)
  const droppable = draggingId !== null && onDropCard !== undefined
  const isToday = cell.date === today
  const day = Number(cell.date.slice(8, 10))
  const { shown, hiddenCount } = mode === 'month' ? splitVisible(cards) : { shown: [...cards], hiddenCount: 0 }
  const variant = mode === 'week' ? 'week' : 'month'

  // 끌기가 끝나면(놓기·취소) 표시도 끝난다. 취소하면 dragleave 가 오지 않을 수 있어 여기서 맞춘다.
  if (draggingId === null && over) setOver(false)

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!droppable) return
    event.preventDefault() // 놓을 수 있다는 표시
    event.dataTransfer.dropEffect = 'move'
    if (!over) setOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return // 칸 안의 자식으로 옮겨 간 것
    setOver(false)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    setOver(false)
    if (!droppable) return
    event.preventDefault()
    const cardId = draggingId ?? event.dataTransfer.getData(CHIP_DRAG_TYPE)
    if (cardId) onDropCard(cardId, cell.date)
  }

  return (
    <div
      className="day-cell"
      role="group"
      aria-label={`${cellLabel(cell.date)}${isToday ? ', 오늘' : ''}, 카드 ${cards.length}건`}
      data-date={cell.date}
      data-today={isToday ? 'true' : undefined}
      data-outside={cell.inMonth ? undefined : 'true'}
      data-drop-target={over && droppable ? 'true' : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="day-cell__num" data-today={isToday ? 'true' : undefined}>
        {isToday ? `${day} ${TODAY_LABEL}` : day}
      </span>
      {shown.length > 0 ? (
        <div className="day-cell__chips">
          {shown.map((card) => (
            <CalendarChip
              key={card.id}
              card={card}
              today={today}
              onOpen={onOpenCard}
              variant={variant}
              dragging={draggingId === card.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      ) : null}
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="day-cell__more"
          aria-haspopup="dialog"
          aria-expanded={popoverOpen}
          onClick={(event) => onShowMore(cell.date, event.currentTarget)}
        >
          {`+${hiddenCount}건 더 보기`}
        </button>
      ) : null}
    </div>
  )
}
