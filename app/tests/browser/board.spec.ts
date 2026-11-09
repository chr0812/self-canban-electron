// 보드 화면의 실제 Electron 확인 (SCR-001): 카드 만들기, 칸 이동(⋯ 메뉴와 끌어다 놓기), 세 칸, 빈 보드, 종류 구분.
// 데이터는 구동 전에 임시 폴더의 저장 파일로 심는다. 앱 시계나 시험 전용 분기를 쓰지 않는다 (ADR-012).

import { expect, test } from '@playwright/test'
import { withApp } from './support/launch-app'
import {
  boardCard,
  closeDialogWithCancel,
  column,
  createButton,
  createCardViaDialog,
  dialog,
  moveViaMenu,
  openCardDialog,
  openCreateDialog,
  openMoveMenu,
  readDoc,
  saveIndicator,
  seedCard,
  seedJson,
  statusSelect,
  titleInput,
  waitForBoard,
  withPersistentDir,
  clickSave,
} from './support/board-page'

test.describe('board', () => {
  test('TC-067 제목을 입력하고 저장하면 새 카드가 할 일 칸에 나타난다', async () => {
    await withApp({}, async ({ page }) => {
      await waitForBoard(page)
      await createCardViaDialog(page, { title: '세금 신고' })

      await expect(dialog(page)).toHaveCount(0)
      await expect(column(page, 'todo').locator('.card-item', { hasText: '세금 신고' })).toHaveCount(1)
      await expect(column(page, 'in_progress').locator('.card-item')).toHaveCount(0)
      await expect(column(page, 'done').locator('.card-item')).toHaveCount(0)
      await expect(column(page, 'todo').locator('.column__count')).toHaveText('1')
    })
  })

  test('TC-068 제목 없이 저장하면 카드가 만들어지지 않고 제목 칸에 오류 문구가 보인다', async () => {
    await withApp({}, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await openCreateDialog(page)
      await clickSave(page)

      await expect(dialog(page)).toBeVisible()
      await expect(dialog(page).locator('.field__error')).toHaveText('제목을 입력하세요')
      await expect(titleInput(page)).toHaveAttribute('aria-invalid', 'true')

      await dialog(page).getByRole('button', { name: '취소', exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(page.locator('.card-item')).toHaveCount(0)
      await expect(column(page, 'todo').locator('.column__count')).toHaveText('0')
      // 저장 요청이 한 번도 가지 않았다: 처음 실행이라 저장 파일이 아직 없다.
      const { readDataFile } = await import('./support/launch-app')
      expect(await readDataFile(userDataDir)).toBeNull()
    })
  })

  test('TC-070 상태 이동 메뉴로 카드를 다른 칸으로 옮길 수 있다', async () => {
    const json = seedJson([seedCard(1, { title: '이동할 카드', status: 'todo' })])
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await expect(column(page, 'todo').locator('.card-item', { hasText: '이동할 카드' })).toHaveCount(1)

      const items = await openMoveMenu(page, '이동할 카드')
      expect(items).toEqual(['진행 중으로 옮기기', '완료로 옮기기'])
      expect(items).not.toContain('할 일로 옮기기')
      await page.getByRole('menuitem', { name: '진행 중으로 옮기기', exact: true }).click()

      await expect(column(page, 'in_progress').locator('.card-item', { hasText: '이동할 카드' })).toHaveCount(1)
      await expect(column(page, 'todo').locator('.card-item')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      const doc = await readDoc(userDataDir)
      expect(doc.cards.find((card) => card.title === '이동할 카드')?.status).toBe('in_progress')
    })
  })

  test('TC-071 카드를 다른 칸으로 끌어다 놓으면 그 칸으로 옮겨진다', async () => {
    const json = seedJson([seedCard(1, { title: '끌 카드', status: 'todo' })])
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      const card = boardCard(page, '끌 카드')
      await expect(card).toHaveCount(1)
      await expect(card).toHaveAttribute('draggable', 'true')

      await card.dragTo(column(page, 'in_progress').locator('.column__list'))

      await expect(column(page, 'in_progress').locator('.card-item', { hasText: '끌 카드' })).toHaveCount(1)
      await expect(column(page, 'todo').locator('.card-item')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      const doc = await readDoc(userDataDir)
      expect(doc.cards.find((c) => c.title === '끌 카드')?.status).toBe('in_progress')
    })
  })

  test('TC-072 완료 카드를 진행 중이나 할 일로 되돌릴 수 있다', async () => {
    const json = seedJson([seedCard(1, { title: '되돌릴 카드', status: 'done' })])
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await expect(column(page, 'done').locator('.card-item', { hasText: '되돌릴 카드' })).toHaveCount(1)

      await moveViaMenu(page, '되돌릴 카드', '진행 중으로 옮기기')
      await expect(column(page, 'in_progress').locator('.card-item', { hasText: '되돌릴 카드' })).toHaveCount(1)
      await expect(column(page, 'done').locator('.card-item')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      expect((await readDoc(userDataDir)).cards[0]?.status).toBe('in_progress')

      await moveViaMenu(page, '되돌릴 카드', '할 일로 옮기기')
      await expect(column(page, 'todo').locator('.card-item', { hasText: '되돌릴 카드' })).toHaveCount(1)
      await expect(column(page, 'in_progress').locator('.card-item')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      expect((await readDoc(userDataDir)).cards[0]?.status).toBe('todo')
    })
  })

  test('TC-073 상태 선택 목록은 세 값뿐이고 보관은 없다', async () => {
    const json = seedJson([seedCard(1, { title: '상태 카드', status: 'todo' })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await openCardDialog(page, '상태 카드')

      const select = dialog(page).locator('select')
      await expect(select.locator('option')).toHaveText(['할 일', '진행 중', '완료'])
      expect(await select.locator('option').allTextContents()).not.toContain('보관')

      await select.selectOption('done')
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(column(page, 'done').locator('.card-item', { hasText: '상태 카드' })).toHaveCount(1)
      await expect(column(page, 'todo').locator('.card-item')).toHaveCount(0)
    })
  })

  test('TC-163 카드 만들기의 상태 선택은 할 일과 진행 중 두 가지뿐이고 처음 선택은 할 일이며 잠겨 있지 않다', async () => {
    await withApp({}, async ({ page }) => {
      await waitForBoard(page)
      await openCreateDialog(page)

      const select = statusSelect(page)
      await expect(select).toHaveCount(1)
      await expect(select).toHaveValue('todo')
      const selectedText = await select.evaluate(
        (el) => (el as unknown as { selectedOptions: { text: string }[] }).selectedOptions[0]?.text,
      )
      expect(selectedText).toBe('할 일')
      await expect(select.locator('option')).toHaveText(['할 일', '진행 중'])
      const labels = await select.locator('option').allTextContents()
      expect(labels).not.toContain('완료')
      expect(labels).not.toContain('보관')
      await expect(select).toBeEnabled()
      expect(await select.evaluate((el) => (el as unknown as { disabled: boolean }).disabled)).toBe(false)

      // 키보드로 `진행 중`을 고르고 다시 `할 일`을 고른다.
      await select.focus()
      await page.keyboard.press('ArrowDown')
      await expect(select).toHaveValue('in_progress')
      await page.keyboard.press('ArrowUp')
      await expect(select).toHaveValue('todo')
    })
  })

  test('TC-164 상태를 진행 중으로 골라 저장하면 새 카드가 진행 중 칸에 나타난다', async () => {
    await withPersistentDir(undefined, async ({ launch, close }) => {
      const first = await launch()
      const page = first.page
      await createCardViaDialog(page, { title: '진행 카드', status: '진행 중' })
      await createCardViaDialog(page, { title: '대기 카드' })

      const expectColumns = async (target: typeof page): Promise<void> => {
        await expect(column(target, 'in_progress').locator('.card-item', { hasText: '진행 카드' })).toHaveCount(1)
        await expect(column(target, 'todo').locator('.card-item', { hasText: '진행 카드' })).toHaveCount(0)
        await expect(column(target, 'done').locator('.card-item', { hasText: '진행 카드' })).toHaveCount(0)
        await expect(column(target, 'todo').locator('.card-item', { hasText: '대기 카드' })).toHaveCount(1)
        await expect(column(target, 'in_progress').locator('.card-item', { hasText: '대기 카드' })).toHaveCount(0)
        await expect(column(target, 'done').locator('.card-item', { hasText: '대기 카드' })).toHaveCount(0)
        await expect(target.locator('.column__count')).toHaveText(['1', '1', '0'])
      }
      await expectColumns(page)

      // 진행 중 카드를 열어 진행 기록을 본다.
      await openCardDialog(page, '진행 카드')
      await expect(statusSelect(page)).toHaveValue('in_progress')
      await expect(dialog(page).locator('.progress-log__item')).toHaveCount(0)
      await closeDialogWithCancel(page)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')

      await close(first)
      const second = await launch()
      await expectColumns(second.page)
      await close(second)
    })
  })

  test('TC-074 세 칸이 한 화면에 나란히 보이고 각 카드는 자기 칸에만 있다', async () => {
    const json = seedJson([
      seedCard(1, { title: '할일A', status: 'todo' }),
      seedCard(2, { title: '할일B', status: 'todo' }),
      seedCard(3, { title: '진행A', status: 'in_progress' }),
      seedCard(4, { title: '완료A', status: 'done' }),
      seedCard(5, { title: '완료B', status: 'done' }),
      seedCard(6, { title: '완료C', status: 'done' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(6)

      const statuses = ['todo', 'in_progress', 'done'] as const
      const heads = statuses.map((status) => column(page, status).locator('.column__head'))
      const boxes = []
      for (const head of heads) {
        const box = await head.boundingBox()
        expect(box).not.toBeNull()
        boxes.push(box!)
      }
      // 같은 가로줄(세로 위치가 같다), 왼쪽에서 오른쪽 순서.
      expect(boxes[1]!.y).toBeCloseTo(boxes[0]!.y, 0)
      expect(boxes[2]!.y).toBeCloseTo(boxes[0]!.y, 0)
      expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x)
      expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x)
      // 한 화면: 세 칸이 창 안에 모두 들어온다.
      const inner = (await page.evaluate('({ width: window.innerWidth, height: window.innerHeight })')) as {
        width: number
        height: number
      }
      for (const status of statuses) {
        const box = await column(page, status).boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(inner.width + 1)
        expect(box!.y + box!.height).toBeLessThanOrEqual(inner.height + 1)
      }

      await expect(heads[0]!.locator('.column__title')).toHaveText('할 일')
      await expect(heads[1]!.locator('.column__title')).toHaveText('진행 중')
      await expect(heads[2]!.locator('.column__title')).toHaveText('완료')
      await expect(heads[0]!.locator('.column__count')).toHaveText('2')
      await expect(heads[1]!.locator('.column__count')).toHaveText('1')
      await expect(heads[2]!.locator('.column__count')).toHaveText('3')

      // 각 카드는 자기 상태의 칸 영역 안에만 있다.
      const expected: Record<(typeof statuses)[number], string[]> = {
        todo: ['할일A', '할일B'],
        in_progress: ['진행A'],
        done: ['완료A', '완료B', '완료C'],
      }
      for (const status of statuses) {
        const columnBox = (await column(page, status).boundingBox())!
        const cards = column(page, status).locator('.card-item')
        await expect(cards).toHaveCount(expected[status].length)
        const titles = await cards.locator('.card-item__title').allTextContents()
        expect([...titles].sort()).toEqual([...expected[status]].sort())
        for (let i = 0; i < expected[status].length; i += 1) {
          const cardBox = (await cards.nth(i).boundingBox())!
          expect(cardBox.x).toBeGreaterThanOrEqual(columnBox.x)
          expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width + 1)
        }
      }
    })
  })

  test('TC-075 카드가 하나도 없어도 보드가 오류 없이 열린다', async () => {
    await withApp({}, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))

      // 수집을 시작한 뒤 화면을 처음부터 다시 그려 시작 순서 전체를 관찰한다.
      await page.reload()
      await waitForBoard(page)
      await expect(column(page, 'todo').locator('.column__count')).toHaveText('0')

      await expect(page.locator('.column__title')).toHaveText(['할 일', '진행 중', '완료'])
      await expect(page.locator('.column__count')).toHaveText(['0', '0', '0'])
      await expect(column(page, 'todo')).toContainText('카드가 없습니다')
      await expect(page.locator('.card-item')).toHaveCount(0)
      await expect(page.locator('.read-failure')).toHaveCount(0)
      await expect(page.getByText('저장된 데이터를 읽지 못했습니다')).toHaveCount(0)
      await expect(page.getByText('화면을 그리지 못했습니다')).toHaveCount(0)
      expect(consoleErrors).toEqual([])
    })
  })

  test('TC-076 개발 버그와 할 일 카드는 보드에서 구분되어 보인다', async () => {
    await withApp({}, async ({ page }) => {
      await waitForBoard(page)
      await createCardViaDialog(page, { title: '버그 카드', kind: '개발 버그' })
      await createCardViaDialog(page, { title: '일반 카드', kind: '할 일' })

      const bugChip = boardCard(page, '버그 카드').locator('.chip[data-kind]')
      const taskChip = boardCard(page, '일반 카드').locator('.chip[data-kind]')
      await expect(bugChip).toHaveText('개발 버그')
      await expect(taskChip).toHaveText('할 일')
      await expect(bugChip).toHaveAttribute('data-kind', 'bug')
      await expect(taskChip).toHaveAttribute('data-kind', 'task')
    })
  })

  test('TC-077 종류를 고르지 않고 저장하면 할 일로 보인다', async () => {
    await withApp({}, async ({ page }) => {
      await waitForBoard(page)
      await createCardViaDialog(page, { title: '종류 미선택' })

      await expect(boardCard(page, '종류 미선택').locator('.chip[data-kind]')).toHaveText('할 일')
      await openCardDialog(page, '종류 미선택')
      await expect(dialog(page).getByRole('radio', { name: '할 일', exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      await expect(dialog(page).getByRole('radio', { name: '개발 버그', exact: true })).toHaveAttribute(
        'aria-checked',
        'false',
      )
    })
  })

  // 준비 조건: 처음 실행의 보드에서 시작하므로 `카드 만들기`가 상단 막대에 있다.
  test('TC-067 보조 확인: 상단 막대의 카드 만들기 버튼은 하나다', async () => {
    await withApp({}, async ({ page }) => {
      await waitForBoard(page)
      await expect(createButton(page)).toHaveCount(1)
    })
  })
})
