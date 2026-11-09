// 화면 문구 상수 (한국어 고정, ASM-016). 값 이름 -> 화면 글자, 오류 코드 -> 사용자 문구.
// AppError.message 는 진단용이라 화면에 그대로 쓰지 않는다 (docs/05-design/03-api-spec.md).
// 순수 모듈이다: react·DOM 을 쓰지 않는다 (Node 에서 시험된다).

import type { Kind, Priority, Status, Theme } from '@shared/types/card'
import type { ErrorCode, ReadFailure, ReadFailureCode, Violation } from '@shared/types/result'

/** 화면에 보이는 앱 이름. 데이터 폴더 이름(APP_DATA_FOLDER)과 분리된 표시용 상수다 (ADR-012, BI-001). */
export const APP_NAME = '일정관리'

// 값 이름 -> 화면 글자

export const STATUS_LABEL: Record<Status, string> = {
  todo: '할 일',
  in_progress: '진행 중',
  done: '완료',
}

export const KIND_LABEL: Record<Kind, string> = {
  bug: '개발 버그',
  task: '할 일',
}

// 화면에 늘어놓는 순서는 이 표가 아니라 shared/constants 의 PRIORITIES 가 정한다 (낮음, 중간, 높음).
export const PRIORITY_LABEL: Record<Priority, string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
}

/** 사이드바 필터 목록 맨 위의 `전체` 항목 (종류·우선순위 목록 공통, AC-047). */
export const FILTER_ALL_LABEL = '전체'

/** 화면 밝기 판 이름. */
export const THEME_LABEL: Record<Theme, string> = {
  dark: '어두운 판',
  light: '밝은 판',
}

// 호출 오류 코드 -> 사용자 문구

export const ERROR_TEXT: Record<ErrorCode, string> = {
  VALIDATION_FAILED: '입력한 내용을 확인하세요.',
  CARD_NOT_FOUND: '카드를 찾을 수 없습니다. 이미 삭제된 카드일 수 있습니다.',
  CARD_ARCHIVED: '보관한 카드는 바꿀 수 없습니다.',
  ARCHIVE_NOT_ALLOWED: '완료한 카드만 보관할 수 있습니다.',
  SAVE_FAILED: '저장하지 못했습니다.',
  STORE_LOCKED: '저장된 데이터를 읽지 못해 지금은 저장할 수 없습니다.',
  INTERNAL: '예상하지 못한 오류가 났습니다. 데이터는 바뀌지 않았습니다.',
}

/** 오류 코드의 사용자 문구. 표에 없는 코드(통신 중 깨진 값)는 예상 못한 오류 문구로 돌린다. */
export function errorText(code: ErrorCode): string {
  return ERROR_TEXT[code] ?? ERROR_TEXT.INTERNAL
}

/** 입력 칸 아래에 붙는 검증 위반 문구. */
export function violationText(violation: Violation): string {
  const { field, reason } = violation
  if (field === 'title' && reason === 'REQUIRED') return '제목을 입력하세요'
  if (field === 'content' && reason === 'REQUIRED') return '기록 내용을 입력하세요'
  if (field === 'dueDate' && reason === 'INVALID_DATE') {
    return '존재하지 않는 날짜입니다. 2026-11-06 형식으로 입력하세요'
  }
  switch (reason) {
    case 'REQUIRED':
      return '값을 입력하세요'
    case 'INVALID_DATE':
      return '존재하지 않는 날짜입니다'
    case 'INVALID_VALUE':
    case 'INVALID_TYPE':
    case 'UNKNOWN_FIELD':
      return '올바르지 않은 값입니다'
    default:
      return '올바르지 않은 값입니다'
  }
}

// 저장 실패 (SAVE_FAILED.details.stage)

/** 저장 단계 이름 (03-api-spec.md). */
export const SAVE_STAGES = ['write_temp', 'sync', 'verify', 'backup', 'replace'] as const
export type SaveStage = (typeof SAVE_STAGES)[number]

export const SAVE_STAGE_LABEL: Record<SaveStage, string> = {
  write_temp: '임시 파일을 쓰는 단계',
  sync: '디스크에 기록을 마치는 단계',
  verify: '쓴 내용을 다시 읽어 확인하는 단계',
  backup: '직전 저장본을 만드는 단계',
  replace: '저장 파일을 바꾸는 단계',
}

export function saveStageText(stage: SaveStage): string {
  return SAVE_STAGE_LABEL[stage]
}

/** 칸 이동·보관·삭제 저장 실패 알림 줄. */
export const SAVE_FAILED_CARD_TEXT = '저장하지 못했습니다. 카드는 바뀌지 않았습니다.'
/** 밝기 전환 저장 실패 알림 줄. */
export const SAVE_FAILED_THEME_TEXT = '저장하지 못했습니다. 화면의 내용은 그대로 남아 있습니다.'
/** 카드 대화상자 안 저장 실패 알림. */
export const SAVE_FAILED_DIALOG_TEXT = '저장하지 못했습니다. 입력한 내용은 그대로 남아 있습니다.'
/** 진행 기록 추가 저장 실패. */
export const SAVE_FAILED_PROGRESS_TEXT = '기록을 저장하지 못했습니다'
export const RETRY_SAVE_LABEL = '다시 저장'

/** 사이드바 저장 상태 표시. */
export type SaveIndicator = 'saved' | 'saving' | 'failed' | 'read_failed'
export const SAVE_INDICATOR_LABEL: Record<SaveIndicator, string> = {
  saved: '내 PC에 저장됨',
  saving: '저장 중',
  failed: '저장하지 못함',
  read_failed: '읽지 못함',
}

// 예상 못한 오류, 화면 오류 경계

export const UNEXPECTED_ERROR_TEXT = ERROR_TEXT.INTERNAL
export const DETAILS_LABEL = '자세히'
export const RENDER_ERROR_TEXT = '화면을 그리지 못했습니다. 앱을 닫고 다시 여세요. 저장된 데이터는 바뀌지 않았습니다.'
export const RENDER_ERROR_TITLE = '화면을 그리지 못했습니다'

// 읽기 실패 패널 (SCR-001 에러: 읽기 실패)

export const READ_FAILURE_LABEL: Record<ReadFailureCode, string> = {
  FILE_UNREADABLE: '파일을 열거나 읽을 수 없습니다 (권한, 잠금, 입출력 오류)',
  JSON_PARSE_FAILED: '파일 내용이 올바른 JSON이 아니거나 중간에 잘렸습니다',
  SCHEMA_INVALID: '파일의 구조나 값이 올바르지 않습니다',
  INTEGRITY_VIOLATED: '카드와 진행 기록의 연결이 맞지 않습니다',
  SCHEMA_TOO_NEW: '더 새로운 버전의 앱이 저장한 파일이라 읽을 수 없습니다',
  MIGRATION_FAILED: '이전 버전 파일을 변환하는 중 오류가 났습니다',
}

export function readFailureText(code: ReadFailureCode): string {
  return READ_FAILURE_LABEL[code] ?? READ_FAILURE_LABEL.FILE_UNREADABLE
}

export const READ_FAILURE_TITLE = '저장된 데이터를 읽지 못했습니다'
export const READ_FAILURE_DESCRIPTION =
  '빈 보드가 아닙니다. 읽지 못한 데이터는 그대로 두고, 이 상태에서는 어떤 내용도 새로 저장하지 않습니다.'
export const READ_FAILURE_RETRY_LABEL = '다시 읽기'
export const LOADING_TEXT = '저장된 카드를 불러오는 중'

/** `읽지 못한 파일: <경로>` 줄. */
export function readFailureFileLine(dataFilePath: string): string {
  return `읽지 못한 파일: ${dataFilePath}`
}

/** `오류: <원인 문구>` 줄. OS 오류 코드가 있으면 ` (EACCES)`를 붙인다. */
export function readFailureCauseLine(failure: Pick<ReadFailure, 'code' | 'osCode'>): string {
  const os = failure.osCode ? ` (${failure.osCode})` : ''
  return `오류: ${readFailureText(failure.code)}${os}`
}

/** 직전 저장본 상태 세 가지. */
export const BACKUP_STATES = ['valid', 'invalid', 'absent'] as const satisfies readonly ReadFailure['backup'][]

/** `직전 저장본` 줄. valid 일 때만 경로를 붙인다. */
export function backupStateText(backup: ReadFailure['backup'], backupPath: string): string {
  switch (backup) {
    case 'valid':
      return `직전 저장본이 있습니다: ${backupPath}`
    case 'invalid':
      return '직전 저장본이 있지만 읽을 수 없습니다'
    case 'absent':
      return '직전 저장본이 없습니다'
  }
}

/** 버전 변환 전 사본 줄. */
export function preMigrationCopyLine(path: string): string {
  return `버전 변환 전 사본: ${path}`
}

/** 직전 저장본이 valid 일 때만 보이는 수동 절차 문구. 앱 안에 복구 동작은 없다 (사용자 결정 D3). */
export const READ_FAILURE_MANUAL_STEPS =
  '앱을 닫고 폴더에서 kanban-data.json을 다른 이름으로 바꾼 뒤 다시 열면 직전 저장본으로 열립니다. ' +
  '직전 저장본은 마지막 저장 하나 전의 내용일 수 있고, 이름을 바꾼 파일은 지워지지 않고 그대로 남습니다.'

/** backup 이 valid 이면 수동 절차 문구, 아니면 null (줄 자체를 그리지 않는다). */
export function manualStepsText(backup: ReadFailure['backup']): string | null {
  return backup === 'valid' ? READ_FAILURE_MANUAL_STEPS : null
}

// 삭제 확인

/** 보관함 행의 삭제 확인 문구. */
export const ARCHIVE_DELETE_CONFIRM_TEXT = '이 카드와 진행 기록이 삭제됩니다. 되돌릴 수 없습니다.'
/** 대화상자의 삭제 확인 문구. 기록 건수를 넣는다. */
export function deleteConfirmText(progressCount: number): string {
  return `이 카드와 진행 기록 ${progressCount}건이 삭제됩니다. 되돌릴 수 없습니다.`
}
export const DELETE_LABEL = '삭제'
export const DELETE_CONFIRM_LABEL = '삭제 확인'
export const CANCEL_LABEL = '취소'
