// 오프라인 동작의 실제 Electron 확인 (NFR-001, AC-012): 모든 화면 동작 중 요청은 앱 번들 폴더의 file: 뿐,
// 외부 주소 fetch·이미지 로드 거절, 빌드 결과 index.html 의 CSP, 네트워크 없는 상태의 동작, 글꼴은 앱 파일에서 로드.
// 요청은 Playwright 가 창 단위로 관찰한다 (Chromium 프로세스 자체의 요청은 보이지 않는다, 수동 TC-132).
// 관찰 시작 뒤에 화면을 다시 불러(reload) 첫 로드의 요청(문서, 스크립트, 스타일, 글꼴)도 관찰에 넣는다.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  boardCard,
  clickSave,
  closeDialogWithCancel,
  column,
  createCardViaDialog,
  dialog,
  moveViaMenu,
  openCardDialog,
  saveIndicator,
  seedCard,
  seedJson,
  titleInput,
  today,
  waitForBoard,
} from './support/board-page'
import { APP_ROOT, BUNDLE_URL_PREFIX, withApp } from './support/launch-app'
import type { LaunchedApp } from './support/launch-app'
import { observeRequests, tryExternalFetch } from './support/network-observer'
import type { RequestObserver } from './support/network-observer'

const EXTERNAL_URL = 'https://example.com/'

/** 번들 폴더 안의 file: 주소인지 (Windows 라 대소문자를 구분하지 않는다). */
function isBundleUrl(url: string): boolean {
  return url.toLowerCase().startsWith(BUNDLE_URL_PREFIX.toLowerCase())
}

/** 앱 안으로 허용되는 주소: 번들 폴더의 file: 이거나 data: (CSP 가 이미지·글꼴에 허용한 인라인 자원). */
function allowedUrl(url: string): boolean {
  return isBundleUrl(url) || url.startsWith('data:')
}

/** 관찰한 요청 중 번들 폴더 밖(또는 file: 이 아닌) 주소. 0건이어야 한다. */
function outsideBundle(observer: RequestObserver): string[] {
  return observer.requests.map((request) => request.url).filter((url) => !allowedUrl(url))
}

/** 관찰을 시작하고 화면을 다시 불러 첫 로드의 요청까지 관찰에 넣는다. 관찰이 실제로 일하는지(번들 요청이 보이는지) 단언한다. */
async function observeWithReload(page: Page): Promise<RequestObserver> {
  const observer = observeRequests(page)
  await page.reload()
  await waitForBoard(page)
  expect(observer.requests.length).toBeGreaterThan(0)
  expect(observer.requests.some((request) => request.url.toLowerCase().endsWith('/index.html'))).toBe(true)
  return observer
}

/** 외부 요청이 하나도 없었다는 단언. 준비 조건(main 의 차단 장치가 일한 흔적)이 없음도 함께 본다: 시도 자체가 없었다. */
function expectNoExternalRequests(launched: LaunchedApp, observer: RequestObserver): void {
  expect(outsideBundle(observer)).toEqual([])
  expect(observer.requests.every((request) => allowedUrl(request.url))).toBe(true)
  expect(observer.failures).toEqual([])
  expect(launched.stderrLines.filter((line) => /blocked (request|navigation|new window)/i.test(line))).toEqual([])
}

function searchBox(page: Page): Locator {
  return page.getByRole('textbox', { name: '검색' })
}

function goTo(page: Page, name: '보드' | '캘린더' | '보관함'): Promise<void> {
  return page.locator('.sidebar-nav__item', { hasText: name }).click()
}

function themeRadio(page: Page, name: '어두운 판' | '밝은 판'): Locator {
  return page.locator('.sidebar-theme').getByRole('radio', { name, exact: true })
}

test.describe('offline', () => {
  test('TC-125 모든 화면 동작을 하는 동안 요청은 앱 파일(file:)뿐이다', async () => {
    const archivedAt = '2026-10-25T09:00:00.000Z'
    const json = seedJson([
      seedCard(1, { title: '수정할 카드', kind: 'bug', priority: 'high' }),
      seedCard(2, { title: '보관할 카드', status: 'done' }),
      seedCard(3, { title: '보관함에서 지울 카드', status: 'done', archivedAt }),
      seedCard(4, { title: '대화상자로 지울 카드' }),
    ])
    await withApp({ seedJson: json }, async (launched) => {
      const { page } = launched
      await waitForBoard(page)
      const observer = await observeWithReload(page)

      // 카드 만들기 (마감일은 오늘)
      await createCardViaDialog(page, { title: '새 카드', dueDate: today(), description: '새 설명' })
      await expect(boardCard(page, '새 카드')).toHaveCount(1)

      // 수정
      await openCardDialog(page, '수정할 카드')
      await titleInput(page).fill('수정된 카드')
      await clickSave(page)
      await expect(dialog(page)).toHaveCount(0)
      await expect(boardCard(page, '수정된 카드')).toHaveCount(1)

      // 상태 변경
      await moveViaMenu(page, '새 카드', '진행 중으로 옮기기')
      await expect(column(page, 'in_progress').locator('.card-item', { hasText: '새 카드' })).toHaveCount(1)

      // 기록 추가
      await openCardDialog(page, '수정된 카드')
      await dialog(page).getByRole('textbox', { name: '기록 내용' }).fill('오프라인 기록')
      await dialog(page).getByRole('button', { name: '기록 추가', exact: true }).click()
      await expect(dialog(page).locator('.progress-log__item')).toHaveCount(1)
      await closeDialogWithCancel(page)

      // 보관
      await boardCard(page, '보관할 카드').getByRole('button', { name: '보관', exact: true }).click()
      await boardCard(page, '보관할 카드').getByRole('button', { name: '보관 확인', exact: true }).click()
      await expect(boardCard(page, '보관할 카드')).toHaveCount(0)

      // 삭제 (대화상자)
      await openCardDialog(page, '대화상자로 지울 카드')
      await dialog(page).getByRole('button', { name: '삭제', exact: true }).click()
      await dialog(page).getByRole('button', { name: '삭제 확인', exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(boardCard(page, '대화상자로 지울 카드')).toHaveCount(0)

      // 검색·필터
      await searchBox(page).fill('수정')
      await expect(page.locator('.card-item')).toHaveCount(1)
      await searchBox(page).fill('')
      await page
        .locator('.sidebar-filter')
        .getByRole('radio', { name: /^개발 버그/ })
        .click()
      await expect(page.locator('.card-item')).toHaveCount(1)
      // 선택된 행을 다시 눌러도 해제되지 않으므로 종류 목록의 `전체`로 조건을 푼다.
      await page
        .getByRole('radiogroup', { name: '종류' })
        .getByRole('radio', { name: /^전체/ })
        .click()
      await expect(page.locator('.card-item')).toHaveCount(2)

      // 캘린더·보관함 이동, 보관함 행의 삭제
      await goTo(page, '캘린더')
      await expect(page.locator('.day-cell').first()).toBeVisible()
      await goTo(page, '보관함')
      await expect(page.locator('.archive-row')).toHaveCount(2)
      const row = page.locator('.archive-row', { hasText: '보관함에서 지울 카드' })
      await row.getByRole('button', { name: '삭제', exact: true }).click()
      await page.locator('.archive-row--confirm').getByRole('button', { name: '삭제 확인', exact: true }).click()
      await expect(page.locator('.archive-row')).toHaveCount(1)
      await goTo(page, '보드')

      // 판 전환 (왕복): 처음 판이 밝은 판이므로 어두운 판부터 고른다.
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await themeRadio(page, '어두운 판').click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await themeRadio(page, '밝은 판').click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')

      // 요청은 번들 폴더의 file: 뿐이다.
      expect(observer.requests.length).toBeGreaterThan(0)
      expectNoExternalRequests(launched, observer)
      expect(observer.requests.filter((request) => /^(https?|wss?|ftp):/i.test(request.url))).toEqual([])
      observer.stop()
    })
  })

  test('TC-126 화면에서 외부 주소로 보내는 요청과 외부 자원 로드는 거절된다', async () => {
    await withApp({}, async (launched) => {
      const { page } = launched
      await waitForBoard(page)
      const observer = observeRequests(page)

      // 문서 안에서 CSP 위반이 일어나는지 기록한다 (준비 조건: 차단 장치가 실제로 일했다).
      await page.evaluate((): void => {
        const holder = globalThis as unknown as {
          __violations?: string[]
          addEventListener(
            type: string,
            listener: (event: { blockedURI: string; violatedDirective: string }) => void,
          ): void
        }
        holder.__violations = []
        holder.addEventListener('securitypolicyviolation', (event) => {
          holder.__violations?.push(`${event.violatedDirective} ${event.blockedURI}`)
        })
      })

      const fetchResult = await tryExternalFetch(page, EXTERNAL_URL)
      expect(fetchResult.rejected, fetchResult.message).toBe(true)

      const imageUrl = `${EXTERNAL_URL}image.png`
      const imageResult = await page.evaluate((src: string): Promise<string> => {
        const dom = globalThis as unknown as {
          Image: new () => { onload: (() => void) | null; onerror: (() => void) | null; src: string }
        }
        return new Promise<string>((done) => {
          const image = new dom.Image()
          image.onload = () => done('load')
          image.onerror = () => done('error')
          image.src = src
        })
      }, imageUrl)
      expect(imageResult).toBe('error')

      // 준비 조건: fetch 와 이미지 모두 정책(connect-src 'none', img-src 'self' data:)이 거절했다.
      await expect
        .poll(() => page.evaluate(() => (globalThis as unknown as { __violations?: string[] }).__violations ?? []))
        .toEqual(expect.arrayContaining([expect.stringContaining('connect-src'), expect.stringContaining('img-src')]))

      // 외부 주소에서 성공한 응답이 없다.
      expect(observer.responsesFor((url) => url.startsWith(EXTERNAL_URL))).toEqual([])
      expect(observer.responses.filter((response) => !allowedUrl(response.url))).toEqual([])
      observer.stop()

      // 빌드 결과 index.html 에는 CSP 메타 태그가 head 안에 있고 원본에는 없다.
      const built = await readFile(join(APP_ROOT, 'out', 'renderer', 'index.html'), 'utf8')
      const source = await readFile(join(APP_ROOT, 'src', 'renderer', 'index.html'), 'utf8')
      const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(built)?.[1] ?? ''
      const meta = /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/i.exec(head)?.[0] ?? ''
      expect(meta, '빌드 결과 head 에 CSP 메타 태그').not.toBe('')
      const policy = meta.replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      expect(policy).toContain("default-src 'self'")
      expect(policy).toContain("connect-src 'none'")
      expect(source).not.toMatch(/Content-Security-Policy/i)
    })
  })

  test('TC-127 네트워크가 없는 상태에서도 카드 만들기, 상태 변경, 캘린더 보기가 된다', async () => {
    await withApp({}, async (launched) => {
      const { page } = launched
      await waitForBoard(page)

      await page.context().setOffline(true)
      // 준비 조건: 창이 정말 오프라인이다.
      await expect
        .poll(() => page.evaluate(() => (globalThis as unknown as { navigator: { onLine: boolean } }).navigator.onLine))
        .toBe(false)
      const externalWhileOffline = await tryExternalFetch(page, EXTERNAL_URL)
      expect(externalWhileOffline.rejected).toBe(true)

      const observer = await observeWithReload(page)
      await expect
        .poll(() => page.evaluate(() => (globalThis as unknown as { navigator: { onLine: boolean } }).navigator.onLine))
        .toBe(false)

      // 카드 만들기 -> 진행 중으로 옮기기 -> 캘린더 열기
      await createCardViaDialog(page, { title: '오프라인 카드', dueDate: today() })
      await expect(column(page, 'todo').locator('.card-item', { hasText: '오프라인 카드' })).toHaveCount(1)
      await moveViaMenu(page, '오프라인 카드', '진행 중으로 옮기기')
      await expect(column(page, 'in_progress').locator('.card-item', { hasText: '오프라인 카드' })).toHaveCount(1)
      await goTo(page, '캘린더')
      await expect(
        page.locator(`.day-cell[data-date="${today()}"]`).locator('.calendar-chip', { hasText: '오프라인 카드' }),
      ).toHaveCount(1)
      await expect(saveIndicator(page)).toHaveText('내 PC에 저장됨')

      expectNoExternalRequests(launched, observer)
      observer.stop()
    })
  })

  test('TC-128 글꼴은 앱에 포함된 파일에서 로드되고 외부 글꼴 요청은 없다', async () => {
    const json = seedJson([seedCard(1, { title: '한글 문구가 보이는 카드' })])
    await withApp({ seedJson: json }, async (launched) => {
      const { page } = launched
      await waitForBoard(page)
      const observer = await observeWithReload(page)
      await expect(boardCard(page, '한글 문구가 보이는 카드')).toHaveCount(1)

      // 문서의 글꼴 로드 상태: 앱 글꼴(SUIT)이 로드 완료다.
      const fonts = await page.evaluate(async (): Promise<{ family: string; status: string }[]> => {
        const doc = (
          globalThis as unknown as {
            document: {
              fonts: { ready: Promise<unknown>; forEach(cb: (face: { family: string; status: string }) => void): void }
            }
          }
        ).document
        await doc.fonts.ready
        const faces: { family: string; status: string }[] = []
        doc.fonts.forEach((face) => faces.push({ family: face.family, status: face.status }))
        return faces
      })
      const suit = fonts.filter((face) => /SUIT/i.test(face.family))
      expect(suit.length).toBeGreaterThan(0)
      expect(suit.map((face) => face.status)).toEqual(suit.map(() => 'loaded'))

      // 글꼴 요청은 번들 폴더의 file: woff2 이고 외부 글꼴 요청은 없다.
      const fontRequests = observer.requests.filter(
        (request) => request.resourceType === 'font' || /\.woff2?(\?|$)/i.test(request.url),
      )
      expect(fontRequests.length).toBeGreaterThan(0) // 준비 조건: 글꼴 요청이 관찰되었다
      for (const request of fontRequests) {
        expect(request.url.startsWith('file:')).toBe(true)
        expect(isBundleUrl(request.url)).toBe(true)
        expect(request.url).toMatch(/\.woff2$/i)
      }
      expect(observer.requests.filter((request) => /^https?:/i.test(request.url))).toEqual([])
      expectNoExternalRequests(launched, observer)
      observer.stop()
    })
  })
})
