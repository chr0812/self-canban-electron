import type { Kind, Priority } from '@shared/types/card'
import { Button, IconButton } from '../../common/Button'
import { Chip } from '../../common/Chips'
import { KIND_LABEL, PRIORITY_LABEL } from '../../text/labels'

// 조건 줄 (보드 SCR-001 과 보관함 SCR-004 가 공유, FR-013). 조건이 하나라도 있을 때만 줄이 나온다:
// `검색: 세금 ×` `종류: 개발 버그 ×` `우선순위: 높음 ×` 칩, `조건 모두 지우기`, 오른쪽에 `결과 7건 / 전체 15건` (AC-026, AC-027).
// 조건이 없으면 아무것도 그리지 않는다. 바깥 요소(aria-live="polite")는 늘 있어서 결과 건수가 바뀌면 스크린리더가 알린다.
// 검색어는 앞뒤 공백을 뺀 값이 비면 조건이 아니다 (matchesQuery 와 같다). 값은 부모가 쥔다 (controlled).
// 검색 입력(SearchBox)은 상단 막대 소속이라 여기 없다. 이 줄은 걸린 조건을 보이고 지우는 일만 한다.

export type ConditionTarget = 'search' | 'kind' | 'priority' | 'all'

export interface ConditionBarProps {
  /** 지금 검색어. 빈 글자는 조건 없음. */
  search: string
  kind?: Kind | null
  priority?: Priority | null
  /** 조건에 맞는 카드 수. */
  resultCount: number
  /** 범위(보드 또는 보관함) 안 전체 카드 수. */
  totalCount: number
  /** 조건 칩의 ×(그 조건) 또는 `조건 모두 지우기`('all') 를 눌렀을 때. */
  onClear: (target: ConditionTarget) => void
}

const CLEAR_ALL_LABEL = '조건 모두 지우기'

function removeLabel(name: string): string {
  return `${name} 조건 지우기`
}

interface ConditionChipProps {
  name: string
  value: string
  onRemove: () => void
}

function ConditionChip({ name, value, onRemove }: ConditionChipProps) {
  return (
    <Chip className="condition-chip">
      <span className="condition-chip__text" title={`${name}: ${value}`}>
        {`${name}: ${value}`}
      </span>
      <IconButton icon="close" label={removeLabel(name)} className="condition-chip__remove" onClick={onRemove} />
    </Chip>
  )
}

export function ConditionBar({ search, kind, priority, resultCount, totalCount, onClear }: ConditionBarProps) {
  const searchText = search.trim()
  const hasSearch = searchText !== ''
  const hasKind = kind !== undefined && kind !== null
  const hasPriority = priority !== undefined && priority !== null
  const hasConditions = hasSearch || hasKind || hasPriority

  return (
    <div aria-live="polite">
      {hasConditions ? (
        <div className="condition-bar">
          <div className="condition-bar__chips">
            {hasSearch ? <ConditionChip name="검색" value={searchText} onRemove={() => onClear('search')} /> : null}
            {hasKind ? <ConditionChip name="종류" value={KIND_LABEL[kind]} onRemove={() => onClear('kind')} /> : null}
            {hasPriority ? (
              <ConditionChip name="우선순위" value={PRIORITY_LABEL[priority]} onRemove={() => onClear('priority')} />
            ) : null}
            <Button small variant="text" onClick={() => onClear('all')}>
              {CLEAR_ALL_LABEL}
            </Button>
          </div>
          <span className="condition-bar__count">{`결과 ${resultCount}건 / 전체 ${totalCount}건`}</span>
        </div>
      ) : null}
    </div>
  )
}
