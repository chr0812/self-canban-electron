import type * as FsPromises from 'node:fs/promises'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// node:fs/promises 의 rename 만 바꿔 끼울 수 있게 한다. 기본은 실제 rename 이다.
const hoisted = vi.hoisted(() => ({
  renameImpl: null as null | ((from: string, to: string) => Promise<void>),
  renameCalls: 0,
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  return {
    ...actual,
    rename: (from: string, to: string) => {
      hoisted.renameCalls++
      return (hoisted.renameImpl ?? actual.rename)(from, to)
    },
  }
})

import { createNodeFileSystem, ensureDirectory } from '../../../src/main/store/node-file-system'

function osError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: injected`), { code })
}

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nfs-test-'))
  hoisted.renameImpl = null
  hoisted.renameCalls = 0
})

afterEach(async () => {
  hoisted.renameImpl = null
  await rm(dir, { recursive: true, force: true })
})

describe('NodeFileSystem', () => {
  it('TC-056 실제 임시 폴더에서 파일 다섯 동작이 동작하고 이름 바꾸기가 기존 파일을 덮어쓴다', async () => {
    const fs = createNodeFileSystem()
    const a = join(dir, 'a.json')
    const b = join(dir, 'b.json')
    const c = join(dir, 'c.json')
    const text = '{"제목":"일정관리 카드","내용":"한글 UTF-8 \u{1F600}"}'

    // 쓰고 읽기 (UTF-8)
    await fs.writeFileSynced(a, text)
    expect(await fs.readFile(a)).toBe(text)
    expect(await readFile(a, 'utf8')).toBe(text)

    // 덮어쓰며 다시 쓰기: 이전 내용이 남지 않는다
    await fs.writeFileSynced(a, '짧음')
    expect(await fs.readFile(a)).toBe('짧음')
    await fs.writeFileSynced(a, text)

    // 존재 확인
    expect(await fs.exists(a)).toBe(true)
    expect(await fs.exists(join(dir, 'none.json'))).toBe(false)

    // 덮어쓰며 복사
    await fs.writeFileSynced(b, '옛 내용')
    await fs.copyFile(a, b)
    expect(await fs.readFile(b)).toBe(text)
    expect(await fs.readFile(a)).toBe(text)

    // 이미 있는 파일 위로 이름 바꾸기
    await fs.writeFileSynced(c, '새 내용')
    await fs.rename(c, a)
    expect(await fs.readFile(a)).toBe('새 내용')
    expect(await fs.exists(c)).toBe(false)

    // 없는 파일 읽기는 ENOENT
    await expect(fs.readFile(join(dir, 'none.json'))).rejects.toMatchObject({ code: 'ENOENT' })

    // 폴더 만들기: 중첩 폴더, 이미 있어도 오류 없음
    const nested = join(dir, 'x', 'y')
    await ensureDirectory(nested)
    await ensureDirectory(nested)
    await fs.writeFileSynced(join(nested, 'f.json'), 'ok')
    expect(await fs.exists(join(nested, 'f.json'))).toBe(true)
  })

  it('TC-140 이름 바꾸기가 일시 오류로 한 번 실패해도 다시 시도해 성공한다', async () => {
    const fs = createNodeFileSystem()
    const target = join(dir, 'target.json')
    const source = join(dir, 'source.json')
    await writeFile(target, '옛 내용', 'utf8')
    await writeFile(source, '새 내용', 'utf8')

    // 1) 첫 호출만 EBUSY, 이후는 실제 rename
    const { rename: realRename } = await vi.importActual<typeof FsPromises>('node:fs/promises')
    let injected = 0
    hoisted.renameImpl = (from, to) => {
      if (injected === 0) {
        injected++
        return Promise.reject(osError('EBUSY'))
      }
      return realRename(from, to)
    }
    await expect(fs.rename(source, target)).resolves.toBeUndefined()
    expect(injected).toBe(1) // 준비 조건: 실제로 EBUSY 가 주입되었다
    expect(hoisted.renameCalls).toBe(2) // 처음 1회 실패 + 다시 시도 1회 성공
    expect(await readFile(target, 'utf8')).toBe('새 내용')

    // 2) 모든 호출이 EBUSY: 최대 횟수 안에서 다시 시도한 뒤 마지막 오류로 실패, 대상은 그대로
    await writeFile(source, '또 새 내용', 'utf8')
    hoisted.renameCalls = 0
    hoisted.renameImpl = () => Promise.reject(osError('EBUSY'))
    await expect(fs.rename(source, target)).rejects.toMatchObject({ code: 'EBUSY' })
    expect(hoisted.renameCalls).toBeGreaterThanOrEqual(3)
    expect(hoisted.renameCalls).toBeLessThanOrEqual(5)
    expect(await readFile(target, 'utf8')).toBe('새 내용')
    expect(await readFile(source, 'utf8')).toBe('또 새 내용')

    // EPERM, EACCES 도 같은 재시도 대상이다
    for (const code of ['EPERM', 'EACCES']) {
      hoisted.renameCalls = 0
      hoisted.renameImpl = () => Promise.reject(osError(code))
      await expect(fs.rename(source, target)).rejects.toMatchObject({ code })
      expect(hoisted.renameCalls).toBeGreaterThanOrEqual(3)
      expect(hoisted.renameCalls).toBeLessThanOrEqual(5)
    }

    // 3) 원본이 없어 ENOENT: 다시 시도하지 않고 바로 실패 (호출 1회)
    hoisted.renameImpl = null
    hoisted.renameCalls = 0
    await expect(fs.rename(join(dir, 'missing.json'), target)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(hoisted.renameCalls).toBe(1)
    expect(await readFile(target, 'utf8')).toBe('새 내용')
  })
})
