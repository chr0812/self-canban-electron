import type { ReactNode } from 'react'
import { KINDS, PRIORITIES, THEMES } from '@shared/constants'
import type { Kind, Priority, Theme } from '@shared/types/card'
import { Icon } from '../common/Icon'
import type { IconName } from '../common/Icon'
import { RadioRow } from '../common/RadioRow'
import { applyConditions, countFilters } from '../model/board-model'
import type { Conditions } from '../model/board-model'
import { useData, useDispatch, useSaveState, useUi } from '../state/app-state'
import type { ConditionScope, ScreenKey } from '../state/state-types'
import { useTheme } from '../state/theme-controller'
import { APP_NAME, FILTER_ALL_LABEL, KIND_LABEL, PRIORITY_LABEL, SAVE_INDICATOR_LABEL, THEME_LABEL } from '../text/labels'
import type { SaveIndicator } from '../text/labels'

// 사이드바 (208px): 앱 이름, 이동 3항목(건수), 종류·우선순위 필터(보드·보관함에서만), 화면 밝기, 저장 상태.
// NavList, FilterGroup, ThemeSwitch, SaveStatus 를 한 파일에 둔다 (06-file-map). 상태는 읽기만 하고,
// 화면 이동·조건은 UiAction 으로, 판은 ThemeController 로 바꾼다. 배치 스타일은 layout.css (AppShell).
// 읽기 실패 때는 이동·필터를 눌리지 않게 하고 밝기 전환만 남긴다 (SCR-001 에러: 읽기 실패).

const NAV_TITLE = '화면 이동'
const FILTER_KIND_TITLE = '종류'
const FILTER_PRIORITY_TITLE = '우선순위'
const THEME_TITLE = '화면 밝기'

const SCREENS: { key: ScreenKey; label: string }[] = [
  { key: 'board', label: '보드' },
  { key: 'calendar', label: '캘린더' },
  { key: 'archive', label: '보관함' },
]

const KIND_ICON: Record<Kind, IconName> = { bug: 'bug', task: 'task' }
const THEME_ICON: Record<Theme, IconName> = { dark: 'moon', light: 'sun' }

// 이동

interface NavListProps {
  current: ScreenKey
  /** 이동 항목 오른쪽 숫자. 없으면 숫자를 그리지 않는다 (캘린더, 또는 아직 읽지 못했을 때). */
  counts: Partial<Record<ScreenKey, number>>
  disabled: boolean
  onGo: (screen: ScreenKey) => void
}

function NavList({ current, counts, disabled, onGo }: NavListProps) {
  return (
    <nav className="sidebar__section sidebar-nav" aria-label={NAV_TITLE}>
      {SCREENS.map(({ key, label }) => {
        const count = counts[key]
        const isCurrent = key === current
        return (
          <button
            key={key}
            type="button"
            className="sidebar-nav__item"
            data-current={isCurrent ? 'true' : undefined}
            aria-current={isCurrent ? 'page' : undefined}
            disabled={disabled}
            onClick={() => onGo(key)}
          >
            <span className="sidebar-nav__label">{label}</span>
            {count === undefined ? null : <span className="sidebar-nav__count">{count}</span>}
          </button>
        )
      })}
    </nav>
  )
}

// 필터

interface FilterOption<T extends string> {
  value: T
  label: string
  icon?: IconName
  count?: number
}

interface FilterGroupProps<T extends string> {
  title: string
  options: FilterOption<T>[]
  /** 고른 값. 조건이 없으면 undefined (맨 위 `전체` 행이 선택된다). */
  selected: T | undefined
  /** 맨 위 `전체` 행의 건수 (countFilters 의 total). 없으면 숫자를 그리지 않는다. */
  allCount: number | undefined
  disabled: boolean
  /** 고른 값. `전체` 를 고르면 undefined (그 목록의 조건을 지운다). 고른 행을 다시 눌러도 해제하지 않는다. */
  onChange: (value: T | undefined) => void
}

function FilterGroup<T extends string>({
  title,
  options,
  selected,
  allCount,
  disabled,
  onChange,
}: FilterGroupProps<T>) {
  return (
    <div className="sidebar__section sidebar-filter" role="radiogroup" aria-label={title}>
      <div className="sidebar__heading">{title}</div>
      <RadioRow
        key="all"
        label={FILTER_ALL_LABEL}
        count={allCount}
        checked={selected === undefined}
        disabled={disabled}
        onSelect={() => onChange(undefined)}
      />
      {options.map((option) => (
        <RadioRow
          key={option.value}
          label={option.label}
          count={option.count}
          icon={option.icon ? <Icon name={option.icon} /> : undefined}
          checked={selected === option.value}
          disabled={disabled}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}

// 화면 밝기

function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="sidebar__section sidebar-theme" role="radiogroup" aria-label={THEME_TITLE}>
      <div className="sidebar__heading">{THEME_TITLE}</div>
      {THEMES.map((value) => (
        <RadioRow
          key={value}
          label={THEME_LABEL[value]}
          icon={<Icon name={THEME_ICON[value]} />}
          checked={theme === value}
          onSelect={() => setTheme(value)}
        />
      ))}
    </div>
  )
}

// 저장 상태

function indicatorIcon(indicator: SaveIndicator): ReactNode {
  if (indicator === 'saved') return <Icon name="check-circle" />
  if (indicator === 'failed' || indicator === 'read_failed') return <Icon name="error" />
  return null // 저장 중은 글자만 (반복 애니메이션 없음)
}

function SaveStatus({ indicator }: { indicator: SaveIndicator }) {
  return (
    <div className="sidebar__section sidebar-save" role="status" data-indicator={indicator}>
      {indicatorIcon(indicator)}
      <span className="sidebar-save__text">{SAVE_INDICATOR_LABEL[indicator]}</span>
    </div>
  )
}

// 조립

export function Sidebar() {
  const data = useData()
  const ui = useUi()
  const save = useSaveState()
  const dispatch = useDispatch()

  const ready = data.boot.phase === 'ready'
  const readFailed = data.boot.phase === 'read_failed' || save.status === 'unavailable'
  const indicator: SaveIndicator = readFailed || save.status === 'unavailable' ? 'read_failed' : save.status

  // 보드는 보관하지 않은 카드 전체, 보관함은 보관한 카드 수. 필터와 검색의 영향을 받지 않는다.
  const boardCards = applyConditions(data.boardCards, { scope: 'board' })
  const archiveCards = applyConditions(data.archiveCards, { scope: 'archive' })
  const navCounts: Partial<Record<ScreenKey, number>> = ready
    ? { board: boardCards.length, archive: archiveCards.length }
    : {}

  // 필터는 보드·보관함에서만 보인다 (캘린더는 항상 모든 카드, 결정 필요 7).
  const scope: ConditionScope | null = ui.screen === 'calendar' ? null : ui.screen
  const conditions: Conditions = scope === null ? {} : ui[scope]
  const counts = countFilters(scope === 'archive' ? archiveCards : boardCards)

  const setCondition = (patch: Conditions): void => {
    if (scope !== null) dispatch({ type: 'ui/conditions_changed', scope, patch })
  }

  const kindOptions: FilterOption<Kind>[] = KINDS.map((value) => ({
    value,
    label: KIND_LABEL[value],
    icon: KIND_ICON[value],
    count: ready ? counts.byKind[value] : undefined,
  }))
  const priorityOptions: FilterOption<Priority>[] = PRIORITIES.map((value) => ({
    value,
    label: PRIORITY_LABEL[value],
    count: ready ? counts.byPriority[value] : undefined,
  }))

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">{APP_NAME}</div>
      <NavList
        current={ui.screen}
        counts={navCounts}
        disabled={readFailed}
        onGo={(screen) => dispatch({ type: 'ui/screen_set', screen })}
      />
      {scope === null ? null : (
        <>
          <FilterGroup
            title={FILTER_KIND_TITLE}
            options={kindOptions}
            selected={conditions.kind}
            allCount={ready ? counts.total : undefined}
            disabled={readFailed}
            onChange={(kind) => setCondition({ kind })}
          />
          <FilterGroup
            title={FILTER_PRIORITY_TITLE}
            options={priorityOptions}
            selected={conditions.priority}
            allCount={ready ? counts.total : undefined}
            disabled={readFailed}
            onChange={(priority) => setCondition({ priority })}
          />
        </>
      )}
      <ThemeSwitch />
      <SaveStatus indicator={indicator} />
    </aside>
  )
}
