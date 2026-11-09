import { describe, expect, test } from 'vitest'
import { matchesQuery } from '../../../src/shared/domain/query-filter'
import type { Card, CardQuery } from '../../../src/shared/types/card'
import { makeCard } from '../support/builders'

function filterTitles(cards: Card[], query: CardQuery): string[] {
  return cards.filter((c) => matchesQuery(c, query)).map((c) => c.title)
}

describe('검색어', () => {
  const cards = [
    makeCard({ id: 'c1', title: '세금 신고서' }),
    makeCard({ id: 'c2', title: 'Tax Return' }),
    makeCard({ id: 'c3', title: '영수증' }),
    makeCard({ id: 'c4', title: '기타', description: '세금 관련 메모' }),
  ]

  test('TC-029 검색어는 제목에 포함된 글자만 보고 대소문자와 앞뒤 공백을 무시한다', () => {
    // 설명에만 '세금'이 있는 카드는 제외된다
    expect(filterTitles(cards, { scope: 'board', text: '세금' })).toEqual(['세금 신고서'])
    // 대소문자 무시
    expect(filterTitles(cards, { scope: 'board', text: 'tax' })).toEqual(['Tax Return'])
    expect(filterTitles(cards, { scope: 'board', text: 'TAX RETURN' })).toEqual(['Tax Return'])
    // 앞뒤 공백 무시: 공백이 붙은 검색어는 붙지 않은 것과 같은 결과
    expect(filterTitles(cards, { scope: 'board', text: '  세금  ' })).toEqual(
      filterTitles(cards, { scope: 'board', text: '세금' }),
    )
    expect(filterTitles(cards, { scope: 'board', text: '  세금  ' })).toEqual(['세금 신고서'])
    // 빈 검색어는 조건 없음
    expect(filterTitles(cards, { scope: 'board', text: '' })).toHaveLength(4)
    expect(filterTitles(cards, { scope: 'board', text: '   ' })).toHaveLength(4)
    // 검색어 없음도 전체
    expect(filterTitles(cards, { scope: 'board' })).toHaveLength(4)
    // 어느 제목에도 없는 글자
    expect(filterTitles(cards, { scope: 'board', text: '기타 아님' })).toEqual([])
  })

  test('TC-029 부분 일치이며 제목 안쪽 글자도 찾는다', () => {
    expect(filterTitles(cards, { scope: 'board', text: '신고' })).toEqual(['세금 신고서'])
    expect(filterTitles(cards, { scope: 'board', text: 'return' })).toEqual(['Tax Return'])
  })
})

describe('종류·우선순위 조건', () => {
  const cards = [
    makeCard({ id: 'b-high', title: '버그 높음', kind: 'bug', priority: 'high' }),
    makeCard({ id: 'b-low', title: '버그 낮음', kind: 'bug', priority: 'low' }),
    makeCard({ id: 't-high', title: '할 일 높음', kind: 'task', priority: 'high' }),
    makeCard({ id: 't-none', title: '할 일 없음', kind: 'task', priority: null }),
  ]

  test('TC-030 종류 또는 우선순위 조건은 그 값을 가진 카드만 남긴다', () => {
    expect(filterTitles(cards, { scope: 'board', kind: 'bug' })).toEqual(['버그 높음', '버그 낮음'])
    expect(filterTitles(cards, { scope: 'board', priority: 'high' })).toEqual(['버그 높음', '할 일 높음'])
    // 우선순위가 없는 카드는 어떤 우선순위 조건에도 나오지 않는다
    for (const priority of ['high', 'medium', 'low'] as const) {
      expect(filterTitles(cards, { scope: 'board', priority })).not.toContain('할 일 없음')
    }
  })

  test('TC-031 여러 조건은 모두 만족하는 카드만 남기고 조건을 지우면 전부 돌아온다', () => {
    // 종류와 우선순위를 함께
    expect(filterTitles(cards, { scope: 'board', kind: 'bug', priority: 'high' })).toEqual(['버그 높음'])
    // 검색어와 종류를 함께: 두 조건을 모두 만족하는 카드만
    expect(filterTitles(cards, { scope: 'board', text: '높음', kind: 'bug' })).toEqual(['버그 높음'])
    expect(filterTitles(cards, { scope: 'board', text: '높음', kind: 'task' })).toEqual(['할 일 높음'])
    expect(filterTitles(cards, { scope: 'board', text: '없음', kind: 'bug' })).toEqual([])
    // 모든 조건을 비우면 전체
    expect(filterTitles(cards, { scope: 'board' })).toHaveLength(4)
    expect(filterTitles(cards, { scope: 'board', text: '', kind: undefined, priority: undefined })).toHaveLength(4)
  })
})

describe('범위 구분', () => {
  const active = makeCard({ id: 'a', title: '보드 카드' })
  const archived = makeCard({
    id: 'z',
    title: '보관 카드',
    status: 'done',
    archivedAt: '2026-11-02T09:00:00.000Z',
  })

  test('board 범위에는 보관한 카드가 나오지 않고 archive 범위에는 보관한 카드만 나온다', () => {
    const cards = [active, archived]
    expect(filterTitles(cards, { scope: 'board' })).toEqual(['보드 카드'])
    expect(filterTitles(cards, { scope: 'archive' })).toEqual(['보관 카드'])
    // 검색어가 맞아도 범위가 다르면 나오지 않는다
    expect(filterTitles(cards, { scope: 'board', text: '보관' })).toEqual([])
    expect(filterTitles(cards, { scope: 'archive', text: '카드' })).toEqual(['보관 카드'])
  })
})
