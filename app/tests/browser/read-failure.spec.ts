// 읽기 실패 경로의 실제 Electron 확인 (AC-032, NFR-002, UC-005, 사용자 결정 D3): 빈 보드와 구분되는 오류 패널,
// 이동·검색·카드 만들기 비활성, 읽지 못한 파일은 앱을 쓰고 종료한 뒤에도 바뀌지 않음, `다시 읽기`로만 벗어남.
// 읽지 못하는 상태는 구동 전에 데이터 폴더에 손상된 파일(또는 파일 자리의 폴더)을 두어 만든다. 앱에 시험 전용 분기가 없다 (ADR-012).

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { BACKUP_SUFFIX, DATA_FILE_NAME, preVersionName } from '../../src/main/store/data-file-names'
import { column, saveIndicator, seedCard, seedJson, waitForBoard } from './support/board-page'
import { closeApp, launchApp, makeTempDir, removeDir, seedDataFile } from './support/launch-app'

const FIXTURE_V1 = fileURLToPath(new URL('../cli/support/fixtures/data-v1.json', import.meta.url))

const CORRUPT_JSON = '{ "cards": ['
const BACKUP_NAME = `${DATA_FILE_NAME}${BACKUP_SUFFIX}`

const TITLE = '저장된 데이터를 읽지 못했습니다'
const JSON_CAUSE = '파일 내용이 올바른 JSON이 아니거나 중간에 잘렸습니다'
const UNREADABLE_CAUSE = '파일을 열거나 읽을 수 없습니다 (권한, 잠금, 입출력 오류)'
const MANUAL_STEPS_START =
  '앱을 닫고 폴더에서 kanban-data.json을 다른 이름으로 바꾼 뒤 다시 열면 직전 저장본으로 열립니다'

function panel(page: Page): Locator {
  return page.locator('section.read-failure')
}

function panelLines(page: Page): Locator {
  return panel(page).locator('.read-failure__lines li')
}

/** 경로 비교는 대소문자를 구분하지 않는다 (Windows). */
function lower(lines: string[]): string[] {
  return lines.map((line) => line.toLowerCase())
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}

/** 저장 관련 파일(kanban-data*)만 정렬해 돌려준다. Electron 이 같은 폴더에 만드는 Chromium 파일은 뺀다. */
async function appFiles(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((name) => name.startsWith('kanban-data')).sort()
}

/** TC-117 의 구동 전 상태: 손상된 본 파일, 유효한 직전 저장본(.bak), 버전 변환 전 사본(pre-v1). */
async function prepareCorruptWithBackups(dir: string): Promise<void> {
  await seedDataFile(dir, CORRUPT_JSON)
  await writeFile(join(dir, BACKUP_NAME), seedJson([seedCard(1, { title: '직전 저장본 카드' })]), 'utf8')
  await writeFile(join(dir, preVersionName(1)), await readFile(FIXTURE_V1, 'utf8'), 'utf8')
}

test.describe('read-failure', () => {
  test('TC-117 저장된 데이터를 읽지 못하면 빈 보드와 구분되는 오류 안내가 보인다', async () => {
    const dir = await makeTempDir()
    await prepareCorruptWithBackups(dir)
    const launched = await launchApp({ userDataDir: dir })
    try {
      const { page } = launched
      await waitForBoard(page)

      await expect(panel(page).getByRole('heading', { name: TITLE })).toBeVisible()
      const lines = await panelLines(page).allTextContents()
      expect(lines).toHaveLength(5)
      expect(lower([lines[0] ?? ''])).toEqual([`읽지 못한 파일: ${join(dir, DATA_FILE_NAME)}`.toLowerCase()])
      expect(lines[1]).toBe(`오류: ${JSON_CAUSE}`) // JSON 해석 실패는 OS 오류 코드가 없다
      expect(lines[1]).not.toMatch(/\(E[A-Z]+\)/)
      expect(lower([lines[2] ?? ''])).toEqual([`직전 저장본이 있습니다: ${join(dir, BACKUP_NAME)}`.toLowerCase()])
      expect(lower([lines[3] ?? ''])).toEqual([`버전 변환 전 사본: ${join(dir, preVersionName(1))}`.toLowerCase()])
      expect(lines[4]?.startsWith(MANUAL_STEPS_START)).toBe(true)

      // 버튼은 `다시 읽기` 하나뿐이고 복구 버튼이 없다.
      const buttons = panel(page).getByRole('button')
      await expect(buttons).toHaveCount(1)
      await expect(buttons).toHaveText('다시 읽기')
      await expect(panel(page).getByRole('button', { name: /직전 저장본|옮기|복구|열기/ })).toHaveCount(0)

      // 빈 보드와 구분된다: 세 칸 보드도, 빈 보드 안내도 없다.
      await expect(page.locator('section.column')).toHaveCount(0)
      await expect(page.locator('.card-item')).toHaveCount(0)
      await expect(page.getByText('카드가 없습니다')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('읽지 못함')
    } finally {
      await closeApp(launched)
      await removeDir(dir)
    }
  })

  test('TC-118 읽기 실패 상태에서는 카드 만들기와 검색, 이동이 눌리지 않는다', async () => {
    const dir = await makeTempDir()
    await seedDataFile(dir, CORRUPT_JSON)
    const launched = await launchApp({ userDataDir: dir })
    try {
      const { page } = launched
      await waitForBoard(page)
      await expect(panel(page)).toBeVisible()

      await expect(page.locator('.top-bar__create')).toBeDisabled()
      await expect(page.getByRole('textbox', { name: '검색' })).toBeDisabled()

      // 필터 행: 종류 3(전체 포함) + 우선순위 4(전체 포함), 모두 비활성이다.
      const filterRows = page.locator('.sidebar-filter').getByRole('radio')
      await expect(filterRows).toHaveCount(7)
      for (const row of await filterRows.all()) await expect(row).toBeDisabled()

      // 이동: 보드·캘린더·보관함 모두 비활성이다.
      for (const name of ['보드', '캘린더', '보관함']) {
        await expect(page.locator('.sidebar-nav__item', { hasText: name })).toBeDisabled()
      }
      await expect(saveIndicator(page)).toHaveText('읽지 못함')

      // 눌러 보아도 화면이 바뀌지 않는다.
      await page.locator('.sidebar-nav__item', { hasText: '캘린더' }).click({ force: true })
      await expect(panel(page)).toBeVisible()
      await expect(page.locator('.top-bar')).toHaveAttribute('data-screen', 'board')
      await expect(page.locator('dialog')).toHaveCount(0)
    } finally {
      await closeApp(launched)
      await removeDir(dir)
    }
  })

  test('TC-119 읽지 못한 파일은 앱을 쓰고 종료한 뒤에도 바뀌지 않는다', async () => {
    const dir = await makeTempDir()
    await seedDataFile(dir, CORRUPT_JSON)
    await writeFile(join(dir, BACKUP_NAME), seedJson([seedCard(1, { title: '직전 저장본 카드' })]), 'utf8')
    const mainPath = join(dir, DATA_FILE_NAME)
    const backupPath = join(dir, BACKUP_NAME)
    const beforeMain = await sha256(mainPath)
    const beforeBackup = await sha256(backupPath)
    const beforeFiles = await appFiles(dir)
    expect(beforeFiles).toEqual([DATA_FILE_NAME, BACKUP_NAME])

    const launched = await launchApp({ userDataDir: dir })
    try {
      const { page } = launched
      await waitForBoard(page)
      await expect(panel(page)).toBeVisible()

      // 읽기 실패 화면에서 가능한 조작: 밝기 전환(쓰지 않고 화면만 바뀐다), 다시 읽기(읽기만 한다).
      await page.locator('.sidebar-theme').getByRole('radio', { name: '밝은 판', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await page.locator('.sidebar-theme').getByRole('radio', { name: '어두운 판', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await panel(page).getByRole('button', { name: '다시 읽기', exact: true }).click()
      await expect(panel(page).getByRole('button', { name: '다시 읽기', exact: true })).toBeEnabled()
      await expect(panel(page).getByRole('heading', { name: TITLE })).toBeVisible()
      await expect(panel(page).locator('.read-failure__message')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('읽지 못함')
      // 앱이 실행 중일 때도 이미 바뀌지 않았다.
      expect(await sha256(mainPath)).toBe(beforeMain)
      expect(await appFiles(dir)).toEqual(beforeFiles)
    } finally {
      await closeApp(launched)
    }
    try {
      // 종료한 뒤: 손상된 본 파일과 직전 저장본의 해시가 같고, 새 파일(임시 파일 등)이 없다.
      expect(await sha256(mainPath)).toBe(beforeMain)
      expect(await sha256(backupPath)).toBe(beforeBackup)
      expect(await appFiles(dir)).toEqual(beforeFiles)
      expect(await readFile(mainPath, 'utf8')).toBe(CORRUPT_JSON)
    } finally {
      await removeDir(dir)
    }
  })

  test('TC-120 다시 읽기를 누르면 파일이 고쳐진 경우에만 정상 보드로 바뀐다', async () => {
    const dir = await makeTempDir()
    await seedDataFile(dir, CORRUPT_JSON)
    const launched = await launchApp({ userDataDir: dir })
    try {
      const { page } = launched
      await waitForBoard(page)
      await expect(panel(page)).toBeVisible()
      const retry = panel(page).getByRole('button', { name: '다시 읽기', exact: true })

      // 고치지 않고 누르면 오류 안내가 그대로 남는다.
      await retry.click()
      await expect(retry).toBeEnabled() // 읽기가 끝났다
      await expect(panel(page).getByRole('heading', { name: TITLE })).toBeVisible()
      await expect(page.locator('section.column')).toHaveCount(0)
      await expect(saveIndicator(page)).toHaveText('읽지 못함')
      expect(await readFile(join(dir, DATA_FILE_NAME), 'utf8')).toBe(CORRUPT_JSON)

      // 유효한 현재 버전 문서(카드 2건)로 바꾼 뒤 누르면 보드가 열린다.
      await writeFile(
        join(dir, DATA_FILE_NAME),
        seedJson([
          seedCard(1, { title: '고친 뒤 카드 하나' }),
          seedCard(2, { title: '고친 뒤 카드 둘', status: 'done' }),
        ]),
        'utf8',
      )
      await retry.click()
      await expect(panel(page)).toHaveCount(0)
      await expect(page.locator('section.column')).toHaveCount(3)
      await expect(page.locator('.card-item')).toHaveCount(2)
      await expect(column(page, 'todo').locator('.card-item', { hasText: '고친 뒤 카드 하나' })).toHaveCount(1)
      await expect(column(page, 'done').locator('.card-item', { hasText: '고친 뒤 카드 둘' })).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')
      await expect(page.locator('.top-bar__create')).toBeEnabled()
    } finally {
      await closeApp(launched)
      await removeDir(dir)
    }
  })

  test('TC-153 본 파일을 읽다 OS 오류가 나면 오류 코드와 직전 저장본 없음 안내가 보인다', async () => {
    const dir = await makeTempDir()
    // 본 파일 자리에 같은 이름의 폴더를 만든다 (파일처럼 읽으면 OS 오류).
    await mkdir(join(dir, DATA_FILE_NAME))
    expect(await appFiles(dir)).toEqual([DATA_FILE_NAME])
    const launched = await launchApp({ userDataDir: dir })
    try {
      const { page } = launched
      await waitForBoard(page)
      await expect(panel(page).getByRole('heading', { name: TITLE })).toBeVisible()

      const lines = await panelLines(page).allTextContents()
      expect(lower([lines[0] ?? ''])).toEqual([`읽지 못한 파일: ${join(dir, DATA_FILE_NAME)}`.toLowerCase()])
      // 설계는 Windows 에서 폴더를 파일처럼 읽을 때의 코드가 EISDIR 인지 확인하지 못했다. 실제 코드를 기대값으로 쓴다.
      expect(lines[1]).toBe(`오류: ${UNREADABLE_CAUSE} (EISDIR)`)
      expect(lines[2]).toBe('직전 저장본이 없습니다')
      expect(lines).toHaveLength(3)
      await expect(panel(page).getByText('버전 변환 전 사본:')).toHaveCount(0)
      await expect(panel(page).getByText(MANUAL_STEPS_START, { exact: false })).toHaveCount(0)

      const buttons = panel(page).getByRole('button')
      await expect(buttons).toHaveCount(1)
      await expect(buttons).toHaveText('다시 읽기')
      await expect(saveIndicator(page)).toHaveText('읽지 못함')
    } finally {
      await closeApp(launched)
      await removeDir(dir)
    }
  })
})
