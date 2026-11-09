// 저장 파일의 읽기와 저장 호출 조립 (docs/05-design/02-data-model.md `읽기`, 05-architecture.md DataFileRepository).
// 읽기 순서: 본 파일 → (본 파일이 없을 때만) 직전 저장본(.bak) → 둘 다 없으면 처음 실행.
// 임시 파일(.tmp)은 읽지 않는다. 읽기는 파일을 쓰지 않는다: 쓰기·복사·이름 바꾸기 호출이 한 건도 없고,
// 읽지 못한 파일을 지우거나 덮어쓰지 않는다 (AC-032). 이전 버전 문서의 변환은 메모리에서만 한다 (NFR-003).
// 파일 접근은 FileSystemPort 로만 한다 (exists, readFile 만 쓴다. 파일 목록 조회는 없다).

import { CURRENT_SCHEMA_VERSION, DEFAULT_THEME } from '../../shared/constants'
import type { DataFile } from '../../shared/types/card'
import type { ReadFailure } from '../../shared/types/result'
import { saveDataFile, type SaveContext, type SaveResult } from './data-file-save'
import { BACKUP_SUFFIX, DATA_FILE_NAME, dataFilePath, preVersionName } from './data-file-names'
import { validateDataFile } from './data-file-validator'
import type { FileSystemPort } from './file-system-port'
import { migrate } from './migrations'

export type RepositoryDeps = {
  fs: FileSystemPort
  /** 앱 데이터 폴더 (시험은 임시 폴더나 가짜 경로). */
  dataDir: string
  /** 임시 파일 이름에 붙는 프로세스 id. 시험이 고정 값을 준다 (실제 실행은 process.pid). */
  processId: number
}

export type ReadOutcome =
  | {
      ok: true
      doc: DataFile
      /** 저장 파일이 아직 없어 빈 보드와 기본 설정으로 시작했다. */
      firstRun: boolean
      /** 본 파일이 없어 직전 저장본(.bak)으로 열었다. */
      recoveredFromBackup: boolean
      /** 이전 버전 파일을 변환해 열었으면 원래 버전, 아니면 null. save 의 ctx 로 그대로 넘긴다. */
      migratedFromVersion: number | null
    }
  | { ok: false; failure: ReadFailure }

export interface DataFileRepository {
  read(): Promise<ReadOutcome>
  save(next: DataFile, ctx: SaveContext): Promise<SaveResult>
}

/** 파일 하나를 읽어 본 결과. 실패하면 원인만 있고, 경로·.bak 상태는 read 가 붙인다. */
type Cause = Pick<ReadFailure, 'code' | 'message' | 'osCode' | 'issues' | 'fileSchemaVersion'>
type Loaded = { ok: true; doc: DataFile; migratedFromVersion: number | null } | { ok: false; cause: Cause }

function osCodeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

function unreadable(error: unknown, what: string): Cause {
  const osCode = osCodeOf(error)
  return osCode === undefined
    ? { code: 'FILE_UNREADABLE', message: `${what}을 읽지 못했습니다` }
    : { code: 'FILE_UNREADABLE', message: `${what}을 읽지 못했습니다 (${osCode})`, osCode }
}

/** 파일 내용 → 현재 버전 문서. JSON 파싱 → 버전 확인·변환 → 구조 검증 순서이고 어느 단계도 파일을 건드리지 않는다. */
function interpret(text: string): Loaded {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return {
      ok: false,
      cause: { code: 'JSON_PARSE_FAILED', message: 'JSON 이 아니거나 중간에 잘렸거나 빈 파일입니다' },
    }
  }

  let migrated: ReturnType<typeof migrate>
  try {
    migrated = migrate(raw)
  } catch {
    return { ok: false, cause: { code: 'MIGRATION_FAILED', message: '이전 버전 변환 중 오류가 났습니다' } }
  }
  if (!migrated.ok) {
    if (migrated.code === 'SCHEMA_TOO_NEW') {
      return {
        ok: false,
        cause: {
          code: 'SCHEMA_TOO_NEW',
          message: `파일의 schemaVersion(${String(migrated.fileSchemaVersion)})이 이 앱이 아는 최대 버전(${CURRENT_SCHEMA_VERSION})보다 큽니다`,
          ...(migrated.fileSchemaVersion === undefined ? {} : { fileSchemaVersion: migrated.fileSchemaVersion }),
        },
      }
    }
    if (migrated.code === 'MIGRATION_FAILED') {
      return { ok: false, cause: { code: 'MIGRATION_FAILED', message: '이전 버전 변환에 실패했습니다' } }
    }
    // 객체가 아니거나 schemaVersion 이 정수가 아님: 위반 위치는 검증기가 알려 준다.
    const shape = validateDataFile(raw)
    const issues = shape.ok ? ['schemaVersion: INVALID_VALUE'] : shape.issues
    return {
      ok: false,
      cause: { code: 'SCHEMA_INVALID', message: '최상위 모양이나 schemaVersion 이 틀립니다', issues },
    }
  }

  let checked: ReturnType<typeof validateDataFile>
  try {
    checked = validateDataFile(migrated.doc)
  } catch {
    return { ok: false, cause: { code: 'SCHEMA_INVALID', message: '문서 검증 중 오류가 났습니다' } }
  }
  if (!checked.ok) {
    return {
      ok: false,
      cause: { code: checked.code, message: '저장 문서의 모양이나 구조가 맞지 않습니다', issues: checked.issues },
    }
  }
  return { ok: true, doc: checked.doc, migratedFromVersion: migrated.fromVersion }
}

async function loadFile(fs: FileSystemPort, path: string, what: string): Promise<Loaded> {
  let text: string
  try {
    text = await fs.readFile(path)
  } catch (error) {
    return { ok: false, cause: unreadable(error, what) }
  }
  return interpret(text)
}

/** 처음 실행의 문서: 빈 보드와 기본 설정 (UC-005 Alt Flow 2, ASM-017). */
function emptyDoc(): DataFile {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, settings: { theme: DEFAULT_THEME }, cards: [], progressEntries: [] }
}

export function createDataFileRepository(deps: RepositoryDeps): DataFileRepository {
  const { fs, dataDir, processId } = deps
  const mainPath = dataFilePath(dataDir, DATA_FILE_NAME)
  const backupPath = dataFilePath(dataDir, `${DATA_FILE_NAME}${BACKUP_SUFFIX}`)

  /** 직전 저장본 상태 안내. 읽기만 한다. 확인 중 오류가 나면 쓸 수 있는지 알 수 없으므로 invalid 다. */
  async function inspectBackup(): Promise<ReadFailure['backup']> {
    try {
      if (!(await fs.exists(backupPath))) return 'absent'
    } catch {
      return 'invalid'
    }
    return (await loadFile(fs, backupPath, '직전 저장본')).ok ? 'valid' : 'invalid'
  }

  /** 있는 버전 변환 전 사본(pre-v1 ~ pre-v{현재-1})의 전체 경로. 확인에 실패한 사본은 없는 것으로 본다. */
  async function findPreMigrationCopies(): Promise<string[]> {
    const found: string[] = []
    for (let version = 1; version < CURRENT_SCHEMA_VERSION; version += 1) {
      const path = dataFilePath(dataDir, preVersionName(version))
      try {
        if (await fs.exists(path)) found.push(path)
      } catch {
        // 안내용 조사다. 확인하지 못한 사본은 보여 주지 않는다.
      }
    }
    return found
  }

  async function failed(cause: Cause, unreadPath: string, backup: ReadFailure['backup']): Promise<ReadOutcome> {
    const failure: ReadFailure = {
      ...cause,
      dataFilePath: unreadPath,
      backupPath,
      preMigrationCopies: await findPreMigrationCopies(),
      backup,
    }
    return { ok: false, failure }
  }

  async function read(): Promise<ReadOutcome> {
    let mainExists: boolean
    try {
      mainExists = await fs.exists(mainPath)
    } catch (error) {
      return failed(unreadable(error, '저장 파일'), mainPath, await inspectBackup())
    }

    if (mainExists) {
      const loaded = await loadFile(fs, mainPath, '저장 파일')
      if (loaded.ok) {
        return {
          ok: true,
          doc: loaded.doc,
          firstRun: false,
          recoveredFromBackup: false,
          migratedFromVersion: loaded.migratedFromVersion,
        }
      }
      // 본 파일을 읽지 못하면 직전 저장본이 유효해도 자동으로 쓰지 않는다. 상태만 안내한다.
      return failed(loaded.cause, mainPath, await inspectBackup())
    }

    let backupExists: boolean
    try {
      backupExists = await fs.exists(backupPath)
    } catch (error) {
      return failed(unreadable(error, '직전 저장본'), backupPath, 'invalid')
    }
    // .tmp 만 있는 경우도 여기로 온다: 완료 표시가 나간 저장이 없으므로 처음 실행이다.
    if (!backupExists) {
      return { ok: true, doc: emptyDoc(), firstRun: true, recoveredFromBackup: false, migratedFromVersion: null }
    }

    const loaded = await loadFile(fs, backupPath, '직전 저장본')
    if (loaded.ok) {
      return {
        ok: true,
        doc: loaded.doc,
        firstRun: false,
        recoveredFromBackup: true,
        migratedFromVersion: loaded.migratedFromVersion,
      }
    }
    return failed(loaded.cause, backupPath, 'invalid')
  }

  return {
    read,
    save: (next, ctx) => saveDataFile({ fs, dataDir, processId }, next, ctx),
  }
}
