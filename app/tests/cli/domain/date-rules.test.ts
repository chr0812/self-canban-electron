import { describe, expect, test } from 'vitest'
import {
  addDays,
  daysInMonth,
  diffDays,
  isOverdue,
  isRealDate,
  overdueDays,
  todayLocal,
  weekdayOf,
} from '../../../src/shared/domain/date-rules'

const TODAY = '2026-11-03'

describe('isOverdue', () => {
  test('TC-001 마감일이 오늘보다 앞이고 완료가 아닌 카드는 마감 지남이다', () => {
    expect(isOverdue({ dueDate: '2026-11-02', status: 'todo' }, TODAY)).toBe(true)
    expect(isOverdue({ dueDate: '2026-11-02', status: 'in_progress' }, TODAY)).toBe(true)
    expect(isOverdue({ dueDate: '2026-10-01', status: 'todo' }, TODAY)).toBe(true)
  })

  test('TC-002 마감일 당일, 이후, 마감일 없음은 마감 지남이 아니다', () => {
    expect(isOverdue({ dueDate: '2026-11-03', status: 'todo' }, TODAY)).toBe(false)
    expect(isOverdue({ dueDate: '2026-11-04', status: 'todo' }, TODAY)).toBe(false)
    expect(isOverdue({ dueDate: null, status: 'in_progress' }, TODAY)).toBe(false)
  })

  test('TC-003 완료 카드는 마감일이 지나도 마감 지남이 아니다', () => {
    expect(isOverdue({ dueDate: '2026-11-02', status: 'done' }, TODAY)).toBe(false)
    expect(isOverdue({ dueDate: '2026-01-01', status: 'done' }, TODAY)).toBe(false)
    // 완료이며 보관된 카드도 상태가 done 이므로 지남이 아니다 (archivedAt 은 판정에 쓰지 않는다).
    const archivedDone = {
      dueDate: '2026-01-01',
      status: 'done' as const,
      archivedAt: '2026-02-01T00:00:00.000Z',
    }
    expect(isOverdue(archivedDone, TODAY)).toBe(false)
  })

  test('TC-001 월·연 경계를 넘어도 날짜 순서로 판정한다', () => {
    expect(isOverdue({ dueDate: '2025-12-31', status: 'todo' }, '2026-01-01')).toBe(true)
    expect(isOverdue({ dueDate: '2026-12-31', status: 'todo' }, '2026-01-01')).toBe(false)
  })
})

describe('overdueDays', () => {
  test('TC-001 지난 카드는 지난 일 수를, 아니면 null 을 돌려준다', () => {
    expect(overdueDays({ dueDate: '2026-11-02', status: 'todo' }, TODAY)).toBe(1)
    expect(overdueDays({ dueDate: '2026-10-01', status: 'in_progress' }, TODAY)).toBe(33)
    expect(overdueDays({ dueDate: '2026-11-03', status: 'todo' }, TODAY)).toBeNull()
    expect(overdueDays({ dueDate: null, status: 'todo' }, TODAY)).toBeNull()
    expect(overdueDays({ dueDate: '2026-11-02', status: 'done' }, TODAY)).toBeNull()
  })
})

describe('todayLocal', () => {
  test('TC-004 오늘 날짜는 UTC가 아니라 PC 현지 날짜로 계산한다', () => {
    // 현지 연·월·일·시 필드로 만들므로 실행 시간대와 무관하다.
    const early = new Date(2026, 10, 3, 0, 30)
    const late = new Date(2026, 10, 3, 23, 30)
    expect(todayLocal(early)).toBe('2026-11-03')
    expect(todayLocal(late)).toBe('2026-11-03')
  })

  test('TC-004 한 자리 월·일은 0 으로 채운다', () => {
    expect(todayLocal(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})

describe('isRealDate', () => {
  test('TC-005 존재하지 않는 날짜는 거부한다 (dueDate / INVALID_DATE 의 근거)', () => {
    for (const value of ['2026-02-30', '2025-02-29', '2026-11-31', '2026-13-01', '2026-1-5']) {
      expect(isRealDate(value), value).toBe(false)
    }
  })

  test('TC-005 윤년의 실제 날짜와 월말은 허용한다', () => {
    for (const value of ['2024-02-29', '2026-12-31', '2026-02-28']) {
      expect(isRealDate(value), value).toBe(true)
    }
  })

  test('TC-005 형식이 다른 값과 0 일·0 월은 거부한다', () => {
    for (const value of ['', '2026-00-10', '2026-01-00', '2026/11/03', '20261103', '2026-11-03 ', ' 2026-11-03']) {
      expect(isRealDate(value), value).toBe(false)
    }
  })

  test('TC-005 세기 규칙을 반영한다 (1900 은 평년, 2000 은 윤년)', () => {
    expect(isRealDate('1900-02-29')).toBe(false)
    expect(isRealDate('2000-02-29')).toBe(true)
  })
})

describe('날짜 계산', () => {
  test('TC-005 daysInMonth 는 윤년과 월말을 반영한다', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  test('TC-005 addDays 는 월·연 경계를 넘는다', () => {
    expect(addDays('2026-11-03', 1)).toBe('2026-11-04')
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-11-03', 0)).toBe('2026-11-03')
  })

  test('TC-005 diffDays 는 to - from 일 수다 (여름시간 구간 포함)', () => {
    expect(diffDays('2026-11-03', '2026-11-03')).toBe(0)
    expect(diffDays('2026-11-02', '2026-11-03')).toBe(1)
    expect(diffDays('2026-11-03', '2026-11-02')).toBe(-1)
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31)
    expect(diffDays('2025-12-31', '2026-12-31')).toBe(365)
    expect(diffDays('2024-01-01', '2025-01-01')).toBe(366)
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2)
    expect(diffDays('2026-10-31', '2026-11-02')).toBe(2)
  })

  test('TC-005 weekdayOf 는 0(일)~6(토)을 돌려준다', () => {
    expect(weekdayOf('2026-11-03')).toBe(2)
    expect(weekdayOf('2026-11-01')).toBe(0)
    expect(weekdayOf('2026-11-07')).toBe(6)
    expect(weekdayOf('2024-02-29')).toBe(4)
  })

  test('TC-005 실제 날짜가 아닌 값을 계산에 넣으면 RangeError 다', () => {
    expect(() => addDays('2026-1-5', 1)).toThrow(RangeError)
    expect(() => diffDays('abc', '2026-11-03')).toThrow(RangeError)
    expect(() => weekdayOf('2026-02-30')).toThrow(RangeError)
  })
})
