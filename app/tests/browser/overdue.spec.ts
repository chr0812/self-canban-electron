// 마감 지남 표시의 실제 Electron 확인 (SCR-001, FR-012, NFR-004).
// 앱 시계를 바꾸는 코드가 없으므로 실행하는 날의 실제 날짜에서 마감일을 계산해 구동 전 저장 파일에 심는다 (07-test-plan.md 시험 데이터).

import { expect, test } from '@playwright/test'
import { withApp } from './support/launch-app'
import {
  boardCard,
  column,
  daysFromToday,
  moveViaMenu,
  saveIndicator,
  seedCard,
  seedJson,
  waitForBoard,
} from './support/board-page'

const SUMMARY = '.overdue-summary'

test.describe('overdue', () => {
  test('TC-102 마감일이 지난 미완료 카드는 보드에서 구분되어 보인다', async () => {
    const json = seedJson([
      seedCard(1, { title: '어제 마감', dueDate: daysFromToday(-1), status: 'todo' }),
      seedCard(2, { title: '내일 마감', dueDate: daysFromToday(1), status: 'todo' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      const late = boardCard(page, '어제 마감')
      const ok = boardCard(page, '내일 마감')

      // 색 외 구분(NFR-004): 삼각형 아이콘 + '1일 지남' 글자.
      await expect(late).toHaveAttribute('data-overdue', 'true')
      await expect(late.locator('.due-text--overdue')).toContainText('1일 지남')
      await expect(late.locator('.due-text--overdue svg')).toHaveCount(1)
      await expect(late).toContainText('1일 지남')
      // 정보 줄 요약.
      await expect(page.locator(SUMMARY)).toHaveText('마감 지난 카드 1건')
      await expect(page.locator(SUMMARY)).toHaveCount(1)

      // 내일 마감 카드에는 이 표시가 없다.
      await expect(ok).not.toHaveAttribute('data-overdue', 'true')
      await expect(ok.locator('.due-text--overdue')).toHaveCount(0)
      await expect(ok.locator('svg[aria-label="마감 지남"], .due-text svg')).toHaveCount(0)
      await expect(ok).not.toContainText('일 지남')
    })
  })

  test('TC-103 마감일이 오늘인 카드는 마감 지남으로 구분되지 않는다', async () => {
    const json = seedJson([seedCard(1, { title: '오늘 마감', dueDate: daysFromToday(0), status: 'todo' })])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      const card = boardCard(page, '오늘 마감')
      await expect(card).toHaveCount(1)
      await expect(card.locator('.due-text')).toHaveCount(1) // 마감일은 보이되
      await expect(card).not.toHaveAttribute('data-overdue', 'true')
      await expect(card.locator('.due-text--overdue')).toHaveCount(0)
      await expect(card.locator('.due-text svg')).toHaveCount(0)
      await expect(card).not.toContainText('일 지남')
      await expect(page.locator(SUMMARY)).toHaveCount(0)
      await expect(page.getByText('마감 지난 카드')).toHaveCount(0)
    })
  })

  test('TC-104 완료 카드는 마감일이 지나도 구분되지 않고, 완료로 옮기면 표시가 사라진다', async () => {
    const json = seedJson([
      seedCard(1, { title: '완료된 지난 카드', dueDate: daysFromToday(-1), status: 'done' }),
      seedCard(2, { title: '미완료 지난 카드', dueDate: daysFromToday(-1), status: 'todo' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      const done = boardCard(page, '완료된 지난 카드')
      const todo = boardCard(page, '미완료 지난 카드')

      // 처음부터: 완료 카드는 표시가 없고, 할 일 카드만 있다.
      await expect(done).not.toHaveAttribute('data-overdue', 'true')
      await expect(done.locator('.due-text--overdue')).toHaveCount(0)
      await expect(done).not.toContainText('일 지남')
      await expect(todo).toHaveAttribute('data-overdue', 'true')
      await expect(todo.locator('.due-text--overdue')).toContainText('1일 지남')
      await expect(page.locator(SUMMARY)).toHaveText('마감 지난 카드 1건')

      // 완료로 옮긴 뒤(저장이 끝난 뒤): 표시와 요약이 사라진다.
      await moveViaMenu(page, '미완료 지난 카드', '완료로 옮기기')
      await expect(column(page, 'done').locator('.card-item', { hasText: '미완료 지난 카드' })).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await expect(todo).not.toHaveAttribute('data-overdue', 'true')
      await expect(todo.locator('.due-text--overdue')).toHaveCount(0)
      await expect(todo).not.toContainText('일 지남')
      await expect(page.locator(SUMMARY)).toHaveCount(0)
      await expect(page.getByText('마감 지난 카드')).toHaveCount(0)
    })
  })
})
