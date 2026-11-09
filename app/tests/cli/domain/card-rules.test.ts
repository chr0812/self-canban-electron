import { describe, expect, test } from 'vitest'
import { archiveCard, changeStatus, createCard, deleteCard, updateCard } from '../../../src/shared/domain/card-rules'
import { addProgress } from '../../../src/shared/domain/progress-rules'
import type { RuleContext } from '../../../src/shared/domain/rule-support'
import type { Card, DataFile, Status } from '../../../src/shared/types/card'
import { BASE_INSTANT, makeCard, makeContext, makeDoc, makeEntry } from '../support/builders'

/** 성공을 기대하고 결과를 꺼낸다. 실패면 시험이 바로 깨진다. */
function okOutcome<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`성공을 기대했지만 실패했다: ${JSON.stringify(r.error)}`)
  return r.value
}

function createOk(doc: DataFile, input: unknown, ctx: RuleContext) {
  return okOutcome(createCard(doc, input, ctx))
}

function cardOf(doc: DataFile, id: string): Card | undefined {
  return doc.cards.find((c) => c.id === id)
}

const FULL_CARD: Partial<Card> = {
  id: 'A',
  title: '세금 신고',
  status: 'in_progress',
  kind: 'bug',
  description: '상세 설명',
  dueDate: '2026-11-06',
  priority: 'high',
  memo: '추가 메모',
}

describe('카드 만들기', () => {
  test('TC-007 종류를 고르지 않고 만든 카드는 할 일로 저장된다', () => {
    const ctx = makeContext(BASE_INSTANT, 'c')
    const first = createOk(makeDoc(), { title: '영수증 정리' }, ctx)
    expect(first.value.kind).toBe('task')

    const second = createOk(first.next, { title: '렌더링 오류', kind: 'bug' }, ctx)
    expect(second.value.kind).toBe('bug')
    expect(second.next.cards.map((c) => c.kind)).toEqual(['task', 'bug'])
  })

  test('TC-010 여러 위반은 한 번에 모아 돌려주고 카드는 만들어지지 않는다', () => {
    const doc = makeDoc()
    const r = createCard(doc, { title: '', dueDate: '2026-02-30' }, makeContext())

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('VALIDATION_FAILED')
      expect(r.error.details).toEqual({
        violations: [
          { field: 'title', reason: 'REQUIRED' },
          { field: 'dueDate', reason: 'INVALID_DATE' },
        ],
      })
    }
    expect(doc.cards).toEqual([])
  })

  test('TC-011 새 카드는 할 일 상태로 만들어지고 완료 상태로는 만들 수 없다', () => {
    const iso = '2026-11-04T01:02:03.456Z'
    const ctx = makeContext(iso, 'c')
    const doc = makeDoc()

    // (1)
    const created = createOk(doc, { title: '세금 신고' }, ctx)
    expect(created.changed).toBe(true)
    expect(created.value).toEqual({
      id: 'c-1',
      title: '세금 신고',
      status: 'todo',
      kind: 'task',
      description: '',
      dueDate: null,
      priority: null,
      memo: '',
      archivedAt: null,
      createdAt: iso,
    })
    expect(created.next.cards).toEqual([created.value])
    expect(doc.cards).toEqual([])

    // (2) 진행 중으로 만들 수 있고 진행 기록은 만들어지지 않는다
    const started = createOk(created.next, { title: '진행 카드', status: 'in_progress' }, ctx)
    expect(started.changed).toBe(true)
    expect(started.value.status).toBe('in_progress')
    expect(started.next.cards).toHaveLength(2)
    expect(started.next.progressEntries).toEqual([])

    // 상태를 명시한 todo 도 그대로 todo
    const explicitTodo = createOk(started.next, { title: '명시 할 일', status: 'todo' }, ctx)
    expect(explicitTodo.value.status).toBe('todo')

    // (3)
    const r = createCard(started.next, { title: '다른 카드', status: 'done' }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('VALIDATION_FAILED')
      expect(r.error.details).toEqual({ violations: [{ field: 'status', reason: 'INVALID_VALUE' }] })
    }
    expect(started.next.cards).toHaveLength(2)
  })

  test('TC-012 마감일을 비우거나 생략해도 카드가 만들어진다', () => {
    const ctx = makeContext(BASE_INSTANT, 'c')
    const omitted = createOk(makeDoc(), { title: '마감 생략' }, ctx)
    const explicit = createOk(omitted.next, { title: '마감 null', dueDate: null }, ctx)

    expect(omitted.value.dueDate).toBeNull()
    expect(explicit.value.dueDate).toBeNull()
    expect(explicit.next.cards).toHaveLength(2)
    expect(explicit.next.cards.every((c) => c.dueDate === null)).toBe(true)
  })

  test('TC-013 입력한 모든 항목이 저장 뒤 조회에 그대로 나온다', () => {
    const input = {
      title: '결제 화면 오류',
      kind: 'bug',
      description: '카드 결제 때 멈춘다',
      dueDate: '2026-11-06',
      priority: 'high',
      memo: '재현 영상 첨부',
    } as const
    const created = createOk(makeDoc(), input, makeContext(BASE_INSTANT, 'c'))

    const stored = cardOf(created.next, created.value.id)
    expect(stored).toMatchObject(input)
    expect(stored?.status).toBe('todo')
    expect(stored?.archivedAt).toBeNull()
  })

  test('제목의 앞뒤 공백은 빼서 저장한다', () => {
    const created = createOk(makeDoc(), { title: '  세금 신고  ' }, makeContext())
    expect(created.value.title).toBe('세금 신고')
  })
})

describe('카드 수정', () => {
  test.each([[''], ['   ']])('TC-016 수정하다 제목을 %j 로 비우면 거부되고 카드는 그대로다', (title) => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A', title: '세금 신고' })] })
    const before = JSON.stringify(doc)

    const r = updateCard(doc, 'A', { title }, makeContext())

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('VALIDATION_FAILED')
      expect(r.error.details).toEqual({ violations: [{ field: 'title', reason: 'REQUIRED' }] })
    }
    expect(cardOf(doc, 'A')?.title).toBe('세금 신고')
    expect(JSON.stringify(doc)).toBe(before)
  })

  test('TC-017 수정은 보낸 항목만 바꾸고 나머지는 유지한다', () => {
    const ctx = makeContext()
    const doc = makeDoc({ cards: [makeCard(FULL_CARD)] })
    const original = cardOf(doc, 'A') as Card

    // (1) 메모만 수정
    const memoOnly = okOutcome(updateCard(doc, 'A', { memo: '새 메모' }, ctx))
    expect(memoOnly.changed).toBe(true)
    expect(memoOnly.value).toEqual({ ...original, memo: '새 메모' })
    expect(cardOf(memoOnly.next, 'A')).toEqual({ ...original, memo: '새 메모' })

    // (2) 마감일 비우기
    const dueCleared = okOutcome(updateCard(memoOnly.next, 'A', { dueDate: null }, ctx))
    expect(dueCleared.changed).toBe(true)
    expect(dueCleared.value).toEqual({ ...original, memo: '새 메모', dueDate: null })

    // (3) 빈 수정
    const empty = okOutcome(updateCard(dueCleared.next, 'A', {}, ctx))
    expect(empty.changed).toBe(false)
    expect(empty.value).toEqual(dueCleared.value)
    expect(empty.next).toBe(dueCleared.next)
  })

  test('보낸 값이 지금과 같으면 바뀐 것이 없다', () => {
    const doc = makeDoc({ cards: [makeCard(FULL_CARD)] })
    const r = okOutcome(updateCard(doc, 'A', { title: '  세금 신고 ', priority: 'high' }, makeContext()))
    expect(r.changed).toBe(false)
    expect(r.next).toBe(doc)
  })

  test('수정으로 status 도 함께 바꾼다 (한 번의 호출)', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A', status: 'todo' })] })
    const r = okOutcome(updateCard(doc, 'A', { title: '새 제목', status: 'done' }, makeContext()))
    expect(r.changed).toBe(true)
    expect(r.value.status).toBe('done')
    expect(r.value.title).toBe('새 제목')
  })

  test('status 에 archived 를 넣거나 id 같은 정의 없는 항목을 보내면 거부한다', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A' })] })
    const r = updateCard(doc, 'A', { status: 'archived', id: 'Z' }, makeContext())
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('VALIDATION_FAILED')
      expect(r.error.details).toEqual({
        violations: [
          { field: 'status', reason: 'INVALID_VALUE' },
          { field: 'id', reason: 'UNKNOWN_FIELD' },
        ],
      })
    }
  })

  test('없는 카드는 CARD_NOT_FOUND, 입력 검증이 카드 확인보다 먼저다', () => {
    const missing = updateCard(makeDoc(), 'ghost', { memo: 'x' }, makeContext())
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.error.code).toBe('CARD_NOT_FOUND')
      expect(missing.error.details).toEqual({ id: 'ghost' })
    }

    const invalid = updateCard(makeDoc(), 'ghost', { title: '' }, makeContext())
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('카드 상태 변경', () => {
  test('TC-014 카드 상태는 세 값 사이에서 어느 방향으로든 바뀐다', () => {
    let doc = makeDoc({ cards: [makeCard({ id: 'A', status: 'todo' })] })
    const sequence: Status[] = ['in_progress', 'done', 'todo', 'done', 'in_progress']

    for (const status of sequence) {
      const r = okOutcome(changeStatus(doc, 'A', status))
      expect(r.changed).toBe(true)
      expect(r.value.status).toBe(status)
      expect(cardOf(r.next, 'A')?.status).toBe(status)
      doc = r.next
    }
  })

  test('TC-015 같은 상태를 다시 고르면 아무것도 바뀌지 않는다', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A', status: 'in_progress' })] })
    const before = JSON.stringify(doc)

    const r = okOutcome(changeStatus(doc, 'A', 'in_progress'))

    expect(r.changed).toBe(false)
    expect(r.value).toEqual(cardOf(doc, 'A'))
    expect(r.next).toBe(doc)
    expect(JSON.stringify(doc)).toBe(before)
  })

  test('상태 값이 목록 밖이면 status/INVALID_VALUE 로 거부한다 (보관은 상태가 아니다)', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A', status: 'done' })] })
    for (const bad of ['archived', 'DONE', 3, null]) {
      const r = changeStatus(doc, 'A', bad)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.error.code).toBe('VALIDATION_FAILED')
        expect(r.error.details).toEqual({
          violations: [{ field: 'status', reason: 'INVALID_VALUE' }],
        })
      }
    }
  })

  test('없는 카드는 CARD_NOT_FOUND 다', () => {
    const r = changeStatus(makeDoc(), 'ghost', 'done')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('CARD_NOT_FOUND')
  })
})

describe('카드 보관', () => {
  test('TC-018 완료 카드를 보관하면 보관 표시가 붙고 상태는 완료로 남는다', () => {
    const iso = '2026-11-04T05:06:07.000Z'
    const doc = makeDoc({ cards: [makeCard({ id: 'A', status: 'done' })] })

    const r = okOutcome(archiveCard(doc, 'A', makeContext(iso)))

    expect(r.changed).toBe(true)
    expect(r.value.archivedAt).toBe(iso)
    expect(r.value.status).toBe('done')
    expect(cardOf(r.next, 'A')).toEqual({ ...cardOf(doc, 'A'), archivedAt: iso })
    expect(cardOf(doc, 'A')?.archivedAt).toBeNull()
  })

  test('TC-019 완료가 아닌 카드는 보관되지 않는다', () => {
    const doc = makeDoc({
      cards: [makeCard({ id: 'T', status: 'todo' }), makeCard({ id: 'P', status: 'in_progress' })],
    })
    const before = JSON.stringify(doc)

    for (const [id, status] of [
      ['T', 'todo'],
      ['P', 'in_progress'],
    ] as const) {
      const r = archiveCard(doc, id, makeContext())
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.error.code).toBe('ARCHIVE_NOT_ALLOWED')
        expect(r.error.details).toEqual({ status })
      }
    }
    expect(JSON.stringify(doc)).toBe(before)
    expect(doc.cards.every((c) => c.archivedAt === null)).toBe(true)
  })

  test('없는 카드는 CARD_NOT_FOUND 다', () => {
    const r = archiveCard(makeDoc(), 'ghost', makeContext())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('CARD_NOT_FOUND')
  })

  test('TC-020 보관한 카드는 수정, 상태 변경, 기록 추가, 다시 보관이 거부된다', () => {
    const doc = makeDoc({
      cards: [makeCard({ id: 'A', status: 'done', archivedAt: BASE_INSTANT })],
      progressEntries: [makeEntry({ id: 'e1', cardId: 'A' })],
    })
    const before = JSON.stringify(doc)
    const ctx = makeContext()

    const results = [
      updateCard(doc, 'A', { memo: '고침' }, ctx),
      changeStatus(doc, 'A', 'todo'),
      addProgress(doc, 'A', { content: '보관 뒤 기록' }, ctx),
      archiveCard(doc, 'A', ctx),
    ]

    for (const r of results) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('CARD_ARCHIVED')
    }
    expect(JSON.stringify(doc)).toBe(before)
    expect(doc.progressEntries).toHaveLength(1)
  })

  test('보관한 카드의 수정은 빈 patch 여도 거부한다 (입력 검증 다음에 보관을 본다)', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A', status: 'done', archivedAt: BASE_INSTANT })] })
    const r = updateCard(doc, 'A', {}, makeContext())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('CARD_ARCHIVED')
  })
})

describe('카드 삭제', () => {
  test('TC-021 카드를 삭제하면 그 카드의 진행 기록도 함께 삭제된다', () => {
    const doc = makeDoc({
      cards: [makeCard({ id: 'A' }), makeCard({ id: 'B' })],
      progressEntries: [
        makeEntry({ id: 'a1', cardId: 'A' }),
        makeEntry({ id: 'b1', cardId: 'B' }),
        makeEntry({ id: 'a2', cardId: 'A' }),
        makeEntry({ id: 'b2', cardId: 'B' }),
        makeEntry({ id: 'a3', cardId: 'A' }),
      ],
    })
    const before = JSON.stringify(doc)

    const r = okOutcome(deleteCard(doc, 'A'))

    expect(r.changed).toBe(true)
    expect(r.value).toEqual({ deletedCardId: 'A', deletedProgressCount: 3 })
    expect(r.next.cards.map((c) => c.id)).toEqual(['B'])
    expect(r.next.progressEntries.map((e) => e.id)).toEqual(['b1', 'b2'])
    expect(r.next.progressEntries.some((e) => e.cardId === 'A')).toBe(false)
    expect(JSON.stringify(doc)).toBe(before)
  })

  test('TC-135 보관한 카드도 삭제할 수 있고 그 카드의 진행 기록이 함께 삭제된다', () => {
    const doc = makeDoc({
      cards: [
        makeCard({ id: 'A', status: 'done', archivedAt: BASE_INSTANT }),
        makeCard({ id: 'B', status: 'done', archivedAt: BASE_INSTANT }),
        makeCard({ id: 'C', status: 'todo' }),
      ],
      progressEntries: [
        makeEntry({ id: 'a1', cardId: 'A' }),
        makeEntry({ id: 'a2', cardId: 'A' }),
        makeEntry({ id: 'b1', cardId: 'B' }),
        makeEntry({ id: 'c1', cardId: 'C' }),
      ],
    })

    const r = deleteCard(doc, 'A')

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.value).toEqual({ deletedCardId: 'A', deletedProgressCount: 2 })
    const next = r.value.next
    expect(cardOf(next, 'A')).toBeUndefined()
    expect(next.progressEntries.some((e) => e.cardId === 'A')).toBe(false)
    expect(cardOf(next, 'B')).toEqual(cardOf(doc, 'B'))
    expect(cardOf(next, 'B')?.archivedAt).toBe(BASE_INSTANT)
    expect(next.progressEntries.filter((e) => e.cardId === 'B').map((e) => e.id)).toEqual(['b1'])
    expect(cardOf(next, 'C')).toEqual(cardOf(doc, 'C'))
    expect(next.progressEntries.filter((e) => e.cardId === 'C').map((e) => e.id)).toEqual(['c1'])

    // 없는 아이디
    const before = JSON.stringify(next)
    const missing = deleteCard(next, 'ghost')
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.error.code).toBe('CARD_NOT_FOUND')
      expect(missing.error.details).toEqual({ id: 'ghost' })
    }
    expect(JSON.stringify(next)).toBe(before)

    // 수정·상태 변경·기록 추가는 보관 카드에서 여전히 거부된다 (TC-020)
    const ctx = makeContext()
    for (const blocked of [
      updateCard(doc, 'B', { memo: 'x' }, ctx),
      changeStatus(doc, 'B', 'todo'),
      addProgress(doc, 'B', { content: 'x' }, ctx),
    ]) {
      expect(blocked.ok).toBe(false)
      if (!blocked.ok) expect(blocked.error.code).toBe('CARD_ARCHIVED')
    }
  })

  test('기록이 없는 카드를 삭제하면 deletedProgressCount 는 0 이다', () => {
    const doc = makeDoc({ cards: [makeCard({ id: 'A' })] })
    const r = okOutcome(deleteCard(doc, 'A'))
    expect(r.value).toEqual({ deletedCardId: 'A', deletedProgressCount: 0 })
    expect(r.next.cards).toEqual([])
  })
})
