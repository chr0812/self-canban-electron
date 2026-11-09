// 날짜만 다루는 계산과 마감 지남 판정 (docs/05-design/05-architecture.md, 03-api-spec.md).
// PC 현지 날짜는 todayLocal 한 곳에서만 만든다. 나머지 계산은 Date.UTC 기준 산술이라
// 시간대·여름시간과 무관하다. 문자열을 new Date(문자열)로 해석하지 않는다.

import type { Card, DateString } from '../types/card'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function formatDate(year: number, month: number, day: number): DateString {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/** 'YYYY-MM-DD' 를 UTC 자정의 밀리초로 바꾼다. 형식이 틀리면 null. */
function parseToUtcMs(value: string): number | null {
  const match = DATE_PATTERN.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  // Date.UTC 는 0~99년을 1900년대로 바꾸므로 setUTCFullYear 로 연도를 넣는다.
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getTime()
}

function parseOrThrow(value: string): number {
  const ms = isRealDate(value) ? parseToUtcMs(value) : null
  if (ms === null) throw new RangeError(`실제 날짜가 아닙니다: ${value}`)
  return ms
}

/** 현지 시간대의 연·월·일 (UTC 아님). 현지 날짜를 만드는 유일한 지점. */
export function todayLocal(now: Date): DateString {
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** month 는 1~12. 윤년을 반영한 그 달의 일수. */
export function daysInMonth(year: number, month: number): number {
  const date = new Date(0)
  date.setUTCFullYear(year, month, 0)
  return date.getUTCDate()
}

/** 'YYYY-MM-DD' 형식이고 달력에 실제로 있는 날짜인가 (윤년 반영). */
export function isRealDate(value: string): boolean {
  if (typeof value !== 'string') return false
  const match = DATE_PATTERN.exec(value)
  if (match === null) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return false
  return day >= 1 && day <= daysInMonth(year, month)
}

/** to - from 을 일 수로. to 가 뒤면 양수. 두 값은 실제 날짜여야 한다. */
export function diffDays(from: DateString, to: DateString): number {
  return Math.round((parseOrThrow(to) - parseOrThrow(from)) / MS_PER_DAY)
}

/** date 에서 n 일 뒤(음수면 앞)의 날짜. */
export function addDays(date: DateString, n: number): DateString {
  const result = new Date(parseOrThrow(date) + n * MS_PER_DAY)
  return formatDate(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate())
}

/** 요일. 0 = 일요일 … 6 = 토요일. */
export function weekdayOf(date: DateString): number {
  return new Date(parseOrThrow(date)).getUTCDay()
}

type DueFields = Pick<Card, 'dueDate' | 'status'>

/** dueDate 가 있고, 오늘보다 앞이고, 완료가 아니다. 저장하지 않는 파생 값. */
export function isOverdue(card: DueFields, today: DateString): boolean {
  return card.dueDate !== null && card.dueDate < today && card.status !== 'done'
}

/** 화면의 `N일 지남` 글자용. 지남이 아니거나 날짜가 실제 날짜가 아니면 null. */
export function overdueDays(card: DueFields, today: DateString): number | null {
  if (card.dueDate === null || !isOverdue(card, today)) return null
  if (!isRealDate(card.dueDate) || !isRealDate(today)) return null
  return diffDays(card.dueDate, today)
}
