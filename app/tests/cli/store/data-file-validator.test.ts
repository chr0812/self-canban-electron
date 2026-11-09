// 저장 문서 검증 시험 (AC-032, AC-038, NFR-003): 구조 불변식 위반과 설정 이상은 고치지 않고 거부한다.
// 고정 데이터는 tests/cli/support/fixtures 의 JSON 이고 가짜 카드만 담는다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { validateDataFile } from '../../../src/main/store/data-file-validator'
import { migrate } from '../../../src/main/store/migrations'
import { makeCard, makeDoc, makeEntry } from '../support/builders'

type Doc = {
  schemaVersion: number
  settings?: { theme?: unknown }
  cards: Array<Record<string, unknown>>
  progressEntries: Array<Record<string, unknown>>
}

function loadFixture(name: string): Doc {
  const url = new URL(`../support/fixtures/${name}`, import.meta.url)
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Doc
}

/** 얼려서 검사가 입력을 바꾸려 하면 곧바로 오류가 되게 한다. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/** 사본을 얼려 검사하고, 검사 뒤에도 내용이 그대로인지 함께 확인한다. */
function validateFrozen(doc: unknown) {
  const before = JSON.stringify(doc)
  const result = validateDataFile(deepFreeze(structuredClone(doc)))
  expect(JSON.stringify(doc)).toBe(before)
  return result
}

function failure(result: ReturnType<typeof validateDataFile>) {
  if (result.ok) throw new Error('실패여야 하는데 통과했다')
  return result
}

describe('validateDataFile: 정상 문서', () => {
  test('고정 데이터(버전 2)는 통과하고 받은 문서를 그대로 돌려준다', () => {
    const doc = loadFixture('data-v2.json')
    const result = validateDataFile(doc)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.doc).toBe(doc)
  })

  test('NFR-003 버전 1 고정 데이터를 변환한 문서는 통과한다', () => {
    const migrated = migrate(loadFixture('data-v1.json'))
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(validateDataFile(migrated.doc).ok).toBe(true)
  })

  test('빈 보드 문서와 빌더가 만든 문서는 통과한다', () => {
    expect(validateDataFile(makeDoc()).ok).toBe(true)
    const doc = makeDoc({ cards: [makeCard()], progressEntries: [makeEntry()] })
    expect(validateDataFile(doc).ok).toBe(true)
  })

  test('보관된 완료 카드와 밝은 판은 통과한다', () => {
    const doc = makeDoc({
      settings: { theme: 'light' },
      cards: [makeCard({ status: 'done', archivedAt: '2026-11-03T09:00:00.000Z' })],
    })
    expect(validateDataFile(doc).ok).toBe(true)
  })
})

describe('TC-032 구조 불변식 위반', () => {
  test('TC-032 (a) 카드 아이디 중복은 INTEGRITY_VIOLATED 이고 입력도 결과도 고쳐지지 않는다', () => {
    const doc = loadFixture('data-v2.json')
    doc.cards[1]!['id'] = doc.cards[0]!['id']
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('INTEGRITY_VIOLATED')
    expect(result.issues).toEqual(['cards[1].id: DUPLICATE_ID'])
    expect(result).not.toHaveProperty('doc')
  })

  test('TC-032 (b) 존재하지 않는 카드를 가리키는 기록은 INTEGRITY_VIOLATED 이고 입력도 결과도 고쳐지지 않는다', () => {
    const doc = loadFixture('data-v2.json')
    doc.progressEntries[2]!['cardId'] = 'no-such-card'
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('INTEGRITY_VIOLATED')
    expect(result.issues).toEqual(['progressEntries[2].cardId: CARD_NOT_FOUND'])
    expect(result).not.toHaveProperty('doc')
  })

  test('TC-032 (c) 보관 표시가 있는데 상태가 할 일인 카드는 INTEGRITY_VIOLATED 이고 입력도 결과도 고쳐지지 않는다', () => {
    const doc = loadFixture('data-v2.json')
    // 네 번째 카드는 보관된 완료 카드다. 상태만 할 일로 바꾼다.
    expect(doc.cards[3]!['archivedAt']).not.toBeNull()
    doc.cards[3]!['status'] = 'todo'
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('INTEGRITY_VIOLATED')
    expect(result.issues).toEqual(['cards[3].archivedAt: ARCHIVED_NOT_DONE'])
    expect(result).not.toHaveProperty('doc')
  })

  test('TC-032 (d) 기록 아이디 중복은 INTEGRITY_VIOLATED 이고 입력도 결과도 고쳐지지 않는다', () => {
    const doc = loadFixture('data-v2.json')
    doc.progressEntries[1]!['id'] = doc.progressEntries[0]!['id']
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('INTEGRITY_VIOLATED')
    expect(result.issues).toEqual(['progressEntries[1].id: DUPLICATE_ID'])
    expect(result).not.toHaveProperty('doc')
  })

  test('TC-032 위반이 여럿이면 모두 모아서 돌려준다', () => {
    const doc = loadFixture('data-v2.json')
    doc.cards[1]!['id'] = doc.cards[0]!['id']
    doc.progressEntries[0]!['cardId'] = 'no-such-card'
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('INTEGRITY_VIOLATED')
    expect(result.issues).toHaveLength(2)
  })
})

describe('TC-033 설정 없음과 판 값 이상', () => {
  test('TC-033 settings 가 없으면 SCHEMA_INVALID 이고 기본값을 채운 문서가 돌아오지 않는다', () => {
    const doc = loadFixture('data-v2.json')
    delete doc.settings
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('SCHEMA_INVALID')
    expect(result.issues).toEqual(['settings: REQUIRED'])
    expect(result).not.toHaveProperty('doc')
    expect(doc).not.toHaveProperty('settings')
  })

  test("TC-033 theme 이 'blue' 이면 SCHEMA_INVALID 이고 dark 로 채운 문서가 돌아오지 않는다", () => {
    const doc = loadFixture('data-v2.json')
    doc.settings = { theme: 'blue' }
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('SCHEMA_INVALID')
    expect(result.issues).toEqual(['settings.theme: INVALID_VALUE'])
    expect(result).not.toHaveProperty('doc')
    expect(doc.settings.theme).toBe('blue')
  })

  test('TC-033 theme 이 문자열이 아니거나 빠져도 SCHEMA_INVALID 이다', () => {
    const wrongType = loadFixture('data-v2.json')
    wrongType.settings = { theme: 1 }
    expect(failure(validateFrozen(wrongType)).issues).toEqual(['settings.theme: INVALID_TYPE'])

    const missing = loadFixture('data-v2.json')
    missing.settings = {}
    expect(failure(validateFrozen(missing)).issues).toEqual(['settings.theme: REQUIRED'])
  })
})

describe('모양 검사 (SCHEMA_INVALID)', () => {
  test('객체가 아닌 문서는 거부한다', () => {
    for (const value of [null, [], 'text', 3, undefined]) {
      expect(failure(validateDataFile(value)).code).toBe('SCHEMA_INVALID')
    }
  })

  test('현재 버전이 아닌 schemaVersion 은 거부한다', () => {
    const doc = loadFixture('data-v2.json')
    doc.schemaVersion = 1
    expect(failure(validateFrozen(doc)).issues).toEqual(['schemaVersion: INVALID_VALUE'])
    doc.schemaVersion = '2' as unknown as number
    expect(failure(validateFrozen(doc)).issues).toEqual(['schemaVersion: INVALID_TYPE'])
  })

  test('cards 나 progressEntries 가 없거나 배열이 아니면 거부한다', () => {
    const doc = loadFixture('data-v2.json') as unknown as Record<string, unknown>
    delete doc['cards']
    doc['progressEntries'] = {}
    expect(failure(validateFrozen(doc)).issues).toEqual(['cards: REQUIRED', 'progressEntries: INVALID_TYPE'])
  })

  test('카드 필드의 위반 위치를 인덱스와 함께 알린다', () => {
    const doc = loadFixture('data-v2.json')
    doc.cards[0]!['status'] = 'archived'
    doc.cards[1]!['title'] = '   '
    doc.cards[2]!['kind'] = 'epic'
    doc.cards[2]!['dueDate'] = '2026-02-30'
    doc.cards[3]!['priority'] = 'urgent'
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('SCHEMA_INVALID')
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'cards[0].status: INVALID_VALUE',
        'cards[1].title: REQUIRED',
        'cards[2].kind: INVALID_VALUE',
        'cards[2].dueDate: INVALID_DATE',
        'cards[3].priority: INVALID_VALUE',
      ]),
    )
    expect(result.issues).toHaveLength(5)
  })

  test('카드에 빠진 필드와 알 수 없는 필드를 거부한다', () => {
    const doc = loadFixture('data-v2.json')
    delete doc.cards[0]!['memo']
    delete doc.cards[1]!['archivedAt']
    doc.cards[2]!['extra'] = 1
    expect(failure(validateFrozen(doc)).issues).toEqual(
      expect.arrayContaining([
        'cards[0].memo: REQUIRED',
        'cards[1].archivedAt: REQUIRED',
        'cards[2].extra: UNKNOWN_FIELD',
      ]),
    )
  })

  test('시각 필드는 UTC 시각 문자열 형식이어야 한다', () => {
    const doc = loadFixture('data-v2.json')
    doc.cards[0]!['createdAt'] = '2026-10-01'
    doc.cards[1]!['createdAt'] = '2026-10-01T09:00:00+09:00'
    doc.cards[3]!['archivedAt'] = '2026-02-30T09:00:00.000Z'
    doc.progressEntries[0]!['createdAt'] = 5
    expect(failure(validateFrozen(doc)).issues).toEqual([
      'cards[0].createdAt: INVALID_VALUE',
      'cards[1].createdAt: INVALID_VALUE',
      'cards[3].archivedAt: INVALID_VALUE',
      'progressEntries[0].createdAt: INVALID_TYPE',
    ])
  })

  test('진행 기록의 내용·상태·아이디 위반을 알린다', () => {
    const doc = loadFixture('data-v2.json')
    doc.progressEntries[0]!['content'] = ''
    doc.progressEntries[1]!['statusAtTime'] = 'archived'
    doc.progressEntries[2]!['id'] = 7
    doc.progressEntries[2]!['cardId'] = ''
    expect(failure(validateFrozen(doc)).issues).toEqual([
      'progressEntries[0].content: REQUIRED',
      'progressEntries[1].statusAtTime: INVALID_VALUE',
      'progressEntries[2].id: INVALID_TYPE',
      'progressEntries[2].cardId: REQUIRED',
    ])
  })

  test('모양 위반과 불변식 위반이 함께 있으면 모양 위반(SCHEMA_INVALID)으로 판정한다', () => {
    const doc = loadFixture('data-v2.json')
    doc.cards[1]!['id'] = doc.cards[0]!['id']
    doc.settings = { theme: 'blue' }
    const result = failure(validateFrozen(doc))
    expect(result.code).toBe('SCHEMA_INVALID')
    expect(result.issues).toEqual(['settings.theme: INVALID_VALUE'])
  })

  test('카드나 기록 항목이 객체가 아니면 거부한다', () => {
    const doc = loadFixture('data-v2.json') as unknown as Record<string, unknown[]>
    doc['cards']![0] = null
    doc['progressEntries']![0] = 'x'
    expect(failure(validateFrozen(doc)).issues).toEqual(['cards[0]: INVALID_TYPE', 'progressEntries[0]: INVALID_TYPE'])
  })
})
