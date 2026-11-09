// 카드 입력칸 값(문자열) <-> CardCreateInput / CardPatch 변환 (순수, React·DOM 없음).
// 비운 마감일·우선순위는 null 로 바꾸고, 저장 전에 같은 검증(validateCardInput)으로 미리 확인한다 (AC-002, AC-029, AC-035).
// 오류는 입력칸 이름(field)과 이유(reason)를 가진 Violation 이라 violationText 로 문구를 붙일 수 있다.

import { normalizeTitle, validateCardInput } from '@shared/domain/validation'
import type { Card, CardCreateInput, CardPatch, CreateStatus, Kind, Priority, Status } from '@shared/types/card'
import type { Violation } from '@shared/types/result'

/** 입력칸이 들고 있는 값. 마감일·우선순위의 비움은 빈 문자열이다 (입력칸은 null 을 모른다). */
export type FormValues = {
  title: string
  kind: Kind
  /**
   * 새 카드 모드: 처음 값은 'todo', 만들기 입력의 status 가 된다 (고를 수 있는 값은 CREATE_STATUSES, AC-041·AC-042).
   * 수정 모드: 카드의 현재 상태이고 세 값 모두 가질 수 있다 (patch 의 status).
   */
  status: Status
  /** 비어 있거나 `YYYY-MM-DD` (날짜 입력칸이 내는 값). 앞뒤 공백은 변환할 때 뺀다. */
  dueDate: string
  /**
   * 날짜 입력칸의 `validity.badInput`. 칸 값은 ''인데 사용자가 일부만 입력한 상태다 (AC-029).
   * true 면 마감 없음(null)이 아니라 마감일 오류(INVALID_DATE)다. 칸을 지운 경우(빈 값)는 false.
   */
  dueDateBadInput: boolean
  /** '' 는 `없음`. */
  priority: Priority | ''
  description: string
  memo: string
}

/** 변환 결과. 오류가 있으면 저장 값은 만들어지지 않는다. */
export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: Violation[] }

/** 새 카드 입력칸의 처음 값 (종류 할 일, 상태 할 일, 나머지 비어 있음). */
export function emptyForm(): FormValues {
  return { title: '', kind: 'task', status: 'todo', dueDate: '', dueDateBadInput: false, priority: '', description: '', memo: '' }
}

/** 저장된 카드의 값을 입력칸에 채운다. null 은 빈 칸이 된다. */
export function formFromCard(card: Card): FormValues {
  return {
    title: card.title,
    kind: card.kind,
    status: card.status,
    dueDate: card.dueDate ?? '',
    dueDateBadInput: false,
    priority: card.priority ?? '',
    description: card.description,
    memo: card.memo,
  }
}

/** 마감일 칸: 공백뿐이면 null, 아니면 앞뒤 공백을 뺀 글자. */
function dueDateOf(values: FormValues): string | null {
  const text = values.dueDate.trim()
  return text === '' ? null : text
}

/** 우선순위 칸: '' 는 null. */
function priorityOf(values: FormValues): Priority | null {
  return values.priority === '' ? null : values.priority
}

function draftOf(values: FormValues): CardCreateInput {
  return {
    title: normalizeTitle(values.title),
    kind: values.kind,
    description: values.description,
    dueDate: dueDateOf(values),
    priority: priorityOf(values),
    memo: values.memo,
  }
}

/**
 * 저장 전 미리 검증. 위반은 한 번에 모두 돌려준다 (제목 `REQUIRED`, 마감일 `INVALID_DATE` 등).
 * 위반의 field 가 표시할 입력칸 이름이다. 없으면 빈 배열.
 * 마감일 입력하다 만 값 플래그가 켜져 있으면 마감일 `INVALID_DATE` 가 나온다 (AC-029).
 * 상태 칸은 보지 않는다 (만들기의 상태는 `toCreateInput` 이 확인한다).
 */
export function fieldErrors(values: FormValues): Violation[] {
  const errors = validateCardInput(draftOf(values), 'create')
  if (values.dueDateBadInput && !errors.some((e) => e.field === 'dueDate')) {
    errors.push({ field: 'dueDate', reason: 'INVALID_DATE' })
  }
  return errors
}

/**
 * 만들기 입력으로 바꾼다. 오류가 있으면 값을 만들지 않는다.
 * 입력의 status 는 입력칸에서 고른 값이다 ('todo' | 'in_progress'). 'done' 은 status 오류다 (AC-042).
 */
export function toCreateInput(values: FormValues): FormResult<CardCreateInput> {
  const draft: CardCreateInput = { ...draftOf(values), status: values.status as CreateStatus }
  const errors = fieldErrors(values)
  for (const e of validateCardInput(draft, 'create')) {
    if (e.field === 'status') errors.push(e)
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: draft }
}

/**
 * 수정 값으로 바꾼다. 저장된 카드와 다른 칸만 담는다 (바뀐 게 없으면 빈 객체).
 * 마감일·우선순위를 비웠으면 null 을 담아 값을 지운다. 오류가 있으면 값을 만들지 않는다.
 */
export function toPatch(values: FormValues, card: Card): FormResult<CardPatch> {
  const errors = fieldErrors(values)
  if (errors.length > 0) return { ok: false, errors }
  const draft = draftOf(values)
  const patch: CardPatch = {}
  if (draft.title !== card.title) patch.title = draft.title
  if (draft.kind !== undefined && draft.kind !== card.kind) patch.kind = draft.kind
  if (values.status !== card.status) patch.status = values.status
  if (draft.description !== undefined && draft.description !== card.description) patch.description = draft.description
  if (draft.dueDate !== undefined && draft.dueDate !== card.dueDate) patch.dueDate = draft.dueDate
  if (draft.priority !== undefined && draft.priority !== card.priority) patch.priority = draft.priority
  if (draft.memo !== undefined && draft.memo !== card.memo) patch.memo = draft.memo
  return { ok: true, value: patch }
}
