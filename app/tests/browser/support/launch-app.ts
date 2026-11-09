// 시험마다 새 임시 폴더를 만들어 `--user-data-dir=<임시 폴더>`로 앱을 구동·종료·재구동하는 도우미.
// 앱에 시험 전용 코드를 두지 않는다 (ADR-012). 종료는 try/finally 로 보장하고 임시 폴더는 시험이 끝나면 지운다 (FE-011).
// 실제 사용자 데이터 폴더(%APPDATA%\self-canban, self-canban-dev)는 건드리지 않는다.

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { DATA_FILE_NAME } from '../../../src/main/store/data-file-names'

/** 앱 루트(app/). */
export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
/** 빌드된 main 진입. test:e2e 는 빌드 뒤에만 의미가 있다. */
export const MAIN_ENTRY = join(APP_ROOT, 'out', 'main', 'index.js')
/** 앱 번들 폴더(out/renderer)의 file: 주소 접두사. 끝에 / 가 있다. */
export const BUNDLE_URL_PREFIX = pathToFileURL(join(APP_ROOT, 'out', 'renderer') + '/').href
/** 앱 번들 폴더의 index.html 주소. */
export const BUNDLE_INDEX_URL = pathToFileURL(join(APP_ROOT, 'out', 'renderer', 'index.html')).href

export type LaunchOptions = {
  /** 쓸 사용자 데이터 폴더. 없으면 새 임시 폴더를 만들고 종료 때 지운다. 재구동 때는 앞 구동의 폴더를 넘긴다. */
  userDataDir?: string
  /** 구동 전에 저장 파일(kanban-data.json)로 넣을 내용. */
  seedJson?: string
}

export type LaunchedApp = {
  app: ElectronApplication
  /** 첫 창. */
  page: Page
  userDataDir: string
  /** 이 구동이 만든 임시 폴더이면 true (closeApp 이 지운다). */
  ownsDir: boolean
  /** Electron main 프로세스 id. 시험이 띄운 프로세스만 정리하려고 남긴다. */
  pid: number
  /** main 프로세스의 stderr 줄 (console.error 포함). 차단 장치가 실제로 일했는지 보는 데 쓴다. */
  stderrLines: string[]
}

const CLOSE_TIMEOUT_MS = 10_000

/** 임시 폴더를 만든다. */
export async function makeTempDir(prefix = 'self-canban-e2e-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

/** 폴더를 지운다. Windows 에서 프로세스가 막 끝나 잠겨 있을 수 있어 몇 번 다시 해 본다. */
export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}

/** 저장 파일을 넣는다. 구동 전에 부른다. */
export async function seedDataFile(dir: string, json: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, DATA_FILE_NAME), json, 'utf8')
}

/** 저장 파일을 읽는다. 없으면 null. */
export async function readDataFile(dir: string): Promise<string | null> {
  try {
    return await readFile(join(dir, DATA_FILE_NAME), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** 앱을 구동하고 첫 창이 앱 번들 폴더의 화면을 불러올 때까지 기다린다. */
export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const ownsDir = options.userDataDir === undefined
  const userDataDir = options.userDataDir ?? (await makeTempDir())
  let launched: ElectronApplication | null = null
  try {
    if (options.seedJson !== undefined) await seedDataFile(userDataDir, options.seedJson)

    // 개발 서버 주소가 환경에 남아 있으면 앱이 개발 실행으로 동작하므로 지운다.
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && key !== 'ELECTRON_RENDERER_URL' && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value
    }

    launched = await electron.launch({
      args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
      cwd: APP_ROOT,
      env,
      timeout: 20_000,
    })

    const stderrLines: string[] = []
    const child = launched.process()
    let pending = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      pending += chunk.toString('utf8')
      const parts = pending.split(/\r?\n/)
      pending = parts.pop() ?? ''
      stderrLines.push(...parts)
    })
    const pid = child.pid
    if (pid === undefined) throw new Error('Electron 프로세스 id 를 알 수 없다')
    console.log(`[launch-app] electron pid=${pid} userDataDir=${userDataDir}`)

    const page = await launched.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // 준비 조건 단언: --user-data-dir 이 app.getPath('userData')에 반영되었고, 화면은 앱 번들 폴더의 index.html 이다.
    const reportedDir = await launched.evaluate(({ app }) => app.getPath('userData'))
    if (resolve(reportedDir).toLowerCase() !== resolve(userDataDir).toLowerCase()) {
      throw new Error(`--user-data-dir 이 userData 에 반영되지 않았다: userData=${reportedDir} 기대=${userDataDir}`)
    }
    if (page.url().toLowerCase() !== BUNDLE_INDEX_URL.toLowerCase()) {
      throw new Error(`첫 창 주소가 앱 번들 index.html 이 아니다: ${page.url()}`)
    }

    return { app: launched, page, userDataDir, ownsDir, pid, stderrLines }
  } catch (error) {
    // 구동 도중 실패해도 프로세스와 임시 폴더를 남기지 않는다.
    if (launched !== null) forceKill(launched)
    if (ownsDir) await removeDir(userDataDir)
    throw error
  }
}

function forceKill(app: ElectronApplication): void {
  const pid = app.process().pid
  if (pid === undefined) return
  try {
    process.kill(pid)
  } catch {
    // 이미 끝났다.
  }
}

/** 앱을 닫는다. 정상 종료가 제한 시간 안에 안 되면 이 앱의 프로세스만 강제 종료한다. 이 구동이 만든 임시 폴더는 지운다. */
export async function closeApp(launched: LaunchedApp): Promise<void> {
  const { app } = launched
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      app.close(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('앱 종료 제한 시간 초과')), CLOSE_TIMEOUT_MS)
      }),
    ])
  } catch {
    forceKill(app)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (launched.ownsDir) await removeDir(launched.userDataDir)
  }
}

/** 시험 본문을 돌리고 어떤 결과이든 앱을 닫는다. */
export async function withApp<T>(options: LaunchOptions, body: (launched: LaunchedApp) => Promise<T>): Promise<T> {
  const launched = await launchApp(options)
  try {
    return await body(launched)
  } finally {
    await closeApp(launched)
  }
}
