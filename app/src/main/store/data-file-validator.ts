// 읽은 저장 문서의 모양과 구조 불변식 검사 (docs/05-design/02-data-model.md 검증 규칙과 제약 매핑,
// 05-architecture.md DataFileValidator). 저장의 verify 단계도 같은 함수를 쓴다.
// 조용히 고치거나 버리지 않는다: 문서를 바꾸지 않고, 보정한 문서를 돌려주지 않는다.
// - 모양이 틀리면(타입, 목록 밖의 값, 빠진 필드, 시각 형식, 설정 없음·판 값 이상) SCHEMA_INVALID
// - 모양은 맞는데 구조 불변식을 어기면(id 중복, 없는 카드를 가리키는 기록, 보관 표시와 상태 어긋남) INTEGRITY_VIOLATED
// 모양 검사를 먼저 하고, 모양이 맞을 때만 불변식을 본다. 위반은 첫 번째에서 멈추지 않고 모아서 issues 에 담는다.
// 순수 모듈이다: 파일·시계를 모른다.

import { CURRENT_SCHEMA_VERSION } from '../../shared/constants'
import {
  INPUT_FIELD,
  validateCardInput,
  validateId,
  validateProgressInput,
  validateStatus,
  validateTheme,
} from '../../shared/domain/validation'
import type { DataFile } from '../../shared/types/card'
import type { Violation } from '../../shared/types/result'

export type DataFileValidation =
  | { ok: true; doc: DataFile }
  | {
      ok: false
      code: 'SCHEMA_INVALID' | 'INTEGRITY_VIOLATED'
      /** 위반 위치 요약. 예: `settings.theme: INVALID_VALUE`, `cards[3].id: DUPLICATE_ID`. */
      issues: string[]
    }

type PlainObject = Record<string, unknown>

const ROOT_FIELDS = ['schemaVersion', 'settings', 'cards', 'progressEntries'] as const
const SETTINGS_FIELDS = ['theme'] as const
/** 카드에서 입력 검증(validateCardInput)이 맡는 필드. 나머지 id·archivedAt·createdAt 은 여기서 따로 본다. */
const CARD_INPUT_FIELDS = ['title', 'kind', 'status', 'description', 'dueDate', 'priority', 'memo'] as const
const CARD_FIELDS = [...CARD_INPUT_FIELDS, 'id', 'archivedAt', 'createdAt'] as const
const ENTRY_FIELDS = ['id', 'cardId', 'content', 'statusAtTime', 'createdAt'] as const

/** UTC 시각 문자열: 2026-11-03T09:12:34.567Z */
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function present(obj: PlainObject, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, field) && obj[field] !== undefined
}

function joinPath(parent: string, field: string): string {
  if (field === INPUT_FIELD) return parent
  return parent === '' ? field : `${parent}.${field}`
}

function fromViolations(parent: string, violations: Violation[], rename?: Record<string, string>): string[] {
  return violations.map((v) => `${joinPath(parent, rename?.[v.field] ?? v.field)}: ${v.reason}`)
}

/** 빠진 필드는 REQUIRED, 허용 목록 밖의 필드는 UNKNOWN_FIELD. */
function checkShapeKeys(obj: PlainObject, path: string, fields: readonly string[], checkUnknown: boolean): string[] {
  const found: string[] = []
  for (const field of fields) {
    if (!present(obj, field)) found.push(`${joinPath(path, field)}: REQUIRED`)
  }
  if (checkUnknown) {
    for (const key of Object.keys(obj)) {
      if (!fields.includes(key)) found.push(`${joinPath(path, key)}: UNKNOWN_FIELD`)
    }
  }
  return found
}

/** 형식이 맞고 달력·시계에 실제로 있는 UTC 시각인가. 다시 만든 문자열이 같아야 한다 (밀려 보정되는 값은 거부). */
function isInstant(value: string): boolean {
  if (!INSTANT_PATTERN.test(value)) return false
  const ms = Date.parse(value)
  return !Number.isNaN(ms) && new Date(ms).toISOString() === value
}

function checkInstant(value: unknown, path: string): string[] {
  if (typeof value !== 'string') return [`${path}: INVALID_TYPE`]
  return isInstant(value) ? [] : [`${path}: INVALID_VALUE`]
}

function checkIdField(value: unknown, path: string): string[] {
  if (validateId(value).length > 0) return [`${path}: INVALID_TYPE`]
  return value === '' ? [`${path}: REQUIRED`] : []
}

function checkSettings(value: unknown): string[] {
  if (value === undefined) return ['settings: REQUIRED']
  if (!isPlainObject(value)) return ['settings: INVALID_TYPE']
  const found = checkShapeKeys(value, 'settings', SETTINGS_FIELDS, true)
  if (present(value, 'theme')) found.push(...fromViolations('settings', validateTheme(value['theme'])))
  return found
}

function checkCard(card: unknown, path: string): string[] {
  if (!isPlainObject(card)) return [`${path}: INVALID_TYPE`]
  const found = checkShapeKeys(card, path, CARD_FIELDS, false)

  // 필드 단위 규칙은 입력 검증을 그대로 쓴다. 입력 검증은 생략을 허용하므로 빠진 필드는 위에서 따로 잡았다.
  const input: PlainObject = {}
  for (const field of CARD_INPUT_FIELDS) {
    if (present(card, field)) input[field] = card[field]
  }
  for (const key of Object.keys(card)) {
    if (!(CARD_FIELDS as readonly string[]).includes(key)) input[key] = card[key]
  }
  found.push(...fromViolations(path, validateCardInput(input, 'update')))

  if (present(card, 'id')) found.push(...checkIdField(card['id'], `${path}.id`))
  if (present(card, 'createdAt')) found.push(...checkInstant(card['createdAt'], `${path}.createdAt`))
  if (present(card, 'archivedAt') && card['archivedAt'] !== null) {
    found.push(...checkInstant(card['archivedAt'], `${path}.archivedAt`))
  }
  return found
}

function checkEntry(entry: unknown, path: string): string[] {
  if (!isPlainObject(entry)) return [`${path}: INVALID_TYPE`]
  const found = checkShapeKeys(entry, path, ENTRY_FIELDS, true)
  if (present(entry, 'content'))
    found.push(...fromViolations(path, validateProgressInput({ content: entry['content'] })))
  if (present(entry, 'statusAtTime')) {
    found.push(...fromViolations(path, validateStatus(entry['statusAtTime']), { status: 'statusAtTime' }))
  }
  if (present(entry, 'id')) found.push(...checkIdField(entry['id'], `${path}.id`))
  if (present(entry, 'cardId')) found.push(...checkIdField(entry['cardId'], `${path}.cardId`))
  if (present(entry, 'createdAt')) found.push(...checkInstant(entry['createdAt'], `${path}.createdAt`))
  return found
}

function checkArray(value: unknown, path: string, checkItem: (item: unknown, itemPath: string) => string[]): string[] {
  if (!Array.isArray(value)) return [`${path}: ${value === undefined ? 'REQUIRED' : 'INVALID_TYPE'}`]
  return value.flatMap((item, index) => checkItem(item, `${path}[${index}]`))
}

/** 모양 검사. 위반 위치를 모아 돌려준다. 비어 있으면 모양이 맞다. */
function checkShape(value: unknown): string[] {
  if (!isPlainObject(value)) return ['input: INVALID_TYPE']
  const found: string[] = []
  const version = value['schemaVersion']
  if (!present(value, 'schemaVersion')) found.push('schemaVersion: REQUIRED')
  else if (typeof version !== 'number' || !Number.isInteger(version)) found.push('schemaVersion: INVALID_TYPE')
  else if (version !== CURRENT_SCHEMA_VERSION) found.push('schemaVersion: INVALID_VALUE')

  found.push(...checkSettings(value['settings']))
  found.push(...checkArray(value['cards'], 'cards', checkCard))
  found.push(...checkArray(value['progressEntries'], 'progressEntries', checkEntry))
  for (const key of Object.keys(value)) {
    if (!(ROOT_FIELDS as readonly string[]).includes(key)) found.push(`${key}: UNKNOWN_FIELD`)
  }
  return found
}

/** 구조 불변식 검사. 모양이 맞은 문서에만 쓴다. */
function checkIntegrity(doc: DataFile): string[] {
  const found: string[] = []

  const cardIds = new Set<string>()
  doc.cards.forEach((card, index) => {
    if (cardIds.has(card.id)) found.push(`cards[${index}].id: DUPLICATE_ID`)
    cardIds.add(card.id)
    if (card.archivedAt !== null && card.status !== 'done') found.push(`cards[${index}].archivedAt: ARCHIVED_NOT_DONE`)
  })

  const entryIds = new Set<string>()
  doc.progressEntries.forEach((entry, index) => {
    if (entryIds.has(entry.id)) found.push(`progressEntries[${index}].id: DUPLICATE_ID`)
    entryIds.add(entry.id)
    if (!cardIds.has(entry.cardId)) found.push(`progressEntries[${index}].cardId: CARD_NOT_FOUND`)
  })

  return found
}

/**
 * 읽은(또는 막 쓴) 현재 버전 문서를 검사한다. 이전 버전 문서는 버전 변환을 거친 뒤에 넣는다.
 * 통과하면 받은 문서를 그대로 돌려준다 (복사·보정 없음). 입력은 바꾸지 않는다.
 */
export function validateDataFile(value: unknown): DataFileValidation {
  const shapeIssues = checkShape(value)
  if (shapeIssues.length > 0) return { ok: false, code: 'SCHEMA_INVALID', issues: shapeIssues }

  const doc = value as DataFile
  const integrityIssues = checkIntegrity(doc)
  if (integrityIssues.length > 0) return { ok: false, code: 'INTEGRITY_VIOLATED', issues: integrityIssues }

  return { ok: true, doc }
}
