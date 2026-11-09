// KanbanStore 읽기 실패 잠금 시험 (AC-032, NFR-002): 읽기 실패 상태에서 모든 호출이 STORE_LOCKED 이고
// 쓰기·복사·이름 바꾸기 호출이 0건이며, 다시 읽기는 파일을 쓰지 않고 파일이 고쳐지면 정상 상태가 된다.

import { describe, expect, test } from 'vitest'
import { dataFilePath } from '../../../src/main/store/data-file-names'
import { createKanbanStore } from '../../../src/main/store/kanban-store'
import type { DataFile } from '../../../src/shared/types/card'
import { fixedClock, makeCard, makeDoc, sequentialIds } from '../support/builders'
import { createFaultFileSystem } from '../support/fault-fs'
import { createMemoryFileSystem } from '../support/memory-fs'

const DIR = 'data-dir'
const MAIN = dataFilePath(DIR, 'kanban-data.json')
const BROKEN = '{"schemaVersion": 2, "cards": [' // 중간에 잘린 파일
const toText = (doc: DataFile) => `${JSON.stringify(doc, null, 2)}\n`

function setup(files: Record<string, string>) {
  const memory = createMemoryFileSystem(files)
  const fs = createFaultFileSystem(memory)
  const store = createKanbanStore({ dataDir: DIR, fs, clock: fixedClock(), newId: sequentialIds(), processId: 5 })
  return { memory, fs, store }
}

describe('KanbanStore 읽기 실패 잠금', () => {
  test('TC-054 읽기 실패 상태에서는 모든 호출이 STORE_LOCKED이고 쓰기 호출이 0건이다', async () => {
    const { memory, fs, store } = setup({ [MAIN]: BROKEN })
    const status = await store.open()
    // 준비 조건: 읽기 실패 상태이고 원인이 보고된다.
    expect(status).toMatchObject({ state: 'read_failed', failure: { code: 'JSON_PARSE_FAILED', dataFilePath: MAIN } })
    expect(store.getStatus()).toEqual(status)

    const results = [
      store.list({ scope: 'board' }),
      store.get('c1'),
      await store.create({ title: '새 카드' }),
      await store.update('c1', { title: '고침' }),
      await store.changeStatus('c1', 'done'),
      await store.archive('c1'),
      await store.delete('c1'),
      await store.addProgress('c1', { content: '기록' }),
      store.getSettings(),
      await store.setTheme('light'),
    ]
    expect(results).toHaveLength(10)
    for (const result of results) {
      expect(result).toMatchObject({ ok: false, error: { code: 'STORE_LOCKED' } })
    }

    expect(fs.writeCalls()).toEqual([])
    expect(memory.files.get(MAIN)).toBe(BROKEN)
    expect([...memory.files.keys()]).toEqual([MAIN])
    await store.close()
    expect(fs.writeCalls()).toEqual([])
  })

  test('TC-055 다시 읽기는 파일을 쓰지 않고, 파일이 고쳐지면 정상 상태가 된다', async () => {
    const { memory, fs, store } = setup({ [MAIN]: BROKEN })
    await store.open()

    // 파일이 그대로인 채 다시 읽기: 여전히 읽기 실패 (원인 포함).
    const still = await store.retryOpen()
    expect(still).toMatchObject({
      state: 'read_failed',
      failure: { code: 'JSON_PARSE_FAILED', dataFilePath: MAIN, backup: 'absent' },
    })
    expect(store.getStatus()).toEqual(still)
    expect(store.list({ scope: 'board' })).toMatchObject({ ok: false, error: { code: 'STORE_LOCKED' } })
    // 준비 조건: 다시 읽기가 실제로 파일을 다시 읽었다.
    expect(fs.callLog.filter((c) => c.op === 'readFile' && c.path === MAIN)).toHaveLength(2)

    // 사용자가 파일을 유효한 문서로 고친 뒤 다시 읽기.
    const fixed = makeDoc({ cards: [makeCard({ id: 'c1', title: '고친 뒤 카드' })] })
    memory.files.set(MAIN, toText(fixed))
    const ready = await store.retryOpen()
    expect(ready).toEqual({ state: 'ready', firstRun: false, recoveredFromBackup: false, migratedFromVersion: null })
    expect(store.getStatus()).toEqual(ready)
    const listed = store.list({ scope: 'board' })
    expect(listed).toMatchObject({ ok: true, value: [{ id: 'c1', title: '고친 뒤 카드' }] })

    expect(fs.writeCalls()).toEqual([])
    expect(memory.files.get(MAIN)).toBe(toText(fixed))
  })

  test('이미 정상이면 다시 읽기는 파일을 읽지 않고 현재 상태를 돌려준다', async () => {
    const { fs, store } = setup({ [MAIN]: toText(makeDoc()) })
    const status = await store.open()
    const readsBefore = fs.callLog.length
    expect(await store.retryOpen()).toEqual(status)
    expect(fs.callLog).toHaveLength(readsBefore)
  })

  test('잠긴 동안 줄에 들어온 변경도 다시 읽기 뒤에 되살아나지 않는다', async () => {
    const { memory, fs, store } = setup({ [MAIN]: BROKEN })
    await store.open()
    const pending = store.create({ title: '잠긴 동안' })
    memory.files.set(MAIN, toText(makeDoc()))
    expect(await pending).toMatchObject({ ok: false, error: { code: 'STORE_LOCKED' } })
    await store.retryOpen()
    expect(fs.writeCalls()).toEqual([])
    expect(store.list({ scope: 'board' })).toEqual({ ok: true, value: [] })
  })
})
