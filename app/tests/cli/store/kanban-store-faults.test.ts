// KanbanStore 저장 실패·중단 시험 (NFR-002, AC-031, AC-034, UC-011): 네 단계 각각의 실패에서 SAVE_FAILED 와
// 메모리·본 파일 불변, 어느 호출에서 끊겨도 다시 열면 직전 저장본 또는 새 저장본, 판 전환 저장 실패.

import { describe, expect, test } from 'vitest'
import { dataFilePath } from '../../../src/main/store/data-file-names'
import { createKanbanStore } from '../../../src/main/store/kanban-store'
import type { KanbanStore } from '../../../src/main/store/store-types'
import type { DataFile } from '../../../src/shared/types/card'
import type { Result } from '../../../src/shared/types/result'
import { fixedClock, makeCard, makeDoc, makeEntry, sequentialIds } from '../support/builders'
import { createFaultFileSystem, type Fault, type FaultFileSystem, type Operation } from '../support/fault-fs'
import { createMemoryFileSystem, type MemoryFileSystem } from '../support/memory-fs'

const DIR = 'data-dir'
const MAIN = dataFilePath(DIR, 'kanban-data.json')
const BAK = dataFilePath(DIR, 'kanban-data.json.bak')
const toText = (doc: DataFile) => `${JSON.stringify(doc, null, 2)}\n`

/** 저장 단계 -> 그 단계에서 부르는 포트 동작 (verify 는 임시 파일을 다시 읽는 readFile). */
const STAGES: ReadonlyArray<{ stage: 'write_temp' | 'verify' | 'backup' | 'replace'; op: Operation }> = [
  { stage: 'write_temp', op: 'writeFileSynced' },
  { stage: 'verify', op: 'readFile' },
  { stage: 'backup', op: 'copyFile' },
  { stage: 'replace', op: 'rename' },
]

const INITIAL = makeDoc({
  settings: { theme: 'dark' },
  cards: [
    makeCard({ id: 'c1', title: '기록 있는 카드', status: 'todo' }),
    makeCard({ id: 'c2', title: '다른 카드', status: 'in_progress' }),
  ],
  progressEntries: [makeEntry({ id: 'e1', cardId: 'c1' }), makeEntry({ id: 'e2', cardId: 'c1', content: '둘째' })],
})

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`성공이어야 한다: ${result.error.code} ${result.error.message}`)
  return result.value
}

async function openOn(fs: MemoryFileSystem | FaultFileSystem): Promise<KanbanStore> {
  const store = createKanbanStore({
    dataDir: DIR,
    fs,
    clock: fixedClock(),
    newId: sequentialIds('new'),
    processId: 77,
  })
  const status = await store.open()
  if (status.state !== 'ready') throw new Error(`열려야 한다: ${status.failure.code}`)
  return store
}

/** 화면에 보이는 모든 것: 보드·보관함 목록, 카드별 기록, 판. */
function snapshot(store: KanbanStore) {
  const board = value(store.list({ scope: 'board' }))
  const archive = value(store.list({ scope: 'archive' }))
  return {
    board,
    archive,
    details: [...board, ...archive].map((c) => value(store.get(c.id))),
    settings: value(store.getSettings()),
  }
}

/** 열고 난 뒤에 실패를 넣는다: 지금까지 센 호출 수 다음 호출(nth)에서 일어나도록. */
function openWithFaultAfterOpen() {
  const memory = createMemoryFileSystem({ [MAIN]: toText(INITIAL) })
  const plan: Fault[] = []
  const fs = createFaultFileSystem(memory, plan)
  const arm = (op: Operation, rest: Omit<Fault, 'op' | 'nth'>) => {
    plan.push({ op, nth: fs.callLog.filter((c) => c.op === op).length + 1, ...rest })
  }
  return { memory, fs, arm, open: () => openOn(fs) }
}

describe('KanbanStore 저장 실패', () => {
  for (const { stage, op } of STAGES) {
    test(`TC-051 저장 실패 시 카드 변경은 SAVE_FAILED이고 메모리와 본 파일이 그대로이다 (${stage})`, async () => {
      const calls: Array<[string, (s: KanbanStore) => Promise<Result<unknown>>]> = [
        ['카드 만들기', (s) => s.create({ title: '새 카드' })],
        ['진행 중 상태로 카드 만들기', (s) => s.create({ title: '진행 카드', status: 'in_progress' })],
        ['상태 변경', (s) => s.changeStatus('c2', 'done')],
        ['마감일만 바꾸는 수정(캘린더 끌기)', (s) => s.update('c1', { dueDate: '2026-11-20' })],
        ['기록이 있는 카드 삭제', (s) => s.delete('c1')],
        ['기록 추가', (s) => s.addProgress('c2', { content: '기록' })],
      ]
      for (const [label, call] of calls) {
        const { memory, fs, arm, open } = openWithFaultAfterOpen()
        const store = await open()
        const beforeSnapshot = snapshot(store)
        const beforeFile = memory.files.get(MAIN)

        arm(op, { kind: 'fail' })
        const result = await call(store)

        // 준비 조건: 이 단계의 포트 호출에서 실제로 실패가 일어났다.
        expect(
          fs.callLog.filter((c) => c.op === op && c.outcome === 'fail'),
          `${label} ${stage}`,
        ).toHaveLength(1)
        expect(result).toMatchObject({
          ok: false,
          error: { code: 'SAVE_FAILED', details: { stage, osCode: 'EIO', dataFilePath: MAIN } },
        })
        expect(snapshot(store), `${label} ${stage} 메모리`).toEqual(beforeSnapshot)
        expect(memory.files.get(MAIN), `${label} ${stage} 본 파일`).toBe(beforeFile)

        const reopened = await openOn(memory)
        expect(snapshot(reopened), `${label} ${stage} 다시 열기`).toEqual(beforeSnapshot)
      }
    })
  }

  test('TC-051 마감일 수정 저장이 실패하면 카드의 마감일과 다른 항목이 그대로이다 (replace)', async () => {
    const { memory, fs, arm, open } = openWithFaultAfterOpen()
    const store = await open()
    const before = value(store.get('c1'))
    expect(before.card.dueDate).toBeNull()
    arm('rename', { kind: 'fail' })
    const result = await store.update('c1', { dueDate: '2026-11-20' })
    // 준비 조건: 교체 단계에서 실제로 실패가 일어났다.
    expect(fs.callLog.filter((c) => c.op === 'rename' && c.outcome === 'fail')).toHaveLength(1)
    expect(result).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED', details: { stage: 'replace' } } })
    expect(value(store.get('c1'))).toEqual(before)
    const reopened = await openOn(memory)
    expect(value(reopened.get('c1'))).toEqual(before)
    expect(value(reopened.get('c1')).card.dueDate).toBeNull()
  })

  test('TC-051 진행 중 상태로 만들기 저장이 실패하면 카드가 생기지 않는다 (replace)', async () => {
    const { memory, fs, arm, open } = openWithFaultAfterOpen()
    const store = await open()
    arm('rename', { kind: 'fail' })
    const result = await store.create({ title: '진행 카드', status: 'in_progress' })
    expect(fs.callLog.filter((c) => c.op === 'rename' && c.outcome === 'fail')).toHaveLength(1)
    expect(result).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } })
    expect(value(store.list({ scope: 'board' })).map((c) => c.id)).toEqual(['c1', 'c2'])
    expect((JSON.parse(memory.files.get(MAIN) ?? '') as DataFile).cards.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  test('TC-051 삭제 저장이 실패하면 카드와 그 기록이 모두 남는다 (replace)', async () => {
    const { memory, arm, open } = openWithFaultAfterOpen()
    const store = await open()
    arm('rename', { kind: 'fail' })
    const result = await store.delete('c1')
    expect(result).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } })
    expect(value(store.get('c1')).progress.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect((JSON.parse(memory.files.get(MAIN) ?? '') as DataFile).progressEntries).toHaveLength(2)
  })

  test('실패한 저장 뒤에도 줄은 계속 돌고 다음 변경은 성공한다', async () => {
    const { arm, open, memory } = openWithFaultAfterOpen()
    const store = await open()
    arm('writeFileSynced', { kind: 'fail' })
    const first = store.create({ title: '실패할 카드' })
    const second = store.create({ title: '성공할 카드' })
    expect((await first).ok).toBe(false)
    expect(value(await second).title).toBe('성공할 카드')
    expect((JSON.parse(memory.files.get(MAIN) ?? '') as DataFile).cards.map((c) => c.title)).toEqual([
      '기록 있는 카드',
      '다른 카드',
      '성공할 카드',
    ])
  })
})

describe('KanbanStore 저장 중 중단', () => {
  const NEXT_TITLE = '바뀐 제목'

  for (const { stage, op } of STAGES) {
    for (const when of ['before', 'after'] as const) {
      test(`TC-052 저장 중 어느 시점에서 중단되어도 다시 열면 직전 저장본 또는 새 저장본이다 (${stage} ${when})`, async () => {
        const { memory, fs, arm, open } = openWithFaultAfterOpen()
        const store = await open()
        const previous = snapshot(store)

        arm(op, { kind: 'abort', when })
        const result = await store.update('c2', { title: NEXT_TITLE })
        // 준비 조건: 중단이 실제로 일어났고 호출자는 저장 실패를 받았다.
        expect(fs.callLog.filter((c) => c.outcome === 'abort')).toHaveLength(1)
        expect(result).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } })

        // openOn 은 읽기 실패면 던진다: 반쪽짜리 문서가 읽기 실패로 열리지 않는다.
        const reopened = await openOn(memory)
        const after = snapshot(reopened)
        const updated = {
          ...previous,
          board: previous.board.map((c) => (c.id === 'c2' ? { ...c, title: NEXT_TITLE } : c)),
          details: previous.details.map((d) =>
            d.card.id === 'c2' ? { ...d, card: { ...d.card, title: NEXT_TITLE } } : d,
          ),
        }
        // 직전 저장본 또는 새 저장본 중 하나와 정확히 같다 (반쪽짜리 문서가 아니다).
        expect([previous, updated]).toContainEqual(after)
        // 교체 이전 단계에서 끊겼다면 본 파일이 바뀌지 않았으므로 직전 저장본이다.
        // (교체 단계는 fault-fs 의 abort 가 안쪽 동작을 실행하는지에 따라 둘 중 하나라서 위 확인만 한다.)
        if (stage !== 'replace') expect(after).toEqual(previous)
      })
    }
  }

  test('TC-052 교체가 둘로 쪼개져 본 파일이 사라진 경우는 직전 저장본으로 열린다', async () => {
    const { memory, arm, open } = openWithFaultAfterOpen()
    const store = await open()
    const previous = snapshot(store)

    // 직전 저장본 복사까지 끝낸 뒤, 교체(이름 바꾸기)가 "본 파일 삭제"까지만 되고 끊긴 상태를 만든다.
    arm('rename', { kind: 'abort' })
    const result = await store.update('c2', { title: NEXT_TITLE })
    expect(result).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } })
    expect(memory.files.get(BAK)).toBe(toText(INITIAL))
    memory.files.delete(MAIN)

    const status = await createKanbanStore({
      dataDir: DIR,
      fs: memory,
      clock: fixedClock(),
      newId: sequentialIds(),
    }).open()
    expect(status).toMatchObject({ state: 'ready', recoveredFromBackup: true })
    expect(snapshot(await openOn(memory))).toEqual(previous)
  })
})

describe('KanbanStore 판 전환 저장 실패', () => {
  for (const { stage, op } of STAGES) {
    test(`TC-053 판 전환 저장이 실패하면 저장된 설정과 파일이 그대로이고 이후 카드 저장이 그 판을 함께 저장하지 않는다 (${stage})`, async () => {
      const { memory, fs, arm, open } = openWithFaultAfterOpen()
      const store = await open()
      const beforeFile = memory.files.get(MAIN)

      arm(op, { kind: 'fail' })
      const failed = await store.setTheme('light')
      expect(fs.callLog.filter((c) => c.op === op && c.outcome === 'fail')).toHaveLength(1)
      expect(failed).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED', details: { stage } } })
      expect(value(store.getSettings())).toEqual({ theme: 'dark' })
      expect(memory.files.get(MAIN)).toBe(beforeFile)

      // 실패를 풀고(이미 한 번 쓴 규칙) 카드를 하나 저장한다.
      const created = value(await store.create({ title: '판과 무관한 카드' }))
      const saved = JSON.parse(memory.files.get(MAIN) ?? '') as DataFile
      expect(saved.cards.map((c) => c.id)).toContain(created.id)
      expect(saved.settings.theme).toBe('dark')
      expect(value(store.getSettings())).toEqual({ theme: 'dark' })
    })
  }
})
