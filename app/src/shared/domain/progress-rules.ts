// 진행 기록 추가 규칙 (docs/05-design/03-api-spec.md progress.add, 02-data-model.md ProgressEntry).
// 순서는 변경 동작의 공통 순서와 같다: 입력 검증 -> 대상 카드(CARD_NOT_FOUND) -> 보관 여부(CARD_ARCHIVED).
// 저장소 상태(STORE_LOCKED)와 저장은 이 모듈의 일이 아니다. 순수 함수라 받은 문서를 바꾸지 않는다.

import type { DataFile, ProgressEntry } from '../types/card'
import { fail, ok } from './rule-support'
import type { RuleContext, RuleOutcome } from './rule-support'
import { normalizeTitle, validateProgressInput } from './validation'

/**
 * 카드에 진행 기록을 하나 더한다.
 * - 기록은 목록 맨 뒤에 붙는다 (남긴 순서).
 * - statusAtTime 은 호출 순간 카드의 status 로 채운다. 입력으로는 받지 않는다 (UNKNOWN_FIELD).
 * - content 는 앞뒤 공백을 뺀 값을 저장한다.
 * - 추가는 항상 문서를 바꾸므로 changed 는 true 다.
 */
export function addProgress(
  doc: DataFile,
  cardId: string,
  input: unknown,
  ctx: RuleContext,
): RuleOutcome<ProgressEntry> {
  const violations = validateProgressInput(input)
  if (violations.length > 0) {
    return fail('VALIDATION_FAILED', '진행 기록 입력이 검증 규칙을 어겼다', { violations })
  }

  const card = doc.cards.find((c) => c.id === cardId)
  if (card === undefined) {
    return fail('CARD_NOT_FOUND', `카드를 찾을 수 없다: ${cardId}`, { id: cardId })
  }
  if (card.archivedAt !== null) {
    return fail('CARD_ARCHIVED', `보관된 카드에는 기록을 추가할 수 없다: ${cardId}`)
  }

  const { content } = input as { content: string }
  const entry: ProgressEntry = {
    id: ctx.newId(),
    cardId: card.id,
    content: normalizeTitle(content),
    statusAtTime: card.status,
    createdAt: ctx.now().toISOString(),
  }
  const next: DataFile = { ...doc, progressEntries: [...doc.progressEntries, entry] }
  return ok({ next, value: entry, changed: true })
}
