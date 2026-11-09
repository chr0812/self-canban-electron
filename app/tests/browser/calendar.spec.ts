// 캘린더 화면의 실제 Electron 확인 (SCR-003, FR-005, FR-010, FR-011).
// 앱 시계를 바꾸는 코드가 없으므로 실행하는 날의 실제 날짜에서 이번 달 날짜를 계산해 구동 전 저장 파일에 심는다 (07-test-plan.md 시험 데이터).

import { expect, test } from '@playwright/test'
import type { ElectronApplication, Locator, Page } from '@playwright/test'
import { withApp } from './support/launch-app'
import {
  boardCard,
  clickSave,
  dialog,
  openCardDialog,
  saveIndicator,
  seedCard,
  seedJson,
  titleInput,
  today,
  waitForBoard,
} from './support/board-page'

/** 이번 달(실행하는 날 기준)의 day 일. 어느 달에도 있는 1~28 일만 쓴다. */
function monthDate(day: number): string {
  return `${today().slice(0, 7)}-${String(day).padStart(2, '0')}`
}

function goTo(page: Page, name: '보드' | '캘린더' | '보관함'): Promise<void> {
  return page.locator('.sidebar-nav__item', { hasText: name }).click()
}

function dayCell(page: Page, date: string): Locator {
  return page.locator(`.day-cell[data-date="${date}"]`)
}

function chips(page: Page): Locator {
  return page.locator('.calendar-grid .calendar-chip')
}

function periodTitle(page: Page): Locator {
  return page.locator('.period-nav__title')
}

function thisMonthTitle(): string {
  const [year, month] = today().split('-')
  return `${year}년 ${Number(month)}월`
}

// TC-171·TC-172: 5주인 달(2026년 11월: 일요일에 시작하고 30일이라 격자가 5행)의 월 보기 높이 (AC-048).
// 가장 높은 주를 만드는 12일(칩 3개 + `+2건 더 보기`)과 같은 달의 다른 날짜 카드 몇 건을 심는다.
const NOVEMBER_TITLE = '2026년 11월'

function tallWeekJson(): string {
  return seedJson([
    ...['일정 가', '일정 나', '일정 다', '일정 라', '일정 마'].map((title, index) =>
      seedCard(index + 1, { title, dueDate: '2026-11-12' }),
    ),
    seedCard(6, { title: '다른 날 하나', dueDate: '2026-11-03' }),
    seedCard(7, { title: '다른 날 둘', dueDate: '2026-11-19' }),
    seedCard(8, { title: '다른 날 셋', dueDate: '2026-11-27' }),
  ])
}

/** 창의 바깥 크기. 메인 프로세스의 BrowserWindow 에서 읽는다. */
function windowSize(app: ElectronApplication): Promise<[number, number]> {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win === undefined) throw new Error('창이 없다')
    return win.getSize() as [number, number]
  })
}

/** `‹`/`›` 로 기간 제목을 2026년 11월로 맞춘다 (앱은 오늘이 든 달로 열린다). */
async function moveToNovember(page: Page): Promise<void> {
  const order = (title: string): number => {
    const match = /^(\d+)년 (\d+)월/.exec(title)
    if (match === null) throw new Error(`기간 제목을 읽을 수 없다: ${title}`)
    return Number(match[1]) * 100 + Number(match[2])
  }
  for (let step = 0; step < 120; step += 1) {
    const current = ((await periodTitle(page).textContent()) ?? '').trim()
    if (current === NOVEMBER_TITLE) return
    const forward = order(current) < order(NOVEMBER_TITLE)
    await page.getByRole('button', { name: forward ? '다음 달' : '이전 달', exact: true }).click()
    await expect(periodTitle(page)).not.toHaveText(current)
  }
  throw new Error('기간 제목이 2026년 11월이 되지 않았다')
}

type Metrics = {
  innerHeight: number
  bodyScrollHeight: number
  bodyClientHeight: number
  bodyTop: number
  bodyBottom: number
  weekdaysTop: number
  weekdaysBottom: number
  lastCellBottom: number
  topBarTop: number
  topBarBottom: number
  statusTop: number
  statusBottom: number
  documentScrollHeight: number
  documentClientHeight: number
  cells: number
}

type Box = { top: number; bottom: number }
type DomElement = {
  getBoundingClientRect: () => Box
  scrollHeight: number
  clientHeight: number
}

/** 캘린더 화면의 치수를 한 번에 읽는다 (같은 순간의 값). */
function readMetrics(page: Page): Promise<Metrics> {
  return page.evaluate((): Metrics => {
    const doc = (
      globalThis as unknown as {
        document: {
          querySelector: (selector: string) => DomElement | null
          querySelectorAll: (selector: string) => DomElement[]
          scrollingElement: DomElement
        }
        innerHeight: number
      }
    ).document
    const innerHeight = (globalThis as unknown as { innerHeight: number }).innerHeight
    const find = (selector: string): DomElement => {
      const element = doc.querySelector(selector)
      if (element === null) throw new Error(`${selector} 없음`)
      return element
    }
    const body = find('.calendar-body')
    const weekdays = find('.calendar-weekdays').getBoundingClientRect()
    const topBar = find('.top-bar').getBoundingClientRect()
    const status = find('.app-shell__statusbar').getBoundingClientRect()
    const cells = Array.from(doc.querySelectorAll('.calendar-grid .day-cell'))
    return {
      innerHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      bodyTop: body.getBoundingClientRect().top,
      bodyBottom: body.getBoundingClientRect().bottom,
      weekdaysTop: weekdays.top,
      weekdaysBottom: weekdays.bottom,
      lastCellBottom: Math.max(...cells.map((cell) => cell.getBoundingClientRect().bottom)),
      topBarTop: topBar.top,
      topBarBottom: topBar.bottom,
      statusTop: status.top,
      statusBottom: status.bottom,
      documentScrollHeight: doc.scrollingElement.scrollHeight,
      documentClientHeight: doc.scrollingElement.clientHeight,
      cells: cells.length,
    }
  })
}

test.describe('calendar', () => {
  test('TC-095 마감일이 있는 카드가 캘린더의 그 날짜 칸에 보인다', async () => {
    const due = monthDate(15)
    const json = seedJson([seedCard(1, { title: '마감 있는 카드', dueDate: due })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await goTo(page, '캘린더')
      await expect(periodTitle(page)).toHaveText(thisMonthTitle())

      await expect(chips(page)).toHaveCount(1)
      await expect(dayCell(page, due).locator('.calendar-chip')).toHaveCount(1)
      await expect(dayCell(page, due).locator('.calendar-chip__title')).toHaveText('마감 있는 카드')
      // 다른 날짜 칸에는 칩이 없다.
      await expect(page.locator('.day-cell').filter({ has: page.locator('.calendar-chip') })).toHaveCount(1)
      expect(await page.locator('.day-cell').count()).toBeGreaterThanOrEqual(28)
    })
  })

  test('TC-096 마감일이 없는 카드는 캘린더에 나타나지 않고 보드에는 그대로 보인다', async () => {
    const json = seedJson([seedCard(1, { title: '마감 없는 카드', dueDate: null })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await goTo(page, '캘린더')
      // 격자가 실제로 그려진 것을 먼저 확인한다 (그려지기 전에 칩이 0건인 것을 보지 않도록).
      await expect(periodTitle(page)).toHaveText(thisMonthTitle())
      expect(await page.locator('.day-cell').count()).toBeGreaterThanOrEqual(28)
      await expect(chips(page)).toHaveCount(0)
      await expect(page.locator('.calendar-legend__note')).toHaveText('마감일이 없는 카드 1건은 보드에서만 보입니다')

      await goTo(page, '보드')
      await expect(boardCard(page, '마감 없는 카드')).toHaveCount(1)
      await expect(boardCard(page, '마감 없는 카드').locator('.due-text')).toHaveText('마감 없음')
    })
  })

  test('TC-097 캘린더에서 카드를 고르면 그 카드의 상세가 열린다', async () => {
    const json = seedJson([seedCard(1, { title: '캘린더에서 여는 카드', dueDate: monthDate(15) })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await goTo(page, '캘린더')
      const before = await periodTitle(page).textContent()
      expect(before).toBe(thisMonthTitle())

      await page.locator('.calendar-chip', { hasText: '캘린더에서 여는 카드' }).click()
      await expect(dialog(page)).toBeVisible()
      await expect(dialog(page).locator('.card-dialog__title')).toHaveText('카드 상세')
      await expect(titleInput(page)).toHaveValue('캘린더에서 여는 카드')

      await dialog(page).getByRole('button', { name: '취소', exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(page.locator('.calendar-screen')).toBeVisible()
      await expect(periodTitle(page)).toHaveText(before ?? '')
      await expect(page.locator('.calendar-chip', { hasText: '캘린더에서 여는 카드' })).toHaveCount(1)
    })
  })

  test('TC-098 보관한 카드는 캘린더에 나타나지 않는다', async () => {
    const json = seedJson([
      seedCard(1, {
        title: '보관된 마감 카드',
        status: 'done',
        dueDate: monthDate(10),
        archivedAt: '2026-11-02T09:00:00.000Z',
      }),
      seedCard(2, { title: '보드에 있는 마감 카드', dueDate: monthDate(12) }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await goTo(page, '캘린더')
      await expect(periodTitle(page)).toHaveText(thisMonthTitle())

      await expect(chips(page)).toHaveCount(1)
      await expect(dayCell(page, monthDate(12)).locator('.calendar-chip__title')).toHaveText('보드에 있는 마감 카드')
      await expect(page.locator('.calendar-chip', { hasText: '보관된 마감 카드' })).toHaveCount(0)
      await expect(dayCell(page, monthDate(10)).locator('.calendar-chip')).toHaveCount(0)
    })
  })

  test('TC-099 마감일을 고쳐 저장하면 캘린더에서 새 날짜 칸으로 옮겨 보인다', async () => {
    const oldDate = monthDate(10)
    const newDate = monthDate(20)
    const json = seedJson([seedCard(1, { title: '옮길 카드', dueDate: oldDate })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await goTo(page, '캘린더')
      await expect(dayCell(page, oldDate).locator('.calendar-chip')).toHaveCount(1) // 고치기 전 위치
      await goTo(page, '보드')

      await openCardDialog(page, '옮길 카드')
      await dialog(page)
        .getByRole('textbox', { name: /^마감일/ })
        .fill(newDate)
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')

      await goTo(page, '캘린더')
      await expect(chips(page)).toHaveCount(1)
      await expect(dayCell(page, newDate).locator('.calendar-chip__title')).toHaveText('옮길 카드')
      await expect(dayCell(page, oldDate).locator('.calendar-chip')).toHaveCount(0)
    })
  })

  test('TC-100 카드가 하나도 없는 캘린더가 오류 없이 열린다', async () => {
    await withApp({}, async ({ page }) => {
      const problems: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`)
      })
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
      // 구동 중 이미 지나간 오류도 보도록 수집을 시작한 뒤 화면을 다시 불러온다.
      await page.reload()
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(0)

      await goTo(page, '캘린더')
      await expect(periodTitle(page)).toHaveText(thisMonthTitle())
      expect(await page.locator('.day-cell').count()).toBeGreaterThanOrEqual(28)
      await expect(chips(page)).toHaveCount(0)
      await expect(page.locator('.calendar-screen')).toContainText('마감일이 있는 카드가 없습니다')
      await expect(page.locator('.app-shell__statusbar')).toContainText('마감인 카드 0건')
      expect(problems).toEqual([])
    })
  })

  test('TC-101 한 날짜에 카드가 많으면 더 보기에서 모든 카드에 닿을 수 있다', async () => {
    const date = monthDate(15)
    const titles = ['일정 가', '일정 나', '일정 다', '일정 라', '일정 마']
    const json = seedJson(titles.map((title, index) => seedCard(index + 1, { title, dueDate: date })))
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await goTo(page, '캘린더')
      await expect(periodTitle(page)).toHaveText(thisMonthTitle())

      const cell = dayCell(page, date)
      await expect(cell.locator('.calendar-chip')).toHaveCount(3)
      const more = cell.getByRole('button', { name: '+2건 더 보기' })
      await expect(more).toBeVisible()
      await more.click()

      const popover = page.locator('.day-popover')
      await expect(popover).toBeVisible()
      await expect(popover.locator('.calendar-chip')).toHaveCount(5)
      expect((await popover.locator('.calendar-chip__title').allTextContents()).sort()).toEqual([...titles].sort())

      await popover.locator('.calendar-chip', { hasText: '일정 마' }).click()
      await expect(dialog(page)).toBeVisible()
      await expect(titleInput(page)).toHaveValue('일정 마')
    })
  })

  test('TC-171 기본 창 크기에서 5주인 달의 월 보기는 스크롤 없이 모든 주와 요일 줄이 보인다', async () => {
    await withApp({ seedJson: tallWeekJson() }, async ({ app, page }) => {
      await waitForBoard(page)
      // 준비 조건: 창 크기를 바꾸지 않은 기본 창이다.
      const [width, height] = await windowSize(app)
      expect({ width, height }).toEqual({ width: 1280, height: 920 })

      await goTo(page, '캘린더')
      await moveToNovember(page)
      await expect(page.locator('.calendar-grid[data-mode="month"] .day-cell')).toHaveCount(35)
      // 준비 조건: 가장 높은 주를 만드는 12일 칸(칩 3개 + `+2건 더 보기`).
      await expect(dayCell(page, '2026-11-12').locator('.calendar-chip')).toHaveCount(3)
      await expect(dayCell(page, '2026-11-12').getByRole('button', { name: '+2건 더 보기' })).toBeVisible()
      // 준비 조건: 저장 실패 알림 줄이 없다.
      await expect(page.locator('.app-shell__alert')).toBeEmpty()

      const m = await readMetrics(page)
      console.log(`[TC-171] size=${width}x${height} metrics=${JSON.stringify(m)}`)
      expect(m.cells / 7).toBe(5)
      expect(m.bodyScrollHeight).toBeLessThanOrEqual(m.bodyClientHeight) // 세로 스크롤 없음
      // 요일 줄과 5주의 마지막 칸이 모두 캘린더 본문의 보이는 영역 안에 있다.
      expect(m.weekdaysTop).toBeGreaterThanOrEqual(m.bodyTop)
      expect(m.weekdaysBottom).toBeLessThanOrEqual(m.bodyBottom)
      expect(m.lastCellBottom).toBeLessThanOrEqual(m.bodyBottom)
      // 상단 막대와 하단 줄이 창 안에 보인다.
      expect(m.topBarTop).toBeGreaterThanOrEqual(0)
      expect(m.statusBottom).toBeLessThanOrEqual(m.innerHeight)
      await expect(page.locator('.top-bar')).toBeVisible()
      await expect(page.locator('.app-shell__statusbar')).toHaveText('11월에 마감인 카드 8건')
    })
  })

  test('TC-172 창을 더 작게 줄이면 캘린더 안에서 세로로 스크롤된다', async () => {
    await withApp({ seedJson: tallWeekJson() }, async ({ app, page }) => {
      await waitForBoard(page)
      await goTo(page, '캘린더')
      await moveToNovember(page)
      await expect(page.locator('.calendar-grid[data-mode="month"] .day-cell')).toHaveCount(35)
      // 시작 상태: TC-171 이 확인한 스크롤 없음.
      const start = await readMetrics(page)
      expect(start.bodyScrollHeight).toBeLessThanOrEqual(start.bodyClientHeight)

      // 앱의 최소 크기 1200 x 700 으로 줄인다.
      await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win === undefined) throw new Error('창이 없다')
        win.setSize(1200, 700)
      })
      await expect.poll(() => windowSize(app)).toEqual([1200, 700])
      await expect.poll(async () => (await readMetrics(page)).innerHeight).toBeLessThan(start.innerHeight)

      const small = await readMetrics(page)
      console.log(`[TC-172] metrics=${JSON.stringify(small)}`)
      expect(small.bodyScrollHeight).toBeGreaterThan(small.bodyClientHeight)

      // 마지막 주가 보이도록 캘린더 본문을 스크롤한다.
      await page.locator('.calendar-body').evaluate((element) => {
        const body = element as unknown as { scrollTop: number; scrollHeight: number }
        body.scrollTop = body.scrollHeight
      })
      const scrolled = await readMetrics(page)
      expect(scrolled.lastCellBottom).toBeLessThanOrEqual(scrolled.bodyBottom + 1)
      await expect(dayCell(page, '2026-12-05')).toBeInViewport()
      // 상단 막대와 하단 줄은 창 안에 고정되어 그대로 보이고, 문서 전체에는 세로 스크롤이 없다.
      expect(scrolled.topBarTop).toBe(small.topBarTop)
      expect(scrolled.topBarTop).toBeGreaterThanOrEqual(0)
      expect(scrolled.statusBottom).toBe(small.statusBottom)
      expect(scrolled.statusBottom).toBeLessThanOrEqual(scrolled.innerHeight)
      expect(scrolled.documentScrollHeight).toBeLessThanOrEqual(scrolled.documentClientHeight)
      await expect(page.locator('.top-bar')).toBeInViewport()
      await expect(page.locator('.app-shell__statusbar')).toBeInViewport()
    })
  })
})
