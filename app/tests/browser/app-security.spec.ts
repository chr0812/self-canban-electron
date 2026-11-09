// 보안 기본값의 실제 Electron 확인 (NFR-001, ADR-004, ADR-005): 노출 범위, 새 창·이동 거부, 앱 번들 폴더 밖 file: 차단.
// 화면은 스텁이어도 된다. 이 시험은 main 조립(데이터 폴더, 요청 차단, 핸들러 등록, 창 생성)과 preload 로딩을 본다.

import { expect, test } from '@playwright/test'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { BUNDLE_INDEX_URL, closeApp, launchApp, makeTempDir, removeDir, withApp } from './support/launch-app'
import { observeRequests, tryExternalFetch } from './support/network-observer'

const EXPECTED_API = {
  store: ['getStatus', 'retryOpen'],
  cards: ['archive', 'changeStatus', 'create', 'delete', 'get', 'list', 'update'],
  progress: ['add'],
  settings: ['get', 'setTheme'],
} as const

/** 1x1 PNG. 앱 번들 폴더 밖에 둘 이미지 파일의 내용이다. */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

type ApiShape = {
  topKeys: string[]
  groups: Record<string, Record<string, string>>
  typeofRequire: string
  typeofProcess: string
  typeofIpcRenderer: string
  typeofModule: string
}

test.describe('app-security', () => {
  test('TC-129 화면에 노출되는 것은 열두 개 함수뿐이고 Node 객체는 노출되지 않는다', async () => {
    await withApp({}, async ({ page, stderrLines }) => {
      const shape: ApiShape = await page.evaluate((): ApiShape => {
        const g = globalThis as unknown as Record<string, unknown>
        const kanban = (g['kanban'] ?? {}) as Record<string, Record<string, unknown>>
        const groups: Record<string, Record<string, string>> = {}
        for (const [name, group] of Object.entries(kanban)) {
          groups[name] = {}
          for (const [key, value] of Object.entries(group)) groups[name][key] = typeof value
        }
        return {
          topKeys: Object.keys(kanban).sort(),
          groups,
          typeofRequire: typeof g['require'],
          typeofProcess: typeof g['process'],
          typeofIpcRenderer: typeof g['ipcRenderer'],
          typeofModule: typeof g['module'],
        }
      })

      // 준비 조건: preload 가 불러지지 않았다는 신호가 main 로그에 없다.
      expect(stderrLines.filter((line) => /preload/i.test(line))).toEqual([])

      expect(shape.topKeys).toEqual(['cards', 'progress', 'settings', 'store'])
      for (const [name, keys] of Object.entries(EXPECTED_API)) {
        const group = shape.groups[name] ?? {}
        expect(Object.keys(group).sort(), `${name} 함수 이름`).toEqual([...keys])
        for (const key of keys) expect(group[key], `${name}.${key} 형식`).toBe('function')
      }
      const total = Object.values(shape.groups).reduce((sum, group) => sum + Object.keys(group).length, 0)
      expect(total).toBe(12)

      expect(shape.typeofRequire).toBe('undefined')
      expect(shape.typeofProcess).toBe('undefined')
      expect(shape.typeofIpcRenderer).toBe('undefined')
      expect(shape.typeofModule).toBe('undefined')
    })
  })

  test('TC-130 새 창 열기와 외부 주소로의 이동은 거부된다', async () => {
    await withApp({}, async ({ app, page, stderrLines }) => {
      const observer = observeRequests(page)
      const countWindows = (): Promise<number> =>
        app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
      expect(await countWindows()).toBe(1)

      const opened = await page.evaluate((): boolean => {
        const win = globalThis as unknown as { open: (url: string) => unknown }
        return win.open('https://example.com/') !== null
      })
      expect(opened).toBe(false)

      await page.evaluate((): void => {
        const loc = (globalThis as unknown as { location: { href: string } }).location
        loc.href = 'https://example.com/'
      })

      // 준비 조건: 차단 장치가 실제로 새 창과 이동을 거절했다는 main 로그.
      await expect
        .poll(() => stderrLines.some((line) => line.includes('blocked new window: https://example.com/')))
        .toBe(true)
      await expect
        .poll(() => stderrLines.some((line) => line.includes('blocked navigation: https://example.com/')))
        .toBe(true)

      expect(await countWindows()).toBe(1)
      expect(app.windows()).toHaveLength(1)
      expect(page.url().toLowerCase()).toBe(BUNDLE_INDEX_URL.toLowerCase())
      expect(observer.responsesFor((url) => url.startsWith('https://example.com'))).toEqual([])
      observer.stop()
    })
  })

  test('TC-154 앱 번들 폴더 밖의 file: 주소로 가는 요청과 이동은 취소된다', async () => {
    const outsideDir = await makeTempDir('self-canban-outside-')
    const launched = await launchApp()
    try {
      const { page, stderrLines } = launched
      const outsidePath = resolve(join(outsideDir, 'outside.png'))
      await writeFile(outsidePath, Buffer.from(TINY_PNG_BASE64, 'base64'))
      const outsideUrl = pathToFileURL(outsidePath).href
      const isOutside = (url: string): boolean => url.toLowerCase().endsWith('/outside.png')

      const observer = observeRequests(page)

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
      }, outsideUrl)
      expect(imageResult).toBe('error')
      // 준비 조건: 이미지 요청은 CSP 가 아니라 main 의 요청 차단 장치(onBeforeRequest)가 취소했다.
      await expect
        .poll(() => stderrLines.some((line) => /blocked request: GET file:.*outside\.png/i.test(line)))
        .toBe(true)
      expect(
        observer.failures.some((item) => isOutside(item.url) && item.errorText.includes('ERR_BLOCKED_BY_CLIENT')),
      ).toBe(true)

      const fetchResult = await tryExternalFetch(page, outsideUrl)
      expect(fetchResult.rejected, fetchResult.message).toBe(true)

      await page.evaluate((target: string): void => {
        const loc = (globalThis as unknown as { location: { href: string } }).location
        loc.href = target
      }, outsideUrl)

      // 준비 조건: 이동은 main 의 차단 장치가 거절했다 (CSP 가 아니라 will-navigate 로 막힌다).
      await expect.poll(() => stderrLines.some((line) => /blocked navigation: .*outside\.png/i.test(line))).toBe(true)

      expect(page.url().toLowerCase()).toBe(BUNDLE_INDEX_URL.toLowerCase())
      expect(launched.app.windows()).toHaveLength(1)
      expect(observer.responsesFor(isOutside)).toEqual([])
      observer.stop()
    } finally {
      await closeApp(launched)
      await removeDir(outsideDir)
    }
  })
})
