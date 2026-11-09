// 결과, 오류, 검증 위반, 저장소 상태, 읽기 실패 타입 (docs/05-design/03-api-spec.md 타입 절과 에러 카탈로그).
// 순수 모듈이다: 다른 모듈을 import 하지 않는다.

/** 호출 오류 코드 (에러 카탈로그). */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'CARD_NOT_FOUND'
  | 'CARD_ARCHIVED'
  | 'ARCHIVE_NOT_ALLOWED'
  | 'SAVE_FAILED'
  | 'STORE_LOCKED'
  | 'INTERNAL'

export type AppError = {
  code: ErrorCode
  /** 개발자용 진단 문장. 화면에 그대로 보이는 문구가 아니다. */
  message: string
  /** 코드별 추가 정보 (VALIDATION_FAILED 의 violations, SAVE_FAILED 의 stage 등). */
  details?: unknown
}

/** 모든 window.kanban 함수의 반환 형식. 예외를 던지지 않고 이 값을 돌려준다. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }

/** 검증 위반의 이유 (VALIDATION_FAILED.details.violations[].reason). */
export type ViolationReason = 'REQUIRED' | 'INVALID_VALUE' | 'INVALID_DATE' | 'INVALID_TYPE' | 'UNKNOWN_FIELD'

export type Violation = {
  /** 'title' | 'kind' | 'status' | 'priority' | 'dueDate' | 'description' | 'memo' | 'content' | 'id' | 'text' | 'theme' | 그 밖의 입력 필드 이름 */
  field: string
  reason: ViolationReason
}

/** 읽기 실패 원인 값 (02-data-model.md 읽기 실패 원인 값 표). */
export type ReadFailureCode =
  | 'FILE_UNREADABLE'
  | 'JSON_PARSE_FAILED'
  | 'SCHEMA_INVALID'
  | 'INTEGRITY_VIOLATED'
  | 'SCHEMA_TOO_NEW'
  | 'MIGRATION_FAILED'

export type ReadFailure = {
  code: ReadFailureCode
  /** 진단 문장. */
  message: string
  /** 읽지 못한 본 파일(또는 .bak)의 전체 경로. */
  dataFilePath: string
  /** 직전 저장본(.bak)의 전체 경로 (있든 없든 안내용). */
  backupPath: string
  /** 있는 버전 변환 전 사본(kanban-data.pre-v{N}.json)의 전체 경로. 없으면 빈 배열. */
  preMigrationCopies: string[]
  /** FILE_UNREADABLE 일 때 OS 오류 코드 (예: 'EACCES'). */
  osCode?: string
  /** SCHEMA_INVALID·INTEGRITY_VIOLATED 일 때 위반 위치 요약. */
  issues?: string[]
  /** SCHEMA_TOO_NEW 일 때 파일의 버전. */
  fileSchemaVersion?: number
  /** 직전 저장본(.bak) 상태 안내용. 앱이 자동으로 쓰지 않는다. */
  backup: 'absent' | 'valid' | 'invalid'
}

/** 저장소 상태. Result 로 감싸지 않는다 (읽기 실패도 정상적으로 보고할 상태). */
export type StoreStatus =
  | {
      state: 'ready'
      /** 저장 파일이 아직 없어 빈 보드로 시작했다. */
      firstRun: boolean
      /** 본 파일이 없어 직전 저장본(.bak)으로 열었다. */
      recoveredFromBackup: boolean
      /** 이전 버전 파일을 변환해 열었으면 원래 버전. */
      migratedFromVersion: number | null
    }
  | { state: 'read_failed'; failure: ReadFailure }
