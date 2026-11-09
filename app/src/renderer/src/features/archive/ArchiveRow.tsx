import { memo, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Card } from '@shared/types/card'
import { todayLocal } from '@shared/domain/date-rules'
import { Button } from '../../common/Button'
import { KindChip, PriorityMark } from '../../common/Chips'
import { DueText, formatDueDate } from '../../common/DueText'
import { Icon } from '../../common/Icon'
import { ARCHIVE_DELETE_CONFIRM_TEXT, CANCEL_LABEL, DELETE_CONFIRM_LABEL, DELETE_LABEL } from '../../text/labels'
import './archive.css'

// 보관함 목록 행 (SCR-004, FR-010 / FR-011). 한 줄 높이 44:
//   [종류 아이콘 + 제목] [종류 칩] [마감] [우선순위] [보관한 날] [삭제] [›]
// - 행의 본문(`archive-row__open`)을 누르면 onOpen (보기 전용 대화상자). `삭제` 버튼은 본문 밖 형제라 행 열기를 일으키지 않는다.
// - `삭제` 를 누르면 그 행이 삭제 확인 줄(문구 + `취소` + `삭제 확인`)로 바뀐다 (별도 팝업 없음, AC-033, AC-040).
//   포커스는 `취소` 로 간다. `삭제 확인` 을 눌러야만 onDelete 를 부른다.
// - 낙관적 반영이 없다: 삭제 확인 뒤에도 행은 확인 줄로 남고, 저장이 성공해 부모가 목록에서 카드를 지울 때 사라진다.
//   저장이 실패하면 행은 확인 줄 그대로이고 `삭제 확인` 을 다시 누를 수 있다 (onDelete 가 끝날 때까지만 두 버튼이 눌리지 않는다).
// - 보관한 카드는 모두 완료라 마감 지남 표시를 쓰지 않는다 (AC-025): DueText 에 상태를 `done` 으로 준다.

const NO_PRIORITY_TEXT = '없음'

export interface ArchiveRowProps {
  card: Card
  /** 행 본문을 눌렀을 때 (보기 전용 대화상자 열기). */
  onOpen: (card: Card) => void
  /** `삭제 확인` 을 눌렀을 때만. Promise 를 돌려주면 끝날 때까지 확인 줄의 두 버튼이 눌리지 않는다. */
  onDelete: (card: Card) => void | Promise<unknown>
}

/** 보관한 날 `11/01` (현지 날짜). 시각 문자열이 깨졌으면 빈 글자. */
function archivedDateText(archivedAt: string | null, today: string): string {
  if (archivedAt === null) return ''
  const when = new Date(archivedAt)
  if (Number.isNaN(when.getTime())) return ''
  return formatDueDate(todayLocal(when), today)
}

function ArchiveRowView({ card, onOpen, onDelete }: ArchiveRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const deleteRef = useRef<HTMLButtonElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  // 포커스는 사용자가 단계를 바꾼 뒤에만 옮긴다 (처음 그릴 때 훔치지 않는다).
  const moveFocus = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    if (confirming) cancelRef.current?.focus()
    else deleteRef.current?.focus()
  }, [confirming])

  function change(next: boolean) {
    moveFocus.current = true
    setConfirming(next)
  }

  async function confirmDelete() {
    if (pending) return
    setPending(true)
    try {
      await onDelete(card)
    } finally {
      // 성공하면 부모가 이 행을 없앤다. 실패하면 확인 줄 그대로 다시 누를 수 있게 둔다.
      if (mounted.current) setPending(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape' || pending) return
    event.stopPropagation()
    change(false)
  }

  if (confirming) {
    return (
      <li className="archive-row archive-row--confirm" data-card-id={card.id}>
        <div className="archive-row__confirm" role="group" aria-label="삭제 확인" onKeyDown={onKeyDown}>
          <p className="archive-row__confirm-text" role="status">
            {ARCHIVE_DELETE_CONFIRM_TEXT}
          </p>
          <div className="archive-row__confirm-actions">
            <Button ref={cancelRef} small disabled={pending} onClick={() => change(false)}>
              {CANCEL_LABEL}
            </Button>
            <Button small variant="primary" disabled={pending} onClick={() => void confirmDelete()}>
              {DELETE_CONFIRM_LABEL}
            </Button>
          </div>
        </div>
      </li>
    )
  }

  const today = todayLocal(new Date())

  return (
    <li className="archive-row" data-card-id={card.id}>
      <button type="button" className="archive-row__open" onClick={() => onOpen(card)}>
        <span className="archive-row__cell archive-row__cell--title">
          <Icon name={card.kind === 'bug' ? 'bug' : 'task'} className="archive-row__kind-icon" />
          <span className="archive-row__title" title={card.title}>
            {card.title}
          </span>
        </span>
        <span className="archive-row__cell">
          <KindChip kind={card.kind} />
        </span>
        <span className="archive-row__cell">
          <DueText dueDate={card.dueDate} status="done" today={today} />
        </span>
        <span className="archive-row__cell">
          {card.priority === null ? (
            <span className="archive-row__none">{NO_PRIORITY_TEXT}</span>
          ) : (
            <PriorityMark priority={card.priority} />
          )}
        </span>
        <span className="archive-row__cell archive-row__date">{archivedDateText(card.archivedAt, today)}</span>
      </button>
      <Button ref={deleteRef} small className="archive-row__delete" onClick={() => change(true)}>
        {DELETE_LABEL}
      </Button>
      <span className="archive-row__chevron" aria-hidden="true">
        <Icon name="chevron-right" />
      </span>
    </li>
  )
}

export const ArchiveRow = memo(ArchiveRowView)
