// 보드·보관함·사이드바의 표시 모델 계산 (순수, React·DOM 없음).
// 칸 나누기, 조건 적용(matchesQuery), 건수, 마감 지난 카드 수, 화면에 보일 순서.
// 칸 안 순서는 사용자가 정하지 않았다(CAND-005). 임시 가정은 orderForDisplay 한 곳에만 둔다.

import { STATUSES } from '@shared/constants'
import { isOverdue } from '@shared/domain/date-rules'
import { matchesQuery } from '@shared/domain/query-filter'
import type { Card, CardQuery, DateString, Kind, Priority, Status } from '@shared/types/card'

export type CardScope = CardQuery['scope']

/** 화면에서 거는 조건. scope 는 화면이 정하므로 여기에 없다. */
export type Conditions = {
  text?: string
  kind?: Kind
  priority?: Priority
}

/** 칸 머리 건수. 조건이 없으면 shown 과 total 이 같다 (`2 / 6` 모양에 쓴다). */
export type ColumnCount = { shown: number; total: number }

export type BoardColumn = {
  status: Status
  /** 조건에 맞는 카드. 화면에 보일 순서. */
  cards: Card[]
  count: ColumnCount
}

export type FilterCounts = {
  /** 범위 목록의 카드 수 (필터·검색의 영향을 받지 않는다). */
  total: number
  byKind: Record<Kind, number>
  /** 우선순위가 없는 카드는 어느 우선순위에도 세지 않는다. */
  byPriority: Record<Priority, number>
}

export type BoardModel = {
  /** STATUSES 순서(할 일, 진행 중, 완료)의 세 칸. */
  columns: BoardColumn[]
  /** 조건에 맞는 카드 전체, 화면에 보일 순서 (보관함 목록용). */
  list: Card[]
  /** 실제로 적용 중인 조건 (빈 검색어는 담지 않는다). */
  conditions: Conditions
  hasConditions: boolean
  /** 범위 안 카드 수 (조건 무시). */
  totalCount: number
  /** 조건에 맞는 카드 수. */
  shownCount: number
  /** 조건이 있고 맞는 카드가 0건 (AC-036). */
  noResults: boolean
  /** 조건 없이 범위 안 카드가 0건 (AC-006). noResults 와 동시에 참이 되지 않는다. */
  isEmptyBoard: boolean
}

function emptyByStatus<T>(make: () => T): Record<Status, T> {
  return { todo: make(), in_progress: make(), done: make() }
}

/** 카드를 상태별로 나눈다. 받은 순서를 유지하고 카드는 정확히 한 칸에만 들어간다 (AC-005). */
export function splitByStatus(cards: readonly Card[]): Record<Status, Card[]> {
  const result = emptyByStatus<Card[]>(() => [])
  for (const card of cards) result[card.status].push(card)
  return result
}

/** scope 와 검색어·종류·우선순위를 모두 만족하는 카드만 남긴다. 순서는 그대로 (AC-026~028). */
export function applyConditions(cards: readonly Card[], query: CardQuery): Card[] {
  return cards.filter((card) => matchesQuery(card, query))
}

/** 사이드바 필터 숫자: 받은 카드 전체의 수, 종류별, 우선순위별. */
export function countFilters(cards: readonly Card[]): FilterCounts {
  const result: FilterCounts = {
    total: cards.length,
    byKind: { bug: 0, task: 0 },
    byPriority: { high: 0, medium: 0, low: 0 },
  }
  for (const card of cards) {
    result.byKind[card.kind] += 1
    if (card.priority !== null) result.byPriority[card.priority] += 1
  }
  return result
}

/** 칸 머리 건수. all 은 조건 전의 카드, shown 은 조건에 맞는 카드. */
export function columnCounts(all: readonly Card[], shown: readonly Card[]): Record<Status, ColumnCount> {
  const total = splitByStatus(all)
  const visible = splitByStatus(shown)
  const result = emptyByStatus<ColumnCount>(() => ({ shown: 0, total: 0 }))
  for (const status of STATUSES) {
    result[status] = { shown: visible[status].length, total: total[status].length }
  }
  return result
}

/** 마감이 지난 카드 수 (완료는 세지 않는다). 오늘은 부르는 쪽이 구해서 넘긴다. */
export function overdueCount(cards: readonly Card[], today: DateString): number {
  let count = 0
  for (const card of cards) if (isOverdue(card, today)) count += 1
  return count
}

/**
 * 화면에 보일 순서. 정렬 정책이 정해지지 않아(CAND-005) 임시 가정을 쓴다 (04-ui-spec 결정 필요 1).
 * - board: 만든 순서의 최신이 위. createdAt 이 같으면 나중에 저장된(배열 뒤쪽) 카드가 위.
 * - archive: 보관한 날(archivedAt)이 최신인 것이 위. 같으면 나중에 저장된 카드가 위.
 * 마감 지난 카드를 위로 올리지 않는다. 정렬이 정해지면 이 함수만 바뀐다. 입력 배열은 바꾸지 않는다.
 */
export function orderForDisplay(cards: readonly Card[], scope: CardScope): Card[] {
  const keyOf = (card: Card): string => (scope === 'archive' ? (card.archivedAt ?? '') : card.createdAt)
  return cards
    .map((card, index) => ({ card, index, key: keyOf(card) }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key < b.key ? 1 : -1
      return b.index - a.index
    })
    .map((item) => item.card)
}

function effectiveConditions(conditions: Conditions): Conditions {
  const result: Conditions = {}
  const text = conditions.text?.trim()
  if (text !== undefined && text !== '') result.text = text
  if (conditions.kind !== undefined) result.kind = conditions.kind
  if (conditions.priority !== undefined) result.priority = conditions.priority
  return result
}

/**
 * 범위 목록(조건 없이 받은 카드)과 조건으로 보드·보관함 표시 모델을 만든다.
 * scope 밖의 카드(예: 보드에 섞인 보관 카드)는 totalCount 에도 세지 않는다.
 */
export function buildBoardModel(cards: readonly Card[], scope: CardScope, conditions: Conditions = {}): BoardModel {
  const applied = effectiveConditions(conditions)
  const hasConditions = Object.keys(applied).length > 0

  const inScope = applyConditions(cards, { scope })
  const shown = orderForDisplay(applyConditions(inScope, { scope, ...applied }), scope)
  const counts = columnCounts(inScope, shown)
  const byStatus = splitByStatus(shown)

  return {
    columns: STATUSES.map((status) => ({ status, cards: byStatus[status], count: counts[status] })),
    list: shown,
    conditions: applied,
    hasConditions,
    totalCount: inScope.length,
    shownCount: shown.length,
    noResults: hasConditions && shown.length === 0,
    isEmptyBoard: !hasConditions && inScope.length === 0,
  }
}
