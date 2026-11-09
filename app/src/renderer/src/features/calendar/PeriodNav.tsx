import type { ReactNode } from 'react'
import type { DateString } from '@shared/types/card'
import { Button, IconButton } from '../../common/Button'
import { periodTitle, shiftPeriod } from '../../model/calendar-model'
import type { CalendarMode } from '../../model/calendar-model'
import './calendar.css'

// 기간 제목과 이전·다음·오늘로 이동 (SCR-003, FR-005). 상단 막대에서 `보드로 돌아가기` 오른쪽을 채운다:
//   [기간 제목 ............ children(월|주 분할 버튼) ‹ › 오늘로 이동]
// 기준 날짜는 부르는 쪽(CalendarScreen)이 쥐고, 여기서는 새 기준 날짜만 돌려준다 (controlled).
// 제목과 이동 계산은 calendar-model 의 periodTitle / shiftPeriod 한 곳에서 한다.

export interface PeriodNavProps {
  mode: CalendarMode
  /** 지금 보고 있는 기간의 기준 날짜. */
  anchor: DateString
  /** 오늘 (PC 현지 날짜). `오늘로 이동`이 돌려줄 날짜. */
  today: DateString
  onAnchorChange: (anchor: DateString) => void
  /** 제목과 이동 버튼 사이에 놓을 것 (월 | 주 분할 버튼). */
  children?: ReactNode
}

const PERIOD_UNIT: Record<CalendarMode, string> = { month: '달', week: '주' }
const GO_TODAY_LABEL = '오늘로 이동'

export function PeriodNav({ mode, anchor, today, onAnchorChange, children }: PeriodNavProps) {
  const unit = PERIOD_UNIT[mode]
  return (
    <div className="period-nav">
      <h2 className="period-nav__title" aria-live="polite">
        {periodTitle(mode, anchor)}
      </h2>
      {children}
      <div className="period-nav__controls">
        <IconButton
          icon="chevron-left"
          label={`이전 ${unit}`}
          className="period-nav__step"
          onClick={() => onAnchorChange(shiftPeriod(mode, anchor, -1))}
        />
        <IconButton
          icon="chevron-right"
          label={`다음 ${unit}`}
          className="period-nav__step"
          onClick={() => onAnchorChange(shiftPeriod(mode, anchor, 1))}
        />
        <Button variant="primary" onClick={() => onAnchorChange(today)}>
          {GO_TODAY_LABEL}
        </Button>
      </div>
    </div>
  )
}
