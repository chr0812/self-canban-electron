import { memo } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { isOverdue } from '@shared/domain/date-rules'
import type { Card, DateString, Status } from '@shared/types/card'
import { KindChip, PriorityMark } from '../../common/Chips'
import { DueText } from '../../common/DueText'
import { Icon } from '../../common/Icon'
import { KIND_LABEL } from '../../text/labels'
import { ArchiveConfirm } from './ArchiveConfirm'
import { CardMoveMenu } from './CardMoveMenu'
import './board.css'

// 카드 한 장 (SCR-001): 1줄 종류 아이콘 + 제목 + `⋯` 이동 메뉴, 2줄 종류 칩 + 마감 글자 / 우선순위 / (완료 카드) 보관.
// - 끌기: draggable. 시작 때 카드 id 를 dataTransfer 와 부모 상태(onDragStart) 양쪽에 둔다 (ADR-010).
//   dragover 중에는 getData 가 비어 있어서 칸은 부모 상태를 본다.
// - 이동·보관은 요청만 올린다: 카드가 새 칸으로 가거나 사라지는 것은 저장이 성공한 뒤의 일이다 (낙관적 반영 없음).
// - 마감 지남은 부모가 정해 준 overdue 로 data-overdue 를 붙인다. 2px 테두리와 바탕은 board.css 가 그린다 (AC-024, AC-025).
// - 메모이제이션 (ADR-006): 핸들러는 id 를 받아 부모가 바뀌지 않는 함수를 넘길 수 있다.

/** 끌리는 카드 id 를 dataTransfer 에 담는 형식. 다른 곳의 글자·파일 끌기와 섞이지 않게 전용 이름을 쓴다. */
export const CARD_DRAG_TYPE = 'application/x-kanban-card-id'

export interface CardItemProps {
  card: Card
  /** 마감이 지난 카드인가 (부모가 date-rules 의 isOverdue 로 구해 넘긴다). */
  overdue: boolean
  /** 오늘 (PC 현지 날짜). 마감 글자에 쓴다. */
  today: DateString
  /** 이 카드를 지금 끌고 있는가 (흐리게). */
  dragging?: boolean
  onOpen: (id: string) => void
  onMove: (id: string, to: Status) => void
  onArchive: (id: string) => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
}

const rowEndStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 } as const

function CardItemView({
  card,
  overdue,
  today,
  dragging = false,
  onOpen,
  onMove,
  onArchive,
  onDragStart,
  onDragEnd,
}: CardItemProps) {
  const { id } = card

  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.setData(CARD_DRAG_TYPE, id)
    event.dataTransfer.effectAllowed = 'move'
    onDragStart?.(id)
  }

  // 카드 안 버튼의 Enter·Space 는 카드 열기로 번지지 않게 카드 자신에게 온 키만 받는다.
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen(id)
  }

  // 마감 지남은 date-rules 한 곳에서 판정한 값이 안 맞으면 따르지 않는다 (완료 카드는 표시하지 않는다, AC-025).
  const showOverdue = overdue && isOverdue(card, today)

  return (
    <article
      className="card-item"
      data-status={card.status}
      data-overdue={showOverdue ? 'true' : undefined}
      data-dragging={dragging ? 'true' : undefined}
      data-card-id={id}
      tabIndex={0}
      draggable
      onClick={() => onOpen(id)}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStart}
      onDragEnd={() => onDragEnd?.()}
    >
      <div className="card-item__row">
        <span className="card-item__kind-icon" style={{ display: 'inline-flex' }} title={KIND_LABEL[card.kind]}>
          <Icon name={card.kind === 'bug' ? 'bug' : 'task'} />
        </span>
        <span className="card-item__title" title={card.title}>
          {card.title}
        </span>
        <CardMoveMenu status={card.status} onMove={(to) => onMove(id, to)} />
      </div>
      <div className="card-item__row card-item__row--end">
        <span style={rowEndStyle}>
          <KindChip kind={card.kind} />
          <DueText dueDate={card.dueDate} status={card.status} today={today} />
        </span>
        <span style={rowEndStyle}>
          <PriorityMark priority={card.priority} />
          {card.status === 'done' ? <ArchiveConfirm onConfirm={() => onArchive(id)} /> : null}
        </span>
      </div>
    </article>
  )
}

export const CardItem = memo(CardItemView)
