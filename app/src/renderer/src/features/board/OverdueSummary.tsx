import { Icon } from '../../common/Icon'

// 정보 줄 오른쪽의 `마감 지난 카드 N건` 요약 칩 (04-ui-spec.md SCR-001). 시선 위계 1순위라 `overdue` 면 + `overdue-on` 글자,
// 삼각형 아이콘 + 글자로 색 외 구분을 만든다 (NFR-004). N이 0이면 칩이 없다. 표시 전용이다: 누르는 요소가 아니다.
// 개수는 부르는 쪽이 board-model 의 overdueCount 로 구해 넘긴다 (판정은 date-rules 한 곳, AC-024, AC-025).

export interface OverdueSummaryProps {
  count: number
}

export function OverdueSummary({ count }: OverdueSummaryProps) {
  if (!(count > 0)) return null
  return (
    <span className="overdue-summary">
      <Icon name="warning" />
      {`마감 지난 카드 ${count}건`}
    </span>
  )
}
