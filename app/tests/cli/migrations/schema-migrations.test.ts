// 버전 변환 사슬 시험 (NFR-003, FR-014 AC-038): 버전 1 → 2, 더 새로운 버전, 변환 실패.
// 고정 데이터는 tests/cli/support/fixtures 의 JSON 이고 가짜 카드만 담는다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '../../../src/shared/constants'
import { MIGRATIONS, migrate } from '../../../src/main/store/migrations'

function loadFixture(name: string): Record<string, unknown> {
  const url = new URL(`../support/fixtures/${name}`, import.meta.url)
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Record<string, unknown>
}

/** 얼려서 변조 시도가 곧바로 오류가 되게 한다. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const ORIGINAL_STEP_1 = MIGRATIONS[1]

afterEach(() => {
  // 변환 대역을 쓴 시험이 다른 시험에 새지 않게 되돌린다.
  if (ORIGINAL_STEP_1 !== undefined) MIGRATIONS[1] = ORIGINAL_STEP_1
})

describe('변환 사슬 대역', () => {
  test('TC-045 변환 함수가 오류를 던지면 MIGRATION_FAILED 이고 입력 문서는 바뀌지 않는다', () => {
    const input = loadFixture('data-v1.json')
    const snapshot = structuredClone(input)
    let called = 0
    MIGRATIONS[1] = (doc) => {
      called += 1
      // 변환 중에 입력을 건드린 뒤 던진다: 원본에 닿지 않아야 한다.
      ;(doc as { cards: unknown[] }).cards.length = 0
      throw new Error('변환 중 오류')
    }

    const result = migrate(input)

    expect(called).toBe(1) // 준비 조건: 대역이 실제로 불렸다
    expect(result).toEqual({ ok: false, code: 'MIGRATION_FAILED' })
    expect(input).toEqual(snapshot)
  })

  test('TC-045 변환 함수가 올바른 버전의 문서를 돌려주지 않으면 MIGRATION_FAILED 이다', () => {
    const input = loadFixture('data-v1.json')
    const snapshot = structuredClone(input)
    let called = 0
    MIGRATIONS[1] = (doc) => {
      called += 1
      return doc // schemaVersion 이 그대로 1
    }

    const result = migrate(input)

    expect(called).toBe(1)
    expect(result).toEqual({ ok: false, code: 'MIGRATION_FAILED' })
    expect(input).toEqual(snapshot)
  })

  test('TC-045 변환 함수가 표에 없으면 MIGRATION_FAILED 이고 입력 문서는 바뀌지 않는다', () => {
    const input = loadFixture('data-v1.json')
    const snapshot = structuredClone(input)
    delete MIGRATIONS[1]

    const result = migrate(input)

    expect(1 in MIGRATIONS).toBe(false) // 준비 조건: 표에서 빠졌다
    expect(result).toEqual({ ok: false, code: 'MIGRATION_FAILED' })
    expect(input).toEqual(snapshot)
  })
})

describe('버전 1 → 2', () => {
  test('TC-046 버전 1 파일의 카드와 기록은 모두 같은 값으로 읽히고 설정은 밝은 판이고 저장된 dark 는 그대로다', () => {
    const input = loadFixture('data-v1.json')
    const snapshot = structuredClone(input)
    deepFreeze(input)
    expect('settings' in input).toBe(false) // 준비 조건: 설정 없는 버전 1 파일
    expect((input['cards'] as unknown[]).length).toBeGreaterThan(0)
    expect((input['progressEntries'] as unknown[]).length).toBeGreaterThan(0)

    const result = migrate(input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fromVersion).toBe(1)
    const doc = result.doc as Record<string, unknown>
    expect(doc['schemaVersion']).toBe(2)
    expect(doc['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc['settings']).toEqual({ theme: 'light' })
    expect(doc['cards']).toHaveLength((snapshot['cards'] as unknown[]).length)
    expect(doc['progressEntries']).toHaveLength((snapshot['progressEntries'] as unknown[]).length)
    expect(doc['cards']).toEqual(snapshot['cards'])
    expect(doc['progressEntries']).toEqual(snapshot['progressEntries'])
    expect(input).toEqual(snapshot)

    // 이미 dark 가 저장된 현재 버전 문서는 변환 없이(fromVersion null) dark 그대로다 (AC-038).
    const savedDark = { ...loadFixture('data-v2.json'), settings: { theme: 'dark' } }
    expect(migrate(savedDark)).toEqual({ ok: true, doc: savedDark, fromVersion: null })
  })

  test('TC-046 변환 결과를 바꿔도 입력 문서의 카드에는 영향이 없다', () => {
    const input = loadFixture('data-v1.json')
    const snapshot = structuredClone(input)

    const result = migrate(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const doc = result.doc as { cards: Array<{ title: string }>; settings: { theme: string } }
    doc.cards[0]!.title = '바뀐 제목'
    doc.settings.theme = 'light'

    expect(input).toEqual(snapshot)
  })
})

describe('현재 버전과 그 밖의 버전', () => {
  test('버전 2 파일은 변환 없이 그대로 읽히고 fromVersion 은 null 이다', () => {
    const input = loadFixture('data-v2.json')
    const snapshot = structuredClone(input)

    const result = migrate(input)

    expect(result).toEqual({ ok: true, doc: snapshot, fromVersion: null })
    expect(input).toEqual(snapshot)
  })

  test('현재보다 높은 버전은 SCHEMA_TOO_NEW 이고 파일의 버전을 알려 준다', () => {
    const input = { ...loadFixture('data-v2.json'), schemaVersion: CURRENT_SCHEMA_VERSION + 1 }
    const snapshot = structuredClone(input)

    const result = migrate(input)

    expect(result).toEqual({
      ok: false,
      code: 'SCHEMA_TOO_NEW',
      fileSchemaVersion: CURRENT_SCHEMA_VERSION + 1,
    })
    expect(input).toEqual(snapshot)
  })

  test.each([
    ['객체가 아닌 값', 'text'],
    ['null', null],
    ['배열', []],
    ['schemaVersion 없음', { cards: [], progressEntries: [] }],
    ['schemaVersion 이 문자열', { schemaVersion: '1' }],
    ['schemaVersion 이 소수', { schemaVersion: 1.5 }],
    ['schemaVersion 이 0', { schemaVersion: 0 }],
    ['schemaVersion 이 음수', { schemaVersion: -1 }],
  ])('버전을 알 수 없는 문서(%s)는 SCHEMA_INVALID 이다', (_label, raw) => {
    expect(migrate(raw)).toEqual({ ok: false, code: 'SCHEMA_INVALID' })
  })
})

describe('고정 데이터', () => {
  test('data-v2.json 은 현재 버전이고 설정·보관 카드·진행 기록을 담는다', () => {
    const doc = loadFixture('data-v2.json') as {
      schemaVersion: number
      settings: unknown
      cards: Array<{ archivedAt: string | null }>
      progressEntries: unknown[]
    }
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc.settings).toEqual({ theme: 'light' })
    expect(doc.cards.some((card) => card.archivedAt !== null)).toBe(true)
    expect(doc.progressEntries.length).toBeGreaterThan(0)
  })
})
