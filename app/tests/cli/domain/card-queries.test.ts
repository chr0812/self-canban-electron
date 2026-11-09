import { describe, expect, test } from 'vitest'
import { getCardDetail, listCards } from '../../../src/shared/domain/card-queries'
import { makeCard, makeDoc, makeEntry } from '../support/builders'

const ARCHIVED_AT = '2026-11-03T10:00:00.000Z'

function boardAndArchiveDoc() {
  return makeDoc({
    cards: [
      makeCard({ id: 'b1', title: '보드 하나', status: 'todo' }),
      makeCard({ id: 'a1', title: '보관 하나', status: 'done', archivedAt: ARCHIVED_AT }),
      makeCard({ id: 'b2', title: '보드 둘', status: 'in_progress', kind: 'bug', priority: 'high' }),
    ],
  })
}

function listIds(doc: ReturnType<typeof makeDoc>, query: unknown): string[] {
  const r = listCards(doc, query)
  if (!r.ok) throw new Error(`목록 조회 실패: ${r.error.code}`)
  return r.value.map((c) => c.id)
}

describe('범위', () => {
  test('TC-022 보드 범위는 보관하지 않은 카드만, 보관함 범위는 보관한 카드만 돌려준다', () => {
    const doc = boardAndArchiveDoc()
    const board = listIds(doc, { scope: 'board' })
    const archive = listIds(doc, { scope: 'archive' })

    expect(board).toEqual(['b1', 'b2'])
    expect(archive).toEqual(['a1'])
    expect(board.filter((id) => archive.includes(id))).toEqual([])
  })

  test('TC-022 보관함 범위에서 검색해도 보드의 카드는 나오지 않고 보드 검색에는 보관한 카드가 나오지 않는다', () => {
    const doc = boardAndArchiveDoc()
    expect(listIds(doc, { scope: 'archive', text: '보' })).toEqual(['a1'])
    expect(listIds(doc, { scope: 'board', text: '보관' })).toEqual([])
  })

  test('TC-022 조건은 모두 만족해야 하고 저장 순서를 지킨다', () => {
    const doc = boardAndArchiveDoc()
    expect(listIds(doc, { scope: 'board', kind: 'bug', priority: 'high' })).toEqual(['b2'])
    expect(listIds(doc, { scope: 'board', kind: 'task', priority: 'high' })).toEqual([])
    expect(listIds(doc, { scope: 'board', text: '  ' })).toEqual(['b1', 'b2'])
  })

  test('TC-022 받은 문서를 바꾸지 않는다', () => {
    const doc = boardAndArchiveDoc()
    const before = JSON.stringify(doc)
    listCards(doc, { scope: 'board' })
    getCardDetail(doc, 'a1')
    expect(JSON.stringify(doc)).toBe(before)
  })
})

describe('빈 문서', () => {
  test('TC-023 카드가 하나도 없으면 빈 목록을 오류 없이 돌려준다', () => {
    const doc = makeDoc()
    expect(doc.cards).toHaveLength(0)
    const board = listCards(doc, { scope: 'board' })
    const archive = listCards(doc, { scope: 'archive' })
    expect(board).toEqual({ ok: true, value: [] })
    expect(archive).toEqual({ ok: true, value: [] })
  })

  test('TC-023 조건에 맞는 카드가 없을 때도 빈 목록이고 오류가 아니다', () => {
    const r = listCards(boardAndArchiveDoc(), { scope: 'board', text: '없는 제목' })
    expect(r).toEqual({ ok: true, value: [] })
  })
})

describe('목록 입력 검증', () => {
  test('TC-022 범위나 조건이 틀리면 VALIDATION_FAILED 로 위반을 모두 돌려준다', () => {
    const r = listCards(makeDoc(), { scope: 'all', text: 1, kind: 'epic' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('VALIDATION_FAILED')
    expect(r.error.details).toEqual({
      violations: [
        { field: 'scope', reason: 'INVALID_VALUE' },
        { field: 'text', reason: 'INVALID_TYPE' },
        { field: 'kind', reason: 'INVALID_VALUE' },
      ],
    })
  })
})

describe('상세', () => {
  test('TC-022 카드 한 장과 그 카드의 기록만 남긴 순서로 돌려준다 (보관한 카드도 읽는다)', () => {
    const doc = makeDoc({
      cards: [makeCard({ id: 'a1', status: 'done', archivedAt: ARCHIVED_AT }), makeCard({ id: 'b1' })],
      progressEntries: [
        makeEntry({ id: 'e1', cardId: 'a1', content: '첫째' }),
        makeEntry({ id: 'e2', cardId: 'b1', content: '다른 카드' }),
        makeEntry({ id: 'e3', cardId: 'a1', content: '둘째' }),
      ],
    })
    const r = getCardDetail(doc, 'a1')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.card.id).toBe('a1')
    expect(r.value.card.archivedAt).toBe(ARCHIVED_AT)
    expect(r.value.progress.map((e) => e.id)).toEqual(['e1', 'e3'])
  })

  test('TC-022 없는 아이디는 CARD_NOT_FOUND, 문자열이 아니면 VALIDATION_FAILED', () => {
    const missing = getCardDetail(makeDoc(), 'nope')
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.error.code).toBe('CARD_NOT_FOUND')
      expect(missing.error.details).toEqual({ id: 'nope' })
    }

    const bad = getCardDetail(makeDoc(), 7)
    expect(bad.ok).toBe(false)
    if (!bad.ok) {
      expect(bad.error.code).toBe('VALIDATION_FAILED')
      expect(bad.error.details).toEqual({ violations: [{ field: 'id', reason: 'INVALID_TYPE' }] })
    }
  })
})
