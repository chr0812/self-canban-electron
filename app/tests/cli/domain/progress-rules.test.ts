import { describe, expect, test } from 'vitest'
import { addProgress } from '../../../src/shared/domain/progress-rules'
import type { RuleContext } from '../../../src/shared/domain/rule-support'
import type { Card, DataFile, ProgressEntry, Status } from '../../../src/shared/types/card'
import { BASE_INSTANT, makeCard, makeContext, makeDoc, makeEntry } from '../support/builders'

/** 성공을 기대하고 값을 꺼낸다. 실패면 시험이 바로 깨진다. */
function addOk(doc: DataFile, cardId: string, content: string, ctx: RuleContext) {
  const r = addProgress(doc, cardId, { content }, ctx)
  if (!r.ok) throw new Error(`추가가 실패했다: ${JSON.stringify(r.error)}`)
  return r.value.value
}

/** 카드 상태를 시험 데이터로 바꾼 문서 (카드 규칙 함수를 쓰지 않는다). */
function withStatus(doc: DataFile, cardId: string, status: Status): DataFile {
  return { ...doc, cards: doc.cards.map((c: Card) => (c.id === cardId ? { ...c, status } : c)) }
}

/** 상세 조회에 해당하는 카드별 기록 목록 (남긴 순서). */
function progressOf(doc: DataFile, cardId: string): ProgressEntry[] {
  return doc.progressEntries.filter((e) => e.cardId === cardId)
}

describe('진행 기록 추가', () => {
  test('TC-024 기록은 남긴 순서로 쌓이고 다른 카드의 기록과 섞이지 않는다', () => {
    const ctx = makeContext(BASE_INSTANT, 'e')
    let doc = makeDoc({ cards: [makeCard({ id: 'A', title: '카드 A' }), makeCard({ id: 'B', title: '카드 B' })] })

    for (const [cardId, content] of [
      ['A', 'x'],
      ['A', 'y'],
      ['B', 'w'],
      ['A', 'z'],
    ] as const) {
      const r = addProgress(doc, cardId, { content }, ctx)
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.value.changed).toBe(true)
        doc = r.value.next
      }
    }

    const a = progressOf(doc, 'A')
    const b = progressOf(doc, 'B')
    expect(a.map((e) => e.content)).toEqual(['x', 'y', 'z'])
    expect(a.map((e) => e.content)).not.toContain('w')
    expect(a.every((e) => e.cardId === 'A')).toBe(true)
    expect(b.map((e) => e.content)).toEqual(['w'])
    expect(b[0]?.cardId).toBe('B')
    // 문서 전체에서도 남긴 순서가 그대로다 (기록 id 는 모두 다르다)
    expect(doc.progressEntries.map((e) => e.content)).toEqual(['x', 'y', 'w', 'z'])
    expect(new Set(doc.progressEntries.map((e) => e.id)).size).toBe(4)
  })

  test('TC-025 각 기록에는 남긴 때의 카드 상태가 붙고 나중에 상태가 바뀌어도 변하지 않는다', () => {
    const ctx = makeContext(BASE_INSTANT, 'e')
    const doc0 = makeDoc({ cards: [makeCard({ id: 'A', status: 'todo' })] })

    const first = addProgress(doc0, 'A', { content: '할 일일 때' }, ctx)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.value.statusAtTime).toBe('todo')

    const doc1 = withStatus(first.value.next, 'A', 'in_progress')
    const second = addProgress(doc1, 'A', { content: '진행 중일 때' }, ctx)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.value.statusAtTime).toBe('in_progress')

    const doc2 = withStatus(second.value.next, 'A', 'done')
    const third = addProgress(doc2, 'A', { content: '완료일 때' }, ctx)
    expect(third.ok).toBe(true)
    if (!third.ok) return
    expect(third.value.value.statusAtTime).toBe('done')

    // 카드가 완료로 바뀐 뒤에도 먼저 남긴 두 기록의 값은 그대로다
    const final = third.value.next
    expect(progressOf(final, 'A').map((e) => e.statusAtTime)).toEqual(['todo', 'in_progress', 'done'])
    expect(final.cards[0]?.status).toBe('done')

    // 카드를 다시 할 일로 되돌려도 기록 값은 변하지 않는다
    const back = withStatus(final, 'A', 'todo')
    expect(progressOf(back, 'A').map((e) => e.statusAtTime)).toEqual(['todo', 'in_progress', 'done'])
  })

  test.each([
    ['빈 문자열', ''],
    ['공백뿐', '   '],
    ['탭·줄바꿈뿐', '\t\n '],
  ])('TC-026 내용이 %s 이면 content/REQUIRED 위반이고 기록은 1건 그대로다', (_name, content) => {
    const existing = makeEntry({ id: 'old', cardId: 'A', content: '먼저 남긴 기록' })
    const doc = makeDoc({ cards: [makeCard({ id: 'A' })], progressEntries: [existing] })
    const ctx = makeContext(BASE_INSTANT, 'e')
    const before = JSON.stringify(doc)

    const r = addProgress(doc, 'A', { content }, ctx)

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('VALIDATION_FAILED')
      expect(r.error.details).toEqual({ violations: [{ field: 'content', reason: 'REQUIRED' }] })
    }
    expect(doc.progressEntries).toEqual([existing])
    expect(JSON.stringify(doc)).toBe(before)
  })

  test('TC-026 내용이 빈 호출이 이어져도 기록은 1건 그대로다', () => {
    const existing = makeEntry({ id: 'old', cardId: 'A' })
    let doc = makeDoc({ cards: [makeCard({ id: 'A' })], progressEntries: [existing] })
    const ctx = makeContext(BASE_INSTANT, 'e')

    for (const content of ['', '   ']) {
      const r = addProgress(doc, 'A', { content }, ctx)
      expect(r.ok).toBe(false)
      if (r.ok) doc = r.value.next
    }
    expect(progressOf(doc, 'A')).toHaveLength(1)
  })
})

describe('진행 기록 추가 보조 규칙', () => {
  test('보관된 카드에는 CARD_ARCHIVED 로 거절하고 문서는 바뀌지 않는다', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A', status: 'done', archivedAt: BASE_INSTANT })] })
    const r = addProgress(doc, 'A', { content: '보관 뒤 기록' }, makeContext())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('CARD_ARCHIVED')
    expect(doc.progressEntries).toEqual([])
  })

  test('없는 카드에는 CARD_NOT_FOUND 와 details.id 로 거절한다', () => {
    const r = addProgress(makeDoc(), 'ghost', { content: '내용' }, makeContext())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('CARD_NOT_FOUND')
      expect(r.error.details).toEqual({ id: 'ghost' })
    }
  })

  test('입력 검증이 카드 확인보다 먼저다 (없는 카드에 빈 내용이면 VALIDATION_FAILED)', () => {
    const r = addProgress(makeDoc(), 'ghost', { content: '' }, makeContext())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('VALIDATION_FAILED')
  })

  test('statusAtTime 같은 정의 없는 필드는 UNKNOWN_FIELD 로 거절한다', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A' })] })
    const r = addProgress(doc, 'A', { content: '내용', statusAtTime: 'done' }, makeContext())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.details).toEqual({ violations: [{ field: 'statusAtTime', reason: 'UNKNOWN_FIELD' }] })
  })

  test('내용의 앞뒤 공백을 빼서 저장하고 id·시각은 ctx 에서 받으며 받은 문서는 바꾸지 않는다', () => {
    const iso = '2026-11-04T01:02:03.456Z'
    const doc = makeDoc({ cards: [makeCard({ id: 'A' })] })
    const before = JSON.stringify(doc)

    const entry = addOk(doc, 'A', '  재현 조건 확인  ', makeContext(iso, 'e'))

    expect(entry).toEqual({
      id: 'e-1',
      cardId: 'A',
      content: '재현 조건 확인',
      statusAtTime: 'todo',
      createdAt: iso,
    })
    expect(JSON.stringify(doc)).toBe(before)
  })

  test('입력이 객체가 아니면 input/INVALID_TYPE 으로 거절한다', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A' })] })
    const r = addProgress(doc, 'A', 'text', makeContext())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.details).toEqual({ violations: [{ field: 'input', reason: 'INVALID_TYPE' }] })
  })
})
