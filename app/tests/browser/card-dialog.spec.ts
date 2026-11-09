// 카드 입력·상세 대화상자의 실제 Electron 확인 (SCR-002): 입력 오류, 마감일, 상세 항목, 수정, 진행 기록, 삭제 확인, 보기 전용.
// 데이터는 구동 전에 임시 폴더의 저장 파일로 심는다. 앱 시계나 시험 전용 분기를 쓰지 않는다 (ADR-012).

import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { DATA_FILE_NAME } from '../../src/main/store/data-file-names'
import { closeApp, launchApp, makeTempDir, readDataFile, removeDir, withApp } from './support/launch-app'
import {
  boardCard,
  cardId,
  clickSave,
  closeDialogWithCancel,
  column,
  createCardViaDialog,
  daysFromToday,
  dialog,
  moveViaMenu,
  openCardDialog,
  openCreateDialog,
  readDoc,
  saveIndicator,
  seedCard,
  seedEntry,
  seedJson,
  titleInput,
  today,
  waitForBoard,
  withPersistentDir,
} from './support/board-page'

/** 마감 글자가 나타내는 날짜: 올해면 MM/DD, 아니면 YYYY/MM/DD (DueText 의 규칙). */
function dueLabel(date: string): string {
  const [year, month, day] = date.split('-')
  return today().slice(0, 4) === year ? `${month}/${day}` : `${year}/${month}/${day}`
}

function goTo(page: Page, name: '보드' | '캘린더' | '보관함'): Promise<void> {
  return page.locator('.sidebar-nav__item', { hasText: name }).click()
}

function calendarChip(page: Page, title: string): Locator {
  return page.locator('.calendar-chip', { hasText: title })
}

function dueInput(page: Page): Locator {
  return dialog(page).getByRole('textbox', { name: /^마감일/ })
}

/**
 * 날짜 입력칸(`type="date"`)의 월·일·연 구획에 키보드로 입력한다. 구획 순서는 창의 언어를 따르므로 화면에서 읽는다.
 * 값이 주어지지 않은 구획은 Tab 으로 건너뛴다(비워 둔다).
 */
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

async function typeDateSegments(
  page: Page,
  input: Locator,
  segments: { year?: string; month?: string; day?: string },
): Promise<void> {
  const order = await dateSegmentOrder(input)
  await input.focus()
  for (const [index, part] of order.entries()) {
    const text = segments[part]
    if (text !== undefined) await page.keyboard.type(text)
    else if (index < order.length - 1) await page.keyboard.press('Tab')
  }
}

/** 날짜 입력칸의 값과 입력하다 만 상태(validity.badInput). */
function dateState(input: Locator): Promise<{ value: string; badInput: boolean }> {
  return input.evaluate((el) => {
    const field = el as unknown as { value: string; validity: { badInput: boolean } }
    return { value: field.value, badInput: field.validity.badInput }
  })
}

function progressItems(page: Page): Locator {
  return dialog(page).locator('.progress-log__item')
}

async function addProgress(page: Page, content: string): Promise<void> {
  const before = await progressItems(page).count()
  await dialog(page).getByRole('textbox', { name: '기록 내용' }).fill(content)
  await dialog(page).getByRole('button', { name: '기록 추가', exact: true }).click()
  await expect(progressItems(page)).toHaveCount(before + 1)
}

test.describe('card-dialog', () => {
  test('TC-069 입력 중 닫으면 카드가 만들어지지 않는다', async () => {
    await withPersistentDir(undefined, async ({ dir, launch, close }) => {
      const first = await launch()
      const page = first.page

      // 1) 취소
      await openCreateDialog(page)
      await titleInput(page).fill('취소로 닫는 카드')
      await closeDialogWithCancel(page)
      await expect(page.locator('.card-item')).toHaveCount(0)

      // 2) ✕ (머리의 `닫기` 아이콘 버튼)
      await openCreateDialog(page)
      await titleInput(page).fill('엑스로 닫는 카드')
      await dialog(page).locator('.card-dialog__head').getByRole('button', { name: '닫기' }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(page.locator('.card-item')).toHaveCount(0)

      // 3) Esc
      await openCreateDialog(page)
      await titleInput(page).fill('이스케이프로 닫는 카드')
      await page.keyboard.press('Escape')
      await expect(dialog(page)).toHaveCount(0)
      await expect(page.locator('.card-item')).toHaveCount(0)

      // 저장 요청이 한 번도 가지 않았다: 처음 실행이라 저장 파일이 아직 없다.
      expect(await readDataFile(dir)).toBeNull()

      await close(first)
      const second = await launch()
      await expect(second.page.locator('.card-item')).toHaveCount(0)
      await expect(column(second.page, 'todo').locator('.column__count')).toHaveText('0')
      await close(second)
    })
  })

  test('TC-078 마감일을 입력해 저장하면 카드를 열었을 때 그 마감일이 보인다', async () => {
    // 시나리오의 예시 날짜(11-06)는 작성한 날 기준 이틀 뒤다: 실행하는 날에서 이틀 뒤를 쓴다 (마감 지남이 되지 않는 미래 날짜).
    const due = daysFromToday(2)
    await withApp({}, async ({ page }) => {
      await waitForBoard(page)
      await createCardViaDialog(page, { title: '마감 카드', dueDate: due })

      await expect(boardCard(page, '마감 카드').locator('.due-text')).toHaveText(`마감 ${dueLabel(due)}`)
      await openCardDialog(page, '마감 카드')
      await expect(dueInput(page)).toHaveValue(due)
    })
  })

  test('TC-079 마감일을 비워 두어도 카드가 저장된다', async () => {
    await withApp({}, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await createCardViaDialog(page, { title: '마감 없는 카드' })

      await expect(boardCard(page, '마감 없는 카드')).toHaveCount(1)
      await expect(boardCard(page, '마감 없는 카드').locator('.due-text')).toHaveText('마감 없음')
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      expect((await readDoc(userDataDir)).cards[0]?.dueDate).toBeNull()
    })
  })

  test('TC-080 존재하지 않는 날짜를 입력하면 저장되지 않고 마감일 칸에 오류 문구가 보인다', async () => {
    await withApp({}, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await openCreateDialog(page)
      await titleInput(page).fill('날짜 시험')

      // 날짜 입력칸은 없는 날짜를 값으로 내지 않고 validity.badInput 만 켠다 (`fill` 은 이 값을 넣지 못한다).
      // 월·일·연 구획에 키보드로 입력한다. 구획 순서는 창의 언어에 따르므로 화면에서 읽는다.
      const dueError = dialog(page)
        .locator('.field[data-invalid="true"]', { has: page.locator('input[type="date"]') })
        .locator('.field__error')
      const expectDueError = async (): Promise<void> => {
        await expect(dialog(page)).toBeVisible()
        await expect(dueError).toBeVisible()
        expect(((await dueError.textContent()) ?? '').trim().startsWith('존재하지 않는 날짜입니다')).toBe(true)
        await expect(dueInput(page)).toHaveAttribute('aria-invalid', 'true')
        await expect(page.locator('.card-item')).toHaveCount(0)
        expect(await readDataFile(userDataDir)).toBeNull() // 저장 요청이 가지 않았다
      }

      // 1) 2026-02-30 (없는 날짜)
      await typeDateSegments(page, dueInput(page), { month: '02', day: '30', year: '2026' })
      // 준비 조건: 칸 값은 비어 있고 입력하다 만 상태(badInput)다.
      expect(await dateState(dueInput(page))).toEqual({ value: '', badInput: true })
      await clickSave(page)
      await expectDueError()

      // 2) 연도 칸을 비워 둔 채 월·일만 입력한 경우 (빈 칸에서 시작한다).
      //    값이 ''에서 ''로 그대로여서 브라우저가 input 이벤트를 내지 않는다: 앱은 저장 시점에 입력칸에서 직접 읽어야 한다.
      await dueInput(page).fill('')
      expect(await dateState(dueInput(page))).toEqual({ value: '', badInput: false })
      await typeDateSegments(page, dueInput(page), { month: '02', day: '28' })
      // 준비 조건: 칸 값은 비어 있고 입력하다 만 상태(badInput)다.
      expect(await dateState(dueInput(page))).toEqual({ value: '', badInput: true })
      await clickSave(page)
      await expectDueError()

      // 3) 고쳐서 다시 저장
      await dueInput(page).fill('2026-02-28')
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(boardCard(page, '날짜 시험')).toHaveCount(1)
    })
  })

  test('TC-081 상세 설명, 우선순위, 추가 메모를 저장한 뒤 열면 그대로 보인다', async () => {
    await withApp({}, async ({ page }) => {
      await waitForBoard(page)
      await createCardViaDialog(page, {
        title: '세부 항목 카드',
        description: '분기별 신고',
        priority: '높음',
        memo: '서류 확인',
      })

      await openCardDialog(page, '세부 항목 카드')
      await expect(titleInput(page)).toHaveValue('세부 항목 카드')
      await expect(dialog(page).getByRole('textbox', { name: '상세 설명' })).toHaveValue('분기별 신고')
      await expect(dialog(page).getByRole('radio', { name: '높음', exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      await expect(dialog(page).getByRole('textbox', { name: '추가 메모' })).toHaveValue('서류 확인')
    })
  })

  test('TC-082 우선순위를 고르지 않아도 저장되고 선택지는 네 가지다', async () => {
    await withApp({}, async ({ page }) => {
      await waitForBoard(page)
      await openCreateDialog(page)
      const group = dialog(page).getByRole('radiogroup', { name: '우선순위' })
      await expect(group.getByRole('radio')).toHaveText(['없음', '낮음', '중간', '높음']) // `보통`이 없다
      await expect(group.getByRole('radio', { name: '없음', exact: true })).toHaveAttribute('aria-checked', 'true')

      await titleInput(page).fill('우선순위 없는 카드')
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(boardCard(page, '우선순위 없는 카드')).toHaveCount(1)
      await expect(boardCard(page, '우선순위 없는 카드').locator('.priority-mark')).toHaveCount(0)

      // 다른 카드를 `중간`으로 저장하고 다시 연다.
      await createCardViaDialog(page, { title: '중간 카드', priority: '중간' })
      await expect(boardCard(page, '중간 카드').locator('.priority-mark')).toHaveText('중간')
      await openCardDialog(page, '중간 카드')
      await expect(dialog(page).getByRole('radio', { name: '중간', exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      )
    })
  })

  test('TC-083 카드 내용을 고쳐 저장하면 보드에 고친 내용이 보인다', async () => {
    const json = seedJson([
      seedCard(1, { title: '첫 카드', kind: 'task' }),
      seedCard(2, { title: '둘째 카드', kind: 'task' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await openCardDialog(page, '첫 카드')
      await titleInput(page).fill('고친 첫 카드')
      await dialog(page).getByRole('radio', { name: '개발 버그', exact: true }).click()
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)

      await expect(boardCard(page, '고친 첫 카드')).toHaveCount(1)
      await expect(boardCard(page, '고친 첫 카드').locator('.chip[data-kind]')).toHaveText('개발 버그')
      await expect(page.locator('.card-item', { hasText: /^첫 카드/ })).toHaveCount(0)
      await expect(boardCard(page, '둘째 카드').locator('.chip[data-kind]')).toHaveText('할 일')
      await expect(page.locator('.card-item')).toHaveCount(2)
    })
  })

  test('TC-084 수정하다 제목을 비우면 저장되지 않고 제목 칸에 오류 문구가 보인다', async () => {
    const json = seedJson([seedCard(1, { title: '원래 제목' })])
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      const before = await readDataFile(userDataDir)
      await openCardDialog(page, '원래 제목')
      await titleInput(page).fill('')
      await clickSave(page)

      await expect(dialog(page)).toBeVisible()
      await expect(dialog(page).locator('.field__error')).toHaveText('제목을 입력하세요')
      await expect(titleInput(page)).toHaveAttribute('aria-invalid', 'true')

      await closeDialogWithCancel(page)
      await expect(page.locator('.card-item__title')).toHaveText(['원래 제목'])
      expect(await readDataFile(userDataDir)).toBe(before) // 저장 파일도 바뀌지 않았다
    })
  })

  test('TC-085 진행 기록은 남긴 순서로 쌓이고 다른 카드에는 나타나지 않는다', async () => {
    const json = seedJson([seedCard(1, { title: '카드 A' }), seedCard(2, { title: '카드 B' })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await openCardDialog(page, '카드 A')
      await expect(dialog(page).locator('.progress-log__empty')).toHaveText('아직 남긴 기록이 없습니다')
      await addProgress(page, '첫째')
      await addProgress(page, '둘째')
      await expect(progressItems(page).locator('.progress-log__content')).toHaveText(['첫째', '둘째'])
      await closeDialogWithCancel(page)

      await openCardDialog(page, '카드 B')
      await expect(progressItems(page)).toHaveCount(0)
      await expect(dialog(page).locator('.progress-log__empty')).toHaveText('아직 남긴 기록이 없습니다')
      await expect(dialog(page)).not.toContainText('첫째')
      await expect(dialog(page)).not.toContainText('둘째')
    })
  })

  test('TC-086 각 기록에는 그 기록을 남긴 때의 카드 상태가 보인다', async () => {
    const json = seedJson([seedCard(1, { title: '상태 기록 카드', status: 'todo' })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await openCardDialog(page, '상태 기록 카드')
      await addProgress(page, 'A')
      await closeDialogWithCancel(page)

      await moveViaMenu(page, '상태 기록 카드', '진행 중으로 옮기기')
      await expect(column(page, 'in_progress').locator('.card-item', { hasText: '상태 기록 카드' })).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')

      await openCardDialog(page, '상태 기록 카드')
      await expect(progressItems(page).locator('.progress-log__status')).toHaveText(['할 일'])
      await addProgress(page, 'B')

      const items = progressItems(page)
      await expect(items.locator('.progress-log__content')).toHaveText(['A', 'B'])
      await expect(items.nth(0).locator('.progress-log__status')).toHaveText('할 일')
      await expect(items.nth(1).locator('.progress-log__status')).toHaveText('진행 중')
    })
  })

  test('TC-087 빈 기록은 추가되지 않는다', async () => {
    const json = seedJson([seedCard(1, { title: '빈 기록 카드' })])
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await openCardDialog(page, '빈 기록 카드')
      const button = dialog(page).getByRole('button', { name: '기록 추가', exact: true })
      const input = dialog(page).getByRole('textbox', { name: '기록 내용' })

      await expect(button).toBeDisabled()
      await input.fill('   ')
      await expect(button).toBeDisabled()
      await input.fill('')
      await expect(button).toBeDisabled()
      await expect(progressItems(page)).toHaveCount(0)
      await expect(dialog(page).locator('.progress-log__count')).toHaveText('0건')
      expect((await readDoc(userDataDir)).progressEntries).toHaveLength(0)
    })
  })

  test('TC-088 삭제를 선택하면 확인 단계가 보이고 취소하면 카드가 남는다', async () => {
    const json = seedJson(
      [seedCard(1, { title: '지울까 카드' })],
      [seedEntry(1, 1, { content: '기록1' }), seedEntry(2, 1, { content: '기록2' })],
    )
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await openCardDialog(page, '지울까 카드')
      const foot = dialog(page).locator('.card-dialog__foot')
      await expect(progressItems(page)).toHaveCount(2)
      await expect(foot.getByRole('button')).toHaveText(['삭제', '취소', '저장'])

      await foot.getByRole('button', { name: '삭제', exact: true }).click()
      const confirm = dialog(page).getByRole('group', { name: '삭제 확인' })
      await expect(confirm).toBeVisible()
      await expect(confirm.locator('.card-dialog__confirm-text')).toHaveText(
        '이 카드와 진행 기록 2건이 삭제됩니다. 되돌릴 수 없습니다.',
      )
      await expect(boardCard(page, '지울까 카드')).toHaveCount(1) // 아직 보드에 있다

      await confirm.getByRole('button', { name: '취소', exact: true }).click()
      await expect(confirm).toHaveCount(0)
      await expect(dialog(page).locator('.card-dialog__foot').getByRole('button')).toHaveText(['삭제', '취소', '저장'])

      await closeDialogWithCancel(page)
      await expect(boardCard(page, '지울까 카드')).toHaveCount(1)
    })
  })

  test('TC-089 삭제를 확인하면 카드가 사라지고 앱을 다시 열어도 나타나지 않는다', async () => {
    const dueToday = today()
    const json = seedJson([
      seedCard(1, { title: '마감 있는 카드', dueDate: dueToday }),
      seedCard(2, { title: '남는 카드' }),
    ])
    await withPersistentDir(json, async ({ dir, launch, close }) => {
      const first = await launch()
      const page = first.page
      await expect(boardCard(page, '마감 있는 카드')).toHaveCount(1)
      await goTo(page, '캘린더')
      await expect(calendarChip(page, '마감 있는 카드')).toHaveCount(1) // 지우기 전에는 캘린더에 있다
      await goTo(page, '보드')

      await openCardDialog(page, '마감 있는 카드')
      await dialog(page).getByRole('button', { name: '삭제', exact: true }).click()
      await dialog(page).getByRole('button', { name: '삭제 확인', exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)

      await expect(boardCard(page, '마감 있는 카드')).toHaveCount(0)
      await expect(boardCard(page, '남는 카드')).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await goTo(page, '캘린더')
      await expect(calendarChip(page, '마감 있는 카드')).toHaveCount(0)
      await close(first)

      expect((await readDoc(dir)).cards.map((card) => card.title)).toEqual(['남는 카드'])
      const second = await launch()
      await expect(second.page.locator('.card-item__title')).toHaveText(['남는 카드'])
      await goTo(second.page, '캘린더')
      await expect(calendarChip(second.page, '마감 있는 카드')).toHaveCount(0)
      await close(second)
    })
  })

  test('TC-090 카드를 삭제하면 그 카드의 진행 기록도 함께 사라진다', async () => {
    const json = seedJson(
      [seedCard(1, { title: '기록 둘 카드' }), seedCard(2, { title: '기록 하나 카드' })],
      [seedEntry(1, 1), seedEntry(2, 1), seedEntry(3, 2)],
    )
    await withPersistentDir(json, async ({ dir, launch, close }) => {
      const first = await launch()
      const page = first.page
      await openCardDialog(page, '기록 둘 카드')
      await expect(progressItems(page)).toHaveCount(2)
      await dialog(page).getByRole('button', { name: '삭제', exact: true }).click()
      await dialog(page).getByRole('button', { name: '삭제 확인', exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await close(first)

      const doc = await readDoc(dir)
      expect(doc.progressEntries.filter((entry) => entry.cardId === cardId(1))).toHaveLength(0)
      expect(doc.cards.map((card) => card.id)).toEqual([cardId(2)])
      expect(doc.progressEntries.filter((entry) => entry.cardId === cardId(2))).toHaveLength(1)
    })
  })

  test('TC-150 보관한 카드의 보기 전용 대화상자에서도 삭제 확인 뒤 삭제할 수 있고 수정·기록 추가는 할 수 없다', async () => {
    const archivedAt = '2026-11-02T09:00:00.000Z'
    const json = seedJson(
      [
        seedCard(1, { title: '보관된 카드', status: 'done', archivedAt }),
        seedCard(2, { title: '다른 보관 카드', status: 'done', archivedAt }),
      ],
      [seedEntry(1, 1, { statusAtTime: 'done' }), seedEntry(2, 1, { statusAtTime: 'done' })],
    )
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await goTo(page, '보관함')
      const rows = page.locator('.archive-row')
      await expect(rows).toHaveCount(2)
      await page.locator('.archive-row', { hasText: '보관된 카드' }).locator('.archive-row__open').click()

      await expect(dialog(page)).toBeVisible()
      await expect(dialog(page).locator('.card-dialog__title')).toHaveText('보관한 카드')
      const foot = dialog(page).locator('.card-dialog__foot')
      await expect(foot.getByRole('button')).toHaveText(['삭제', '닫기'])
      await expect(foot.getByRole('button', { name: '저장', exact: true })).toHaveCount(0)
      await expect(dialog(page).getByRole('button', { name: '보관 해제' })).toHaveCount(0)
      await expect(dialog(page).locator('input, textarea, select')).toHaveCount(0)
      await expect(dialog(page).getByRole('button', { name: '기록 추가' })).toHaveCount(0)
      await expect(progressItems(page)).toHaveCount(2)

      await foot.getByRole('button', { name: '삭제', exact: true }).click()
      const confirm = dialog(page).getByRole('group', { name: '삭제 확인' })
      await expect(confirm.locator('.card-dialog__confirm-text')).toHaveText(
        '이 카드와 진행 기록 2건이 삭제됩니다. 되돌릴 수 없습니다.',
      )
      await confirm.getByRole('button', { name: '취소', exact: true }).click()
      await expect(confirm).toHaveCount(0)
      await expect(dialog(page).locator('.card-dialog__foot').getByRole('button')).toHaveText(['삭제', '닫기'])
      expect((await readDoc(userDataDir)).cards).toHaveLength(2) // 취소로는 아무것도 지워지지 않았다

      await dialog(page).getByRole('button', { name: '삭제', exact: true }).click()
      await dialog(page).getByRole('button', { name: '삭제 확인', exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await expect(rows).toHaveCount(1)
      await expect(page.locator('.archive-row__title')).toHaveText(['다른 보관 카드'])
      const doc = await readDoc(userDataDir)
      expect(doc.cards.map((card) => card.id)).toEqual([cardId(2)])
      expect(doc.progressEntries).toHaveLength(0)
    })
  })

  test('TC-151 대화상자에서 삭제 확인 뒤 저장에 실패하면 대화상자와 확인 줄이 남고 카드는 그대로다', async () => {
    const json = seedJson([seedCard(1, { title: '안 지워지는 카드' })], [seedEntry(1, 1)])
    const dir = await makeTempDir()
    // 준비: 직전본 복사(backup) 단계가 실패하도록 `.bak` 이름의 폴더를 만든다. 앱에는 시험 전용 분기가 없다.
    const backupAsFolder = join(dir, `${DATA_FILE_NAME}.bak`)
    await mkdir(backupAsFolder, { recursive: true })
    expect((await stat(backupAsFolder)).isDirectory()).toBe(true)
    const launched = await launchApp({ userDataDir: dir, seedJson: json })
    try {
      const { page } = launched
      await waitForBoard(page)
      const before = await readDataFile(dir)

      await openCardDialog(page, '안 지워지는 카드')
      await dialog(page).getByRole('button', { name: '삭제', exact: true }).click()
      await dialog(page).getByRole('button', { name: '삭제 확인', exact: true }).click()

      const alert = dialog(page).locator('.card-dialog__alert')
      await expect(alert).toBeVisible()
      expect(((await alert.textContent()) ?? '').trim().startsWith('저장하지 못했습니다')).toBe(true)
      await expect(dialog(page)).toBeVisible()
      const confirm = dialog(page).getByRole('group', { name: '삭제 확인' })
      await expect(confirm.locator('.card-dialog__confirm-text')).toHaveText(
        '이 카드와 진행 기록 1건이 삭제됩니다. 되돌릴 수 없습니다.',
      )
      expect(await readDataFile(dir)).toBe(before) // 준비 조건: 쓰기가 정말 실패해 저장 파일은 그대로다

      await dialog(page).locator('.card-dialog__head').getByRole('button', { name: '닫기' }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(boardCard(page, '안 지워지는 카드')).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText('저장하지 못함')
    } finally {
      await closeApp(launched)
      await removeDir(dir)
    }
  })
})
