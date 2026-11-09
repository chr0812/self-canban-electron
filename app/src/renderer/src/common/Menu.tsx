import { useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'

// 메뉴와 팝오버 (ADR-011). 브라우저 `popover` 속성이 아니라 직접 구현이다:
// Electron 창에서 `popover` 가 동작하는지 확인하지 못했고, 직접 구현은 위치·닫기 규칙을 우리가 정한다.
// 몸통은 document.body 로 포털해서 칸·목록의 overflow 에 잘리지 않게 하고, 기준 요소(anchor) 옆에
// position: fixed 로 놓는다. 열림 효과는 120ms 투명도뿐이다 (움직임 줄이기면 0ms, common.css).

const GAP = 4
const EDGE = 8

export type PopoverPlacement = 'bottom-start' | 'bottom-end'

export interface PopoverProps {
  open: boolean
  /** Esc, 바깥 누름 때 부른다. 닫는 일은 부르는 쪽 상태가 한다. */
  onClose: () => void
  /** 위치 기준이 되는 요소 (보통 열기 버튼). Esc 로 닫으면 포커스가 여기로 돌아간다. */
  anchorRef: RefObject<HTMLElement | null>
  /** 스크린리더가 읽는 이름. */
  label: string
  role?: 'dialog' | 'menu'
  placement?: PopoverPlacement
  className?: string
  children: ReactNode
}

export function Popover({
  open,
  onClose,
  anchorRef,
  label,
  role = 'dialog',
  placement = 'bottom-start',
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  // 이벤트 핸들러가 늘 최신 onClose 를 부르게 한다 (효과를 다시 걸지 않는다).
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  // 위치: 기준 요소 아래. 아래 공간이 모자라면 위로 뒤집고, 창 안으로 가둔다.
  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const anchor = anchorRef.current
    if (!panel || !anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      let top = rect.bottom + GAP
      if (top + height > window.innerHeight - EDGE) top = rect.top - GAP - height
      top = Math.max(EDGE, Math.min(top, window.innerHeight - EDGE - height))
      let left = placement === 'bottom-end' ? rect.right - width : rect.left
      left = Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - width))
      panel.style.top = `${top}px`
      panel.style.left = `${left}px`
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, anchorRef, placement])

  // 닫기: Esc, 바깥 누름. 기준 요소를 누르는 것은 열기 버튼이 정하므로 바깥으로 치지 않는다.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onCloseRef.current()
      anchorRef.current?.focus()
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('mousedown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('mousedown', onPointerDown, true)
    }
  }, [open, anchorRef])

  if (!open) return null
  return createPortal(
    <div
      ref={panelRef}
      className={className ? `popover ${className}` : 'popover'}
      role={role}
      aria-label={label}
      tabIndex={-1}
    >
      {children}
    </div>,
    document.body,
  )
}

export interface MenuItem {
  key: string
  label: string
  onSelect: () => void
  disabled?: boolean
}

export interface MenuProps {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  /** 메뉴의 이름 (스크린리더). */
  label: string
  items: readonly MenuItem[]
  placement?: PopoverPlacement
}

export function Menu({ open, onClose, anchorRef, label, items, placement = 'bottom-end' }: MenuProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  const enabledItems = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])

  // 열리면 첫 항목에 포커스
  useEffect(() => {
    if (open) enabledItems()[0]?.focus()
  }, [open])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = enabledItems()
    if (list.length === 0) return
    const current = list.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    if (event.key === 'ArrowDown') next = (current + 1) % list.length
    else if (event.key === 'ArrowUp') next = (current - 1 + list.length) % list.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = list.length - 1
    else if (event.key === 'Tab') {
      onClose()
      return
    } else return
    event.preventDefault()
    list[next]?.focus()
  }

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      label={label}
      role="menu"
      placement={placement}
      className="menu"
    >
      <div ref={listRef} className="menu__list" role="none" onKeyDown={onKeyDown}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className="menu__item"
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </Popover>
  )
}
