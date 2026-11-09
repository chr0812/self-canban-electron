import { useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { STATUSES } from '@shared/constants'
import type { Status } from '@shared/types/card'
import { Icon } from '../../common/Icon'
import { Menu } from '../../common/Menu'
import type { MenuItem } from '../../common/Menu'

// 카드의 `⋯` 상태 이동 메뉴 (끌기의 대안, WCAG 2.5.7). 카드 오른쪽 위 24x22 버튼(board.css .card-move-btn)을 누르면
// 현재 상태를 뺀 두 항목이 열린다. 항목을 고르면 onMove(바꿀 상태)를 부른다 — 끌어다 놓은 것과 같은 결과다.
// 저장이 성공해야 카드가 옮겨진다: 이 컴포넌트는 낙관적으로 바꾸지 않고 요청만 올린다 (부르는 쪽이 저장한다).
// 버튼은 카드 열기와 별개로 눌려야 하므로 클릭이 카드로 번지지 않게 막는다.

const BUTTON_LABEL = '상태 이동'

// 항목 글자는 조사가 상태마다 달라 표로 둔다 (STATUS_LABEL + 으로/로 조합하지 않는다).
const MOVE_LABEL: Record<Status, string> = {
  todo: '할 일로 옮기기',
  in_progress: '진행 중으로 옮기기',
  done: '완료로 옮기기',
}

export interface CardMoveMenuProps {
  /** 카드의 현재 상태. 이 값은 메뉴 항목에서 빠진다. */
  status: Status
  onMove: (to: Status) => void
}

function stop(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CardMoveMenu({ status, onMove }: CardMoveMenuProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)

  const items: MenuItem[] = STATUSES.filter((value) => value !== status).map((value) => ({
    key: value,
    label: MOVE_LABEL[value],
    onSelect: () => onMove(value),
  }))

  return (
    // 메뉴 몸통은 body 로 포털되지만 React 이벤트는 이 요소로 올라온다: 클릭·키가 카드(열기)로 번지지 않게 여기서 막는다.
    <span style={{ display: 'contents' }} onClick={stop} onKeyDown={stop}>
      <button
        ref={anchorRef}
        type="button"
        className="card-move-btn"
        aria-label={BUTTON_LABEL}
        title={BUTTON_LABEL}
        aria-haspopup="menu"
        aria-expanded={open}
        draggable={false}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="more" />
      </button>
      <Menu open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} label={BUTTON_LABEL} items={items} />
    </span>
  )
}
