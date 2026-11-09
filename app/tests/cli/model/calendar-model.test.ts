import { describe, expect, test } from 'vitest'
import {
  CALENDAR_CHIP_LIMIT,
  buildMonthGrid,
  buildWeek,
  cardsInCell,
  countDueInMonth,
  countWithoutDueDate,
  groupByDueDate,
  periodTitle,
  shiftPeriod,
  splitVisible,
} from '../../../src/renderer/src/model/calendar-model'
import { weekdayOf } from '../../../src/shared/domain/date-rules'
import { makeCard } from '../support/builders'

function dueCard(id: string, dueDate: string | null) {
  return makeCard({ id, title: `카드 ${id}`, dueDate })
}

function findCell(grid: ReturnType<typeof buildMonthGrid>, date: string) {
  for (const row of grid) {
    for (const cell of row) {
      if (cell.date === date) return cell
    }
  }
  return undefined
}

describe('월 격자', () => {
  test('TC-059 마감일이 있는 카드는 그 날짜 칸에 놓이고 마감일이 없는 카드는 어느 칸에도 없다', () => {
    const cards = [
      dueCard('a', '2026-11-06'),
      dueCard('b', '2026-11-06'),
      dueCard('c', '2026-11-30'),
      dueCard('d', null),
      dueCard('e', '2026-12-01'),
    ]
    const grid = buildMonthGrid('2026-11-15')
    const byDate = groupByDueDate(cards)

    // 일요일 시작, 4~6행
    expect(grid.length).toBeGreaterThanOrEqual(4)
    expect(grid.length).toBeLessThanOrEqual(6)
    for (const row of grid) {
      expect(row).toHaveLength(7)
      expect(weekdayOf(row[0]!.date)).toBe(0)
    }

    const placed = (date: string) => {
      const cell = findCell(grid, date)
      expect(cell).toBeDefined()
      return cardsInCell(cell!, byDate).map((card) => card.id)
    }
    expect(placed('2026-11-06')).toEqual(['a', 'b'])
    expect(placed('2026-11-30')).toEqual(['c'])

    // 모든 칸에 놓인 카드를 모아 마감일 없는 카드와 12월 1일 카드가 없음을 확인한다
    const allPlaced = grid.flat().flatMap((cell) => cardsInCell(cell, byDate).map((c) => c.id))
    expect(allPlaced.sort()).toEqual(['a', 'b', 'c'])
    expect(allPlaced).not.toContain('d')
    expect(allPlaced).not.toContain('e')

    // 12월 1일은 이 격자에 이웃 달 칸으로 있지만 카드가 놓이지 않는다 (준비 조건: 칸이 실제로 있다)
    const dec1 = findCell(grid, '2026-12-01')
    expect(dec1).toEqual({ date: '2026-12-01', inMonth: false })
    expect(cardsInCell(dec1!, byDate)).toEqual([])
    // 마감일 없는 카드는 묶음에도 없다
    expect([...byDate.values()].flat().map((c) => c.id)).not.toContain('d')
    expect(countWithoutDueDate(cards)).toBe(1)
    expect(countDueInMonth(cards, '2026-11-15')).toBe(3)

    // 2028-02 (윤년): 29일 칸이 있고 카드가 놓인다
    const leapGrid = buildMonthGrid('2028-02-10')
    const leapByDate = groupByDueDate([dueCard('f', '2028-02-29')])
    const feb29 = findCell(leapGrid, '2028-02-29')
    expect(feb29).toEqual({ date: '2028-02-29', inMonth: true })
    expect(cardsInCell(feb29!, leapByDate).map((c) => c.id)).toEqual(['f'])
    expect(leapGrid.length).toBeGreaterThanOrEqual(4)
    expect(leapGrid.length).toBeLessThanOrEqual(6)
  })

  test('TC-059 행 수는 달에 따라 4, 5, 6행이고 첫 칸은 항상 일요일이다', () => {
    // 2026-02: 1일이 일요일, 28일 -> 4행
    expect(buildMonthGrid('2026-02-01')).toHaveLength(4)
    // 2026-11: 1일이 일요일, 30일 -> 5행
    expect(buildMonthGrid('2026-11-01')).toHaveLength(5)
    // 2026-08: 1일이 토요일, 31일 -> 6행
    const aug = buildMonthGrid('2026-08-31')
    expect(aug).toHaveLength(6)
    expect(aug[0]![0]).toEqual({ date: '2026-07-26', inMonth: false })
    expect(aug[5]![6]!.date).toBe('2026-09-05')

    for (const anchor of ['2026-01-01', '2026-02-28', '2027-03-15', '2028-02-29', '2026-12-31']) {
      const grid = buildMonthGrid(anchor)
      expect(grid.length).toBeGreaterThanOrEqual(4)
      expect(grid.length).toBeLessThanOrEqual(6)
      expect(weekdayOf(grid[0]![0]!.date)).toBe(0)
      const inMonthDates = grid.flat().filter((cell) => cell.inMonth)
      expect(inMonthDates.every((cell) => cell.date.slice(0, 7) === anchor.slice(0, 7))).toBe(true)
    }
  })

  test('TC-059 anchor 가 실제 날짜가 아니면 거부한다', () => {
    expect(() => buildMonthGrid('2026-02-30')).toThrow(RangeError)
    expect(() => buildWeek('abc')).toThrow(RangeError)
  })

  test('TC-059 카드가 하나도 없어도 격자가 오류 없이 만들어진다', () => {
    const byDate = groupByDueDate([])
    expect(byDate.size).toBe(0)
    const grid = buildMonthGrid('2026-11-03')
    expect(grid.flat().every((cell) => cardsInCell(cell, byDate).length === 0)).toBe(true)
  })
})

describe('주 격자', () => {
  test('TC-059 주 한 줄은 anchor 가 든 일요일~토요일 7칸이다', () => {
    const week = buildWeek('2026-11-04')
    expect(week.map((cell) => cell.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ])
    expect(week.every((cell) => cell.inMonth)).toBe(true)
    // 일요일 자체를 anchor 로 줘도 같은 주
    expect(buildWeek('2026-11-01')[0]!.date).toBe('2026-11-01')
    // 월 경계를 넘는 주
    expect(buildWeek('2026-11-30').map((c) => c.date)).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
    ])
  })
})

describe('날짜별 묶기', () => {
  test('TC-059 같은 날짜 카드는 입력 순서를 지키고, 마감일 없음·잘못된 날짜는 빠진다', () => {
    const byDate = groupByDueDate([
      dueCard('a', '2026-11-06'),
      dueCard('x', null),
      dueCard('b', '2026-11-06'),
      dueCard('bad', '2026-02-30'),
    ])
    expect([...byDate.keys()]).toEqual(['2026-11-06'])
    expect(byDate.get('2026-11-06')!.map((c) => c.id)).toEqual(['a', 'b'])
  })
})

describe('칸당 칩 3개와 더 보기', () => {
  test('TC-060 한 날짜에 카드가 많으면 일부만 칩으로 보이고 나머지도 모두 접근할 수 있다', () => {
    expect(CALENDAR_CHIP_LIMIT).toBe(3)
    const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => dueCard(id, '2026-11-12'))
    const grid = buildMonthGrid('2026-11-12')
    const byDate = groupByDueDate(cards)
    const cell = findCell(grid, '2026-11-12')
    expect(cell).toBeDefined()

    const inCell = cardsInCell(cell!, byDate)
    expect(inCell).toHaveLength(5)

    const { shown, hidden, hiddenCount } = splitVisible(inCell, CALENDAR_CHIP_LIMIT)
    expect(shown.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(hiddenCount).toBe(2)
    expect(hidden.map((c) => c.id)).toEqual(['d', 'e'])
    // 5건 모두에 닿을 수 있다
    expect([...shown, ...hidden].map((c) => c.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  test('TC-060 3건 이하이면 더 보기가 없다', () => {
    const three = ['a', 'b', 'c'].map((id) => dueCard(id, '2026-11-12'))
    expect(splitVisible(three, 3)).toMatchObject({ hiddenCount: 0, hidden: [] })
    expect(splitVisible(three, 3).shown).toHaveLength(3)
    expect(splitVisible([], 3)).toEqual({ shown: [], hidden: [], hiddenCount: 0 })
    // 인자를 생략하면 칩 한도 3
    const four = ['a', 'b', 'c', 'd'].map((id) => dueCard(id, '2026-11-12'))
    expect(splitVisible(four).hiddenCount).toBe(1)
  })
})

describe('기간 이동', () => {
  test('TC-059 월 이동은 그 달의 1일로 맞추어 월말 넘침이 없다', () => {
    expect(shiftPeriod('month', '2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftPeriod('month', '2026-03-31', -1)).toBe('2026-02-01')
    expect(shiftPeriod('month', '2026-11-30', 1)).toBe('2026-12-01')
    expect(shiftPeriod('month', '2026-12-15', 1)).toBe('2027-01-01')
    expect(shiftPeriod('month', '2026-01-15', -1)).toBe('2025-12-01')
    expect(shiftPeriod('month', '2026-11-15', 0)).toBe('2026-11-01')
    expect(shiftPeriod('month', '2026-11-15', 14)).toBe('2028-01-01')
    expect(shiftPeriod('month', '2026-11-15', -11)).toBe('2025-12-01')
  })

  test('TC-059 주 이동은 7일 단위이고 월·해 경계를 넘는다', () => {
    expect(shiftPeriod('week', '2026-11-04', 1)).toBe('2026-11-11')
    expect(shiftPeriod('week', '2026-11-04', -1)).toBe('2026-10-28')
    expect(shiftPeriod('week', '2026-12-30', 1)).toBe('2027-01-06')
    expect(shiftPeriod('week', '2028-02-26', 1)).toBe('2028-03-04')
  })

  test('TC-059 기간 제목: 월은 연·월, 주는 일요일~토요일 범위', () => {
    expect(periodTitle('month', '2026-11-15')).toBe('2026년 11월')
    expect(periodTitle('week', '2026-11-04')).toBe('2026년 11월 1일 ~ 7일')
    expect(periodTitle('week', '2026-11-30')).toBe('2026년 11월 29일 ~ 12월 5일')
    expect(periodTitle('week', '2026-12-30')).toBe('2026년 12월 27일 ~ 2027년 1월 2일')
  })
})
