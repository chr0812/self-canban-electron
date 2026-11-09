import type { ReactNode } from 'react'

// 라디오 행: 라디오 원 + (선택) 아이콘 + 이름 + (선택) 건수. 사이드바 필터와 화면 밝기에서 쓴다.
// 눌렀을 때 무엇을 할지는 부르는 쪽이 정한다. 사이드바 필터처럼 "고른 행을 다시 누르면 해제"가 필요하면
// onSelect 안에서 해제하면 된다. 묶음은 부르는 쪽이 role="radiogroup" 요소로 감싼다.

export interface RadioRowProps {
  label: string
  checked: boolean
  onSelect: () => void
  /** 이름 옆 아이콘 (예: `<Icon name="moon" />`). */
  icon?: ReactNode
  /** 오른쪽 건수. 0 도 보인다. */
  count?: number
  disabled?: boolean
  className?: string
}

export function RadioRow({ label, checked, onSelect, icon, count, disabled = false, className }: RadioRowProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={className ? `radio-row ${className}` : 'radio-row'}
      data-checked={checked ? 'true' : undefined}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="radio-row__dot" aria-hidden="true" />
      {icon ? <span className="radio-row__icon">{icon}</span> : null}
      <span className="radio-row__label">{label}</span>
      {count === undefined ? null : <span className="radio-row__count">{count}</span>}
    </button>
  )
}
