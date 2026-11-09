import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Card, DateString } from '@shared/types/card'
import { Popover } from '../../common/Menu'
import { CalendarChip } from './CalendarChip'
import './calendar.css'

// `+N건 더 보기` 팝업 (SCR-003, UC-004 Alt Flow 3). 그 날짜의 카드 전체를 14px 칩 목록으로 보인다
// (최대 높이 320, 스크롤은 calendar.css). 열고 닫는 위치·Esc·바깥 누름은 Menu.tsx 의 Popover 가 맡는다.
// 열리면 첫 칩에 포커스를 준다 (몸통이 body 끝에 포털되어 탭 순서로는 멀기 때문).
// 팝업 안의 칩은 끌 수 없다 (명세 v4, AC-043): 옮기려면 칩을 눌러 카드 입력 화면에서 마감일을 고친다.
// 칩을 누르면 팝업을 닫고 카드를 연다 (AC-030).

export interface DayPopoverProps {
  open: boolean
  onClose: () => void
  /** 팝업이 붙는 `+N건 더 보기` 버튼. */
  anchorRef: RefObject<HTMLElement | null>
  date: DateString
  /** 그 날짜의 카드 전체 (칸에 보인 것까지 포함). */
  cards: readonly Card[]
  today: DateString
  onOpenCard: (cardId: string) => void
}

function dayText(date: DateString): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`
}

export function DayPopover({ open, onClose, anchorRef, date, cards, today, onOpenCard }: DayPopoverProps) {
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    if (open) listRef.current?.querySelector('button')?.focus()
  }, [open, date])

  const text = dayText(date)
  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} label={`${text} 카드 목록`} className="day-popover">
      <div className="day-popover__head">{`${text} · 카드 ${cards.length}건`}</div>
      <ul ref={listRef} className="day-popover__list">
        {cards.map((card) => (
          <li key={card.id}>
            <CalendarChip
              card={card}
              today={today}
              variant="popover"
              draggable={false}
              onOpen={(cardId) => {
                onClose()
                onOpenCard(cardId)
              }}
            />
          </li>
        ))}
      </ul>
    </Popover>
  )
}
