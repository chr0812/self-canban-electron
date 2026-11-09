import type { DragEvent } from 'react'
import type { Card, Status } from '@shared/types/card'
import { isOverdue, overdueDays } from '@shared/domain/date-rules'
import { Icon } from '../../common/Icon'
import type { IconName } from '../../common/Icon'
import { formatDueDate } from '../../common/DueText'
import { KIND_LABEL, STATUS_LABEL } from '../../text/labels'
import './calendar.css'

// 날짜 칸의 카드 칩 (SCR-003, FR-005). 칩 전체가 누르는 영역이라 <button> 하나다 (AC-030).
// 모양은 calendar.css 의 .calendar-chip 규칙이 정한다. 색만으로 뜻을 전하지 않는다 (NFR-004):
//   종류 = 아이콘(벌레 / 체크 칸), 완료 = 흐린 제목 + 끝의 원 안 체크,
//   마감 지남 = 삼각형 아이콘 + 굵은 제목 + 붉은 칩 (상태 색보다 우선).
// 마감 지남 판정은 date-rules 의 isOverdue 한 곳에서만 한다 (AC-024, AC-025).
// 월 보기 칩에는 상태 글자가 없으므로 aria-label 과 title 에 상태를 적는다.
// 주 보기·`+N건 더 보기` 팝업 칩은 끝에 상태 글자 칩을 붙인다.
// 끌기 (명세 v4, AC-044, ADR-013): 월·주 칩은 draggable 이고 dragstart 에서 카드 id 를 dataTransfer 와
//   부모 상태(onDragStart) 양쪽에 둔다. 팝업 칩은 끌 수 없다 (draggable 속성을 달지 않는다).
//   끌기와 클릭은 브라우저가 가른다: 끌기가 일어나면 click 이 나지 않으므로 칩을 눌러 여는 동작(AC-030)은 그대로다.

/** 끌리는 카드 id 를 dataTransfer 에 담는 형식. 보드의 CARD_DRAG_TYPE 과 섞이지 않게 캘린더 전용 이름을 쓴다 (ADR-013). */
export const CHIP_DRAG_TYPE = 'application/x-kanban-calendar-chip'

/** month = 월 격자(22px, 한 줄), week = 주 한 줄(14px, 두 줄까지), popover = 더 보기 팝업(14px). */
export type CalendarChipVariant = 'month' | 'week' | 'popover'

export interface CalendarChipProps {
  card: Card
  /** 오늘 (PC 현지 날짜). 마감 지남 판정 기준. */
  today: string
  /** 칩을 눌렀을 때. 카드의 입력·상세 화면을 여는 쪽이 받는다. */
  onOpen: (cardId: string) => void
  /** 기본 month. */
  variant?: CalendarChipVariant
  /** 끌 수 있는가. 기본 true. popover 변형은 이 값과 상관없이 끌 수 없다. */
  draggable?: boolean
  /** 이 칩을 지금 끌고 있는가 (투명도 50%). */
  dragging?: boolean
  onDragStart?: (cardId: string) => void
  onDragEnd?: () => void
}

const KIND_ICON: Record<Card['kind'], IconName> = { bug: 'bug', task: 'task' }
const DUE_LABEL = '마감'

/** 스크린리더가 읽고 마우스를 올리면 보이는 글자: `제목, 개발 버그, 진행 중, 마감 11/12[, N일 지남]`. */
export function chipDescription(card: Card, today: string): string {
  const parts = [card.title, KIND_LABEL[card.kind], STATUS_LABEL[card.status]]
  if (card.dueDate !== null) {
    parts.push(`${DUE_LABEL} ${formatDueDate(card.dueDate, today)}`)
    const days = overdueDays(card, today)
    if (days !== null) parts.push(`${days}일 지남`)
  }
  return parts.join(', ')
}

export function CalendarChip({
  card,
  today,
  onOpen,
  variant = 'month',
  draggable = true,
  dragging = false,
  onDragStart,
  onDragEnd,
}: CalendarChipProps) {
  const canDrag = draggable && variant !== 'popover'
  const overdue = isOverdue(card, today)
  const status: Status = card.status
  const description = chipDescription(card, today)

  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    event.dataTransfer.setData(CHIP_DRAG_TYPE, card.id)
    event.dataTransfer.effectAllowed = 'move'
    onDragStart?.(card.id)
  }

  return (
    <button
      type="button"
      className="calendar-chip"
      data-variant={variant}
      data-status={status}
      data-kind={card.kind}
      data-overdue={overdue ? 'true' : undefined}
      data-dragging={canDrag && dragging ? 'true' : undefined}
      aria-label={description}
      title={description}
      draggable={canDrag ? true : undefined}
      onClick={() => onOpen(card.id)}
      onDragStart={canDrag ? handleDragStart : undefined}
      onDragEnd={canDrag ? () => onDragEnd?.() : undefined}
    >
      <span className="calendar-chip__icon">
        <Icon name={overdue ? 'warning' : KIND_ICON[card.kind]} />
      </span>
      <span className="calendar-chip__title">{card.title}</span>
      {status === 'done' ? (
        <span className="calendar-chip__done">
          <Icon name="check-circle" size={12} />
        </span>
      ) : null}
      {variant === 'month' ? null : (
        <span className="calendar-chip__status" aria-hidden="true">
          {STATUS_LABEL[status]}
        </span>
      )}
    </button>
  )
}
