import type { HTMLAttributes, ReactNode } from 'react'
import type { Kind, Priority } from '@shared/types/card'
import { KIND_LABEL, PRIORITY_LABEL } from '../text/labels'
import { Icon } from './Icon'
import type { IconName } from './Icon'

// 칩, 종류 칩, 우선순위 표시. NFR-004 의 색 외 구분을 만드는 두 곳 중 하나다 (다른 하나는 DueText):
// 개발 버그 = 벌레 아이콘 + `개발 버그` + 채운 칩, 할 일 = 체크 칸 아이콘 + `할 일` + 테두리 칩.
// 모양과 글자는 data-theme 과 무관하고, 판은 CSS 변수 값만 바꾼다 (common.css 의 .chip 규칙).

export type ChipVariant = 'filled' | 'outline'

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'> {
  /** 채움(기본) 또는 테두리. */
  variant?: ChipVariant
  /** 글자 앞 아이콘. 장식이라 스크린리더가 읽지 않는다 (옆에 글자가 있다). */
  icon?: IconName
  className?: string
  children: ReactNode
}

/** 12px 칩 한 개. 종류 칩·조건 칩이 쓴다. */
export function Chip({ variant = 'filled', icon, className, children, ...rest }: ChipProps) {
  const classes = ['chip', `chip--${variant}`, className].filter(Boolean).join(' ')
  return (
    <span className={classes} {...rest}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}

const KIND_ICON: Record<Kind, IconName> = { bug: 'bug', task: 'task' }
const KIND_VARIANT: Record<Kind, ChipVariant> = { bug: 'filled', task: 'outline' }

export interface KindChipProps {
  kind: Kind
  className?: string
}

/** 종류 칩. 개발 버그는 채움, 할 일은 테두리. 아이콘과 글자가 항상 같이 나온다. */
export function KindChip({ kind, className }: KindChipProps) {
  return (
    <Chip variant={KIND_VARIANT[kind]} icon={KIND_ICON[kind]} className={className} data-kind={kind}>
      {KIND_LABEL[kind]}
    </Chip>
  )
}

const PRIORITY_NAME = '우선순위'
/** 채운 막대 수: 높음 3, 보통 2, 낮음 1. */
const PRIORITY_BARS: Record<Priority, number> = { high: 3, medium: 2, low: 1 }
const BAR_COUNT = 3

const markStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--text-sub)',
  fontSize: 14,
  lineHeight: '20px',
  whiteSpace: 'nowrap',
} as const

const barsStyle = { display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 } as const

function barStyle(index: number, filled: boolean) {
  return {
    boxSizing: 'border-box',
    width: 4,
    height: 4 + index * 4,
    border: '1px solid currentColor',
    borderRadius: 1,
    background: filled ? 'currentColor' : 'transparent',
  } as const
}

export interface PriorityMarkProps {
  /** 없으면(null) 아무것도 그리지 않는다 (카드의 우선순위 자리를 비운다). */
  priority: Priority | null
  className?: string
}

/** 우선순위 표시: 막대 3개(채운 수 = 높음 3, 보통 2, 낮음 1) + 글자. 막대는 장식이고 글자가 뜻을 준다. */
export function PriorityMark({ priority, className }: PriorityMarkProps) {
  if (priority === null) return null
  const label = PRIORITY_LABEL[priority]
  const filledCount = PRIORITY_BARS[priority]
  return (
    <span
      className={className ? `priority-mark ${className}` : 'priority-mark'}
      style={markStyle}
      title={`${PRIORITY_NAME} ${label}`}
      data-priority={priority}
    >
      <span style={barsStyle} aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <span key={index} style={barStyle(index, index < filledCount)} />
        ))}
      </span>
      <span>{label}</span>
    </span>
  )
}
