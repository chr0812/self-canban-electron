import type { DateString, Status } from '@shared/types/card'
import { isOverdue, overdueDays } from '@shared/domain/date-rules'
import { Icon } from './Icon'

// 마감일 글자와 마감 지남 모양. NFR-004 의 색 외 구분을 만드는 두 곳 중 하나다 (다른 하나는 KindChip):
// 마감 지남 = 삼각형 아이콘 + `MM/DD · N일 지남` + 굵은 글자. 붉은색은 보조이고 모양과 글자는 두 판에서 같다.
// 판정은 date-rules 의 isOverdue / overdueDays 한 곳에서만 한다 (마감일 < 오늘 AND 상태 ≠ 완료, AC-024, AC-025).
// 카드의 2px 테두리와 `overdue-soft` 바탕은 이 글자를 담는 카드(CardItem)가 `data-overdue` 로 정한다.

const DUE_LABEL = '마감'
const NO_DUE_TEXT = '마감 없음'
const OVERDUE_ICON_LABEL = '마감 지남'

export interface DueTextProps {
  dueDate: DateString | null
  status: Status
  /** 오늘 (PC 현지 날짜). 보통 todayLocal(new Date()) 의 값. 시험에서 고정할 수 있게 받는다. */
  today: DateString
  className?: string
}

const DATE_PARTS = /^(\d{4})-(\d{2})-(\d{2})$/

/** `11/06`. 오늘과 해가 다르면 `2027/01/05`. 형식이 틀리면 받은 글자 그대로. */
export function formatDueDate(dueDate: DateString, today: DateString): string {
  const match = DATE_PARTS.exec(dueDate)
  if (match === null) return dueDate
  const [, year, month, day] = match
  return today.slice(0, 4) === year ? `${month}/${day}` : `${year}/${month}/${day}`
}

const baseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 14,
  lineHeight: '20px',
  whiteSpace: 'nowrap',
} as const

// 삼각형은 선·아이콘용 붉은색(overdue), 글자는 글자용 붉은색(overdue-text)이다.
const iconStyle = { display: 'inline-flex', color: 'var(--overdue)' } as const

export function DueText({ dueDate, status, today, className }: DueTextProps) {
  const classes = (extra: string) => (className ? `${extra} ${className}` : extra)

  if (dueDate === null) {
    return (
      <span className={classes('due-text due-text--none')} style={{ ...baseStyle, color: 'var(--text-mute)' }}>
        {NO_DUE_TEXT}
      </span>
    )
  }

  const days = isOverdue({ dueDate, status }, today) ? overdueDays({ dueDate, status }, today) : null
  const date = formatDueDate(dueDate, today)

  if (days !== null) {
    return (
      <span
        className={classes('due-text due-text--overdue')}
        style={{ ...baseStyle, color: 'var(--overdue-text)', fontWeight: 700 }}
        data-overdue="true"
      >
        <span style={iconStyle}>
          <Icon name="warning" label={OVERDUE_ICON_LABEL} />
        </span>
        {`${date} · ${days}일 지남`}
      </span>
    )
  }

  return (
    <span className={classes('due-text')} style={{ ...baseStyle, color: 'var(--text-sub)' }}>
      {`${DUE_LABEL} ${date}`}
    </span>
  )
}
