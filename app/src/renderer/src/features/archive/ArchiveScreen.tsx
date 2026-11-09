import { useCallback, useMemo } from 'react'
import type { Card } from '@shared/types/card'
import { EmptyState } from '../../common/EmptyState'
import { buildBoardModel } from '../../model/board-model'
import { useChanges } from '../../state/change-runner'
import { useData, useDispatch, useUi } from '../../state/app-state'
import type { ConditionTarget } from '../board/ConditionBar'
import { ConditionBar } from '../board/ConditionBar'
import { ArchiveRow } from './ArchiveRow'
import '../board/board.css'
import './archive.css'

// 보관함 화면 SCR-004 (FR-010, FR-011, FR-013). 상단 막대(보드로 돌아가기, 제목, 검색)와 하단 줄(보관함 N건)은
// AppShell 이 소유하며 이 화면은 그리지 않는다. 이 화면은 본문인 정보 줄, 조건 줄, 열 머리와 목록(ArchiveList)을 그린다.
// - 목록: DataState.archiveCards(조건 없이 받은 보관 카드 전체)에 보관함 조건(UiState.archive)을 걸어 보인다 (AC-028).
//   보드 조건과 따로 쥐며 보드 화면의 검색에는 보관한 카드가 나오지 않는다.
// - 행 열기: 보기 전용 대화상자를 연다 (ui/dialog_opened mode 'readonly'). 수정·기록 추가는 대화상자가 막는다 (ASM-015).
// - 행 삭제: `삭제 확인` 뒤에만 ChangeRunner.deleteCard 를 부른다. 저장이 성공해야 DataState 에서 카드가 빠져 행이 사라지고,
//   실패하면 행은 확인 줄 그대로이며 저장 실패 알림 줄은 AppShell 이 보인다 (낙관적 반영 없음, AC-040, AC-031).
// - 읽는 화면이라 마감 지남 표시를 쓰지 않는다.

const INFO_SUFFIX = '보기만 할 수 있습니다'
const EMPTY_TEXT = '보관한 카드가 없습니다. 완료한 카드에서 보관을 누르면 이곳에 모입니다.'
const NO_RESULT_TEXT = '조건에 맞는 보관한 카드가 없습니다.'
const HEADERS = ['제목', '종류', '마감', '우선순위', '보관한 날'] as const

export function ArchiveScreen() {
  const { archiveCards } = useData()
  const { archive: conditions } = useUi()
  const dispatch = useDispatch()
  const changes = useChanges()

  const model = useMemo(() => buildBoardModel(archiveCards, 'archive', conditions), [archiveCards, conditions])

  const clearCondition = useCallback(
    (target: ConditionTarget) => {
      if (target === 'all') {
        dispatch({ type: 'ui/conditions_cleared', scope: 'archive' })
        return
      }
      const patch =
        target === 'search' ? { text: undefined } : target === 'kind' ? { kind: undefined } : { priority: undefined }
      dispatch({ type: 'ui/conditions_changed', scope: 'archive', patch })
    },
    [dispatch],
  )

  const openCard = useCallback(
    (card: Card) => dispatch({ type: 'ui/dialog_opened', dialog: { mode: 'readonly', cardId: card.id } }),
    [dispatch],
  )

  // 삭제 요청 결과는 ChangeRunner 가 상태에 반영한다 (성공: 카드 제거, 실패: 알림 줄). 행은 끝날 때까지만 기다린다.
  const deleteCard = useCallback((card: Card) => changes.deleteCard(card.id), [changes])

  return (
    <section className="archive-screen" aria-label="보관함">
      <div className="archive-info">
        <span className="archive-info__text">{`보관한 카드 ${model.totalCount}건 · ${INFO_SUFFIX}`}</span>
      </div>
      <ConditionBar
        search={conditions.text ?? ''}
        kind={conditions.kind}
        priority={conditions.priority}
        resultCount={model.shownCount}
        totalCount={model.totalCount}
        onClear={clearCondition}
      />
      <div className="archive-body">
        <div className="archive-head" aria-hidden="true">
          {HEADERS.map((name) => (
            <span key={name} className="archive-head__cell">
              {name}
            </span>
          ))}
        </div>
        {model.isEmptyBoard ? <EmptyState message={EMPTY_TEXT} muted /> : null}
        {model.noResults ? <EmptyState message={NO_RESULT_TEXT} icon="search" /> : null}
        {model.list.length > 0 ? (
          <ul className="archive-list" aria-label="보관한 카드">
            {model.list.map((card) => (
              <ArchiveRow key={card.id} card={card} onOpen={openCard} onDelete={deleteCard} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
