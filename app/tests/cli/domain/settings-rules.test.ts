import { describe, expect, test } from 'vitest'
import { getSettings, setTheme } from '../../../src/shared/domain/settings-rules'
import type { DataFile } from '../../../src/shared/types/card'
import { makeCard, makeDoc } from '../support/builders'

/** 바뀐 문서를 이어받으며 판을 전환한다 (저장소가 changed 일 때 next 로 교체하는 흉내). */
function applyTheme(doc: DataFile, theme: unknown): DataFile {
  const r = setTheme(doc, theme)
  if (!r.ok) throw new Error(`판 전환 실패: ${r.error.code}`)
  return r.value.changed ? r.value.next : doc
}

function themeOf(doc: DataFile): string {
  const r = getSettings(doc)
  if (!r.ok) throw new Error(`설정 조회 실패: ${r.error.code}`)
  return r.value.theme
}

describe('판 조회와 전환', () => {
  test('TC-027 설정이 없으면 밝은 판이고 판 전환은 저장 값을 바꾼다', () => {
    let doc = makeDoc()
    const seen = [themeOf(doc)]

    const toDark = setTheme(doc, 'dark')
    expect(toDark.ok).toBe(true)
    if (toDark.ok) {
      expect(toDark.value.changed).toBe(true)
      expect(toDark.value.value).toEqual({ theme: 'dark' })
    }
    doc = applyTheme(doc, 'dark')
    seen.push(themeOf(doc))

    doc = applyTheme(doc, 'light')
    seen.push(themeOf(doc))

    expect(seen).toEqual(['light', 'dark', 'light'])
  })

  test('TC-027 설정 값이 빠진 문서도 밝은 판으로 조회한다', () => {
    const noSettings = { ...makeDoc(), settings: undefined } as unknown as DataFile
    expect(getSettings(noSettings)).toEqual({ ok: true, value: { theme: 'light' } })

    const r = setTheme(noSettings, 'dark')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.changed).toBe(true)
      expect(r.value.next.settings).toEqual({ theme: 'dark' })
    }
  })

  test('TC-027 판 전환은 받은 문서를 바꾸지 않고 카드를 그대로 가져간다', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'c1' })] })
    const before = JSON.stringify(doc)
    const r = setTheme(doc, 'dark')
    expect(JSON.stringify(doc)).toBe(before)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.next).not.toBe(doc)
      expect(r.value.next.cards).toEqual(doc.cards)
      expect(r.value.next.progressEntries).toEqual(doc.progressEntries)
      expect(r.value.next.schemaVersion).toBe(doc.schemaVersion)
    }
  })
})

describe('같은 값과 잘못된 값', () => {
  test('TC-028 같은 판으로 바꾸면 바뀐 것이 없고 목록 밖 값은 거부된다', () => {
    const doc = makeDoc({ settings: { theme: 'dark' } })
    expect(themeOf(doc)).toBe('dark')

    const same = setTheme(doc, 'dark')
    expect(same.ok).toBe(true)
    if (same.ok) {
      expect(same.value.changed).toBe(false)
      expect(same.value.value).toEqual({ theme: 'dark' })
    }

    const blue = setTheme(doc, 'blue')
    expect(blue.ok).toBe(false)
    if (!blue.ok) {
      expect(blue.error.code).toBe('VALIDATION_FAILED')
      expect(blue.error.details).toEqual({ violations: [{ field: 'theme', reason: 'INVALID_VALUE' }] })
    }

    const num = setTheme(doc, 1)
    expect(num.ok).toBe(false)
    if (!num.ok) {
      expect(num.error.code).toBe('VALIDATION_FAILED')
      expect(num.error.details).toEqual({ violations: [{ field: 'theme', reason: 'INVALID_TYPE' }] })
    }

    // 설정은 dark 그대로
    expect(themeOf(doc)).toBe('dark')
    expect(doc.settings).toEqual({ theme: 'dark' })
  })

  test('TC-028 밝은 판에서 밝은 판으로 바꿔도 바뀐 것이 없다', () => {
    const doc = makeDoc({ settings: { theme: 'light' } })
    const r = setTheme(doc, 'light')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.changed).toBe(false)
  })
})
