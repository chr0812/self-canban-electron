// 저장 실패 경로의 실제 Electron 확인 (AC-031, UC-005, UC-011, 사용자 결정 D2): 저장 실패 문구와 입력 유지,
// 칸 이동·보관·삭제는 화면을 바꾸지 않고 `다시 저장`으로 재시도, 밝기 전환은 저장에 실패해도 판 유지.
//
// 쓰기 실패를 만드는 방법 (앱에 시험 전용 분기가 없다, ADR-012): 유효한 저장 파일 옆에 `kanban-data.json.bak` 이름의 폴더를 만든다.
// 저장 단계 중 임시 파일 쓰기(write_temp)와 검증(verify)은 되고, 직전본 복사(backup)가 폴더 위에 파일을 복사하려다 실패한다.
// 그래서 본 파일은 바뀌지 않고 임시 파일(kanban-data.json.<pid>.tmp)이 남는다. 이 시험은 그 전제를 단언한다.

import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { BACKUP_SUFFIX, DATA_FILE_NAME, tempFileName } from '../../src/main/store/data-file-names'
import {
  boardCard,
  closeDialogWithCancel,
  column,
  createButton,
  dialog,
  moveViaMenu,
  openCreateDialog,
  saveIndicator,
  seedCard,
  seedJson,
  statusSelect,
  titleInput,
  waitForBoard,
} from './support/board-page'
import { closeApp, launchApp, makeTempDir, readDataFile, removeDir } from './support/launch-app'
import type { LaunchedApp } from './support/launch-app'

const BACKUP_FOLDER = `${DATA_FILE_NAME}${BACKUP_SUFFIX}`

const CARD_FAIL_TEXT = '저장하지 못했습니다. 카드는 바뀌지 않았습니다.'
const THEME_FAIL_TEXT = '저장하지 못했습니다. 화면의 내용은 그대로 남아 있습니다.'
const DIALOG_FAIL_TEXT = '저장하지 못했습니다. 입력한 내용은 그대로 남아 있습니다.'

/** 쓰기 실패 준비: 데이터 폴더를 만들고 `.bak` 폴더를 둔다. 폴더가 정말 폴더인지 단언한다. */
async function prepareWriteFailure(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true })
  const folder = join(dir, BACKUP_FOLDER)
  await mkdir(folder)
  expect((await stat(folder)).isDirectory()).toBe(true)
  return folder
}

/**
 * 준비 조건 단언: 쓰기가 정말 직전본 복사(backup) 단계에서 실패했다.
 * 본 파일은 그대로이고, 임시 파일이 남아 있다 (임시 파일 쓰기와 검증은 통과했다는 뜻이다).
 */
async function expectBackupStageFailure(launched: LaunchedApp, seed: string): Promise<void> {
  expect(await readDataFile(launched.userDataDir)).toBe(seed)
  const names = await readdir(launched.userDataDir)
  // 임시 파일 이름의 번호는 Electron main 의 process.pid 이다 (launched.pid 는 Playwright 가 띄운 바깥 프로세스라 다를 수 있다).
  const mainPid = await launched.app.evaluate(() => process.pid)
  expect(names).toContain(tempFileName(mainPid))
  expect((await stat(join(launched.userDataDir, BACKUP_FOLDER))).isDirectory()).toBe(true)
}

/** 알림 줄(`.app-shell__alert`)의 문구와 `다시 저장` 버튼. */
function alertLine(page: Page): Locator {
  return page.locator('.app-shell__alert')
}

async function expectAlertLine(page: Page, text: string): Promise<void> {
  await expect(alertLine(page).locator('.banner__message')).toHaveText(text)
  await expect(alertLine(page).getByRole('button', { name: '다시 저장', exact: true })).toBeVisible()
  await expect(saveIndicator(page)).toHaveText('저장하지 못함')
}

function goTo(page: Page, name: '보드' | '캘린더' | '보관함'): Promise<void> {
  return page.locator('.sidebar-nav__item', { hasText: name }).click()
}

function navCount(page: Page, name: '보드' | '보관함'): Locator {
  return page.locator('.sidebar-nav__item', { hasText: name }).locator('.sidebar-nav__count')
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

/** `2026년 11월` 같은 월 보기 제목의 연·월을 순서 비교용 숫자로 바꾼다. */
function monthOrder(title: string): number {
  const match = /^(\d+)년 (\d+)월/.exec(title)
  if (match === null) throw new Error(`기간 제목을 읽을 수 없다: ${title}`)
  return Number(match[1]) * 100 + Number(match[2])
}

/** 캘린더를 열어 `‹`/`›` 로 2026년 11월 월 보기로 맞춘다 (앱 시계를 바꾸지 않는다, ADR-012). */
async function openNovember(page: Page): Promise<void> {
  await waitForBoard(page)
  await goTo(page, '캘린더')
  for (let step = 0; step < 120; step += 1) {
    const current = ((await periodTitle(page).textContent()) ?? '').trim()
    if (current === '2026년 11월') break
    const forward = monthOrder(current) < monthOrder('2026년 11월')
    await page.getByRole('button', { name: forward ? '다음 달' : '이전 달', exact: true }).click()
    await expect(periodTitle(page)).not.toHaveText(current)
  }
  await expect(periodTitle(page)).toHaveText('2026년 11월')
  await expect(page.locator('.calendar-grid[data-mode="month"] .day-cell')).toHaveCount(35)
}

/** 칩을 눌러 카드 상세를 열고 마감일 입력칸과 상태 값을 읽는다. */
async function openChipAndRead(page: Page, title: string): Promise<{ due: string; status: string }> {
  await page.locator('.calendar-chip', { hasText: title }).first().click()
  await expect(dialog(page)).toBeVisible()
  await expect(titleInput(page)).toHaveValue(title)
  const due = await dialog(page).getByLabel('마감일', { exact: true }).inputValue()
  const status = await statusSelect(page).inputValue()
  await closeDialogWithCancel(page)
  return { due, status }
}

test.describe('save-failure', () => {
  test('TC-114 저장에 실패하면 실패 문구가 보이고 입력한 내용은 지워지지 않는다', async () => {
    const dir = await makeTempDir()
    const seed = seedJson([])
    await prepareWriteFailure(dir)
    const launched = await launchApp({ userDataDir: dir, seedJson: seed })
    try {
      const { page } = launched
      await waitForBoard(page)
      await expect(page.locator('.card-item')).toHaveCount(0)

      await openCreateDialog(page)
      await titleInput(page).fill('저장 실패 카드')
      await dialog(page).getByRole('textbox', { name: '상세 설명' }).fill('입력해 둔 설명')
      await dialog(page).getByRole('button', { name: '저장', exact: true }).click()

      await expect(dialog(page).locator('.card-dialog__alert .banner__message')).toHaveText(DIALOG_FAIL_TEXT)
      await expect(dialog(page)).toBeVisible()
      await expect(titleInput(page)).toHaveValue('저장 실패 카드')
      await expect(dialog(page).getByRole('textbox', { name: '상세 설명' })).toHaveValue('입력해 둔 설명')
      await expect(saveIndicator(page)).toHaveText('저장하지 못함')
      await expect(page.locator('.card-item')).toHaveCount(0)
      await expectBackupStageFailure(launched, seed)

      // 닫아도 보드에는 카드가 없다.
      await dialog(page).getByRole('button', { name: '취소', exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(page.locator('.card-item')).toHaveCount(0)
    } finally {
      await closeApp(launched)
      await removeDir(dir)
    }
  })

  test('TC-115 칸 이동·보관·삭제의 저장이 실패하면 화면이 바뀌지 않아 카드가 원래 자리에 남고 다시 저장으로 재시도할 수 있다', async () => {
    const dir = await makeTempDir()
    const seed = seedJson([
      seedCard(1, { title: '카드 A', status: 'todo' }),
      seedCard(2, { title: '카드 B', status: 'done' }),
      seedCard(3, { title: '카드 C', status: 'done', archivedAt: '2026-10-25T09:00:00.000Z' }),
    ])
    const backupFolder = await prepareWriteFailure(dir)
    let launched = await launchApp({ userDataDir: dir, seedJson: seed })
    let closed = false
    try {
      const { page } = launched
      await waitForBoard(page)
      await expect(navCount(page, '보관함')).toHaveText('1')

      // (1) A 를 진행 중으로 옮긴다.
      await moveViaMenu(page, '카드 A', '진행 중으로 옮기기')
      await expectAlertLine(page, CARD_FAIL_TEXT)
      await expect(column(page, 'todo').locator('.card-item', { hasText: '카드 A' })).toHaveCount(1)
      await expect(column(page, 'in_progress').locator('.card-item')).toHaveCount(0)
      await expectBackupStageFailure(launched, seed)

      // (2) B 를 보관한다.
      await boardCard(page, '카드 B').getByRole('button', { name: '보관', exact: true }).click()
      await boardCard(page, '카드 B').getByRole('button', { name: '보관 확인', exact: true }).click()
      await expectAlertLine(page, CARD_FAIL_TEXT)
      await expect(column(page, 'done').locator('.card-item', { hasText: '카드 B' })).toHaveCount(1)
      await expect(column(page, 'todo').locator('.card-item', { hasText: '카드 A' })).toHaveCount(1)
      await expect(navCount(page, '보관함')).toHaveText('1')
      await expectBackupStageFailure(launched, seed)

      // (3) 보관함에서 C 를 삭제한다.
      await goTo(page, '보관함')
      const rowC = page.locator('.archive-row', { hasText: '카드 C' })
      await expect(rowC).toHaveCount(1)
      await rowC.getByRole('button', { name: '삭제', exact: true }).click()
      await page.locator('.archive-row--confirm').getByRole('button', { name: '삭제 확인', exact: true }).click()
      await expectAlertLine(page, CARD_FAIL_TEXT)
      // 행은 삭제 확인 줄 그대로 남는다 (화면이 저장소와 같다).
      await expect(page.locator('.archive-row--confirm')).toHaveCount(1)
      await expect(page.locator('.archive-row--confirm')).toHaveAttribute('data-card-id', /000000000003$/)
      await expect(page.locator('.archive-row')).toHaveCount(1)
      await expect(navCount(page, '보관함')).toHaveText('1')
      await expectBackupStageFailure(launched, seed)

      // (4) 앱 밖에서 .bak 폴더를 지우고 `다시 저장`을 누른다. 마지막으로 실패한 요청(C 의 삭제) 한 건이 다시 간다.
      await rm(backupFolder, { recursive: true })
      await alertLine(page).getByRole('button', { name: '다시 저장', exact: true }).click()
      await expect(alertLine(page).locator('.banner')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await expect(page.locator('.archive-row')).toHaveCount(0)
      await expect(navCount(page, '보관함')).toHaveText('0')
      await goTo(page, '보드')
      await expect(column(page, 'todo').locator('.card-item', { hasText: '카드 A' })).toHaveCount(1)
      await expect(column(page, 'done').locator('.card-item', { hasText: '카드 B' })).toHaveCount(1)
      // 다시 보낸 것은 C 의 삭제 하나뿐이다: 저장 파일에 A 는 할 일, B 는 완료이고 보관되지 않았다.
      const saved = JSON.parse((await readDataFile(dir)) ?? 'null') as {
        cards: { title: string; status: string; archivedAt: string | null }[]
      }
      expect(saved.cards.map((card) => [card.title, card.status, card.archivedAt])).toEqual([
        ['카드 A', 'todo', null],
        ['카드 B', 'done', null],
      ])

      // (5) 종료하고 같은 데이터 폴더로 다시 구동한다.
      await closeApp(launched)
      closed = true
      launched = await launchApp({ userDataDir: dir })
      closed = false
      const again = launched.page
      await waitForBoard(again)
      await expect(again.locator('.read-failure')).toHaveCount(0)
      await expect(column(again, 'todo').locator('.card-item', { hasText: '카드 A' })).toHaveCount(1)
      await expect(column(again, 'done').locator('.card-item', { hasText: '카드 B' })).toHaveCount(1)
      await expect(navCount(again, '보관함')).toHaveText('0')
      await goTo(again, '보관함')
      await expect(again.locator('.archive-row')).toHaveCount(0)
    } finally {
      if (!closed) await closeApp(launched)
      await removeDir(dir)
    }
  })

  test('TC-173 칩을 끌어 마감일을 바꾸는 저장이 실패하면 칩이 원래 칸에 남고 실패 문구와 다시 저장이 보인다', async () => {
    const dir = await makeTempDir()
    const seed = seedJson([seedCard(1, { title: '카드 A', status: 'in_progress', dueDate: '2026-11-06' })])
    const backupFolder = await prepareWriteFailure(dir)
    let launched = await launchApp({ userDataDir: dir, seedJson: seed })
    let closed = false
    try {
      const { page } = launched
      await openNovember(page)
      await expect(chipIn(page, '2026-11-06', '카드 A')).toHaveCount(1)

      // (1) A 의 칩을 18일 칸으로 끌어다 놓는다. 저장이 실패하면 칩은 제자리에 있다.
      await chipIn(page, '2026-11-06', '카드 A').dragTo(dayCell(page, '2026-11-18'))
      await expectAlertLine(page, CARD_FAIL_TEXT)
      // 실패 문구가 보인 뒤에도 칩은 6일 칸에 있고 18일 칸에는 없다.
      await expect(chipIn(page, '2026-11-06', '카드 A')).toHaveCount(1)
      await expect(chipIn(page, '2026-11-18')).toHaveCount(0)
      await expect(page.locator('.calendar-chip')).toHaveCount(1)
      await expectBackupStageFailure(launched, seed) // 준비 조건: 쓰기가 정말 backup 단계에서 실패했다
      expect(await openChipAndRead(page, '카드 A')).toEqual({ due: '2026-11-06', status: 'in_progress' })
      await expect(dialog(page)).toHaveCount(0)
      await expectAlertLine(page, CARD_FAIL_TEXT) // 카드를 열고 닫아도 실패 안내가 남는다

      // (2) 앱 밖에서 .bak 폴더를 지우고 `다시 저장`을 누른다. 같은 요청(마감일 2026-11-18)이 다시 간다.
      await rm(backupFolder, { recursive: true })
      await alertLine(page).getByRole('button', { name: '다시 저장', exact: true }).click()
      await expect(alertLine(page).locator('.banner')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await expect(chipIn(page, '2026-11-18', '카드 A')).toHaveCount(1)
      await expect(chipIn(page, '2026-11-06')).toHaveCount(0)
      const saved = JSON.parse((await readDataFile(dir)) ?? 'null') as {
        cards: { title: string; status: string; dueDate: string | null }[]
      }
      expect(saved.cards.map((card) => [card.title, card.status, card.dueDate])).toEqual([
        ['카드 A', 'in_progress', '2026-11-18'],
      ])

      // (3) 종료하고 같은 데이터 폴더로 다시 구동해 같은 달을 본다.
      await closeApp(launched)
      closed = true
      launched = await launchApp({ userDataDir: dir })
      closed = false
      await openNovember(launched.page)
      await expect(launched.page.locator('.read-failure')).toHaveCount(0)
      await expect(chipIn(launched.page, '2026-11-18', '카드 A')).toHaveCount(1)
      await expect(chipIn(launched.page, '2026-11-06')).toHaveCount(0)
    } finally {
      if (!closed) await closeApp(launched)
      await removeDir(dir)
    }
  })

  test('TC-116 판 전환 저장이 실패해도 이번 실행 동안 선택한 판이 유지되고 실패 문구가 보인다', async () => {
    const dir = await makeTempDir()
    const seed = seedJson([seedCard(1, { title: '판 시험 카드', dueDate: '2026-11-10' })])
    const backupFolder = await prepareWriteFailure(dir)
    let launched = await launchApp({ userDataDir: dir, seedJson: seed })
    let closed = false
    try {
      const { page } = launched
      await waitForBoard(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light') // 처음 판은 밝은 판이다

      // 바뀌는 쪽인 어두운 판을 고른다.
      await page.locator('.sidebar-theme').getByRole('radio', { name: '어두운 판', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expectAlertLine(page, THEME_FAIL_TEXT)
      await expectBackupStageFailure(launched, seed)

      // 되돌아가지 않는다: 실패 문구가 보인 뒤에도, 다른 화면으로 가도 어두운 판이다.
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(page.locator('.sidebar-theme').getByRole('radio', { name: '어두운 판', exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      await goTo(page, '캘린더')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await goTo(page, '보관함')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(createButton(page)).toHaveCount(0) // 보관함에는 카드 만들기가 없다 (화면이 바뀌었다는 확인)

      // 종료하고 유도 폴더를 지운 뒤 재구동하면 저장된 적 없으므로 밝은 판이다.
      await closeApp(launched)
      closed = true
      await rm(backupFolder, { recursive: true })
      launched = await launchApp({ userDataDir: dir })
      closed = false
      await waitForBoard(launched.page)
      await expect(launched.page.locator('html')).toHaveAttribute('data-theme', 'light')
      await expect(
        launched.page.locator('.sidebar-theme').getByRole('radio', { name: '밝은 판', exact: true }),
      ).toHaveAttribute('aria-checked', 'true')
      await expect(launched.page.locator('.read-failure')).toHaveCount(0)
    } finally {
      if (!closed) await closeApp(launched)
      await removeDir(dir)
    }
  })
})
