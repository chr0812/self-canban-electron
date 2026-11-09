// 입력 검증 (docs/05-design/02-data-model.md "검증 규칙과 제약 매핑", 03-api-spec.md 검증 위반 값).
// 모든 입력을 unknown 으로 받아 모양부터 확인하고, 위반은 첫 번째에서 멈추지 않고 모아서 돌려준다.
// 위반이 없으면 빈 배열이다. 순수 모듈이다: 파일·시계를 모른다.
// 길이 상한은 두지 않는다 (제목·설명·메모·기록 내용의 상한은 정해지지 않았다).

import { CREATE_STATUSES, KINDS, PRIORITIES, STATUSES, THEMES } from '../constants'
import type { Violation, ViolationReason } from '../types/result'
import { isRealDate } from './date-rules'

/** 입력 전체가 객체가 아닐 때 쓰는 field 이름. */
export const INPUT_FIELD = 'input'

const CREATE_FIELDS = ['title', 'kind', 'status', 'description', 'dueDate', 'priority', 'memo'] as const
const UPDATE_FIELDS = ['title', 'kind', 'status', 'description', 'dueDate', 'priority', 'memo'] as const
const PROGRESS_FIELDS = ['content'] as const
const QUERY_FIELDS = ['scope', 'text', 'kind', 'priority'] as const
const SCOPES = ['board', 'archive'] as const

type PlainObject = Record<string, unknown>

function violation(field: string, reason: ViolationReason): Violation {
  return { field, reason }
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf(list: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && list.includes(value)
}

/** 값이 실제로 들어 있는가. 키가 없거나 undefined 이면 생략으로 본다. */
function has(input: PlainObject, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, field) && input[field] !== undefined
}

/** 허용 목록에 없는 필드 이름마다 UNKNOWN_FIELD. 값이 undefined 여도 보낸 것으로 센다. */
function unknownFields(input: PlainObject, allowed: readonly string[]): Violation[] {
  return Object.keys(input)
    .filter((key) => !allowed.includes(key))
    .map((key) => violation(key, 'UNKNOWN_FIELD'))
}

/** 제목·기록 내용 같은 필수 문자열: 문자열이 아니면 INVALID_TYPE, 공백 제거 뒤 비면 REQUIRED. */
function checkRequiredText(value: unknown, field: string): Violation[] {
  if (typeof value !== 'string') return [violation(field, 'INVALID_TYPE')]
  return normalizeTitle(value).length === 0 ? [violation(field, 'REQUIRED')] : []
}

function checkText(value: unknown, field: string): Violation[] {
  return typeof value === 'string' ? [] : [violation(field, 'INVALID_TYPE')]
}

function checkEnum(list: readonly string[], value: unknown, field: string): Violation[] {
  return isOneOf(list, value) ? [] : [violation(field, 'INVALID_VALUE')]
}

/** priority: 목록의 값 또는 null. */
function checkPriority(value: unknown): Violation[] {
  return value === null ? [] : checkEnum(PRIORITIES, value, 'priority')
}

/** dueDate: null 또는 달력에 실제로 있는 YYYY-MM-DD. */
function checkDueDate(value: unknown): Violation[] {
  if (value === null) return []
  if (typeof value !== 'string') return [violation('dueDate', 'INVALID_TYPE')]
  return isRealDate(value) ? [] : [violation('dueDate', 'INVALID_DATE')]
}

/** 제목·기록 내용의 앞뒤 공백을 뺀다. 저장할 때와 검사할 때 같은 규칙을 쓴다. */
export function normalizeTitle(s: string): string {
  return s.trim()
}

/**
 * 카드 만들기(create) 또는 수정(update) 입력 검사.
 * - create: title 필수. status 는 생략 가능하고, 보내면 할 일·진행 중만 받는다 (CREATE_STATUSES,
 *   그 밖의 값은 status/INVALID_VALUE: AC-042). 나머지는 생략 가능.
 * - update: 보낸 필드만 검사한다. status 는 세 값 모두 받는다. 빈 객체는 위반이 없다.
 * - 두 모드 모두 id·archivedAt·createdAt 등 정의되지 않은 필드는 UNKNOWN_FIELD.
 */
export function validateCardInput(input: unknown, mode: 'create' | 'update'): Violation[] {
  if (!isPlainObject(input)) return [violation(INPUT_FIELD, 'INVALID_TYPE')]
  const allowed = mode === 'create' ? CREATE_FIELDS : UPDATE_FIELDS
  const found: Violation[] = []

  if (has(input, 'title')) found.push(...checkRequiredText(input.title, 'title'))
  else if (mode === 'create') found.push(violation('title', 'REQUIRED'))

  if (has(input, 'kind')) found.push(...checkEnum(KINDS, input.kind, 'kind'))
  if (has(input, 'status')) {
    found.push(...(mode === 'create' ? checkEnum(CREATE_STATUSES, input.status, 'status') : validateStatus(input.status)))
  }
  if (has(input, 'description')) found.push(...checkText(input.description, 'description'))
  if (has(input, 'dueDate')) found.push(...checkDueDate(input.dueDate))
  if (has(input, 'priority')) found.push(...checkPriority(input.priority))
  if (has(input, 'memo')) found.push(...checkText(input.memo, 'memo'))

  found.push(...unknownFields(input, allowed))
  return found
}

/** 진행 기록 추가 입력 `{ content }` 검사. cardId·statusAtTime 등 다른 필드는 UNKNOWN_FIELD. */
export function validateProgressInput(input: unknown): Violation[] {
  if (!isPlainObject(input)) return [violation(INPUT_FIELD, 'INVALID_TYPE')]
  const found: Violation[] = has(input, 'content')
    ? checkRequiredText(input.content, 'content')
    : [violation('content', 'REQUIRED')]
  found.push(...unknownFields(input, PROGRESS_FIELDS))
  return found
}

/** 목록 조회 조건 `{ scope, text?, kind?, priority? }` 검사. priority 에 null 은 조건이 아니라 오류다. */
export function validateCardQuery(query: unknown): Violation[] {
  if (!isPlainObject(query)) return [violation(INPUT_FIELD, 'INVALID_TYPE')]
  const found: Violation[] = checkEnum(SCOPES, query.scope, 'scope')
  if (has(query, 'text')) found.push(...checkText(query.text, 'text'))
  if (has(query, 'kind')) found.push(...checkEnum(KINDS, query.kind, 'kind'))
  if (has(query, 'priority')) found.push(...checkEnum(PRIORITIES, query.priority, 'priority'))
  found.push(...unknownFields(query, QUERY_FIELDS))
  return found
}

/** 값 하나짜리 상태 검사 (changeStatus). `archived` 도 목록 밖이라 INVALID_VALUE 다 (AC-004). */
export function validateStatus(v: unknown): Violation[] {
  return checkEnum(STATUSES, v, 'status')
}

/** 값 하나짜리 화면 밝기 판 검사 (setTheme). 문자열이 아니면 INVALID_TYPE, 목록 밖이면 INVALID_VALUE. */
export function validateTheme(v: unknown): Violation[] {
  if (typeof v !== 'string') return [violation('theme', 'INVALID_TYPE')]
  return checkEnum(THEMES, v, 'theme')
}

/** 값 하나짜리 아이디 검사 (get, update, delete 의 id). 문자열이면 된다. 없는 카드는 CARD_NOT_FOUND 의 일이다. */
export function validateId(v: unknown): Violation[] {
  return checkText(v, 'id')
}
