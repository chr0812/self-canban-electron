// 데이터 보존의 실제 Electron 확인 (NFR-002, NFR-003, AC-011, AC-038): 정상 종료·강제 종료·변경 직후 창 닫기 뒤 재구동,
// 이전 버전(버전 1) 저장 파일 열기, 선택한 판 유지.
// 데이터는 시험마다 새 임시 폴더(`--user-data-dir`)에 둔다. 앱에 시험 전용 분기를 두지 않는다 (ADR-012).

import { execFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { DATA_FILE_NAME, preVersionName } from '../../src/main/store/data-file-names'
import { CURRENT_SCHEMA_VERSION } from '../../src/shared/constants'
import type { Card, ProgressEntry } from '../../src/shared/types/card'
import {
  boardCard,
  closeDialogWithCancel,
  column,
  createCardViaDialog,
  daysFromToday,
  dialog,
  moveViaMenu,
  openCardDialog,
  readDoc,
  saveIndicator,
  titleInput,
  waitForBoard,
  withPersistentDir,
} from './support/board-page'
import { closeApp, launchApp, makeTempDir, readDataFile, removeDir } from './support/launch-app'

const FIXTURE_V1 = fileURLToPath(new URL('../cli/support/fixtures/data-v1.json', import.meta.url))

function progressItems(page: Page): Locator {
  return dialog(page).locator('.progress-log__item')
}

async function addProgress(page: Page, content: string): Promise<void> {
  const before = await progressItems(page).count()
  await dialog(page).getByRole('textbox', { name: '기록 내용' }).fill(content)
  await dialog(page).getByRole('button', { name: '기록 추가', exact: true }).click()
  await expect(progressItems(page)).toHaveCount(before + 1)
}

function themeRadio(page: Page, name: '어두운 판' | '밝은 판'): Locator {
  return page.locator('.sidebar-theme').getByRole('radio', { name, exact: true })
}

/** 저장 파일의 판이 기대한 값이 될 때까지 기다린다 (판 전환은 저장이 끝나야 파일에 있다). */
async function expectSavedTheme(dir: string, theme: 'dark' | 'light'): Promise<void> {
  await expect
    .poll(async () => {
      const text = await readDataFile(dir)
      return text === null ? null : (JSON.parse(text) as { settings: { theme: string } }).settings.theme
    })
    .toBe(theme)
}

/** 데이터 폴더에서 앱이 만드는 저장 관련 파일(kanban-data*)만 정렬해 돌려준다. Chromium 이 같은 폴더에 만드는 파일은 뺀다. */
async function appFiles(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((name) => name.startsWith('kanban-data')).sort()
}

/** 프로세스와 그 자식을 즉시 끝낸다 (Windows taskkill /T /F). 이 시험이 띄운 PID 에만 쓴다. */
function forceKillTree(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], (error) => (error ? reject(error) : resolve()))
  })
}

/** 프로세스가 끝났는지 (신호 0 은 존재 확인만 한다). */
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

type Expected = {
  title: string
  status: 'todo' | 'in_progress' | 'done'
  kind: '개발 버그' | '할 일'
  dueDate: string
  priority: '높음' | '중간' | '낮음'
  description: string
  memo: string
}

async function expectDialogFields(page: Page, expected: Expected): Promise<void> {
  const box = dialog(page)
  await expect(titleInput(page)).toHaveValue(expected.title)
  await expect(box.getByRole('radio', { name: expected.kind, exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(box.getByRole('textbox', { name: /^마감일/ })).toHaveValue(expected.dueDate)
  await expect(box.getByRole('radio', { name: expected.priority, exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(box.getByRole('textbox', { name: '상세 설명' })).toHaveValue(expected.description)
  await expect(box.getByRole('textbox', { name: '추가 메모' })).toHaveValue(expected.memo)
}

test.describe('persistence', () => {
  test('TC-110 변경한 뒤 정상 종료하고 다시 열면 카드, 상태, 기록이 그대로 보인다', async () => {
    const cards: Expected[] = [
      {
        title: '보존 카드 하나',
        status: 'todo',
        kind: '개발 버그',
        dueDate: daysFromToday(3),
        priority: '높음',
        description: '설명 하나',
        memo: '메모 하나',
      },
      {
        title: '보존 카드 둘',
        status: 'in_progress',
        kind: '할 일',
        dueDate: daysFromToday(5),
        priority: '중간',
        description: '설명 둘',
        memo: '메모 둘',
      },
      {
        title: '보존 카드 셋',
        status: 'done',
        kind: '개발 버그',
        dueDate: daysFromToday(7),
        priority: '낮음',
        description: '설명 셋',
        memo: '메모 셋',
      },
    ]
    await withPersistentDir(undefined, async ({ dir, launch, close }) => {
      const first = await launch()
      const page = first.page
      for (const card of cards) {
        await createCardViaDialog(page, {
          title: card.title,
          kind: card.kind,
          dueDate: card.dueDate,
          priority: card.priority,
          description: card.description,
          memo: card.memo,
        })
      }
      await moveViaMenu(page, '보존 카드 둘', '진행 중으로 옮기기')
      await expect(column(page, 'in_progress').locator('.card-item', { hasText: '보존 카드 둘' })).toHaveCount(1)
      await moveViaMenu(page, '보존 카드 셋', '완료로 옮기기')
      await expect(column(page, 'done').locator('.card-item', { hasText: '보존 카드 셋' })).toHaveCount(1)

      await openCardDialog(page, '보존 카드 하나')
      await addProgress(page, '첫 기록')
      await addProgress(page, '둘째 기록')
      await closeDialogWithCancel(page)

      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await close(first)

      const second = await launch()
      const again = second.page
      await expect(again.locator('.read-failure')).toHaveCount(0)
      await expect(again.locator('.card-item')).toHaveCount(3)
      for (const card of cards) {
        await expect(column(again, card.status).locator('.card-item', { hasText: card.title })).toHaveCount(1)
        await openCardDialog(again, card.title)
        await expectDialogFields(again, card)
        if (card.title === '보존 카드 하나') {
          await expect(progressItems(again).locator('.progress-log__content')).toHaveText(['첫 기록', '둘째 기록'])
          await expect(progressItems(again).locator('.progress-log__status')).toHaveText(['할 일', '할 일'])
        } else {
          await expect(progressItems(again)).toHaveCount(0)
        }
        await closeDialogWithCancel(again)
      }

      const doc = await readDoc(dir)
      expect(doc.cards.map((card) => card.title).sort()).toEqual(cards.map((card) => card.title).sort())
      expect(doc.progressEntries.map((entry) => entry.content)).toEqual(['첫 기록', '둘째 기록'])
    })
  })

  test('TC-111 저장 완료가 표시된 뒤 프로세스를 강제 종료하고 다시 열어도 모두 유지된다', async () => {
    const dir = await makeTempDir()
    const first = await launchApp({ userDataDir: dir })
    let firstKilled = false
    let second: Awaited<ReturnType<typeof launchApp>> | null = null
    try {
      const page = first.page
      await waitForBoard(page)
      await createCardViaDialog(page, { title: '강제 종료 카드', dueDate: daysFromToday(2), priority: '높음' })
      await moveViaMenu(page, '강제 종료 카드', '진행 중으로 옮기기')
      await expect(column(page, 'in_progress').locator('.card-item', { hasText: '강제 종료 카드' })).toHaveCount(1)
      await openCardDialog(page, '강제 종료 카드')
      await addProgress(page, '종료 전 기록')
      await closeDialogWithCancel(page)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')

      // 준비 조건: 저장 파일에 이미 들어 있다. 이 뒤에 앱이 하는 저장은 없다.
      const rawBefore = await readDataFile(dir)
      const before = await readDoc(dir)
      expect(before.cards.map((card) => card.title)).toEqual(['강제 종료 카드'])
      expect(before.cards[0]?.status).toBe('in_progress')
      expect(before.progressEntries.map((entry) => entry.content)).toEqual(['종료 전 기록'])

      // 이 시험이 띄운 앱 프로세스(PID)와 그 자식 프로세스만 강제 종료한다. 정상 종료 경로(before-quit, whenIdle)를 타지 않는다.
      // main 만 죽이면(child.kill) Windows 에서는 화면·GPU 프로세스가 남아 데이터 폴더를 잡고 있어 트리째 종료한다.
      const child = first.app.process()
      // Playwright 가 띄운 바깥 프로세스(launched.pid)와 Electron main 의 pid 는 다를 수 있다. 둘 다 끝났는지 본다.
      const mainPid = await first.app.evaluate(() => process.pid)
      expect(child.pid).toBe(first.pid)
      console.log(`[persistence] TC-111 강제 종료 pid=${first.pid} mainPid=${mainPid}`)
      const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
      await forceKillTree(first.pid)
      await Promise.race([
        exited,
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('강제 종료 뒤 프로세스가 끝나지 않았다')), 10_000),
        ),
      ])
      firstKilled = true
      expect(isRunning(first.pid)).toBe(false)
      await expect.poll(() => isRunning(mainPid)).toBe(false)

      second = await launchApp({ userDataDir: dir })
      const again = second.page
      await waitForBoard(again)
      await expect(again.locator('.read-failure')).toHaveCount(0)
      await expect(again.locator('.card-item')).toHaveCount(1)
      await expect(column(again, 'in_progress').locator('.card-item', { hasText: '강제 종료 카드' })).toHaveCount(1)
      await openCardDialog(again, '강제 종료 카드')
      await expect(progressItems(again).locator('.progress-log__content')).toHaveText(['종료 전 기록'])
      await closeDialogWithCancel(again)
      expect(await readDataFile(dir)).toBe(rawBefore)
    } finally {
      if (second !== null) await closeApp(second)
      if (!firstKilled) await closeApp(first)
      await removeDir(dir)
    }
  })

  test('TC-112 이전 버전(버전 1) 저장 파일로 열면 카드와 기록이 모두 보이고 밝은 판이다', async () => {
    const fixtureText = await readFile(FIXTURE_V1, 'utf8')
    const fixture = JSON.parse(fixtureText) as {
      schemaVersion: number
      cards: Card[]
      progressEntries: ProgressEntry[]
    }
    expect(fixture.schemaVersion).toBe(1) // 준비 조건: 넣는 파일이 정말 버전 1이다
    const boardCards = fixture.cards.filter((card) => card.archivedAt === null)
    const archivedCards = fixture.cards.filter((card) => card.archivedAt !== null)
    const entryCount = (card: Card): number => fixture.progressEntries.filter((e) => e.cardId === card.id).length
    expect(fixture.progressEntries.length).toBeGreaterThan(0)

    await withPersistentDir(fixtureText, async ({ dir, launch, close }) => {
      const first = await launch()
      const page = first.page
      await expect(page.locator('.read-failure')).toHaveCount(0)
      // 설정이 없던 버전 1 파일은 기본 판(밝은 판)으로 열린다.
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await expect(themeRadio(page, '밝은 판')).toHaveAttribute('aria-checked', 'true')
      await expect(page.locator('.card-item')).toHaveCount(boardCards.length)
      for (const card of boardCards) {
        await openCardDialog(page, card.title)
        await expect(progressItems(page)).toHaveCount(entryCount(card))
        await closeDialogWithCancel(page)
      }
      await page.locator('.sidebar-nav__item', { hasText: '보관함' }).click()
      await expect(page.locator('.archive-row')).toHaveCount(archivedCards.length)
      for (const card of archivedCards) {
        await page.locator('.archive-row', { hasText: card.title }).locator('.archive-row__open').click()
        await expect(dialog(page)).toBeVisible()
        await expect(progressItems(page)).toHaveCount(entryCount(card))
        await dialog(page).getByRole('button', { name: '닫기', exact: true }).last().click()
        await expect(dialog(page)).toHaveCount(0)
      }

      // 아무 변경 없이 종료하면 파일이 바뀌지 않고 변환 전 사본도 생기지 않는다.
      await close(first)
      expect(await readDataFile(dir)).toBe(fixtureText)
      expect(await appFiles(dir)).toEqual([DATA_FILE_NAME])

      // 카드 하나를 고치면 변환 전 사본이 생기고 본 파일이 새 버전이 된다.
      const second = await launch()
      const again = second.page
      const target = boardCards[0]
      if (target === undefined) throw new Error('fixture 에 보드 카드가 없다')
      await openCardDialog(again, target.title)
      await titleInput(again).fill('고친 제목')
      await dialog(again).getByRole('button', { name: '저장', exact: true }).click()
      await expect(dialog(again)).toHaveCount(0)
      await expect(boardCard(again, '고친 제목')).toHaveCount(1)
      await expect(saveIndicator(again)).toHaveText('내 PC에 저장됨')
      await close(second)

      const names = await appFiles(dir)
      expect(names).toContain(preVersionName(1))
      expect(names).toContain(DATA_FILE_NAME)
      expect(await readFile(join(dir, preVersionName(1)), 'utf8')).toBe(fixtureText)
      const migrated = JSON.parse((await readDataFile(dir)) ?? 'null') as {
        schemaVersion: number
        cards: Card[]
        progressEntries: ProgressEntry[]
      }
      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(migrated.cards).toHaveLength(fixture.cards.length)
      expect(migrated.progressEntries).toHaveLength(fixture.progressEntries.length)
      expect(migrated.cards.find((card) => card.id === target.id)?.title).toBe('고친 제목')
    })
  })

  test('TC-113 선택한 판은 앱을 닫았다 다시 열어도 유지된다', async () => {
    await withPersistentDir(undefined, async ({ dir, launch, close }) => {
      const first = await launch()
      await expect(first.page.locator('html')).toHaveAttribute('data-theme', 'light') // 처음 실행은 밝은 판
      await themeRadio(first.page, '어두운 판').click()
      await expect(first.page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expectSavedTheme(dir, 'dark')
      await expect(saveIndicator(first.page)).toHaveText('내 PC에 저장됨')
      await close(first)

      // 저장된 선택(어두운 판)이 처음 실행의 기본 판(밝은 판)보다 우선한다.
      const second = await launch()
      await expect(second.page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(themeRadio(second.page, '어두운 판')).toHaveAttribute('aria-checked', 'true')
      await expect(themeRadio(second.page, '밝은 판')).toHaveAttribute('aria-checked', 'false')
      await themeRadio(second.page, '밝은 판').click()
      await expect(second.page.locator('html')).toHaveAttribute('data-theme', 'light')
      await expectSavedTheme(dir, 'light')
      await expect(saveIndicator(second.page)).toHaveText('내 PC에 저장됨')
      await close(second)

      const third = await launch()
      await expect(third.page.locator('html')).toHaveAttribute('data-theme', 'light')
      await expect(themeRadio(third.page, '밝은 판')).toHaveAttribute('aria-checked', 'true')
      await expect(themeRadio(third.page, '어두운 판')).toHaveAttribute('aria-checked', 'false')
    })
  })

  test('TC-152 변경을 기다리지 않고 연달아 한 직후 창을 닫아도 다시 열면 모두 남아 있다', async () => {
    const dir = await makeTempDir()
    const first = await launchApp({ userDataDir: dir })
    let exitedNormally = false
    let second: Awaited<ReturnType<typeof launchApp>> | null = null
    try {
      const { page, app } = first
      await waitForBoard(page)
      const child = app.process()
      const mainPid = await app.evaluate(() => process.pid)
      const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)))

      // 응답을 기다리지 않고 5번 연달아 부른다. evaluate 는 호출만 하고 바로 돌아온다.
      await page.evaluate((): void => {
        const api = (
          globalThis as unknown as { kanban: { cards: { create(input: { title: string }): Promise<unknown> } } }
        ).kanban
        const holder = globalThis as unknown as { __pendingCreates?: Promise<unknown>[] }
        holder.__pendingCreates = [1, 2, 3, 4, 5].map((n) => api.cards.create({ title: `연달아 ${n}` }))
      })
      // 창 닫기 요청 (X 버튼과 같은 close). 앱 정상 종료 경로(close -> whenIdle -> window-all-closed -> quit)를 탄다.
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.close()
      })

      const code = await Promise.race([
        exited,
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 15_000)),
      ])
      expect(code, '창을 닫은 뒤 앱이 정상 종료해야 한다').toBe(0)
      exitedNormally = true
      await expect.poll(() => isRunning(mainPid), { message: 'Electron main 도 끝났다' }).toBe(false)

      const saved = await readDoc(dir)
      expect(saved.cards.map((card) => card.title).sort()).toEqual([1, 2, 3, 4, 5].map((n) => `연달아 ${n}`))

      second = await launchApp({ userDataDir: dir })
      const again = second.page
      await waitForBoard(again)
      await expect(again.locator('.read-failure')).toHaveCount(0)
      await expect(again.locator('.card-item')).toHaveCount(5)
      for (const n of [1, 2, 3, 4, 5]) {
        await expect(column(again, 'todo').locator('.card-item', { hasText: `연달아 ${n}` })).toHaveCount(1)
      }
    } finally {
      if (second !== null) await closeApp(second)
      if (!exitedNormally) await closeApp(first)
      await removeDir(dir)
    }
  })
})
