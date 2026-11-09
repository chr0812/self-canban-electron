import { describe, expect, test } from 'vitest'
import {
  applyConditions,
  buildBoardModel,
  columnCounts,
  countFilters,
  orderForDisplay,
  overdueCount,
  splitByStatus,
} from '../../../src/renderer/src/model/board-model'
import { PRIORITIES } from '../../../src/shared/constants'
import type { Card } from '../../../src/shared/types/card'
import { makeCard } from '../support/builders'

/** 할 일 2건, 진행 중 1건, 완료 3건. 종류·우선순위가 섞여 있다. */
function sixCards(): Card[] {
  return [
    makeCard({ id: 'a1', title: '세금 신고', status: 'todo', kind: 'task', priority: 'high' }),
    makeCard({ id: 'a2', title: '로그인 오류', status: 'todo', kind: 'bug', priority: 'medium' }),
    makeCard({ id: 'b1', title: '결제 화면', status: 'in_progress', kind: 'bug', priority: null }),
    makeCard({ id: 'c1', title: '영수증 정리', status: 'done', kind: 'task', priority: 'low' }),
    makeCard({ id: 'c2', title: '배포 점검', status: 'done', kind: 'task', priority: null }),
    makeCard({ id: 'c3', title: '메모 정리', status: 'done', kind: 'bug', priority: 'high' }),
  ]
}

describe('칸 나누기와 건수', () => {
  test('TC-057 카드는 자기 상태의 칸에만 놓이고 칸 건수가 맞다', () => {
    const cards = sixCards()
    const model = buildBoardModel(cards, 'board')

    expect(model.columns.map((c) => c.status)).toEqual(['todo', 'in_progress', 'done'])
    expect(model.columns.map((c) => c.cards.length)).toEqual([2, 1, 3])
    expect(model.columns.map((c) => c.count)).toEqual([
      { shown: 2, total: 2 },
      { shown: 1, total: 1 },
      { shown: 3, total: 3 },
    ])

    // 모든 카드가 정확히 한 칸에만 있고, 칸 상태와 카드 상태가 같다
    const placedIds = model.columns.flatMap((c) => c.cards.map((card) => card.id))
    expect([...placedIds].sort()).toEqual(cards.map((c) => c.id).sort())
    expect(new Set(placedIds).size).toBe(cards.length)
    for (const column of model.columns) {
      for (const card of column.cards) expect(card.status).toBe(column.status)
    }

    expect(model.totalCount).toBe(6)
    expect(model.shownCount).toBe(6)
    expect(model.hasConditions).toBe(false)
    expect(model.noResults).toBe(false)
    expect(model.isEmptyBoard).toBe(false)
  })

  test('TC-057 splitByStatus 는 받은 순서를 유지하고 빈 칸도 빈 배열로 돌려준다', () => {
    const split = splitByStatus([makeCard({ id: 'x1', status: 'done' }), makeCard({ id: 'x2', status: 'done' })])
    expect(split.todo).toEqual([])
    expect(split.in_progress).toEqual([])
    expect(split.done.map((c) => c.id)).toEqual(['x1', 'x2'])
  })

  test('TC-057 카드가 없는 칸은 빈 칸이고 오류 없이 모델이 만들어진다', () => {
    const model = buildBoardModel([makeCard({ id: 'only', status: 'todo' })], 'board')
    expect(model.columns.map((c) => c.cards.length)).toEqual([1, 0, 0])
    expect(model.columns[1]?.count).toEqual({ shown: 0, total: 0 })
    // 카드는 있으므로 빈 보드가 아니다
    expect(model.isEmptyBoard).toBe(false)
  })

  test('TC-057 조건이 있으면 칸 건수는 보이는 수와 전체 수를 따로 담는다 (2 / 6 모양)', () => {
    const cards = sixCards()
    const model = buildBoardModel(cards, 'board', { kind: 'bug' })
    expect(model.columns.map((c) => c.count)).toEqual([
      { shown: 1, total: 2 },
      { shown: 1, total: 1 },
      { shown: 1, total: 3 },
    ])
    expect(model.totalCount).toBe(6)
    expect(model.shownCount).toBe(3)

    const counts = columnCounts(cards, applyConditions(cards, { scope: 'board', kind: 'bug' }))
    expect(counts.todo).toEqual({ shown: 1, total: 2 })
  })
})

describe('조건 적용', () => {
  test('TC-057 보드는 보관한 카드를 담지 않고 보관함은 보관한 카드만 담는다', () => {
    const cards = [
      makeCard({ id: 'live', status: 'done' }),
      makeCard({ id: 'old', status: 'done', archivedAt: '2026-11-01T00:00:00.000Z' }),
    ]
    const board = buildBoardModel(cards, 'board')
    expect(board.list.map((c) => c.id)).toEqual(['live'])
    expect(board.totalCount).toBe(1)

    const archive = buildBoardModel(cards, 'archive')
    expect(archive.list.map((c) => c.id)).toEqual(['old'])
    expect(archive.totalCount).toBe(1)
  })

  test('TC-057 검색어와 종류·우선순위는 함께 걸면 모두 만족하는 카드만 남는다', () => {
    const cards = sixCards()
    expect(
      buildBoardModel(cards, 'board', { text: '정리' })
        .list.map((c) => c.id)
        .sort(),
    ).toEqual(['c1', 'c3'])
    expect(buildBoardModel(cards, 'board', { text: '정리', kind: 'bug' }).list.map((c) => c.id)).toEqual(['c3'])
    expect(buildBoardModel(cards, 'board', { kind: 'bug', priority: 'high' }).list.map((c) => c.id)).toEqual(['c3'])
    // 우선순위가 없는 카드는 우선순위 조건에 맞지 않는다
    expect(buildBoardModel(cards, 'board', { priority: 'low' }).list.map((c) => c.id)).toEqual(['c1'])
  })

  test('TC-057 조건을 지우면 모든 카드가 다시 보이고 빈 검색어는 조건으로 치지 않는다', () => {
    const cards = sixCards()
    const cleared = buildBoardModel(cards, 'board', { text: '   ' })
    expect(cleared.hasConditions).toBe(false)
    expect(cleared.conditions).toEqual({})
    expect(cleared.shownCount).toBe(6)
  })
})

describe('결과 없음', () => {
  test('TC-058 조건에 맞는 카드가 없으면 결과 없음과 적용 중인 조건을 돌려주고 빈 보드와 구분된다', () => {
    const cards = sixCards()
    expect(cards).toHaveLength(6)

    const none = buildBoardModel(cards, 'board', { text: '없는검색어', kind: 'bug' })
    expect(none.columns.map((c) => c.cards.length)).toEqual([0, 0, 0])
    expect(none.shownCount).toBe(0)
    expect(none.noResults).toBe(true)
    expect(none.isEmptyBoard).toBe(false)
    expect(none.hasConditions).toBe(true)
    expect(none.conditions).toEqual({ text: '없는검색어', kind: 'bug' })
    // 칸 머리 건수는 `0 / N` 모양이 되도록 전체 수를 유지한다
    expect(none.columns.map((c) => c.count)).toEqual([
      { shown: 0, total: 2 },
      { shown: 0, total: 1 },
      { shown: 0, total: 3 },
    ])
    expect(none.totalCount).toBe(6)

    const empty = buildBoardModel([], 'board')
    expect(empty.columns.map((c) => c.cards.length)).toEqual([0, 0, 0])
    expect(empty.noResults).toBe(false)
    expect(empty.isEmptyBoard).toBe(true)
    expect(empty.hasConditions).toBe(false)
    expect(empty.conditions).toEqual({})
  })

  test('TC-058 검색어 앞뒤 공백은 적용 중인 조건에서 빠지고 보관함도 같은 규칙이다', () => {
    const archived = [makeCard({ id: 'old', title: '세금', archivedAt: '2026-11-01T00:00:00.000Z' })]
    const none = buildBoardModel(archived, 'archive', { text: '  없음  ' })
    expect(none.noResults).toBe(true)
    expect(none.conditions).toEqual({ text: '없음' })

    const hit = buildBoardModel(archived, 'archive', { text: '세금' })
    expect(hit.noResults).toBe(false)
    expect(hit.list).toHaveLength(1)
  })

  test('TC-058 카드가 0건이어도 조건이 걸려 있으면 조건을 지울 수 있게 결과 없음으로 알린다', () => {
    const model = buildBoardModel([], 'board', { text: '무엇' })
    expect(model.noResults).toBe(true)
    expect(model.isEmptyBoard).toBe(false)
    expect(model.conditions).toEqual({ text: '무엇' })
  })
})

describe('사이드바 건수와 마감 지남 수', () => {
  test('TC-057 필터 숫자는 종류별·우선순위별로 세고 우선순위가 없는 카드는 어느 우선순위에도 세지 않는다', () => {
    const counts = countFilters(sixCards())
    expect(counts.total).toBe(6)
    expect(counts.byKind).toEqual({ bug: 3, task: 3 })
    expect(counts.byPriority).toEqual({ high: 2, medium: 1, low: 1 })
    expect(countFilters([])).toEqual({
      total: 0,
      byKind: { bug: 0, task: 0 },
      byPriority: { high: 0, medium: 0, low: 0 },
    })
  })

  test('TC-057 마감 지난 카드 수는 마감일이 오늘보다 앞이고 완료가 아닌 카드만 센다', () => {
    const cards = [
      makeCard({ id: 'late', dueDate: '2026-11-02', status: 'todo' }),
      makeCard({ id: 'late2', dueDate: '2026-10-01', status: 'in_progress' }),
      makeCard({ id: 'today', dueDate: '2026-11-03', status: 'todo' }),
      makeCard({ id: 'done', dueDate: '2026-10-01', status: 'done' }),
      makeCard({ id: 'none', dueDate: null, status: 'todo' }),
    ]
    expect(overdueCount(cards, '2026-11-03')).toBe(2)
    expect(overdueCount([], '2026-11-03')).toBe(0)
  })
})

describe('사이드바 `전체` 건수와 우선순위 순서 (명세 v4)', () => {
  /** 보드 범위 7건: 개발 버그 3·할 일 4, 우선순위 높음 2·중간 1·낮음 2·없음 2. */
  function boardScopeCards(): Card[] {
    return [
      makeCard({ id: 's1', status: 'todo', kind: 'bug', priority: 'high' }),
      makeCard({ id: 's2', status: 'todo', kind: 'bug', priority: 'high' }),
      makeCard({ id: 's3', status: 'in_progress', kind: 'bug', priority: null }),
      makeCard({ id: 's4', status: 'todo', kind: 'task', priority: 'medium' }),
      makeCard({ id: 's5', status: 'done', kind: 'task', priority: 'low' }),
      makeCard({ id: 's6', status: 'done', kind: 'task', priority: 'low' }),
      makeCard({ id: 's7', status: 'todo', kind: 'task', priority: null }),
    ]
  }
  function archiveScopeCards(): Card[] {
    return [
      makeCard({ id: 'z1', status: 'done', kind: 'bug', priority: 'high', archivedAt: '2026-11-01T00:00:00.000Z' }),
      makeCard({ id: 'z2', status: 'done', kind: 'task', priority: null, archivedAt: '2026-11-02T00:00:00.000Z' }),
    ]
  }

  test('TC-162 `전체` 건수(total)는 범위 전체이고 종류·우선순위 건수와 보관 범위가 섞이지 않는다', () => {
    const boardCards = boardScopeCards()
    const archiveCards = archiveScopeCards()
    // 준비 조건: 범위 카드가 전제대로 만들어졌다
    expect(boardCards).toHaveLength(7)
    expect(boardCards.every((c) => c.archivedAt === null)).toBe(true)
    expect(archiveCards).toHaveLength(2)
    expect(archiveCards.every((c) => c.archivedAt !== null)).toBe(true)

    const boardCounts = countFilters(boardCards)
    expect(boardCounts.total).toBe(7)
    expect(boardCounts.byKind).toEqual({ bug: 3, task: 4 })
    expect(boardCounts.byPriority).toEqual({ low: 2, medium: 1, high: 2 })
    // 우선순위 없는 카드 2건은 total 에만 센다
    const prioritySum = boardCounts.byPriority.low + boardCounts.byPriority.medium + boardCounts.byPriority.high
    expect(boardCounts.total - prioritySum).toBe(2)

    const archiveCounts = countFilters(archiveCards)
    expect(archiveCounts.total).toBe(2)
    expect(archiveCounts.byKind).toEqual({ bug: 1, task: 1 })
    expect(archiveCounts.byPriority).toEqual({ low: 0, medium: 0, high: 1 })

    // 두 범위가 한 배열에 섞여 와도 보드 모델은 보드 범위만 센다 (보관 카드가 보드 건수에 섞이지 않는다)
    const mixed = [...boardCards, ...archiveCards]
    expect(buildBoardModel(mixed, 'board').totalCount).toBe(7)
    expect(buildBoardModel(mixed, 'archive').totalCount).toBe(2)
  })

  test('TC-162 조건을 건 보드 모델의 totalCount 도 범위 전체이고 `전체`를 고르면(undefined) 조건이 지워진다', () => {
    const cards = boardScopeCards()

    const plain = buildBoardModel(cards, 'board')
    expect(plain.hasConditions).toBe(false)
    expect(plain.totalCount).toBe(7)

    const filtered = buildBoardModel(cards, 'board', { kind: 'bug', text: '없는검색어' })
    // 준비 조건: 조건이 실제로 적용되어 보이는 카드가 0건이다
    expect(filtered.hasConditions).toBe(true)
    expect(filtered.conditions).toEqual({ kind: 'bug', text: '없는검색어' })
    expect(filtered.shownCount).toBe(0)
    expect(filtered.totalCount).toBe(7)

    // 종류·우선순위를 undefined 로 되돌리면 그 조건이 지워져 모든 카드가 다시 보인다
    const cleared = buildBoardModel(cards, 'board', { kind: undefined, priority: undefined })
    expect(cleared.hasConditions).toBe(false)
    expect(cleared.conditions).toEqual({})
    expect(cleared.shownCount).toBe(7)
    const priorityOnly = buildBoardModel(cards, 'board', { kind: undefined, priority: 'low' })
    expect(priorityOnly.conditions).toEqual({ priority: 'low' })
    expect(priorityOnly.shownCount).toBe(2)
    expect(priorityOnly.totalCount).toBe(7)
  })

  test('TC-162 우선순위 허용 값 목록(PRIORITIES)은 낮음, 중간, 높음 순서이고 `없음` 항목이 없다', () => {
    expect([...PRIORITIES]).toEqual(['low', 'medium', 'high'])
    expect(PRIORITIES).toHaveLength(3)
    expect(PRIORITIES.map(String)).not.toContain('none')
    expect(PRIORITIES.map(String)).not.toContain('')
  })
})

describe('표시 순서 (임시 가정)', () => {
  test('TC-057 보드는 만든 순서의 최신이 위이고 마감 지난 카드를 올리지 않으며 입력 배열을 바꾸지 않는다', () => {
    const cards = [
      makeCard({ id: 'old', createdAt: '2026-11-01T09:00:00.000Z', dueDate: '2026-10-01' }),
      makeCard({ id: 'mid', createdAt: '2026-11-02T09:00:00.000Z' }),
      makeCard({ id: 'new', createdAt: '2026-11-03T09:00:00.000Z' }),
    ]
    const before = cards.map((c) => c.id)
    expect(orderForDisplay(cards, 'board').map((c) => c.id)).toEqual(['new', 'mid', 'old'])
    expect(cards.map((c) => c.id)).toEqual(before)
  })

  test('TC-057 만든 시각이 같으면 나중에 저장된 카드가 위에 온다', () => {
    const cards = [makeCard({ id: 'first' }), makeCard({ id: 'second' }), makeCard({ id: 'third' })]
    expect(orderForDisplay(cards, 'board').map((c) => c.id)).toEqual(['third', 'second', 'first'])
  })

  test('TC-057 보관함은 보관한 날이 최신인 카드가 위이고 칸 안 순서도 이 순서를 따른다', () => {
    const cards = [
      makeCard({ id: 'p', status: 'done', archivedAt: '2026-10-30T00:00:00.000Z' }),
      makeCard({ id: 'q', status: 'done', archivedAt: '2026-11-02T00:00:00.000Z' }),
      makeCard({ id: 'r', status: 'done', archivedAt: '2026-11-01T00:00:00.000Z' }),
    ]
    expect(orderForDisplay(cards, 'archive').map((c) => c.id)).toEqual(['q', 'r', 'p'])
    expect(buildBoardModel(cards, 'archive').list.map((c) => c.id)).toEqual(['q', 'r', 'p'])

    const board = buildBoardModel(
      [
        makeCard({ id: 'm', status: 'todo', createdAt: '2026-11-01T09:00:00.000Z' }),
        makeCard({ id: 'n', status: 'todo', createdAt: '2026-11-02T09:00:00.000Z' }),
        makeCard({ id: 'o', status: 'done', createdAt: '2026-11-03T09:00:00.000Z' }),
      ],
      'board',
    )
    expect(board.columns[0]?.cards.map((c) => c.id)).toEqual(['n', 'm'])
  })
})
