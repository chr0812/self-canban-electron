// 검색·필터 조건 판정 한 곳 (ASM-012). main 의 cards.list 와 renderer 의 화면 필터가 같은 함수를 쓴다.
// 순수 함수: 카드 하나와 조건을 받아 맞는지만 돌려준다.

import type { Card, CardQuery } from '../types/card'

/** 비교용으로 앞뒤 공백을 빼고 대소문자를 없앤다. */
function normalizeForSearch(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * 카드가 조건에 맞는지 판정한다. 모든 조건은 AND 로 묶인다.
 * - scope: 'board' 는 보관하지 않은 카드, 'archive' 는 보관한 카드 (AC-028).
 * - text: 제목에 들어 있는 글자. 대소문자·앞뒤 공백 무시, 비면 조건 없음 (AC-026).
 * - kind, priority: 그 값을 가진 카드만. 우선순위가 없는 카드는 우선순위 조건에 맞지 않는다 (AC-027).
 */
export function matchesQuery(card: Card, query: CardQuery): boolean {
  const isArchived = card.archivedAt !== null
  if (query.scope === 'board' ? isArchived : !isArchived) return false

  if (query.text !== undefined) {
    const needle = normalizeForSearch(query.text)
    if (needle !== '' && !normalizeForSearch(card.title).includes(needle)) return false
  }
  if (query.kind !== undefined && card.kind !== query.kind) return false
  if (query.priority !== undefined && card.priority !== query.priority) return false
  return true
}
