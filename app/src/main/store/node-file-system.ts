// FileSystemPort 의 실제 구현. 이 모듈만 node:fs/promises 에 닿는다 (docs/05-design/05-architecture.md).
// OS 오류 코드(code)는 보존해 그대로 던진다. 변환은 DataFileRepository 가 단계와 함께 한다.

import { copyFile, mkdir, open, readFile, rename, stat } from 'node:fs/promises'
import type { FileSystemPort } from './file-system-port'

/** rename 일시 오류의 총 시도 횟수 (처음 1회 + 다시 시도 3회). */
const RENAME_MAX_ATTEMPTS = 4
/** 다시 시도 사이의 간격(ms). 설계 범위 20~50ms. */
const RENAME_RETRY_DELAY_MS = 30
/** 백신·검색 색인·클라우드 동기화가 대상 파일을 잠깐 잡을 때 나는 코드 (RK-013). */
const TRANSIENT_RENAME_CODES: ReadonlySet<string> = new Set(['EPERM', 'EBUSY', 'EACCES'])

function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = errorCode(error)
      const retryable = code !== undefined && TRANSIENT_RENAME_CODES.has(code)
      if (!retryable || attempt >= RENAME_MAX_ATTEMPTS) throw error
      await sleep(RENAME_RETRY_DELAY_MS)
    }
  }
}

export function createNodeFileSystem(): FileSystemPort {
  return {
    readFile: (path) => readFile(path, 'utf8'),

    async exists(path) {
      try {
        await stat(path)
        return true
      } catch (error) {
        if (errorCode(error) === 'ENOENT') return false
        throw error
      }
    },

    async writeFileSynced(path, data) {
      const handle = await open(path, 'w')
      try {
        await handle.writeFile(data, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
    },

    // copyFile 은 대상이 있으면 덮어쓴다 (COPYFILE_EXCL 을 주지 않는다).
    copyFile: (from, to) => copyFile(from, to),

    rename: renameWithRetry,
  }
}

/** 포트 밖의 한 번짜리 폴더 만들기. AppLifecycle 이 시작 때 부른다. 이미 있으면 그대로 둔다. */
export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}
