import { useState } from 'react'
import type { DragEvent } from 'react'
import { isOverdue } from '@shared/domain/date-rules'
import type { Card, DateString, Status } from '@shared/types/card'
import type { ColumnCount } from '../../model/board-model'
import { EmptyState } from '../../common/EmptyState'
import { STATUS_LABEL } from '../../text/labels'
import { CardItem, CARD_DRAG_TYPE } from './CardItem'
import './board.css'

// 칸 하나 (SCR-001): 머리(칸 이름 + 건수), 카드 목록, 놓기, 빈 칸 안내.
// - 건수: 조건이 없으면 `6`, 조건이 있으면 `2 / 6` (AC-036).
// - 놓기: 칸이 dragover(허용 표시)와 drop(상태 변경 요청)을 받는다. 끌리는 카드는 부모가 쥔 draggingId/draggingStatus 로 안다
//   (dragover 중에는 dataTransfer.getData 가 비어 있다, ADR-010). 같은 칸이나 칸 밖에 놓으면 아무 일도 없다.
//   놓은 순간 화면은 바뀌지 않는다: 부모가 저장을 보내고, 성공한 뒤에만 카드가 새 칸에 나타난다 (낙관적 반영 없음).
// - 빈 칸 안내: 보드가 통째로 비었으면 할 일 칸에 시작 안내와 `카드 만들기`, 그 밖의 빈 칸은 흐린 한 줄 (AC-006).

const EMPTY_BOARD_TEXT = '카드가 없습니다. 카드 만들기로 개발 버그나 할 일을 등록하세요.'
const EMPTY_COLUMN_TEXT = '카드가 없습니다'
const NO_MATCH_TEXT = '맞는 카드 없음'
const CREATE_LABEL = '카드 만들기'

export interface ColumnProps {
  status: Status
  /** 이 칸에 보일 카드 (이미 조건을 거쳤고 화면 순서다). */
  cards: readonly Card[]
  count: ColumnCount
  today: DateString
  /** 조건이 걸려 있는가 (머리 건수 모양과 빈 칸 문구가 달라진다). */
  hasConditions: boolean
  /** 범위 안 카드가 하나도 없는 처음 상태인가 (할 일 칸에 시작 안내). */
  isEmptyBoard: boolean
  /** 지금 끌고 있는 카드. 없으면 null. */
  draggingId: string | null
  draggingStatus: Status | null
  onOpen: (id: string) => void
  onMove: (id: string, to: Status) => void
  onArchive: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  /** 카드를 이 칸에 놓았을 때 (다른 칸에서 끌어온 경우만). */
  onDropCard: (id: string, to: Status) => void
  /** 시작 안내의 `카드 만들기`. */
  onCreate: () => void
}

function countText(count: ColumnCount, hasConditions: boolean): string {
  return hasConditions ? `${count.shown} / ${count.total}` : String(count.total)
}

export function Column({
  status,
  cards,
  count,
  today,
  hasConditions,
  isEmptyBoard,
  draggingId,
  draggingStatus,
  onOpen,
  onMove,
  onArchive,
  onDragStart,
  onDragEnd,
  onDropCard,
  onCreate,
}: ColumnProps) {
  const [over, setOver] = useState(false)
  const droppable = draggingId !== null && draggingStatus !== status
  const titleId = `column-title-${status}`

  // 끌기가 끝나면(놓기·취소) 허용 표시도 끝난다. 취소하면 dragleave 가 오지 않을 수 있어 여기서 맞춘다.
  if (draggingId === null && over) setOver(false)

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!droppable) return
    event.preventDefault() // 놓을 수 있다는 표시. 놓을 수 없는 칸은 막지 않아 금지 모양이 된다
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
    const id = draggingId ?? event.dataTransfer.getData(CARD_DRAG_TYPE)
    if (id) onDropCard(id, status)
  }

  function renderEmpty() {
    if (hasConditions) return <EmptyState message={NO_MATCH_TEXT} muted />
    if (isEmptyBoard && status === 'todo') {
      return <EmptyState message={EMPTY_BOARD_TEXT} actionLabel={CREATE_LABEL} onAction={onCreate} />
    }
    return <EmptyState message={EMPTY_COLUMN_TEXT} muted />
  }

  return (
    <section
      className="column"
      data-status={status}
      data-drop-target={over && droppable ? 'true' : undefined}
      aria-labelledby={titleId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="column__head">
        <h2 id={titleId} className="column__title" style={{ margin: 0 }}>
          {STATUS_LABEL[status]}
        </h2>
        <span className="column__count">{countText(count, hasConditions)}</span>
      </header>
      <div className="column__list">
        {cards.length === 0
          ? renderEmpty()
          : cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                overdue={isOverdue(card, today)}
                today={today}
                dragging={draggingId === card.id}
                onOpen={onOpen}
                onMove={onMove}
                onArchive={onArchive}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
      </div>
    </section>
  )
}
