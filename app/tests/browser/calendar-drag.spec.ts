// 캘린더 칩 끌기로 마감일 바꾸기와 날짜 입력칸의 실제 Electron 확인 (SCR-003, FR-004, FR-005; AC-029, AC-043, AC-044, AC-045).
// 데이터는 구동 전에 임시 폴더의 저장 파일로 심는다. 앱 시계나 시험 전용 분기를 쓰지 않는다 (ADR-012):
// 날짜는 2026년 11월로 고정하고 앱이 오늘이 든 달로 열리므로 `‹`/`›`로 그 달까지 이동한다.
// 끌기는 Playwright `locator.dragTo` 로 한다 (HTML5 끌어다 놓기가 Electron 에서 동작함을 TC-166 이 확인한다).
// 브라우저가 그리는 달력 팝업은 DOM 밖이라 열 수 없다: TC-165 는 값 설정과 키보드 직접 입력으로 확인한다.

import { createHash } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { DATA_FILE_NAME } from '../../src/main/store/data-file-names'
import { readDataFile, withApp } from './support/launch-app'
import {
  boardCard,
  clickSave,
  closeDialogWithCancel,
  dialog,
  openCreateDialog,
  saveIndicator,
  seedCard,
  seedEntry,
  seedJson,
  statusSelect,
  titleInput,
  waitForBoard,
  withPersistentDir,
} from './support/board-page'

const SAVED_TEXT = '내 PC에 저장됨'

function goTo(page: Page, name: '보드' | '캘린더' | '보관함'): Promise<void> {
  return page.locator('.sidebar-nav__item', { hasText: name }).click()
}

function dayCell(page: Page, date: string): Locator {
  return page.locator(`.day-cell[data-date="${date}"]`)
}

function chipIn(page: Page, date: string, title?: string): Locator {
  const chips = dayCell(page, date).locator('.calendar-chip')
  return title === undefined ? chips : chips.filter({ hasText: title })
}

function periodTitle(page: Page): Locator {
  return page.locator('.period-nav__title')
}

function dueInput(page: Page): Locator {
  return dialog(page).getByLabel('마감일', { exact: true })
}

/** `2026년 11월`, `2026년 11월 8일 ~ 14일`의 시작 연·월·일을 순서 비교용 숫자로 바꾼다. */
function titleOrder(title: string): number {
  const match = /^(\d+)년 (\d+)월(?: (\d+)일)?/.exec(title)
  if (match === null) throw new Error(`기간 제목을 읽을 수 없다: ${title}`)
  return Number(match[1]) * 10_000 + Number(match[2]) * 100 + Number(match[3] ?? '1')
}

/** `‹`/`›` 로 기간 제목이 원하는 값이 될 때까지 이동한다. 보기(월/주)에 따라 한 번에 한 달 또는 한 주씩 간다. */
async function moveToPeriod(page: Page, wanted: string, unit: '달' | '주'): Promise<void> {
  for (let step = 0; step < 120; step += 1) {
    const current = ((await periodTitle(page).textContent()) ?? '').trim()
    if (current === wanted) return
    const forward = titleOrder(current) < titleOrder(wanted)
    await page.getByRole('button', { name: forward ? `다음 ${unit}` : `이전 ${unit}`, exact: true }).click()
    await expect(periodTitle(page)).not.toHaveText(current)
  }
  throw new Error(`기간 제목이 ${wanted} 이(가) 되지 않았다`)
}

/** 캘린더를 열어 2026년 11월 월 보기로 맞춘다. */
async function openNovember(page: Page): Promise<void> {
  await waitForBoard(page)
  await goTo(page, '캘린더')
  await moveToPeriod(page, '2026년 11월', '달')
  await expect(page.locator('.calendar-grid[data-mode="month"] .day-cell')).toHaveCount(35)
}

async function setMode(page: Page, label: '월' | '주'): Promise<void> {
  await page.getByRole('radiogroup', { name: '보기' }).getByRole('radio', { name: label, exact: true }).click()
  await expect(page.locator(`.calendar-grid[data-mode="${label === '월' ? 'month' : 'week'}"]`)).toBeVisible()
}

/** 칩을 날짜 칸으로 끌어다 놓는다 (HTML5 끌어다 놓기). */
async function dragChip(chip: Locator, target: Locator): Promise<void> {
  await expect(chip).toHaveCount(1)
  await chip.dragTo(target)
}

async function openChip(page: Page, title: string): Promise<void> {
  await page.locator('.calendar-chip', { hasText: title }).first().click()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).locator('.card-dialog__title')).toHaveText('카드 상세')
  await expect(titleInput(page)).toHaveValue(title)
}

/** 날짜 입력칸의 구획 순서(창의 언어를 따른다. 예: ko 는 연·월·일). */
async function dateSegmentOrder(input: Locator): Promise<Array<'year' | 'month' | 'day'>> {
  const order = await input.evaluate((): string[] => {
    const language = (globalThis as unknown as { navigator: { language: string } }).navigator.language
    return new Intl.DateTimeFormat(language)
      .formatToParts(new Date(2026, 10, 5))
      .map((part) => part.type as string)
      .filter((type) => type === 'year' || type === 'month' || type === 'day')
  })
  expect(order.length).toBe(3)
  return order as Array<'year' | 'month' | 'day'>
}

/** 날짜 입력칸의 월·일·연 구획에 키보드로 입력한다(구획 순서는 창의 언어를 따른다). 값이 없는 구획은 Tab 으로 건너뛴다(비워 둔다). */
async function typeDateSegments(
  page: Page,
  input: Locator,
  segments: { year?: string; month?: string; day?: string },
): Promise<void> {
  const order = await dateSegmentOrder(input)
  await input.focus()
  for (const [index, part] of order.entries()) {
    const text = segments[part]
    const isLast = index === order.length - 1
    if (text !== undefined) {
      await page.keyboard.type(text)
      // 연도 구획은 네 자리를 넘겨도 다음 구획으로 넘어가지 않아(최대 여섯 자리) Tab 으로 넘긴다. 월·일은 두 자리에서 자동으로 넘어간다.
      if (part === 'year' && !isLast) await page.keyboard.press('Tab')
    } else if (!isLast) {
      await page.keyboard.press('Tab')
    }
  }
}

function dateState(input: Locator): Promise<{ value: string; badInput: boolean }> {
  return input.evaluate((el) => {
    const field = el as unknown as { value: string; validity: { badInput: boolean } }
    return { value: field.value, badInput: field.validity.badInput }
  })
}

/** 데이터 폴더의 저장 파일 상태: 해시, 수정 시각, 저장 파일 관련 파일 목록(임시 파일·.bak 포함). */
async function dataFolderState(dir: string): Promise<{ hash: string; mtimeMs: number; files: string[] }> {
  const text = await readDataFile(dir)
  if (text === null) throw new Error('저장 파일이 없다')
  const info = await stat(join(dir, DATA_FILE_NAME))
  const files = (await readdir(dir)).filter((name) => name.startsWith('kanban-data')).sort()
  return { hash: createHash('sha256').update(text).digest('hex'), mtimeMs: info.mtimeMs, files }
}

test.describe('calendar-drag', () => {
  test('TC-165 마감일은 날짜 입력칸에서 달력으로 고르거나 직접 입력해 저장하고 칩을 열어 고칠 수도 있다', async () => {
    const json = seedJson([seedCard(1, { title: '고칠 카드', dueDate: '2026-11-06' })])
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await waitForBoard(page)

      // (1) 칸의 종류와 달력 열기 지원, 값 설정(달력 팝업이 고른 날짜를 칸에 넣는 것과 같은 값 경로)
      await openCreateDialog(page)
      const input = dueInput(page)
      const support = await input.evaluate((el) => {
        const field = el as unknown as { tagName: string; type: string; showPicker?: unknown }
        return { tag: field.tagName.toLowerCase(), type: field.type, showPicker: typeof field.showPicker }
      })
      expect(support).toEqual({ tag: 'input', type: 'date', showPicker: 'function' })
      await titleInput(page).fill('달력 카드')
      await input.fill('2026-11-20')
      expect(await dateState(input)).toEqual({ value: '2026-11-20', badInput: false })
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText(SAVED_TEXT)
      await expect(boardCard(page, '달력 카드').locator('.due-text')).toContainText('마감 11/20')
      await boardCard(page, '달력 카드').locator('.card-item__title').click()
      await expect(dueInput(page)).toHaveValue('2026-11-20')
      await closeDialogWithCancel(page)

      // (2) 키보드로 월 11, 일 24, 연 2026 입력
      await openCreateDialog(page)
      await titleInput(page).fill('직접 카드')
      await typeDateSegments(page, dueInput(page), { month: '11', day: '24', year: '2026' })
      expect(await dateState(dueInput(page))).toEqual({ value: '2026-11-24', badInput: false })
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText(SAVED_TEXT)
      await expect(boardCard(page, '직접 카드').locator('.due-text')).toContainText('마감 11/24')
      await boardCard(page, '직접 카드').locator('.card-item__title').click()
      await expect(dueInput(page)).toHaveValue('2026-11-24')
      await closeDialogWithCancel(page)

      // (3) 캘린더의 칩을 열어 마감일을 2026-11-13 으로 바꿔 저장
      await goTo(page, '캘린더')
      await moveToPeriod(page, '2026년 11월', '달')
      await expect(chipIn(page, '2026-11-06', '고칠 카드')).toHaveCount(1)
      await openChip(page, '고칠 카드')
      await dueInput(page).fill('2026-11-13')
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText(SAVED_TEXT)
      await expect(chipIn(page, '2026-11-13', '고칠 카드')).toHaveCount(1)
      await expect(chipIn(page, '2026-11-06')).toHaveCount(0)

      // (4) 다시 열어 마감일 칸에 월·일만 입력한 채(연도 비움) 저장 → 저장되지 않고 오류
      await openChip(page, '고칠 카드')
      await dueInput(page).fill('')
      await typeDateSegments(page, dueInput(page), { month: '02', day: '28' })
      expect(await dateState(dueInput(page))).toEqual({ value: '', badInput: true }) // 준비 조건: 입력하다 만 상태
      const before = await readDataFile(userDataDir)
      await clickSave(page)
      await expect(dialog(page)).toBeVisible()
      const dueError = dialog(page)
        .locator('.field[data-invalid="true"]', { has: page.locator('input[type="date"]') })
        .locator('.field__error')
      await expect(dueError).toBeVisible()
      expect(((await dueError.textContent()) ?? '').trim().startsWith('존재하지 않는 날짜입니다')).toBe(true)
      expect(await readDataFile(userDataDir)).toBe(before) // 저장되지 않았다
      await closeDialogWithCancel(page)
      await expect(chipIn(page, '2026-11-13', '고칠 카드')).toHaveCount(1) // 카드의 마감일은 그대로
    })
  })

  test('TC-166 월 보기에서 칩을 다른 날짜 칸으로 끌어다 놓으면 저장 뒤 그 칸에 보이고 마감일만 바뀐다', async () => {
    const json = seedJson(
      [
        seedCard(1, {
          title: '카드 A',
          status: 'in_progress',
          kind: 'bug',
          priority: 'high',
          description: 'A 설명',
          memo: 'A 메모',
          dueDate: '2026-11-06',
        }),
        seedCard(2, { title: '카드 B', status: 'done', dueDate: '2026-11-10' }),
      ],
      [seedEntry(1, 1, { content: 'A 진행 기록', statusAtTime: 'in_progress' })],
    )

    const verifyCards = async (page: Page): Promise<void> => {
      await expect(chipIn(page, '2026-11-18', '카드 A')).toHaveCount(1)
      await expect(chipIn(page, '2026-11-06')).toHaveCount(0)
      await expect(chipIn(page, '2026-11-24', '카드 B')).toHaveCount(1)
      await expect(chipIn(page, '2026-11-10')).toHaveCount(0)
    }

    await withPersistentDir(json, async ({ launch, close }) => {
      const first = await launch()
      const page = first.page
      await openNovember(page)
      await expect(chipIn(page, '2026-11-06', '카드 A')).toHaveCount(1)
      await expect(chipIn(page, '2026-11-10', '카드 B')).toHaveCount(1)

      await dragChip(chipIn(page, '2026-11-06', '카드 A'), dayCell(page, '2026-11-18'))
      // 낙관적 반영이 없으므로 칩이 새 칸에 나타났다는 것은 저장이 끝났다는 뜻이다.
      await expect(chipIn(page, '2026-11-18', '카드 A')).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText(SAVED_TEXT)
      await expect(chipIn(page, '2026-11-06')).toHaveCount(0)

      await dragChip(chipIn(page, '2026-11-10', '카드 B'), dayCell(page, '2026-11-24'))
      await expect(chipIn(page, '2026-11-24', '카드 B')).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText(SAVED_TEXT)
      await expect(chipIn(page, '2026-11-10')).toHaveCount(0)
      await verifyCards(page)

      await openChip(page, '카드 A')
      const box = dialog(page)
      await expect(dueInput(page)).toHaveValue('2026-11-18')
      await expect(statusSelect(page)).toHaveValue('in_progress')
      await expect(box.getByRole('radio', { name: '개발 버그', exact: true })).toHaveAttribute('aria-checked', 'true')
      await expect(box.getByRole('radio', { name: '높음', exact: true })).toHaveAttribute('aria-checked', 'true')
      await expect(box.getByRole('textbox', { name: '상세 설명' })).toHaveValue('A 설명')
      await expect(box.getByRole('textbox', { name: '추가 메모' })).toHaveValue('A 메모')
      await expect(box.locator('.progress-log__item')).toHaveCount(1)
      await expect(box.locator('.progress-log__content')).toHaveText(['A 진행 기록'])
      await closeDialogWithCancel(page)

      await openChip(page, '카드 B')
      await expect(dueInput(page)).toHaveValue('2026-11-24')
      await expect(statusSelect(page)).toHaveValue('done')
      await closeDialogWithCancel(page)

      await expect(page.locator('.app-shell__statusbar')).toHaveText('11월에 마감인 카드 2건')

      // 재구동 뒤에도 두 칩이 같은 칸에 있다.
      await close(first)
      const second = await launch()
      await openNovember(second.page)
      await verifyCards(second.page)
      await close(second)
    })
  })

  test('TC-167 주 보기에서 칩을 다른 날짜 칸으로 끌어다 놓으면 저장 뒤 그 칸에 보이고 마감일이 바뀐다', async () => {
    const json = seedJson([seedCard(1, { title: '카드 C', status: 'todo', priority: 'low', dueDate: '2026-11-09' })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await goTo(page, '캘린더')
      await setMode(page, '주')
      await moveToPeriod(page, '2026년 11월 8일 ~ 14일', '주')
      await expect(page.locator('.calendar-grid[data-mode="week"] .day-cell')).toHaveCount(7)
      await expect(chipIn(page, '2026-11-09', '카드 C')).toHaveCount(1)

      await dragChip(chipIn(page, '2026-11-09', '카드 C'), dayCell(page, '2026-11-11'))
      await expect(chipIn(page, '2026-11-11', '카드 C')).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText(SAVED_TEXT)
      await expect(chipIn(page, '2026-11-09')).toHaveCount(0)

      await openChip(page, '카드 C')
      await expect(dueInput(page)).toHaveValue('2026-11-11')
      await expect(statusSelect(page)).toHaveValue('todo')
      await expect(dialog(page).getByRole('radio', { name: '낮음', exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      await closeDialogWithCancel(page)

      await setMode(page, '월')
      await expect(chipIn(page, '2026-11-11', '카드 C')).toHaveCount(1)
    })
  })

  test('TC-168 이 달이 아닌 날의 칸에 놓아도 마감일이 그 날짜로 바뀐다', async () => {
    const json = seedJson([seedCard(1, { title: '카드 D', dueDate: '2026-11-12' })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await openNovember(page)
      // 준비 조건: 12월 1일 칸은 이 달 밖 칸이다.
      await expect(dayCell(page, '2026-12-01')).toHaveAttribute('data-outside', 'true')

      await dragChip(chipIn(page, '2026-11-12', '카드 D'), dayCell(page, '2026-12-01'))
      await expect(saveIndicator(page)).toHaveText(SAVED_TEXT)
      await expect(chipIn(page, '2026-11-12')).toHaveCount(0)
      await expect(page.locator('.app-shell__statusbar')).toHaveText('11월에 마감인 카드 0건')

      await moveToPeriod(page, '2026년 12월', '달')
      await expect(chipIn(page, '2026-12-01', '카드 D')).toHaveCount(1)
      await openChip(page, '카드 D')
      await expect(dueInput(page)).toHaveValue('2026-12-01')
    })
  })

  test('TC-169 칩을 원래 칸이나 날짜 칸 밖에 놓으면 아무것도 바뀌지 않고 저장도 일어나지 않는다', async () => {
    const json = seedJson([seedCard(1, { title: '카드 E', dueDate: '2026-11-15' })])
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await openNovember(page)
      await expect(chipIn(page, '2026-11-15', '카드 E')).toHaveCount(1)
      const recorded = await dataFolderState(userDataDir)
      expect(recorded.files).toEqual([DATA_FILE_NAME]) // 준비 조건: 심은 저장 파일 하나뿐이다.

      const targets: Array<[string, Locator]> = [
        ['자기 칸', dayCell(page, '2026-11-15')],
        ['요일 머리 줄', page.locator('.calendar-weekdays')],
        ['범례 줄', page.locator('.calendar-legend')],
        ['사이드바', page.locator('.sidebar')],
        ['상단 막대', page.locator('.top-bar')],
      ]
      for (const [name, target] of targets) {
        await expect(target, `${name} 놓을 곳`).toBeVisible()
        await chipIn(page, '2026-11-15', '카드 E').dragTo(target)
        await page.waitForTimeout(1000)

        await expect(chipIn(page, '2026-11-15', '카드 E'), `${name} 뒤 칩 위치`).toHaveCount(1)
        await expect(page.locator('.calendar-chip'), `${name} 뒤 칩 수`).toHaveCount(1)
        await expect(saveIndicator(page), `${name} 뒤 저장 상태`).toHaveText(SAVED_TEXT)
        const now = await dataFolderState(userDataDir)
        expect(now, `${name} 뒤 데이터 폴더`).toEqual(recorded)
        // 끌기가 끝났으므로 놓는 곳 표시도 남지 않는다.
        await expect(page.locator('.day-cell[data-drop-target="true"]')).toHaveCount(0)
      }

      await openChip(page, '카드 E')
      await expect(dueInput(page)).toHaveValue('2026-11-15')
    })
  })

  test('TC-170 `+N건 더 보기` 팝업 안의 칩은 끌 수 없고 칸의 칩은 끌 수 있다', async () => {
    const titles = ['일정 가', '일정 나', '일정 다', '일정 라', '일정 마']
    const json = seedJson(titles.map((title, index) => seedCard(index + 1, { title, dueDate: '2026-11-12' })))
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await openNovember(page)
      const recorded = await dataFolderState(userDataDir)

      const cell = dayCell(page, '2026-11-12')
      await expect(cell.locator('.calendar-chip')).toHaveCount(3)
      const cellChipDraggable = await cell
        .locator('.calendar-chip')
        .evaluateAll((els) => els.map((el) => (el as unknown as { draggable: boolean }).draggable))
      expect(cellChipDraggable).toEqual([true, true, true])

      await cell.getByRole('button', { name: '+2건 더 보기' }).click()
      const popover = page.locator('.day-popover')
      await expect(popover).toBeVisible()
      await expect(popover.locator('.calendar-chip')).toHaveCount(5)
      const popoverDraggable = await popover
        .locator('.calendar-chip')
        .evaluateAll((els) => els.map((el) => (el as unknown as { draggable: boolean }).draggable))
      expect(popoverDraggable).toEqual([false, false, false, false, false])

      // 팝업 안 칩 하나를 20일 칸으로 끌어다 놓기를 시도한다 (끌기가 시작되지 않아 아무 일도 없어야 한다).
      // 팝업이 20일 칸을 덮고 있어(그 칸의 점은 팝업 위에 놓인다) 팝업에 가려지지 않은 16일 칸으로도 같은 시도를 한다.
      // 마우스를 직접 움직여 끄는 동작을 만든다.
      const attemptDrag = async (targetDate: string): Promise<void> => {
        if (!(await popover.isVisible())) await cell.getByRole('button', { name: '+2건 더 보기' }).click()
        await expect(popover).toBeVisible()
        const chipBox = await popover.locator('.calendar-chip', { hasText: '일정 마' }).boundingBox()
        const targetBox = await dayCell(page, targetDate).boundingBox()
        if (chipBox === null || targetBox === null) throw new Error('끌기 위치를 읽지 못했다')
        await page.mouse.move(chipBox.x + chipBox.width / 2, chipBox.y + chipBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
        // 끌기가 시작되지 않았으므로 놓는 곳 표시가 켜지지 않는다.
        await expect(page.locator('.day-cell[data-drop-target="true"]')).toHaveCount(0)
        await page.mouse.up()
        await page.waitForTimeout(500)
        await expect(page.locator('.day-cell[data-drop-target="true"]')).toHaveCount(0)
      }
      await attemptDrag('2026-11-20')
      await attemptDrag('2026-11-16')
      // 팝업을 닫고(Esc) 칸의 상태를 읽는다.
      if (await popover.isVisible()) await page.keyboard.press('Escape')
      await expect(popover).toHaveCount(0)
      await expect(chipIn(page, '2026-11-20')).toHaveCount(0)
      await expect(chipIn(page, '2026-11-16')).toHaveCount(0)
      await expect(cell.locator('.calendar-chip')).toHaveCount(3)
      await expect(cell.getByRole('button', { name: '+2건 더 보기' })).toBeVisible()
      expect(await dataFolderState(userDataDir)).toEqual(recorded)

      // 팝업 안 칩을 누르면 카드 대화상자가 열려 마감일을 거기서 고칠 수 있다.
      await cell.getByRole('button', { name: '+2건 더 보기' }).click()
      await popover.locator('.calendar-chip', { hasText: '일정 마' }).click()
      await expect(dialog(page)).toBeVisible()
      await expect(titleInput(page)).toHaveValue('일정 마')
      await expect(dueInput(page)).toHaveValue('2026-11-12')
      await dueInput(page).fill('2026-11-21')
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText(SAVED_TEXT)
      await expect(chipIn(page, '2026-11-21', '일정 마')).toHaveCount(1)
    })
  })
})
