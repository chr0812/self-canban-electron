// 목록·상세 조회 규칙 (docs/05-design/03-api-spec.md cards.list, cards.get).
// 순수 모듈이다: 문서를 읽기만 하고 바꾸지 않는다. 읽기 실패(STORE_LOCKED)는 저장소의 일이다.

import type { Card, CardDetail, DataFile } from '../types/card'
import { fail, ok } from './rule-support'
import type { Result } from '../types/result'
import { matchesQuery } from './query-filter'
import { validateCardQuery, validateId } from './validation'

/**
 * 목록 조회. 범위(scope)와 text·kind·priority 조건을 AND 로 적용하고 저장 순서(만든 순서)를 지킨다.
 * 맞는 카드가 없으면 빈 배열이고 오류가 아니다 (AC-006, AC-036).
 * - 입력 모양이 틀리면 VALIDATION_FAILED (위반을 모두 담는다).
 */
export function listCards(doc: DataFile, query: unknown): Result<Card[]> {
  const violations = validateCardQuery(query)
  if (violations.length > 0) {
    return fail('VALIDATION_FAILED', '목록 조회 조건이 올바르지 않다', { violations })
  }
  const checked = query as Parameters<typeof matchesQuery>[1]
  return ok(doc.cards.filter((card) => matchesQuery(card, checked)))
}

/**
 * 상세 조회. 카드 한 장과 그 카드의 진행 기록(남긴 순서)을 돌려준다.
 * 보관한 카드도 읽을 수 있다 (AC-020). 없는 아이디는 CARD_NOT_FOUND.
 */
export function getCardDetail(doc: DataFile, id: unknown): Result<CardDetail> {
  const violations = validateId(id)
  if (violations.length > 0) {
    return fail('VALIDATION_FAILED', '카드 아이디가 올바르지 않다', { violations })
  }
  const card = doc.cards.find((c) => c.id === id)
  if (card === undefined) {
    return fail('CARD_NOT_FOUND', `카드를 찾을 수 없다: ${String(id)}`, { id })
  }
  return ok({ card, progress: doc.progressEntries.filter((e) => e.cardId === card.id) })
}
