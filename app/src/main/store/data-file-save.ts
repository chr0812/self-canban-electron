// 저장 다섯 단계 (docs/05-design/02-data-model.md `저장`, 05-architecture.md DataFileRepository):
//   write_temp → sync → verify → backup → replace
// 어느 단계가 실패해도 거기서 멈추고 { ok: false, stage, osCode? } 를 돌려준다. 본 파일은 replace 이전에는 바뀌지 않는다.
// 예외를 던지지 않는다. SAVE_FAILED 로 감싸는 일(dataFilePath 포함)은 호출하는 쪽이 한다.
// 파일을 지우지 않는다: 같은 이름의 임시 파일을 덮어쓸 뿐이고 다른 프로세스 id 의 .tmp 는 읽지도 쓰지도 않는다.

import type { DataFile } from '../../shared/types/card'
import { BACKUP_SUFFIX, DATA_FILE_NAME, dataFilePath, preVersionName, tempFileName } from './data-file-names'
import { validateDataFile } from './data-file-validator'
import type { FileSystemPort } from './file-system-port'

/** SAVE_FAILED.details.stage 값 (03-api-spec.md). */
export type SaveStage = 'write_temp' | 'sync' | 'verify' | 'backup' | 'replace'

export type SaveDeps = {
  fs: FileSystemPort
  /** 앱 데이터 폴더. */
  dataDir: string
  /** 임시 파일 이름에 붙는 프로세스 id. 시험이 고정 값을 준다 (실제 실행은 process.pid). */
  processId: number
}

export type SaveContext = {
  /** 이전 버전에서 변환된 문서면 원래 버전 N, 아니면 null. N 이면 backup 단계에 pre-v{N} 사본 복사가 들어간다. */
  migratedFromVersion: number | null
}

export type SaveResult = { ok: true } | { ok: false; stage: SaveStage; osCode?: string }

function failure(stage: SaveStage, error: unknown): SaveResult {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    if (typeof code === 'string') return { ok: false, stage, osCode: code }
  }
  return { ok: false, stage }
}

/** 2칸 들여쓰기 JSON, LF, 끝에 줄바꿈 한 개 (사람이 열어 볼 수 있게). */
function serialize(doc: DataFile): string {
  return `${JSON.stringify(doc, null, 2)}\n`
}

/**
 * 새 문서를 저장한다.
 *
 * - write_temp / sync: 임시 파일에 쓰고 디스크에 반영한다. 포트의 writeFileSynced 가 쓰기와 fsync 를 한 호출로 하므로
 *   두 단계의 실패는 구분되지 않고 write_temp 로 보고한다 (sync 는 타입에만 있다).
 * - verify: 임시 파일을 다시 읽어 파싱하고 같은 검증(validateDataFile)을 통과해야 한다.
 * - backup: 본 파일이 있으면 .bak 로 복사한다. 변환된 문서의 저장이면 pre-v{N} 사본을 (없을 때만) 먼저 만든다. 본 파일이 없으면 건너뛴다.
 * - replace: 임시 파일을 본 파일로 이름 바꾼다.
 */
export async function saveDataFile(deps: SaveDeps, next: DataFile, ctx: SaveContext): Promise<SaveResult> {
  const { fs, dataDir, processId } = deps
  const mainPath = dataFilePath(dataDir, DATA_FILE_NAME)
  const tempPath = dataFilePath(dataDir, tempFileName(processId))
  const backupPath = dataFilePath(dataDir, `${DATA_FILE_NAME}${BACKUP_SUFFIX}`)

  try {
    await fs.writeFileSynced(tempPath, serialize(next))
  } catch (error) {
    return failure('write_temp', error)
  }

  try {
    const parsed: unknown = JSON.parse(await fs.readFile(tempPath))
    const checked = validateDataFile(parsed)
    if (!checked.ok) return { ok: false, stage: 'verify' }
  } catch (error) {
    return failure('verify', error)
  }

  try {
    if (await fs.exists(mainPath)) {
      if (ctx.migratedFromVersion !== null) {
        const preCopyPath = dataFilePath(dataDir, preVersionName(ctx.migratedFromVersion))
        if (!(await fs.exists(preCopyPath))) await fs.copyFile(mainPath, preCopyPath)
      }
      await fs.copyFile(mainPath, backupPath)
    }
  } catch (error) {
    return failure('backup', error)
  }

  try {
    await fs.rename(tempPath, mainPath)
  } catch (error) {
    return failure('replace', error)
  }

  return { ok: true }
}
