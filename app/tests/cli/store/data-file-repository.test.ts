// 저장소 읽기 시험 (FR-006 AC-011·AC-032, NFR-002, NFR-003): 본 파일 → 직전 저장본 → 처음 실행, 읽기 실패 원인 분류,
// ReadFailure 의 경로·직전 저장본 상태·변환 전 사본, 읽기만으로는 쓰지 않음, 변환 전 원본 복사.
// 파일 시스템은 memory-fs, 실패 주입과 호출 기록은 fault-fs 가 맡는다. 폴더는 흉내 내지 않고 경로 문자열이 키다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '../../../src/shared/constants'
import { dataFilePath } from '../../../src/main/store/data-file-names'
import { createDataFileRepository, type ReadOutcome } from '../../../src/main/store/data-file-repository'
import { MIGRATIONS } from '../../../src/main/store/migrations'
import type { DataFile } from '../../../src/shared/types/card'
import type { ReadFailure } from '../../../src/shared/types/result'
import { makeCard, makeDoc, makeEntry } from '../support/builders'
import { createFaultFileSystem, type FaultPlan } from '../support/fault-fs'
import { createMemoryFileSystem } from '../support/memory-fs'

const DIR = 'data-dir'
const MAIN = dataFilePath(DIR, 'kanban-data.json')
const BAK = dataFilePath(DIR, 'kanban-data.json.bak')
const PRE_V1 = dataFilePath(DIR, 'kanban-data.pre-v1.json')
const tmpOf = (pid: number) => dataFilePath(DIR, `kanban-data.json.${pid}.tmp`)

function fixtureText(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../support/fixtures/${name}`, import.meta.url)), 'utf8')
}

const V1_TEXT = fixtureText('data-v1.json')
const V2_TEXT = fixtureText('data-v2.json')
const toText = (doc: unknown) => `${JSON.stringify(doc, null, 2)}\n`
const VALID_DOC_TEXT = toText(
  makeDoc({ cards: [makeCard({ id: 'c1' })], progressEntries: [makeEntry({ cardId: 'c1' })] }),
)

function setup(files: Record<string, string>, plan: FaultPlan = []) {
  const memory = createMemoryFileSystem(files)
  const fs = createFaultFileSystem(memory, plan)
  const repo = createDataFileRepository({ fs, dataDir: DIR, processId: 1234 })
  return { memory, fs, repo }
}

function failureOf(outcome: ReadOutcome): ReadFailure {
  if (outcome.ok) throw new Error('읽기 실패여야 하는데 정상으로 열렸다')
  return outcome.failure
}

function docOf(outcome: ReadOutcome): DataFile {
  if (!outcome.ok) throw new Error(`정상이어야 하는데 읽기 실패: ${outcome.failure.code}`)
  return outcome.doc
}

const ORIGINAL_STEP_1 = MIGRATIONS[1]
afterEach(() => {
  if (ORIGINAL_STEP_1 !== undefined) MIGRATIONS[1] = ORIGINAL_STEP_1
})

describe('읽기 순서', () => {
  test('TC-037 저장 파일이 없으면 처음 실행으로 빈 보드와 밝은 판으로 열린다', async () => {
    const { fs, repo } = setup({})

    const outcome = await repo.read()

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.firstRun).toBe(true)
    expect(outcome.recoveredFromBackup).toBe(false)
    expect(outcome.migratedFromVersion).toBeNull()
    expect(outcome.doc.cards).toHaveLength(0)
    expect(outcome.doc.progressEntries).toHaveLength(0)
    expect(outcome.doc.settings.theme).toBe('light')
    expect(outcome.doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    // 준비 조건: 파일을 찾아봤다 (본 파일과 직전 저장본을 확인). 그리고 쓰기는 한 건도 없다.
    expect(fs.callLog.some((c) => c.op === 'exists' && c.path === MAIN)).toBe(true)
    expect(fs.writeCalls()).toHaveLength(0)
  })

  test('TC-038 저장한 문서를 다시 열면 카드, 기록, 설정이 모두 같다', async () => {
    const expected = JSON.parse(V2_TEXT) as DataFile
    // 준비 조건: 고정 데이터가 카드와 기록 여러 건, 판 light 다.
    expect(expected.cards.length).toBeGreaterThan(1)
    expect(expected.progressEntries.length).toBeGreaterThan(1)
    expect(expected.settings.theme).toBe('light')
    const { repo } = setup({ [MAIN]: V2_TEXT })

    const outcome = await repo.read()

    const doc = docOf(outcome)
    expect(outcome.ok && outcome.firstRun).toBe(false)
    expect(outcome.ok && outcome.migratedFromVersion).toBeNull()
    expect(doc.cards).toHaveLength(expected.cards.length)
    expect(doc.progressEntries).toHaveLength(expected.progressEntries.length)
    expect(doc).toEqual(expected)
  })

  test('TC-039 본 파일이 없고 직전 저장본이 유효하면 그것으로 열린다', async () => {
    const { memory, fs, repo } = setup({ [BAK]: V2_TEXT })
    expect(memory.files.has(MAIN)).toBe(false)

    const outcome = await repo.read()

    expect(docOf(outcome)).toEqual(JSON.parse(V2_TEXT))
    expect(outcome.ok && outcome.recoveredFromBackup).toBe(true)
    expect(outcome.ok && outcome.firstRun).toBe(false)
    expect(fs.writeCalls()).toHaveLength(0)
  })

  test('TC-040 본 파일이 정상이면 남아 있는 임시 파일은 읽지 않고 쓰기도 없다', async () => {
    const truncated = '{ "schemaVersion": 2, "cards": ['
    const { memory, fs, repo } = setup({
      [MAIN]: V2_TEXT,
      [tmpOf(1234)]: truncated,
      [tmpOf(9999)]: truncated, // 다른 프로세스 아이디로 남은 고아 임시 파일
    })
    const before = new Map(memory.files)

    const outcome = await repo.read()

    expect(docOf(outcome)).toEqual(JSON.parse(V2_TEXT))
    // 준비 조건: 본 파일은 실제로 읽었고, 임시 파일 두 개는 읽거나 확인조차 하지 않았다.
    expect(fs.callLog.some((c) => c.op === 'readFile' && c.path === MAIN)).toBe(true)
    expect(fs.callLog.some((c) => c.path === tmpOf(1234) || c.path === tmpOf(9999))).toBe(false)
    expect(fs.writeCalls()).toHaveLength(0)
    expect(new Map(memory.files)).toEqual(before)
  })

  test('TC-040 본 파일이 없고 임시 파일만 있으면 처음 실행으로 열린다', async () => {
    const { memory, fs, repo } = setup({ [tmpOf(1234)]: VALID_DOC_TEXT, [tmpOf(9999)]: '{ "cards": [' })
    expect(memory.files.has(MAIN)).toBe(false)
    expect(memory.files.has(BAK)).toBe(false)

    const outcome = await repo.read()

    const doc = docOf(outcome)
    expect(outcome.ok && outcome.firstRun).toBe(true)
    expect(doc.cards).toHaveLength(0)
    expect(fs.callLog.some((c) => c.op === 'readFile')).toBe(false)
    expect(fs.writeCalls()).toHaveLength(0)
  })

  test('본 파일이 없고 직전 저장본이 유효하지 않으면 그 직전 저장본을 읽지 못한 파일로 하는 읽기 실패다', async () => {
    const { fs, repo } = setup({ [BAK]: '{ "cards": [' })

    const failure = failureOf(await repo.read())

    expect(failure.code).toBe('JSON_PARSE_FAILED')
    expect(failure.dataFilePath).toBe(BAK)
    expect(failure.backupPath).toBe(BAK)
    expect(failure.backup).toBe('invalid')
    expect(fs.writeCalls()).toHaveLength(0)
  })
})

describe('읽기 실패 분류', () => {
  const casesByContent: { name: string; text: string; code: ReadFailure['code'] }[] = [
    { name: '(a) 빈 파일', text: '', code: 'JSON_PARSE_FAILED' },
    { name: '(b) 잘린 JSON', text: '{ "cards": [', code: 'JSON_PARSE_FAILED' },
    { name: '(d) 최상위가 배열인 JSON', text: '[]', code: 'SCHEMA_INVALID' },
    {
      name: '(e) schemaVersion 이 문자열인 JSON',
      text: toText({ ...makeDoc(), schemaVersion: '2' }),
      code: 'SCHEMA_INVALID',
    },
    {
      name: '(f) 기록이 없는 카드를 가리키는 문서',
      text: toText(makeDoc({ cards: [makeCard({ id: 'c1' })], progressEntries: [makeEntry({ cardId: 'ghost' })] })),
      code: 'INTEGRITY_VIOLATED',
    },
  ]

  test.each(casesByContent)('TC-041 $name 는 $code 읽기 실패다', async ({ text, code }) => {
    const { fs, repo } = setup({ [MAIN]: text })

    const outcome = await repo.read()

    const failure = failureOf(outcome)
    expect(failure.code).toBe(code)
    expect(failure.dataFilePath).toBe(MAIN)
    expect(failure.osCode).toBeUndefined()
    if (code === 'SCHEMA_INVALID' || code === 'INTEGRITY_VIOLATED') expect(failure.issues?.length).toBeGreaterThan(0)
    expect(fs.writeCalls()).toHaveLength(0)
  })

  test('TC-041 (c) 읽을 때 EACCES 가 나는 파일은 FILE_UNREADABLE 이고 OS 코드를 담는다', async () => {
    const { fs, repo } = setup({ [MAIN]: VALID_DOC_TEXT }, [{ op: 'readFile', nth: 1, kind: 'fail', code: 'EACCES' }])

    const failure = failureOf(await repo.read())

    // 준비 조건: 본 파일 읽기가 실제로 실패로 끝났다.
    expect(fs.callLog.find((c) => c.op === 'readFile' && c.path === MAIN)?.outcome).toBe('fail')
    expect(failure.code).toBe('FILE_UNREADABLE')
    expect(failure.osCode).toBe('EACCES')
    expect(failure.dataFilePath).toBe(MAIN)
    expect(fs.writeCalls()).toHaveLength(0)
  })

  test('변환 함수가 오류를 던지면 MIGRATION_FAILED 읽기 실패다', async () => {
    MIGRATIONS[1] = () => {
      throw new Error('변환 중 오류')
    }
    const { fs, repo } = setup({ [MAIN]: V1_TEXT })

    const failure = failureOf(await repo.read())

    expect(failure.code).toBe('MIGRATION_FAILED')
    expect(failure.dataFilePath).toBe(MAIN)
    expect(fs.writeCalls()).toHaveLength(0)
  })

  test('TC-042 본 파일을 읽지 못하면 직전 저장본이 유효해도 자동으로 쓰지 않는다', async () => {
    const corrupt = '{ "schemaVersion": 2, "cards": ['
    const { memory, fs, repo } = setup({ [MAIN]: corrupt, [BAK]: V2_TEXT })

    const outcome = await repo.read()

    const failure = failureOf(outcome)
    expect(failure.code).toBe('JSON_PARSE_FAILED')
    expect(failure.backup).toBe('valid')
    // 카드는 직전 저장본으로 채워지지 않는다: 읽기 실패 결과에는 문서가 없다.
    expect(outcome).not.toHaveProperty('doc')
    expect(fs.writeCalls()).toHaveLength(0)
    expect(memory.files.get(MAIN)).toBe(corrupt)
    expect(memory.files.get(BAK)).toBe(V2_TEXT)
  })
})

describe('읽기만으로는 쓰지 않음', () => {
  test('TC-043 파일을 읽기만 해서는 어떤 파일도 바뀌지 않는다 (이전 버전 변환 포함)', async () => {
    const { memory, fs, repo } = setup({ [MAIN]: V1_TEXT })
    expect((JSON.parse(V1_TEXT) as { schemaVersion: number }).schemaVersion).toBe(1)

    const outcome = await repo.read()

    const doc = docOf(outcome)
    expect(outcome.ok && outcome.migratedFromVersion).toBe(1)
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc.settings.theme).toBe('light')
    // 준비 조건: 본 파일을 실제로 읽었다. 그 위에서 쓰기·복사·이름 바꾸기가 0건이다.
    expect(fs.callLog.some((c) => c.op === 'readFile' && c.path === MAIN)).toBe(true)
    expect(fs.callLog.filter((c) => ['writeFileSynced', 'copyFile', 'rename'].includes(c.op))).toHaveLength(0)
    expect(fs.writeCalls()).toHaveLength(0)
    expect([...memory.files.keys()]).toEqual([MAIN])
    expect(memory.files.get(MAIN)).toBe(V1_TEXT)
  })

  test('TC-044 더 새로운 버전의 파일은 읽지 않고 읽기 실패로 둔다', async () => {
    const newer = toText({ ...makeDoc(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })
    const { memory, fs, repo } = setup({ [MAIN]: newer })

    const failure = failureOf(await repo.read())

    expect(failure.code).toBe('SCHEMA_TOO_NEW')
    expect(failure.fileSchemaVersion).toBe(CURRENT_SCHEMA_VERSION + 1)
    expect(failure.dataFilePath).toBe(MAIN)
    expect(fs.callLog.some((c) => c.op === 'readFile' && c.path === MAIN)).toBe(true)
    expect(fs.writeCalls()).toHaveLength(0)
    expect(memory.files.get(MAIN)).toBe(newer)
  })
})

describe('읽기 실패 정보', () => {
  const corrupt = '{ "schemaVersion": 2, "cards": ['
  const cases: {
    name: string
    files: Record<string, string>
    plan: FaultPlan
    backup: ReadFailure['backup']
    copies: string[]
  }[] = [
    {
      name: '(a) 유효한 직전 저장본과 변환 전 사본',
      files: { [MAIN]: corrupt, [BAK]: V2_TEXT, [PRE_V1]: V1_TEXT },
      plan: [],
      backup: 'valid',
      copies: [PRE_V1],
    },
    {
      name: '(b) 손상된 직전 저장본',
      files: { [MAIN]: corrupt, [BAK]: '{ "cards": [' },
      plan: [],
      backup: 'invalid',
      copies: [],
    },
    { name: '(c) 직전 저장본 없음', files: { [MAIN]: corrupt }, plan: [], backup: 'absent', copies: [] },
    {
      name: '(d) 본 파일 읽기에서 EACCES',
      files: { [MAIN]: V2_TEXT },
      plan: [{ op: 'readFile', nth: 1, kind: 'fail', code: 'EACCES' }],
      backup: 'absent',
      copies: [],
    },
  ]

  test.each(cases)(
    'TC-139 $name: 경로와 직전 저장본 상태와 변환 전 사본이 담긴다',
    async ({ files, plan, backup, copies }) => {
      const { memory, fs, repo } = setup(files, plan)
      const before = new Map(memory.files)

      const failure = failureOf(await repo.read())

      expect(failure.dataFilePath).toBe(MAIN)
      expect(failure.backupPath).toBe(BAK)
      expect(failure.backup).toBe(backup)
      expect(failure.preMigrationCopies).toEqual(copies)
      if (plan.length > 0) {
        expect(failure.code).toBe('FILE_UNREADABLE')
        expect(failure.osCode).toBe('EACCES')
        expect(fs.callLog.find((c) => c.op === 'readFile' && c.path === MAIN)?.outcome).toBe('fail')
      }
      expect(fs.writeCalls()).toHaveLength(0)
      expect(new Map(memory.files)).toEqual(before)
    },
  )
})

describe('변환 전 원본 복사', () => {
  test('TC-036 이전 버전 문서는 처음 저장하기 직전 원본이 한 번만 따로 복사된다', async () => {
    const { memory, fs, repo } = setup({ [MAIN]: V1_TEXT })

    const opened = await repo.read()
    const doc = docOf(opened)
    const ctx = { migratedFromVersion: opened.ok ? opened.migratedFromVersion : null }
    expect(ctx.migratedFromVersion).toBe(1)
    expect(memory.files.has(PRE_V1)).toBe(false)

    const firstDoc: DataFile = { ...doc, cards: doc.cards.map((c, i) => (i === 0 ? { ...c, title: '첫 변경' } : c)) }
    expect(await repo.save(firstDoc, ctx)).toEqual({ ok: true })

    // 첫 저장 직전의 본 파일(버전 1 원본)이 그대로 사본이 되고, 본 파일은 버전 2가 된다.
    expect(memory.files.get(PRE_V1)).toBe(V1_TEXT)
    expect((JSON.parse(memory.files.get(MAIN) ?? 'null') as DataFile).schemaVersion).toBe(2)

    const secondDoc: DataFile = {
      ...firstDoc,
      cards: firstDoc.cards.map((c, i) => (i === 0 ? { ...c, title: '둘째 변경' } : c)),
    }
    expect(await repo.save(secondDoc, ctx)).toEqual({ ok: true })

    // 둘째 저장은 사본을 다시 만들거나 덮어쓰지 않는다 (본 파일은 이미 버전 2라 덮어썼다면 내용이 달라진다).
    expect(fs.callLog.filter((c) => c.op === 'copyFile' && c.to === PRE_V1)).toHaveLength(1)
    expect(memory.files.get(PRE_V1)).toBe(V1_TEXT)
    const saved = JSON.parse(memory.files.get(MAIN) ?? 'null') as DataFile
    expect(saved.schemaVersion).toBe(2)
    expect(saved.cards[0]?.title).toBe('둘째 변경')
  })
})
