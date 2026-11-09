// 캘린더 격자 계산 (ADR-009). 순수 함수만 둔다 (React·DOM 금지).
// 월 격자는 일요일에 시작하고 4~6행이다. 날짜 계산은 date-rules 의 산술만 쓰고
// 문자열을 new Date(문자열)로 해석하지 않는다.

import { addDays, daysInMonth, isRealDate, weekdayOf } from '../../../shared/domain/date-rules'
import type { Card, DateString } from '../../../shared/types/card'

/** 월 보기 한 날짜 칸에 칩으로 보이는 최대 개수. */
export const CALENDAR_CHIP_LIMIT = 3

export type CalendarMode = 'month' | 'week'

export type CalendarCell = {
  date: DateString
  /** 월 보기에서 기준 달에 속하는가. 주 보기의 칸은 모두 true. */
  inMonth: boolean
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function formatDate(year: number, month: number, day: number): DateString {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

function partsOf(date: DateString): { year: number; month: number; day: number } {
  if (!isRealDate(date)) throw new RangeError(`실제 날짜가 아닙니다: ${date}`)
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  }
}

/** date 가 속한 주의 일요일. */
function weekStartOf(date: DateString): DateString {
  return addDays(date, -weekdayOf(date))
}

function weekCells(start: DateString, isInMonth: (date: DateString) => boolean): CalendarCell[] {
  const cells: CalendarCell[] = []
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(start, i)
    cells.push({ date, inMonth: isInMonth(date) })
  }
  return cells
}

/** anchor 가 든 달의 격자. 일요일 시작, 4~6행, 앞뒤 이웃 달 날짜는 inMonth false. */
export function buildMonthGrid(anchor: DateString): CalendarCell[][] {
  const { year, month } = partsOf(anchor)
  const first = formatDate(year, month, 1)
  const last = formatDate(year, month, daysInMonth(year, month))
  const monthPrefix = first.slice(0, 7)
  const isInMonth = (date: DateString): boolean => date.slice(0, 7) === monthPrefix

  const gridStart = weekStartOf(first)
  const gridEnd = addDays(last, 6 - weekdayOf(last))
  const rows: CalendarCell[][] = []
  for (let start = gridStart; start <= gridEnd; start = addDays(start, 7)) {
    rows.push(weekCells(start, isInMonth))
  }
  return rows
}

/** anchor 가 든 주 (일요일~토요일) 7칸. */
export function buildWeek(anchor: DateString): CalendarCell[] {
  partsOf(anchor)
  return weekCells(weekStartOf(anchor), () => true)
}

/**
 * 마감일이 있는 카드를 날짜별로 묶는다. 마감일이 없거나 실제 날짜가 아닌 카드는 어느 날짜에도 없다.
 * 같은 날짜 안의 순서는 입력 순서를 지킨다.
 */
export function groupByDueDate(cards: readonly Card[]): Map<DateString, Card[]> {
  const groups = new Map<DateString, Card[]>()
  for (const card of cards) {
    if (card.dueDate === null || !isRealDate(card.dueDate)) continue
    const list = groups.get(card.dueDate)
    if (list === undefined) groups.set(card.dueDate, [card])
    else list.push(card)
  }
  return groups
}

/** 격자의 한 칸에 놓이는 카드. 기준 달이 아닌 날(inMonth false)의 칸에는 카드를 놓지 않는다. */
export function cardsInCell(cell: CalendarCell, byDate: ReadonlyMap<DateString, Card[]>): Card[] {
  if (!cell.inMonth) return []
  return byDate.get(cell.date) ?? []
}

/** 한 칸의 카드를 칩으로 보일 만큼(shown)과 나머지(hidden)로 나눈다. 둘을 합치면 항상 전체다. */
export function splitVisible(
  cards: readonly Card[],
  limit: number = CALENDAR_CHIP_LIMIT,
): { shown: Card[]; hidden: Card[]; hiddenCount: number } {
  const safeLimit = Math.max(0, Math.floor(limit))
  const shown = cards.slice(0, safeLimit)
  const hidden = cards.slice(safeLimit)
  return { shown, hidden, hiddenCount: hidden.length }
}

/**
 * 기간을 delta 만큼 옮긴 기준 날짜. 월 보기는 그 달의 1일로 맞춰 31일 같은 월말 넘침을 피하고,
 * 주 보기는 7일 단위로 옮긴다.
 */
export function shiftPeriod(mode: CalendarMode, anchor: DateString, delta: number): DateString {
  const { year, month } = partsOf(anchor)
  if (mode === 'week') return addDays(anchor, delta * 7)
  const total = year * 12 + (month - 1) + delta
  return formatDate(Math.floor(total / 12), (((total % 12) + 12) % 12) + 1, 1)
}

/** 기간 제목. 월 `2026년 11월`, 주 `2026년 11월 1일 ~ 7일` (달·해가 넘으면 뒤쪽에도 적는다). */
export function periodTitle(mode: CalendarMode, anchor: DateString): string {
  const { year, month } = partsOf(anchor)
  if (mode === 'month') return `${year}년 ${month}월`

  const start = partsOf(weekStartOf(anchor))
  const end = partsOf(addDays(weekStartOf(anchor), 6))
  const head = `${start.year}년 ${start.month}월 ${start.day}일`
  if (start.year !== end.year) return `${head} ~ ${end.year}년 ${end.month}월 ${end.day}일`
  if (start.month !== end.month) return `${head} ~ ${end.month}월 ${end.day}일`
  return `${head} ~ ${end.day}일`
}

/** 마감일이 없어 캘린더에 나타나지 않는 카드 수. */
export function countWithoutDueDate(cards: readonly Card[]): number {
  return cards.filter((card) => card.dueDate === null).length
}

/** anchor 가 든 달에 마감인 카드 수. */
export function countDueInMonth(cards: readonly Card[], anchor: DateString): number {
  const prefix = anchor.slice(0, 7)
  partsOf(anchor)
  let count = 0
  for (const card of cards) {
    if (card.dueDate !== null && isRealDate(card.dueDate) && card.dueDate.slice(0, 7) === prefix) {
      count += 1
    }
  }
  return count
}
