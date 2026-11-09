// 어두운 판·밝은 판 전환과 두 판에서의 색 외 구분(NFR-004)의 실제 Electron 확인 (SCR-001, FR-014).
// 앱 시계를 바꾸는 코드가 없으므로 마감일은 실행하는 날의 실제 날짜에서 계산해 구동 전 저장 파일에 심는다.

import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { makeDoc } from '../cli/support/builders'
import { readDataFile, withApp } from './support/launch-app'
import {
  boardCard,
  daysFromToday,
  dialog,
  openCardDialog,
  saveIndicator,
  seedCard,
  seedJson,
  waitForBoard,
} from './support/board-page'

type Theme = 'dark' | 'light'

// 브라우저 안에서 도는 evaluate 콜백이 쓰는 최소 모양 (이 프로젝트의 node 설정에는 DOM 형식이 없다).
type StyleLike = { backgroundColor: string; borderTopColor: string; borderTopWidth: string }
type ElementLike = {
  parentElement: ElementLike | null
  classList: { contains(name: string): boolean }
  textContent: string | null
  querySelectorAll(selector: string): { length: number }
  querySelector(selector: string): { getAttribute(name: string): string | null } | null
  getAttribute(name: string): string | null
}
type WindowLike = { getComputedStyle(element: ElementLike): StyleLike }
const THEME_LABEL: Record<Theme, string> = { dark: '어두운 판', light: '밝은 판' }

function goTo(page: Page, name: '보드' | '캘린더' | '보관함'): Promise<void> {
  return page.locator('.sidebar-nav__item', { hasText: name }).click()
}

function themeRadio(page: Page, theme: Theme): Locator {
  return page.getByRole('radiogroup', { name: '화면 밝기' }).getByRole('radio', { name: THEME_LABEL[theme] })
}

/** `밝은 판`/`어두운 판`을 고르고 문서에 반영될 때까지 기다린다. */
async function chooseTheme(page: Page, theme: Theme): Promise<void> {
  const changing = (await page.locator('html').getAttribute('data-theme')) !== theme
  await themeRadio(page, theme).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await expect(themeRadio(page, theme)).toHaveAttribute('aria-checked', 'true')
  if (changing) await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
}

/** 요소의 실제 배경색: 투명하면 가장 가까운 불투명한 조상의 배경색을 돌려준다. */
async function effectiveBackground(target: Locator): Promise<string> {
  return target.evaluate((element: ElementLike) => {
    const win = globalThis as unknown as WindowLike
    let node: ElementLike | null = element
    while (node !== null) {
      const color = win.getComputedStyle(node).backgroundColor
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color
      node = node.parentElement
    }
    return 'none'
  })
}

type ScreenLook = { screen: string; theme: string | null; background: string; bodyBackground: string }

/** 보드·캘린더·보관함·카드 대화상자를 차례로 열어 각 화면의 판 값과 배경색을 읽는다. */
async function readScreens(page: Page): Promise<ScreenLook[]> {
  const looks: ScreenLook[] = []
  const read = async (screen: string, target: Locator): Promise<void> => {
    await expect(target.first()).toBeVisible()
    looks.push({
      screen,
      theme: await page.locator('html').getAttribute('data-theme'),
      background: await effectiveBackground(target.first()),
      bodyBackground: await effectiveBackground(page.locator('body')),
    })
  }

  await goTo(page, '보드')
  await read('board', page.locator('.card-item'))
  await goTo(page, '캘린더')
  await read('calendar', page.locator('.calendar-grid .day-cell'))
  await goTo(page, '보관함')
  await read('archive', page.locator('.archive-row'))
  await goTo(page, '보드')
  await openCardDialog(page, '완료 카드')
  await read('dialog', dialog(page))
  await dialog(page).getByRole('button', { name: '취소', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  return looks
}

test.describe('theme', () => {
  test('TC-121 처음 실행하면 밝은 판이고 이미 저장된 어두운 판은 그대로 열린다', async () => {
    // 처음 실행: 저장 파일 없음 → 기본 판(밝은 판)
    await withApp({}, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await expect(themeRadio(page, 'light')).toHaveAttribute('aria-checked', 'true')
      await expect(themeRadio(page, 'dark')).toHaveAttribute('aria-checked', 'false')
      // 준비 조건: 처음 실행이라 저장된 판 선택이 없다.
      expect(await readDataFile(userDataDir)).toBeNull()
    })

    // 어두운 판이 저장된 파일(현재 버전): dark 로 열리고 저장된 선택을 바꾸지 않는다.
    const savedDark = JSON.stringify(makeDoc({ settings: { theme: 'dark' } }), null, 2)
    await withApp({ seedJson: savedDark }, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(themeRadio(page, 'dark')).toHaveAttribute('aria-checked', 'true')
      await expect(themeRadio(page, 'light')).toHaveAttribute('aria-checked', 'false')
      // 준비 조건: 넣은 파일이 어두운 판이고 열기만으로는 파일이 바뀌지 않았다.
      expect(await readDataFile(userDataDir)).toBe(savedDark)
    })
  })

  test('TC-122 밝기 전환을 선택하면 모든 화면이 선택한 판으로 바뀐다', async () => {
    const json = seedJson([
      seedCard(1, { title: '완료 카드', status: 'done', dueDate: daysFromToday(3) }),
      seedCard(2, { title: '할 일 카드', status: 'todo', dueDate: daysFromToday(5) }),
      seedCard(3, {
        title: '보관된 카드',
        status: 'done',
        dueDate: daysFromToday(-2),
        archivedAt: '2026-11-02T09:00:00.000Z',
      }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      const initial = await readScreens(page)
      expect(initial.map((look) => look.theme)).toEqual(['light', 'light', 'light', 'light']) // 처음은 밝은 판

      await goTo(page, '보드')
      await chooseTheme(page, 'dark')
      const dark = await readScreens(page)
      expect(dark.map((look) => look.screen)).toEqual(['board', 'calendar', 'archive', 'dialog'])
      for (const [index, look] of dark.entries()) {
        const before = initial[index]
        expect(look.theme, `${look.screen} 판 값`).toBe('dark')
        expect(look.background, `${look.screen} 배경색`).not.toBe(before?.background)
        expect(look.bodyBackground, `${look.screen} 본문 배경색`).not.toBe(before?.bodyBackground)
      }

      await goTo(page, '보드')
      await chooseTheme(page, 'light')
      const light = await readScreens(page)
      expect(light).toEqual(initial) // 네 화면 모두 light 와 처음 배경색으로 돌아온다
    })
  })

  test('TC-123 어두운 판과 밝은 판 모두에서 카드 종류가 글자와 아이콘으로 구분된다', async () => {
    const json = seedJson([
      seedCard(1, { title: '버그 카드', kind: 'bug' }),
      seedCard(2, { title: '일 카드', kind: 'task' }),
    ])
    type ChipLook = {
      text: string
      icons: number
      iconLabelHidden: boolean
      filledClass: boolean
      outlineClass: boolean
      hasFill: boolean
      hasBorder: boolean
      borderWidth: string
      kind: string | null
    }
    const readChip = async (page: Page, title: string): Promise<ChipLook> => {
      const chip = boardCard(page, title).locator('.chip[data-kind]')
      await expect(chip).toHaveCount(1)
      return chip.evaluate((element: ElementLike) => {
        const style = (globalThis as unknown as WindowLike).getComputedStyle(element)
        const transparent = (color: string) => color === 'rgba(0, 0, 0, 0)' || color === 'transparent'
        const svg = element.querySelector('svg')
        return {
          text: (element.textContent ?? '').trim(),
          icons: element.querySelectorAll('svg').length,
          iconLabelHidden: svg?.getAttribute('aria-hidden') === 'true',
          filledClass: element.classList.contains('chip--filled'),
          outlineClass: element.classList.contains('chip--outline'),
          hasFill: !transparent(style.backgroundColor),
          hasBorder: !transparent(style.borderTopColor) && style.borderTopWidth !== '0px',
          borderWidth: style.borderTopWidth,
          kind: element.getAttribute('data-kind'),
        }
      })
    }

    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      const looks = new Map<Theme, { bug: ChipLook; task: ChipLook }>()
      for (const theme of ['dark', 'light'] as const) {
        await chooseTheme(page, theme)
        const bug = await readChip(page, '버그 카드')
        const task = await readChip(page, '일 카드')
        looks.set(theme, { bug, task })

        // 글자와 아이콘
        expect(bug.text).toBe('개발 버그')
        expect(task.text).toBe('할 일')
        expect(bug.icons).toBe(1)
        expect(task.icons).toBe(1)
        expect(bug.iconLabelHidden).toBe(true)
        expect(task.iconLabelHidden).toBe(true)
        expect(bug.kind).not.toBe(task.kind)
        // 모양: 개발 버그는 채움, 할 일은 테두리
        expect(bug.filledClass).toBe(true)
        expect(task.outlineClass).toBe(true)
        expect(bug.hasFill).toBe(true)
        expect(task.hasFill).toBe(false)
        expect(task.hasBorder).toBe(true)
        // 아이콘 모양도 서로 다르다 (벌레 / 체크 칸).
        const bugIcon = await boardCard(page, '버그 카드').locator('.chip[data-kind] svg').innerHTML()
        const taskIcon = await boardCard(page, '일 카드').locator('.chip[data-kind] svg').innerHTML()
        expect(bugIcon).not.toBe(taskIcon)
      }
      // 이 값들은 두 판에서 같다.
      expect(looks.get('light')).toEqual(looks.get('dark'))
    })
  })

  test('TC-124 어두운 판과 밝은 판 모두에서 마감이 지난 표시가 글자와 아이콘으로 구분된다', async () => {
    const json = seedJson([
      seedCard(1, { title: '어제 마감', dueDate: daysFromToday(-1), status: 'todo' }),
      seedCard(2, { title: '내일 마감', dueDate: daysFromToday(1), status: 'todo' }),
    ])
    type CardLook = {
      overdueFlag: string | null
      triangle: number
      triangleLabel: string | null
      dueText: string
      borderWidth: string
    }
    const readCard = async (page: Page, title: string): Promise<CardLook> => {
      const card = boardCard(page, title)
      await expect(card).toHaveCount(1)
      const triangles = card.locator('.due-text svg')
      return {
        overdueFlag: await card.getAttribute('data-overdue'),
        triangle: await triangles.count(),
        triangleLabel: (await triangles.count()) > 0 ? await triangles.first().getAttribute('aria-label') : null,
        dueText: ((await card.locator('.due-text').textContent()) ?? '').trim(),
        borderWidth: await card.evaluate(
          (element: ElementLike) => (globalThis as unknown as WindowLike).getComputedStyle(element).borderTopWidth,
        ),
      }
    }

    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      const looks = new Map<Theme, { late: CardLook; ok: CardLook }>()
      for (const theme of ['dark', 'light'] as const) {
        await chooseTheme(page, theme)
        const late = await readCard(page, '어제 마감')
        const ok = await readCard(page, '내일 마감')
        looks.set(theme, { late, ok })

        expect(late.overdueFlag).toBe('true')
        expect(late.triangle).toBe(1)
        expect(late.triangleLabel).toBe('마감 지남')
        expect(late.dueText).toContain('1일 지남')
        expect(late.borderWidth).toBe('2px')

        expect(ok.overdueFlag).toBeNull()
        expect(ok.triangle).toBe(0)
        expect(ok.dueText).not.toContain('지남')
        expect(ok.borderWidth).not.toBe('2px')
      }
      expect(looks.get('light')).toEqual(looks.get('dark'))
    })
  })
})
