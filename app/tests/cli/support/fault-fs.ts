// 어떤 FileSystemPort 든 감싸서 다섯 동작을 n번째 호출에서 실패시키거나 중단시키고, 호출 기록을 남긴다.
//
// - 'fail' : 실패. 안쪽 동작을 하지 않고 OS 오류 코드를 가진 Error 를 던진다 (기본 코드 EIO).
// - 'abort': 중단(프로세스 강제 종료 흉내). 던지는 것은 FaultAbort 이다.
//            writeFileSynced 는 앞쪽 절반만 쓴 채 끊긴다 (반쪽짜리 .tmp). 그 밖의 동작은 하지 않은 채 끊긴다.
// - when: 'after' 이면 안쪽 동작을 끝까지 한 뒤에 던진다 (동작은 끝났는데 호출자는 결과를 못 받은 시점).
//   'after' 일 때 abort 의 writeFileSynced 도 온전히 쓴다.
// 호출 횟수는 동작마다 따로 1부터 센다. 실패한 호출도 센다. 같은 (동작, nth) 규칙은 한 번만 적용된다.
// 중단 뒤에도 감싼 객체는 계속 쓸 수 있다 (다시 열기 시험은 보통 안쪽 inner 로 새로 연다).

import type { FileSystemPort } from '../../../src/main/store/file-system-port'

export type Operation = 'readFile' | 'exists' | 'writeFileSynced' | 'copyFile' | 'rename'

/** 파일에 쓰는 동작. 읽기 실패 상태에서 이 호출이 0건이어야 한다 (AC-032). */
export const WRITE_OPERATIONS: readonly Operation[] = ['writeFileSynced', 'copyFile', 'rename']

export type Fault = {
  op: Operation
  /** 그 동작의 몇 번째 호출에서 일어나는가 (1부터). */
  nth: number
  kind: 'fail' | 'abort'
  /** kind 가 'fail' 일 때 OS 오류 코드. 기본 'EIO'. */
  code?: string
  /** 기본 'before'. */
  when?: 'before' | 'after'
}

export type FaultPlan = readonly Fault[]

export type CallRecord = {
  op: Operation
  /** 그 동작의 몇 번째 호출이었나 (1부터). */
  nth: number
  /** readFile·exists·writeFileSynced 의 대상, copyFile·rename 의 원본. */
  path: string
  /** copyFile·rename 의 대상. */
  to?: string
  outcome: 'ok' | 'fail' | 'abort'
}

/** 중단(강제 종료 흉내)으로 던지는 오류. */
export class FaultAbort extends Error {
  readonly op: Operation
  readonly nth: number
  constructor(op: Operation, nth: number) {
    super(`FaultAbort: ${op} #${nth}`)
    this.name = 'FaultAbort'
    this.op = op
    this.nth = nth
  }
}

export type FaultFileSystem = FileSystemPort & {
  /** 호출 순서대로 쌓이는 기록 (살아 있는 배열). */
  callLog: CallRecord[]
  /** callLog 중 쓰는 동작(writeFileSynced·copyFile·rename)만. */
  writeCalls(): CallRecord[]
}

export function createFaultFileSystem(inner: FileSystemPort, plan: FaultPlan = []): FaultFileSystem {
  const callLog: CallRecord[] = []
  const counts: Record<Operation, number> = { readFile: 0, exists: 0, writeFileSynced: 0, copyFile: 0, rename: 0 }

  async function run<T>(
    op: Operation,
    path: string,
    to: string | undefined,
    act: (partial: boolean) => Promise<T>,
  ): Promise<T> {
    counts[op] += 1
    const nth = counts[op]
    const record: CallRecord =
      to === undefined ? { op, nth, path, outcome: 'ok' } : { op, nth, path, to, outcome: 'ok' }
    callLog.push(record)
    const fault = plan.find((f) => f.op === op && f.nth === nth)
    if (!fault) return act(false)

    record.outcome = fault.kind
    const thrown =
      fault.kind === 'fail'
        ? Object.assign(new Error(`${fault.code ?? 'EIO'}: injected failure, ${op} '${path}'`), {
            code: fault.code ?? 'EIO',
          })
        : new FaultAbort(op, nth)
    if (fault.when === 'after') {
      await act(false)
    } else if (fault.kind === 'abort') {
      await act(true)
    }
    throw thrown
  }

  return {
    callLog,
    writeCalls: () => callLog.filter((c) => WRITE_OPERATIONS.includes(c.op)),
    readFile: (path) => run('readFile', path, undefined, () => inner.readFile(path)),
    exists: (path) => run('exists', path, undefined, () => inner.exists(path)),
    writeFileSynced: (path, data) =>
      run('writeFileSynced', path, undefined, (partial) =>
        inner.writeFileSynced(path, partial ? data.slice(0, Math.floor(data.length / 2)) : data),
      ),
    copyFile: (from, to) => run('copyFile', from, to, () => inner.copyFile(from, to)),
    rename: (from, to) => run('rename', from, to, () => inner.rename(from, to)),
  }
}
