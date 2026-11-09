// 저장 다섯 단계 시험 (NFR-002, AC-031, NFR-003): 호출 순서, 단계별 실패, 프로세스 id 가 붙은 임시 파일, 변환 전 원본 복사.
// 파일 시스템은 memory-fs, 실패 주입과 호출 기록은 fault-fs 가 맡는다. 폴더는 흉내 내지 않고 경로 문자열이 키다.

import { describe, expect, test } from 'vitest'
import { dataFilePath } from '../../../src/main/store/data-file-names'
import { saveDataFile, type SaveDeps } from '../../../src/main/store/data-file-save'
import type { FileSystemPort } from '../../../src/main/store/file-system-port'
import type { DataFile } from '../../../src/shared/types/card'
import { makeCard, makeDoc } from '../support/builders'
import { createFaultFileSystem, type CallRecord, type FaultPlan } from '../support/fault-fs'
import { createMemoryFileSystem } from '../support/memory-fs'

const DIR = 'data-dir'
const MAIN = dataFilePath(DIR, 'kanban-data.json')
const BAK = dataFilePath(DIR, 'kanban-data.json.bak')
const PRE_V1 = dataFilePath(DIR, 'kanban-data.pre-v1.json')
const tmpOf = (pid: number) => dataFilePath(DIR, `kanban-data.json.${pid}.tmp`)

/** 저장 전 본 파일 문서와 카드 한 건을 바꾼 새 문서. */
const OLD_DOC = makeDoc({ cards: [makeCard({ id: 'c1', title: '원래 제목', status: 'todo' })] })
const NEW_DOC = makeDoc({ cards: [makeCard({ id: 'c1', title: '원래 제목', status: 'in_progress' })] })
const OLD_TEXT = `${JSON.stringify(OLD_DOC, null, 2)}\n`

function setup(plan: FaultPlan = [], files: Record<string, string> = { [MAIN]: OLD_TEXT }) {
  const memory = createMemoryFileSystem(files)
  const fs = createFaultFileSystem(memory, plan)
  const deps = (processId = 1234): SaveDeps => ({ fs, dataDir: DIR, processId })
  return { memory, fs, deps }
}

function parsedMain(files: Map<string, string>): DataFile {
  return JSON.parse(files.get(MAIN) ?? 'null') as DataFile
}

/** 호출 기록에서 exists 를 뺀 (동작, 대상) 순서. 복사·이름 바꾸기는 '원본->대상'. */
function steps(callLog: CallRecord[]): string[] {
  return callLog
    .filter((c) => c.op !== 'exists')
    .map((c) => (c.to === undefined ? `${c.op}:${c.path}` : `${c.op}:${c.path}->${c.to}`))
}

describe('저장 순서', () => {
  test('TC-034 저장은 임시 파일 쓰기, 검증, 직전본 복사, 교체 순서로 진행된다', async () => {
    const { memory, fs, deps } = setup()

    const result = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: null })

    expect(result).toEqual({ ok: true })
    expect(steps(fs.callLog)).toEqual([
      `writeFileSynced:${tmpOf(1234)}`,
      `readFile:${tmpOf(1234)}`,
      `copyFile:${MAIN}->${BAK}`,
      `rename:${tmpOf(1234)}->${MAIN}`,
    ])
    // 본 파일이 새 내용이고, 직전본에는 저장 전 내용이 남고, 임시 파일은 이름이 바뀌어 없다.
    expect(parsedMain(memory.files)).toEqual(NEW_DOC)
    expect(memory.files.get(BAK)).toBe(OLD_TEXT)
    expect(memory.files.has(tmpOf(1234))).toBe(false)
  })

  test('TC-034 본 파일이 없는 첫 저장은 복사 단계를 건너뛴다', async () => {
    const { memory, fs, deps } = setup([], {})

    const result = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: null })

    expect(result).toEqual({ ok: true })
    expect(steps(fs.callLog)).toEqual([
      `writeFileSynced:${tmpOf(1234)}`,
      `readFile:${tmpOf(1234)}`,
      `rename:${tmpOf(1234)}->${MAIN}`,
    ])
    expect(fs.callLog.some((c) => c.op === 'copyFile')).toBe(false)
    expect(parsedMain(memory.files)).toEqual(NEW_DOC)
    expect(memory.files.has(BAK)).toBe(false)
  })
})

describe('단계별 실패', () => {
  async function failAt(plan: FaultPlan, doc: DataFile = NEW_DOC) {
    const ctx = setup(plan)
    const result = await saveDataFile(ctx.deps(), doc, { migratedFromVersion: null })
    return { ...ctx, result }
  }

  /** 실패 주입이 실제로 일어났는지 (전제 단언). */
  function injected(callLog: CallRecord[], op: CallRecord['op']): CallRecord[] {
    return callLog.filter((c) => c.op === op && c.outcome === 'fail')
  }

  test('TC-035 임시 파일 쓰기가 실패하면 write_temp 이고 본 파일은 그대로다', async () => {
    const { memory, fs, result } = await failAt([{ op: 'writeFileSynced', nth: 1, kind: 'fail', code: 'ENOSPC' }])

    expect(injected(fs.callLog, 'writeFileSynced')).toHaveLength(1)
    expect(result).toEqual({ ok: false, stage: 'write_temp', osCode: 'ENOSPC' })
    expect(memory.files.get(MAIN)).toBe(OLD_TEXT)
    expect(fs.callLog.some((c) => c.op === 'rename' || c.op === 'copyFile')).toBe(false)
  })

  test('TC-035 디스크 반영 중 실패는 쓰기와 한 호출이라 write_temp 로 보고되고 본 파일은 그대로다', async () => {
    // 포트의 writeFileSynced 가 쓰기와 fsync 를 한 번에 하므로 두 단계는 호출로 구분되지 않는다.
    // 'after' 는 내용은 쓰였는데 호출자가 성공을 못 받은 시점(반영 단계에서의 실패)을 흉내 낸다.
    const { memory, fs, result } = await failAt([
      { op: 'writeFileSynced', nth: 1, kind: 'fail', code: 'EIO', when: 'after' },
    ])

    expect(injected(fs.callLog, 'writeFileSynced')).toHaveLength(1)
    expect(memory.files.has(tmpOf(1234))).toBe(true)
    expect(result).toEqual({ ok: false, stage: 'write_temp', osCode: 'EIO' })
    expect(memory.files.get(MAIN)).toBe(OLD_TEXT)
    expect(fs.callLog.some((c) => c.op === 'rename' || c.op === 'copyFile')).toBe(false)
  })

  test('TC-035 임시 파일을 다시 읽지 못하면 verify 이고 본 파일은 그대로다', async () => {
    const { memory, fs, result } = await failAt([{ op: 'readFile', nth: 1, kind: 'fail', code: 'EIO' }])

    expect(injected(fs.callLog, 'readFile')).toHaveLength(1)
    expect(result).toEqual({ ok: false, stage: 'verify', osCode: 'EIO' })
    expect(memory.files.get(MAIN)).toBe(OLD_TEXT)
    expect(fs.callLog.some((c) => c.op === 'rename' || c.op === 'copyFile')).toBe(false)
  })

  test('TC-035 다시 읽은 임시 파일이 파싱되지 않으면 verify 이고 본 파일은 그대로다', async () => {
    // 쓰기는 성공했는데 읽으면 잘린 내용이 나오는 파일 시스템.
    const memory = createMemoryFileSystem({ [MAIN]: OLD_TEXT })
    const truncating: FileSystemPort = {
      ...memory,
      readFile: async (path) => (await memory.readFile(path)).slice(0, 20),
    }
    const fs = createFaultFileSystem(truncating)

    const result = await saveDataFile({ fs, dataDir: DIR, processId: 1234 }, NEW_DOC, { migratedFromVersion: null })

    expect(fs.callLog.filter((c) => c.op === 'readFile')).toHaveLength(1)
    expect(result).toEqual({ ok: false, stage: 'verify' })
    expect(memory.files.get(MAIN)).toBe(OLD_TEXT)
    expect(fs.callLog.some((c) => c.op === 'rename' || c.op === 'copyFile')).toBe(false)
  })

  test('TC-035 다시 읽은 문서가 검증을 통과하지 못하면 verify 이고 본 파일은 그대로다', async () => {
    // 카드 id 중복: 모양은 맞지만 구조 불변식을 어긴 문서.
    const broken = makeDoc({ cards: [makeCard({ id: 'dup' }), makeCard({ id: 'dup', title: '둘째' })] })
    const { memory, fs, result } = await failAt([], broken)

    expect(fs.callLog.filter((c) => c.op === 'writeFileSynced' && c.outcome === 'ok')).toHaveLength(1)
    expect(result).toEqual({ ok: false, stage: 'verify' })
    expect(memory.files.get(MAIN)).toBe(OLD_TEXT)
    expect(fs.callLog.some((c) => c.op === 'rename' || c.op === 'copyFile')).toBe(false)
  })

  test('TC-035 직전본 복사가 실패하면 backup 이고 교체 호출은 일어나지 않으며 본 파일은 그대로다', async () => {
    const { memory, fs, result } = await failAt([{ op: 'copyFile', nth: 1, kind: 'fail', code: 'EACCES' }])

    expect(injected(fs.callLog, 'copyFile')).toHaveLength(1)
    expect(result).toEqual({ ok: false, stage: 'backup', osCode: 'EACCES' })
    expect(fs.callLog.filter((c) => c.op === 'rename')).toHaveLength(0)
    expect(memory.files.get(MAIN)).toBe(OLD_TEXT)
  })

  test('TC-035 이름 바꾸기가 실패하면 replace 이고 본 파일은 그대로다', async () => {
    const { memory, fs, result } = await failAt([{ op: 'rename', nth: 1, kind: 'fail', code: 'EPERM' }])

    expect(injected(fs.callLog, 'rename')).toHaveLength(1)
    expect(result).toEqual({ ok: false, stage: 'replace', osCode: 'EPERM' })
    expect(memory.files.get(MAIN)).toBe(OLD_TEXT)
  })

  test('TC-035 실패한 저장 뒤에도 예외는 밖으로 나오지 않고 같은 호출을 다시 하면 성공한다', async () => {
    const { memory, deps } = setup([{ op: 'writeFileSynced', nth: 1, kind: 'fail' }])

    const first = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: null })
    const second = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: null })

    expect(first).toMatchObject({ ok: false, stage: 'write_temp' })
    expect(second).toEqual({ ok: true })
    expect(parsedMain(memory.files)).toEqual(NEW_DOC)
  })
})

describe('임시 파일 이름', () => {
  test('TC-137 임시 파일 이름에 프로세스 아이디가 붙고 다른 실행의 임시 파일을 건드리지 않는다', async () => {
    const staleText = '{"schemaVersion": 2, "cards": [{"id": "잘'
    const { memory, fs, deps } = setup([], { [MAIN]: OLD_TEXT, [tmpOf(9999)]: staleText })
    const otherDoc = makeDoc({ cards: [makeCard({ id: 'c1', title: '두 번째 저장', status: 'done' })] })

    const first = await saveDataFile(deps(1234), NEW_DOC, { migratedFromVersion: null })
    const second = await saveDataFile(deps(5678), otherDoc, { migratedFromVersion: null })

    expect(first).toEqual({ ok: true })
    expect(second).toEqual({ ok: true })

    const writes = fs.callLog.filter((c) => c.op === 'writeFileSynced').map((c) => c.path)
    const reads = fs.callLog.filter((c) => c.op === 'readFile').map((c) => c.path)
    expect(writes).toEqual([tmpOf(1234), tmpOf(5678)])
    expect(reads).toEqual([tmpOf(1234), tmpOf(5678)])
    expect(tmpOf(1234)).toMatch(/kanban-data\.json\.1234\.tmp$/)
    expect(tmpOf(5678)).toMatch(/kanban-data\.json\.5678\.tmp$/)

    // 9999 번 임시 파일은 어떤 호출의 원본·대상에도 나오지 않고 내용이 그대로다.
    const touched = fs.callLog.flatMap((c) => (c.to === undefined ? [c.path] : [c.path, c.to]))
    expect(touched).not.toContain(tmpOf(9999))
    expect(memory.files.get(tmpOf(9999))).toBe(staleText)

    expect(parsedMain(memory.files)).toEqual(otherDoc)
  })
})

describe('이름 바꾸기 일시 오류', () => {
  test('TC-138 이름 바꾸기 첫 호출만 일시 오류로 실패하면 SAVE_FAILED 이고 본 파일은 그대로이며 다시 저장하면 성공한다', async () => {
    const { memory, fs, deps } = setup([{ op: 'rename', nth: 1, kind: 'fail', code: 'EBUSY' }])

    const first = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: null })

    // 전제: 첫 이름 바꾸기가 실제로 EBUSY 로 실패했다.
    expect(fs.callLog.filter((c) => c.op === 'rename' && c.outcome === 'fail')).toHaveLength(1)
    expect(first).toEqual({ ok: false, stage: 'replace', osCode: 'EBUSY' })
    expect(memory.files.get(MAIN)).toBe(OLD_TEXT)

    const second = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: null })

    expect(fs.callLog.filter((c) => c.op === 'rename')).toHaveLength(2)
    expect(second).toEqual({ ok: true })
    expect(parsedMain(memory.files)).toEqual(NEW_DOC)
  })
})

describe('변환 전 원본 복사', () => {
  const V1_TEXT = '{"schemaVersion":1,"cards":[],"progressEntries":[]}\n'

  test('변환된 문서의 첫 저장은 변환 전 원본을 pre-v{N} 로 복사하고 직전본도 만든다', async () => {
    const { memory, fs, deps } = setup([], { [MAIN]: V1_TEXT })

    const result = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: 1 })

    expect(result).toEqual({ ok: true })
    expect(memory.files.get(PRE_V1)).toBe(V1_TEXT)
    expect(memory.files.get(BAK)).toBe(V1_TEXT)
    expect(parsedMain(memory.files)).toEqual(NEW_DOC)
    expect(steps(fs.callLog)).toEqual([
      `writeFileSynced:${tmpOf(1234)}`,
      `readFile:${tmpOf(1234)}`,
      `copyFile:${MAIN}->${PRE_V1}`,
      `copyFile:${MAIN}->${BAK}`,
      `rename:${tmpOf(1234)}->${MAIN}`,
    ])
  })

  test('pre-v{N} 사본이 이미 있으면 다시 만들지 않는다', async () => {
    const { memory, fs, deps } = setup([], { [MAIN]: OLD_TEXT, [PRE_V1]: V1_TEXT })

    const result = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: 1 })

    expect(result).toEqual({ ok: true })
    expect(memory.files.get(PRE_V1)).toBe(V1_TEXT)
    expect(fs.callLog.filter((c) => c.op === 'copyFile').map((c) => c.to)).toEqual([BAK])
  })

  test('변환된 문서가 아니면 pre-v{N} 사본을 만들지 않는다', async () => {
    const { memory, deps } = setup()

    await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: null })

    expect(memory.files.has(PRE_V1)).toBe(false)
  })

  test('pre-v{N} 사본 복사가 실패하면 backup 이고 교체하지 않는다', async () => {
    const { memory, fs, deps } = setup([{ op: 'copyFile', nth: 1, kind: 'fail', code: 'ENOSPC' }], {
      [MAIN]: V1_TEXT,
    })

    const result = await saveDataFile(deps(), NEW_DOC, { migratedFromVersion: 1 })

    expect(result).toEqual({ ok: false, stage: 'backup', osCode: 'ENOSPC' })
    expect(fs.callLog.some((c) => c.op === 'rename')).toBe(false)
    expect(memory.files.get(MAIN)).toBe(V1_TEXT)
  })
})
