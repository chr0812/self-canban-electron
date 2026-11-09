import { useCallback, useMemo, useState } from 'react'
import { todayLocal, weekdayOf } from '@shared/domain/date-rules'
import type { DateString, Status } from '@shared/types/card'
import { EmptyState } from '../../common/EmptyState'
import { buildBoardModel, overdueCount } from '../../model/board-model'
import { useData, useDispatch, useUi } from '../../state/app-state'
import { useChanges } from '../../state/change-runner'
import { Column } from './Column'
import { ConditionBar } from './ConditionBar'
import type { ConditionTarget } from './ConditionBar'
import { OverdueSummary } from './OverdueSummary'
import './board.css'

// SCR-001 보드 화면의 본문: 정보 줄(오늘, 마감 지난 카드 요약), 조건 줄, 결과 없음 표시, 칸 세 개.
// 사이드바·상단 막대(검색, 카드 만들기)·하단 줄·저장 실패 알림 줄·읽기 실패 패널은 AppShell/TopBar 의 일이다.
// - 칸 이동·보관은 ChangeRunner 에 요청만 보낸다. 저장이 성공해야 카드가 옮겨지거나 사라지고, 실패하면 화면은 그대로다
//   (알림 줄의 `다시 저장` 이 같은 요청을 다시 보낸다). 이 파일은 결과를 기다려 화면을 바꾸지 않는다.
// - 마감 지남은 그릴 때마다 todayLocal(new Date()) 로 새로 구한 오늘로 판정한다 (저장하지 않는다, UC-008).
// - 끌리는 카드 id 는 이 화면의 상태에 둔다 (dataTransfer 에도 CardItem 이 둔다, ADR-010).

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const
const NO_RESULTS_TEXT = '조건에 맞는 카드가 없습니다.'

/** `오늘 11월 3일 화요일`. 날짜 계산은 date-rules 에 맡기고 여기서는 글자만 만든다. */
function todayLine(today: DateString): string {
  const [, month, day] = today.split('-')
  const weekday = WEEKDAY_NAMES[weekdayOf(today)] ?? ''
  return `오늘 ${Number(month)}월 ${Number(day)}일 ${weekday}요일`
}

export function BoardScreen() {
  const { boardCards } = useData()
  const { board: conditions } = useUi()
  const dispatch = useDispatch()
  const changes = useChanges()
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const today = todayLocal(new Date())
  const model = useMemo(() => buildBoardModel(boardCards, 'board', conditions), [boardCards, conditions])
  const overdue = overdueCount(boardCards, today) // 조건과 무관하게 보드 전체 기준 (조건 줄은 결과 건수를 따로 보인다)
  const draggingStatus =
    draggingId === null ? null : (boardCards.find((card) => card.id === draggingId)?.status ?? null)

  const openCard = useCallback(
    (id: string) => dispatch({ type: 'ui/dialog_opened', dialog: { mode: 'edit', cardId: id } }),
    [dispatch],
  )
  const createCard = useCallback(
    () => dispatch({ type: 'ui/dialog_opened', dialog: { mode: 'new', cardId: null } }),
    [dispatch],
  )
  const moveCard = useCallback(
    (id: string, to: Status) => {
      void changes.moveCard(id, to)
    },
    [changes],
  )
  const archiveCard = useCallback(
    (id: string) => {
      void changes.archiveCard(id)
    },
    [changes],
  )
  const dropCard = useCallback(
    (id: string, to: Status) => {
      setDraggingId(null)
      void changes.moveCard(id, to)
    },
    [changes],
  )
  const endDrag = useCallback(() => setDraggingId(null), [])

  function clearCondition(target: ConditionTarget) {
    if (target === 'all') dispatch({ type: 'ui/conditions_cleared', scope: 'board' })
    else if (target === 'search')
      dispatch({ type: 'ui/conditions_changed', scope: 'board', patch: { text: undefined } })
    else if (target === 'kind') dispatch({ type: 'ui/conditions_changed', scope: 'board', patch: { kind: undefined } })
    else dispatch({ type: 'ui/conditions_changed', scope: 'board', patch: { priority: undefined } })
  }

  return (
    <div className="board-screen">
      <div className="board-info">
        <span className="board-info__today">{todayLine(today)}</span>
        <OverdueSummary count={overdue} />
      </div>
      <ConditionBar
        search={conditions.text ?? ''}
        kind={conditions.kind}
        priority={conditions.priority}
        resultCount={model.shownCount}
        totalCount={model.totalCount}
        onClear={clearCondition}
      />
      {model.noResults ? (
        <div style={{ padding: '0 16px' }}>
          <EmptyState icon="search" message={NO_RESULTS_TEXT} />
        </div>
      ) : null}
      <div className="board-columns">
        {model.columns.map((column) => (
          <Column
            key={column.status}
            status={column.status}
            cards={column.cards}
            count={column.count}
            today={today}
            hasConditions={model.hasConditions}
            isEmptyBoard={model.isEmptyBoard}
            draggingId={draggingId}
            draggingStatus={draggingStatus}
            onOpen={openCard}
            onMove={moveCard}
            onArchive={archiveCard}
            onDragStart={setDraggingId}
            onDragEnd={endDrag}
            onDropCard={dropCard}
            onCreate={createCard}
          />
        ))}
      </div>
    </div>
  )
}
