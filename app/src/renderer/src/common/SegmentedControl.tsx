import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

// 분할 버튼: 두 개 이상의 버튼 중 하나가 선택된 상태 (종류, 우선순위, 월/주).
// 라디오 묶음으로 읽힌다. 방향키로 옮기면 바로 고른다.

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** 묶음의 이름 (스크린리더). 화면에 라벨이 있으면 그 글자를 넣는다. */
  ariaLabel: string
  disabled?: boolean
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    else return
    event.preventDefault()
    const target = options[next]
    if (!target) return
    refs.current[next]?.focus()
    onChange(target.value)
  }

  // 선택된 칸만 탭 순서에 든다. 선택이 없으면(값이 옵션에 없으면) 첫 칸.
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  return (
    <div className={className ? `segmented ${className}` : 'segmented'} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            className="segmented__item"
            data-selected={selected ? 'true' : undefined}
            tabIndex={index === selectedIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
