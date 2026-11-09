import type { ReactNode } from 'react'
import { Button } from '../common/Button'
import { Icon } from '../common/Icon'
import { SearchBox } from '../common/SearchBox'
import { useData, useDispatch, useUi } from '../state/app-state'
import type { ConditionScope } from '../state/state-types'

// 화면마다 다른 상단 막대 (높이 56, 04-ui-spec.md SCR-001·003·004).
//   보드:     [검색 380 ........................ + 카드 만들기 140]
//   보관함:   [< 보드로 돌아가기] [보관함 ........ 검색 380]
//   캘린더:   [< 보드로 돌아가기] [children: 기간 제목·월|주·이동]  (검색·카드 만들기 없음: 캘린더는 조건을 적용하지 않는다)
// 읽기 실패(DataState.boot 가 read_failed)에서는 모든 조작이 disabled 이다 (AC-032).
// 검색어는 UiState 의 해당 화면 조건(text)에 바로 반영한다. 빈 글자는 조건을 지운다.
// 상태는 UiAction 만 보낸다 (data/·save/ 는 ChangeRunner 와 Bootstrap).

const BACK_LABEL = '보드로 돌아가기'
const ARCHIVE_TITLE = '보관함'
const CREATE_LABEL = '카드 만들기'

export interface TopBarProps {
  /** 캘린더 막대에서 `보드로 돌아가기` 오른쪽에 놓을 것 (CalendarScreen 이 쥔 기간 이동·월|주 분할 버튼). */
  children?: ReactNode
}

export function TopBar({ children }: TopBarProps) {
  const ui = useUi()
  const { boot } = useData()
  const dispatch = useDispatch()
  const disabled = boot.phase === 'read_failed'
  const { screen } = ui

  const scope: ConditionScope | null = screen === 'board' ? 'board' : screen === 'archive' ? 'archive' : null
  const search =
    scope === null ? null : (
      <div className="top-bar__search">
        <SearchBox
          value={ui[scope].text ?? ''}
          disabled={disabled}
          onChange={(value) =>
            dispatch({ type: 'ui/conditions_changed', scope, patch: { text: value === '' ? undefined : value } })
          }
          onClear={() => dispatch({ type: 'ui/conditions_changed', scope, patch: { text: undefined } })}
        />
      </div>
    )

  return (
    <header className="top-bar" data-screen={screen}>
      {screen !== 'board' ? (
        <Button
          className="top-bar__back"
          disabled={disabled}
          onClick={() => dispatch({ type: 'ui/screen_set', screen: 'board' })}
        >
          <Icon name="chevron-left" />
          {BACK_LABEL}
        </Button>
      ) : null}
      {screen === 'archive' ? <h1 className="top-bar__title">{ARCHIVE_TITLE}</h1> : null}
      {screen === 'board' ? search : null}
      <div className="top-bar__spacer">{screen === 'calendar' ? children : null}</div>
      {screen === 'archive' ? search : null}
      {screen === 'board' ? (
        <Button
          variant="primary"
          icon="plus"
          className="top-bar__create"
          disabled={disabled}
          onClick={() => dispatch({ type: 'ui/dialog_opened', dialog: { mode: 'new', cardId: null } })}
        >
          {CREATE_LABEL}
        </Button>
      ) : null}
    </header>
  )
}
