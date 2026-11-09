// 검색·종류/우선순위 조건·결과 없음의 실제 Electron 확인 (SCR-001, SCR-004, FR-013).
// 데이터는 구동 전에 임시 폴더의 저장 파일로 심는다. 앱 시계나 시험 전용 분기를 쓰지 않는다 (ADR-012).

import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { withApp } from './support/launch-app'
import { column, seedCard, seedJson, waitForBoard } from './support/board-page'

function searchBox(page: Page): Locator {
  return page.locator('.top-bar__search').getByRole('textbox', { name: '검색' })
}

function kindRow(page: Page, label: '개발 버그' | '할 일'): Locator {
  return page.getByRole('radiogroup', { name: '종류' }).getByRole('radio', { name: new RegExp(`^${label}`) })
}

/** 종류 또는 우선순위 목록 맨 위의 `전체` 행. */
function allRow(page: Page, group: '종류' | '우선순위'): Locator {
  return page.getByRole('radiogroup', { name: group }).getByRole('radio', { name: /^전체/ })
}

function priorityRow(page: Page, label: '높음' | '중간' | '낮음'): Locator {
  return page.getByRole('radiogroup', { name: '우선순위' }).getByRole('radio', { name: new RegExp(`^${label}`) })
}

type FilterRowState = { label: string; checked: boolean; count: number }

/** 사이드바 목록의 행을 위에서 아래 순서로 읽는다: 이름, 선택 상태(aria-checked), 건수. */
async function readFilter(page: Page, group: '종류' | '우선순위'): Promise<FilterRowState[]> {
  const rows = page.getByRole('radiogroup', { name: group }).getByRole('radio')
  return rows.evaluateAll((elements) =>
    elements.map((element) => {
      const row = element as unknown as {
        getAttribute: (name: string) => string | null
        querySelector: (selector: string) => { textContent: string | null } | null
      }
      return {
        label: (row.querySelector('.radio-row__label')?.textContent ?? '').trim(),
        checked: row.getAttribute('aria-checked') === 'true',
        count: Number((row.querySelector('.radio-row__count')?.textContent ?? '').trim()),
      }
    }),
  )
}

/** 보드에 보이는 카드 제목(정렬해서 돌려준다: 칸 안 순서에 기대지 않는다). */
async function shownTitles(page: Page): Promise<string[]> {
  return (await page.locator('.card-item__title').allTextContents()).sort()
}

async function expectTitles(page: Page, expected: string[]): Promise<void> {
  await expect.poll(() => shownTitles(page)).toEqual([...expected].sort())
}

async function shownKinds(page: Page): Promise<string[]> {
  return (await page.locator('.card-item .chip[data-kind]').allTextContents()).sort()
}

test.describe('search-filter', () => {
  test('TC-105 검색어를 입력하면 제목에 그 글자가 든 카드만 보인다', async () => {
    const json = seedJson([
      seedCard(1, { title: '세금 신고서' }),
      seedCard(2, { title: 'Tax Return' }),
      seedCard(3, { title: '영수증' }),
      seedCard(4, { title: '기타', description: '세금 환급 관련 메모' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expectTitles(page, ['세금 신고서', 'Tax Return', '영수증', '기타'])

      await searchBox(page).fill('세금')
      await expectTitles(page, ['세금 신고서']) // 설명에만 '세금'이 든 '기타'는 나오지 않는다

      await searchBox(page).fill('tax')
      await expectTitles(page, ['Tax Return'])

      await searchBox(page).fill('')
      await expectTitles(page, ['세금 신고서', 'Tax Return', '영수증', '기타'])
      await expect(page.locator('.condition-bar')).toHaveCount(0)
    })
  })

  test('TC-106 종류 조건을 고르면 그 종류의 카드만 보이고 `전체`를 고르면 모두 돌아온다', async () => {
    const json = seedJson([
      seedCard(1, { title: '버그 하나', kind: 'bug' }),
      seedCard(2, { title: '버그 둘', kind: 'bug' }),
      seedCard(3, { title: '일 하나', kind: 'task' }),
      seedCard(4, { title: '일 둘', kind: 'task' }),
      seedCard(5, { title: '일 셋', kind: 'task' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(5)
      await expect(column(page, 'todo').locator('.column__count')).toHaveText('5')
      await expect(allRow(page, '종류')).toHaveAttribute('aria-checked', 'true') // 처음에는 `전체`가 선택되어 있다

      await kindRow(page, '개발 버그').click()
      await expect(kindRow(page, '개발 버그')).toHaveAttribute('aria-checked', 'true')
      await expectTitles(page, ['버그 하나', '버그 둘'])
      expect(await shownKinds(page)).toEqual(['개발 버그', '개발 버그'])
      await expect(column(page, 'todo').locator('.column__count')).toHaveText('2 / 5')

      await expect(allRow(page, '종류')).toHaveAttribute('aria-checked', 'false')

      // 해제는 `전체` 행을 고르는 것이다 (선택된 행을 다시 눌러도 해제되지 않는다).
      await allRow(page, '종류').click()
      await expect(allRow(page, '종류')).toHaveAttribute('aria-checked', 'true')
      await expect(kindRow(page, '개발 버그')).toHaveAttribute('aria-checked', 'false')
      await expect(page.locator('.card-item')).toHaveCount(5)
      await expect(column(page, 'todo').locator('.column__count')).toHaveText('5')
      await expect(page.locator('.condition-chip')).toHaveCount(0)
    })
  })

  test('TC-107 우선순위와 종류를 함께 고르면 둘 다 만족하는 카드만 보이고 조건을 지우면 전부 보인다', async () => {
    const json = seedJson([
      seedCard(1, { title: '버그 높음', kind: 'bug', priority: 'high' }),
      seedCard(2, { title: '버그 낮음', kind: 'bug', priority: 'low' }),
      seedCard(3, { title: '일 높음', kind: 'task', priority: 'high' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(3)

      await priorityRow(page, '높음').click()
      await expectTitles(page, ['버그 높음', '일 높음'])

      await kindRow(page, '개발 버그').click()
      await expectTitles(page, ['버그 높음'])
      await expect(page.locator('.condition-chip')).toHaveText([/종류: 개발 버그/, /우선순위: 높음/])

      // 조건 칩의 ×(`우선순위 조건 지우기`)로 우선순위만 해제한다.
      await page.getByRole('button', { name: '우선순위 조건 지우기' }).click()
      await expectTitles(page, ['버그 높음', '버그 낮음'])
      await expect(page.locator('.condition-chip')).toHaveText([/종류: 개발 버그/])
      // 우선순위 목록의 선택이 `전체`로 돌아온다.
      await expect(allRow(page, '우선순위')).toHaveAttribute('aria-checked', 'true')
      await expect(priorityRow(page, '높음')).toHaveAttribute('aria-checked', 'false')

      await page.getByRole('button', { name: '조건 모두 지우기' }).click()
      await expectTitles(page, ['버그 높음', '버그 낮음', '일 높음'])
      await expect(page.locator('.condition-bar')).toHaveCount(0)
      // 종류·우선순위 목록 모두 `전체`가 선택되어 있다.
      await expect(allRow(page, '종류')).toHaveAttribute('aria-checked', 'true')
      await expect(allRow(page, '우선순위')).toHaveAttribute('aria-checked', 'true')
      await expect(kindRow(page, '개발 버그')).toHaveAttribute('aria-checked', 'false')
      await expect(priorityRow(page, '높음')).toHaveAttribute('aria-checked', 'false')
    })
  })

  test('TC-108 조건에 맞는 카드가 없으면 맞는 카드가 없다는 표시와 적용 중인 조건이 보인다', async () => {
    const json = seedJson([
      seedCard(1, { title: '카드 하나' }),
      seedCard(2, { title: '카드 둘' }),
      seedCard(3, { title: '카드 셋' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(3)

      await searchBox(page).fill('없는검색어')
      await expect(page.locator('.card-item')).toHaveCount(0)
      await expect(page.getByText('조건에 맞는 카드가 없습니다', { exact: false })).toBeVisible()
      await expect(page.locator('.condition-chip')).toHaveText(/검색: 없는검색어/)
      await expect(page.getByRole('button', { name: '조건 모두 지우기' })).toBeVisible()
      await expect(page.locator('.condition-bar__count')).toHaveText('결과 0건 / 전체 3건')
    })
  })

  test('TC-109 보드의 검색 결과에는 보관한 카드가 나오지 않는다', async () => {
    const json = seedJson([
      seedCard(1, {
        title: '분기 보고서',
        status: 'done',
        archivedAt: '2026-11-02T09:00:00.000Z',
      }),
      seedCard(2, { title: '분기 계획' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await searchBox(page).fill('분기')

      await expectTitles(page, ['분기 계획'])
      await expect(page.locator('.card-item', { hasText: '분기 보고서' })).toHaveCount(0)
      await expect(page.locator('.condition-bar__count')).toHaveText('결과 1건 / 전체 1건')
    })
  })

  test('TC-174 사이드바의 종류와 우선순위 목록은 `전체`가 처음 선택이고 우선순위 목록은 전체, 낮음, 중간, 높음 순서다', async () => {
    const json = seedJson([
      seedCard(1, { title: '버그 높음', kind: 'bug', priority: 'high' }),
      seedCard(2, { title: '버그 중간', kind: 'bug', priority: 'medium' }),
      seedCard(3, { title: '일 낮음', kind: 'task', priority: 'low' }),
      seedCard(4, { title: '일 높음', kind: 'task', priority: 'high' }),
      seedCard(5, { title: '일 없음', kind: 'task', priority: null }),
      seedCard(6, {
        title: '보관 일 낮음',
        kind: 'task',
        priority: 'low',
        status: 'done',
        archivedAt: '2026-11-02T09:00:00.000Z',
      }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(5)

      // 보드: 위에서 아래 순서, 선택 상태, 건수 (보관 카드는 세지 않는다).
      expect(await readFilter(page, '종류')).toEqual([
        { label: '전체', checked: true, count: 5 },
        { label: '개발 버그', checked: false, count: 2 },
        { label: '할 일', checked: false, count: 3 },
      ])
      expect(await readFilter(page, '우선순위')).toEqual([
        { label: '전체', checked: true, count: 5 },
        { label: '낮음', checked: false, count: 1 },
        { label: '중간', checked: false, count: 1 },
        { label: '높음', checked: false, count: 2 },
      ])
      await expect(page.locator('.condition-chip')).toHaveCount(0)

      // 보관함에서도 두 목록의 `전체`가 처음 선택이고 `전체`의 건수는 1이다.
      await page.locator('.sidebar-nav__item', { hasText: '보관함' }).click()
      await expect(page.locator('.archive-row')).toHaveCount(1)
      const archiveKinds = await readFilter(page, '종류')
      const archivePriorities = await readFilter(page, '우선순위')
      expect(archiveKinds.map((row) => row.label)).toEqual(['전체', '개발 버그', '할 일'])
      expect(archivePriorities.map((row) => row.label)).toEqual(['전체', '낮음', '중간', '높음'])
      expect(archiveKinds.map((row) => row.checked)).toEqual([true, false, false])
      expect(archivePriorities.map((row) => row.checked)).toEqual([true, false, false, false])
      expect(archiveKinds[0]?.count).toBe(1)
      expect(archivePriorities[0]?.count).toBe(1)
      await expect(page.locator('.condition-chip')).toHaveCount(0)
    })
  })

  test('TC-175 필터 항목은 하나만 선택되고 `전체`로 풀리며 선택된 항목을 다시 눌러도 풀리지 않는다', async () => {
    const json = seedJson([
      seedCard(1, { title: '버그 높음', kind: 'bug', priority: 'high' }),
      seedCard(2, { title: '버그 낮음', kind: 'bug', priority: 'low' }),
      seedCard(3, { title: '일 높음', kind: 'task', priority: 'high' }),
      seedCard(4, { title: '일 중간', kind: 'task', priority: 'medium' }),
      seedCard(5, { title: '일 없음', kind: 'task', priority: null }),
      // 보관함 쪽 확인용 (보드의 건수와 결과에는 영향이 없다).
      seedCard(6, { title: '보관 버그', kind: 'bug', status: 'done', archivedAt: '2026-11-02T09:00:00.000Z' }),
      seedCard(7, { title: '보관 일', kind: 'task', status: 'done', archivedAt: '2026-11-02T09:00:00.000Z' }),
    ])
    await withApp({ seedJson: json }, async ({ page }) => {
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(5)

      /** 두 목록의 선택된 행 이름, 조건 칩, 보이는 카드, `전체` 행의 건수를 한꺼번에 본다. */
      const snapshot = async (): Promise<{
        kind: string[]
        priority: string[]
        chips: string[]
        titles: string[]
        allCounts: number[]
      }> => {
        const kinds = await readFilter(page, '종류')
        const priorities = await readFilter(page, '우선순위')
        return {
          kind: kinds.filter((row) => row.checked).map((row) => row.label),
          priority: priorities.filter((row) => row.checked).map((row) => row.label),
          chips: (await page.locator('.condition-chip').allTextContents()).map((text) => text.replace(/\s+/g, ' ').trim()),
          titles: await shownTitles(page),
          allCounts: [kinds[0]?.count ?? -1, priorities[0]?.count ?? -1],
        }
      }
      const expectChips = async (...parts: RegExp[]): Promise<void> => {
        const chips = page.locator('.condition-chip')
        await expect(chips).toHaveCount(parts.length)
        for (const [index, part] of parts.entries()) await expect(chips.nth(index)).toHaveText(part)
      }

      // (1) 종류 `개발 버그` → `할 일`: 한 목록에서 선택된 행은 하나뿐이다.
      await kindRow(page, '개발 버그').click()
      await expectTitles(page, ['버그 높음', '버그 낮음'])
      let now = await snapshot()
      expect(now.kind).toEqual(['개발 버그']) // `전체`가 풀렸다
      expect(now.allCounts).toEqual([5, 5])

      await kindRow(page, '할 일').click()
      await expectTitles(page, ['일 높음', '일 중간', '일 없음'])
      now = await snapshot()
      expect(now.kind).toEqual(['할 일']) // `개발 버그`가 풀렸다
      expect(now.priority).toEqual(['전체'])
      expect(now.allCounts).toEqual([5, 5])
      await expectChips(/종류: 할 일/)
      const afterFirst = now

      // (2) 선택된 `할 일` 행을 다시 누르면 그대로다.
      await kindRow(page, '할 일').click()
      await page.waitForTimeout(300)
      expect(await snapshot()).toEqual(afterFirst)

      // (3) 우선순위 `높음` (종류 `할 일`이 걸린 채): 두 조건을 모두 만족하는 1건.
      await priorityRow(page, '높음').click()
      await expectTitles(page, ['일 높음'])
      now = await snapshot()
      expect(now.kind).toEqual(['할 일'])
      expect(now.priority).toEqual(['높음'])
      expect(now.allCounts).toEqual([5, 5])
      await expectChips(/종류: 할 일/, /우선순위: 높음/)

      // (4) 종류 목록의 `전체`: 종류 조건만 풀리고 우선순위 `높음`만 걸린다.
      await allRow(page, '종류').click()
      await expectTitles(page, ['버그 높음', '일 높음'])
      now = await snapshot()
      expect(now.kind).toEqual(['전체'])
      expect(now.priority).toEqual(['높음'])
      expect(now.allCounts).toEqual([5, 5])
      await expectChips(/우선순위: 높음/)
      await expect(page.locator('.condition-chip', { hasText: '종류' })).toHaveCount(0)
      const afterFourth = now

      // (5) 우선순위 `높음` 행을 다시 눌러도 그대로다.
      await priorityRow(page, '높음').click()
      await page.waitForTimeout(300)
      expect(await snapshot()).toEqual(afterFourth)

      // (6) 우선순위 `전체`: 5건이 모두 보이고 두 목록 모두 `전체`.
      await allRow(page, '우선순위').click()
      await expectTitles(page, ['버그 높음', '버그 낮음', '일 높음', '일 중간', '일 없음'])
      now = await snapshot()
      expect(now.kind).toEqual(['전체'])
      expect(now.priority).toEqual(['전체'])
      expect(now.chips).toEqual([])
      expect(now.allCounts).toEqual([5, 5])

      // 보관함의 사이드바 필터에서도 같은 동작이다 (선택, 다시 눌러도 유지, `전체`로 풀기).
      await page.locator('.sidebar-nav__item', { hasText: '보관함' }).click()
      const archiveTitles = async (): Promise<string[]> => (await page.locator('.archive-row__title').allTextContents()).sort()
      await expect.poll(archiveTitles).toEqual(['보관 버그', '보관 일'])
      expect((await readFilter(page, '종류')).filter((row) => row.checked).map((row) => row.label)).toEqual(['전체'])

      await kindRow(page, '개발 버그').click()
      await expect.poll(archiveTitles).toEqual(['보관 버그'])
      expect((await readFilter(page, '종류')).filter((row) => row.checked).map((row) => row.label)).toEqual(['개발 버그'])

      await kindRow(page, '개발 버그').click() // 다시 눌러도 유지
      await page.waitForTimeout(300)
      expect(await archiveTitles()).toEqual(['보관 버그'])
      expect((await readFilter(page, '종류')).filter((row) => row.checked).map((row) => row.label)).toEqual(['개발 버그'])

      await allRow(page, '종류').click()
      await expect.poll(archiveTitles).toEqual(['보관 버그', '보관 일'])
      expect((await readFilter(page, '종류')).filter((row) => row.checked).map((row) => row.label)).toEqual(['전체'])
    })
  })
})
