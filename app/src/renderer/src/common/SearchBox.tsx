import { useId, useState } from 'react'
import type { Ref } from 'react'
import { IconButton } from './Button'
import { Icon } from './Icon'

// 검색 입력 (보드와 보관함이 공유). `검색` 라벨이 입력칸 안 왼쪽에 항상 보이고, 안내 문구는 `제목에 포함된 글자`,
// 글자가 있으면 오른쪽에 지우기 × 가 나온다 (04-ui-spec.md SCR-001). 글자가 바뀔 때마다 onChange 를 부른다 (즉시 필터).
// 폭은 부모가 정한다 (상단 막대는 380).

const SEARCH_LABEL = '검색'
const SEARCH_PLACEHOLDER = '제목에 포함된 글자'
const CLEAR_LABEL = '검색어 지우기'

export interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  /** 지우기 × 를 눌렀을 때. 보통 검색어를 비운다. */
  onClear: () => void
  disabled?: boolean
  ref?: Ref<HTMLInputElement>
}

export function SearchBox({ value, onChange, onClear, disabled = false, ref }: SearchBoxProps) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const showClear = value.length > 0 && !disabled

  return (
    <div
      role="search"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 36,
        padding: '0 4px 0 10px',
        border: `1px solid ${disabled ? 'var(--line)' : 'var(--control)'}`,
        borderRadius: 4,
        background: 'var(--bg-side)',
        color: 'var(--text)',
        outline: focused ? '2px solid var(--focus)' : 'none',
        outlineOffset: 2,
      }}
    >
      <Icon name="search" />
      <label
        htmlFor={id}
        style={{ flex: 'none', color: 'var(--text-mute)', fontSize: 12, fontWeight: 700, lineHeight: '16px' }}
      >
        {SEARCH_LABEL}
      </label>
      <input
        ref={ref}
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={SEARCH_PLACEHOLDER}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          padding: '7px 0',
          border: 0,
          outline: 'none',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          fontSize: 14,
          lineHeight: '20px',
        }}
      />
      {showClear ? <IconButton icon="close" label={CLEAR_LABEL} onClick={onClear} /> : null}
    </div>
  )
}
