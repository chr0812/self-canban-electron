// 메모리에서 도는 FileSystemPort. 실제 디스크 없이 저장·읽기를 시험한다.
// 폴더는 흉내 내지 않는다: 경로 문자열 전체가 키다 (같은 문자열이면 같은 파일).

import type { FileSystemPort } from '../../../src/main/store/file-system-port'

/** files 는 현재 내용을 그대로 보여 주는 살아 있는 Map 이다 (시험이 직접 읽고 심을 수 있다). */
export type MemoryFileSystem = FileSystemPort & { files: Map<string, string> }

function enoent(op: string, path: string): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory, ${op} '${path}'`), { code: 'ENOENT' })
}

export function createMemoryFileSystem(initialFiles: Record<string, string> = {}): MemoryFileSystem {
  const files = new Map<string, string>(Object.entries(initialFiles))

  return {
    files,
    readFile(path) {
      const data = files.get(path)
      return data === undefined ? Promise.reject(enoent('open', path)) : Promise.resolve(data)
    },
    exists(path) {
      return Promise.resolve(files.has(path))
    },
    writeFileSynced(path, data) {
      files.set(path, data)
      return Promise.resolve()
    },
    copyFile(from, to) {
      const data = files.get(from)
      if (data === undefined) return Promise.reject(enoent('copyfile', from))
      files.set(to, data)
      return Promise.resolve()
    },
    rename(from, to) {
      const data = files.get(from)
      if (data === undefined) return Promise.reject(enoent('rename', from))
      files.set(to, data)
      files.delete(from)
      return Promise.resolve()
    },
  }
}
