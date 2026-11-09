// 카드 만들기·수정·상태 변경·보관·삭제 규칙 (docs/05-design/03-api-spec.md 카드 변경, 02-data-model.md Card).
// 순서는 변경 동작의 공통 순서와 같다: 입력 검증 -> 대상 카드(CARD_NOT_FOUND) -> 보관 여부(CARD_ARCHIVED) -> 동작별 조건.
// 저장소 상태(STORE_LOCKED)와 저장은 이 모듈의 일이 아니다. 순수 함수라 받은 문서를 바꾸지 않는다.

import type { Card, CardCreateInput, CardPatch, DataFile, Status } from '../types/card'
import type { Result } from '../types/result'
import { fail, ok } from './rule-support'
import type { RuleContext, RuleOutcome } from './rule-support'
import { normalizeTitle, validateCardInput, validateStatus } from './validation'

/** 카드 삭제 결과. 카드와 그 카드의 진행 기록을 한 번에 지운다. */
export type DeleteResult = { deletedCardId: string; deletedProgressCount: number }

function validationFailed(message: string, violations: unknown): Result<never> {
  return fail('VALIDATION_FAILED', message, { violations })
}

function notFound(id: string): Result<never> {
  return fail('CARD_NOT_FOUND', `카드를 찾을 수 없다: ${id}`, { id })
}

function archived(id: string, what: string): Result<never> {
  return fail('CARD_ARCHIVED', `보관된 카드는 ${what} 수 없다: ${id}`)
}

/** 카드 하나를 같은 자리에서 바꾼 새 문서. */
function replaceCard(doc: DataFile, next: Card): DataFile {
  return { ...doc, cards: doc.cards.map((c) => (c.id === next.id ? next : c)) }
}

/** 바뀐 것이 없을 때의 성공: 받은 문서와 카드를 그대로 돌려주고 저장하지 않는다. */
function unchanged(doc: DataFile, card: Card): RuleOutcome<Card> {
  return ok({ next: doc, value: card, changed: false })
}

/**
 * 새 카드를 만든다.
 * - 새 카드의 상태는 입력 status (검증을 통과한 'todo' | 'in_progress'), 생략하면 'todo' (AC-001, AC-041).
 *   'done' 등 그 밖의 값은 검증에서 status/INVALID_VALUE 로 거절된다 (AC-042).
 *   진행 중으로 만들어도 진행 기록(ProgressEntry)은 만들지 않는다.
 * - 생략한 항목은 기본값: kind 'task', description '', dueDate null, priority null, memo ''.
 * - title 은 앞뒤 공백을 뺀 값을 저장한다. id 와 createdAt 은 ctx 가 정한다. 카드는 목록 맨 뒤에 붙는다.
 */
export function createCard(doc: DataFile, input: unknown, ctx: RuleContext): RuleOutcome<Card> {
  const violations = validateCardInput(input, 'create')
  if (violations.length > 0) {
    return validationFailed('카드 입력이 검증 규칙을 어겼다', violations)
  }

  const given = input as CardCreateInput
  const card: Card = {
    id: ctx.newId(),
    title: normalizeTitle(given.title),
    status: given.status ?? 'todo',
    kind: given.kind ?? 'task',
    description: given.description ?? '',
    dueDate: given.dueDate ?? null,
    priority: given.priority ?? null,
    memo: given.memo ?? '',
    archivedAt: null,
    createdAt: ctx.now().toISOString(),
  }
  const next: DataFile = { ...doc, cards: [...doc.cards, card] }
  return ok({ next, value: card, changed: true })
}

/**
 * 보낸 항목만 바꾼다. dueDate·priority 는 null 로 비운다.
 * 바뀐 값이 하나도 없으면(빈 patch 포함) 현재 카드 그대로 changed=false.
 * 보관된 카드는 CARD_ARCHIVED. id·archivedAt·createdAt 은 patch 로 받지 않는다 (UNKNOWN_FIELD).
 */
// ctx 는 설계 시그니처(updateCard(doc, id, patch, ctx))를 맞추려고 받는다. 수정은 시각·아이디를 쓰지 않는다.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function updateCard(doc: DataFile, id: string, patch: unknown, _ctx?: RuleContext): RuleOutcome<Card> {
  const violations = validateCardInput(patch, 'update')
  if (violations.length > 0) {
    return validationFailed('카드 수정 입력이 검증 규칙을 어겼다', violations)
  }

  const card = doc.cards.find((c) => c.id === id)
  if (card === undefined) return notFound(id)
  if (card.archivedAt !== null) return archived(id, '수정할')

  const given = patch as CardPatch
  const merged: Card = { ...card }
  if (given.title !== undefined) merged.title = normalizeTitle(given.title)
  if (given.kind !== undefined) merged.kind = given.kind
  if (given.status !== undefined) merged.status = given.status
  if (given.description !== undefined) merged.description = given.description
  if (given.dueDate !== undefined) merged.dueDate = given.dueDate
  if (given.priority !== undefined) merged.priority = given.priority
  if (given.memo !== undefined) merged.memo = given.memo

  const same =
    merged.title === card.title &&
    merged.kind === card.kind &&
    merged.status === card.status &&
    merged.description === card.description &&
    merged.dueDate === card.dueDate &&
    merged.priority === card.priority &&
    merged.memo === card.memo
  if (same) return unchanged(doc, card)

  return ok({ next: replaceCard(doc, merged), value: merged, changed: true })
}

/**
 * 상태를 바꾼다. todo / in_progress / done 사이에서 어느 방향으로든 가능하다.
 * 같은 상태면 changed=false. 'archived' 는 상태 값이 아니라 status/INVALID_VALUE (AC-004).
 */
export function changeStatus(doc: DataFile, id: string, status: unknown): RuleOutcome<Card> {
  const violations = validateStatus(status)
  if (violations.length > 0) {
    return validationFailed('상태 값이 검증 규칙을 어겼다', violations)
  }

  const card = doc.cards.find((c) => c.id === id)
  if (card === undefined) return notFound(id)
  if (card.archivedAt !== null) return archived(id, '상태를 바꿀')

  if (card.status === status) return unchanged(doc, card)

  const moved: Card = { ...card, status: status as Status }
  return ok({ next: replaceCard(doc, moved), value: moved, changed: true })
}

/**
 * 완료 카드를 보관한다. archivedAt 에 ctx 시각을 채우고 status 는 done 그대로다.
 * 이미 보관된 카드는 CARD_ARCHIVED, 완료가 아니면 ARCHIVE_NOT_ALLOWED (details.status).
 */
export function archiveCard(doc: DataFile, id: string, ctx: RuleContext): RuleOutcome<Card> {
  const card = doc.cards.find((c) => c.id === id)
  if (card === undefined) return notFound(id)
  if (card.archivedAt !== null) return archived(id, '다시 보관할')
  if (card.status !== 'done') {
    return fail('ARCHIVE_NOT_ALLOWED', `완료한 카드만 보관할 수 있다: 지금 상태 ${card.status}`, {
      status: card.status,
    })
  }

  const kept: Card = { ...card, archivedAt: ctx.now().toISOString() }
  return ok({ next: replaceCard(doc, kept), value: kept, changed: true })
}

/**
 * 카드와 그 카드의 진행 기록을 함께 지운다. 보관 여부는 보지 않는다 (AC-040).
 * 삭제 전 확인 단계(AC-033)는 화면의 일이다.
 */
export function deleteCard(doc: DataFile, id: string): RuleOutcome<DeleteResult> {
  const card = doc.cards.find((c) => c.id === id)
  if (card === undefined) return notFound(id)

  const remaining = doc.progressEntries.filter((e) => e.cardId !== id)
  const next: DataFile = {
    ...doc,
    cards: doc.cards.filter((c) => c.id !== id),
    progressEntries: remaining,
  }
  const value: DeleteResult = {
    deletedCardId: id,
    deletedProgressCount: doc.progressEntries.length - remaining.length,
  }
  return ok({ next, value, changed: true })
}
