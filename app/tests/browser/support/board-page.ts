// 보드·카드 대화상자·마감 지남 시험이 함께 쓰는 도우미 (T-040). 앱에 시험 전용 코드를 두지 않는다 (ADR-012):
// 데이터는 구동 전에 임시 폴더의 저장 파일로 심고, 화면은 사용자가 누르는 것과 같은 요소로만 조작한다.
// 마감 지남 시험은 앱 시계를 바꾸지 않고 실행하는 날의 실제 날짜에서 마감일을 계산해 넣는다 (07-test-plan.md 시험 데이터).

import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { addDays, todayLocal } from '../../../src/shared/domain/date-rules'
import type { Card, ProgressEntry, Status } from '../../../src/shared/types/card'
import { makeCard, makeDoc, makeEntry } from '../../cli/support/builders'
import { closeApp, launchApp, makeTempDir, readDataFile, removeDir } from './launch-app'
import type { LaunchedApp } from './launch-app'

/** 실행하는 날(PC 현지)의 날짜. 앱의 `todayLocal(new Date())`와 같은 계산이다. */
export function today(): string {
  return todayLocal(new Date())
}

export function daysFromToday(n: number): string {
  return addDays(today(), n)
}

/** 카드 id 를 순번에서 만든다. */
export function cardId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export function entryId(n: number): string {
  return `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`
}

export function seedCard(n: number, overrides: Partial<Card> = {}): Card {
  return makeCard({ id: cardId(n), title: `카드${n}`, ...overrides })
}

export function seedEntry(n: number, forCard: number, overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  return makeEntry({ id: entryId(n), cardId: cardId(forCard), content: `기록${n}`, ...overrides })
}

/** 현재 버전 저장 문서의 JSON. */
export function seedJson(cards: Card[], progressEntries: ProgressEntry[] = []): string {
  return JSON.stringify(makeDoc({ cards, progressEntries }), null, 2)
}

/** 첫 화면(Bootstrap 이 목록을 받고 AppShell 을 그린 뒤)을 기다린다. */
export async function waitForBoard(page: Page): Promise<void> {
  await page.locator('.app-shell').waitFor()
}

export function column(page: Page, status: Status): Locator {
  return page.locator(`section.column[data-status="${status}"]`)
}

export function boardCard(page: Page, title: string): Locator {
  return page.locator('.card-item', { hasText: title })
}

export function dialog(page: Page): Locator {
  return page.locator('dialog.card-dialog')
}

export function createButton(page: Page): Locator {
  return page.locator('.top-bar__create')
}

export function titleInput(page: Page): Locator {
  return dialog(page).getByRole('textbox', { name: /^제목/ })
}

/** 대화상자의 상태 선택 목록. */
export function statusSelect(page: Page): Locator {
  return dialog(page).getByLabel('상태', { exact: true })
}

/** 사이드바 저장 상태 글자. */
export function saveIndicator(page: Page): Locator {
  return page.locator('.sidebar-save')
}

export async function openCreateDialog(page: Page): Promise<void> {
  await createButton(page).click()
  await expect(dialog(page)).toBeVisible()
}

export async function clickSave(page: Page): Promise<void> {
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
}

export type NewCardFields = {
  title: string
  kind?: '개발 버그' | '할 일'
  /** 새 카드의 처음 상태. 생략하면 선택을 건드리지 않는다(처음 선택은 할 일). */
  status?: '할 일' | '진행 중'
  dueDate?: string
  description?: string
  priority?: '없음' | '낮음' | '중간' | '높음'
  memo?: string
}

/** `카드 만들기`로 대화상자를 열어 입력하고 `저장`까지 누른다. 닫히는 것까지 기다린다. */
export async function createCardViaDialog(page: Page, fields: NewCardFields): Promise<void> {
  await openCreateDialog(page)
  await titleInput(page).fill(fields.title)
  const box = dialog(page)
  if (fields.kind !== undefined) await box.getByRole('radio', { name: fields.kind, exact: true }).click()
  if (fields.status !== undefined) await statusSelect(page).selectOption({ label: fields.status })
  if (fields.dueDate !== undefined) await box.getByRole('textbox', { name: /^마감일/ }).fill(fields.dueDate)
  if (fields.priority !== undefined) await box.getByRole('radio', { name: fields.priority, exact: true }).click()
  if (fields.description !== undefined) await box.getByRole('textbox', { name: '상세 설명' }).fill(fields.description)
  if (fields.memo !== undefined) await box.getByRole('textbox', { name: '추가 메모' }).fill(fields.memo)
  await clickSave(page)
  await expect(dialog(page)).toHaveCount(0)
}

/** 카드를 눌러 상세 대화상자를 연다. */
export async function openCardDialog(page: Page, title: string): Promise<void> {
  await boardCard(page, title).locator('.card-item__title').click()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).locator('.card-dialog__title')).toHaveText('카드 상세')
}

export async function closeDialogWithCancel(page: Page): Promise<void> {
  await dialog(page).getByRole('button', { name: '취소', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
}

/** 카드의 `⋯` 메뉴를 열어 항목 글자 목록을 돌려준다 (메뉴는 열린 채로 둔다). */
export async function openMoveMenu(page: Page, title: string): Promise<string[]> {
  await boardCard(page, title).locator('.card-move-btn').click()
  const menu = page.getByRole('menu', { name: '상태 이동' })
  await expect(menu).toBeVisible()
  return menu.getByRole('menuitem').allTextContents()
}

export async function moveViaMenu(page: Page, title: string, itemLabel: string): Promise<void> {
  await openMoveMenu(page, title)
  await page.getByRole('menuitem', { name: itemLabel, exact: true }).click()
}

/** 저장 파일을 읽어 JSON 으로 돌려준다. 없으면 오류. */
export async function readDoc(dir: string): Promise<{ cards: Card[]; progressEntries: ProgressEntry[] }> {
  const text = await readDataFile(dir)
  if (text === null) throw new Error('저장 파일이 없다')
  return JSON.parse(text) as { cards: Card[]; progressEntries: ProgressEntry[] }
}

/**
 * 같은 데이터 폴더로 앱을 여러 번 구동하는 시험용. 폴더는 이 함수가 만들고 끝나면 지운다.
 * `launch`는 앞 구동을 닫은 뒤 다음 구동을 띄운다 (한 번에 하나만 떠 있다).
 */
export async function withPersistentDir<T>(
  initialJson: string | undefined,
  body: (ctx: {
    dir: string
    launch: () => Promise<LaunchedApp>
    close: (app: LaunchedApp) => Promise<void>
  }) => Promise<T>,
): Promise<T> {
  const dir = await makeTempDir()
  let first = true
  const running: LaunchedApp[] = []
  try {
    return await body({
      dir,
      launch: async () => {
        const options =
          first && initialJson !== undefined ? { userDataDir: dir, seedJson: initialJson } : { userDataDir: dir }
        first = false
        const launched = await launchApp(options)
        running.push(launched)
        await waitForBoard(launched.page)
        return launched
      },
      close: async (app) => {
        const index = running.indexOf(app)
        if (index >= 0) running.splice(index, 1)
        await closeApp(app)
      },
    })
  } finally {
    for (const app of running) await closeApp(app)
    await removeDir(dir)
  }
}
