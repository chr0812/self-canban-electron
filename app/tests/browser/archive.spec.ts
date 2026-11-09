// 보관·보관함의 실제 Electron 확인 (SCR-001 보관, SCR-004 보관함, FR-010 / FR-011 / FR-013).
// 데이터는 구동 전에 임시 폴더의 저장 파일로 심는다. 앱 시계나 시험 전용 분기를 쓰지 않는다 (ADR-012).

import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { readDataFile, withApp } from './support/launch-app'
import {
  boardCard,
  cardId,
  daysFromToday,
  dialog,
  openCardDialog,
  readDoc,
  saveIndicator,
  seedCard,
  seedEntry,
  seedJson,
  waitForBoard,
  withPersistentDir,
} from './support/board-page'

const ARCHIVED_AT = '2026-11-02T09:00:00.000Z'
const DELETE_CONFIRM_TEXT = '이 카드와 진행 기록이 삭제됩니다. 되돌릴 수 없습니다.'

function goTo(page: Page, name: '보드' | '캘린더' | '보관함'): Promise<void> {
  return page.locator('.sidebar-nav__item', { hasText: name }).click()
}

/** 사이드바 이동 항목 오른쪽의 건수 글자. */
function navCount(page: Page, name: '보드' | '보관함'): Locator {
  return page.locator('.sidebar-nav__item', { hasText: name }).locator('.sidebar-nav__count')
}

function searchBox(page: Page): Locator {
  return page.locator('.top-bar__search').getByRole('textbox', { name: '검색' })
}

function archiveRowById(page: Page, n: number): Locator {
  return page.locator(`li.archive-row[data-card-id="${cardId(n)}"]`)
}

function archivedCard(n: number, title: string, overrides = {}) {
  return seedCard(n, { title, status: 'done', archivedAt: ARCHIVED_AT, ...overrides })
}

test.describe('archive', () => {
  test('TC-091 완료 카드를 보관하면 보드에서 사라지고 보관함 건수가 늘어난다', async () => {
    const json = seedJson([seedCard(1, { title: '끝난 카드', status: 'done' })])
    await withApp({ seedJson: json }, async ({ page, userDataDir }) => {
      await waitForBoard(page)
      await expect(boardCard(page, '끝난 카드')).toHaveCount(1)
      await expect(navCount(page, '보관함')).toHaveText('0')

      const card = boardCard(page, '끝난 카드')
      await card.getByRole('button', { name: '보관', exact: true }).click()
      await card.getByRole('button', { name: '보관 확인', exact: true }).click()

      // 저장이 끝난 뒤에야 카드가 사라진다.
      await expect(boardCard(page, '끝난 카드')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await expect(navCount(page, '보관함')).toHaveText('1')
      await expect(navCount(page, '보드')).toHaveText('0')
      const saved = (await readDoc(userDataDir)).cards[0]
      expect(saved?.title).toBe('끝난 카드')
      expect(saved?.archivedAt).not.toBeNull()
    })
  })

  test('TC-092 완료가 아닌 카드에는 보관 조작이 없다', async () => {
    const json = seedJson([
      seedCard(1, { title: '할 일 카드', status: 'todo' }),
      seedCard(2, { title: '진행 중 카드', status: 'in_progress' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(2)
      // 보드 카드에는 `보관`도 `보관 확인`도 없다.
      await expect(page.locator('.board-columns').getByRole('button', { name: /보관/ })).toHaveCount(0)

      for (const title of ['할 일 카드', '진행 중 카드']) {
        await openCardDialog(page, title)
        // 시험이 헛돌지 않도록 하단 버튼 줄이 실제로 그려졌는지 먼저 확인한다.
        await expect(dialog(page).locator('.card-dialog__foot').getByRole('button')).toHaveText([
          '삭제',
          '취소',
          '저장',
        ])
        await expect(dialog(page).getByRole('button', { name: /보관/ })).toHaveCount(0)
        await dialog(page).getByRole('button', { name: '취소', exact: true }).click()
        await expect(dialog(page)).toHaveCount(0)
      }
    })
  })

  test('TC-093 보관한 카드는 보관함 목록에서 찾아 내용을 볼 수 있고 수정할 수 없다', async () => {
    const due = daysFromToday(-5)
    const json = seedJson([archivedCard(1, '보관된 보고서', { dueDate: due, description: '분기 마감 정리 내용' })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expect(boardCard(page, '보관된 보고서')).toHaveCount(0)
      await goTo(page, '보관함')

      const rows = page.locator('.archive-row')
      await expect(rows).toHaveCount(1)
      await expect(page.locator('.archive-row__title')).toHaveText(['보관된 보고서'])
      await rows.first().locator('.archive-row__open').click()

      const box = dialog(page)
      await expect(box).toBeVisible()
      await expect(box.locator('.card-dialog__title')).toHaveText('보관한 카드')
      await expect(box).toContainText('보관된 보고서')
      await expect(box).toContainText(due)
      await expect(box).toContainText('분기 마감 정리 내용')
      // 저장·기록 입력이 없고, 값은 입력칸이 아니라 읽기 전용 글자다.
      await expect(box.getByRole('button', { name: '저장', exact: true })).toHaveCount(0)
      await expect(box.getByRole('textbox')).toHaveCount(0)
      await expect(box.locator('input, textarea, select')).toHaveCount(0)
      await expect(box.getByRole('button', { name: '기록 추가', exact: true })).toHaveCount(0)
      await expect(box.locator('.card-dialog__foot').getByRole('button')).toHaveText(['삭제', '닫기'])
    })
  })

  test('TC-094 보관함에서 검색하면 보관한 카드가 결과에 나온다', async () => {
    const json = seedJson([archivedCard(1, '분기 보고서'), archivedCard(2, '장보기')])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await goTo(page, '보관함')
      await expect(page.locator('.archive-row__title')).toHaveCount(2)

      await searchBox(page).fill('보고서')
      await expect(page.locator('.archive-row__title')).toHaveText(['분기 보고서'])
      await expect(page.locator('.archive-row', { hasText: '장보기' })).toHaveCount(0)
      await expect(page.locator('.condition-chip')).toHaveText(/검색: 보고서/)
    })
  })

  test('TC-148 보관함 행의 삭제를 누르면 삭제 확인 줄이 보이고 취소하면 카드가 그대로 남는다', async () => {
    const json = seedJson(
      [
        archivedCard(1, '기록 있는 보관 카드'),
        archivedCard(2, '다른 보관 카드', { archivedAt: '2026-11-01T09:00:00.000Z' }),
      ],
      [seedEntry(1, 1, { statusAtTime: 'done' }), seedEntry(2, 1, { statusAtTime: 'done' })],
    )
    await withPersistentDir(json, async ({ dir, launch, close }) => {
      const first = await launch()
      const page = first.page
      await goTo(page, '보관함')
      await expect(page.locator('li.archive-row')).toHaveCount(2)
      await expect(navCount(page, '보관함')).toHaveText('2')
      const before = await readDataFile(dir)

      const row = archiveRowById(page, 1)
      await expect(row).toContainText('기록 있는 보관 카드')
      await row.getByRole('button', { name: '삭제', exact: true }).click()

      // 같은 행이 확인 줄로 바뀐다: 문구 + `취소` + `삭제 확인`. 보기 전용 대화상자는 열리지 않는다.
      const confirm = row.getByRole('group', { name: '삭제 확인' })
      await expect(confirm).toBeVisible()
      await expect(confirm.locator('.archive-row__confirm-text')).toHaveText(DELETE_CONFIRM_TEXT)
      await expect(confirm.getByRole('button')).toHaveText(['취소', '삭제 확인'])
      await expect(dialog(page)).toHaveCount(0)
      await expect(page.locator('li.archive-row')).toHaveCount(2) // 카드는 목록에 있다
      await expect(navCount(page, '보관함')).toHaveText('2')

      await confirm.getByRole('button', { name: '취소', exact: true }).click()
      await expect(confirm).toHaveCount(0)
      await expect(row.locator('.archive-row__title')).toHaveText('기록 있는 보관 카드')
      await expect(row.getByRole('button', { name: '삭제', exact: true })).toBeVisible()
      await expect(dialog(page)).toHaveCount(0)
      await expect(navCount(page, '보관함')).toHaveText('2')
      expect(await readDataFile(dir)).toBe(before) // 취소는 저장 요청을 보내지 않는다
      await close(first)

      const second = await launch()
      await goTo(second.page, '보관함')
      await expect(second.page.locator('li.archive-row')).toHaveCount(2)
      await expect(archiveRowById(second.page, 1).locator('.archive-row__title')).toHaveText('기록 있는 보관 카드')
      await close(second)
      const doc = await readDoc(dir)
      expect(doc.cards.map((card) => card.id).sort()).toEqual([cardId(1), cardId(2)])
      expect(doc.progressEntries).toHaveLength(2)
    })
  })

  test('TC-149 보관함에서 삭제를 확인하면 카드가 사라지고 앱을 다시 열어도 나타나지 않으며 진행 기록도 함께 사라진다', async () => {
    const json = seedJson(
      [
        archivedCard(1, '보관 카드 A'),
        archivedCard(2, '보관 카드 B', { archivedAt: '2026-11-01T09:00:00.000Z' }),
        seedCard(3, { title: '보드 카드 C', status: 'in_progress' }),
      ],
      [
        seedEntry(1, 1, { statusAtTime: 'done' }),
        seedEntry(2, 1, { statusAtTime: 'done' }),
        seedEntry(3, 2, { statusAtTime: 'done' }),
        seedEntry(4, 3, { statusAtTime: 'in_progress' }),
      ],
    )
    await withPersistentDir(json, async ({ dir, launch, close }) => {
      const first = await launch()
      const page = first.page
      await goTo(page, '보관함')
      await expect(page.locator('li.archive-row')).toHaveCount(2)
      await expect(navCount(page, '보관함')).toHaveText('2')
      await expect(page.locator('.app-shell__statusbar')).toHaveText('보관함 2건')

      const row = archiveRowById(page, 1)
      await row.getByRole('button', { name: '삭제', exact: true }).click()
      await row.getByRole('button', { name: '삭제 확인', exact: true }).click()

      // 저장이 끝난 뒤 행이 사라지고 두 건수가 1 준다. B 는 남는다.
      await expect(archiveRowById(page, 1)).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await expect(navCount(page, '보관함')).toHaveText('1')
      await expect(page.locator('.app-shell__statusbar')).toHaveText('보관함 1건')
      await expect(page.locator('.archive-row__title')).toHaveText(['보관 카드 B'])
      await close(first)

      const doc = await readDoc(dir)
      expect(doc.cards.some((card) => card.id === cardId(1))).toBe(false)
      expect(doc.progressEntries.filter((entry) => entry.cardId === cardId(1))).toHaveLength(0)
      expect(doc.cards.some((card) => card.id === cardId(2))).toBe(true)
      expect(doc.progressEntries.filter((entry) => entry.cardId === cardId(2))).toHaveLength(1)
      expect(doc.cards.some((card) => card.id === cardId(3))).toBe(true)
      expect(doc.progressEntries.filter((entry) => entry.cardId === cardId(3))).toHaveLength(1)

      const second = await launch()
      await goTo(second.page, '보관함')
      await expect(second.page.locator('.archive-row__title')).toHaveText(['보관 카드 B'])
      await expect(second.page.locator('.archive-row', { hasText: '보관 카드 A' })).toHaveCount(0)
      await close(second)
    })
  })
})
