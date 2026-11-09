// KanbanStore 시험 (NFR-002, AC-011, AC-023, AC-040, UC-002, UC-011): 열두 화면 함수 흐름, 한 줄 처리,
// 저장 성공 뒤 다시 열기, 바뀐 것 없는 호출은 저장 안 함, 닫기 대기, 보관한 카드의 삭제.
// 파일 시스템은 memory-fs, 호출 기록은 fault-fs, 지연은 이 파일의 대역이 맡는다.

import { describe, expect, test } from 'vitest'
import { dataFilePath } from '../../../src/main/store/data-file-names'
import { createKanbanStore } from '../../../src/main/store/kanban-store'
import type { KanbanStore } from '../../../src/main/store/store-types'
import type { FileSystemPort } from '../../../src/main/store/file-system-port'
import type { Card, DataFile } from '../../../src/shared/types/card'
import type { Result } from '../../../src/shared/types/result'
import { fixedClock, makeCard, makeDoc, makeEntry, sequentialIds } from '../support/builders'
import { createFaultFileSystem } from '../support/fault-fs'
import { createMemoryFileSystem, type MemoryFileSystem } from '../support/memory-fs'

const DIR = 'data-dir'
const MAIN = dataFilePath(DIR, 'kanban-data.json')
const toText = (doc: DataFile) => `${JSON.stringify(doc, null, 2)}\n`

function openStore(fs: FileSystemPort, prefix = 'card'): Promise<KanbanStore> {
  const store = createKanbanStore({
    dataDir: DIR,
    fs,
    clock: fixedClock(),
    newId: sequentialIds(prefix),
    processId: 4321,
  })
  return store.open().then(() => store)
}

function seeded(doc: DataFile): MemoryFileSystem {
  return createMemoryFileSystem({ [MAIN]: toText(doc) })
}

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`성공이어야 한다: ${result.error.code} ${result.error.message}`)
  return result.value
}

function fileDoc(fs: MemoryFileSystem): DataFile {
  return JSON.parse(fs.files.get(MAIN) ?? 'null') as DataFile
}

/** 호출마다 짧게 기다리며 시작과 끝을 기록하는 파일 시스템 대역 (저장 호출 지연). */
function slowFileSystem(inner: FileSystemPort) {
  const events: string[] = []
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 3))
  async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
    events.push(`start ${label}`)
    await wait()
    try {
      return await run()
    } finally {
      events.push(`end ${label}`)
    }
  }
  const fs: FileSystemPort = {
    readFile: (p) => inner.readFile(p),
    exists: (p) => inner.exists(p),
    writeFileSynced: (p, d) => timed(`write ${p}`, () => inner.writeFileSynced(p, d)),
    copyFile: (a, b) => timed(`copy ${a}`, () => inner.copyFile(a, b)),
    rename: (a, b) => timed(`rename ${a}`, () => inner.rename(a, b)),
  }
  return { fs, events }
}

describe('KanbanStore 한 줄 처리와 닫기', () => {
  test('TC-047 변경 요청은 한 줄로 차례대로 저장된다', async () => {
    const memory = createMemoryFileSystem()
    const { fs, events } = slowFileSystem(memory)
    const store = await openStore(fs)

    const finished: string[] = []
    const note = <T>(label: string, p: Promise<Result<T>>) => p.then((r) => (finished.push(label), r))
    // 기다리지 않고 연달아 호출한다. 세 번째는 첫 번째가 만들 카드(card-1)를 고친다.
    const calls = [
      note('create A', store.create({ title: 'A' })),
      note('create B', store.create({ title: 'B' })),
      note('status A', store.changeStatus('card-1', 'in_progress')),
    ]
    const results = await Promise.all(calls)

    // 준비 조건: 세 번 저장이 실제로 일어났고, 전부 성공했다.
    expect(events.filter((e) => e.startsWith('start write'))).toHaveLength(3)
    expect(results.every((r) => r.ok)).toBe(true)

    // 앞 저장의 이름 바꾸기가 끝나기 전에는 다음 저장의 임시 파일 쓰기가 시작되지 않는다.
    const renameEnds = events.flatMap((e, i) => (e.startsWith('end rename') ? [i] : []))
    const writeStarts = events.flatMap((e, i) => (e.startsWith('start write') ? [i] : []))
    expect(renameEnds).toHaveLength(3)
    for (const [n, start] of writeStarts.entries()) {
      if (n > 0) expect(start).toBeGreaterThan(renameEnds[n - 1] ?? Infinity)
    }
    // 앞 저장이 모두 끝나야 다음 저장이 시작된다: 시작·끝이 겹치지 않는다.
    let running = 0
    for (const e of events) {
      if (e.startsWith('start ')) running += 1
      if (e.startsWith('end ')) running -= 1
      expect(running).toBeLessThanOrEqual(1)
    }

    expect(finished).toEqual(['create A', 'create B', 'status A'])
    const doc = fileDoc(memory)
    expect(doc.cards.map((c) => [c.title, c.status])).toEqual([
      ['A', 'in_progress'],
      ['B', 'todo'],
    ])
  })

  test('TC-050 저장소를 닫으면 줄 서 있는 저장이 끝난 뒤에 돌아온다', async () => {
    const memory = createMemoryFileSystem()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let writeStarted = false
    const delayed: FileSystemPort = {
      readFile: (p) => memory.readFile(p),
      exists: (p) => memory.exists(p),
      writeFileSynced: async (p, d) => {
        writeStarted = true
        await gate
        await memory.writeFileSynced(p, d)
      },
      copyFile: (a, b) => memory.copyFile(a, b),
      rename: (a, b) => memory.rename(a, b),
    }
    const store = await openStore(delayed)

    const pending = store.create({ title: '닫기 직전 카드' })
    let closed = false
    const closing = store.close().then(() => {
      closed = true
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    // 준비 조건: 저장이 시작되어 지연에 걸려 있다.
    expect(writeStarted).toBe(true)
    expect(closed).toBe(false)
    expect(memory.files.has(MAIN)).toBe(false)

    release()
    await closing
    expect(closed).toBe(true)
    expect(value(await pending).title).toBe('닫기 직전 카드')

    const reopened = await openStore(memory)
    expect(value(reopened.list({ scope: 'board' })).map((c) => c.title)).toEqual(['닫기 직전 카드'])
  })
})

describe('KanbanStore 저장과 다시 열기', () => {
  test('TC-048 변경을 저장한 뒤 새 저장소로 다시 열면 같은 결과가 나온다', async () => {
    const memory = createMemoryFileSystem()
    const store = await openStore(memory)

    const a = value(await store.create({ title: ' 첫 카드 ', dueDate: '2026-11-10' })) // card-1
    const b = value(await store.create({ title: '둘째 카드' })) // card-2
    const c = value(await store.create({ title: '지울 카드' })) // card-3
    value(await store.update(a.id, { title: '고친 제목', memo: '메모' }))
    value(await store.changeStatus(a.id, 'done'))
    const archived = value(await store.archive(a.id))
    const entry = value(await store.addProgress(b.id, { content: '  검토함 ' }))
    value(await store.addProgress(c.id, { content: '지울 카드의 기록' }))
    value(await store.setTheme('light'))
    const removed = value(await store.delete(c.id))
    expect(removed).toEqual({ deletedCardId: c.id, deletedProgressCount: 1 })

    const reopened = await openStore(memory, 'other')
    const board = value(reopened.list({ scope: 'board' }))
    const archive = value(reopened.list({ scope: 'archive' }))
    expect(board.map((x: Card) => x.id)).toEqual([b.id])
    expect(archive).toEqual([archived])
    expect(archive[0]).toMatchObject({ title: '고친 제목', memo: '메모', status: 'done', dueDate: '2026-11-10' })
    expect(archive[0]?.archivedAt).not.toBeNull()
    expect(value(reopened.get(b.id)).progress).toEqual([entry])
    expect(entry).toMatchObject({ content: '검토함', statusAtTime: 'todo' })
    expect(reopened.get(c.id)).toMatchObject({ ok: false, error: { code: 'CARD_NOT_FOUND' } })
    expect(value(reopened.getSettings())).toEqual({ theme: 'light' })
    // 삭제한 카드의 기록도 파일에 없다.
    expect(fileDoc(memory).progressEntries.map((e) => e.cardId)).toEqual([b.id])
  })

  test('TC-049 바뀐 것이 없는 호출은 파일에 쓰지 않는다', async () => {
    const memory = seeded(
      makeDoc({ settings: { theme: 'dark' }, cards: [makeCard({ id: 'c1', status: 'in_progress' })] }),
    )
    const fs = createFaultFileSystem(memory)
    const store = await openStore(fs)
    const before = memory.files.get(MAIN)

    const sameStatus = await store.changeStatus('c1', 'in_progress')
    const sameTheme = await store.setTheme('dark')
    const emptyPatch = await store.update('c1', {})

    expect(sameStatus).toMatchObject({ ok: true, value: { id: 'c1', status: 'in_progress' } })
    expect(sameTheme).toEqual({ ok: true, value: { theme: 'dark' } })
    expect(emptyPatch).toMatchObject({ ok: true, value: { id: 'c1' } })
    expect(fs.writeCalls()).toHaveLength(0)
    expect(fs.callLog.filter((c) => c.op === 'writeFileSynced' || c.op === 'copyFile' || c.op === 'rename')).toEqual([])
    expect(memory.files.get(MAIN)).toBe(before)
  })
})

describe('KanbanStore 화면 함수 흐름', () => {
  test('TC-136 보관한 카드를 삭제해 저장한 뒤 새 저장소로 열면 그 카드와 기록이 없다', async () => {
    const memory = seeded(
      makeDoc({
        cards: [
          makeCard({ id: 'a1', status: 'done', archivedAt: '2026-11-01T00:00:00.000Z' }),
          makeCard({ id: 'a2', status: 'done', archivedAt: '2026-11-02T00:00:00.000Z' }),
          makeCard({ id: 'b1' }),
        ],
        progressEntries: [
          makeEntry({ id: 'e1', cardId: 'a1' }),
          makeEntry({ id: 'e2', cardId: 'a2' }),
          makeEntry({ id: 'e3', cardId: 'b1' }),
        ],
      }),
    )
    const store = await openStore(memory)
    // 준비 조건: 보관 카드가 보관함에 있다.
    expect(value(store.list({ scope: 'archive' })).map((c) => c.id)).toEqual(['a1', 'a2'])

    const removed = await store.delete('a1')
    expect(removed).toEqual({ ok: true, value: { deletedCardId: 'a1', deletedProgressCount: 1 } })
    expect(value(store.list({ scope: 'archive' })).map((c) => c.id)).toEqual(['a2'])
    expect(value(store.list({ scope: 'board' })).map((c) => c.id)).toEqual(['b1'])

    const reopened = await openStore(memory)
    expect(value(reopened.list({ scope: 'archive' })).map((c) => c.id)).toEqual(['a2'])
    expect(value(reopened.list({ scope: 'board' })).map((c) => c.id)).toEqual(['b1'])
    expect(reopened.get('a1')).toMatchObject({ ok: false, error: { code: 'CARD_NOT_FOUND' } })
    expect(fileDoc(memory).progressEntries.map((e) => e.id)).toEqual(['e2', 'e3'])
    expect(value(reopened.get('a2')).progress.map((e) => e.id)).toEqual(['e2'])
  })

  test('TC-157 진행 중으로 만든 카드는 진행 중으로 저장되고 진행 기록이 없으며 완료로는 만들어지지 않는다', async () => {
    const memory = createMemoryFileSystem()
    const fs = createFaultFileSystem(memory)
    const store = await openStore(fs)

    const todo = value(await store.create({ title: '할 일 카드' }))
    const doing = value(await store.create({ title: '진행 카드', status: 'in_progress' }))
    expect(todo.status).toBe('todo')
    expect(doing.status).toBe('in_progress')
    expect(value(store.get(doing.id)).progress).toHaveLength(0)
    expect(value(store.get(todo.id)).progress).toHaveLength(0)

    // 준비 조건: 앞의 두 번 저장이 실제로 일어났다.
    expect(fs.writeCalls().length).toBeGreaterThan(0)
    const fileBefore = memory.files.get(MAIN)
    const callsBefore = fs.writeCalls().length
    const listBefore = value(store.list({ scope: 'board' }))

    const rejected = await store.create({ title: '완료 시도', status: 'done' as never })
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED', details: { violations: [{ field: 'status', reason: 'INVALID_VALUE' }] } },
    })
    expect(fs.writeCalls()).toHaveLength(callsBefore)
    expect(memory.files.get(MAIN)).toBe(fileBefore)
    expect(value(store.list({ scope: 'board' }))).toEqual(listBefore)

    const reopened = await openStore(memory, 'other')
    const board = value(reopened.list({ scope: 'board' }))
    expect(board.map((c) => [c.title, c.status])).toEqual([
      ['할 일 카드', 'todo'],
      ['진행 카드', 'in_progress'],
    ])
    expect(board.some((c) => c.status === 'done')).toBe(false)
    expect(value(reopened.get(todo.id)).progress).toHaveLength(0)
    expect(value(reopened.get(doing.id)).progress).toHaveLength(0)
    expect(fileDoc(memory).progressEntries).toEqual([])
  })

  test('TC-160 마감일만 바꾸는 수정은 마감일만 바꾸고, 같은 날짜로 바꾸면 저장하지 않으며, 다른 달과 완료 카드도 된다', async () => {
    const memory = seeded(
      makeDoc({
        cards: [
          makeCard({
            id: 'A',
            title: 'A 카드',
            status: 'in_progress',
            kind: 'bug',
            priority: 'high',
            description: 'A 설명',
            memo: 'A 메모',
            dueDate: '2026-11-06',
          }),
          makeCard({ id: 'B', title: 'B 카드', status: 'done', dueDate: '2026-11-06' }),
          makeCard({ id: 'C', title: 'C 카드', status: 'done', dueDate: '2026-11-06', archivedAt: '2026-11-01T00:00:00.000Z' }),
        ],
        progressEntries: [
          makeEntry({ id: 'e1', cardId: 'A' }),
          makeEntry({ id: 'e2', cardId: 'A', content: '둘째', statusAtTime: 'in_progress' }),
        ],
      }),
    )
    const fs = createFaultFileSystem(memory)
    const store = await openStore(fs)
    const cardA = value(store.get('A')).card
    const progressA = value(store.get('A')).progress
    expect(progressA).toHaveLength(2)

    // (1) A 의 마감일만 바뀐다.
    const first = value(await store.update('A', { dueDate: '2026-11-20' }))
    expect(first).toEqual({ ...cardA, dueDate: '2026-11-20' })
    expect(value(store.get('A')).progress).toEqual(progressA)
    // 준비 조건: 이 저장이 실제로 파일에 쓰였다.
    const writesAfterFirst = fs.writeCalls().length
    expect(writesAfterFirst).toBeGreaterThan(0)
    const fileAfterFirst = memory.files.get(MAIN)

    // (2) 같은 날짜로 한 번 더: 성공, 바뀐 것 없음, 쓰기·복사·이름 바꾸기 0건.
    const second = await store.update('A', { dueDate: '2026-11-20' })
    expect(second).toEqual({ ok: true, value: first })
    expect(fs.writeCalls()).toHaveLength(writesAfterFirst)
    expect(memory.files.get(MAIN)).toBe(fileAfterFirst)

    // (3) 완료 카드 B 를 다른 달로: 상태는 done 그대로.
    const third = value(await store.update('B', { dueDate: '2026-12-02' }))
    expect(third).toMatchObject({ id: 'B', dueDate: '2026-12-02', status: 'done' })

    // (4) 보관된 카드 C 는 CARD_ARCHIVED 이고 바뀌지 않는다.
    const writesBeforeArchived = fs.writeCalls().length
    const cardC = value(store.get('C')).card
    const fourth = await store.update('C', { dueDate: '2026-11-20' })
    expect(fourth).toMatchObject({ ok: false, error: { code: 'CARD_ARCHIVED' } })
    expect(fs.writeCalls()).toHaveLength(writesBeforeArchived)
    expect(value(store.get('C')).card).toEqual(cardC)
    expect(cardC.dueDate).toBe('2026-11-06')

    const reopened = await openStore(memory, 'other')
    expect(value(reopened.get('A')).card).toEqual({ ...cardA, dueDate: '2026-11-20' })
    expect(value(reopened.get('A')).progress).toEqual(progressA)
    expect(value(reopened.get('B')).card).toMatchObject({ dueDate: '2026-12-02', status: 'done' })
    expect(value(reopened.get('C')).card.dueDate).toBe('2026-11-06')
  })

  test('보관한 카드는 수정·상태 변경·기록 추가가 거절되고 읽을 수 있다', async () => {
    const memory = seeded(
      makeDoc({ cards: [makeCard({ id: 'a1', status: 'done', archivedAt: '2026-11-01T00:00:00.000Z' })] }),
    )
    const fs = createFaultFileSystem(memory)
    const store = await openStore(fs)
    const rejected = [
      await store.update('a1', { title: '새 제목' }),
      await store.changeStatus('a1', 'todo'),
      await store.addProgress('a1', { content: '기록' }),
      await store.archive('a1'),
    ]
    expect(rejected.map((r) => (r.ok ? 'ok' : r.error.code))).toEqual(Array(4).fill('CARD_ARCHIVED'))
    expect(value(store.get('a1')).card.id).toBe('a1')
    expect(fs.writeCalls()).toHaveLength(0)
  })

  test('규칙 오류는 그대로 돌려주고 저장하지 않는다', async () => {
    const memory = seeded(makeDoc({ cards: [makeCard({ id: 'c1', status: 'todo' })] }))
    const fs = createFaultFileSystem(memory)
    const store = await openStore(fs)
    const codes = [
      await store.create({ title: '   ' }),
      await store.changeStatus('c1', 'archived' as never),
      await store.changeStatus('nope', 'done'),
      await store.archive('c1'),
      await store.setTheme('blue' as never),
    ].map((r) => (r.ok ? 'ok' : r.error.code))
    expect(codes).toEqual([
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'CARD_NOT_FOUND',
      'ARCHIVE_NOT_ALLOWED',
      'VALIDATION_FAILED',
    ])
    expect(fs.writeCalls()).toHaveLength(0)
  })

  test('처음 실행은 빈 보드와 밝은 판이고 첫 저장 전에는 파일이 없다', async () => {
    const memory = createMemoryFileSystem()
    const store = createKanbanStore({ dataDir: DIR, fs: memory, clock: fixedClock(), newId: sequentialIds() })
    const status = await store.open()
    expect(status).toEqual({ state: 'ready', firstRun: true, recoveredFromBackup: false, migratedFromVersion: null })
    expect(store.getStatus()).toEqual(status)
    expect(value(store.list({ scope: 'board' }))).toEqual([])
    expect(value(store.getSettings())).toEqual({ theme: 'light' })
    expect(memory.files.size).toBe(0)
    expect(await store.retryOpen()).toEqual(status)
  })

  test('저장이 끝난 문서는 직전 저장본(.bak)과 함께 남고 다음 저장은 이전 문서를 .bak 에 둔다', async () => {
    const memory = createMemoryFileSystem()
    const store = await openStore(memory)
    await store.create({ title: '하나' })
    const first = memory.files.get(MAIN)
    await store.create({ title: '둘' })
    expect(memory.files.get(dataFilePath(DIR, 'kanban-data.json.bak'))).toBe(first)
  })
})
