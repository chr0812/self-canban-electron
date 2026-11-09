import { describe, expect, test } from 'vitest'
import { KINDS, PRIORITIES, STATUSES, THEMES } from '../../../src/shared/constants'
import type { ErrorCode, ReadFailure, ReadFailureCode, ViolationReason } from '../../../src/shared/types/result'
import {
  APP_NAME,
  BACKUP_STATES,
  ERROR_TEXT,
  FILTER_ALL_LABEL,
  KIND_LABEL,
  PRIORITY_LABEL,
  READ_FAILURE_LABEL,
  READ_FAILURE_MANUAL_STEPS,
  SAVE_STAGES,
  SAVE_STAGE_LABEL,
  STATUS_LABEL,
  THEME_LABEL,
  backupStateText,
  errorText,
  manualStepsText,
  readFailureCauseLine,
  readFailureText,
  saveStageText,
  violationText,
} from '../../../src/renderer/src/text/labels'

// 호출 오류 코드 (에러 카탈로그). 타입이 빠짐없이 나열됐는지 컴파일러가 확인한다.
const ERROR_CODE_SET: Record<ErrorCode, true> = {
  VALIDATION_FAILED: true,
  CARD_NOT_FOUND: true,
  CARD_ARCHIVED: true,
  ARCHIVE_NOT_ALLOWED: true,
  SAVE_FAILED: true,
  STORE_LOCKED: true,
  INTERNAL: true,
}
const ERROR_CODES = Object.keys(ERROR_CODE_SET) as ErrorCode[]

const READ_FAILURE_CODE_SET: Record<ReadFailureCode, true> = {
  FILE_UNREADABLE: true,
  JSON_PARSE_FAILED: true,
  SCHEMA_INVALID: true,
  INTEGRITY_VIOLATED: true,
  SCHEMA_TOO_NEW: true,
  MIGRATION_FAILED: true,
}
const READ_FAILURE_CODES = Object.keys(READ_FAILURE_CODE_SET) as ReadFailureCode[]

const VIOLATION_REASON_SET: Record<ViolationReason, true> = {
  REQUIRED: true,
  INVALID_VALUE: true,
  INVALID_DATE: true,
  INVALID_TYPE: true,
  UNKNOWN_FIELD: true,
}
const VIOLATION_REASONS = Object.keys(VIOLATION_REASON_SET) as ViolationReason[]

function sorted(values: readonly string[]): string[] {
  return [...values].sort()
}

function expectFilled(text: string | undefined): void {
  expect(typeof text).toBe('string')
  expect((text ?? '').trim().length).toBeGreaterThan(0)
}

describe('TC-063 모든 값과 오류 코드에 화면 문구가 있다', () => {
  test('TC-063 상태·종류·우선순위·판의 모든 값에 비어 있지 않은 문구가 있고 표에 없는 값은 없다', () => {
    expect(sorted(Object.keys(STATUS_LABEL))).toEqual(sorted(STATUSES))
    expect(sorted(Object.keys(KIND_LABEL))).toEqual(sorted(KINDS))
    expect(sorted(Object.keys(PRIORITY_LABEL))).toEqual(sorted(PRIORITIES))
    expect(sorted(Object.keys(THEME_LABEL))).toEqual(sorted(THEMES))
    for (const status of STATUSES) expectFilled(STATUS_LABEL[status])
    for (const kind of KINDS) expectFilled(KIND_LABEL[kind])
    for (const priority of PRIORITIES) expectFilled(PRIORITY_LABEL[priority])
    for (const theme of THEMES) expectFilled(THEME_LABEL[theme])
    expect(STATUS_LABEL).toEqual({ todo: '할 일', in_progress: '진행 중', done: '완료' })
    expectFilled(APP_NAME)
  })

  test('TC-063 우선순위 PRIORITIES 는 낮음·중간·높음 순서이고 medium 의 표시 이름은 중간이다(보통이 아니다)', () => {
    expect([...PRIORITIES]).toEqual(['low', 'medium', 'high'])
    expect(PRIORITIES.map((priority) => PRIORITY_LABEL[priority])).toEqual(['낮음', '중간', '높음'])
    expect(PRIORITY_LABEL.medium).toBe('중간')
    expect(Object.values(PRIORITY_LABEL)).not.toContain('보통')
  })

  test('TC-063 사이드바 필터의 전체 문구 상수가 있다', () => {
    expect(FILTER_ALL_LABEL).toBe('전체')
  })

  test('TC-063 호출 오류 코드(저장 실패, 읽기 잠김 포함)마다 비어 있지 않은 문구가 있고 표에 없는 코드는 없다', () => {
    expect(ERROR_CODES).toContain('SAVE_FAILED')
    expect(ERROR_CODES).toContain('STORE_LOCKED')
    expect(sorted(Object.keys(ERROR_TEXT))).toEqual(sorted(ERROR_CODES))
    for (const code of ERROR_CODES) {
      expectFilled(errorText(code))
      expect(errorText(code)).toBe(ERROR_TEXT[code])
    }
    // 진단 문장이 아니라 사용자 문구다: 코드 이름이 그대로 노출되지 않는다.
    for (const code of ERROR_CODES) expect(errorText(code)).not.toContain(code)
    // 표에 없는 값이 오면 예상 못한 오류 문구로 돌린다.
    expect(errorText('NOT_A_CODE' as ErrorCode)).toBe(ERROR_TEXT.INTERNAL)
  })

  test('TC-063 검증 위반(제목 비움, 날짜 오류 포함)마다 비어 있지 않은 문구가 있다', () => {
    expect(violationText({ field: 'title', reason: 'REQUIRED' })).toBe('제목을 입력하세요')
    expectFilled(violationText({ field: 'dueDate', reason: 'INVALID_DATE' }))
    for (const reason of VIOLATION_REASONS) {
      expectFilled(violationText({ field: 'title', reason }))
      expectFilled(violationText({ field: 'memo', reason }))
    }
  })

  test('TC-063 읽기 실패 원인 6가지에 비어 있지 않은 문구가 있고 OS 오류 코드가 함께 붙는다', () => {
    expect(READ_FAILURE_CODES).toHaveLength(6)
    expect(sorted(Object.keys(READ_FAILURE_LABEL))).toEqual(sorted(READ_FAILURE_CODES))
    const texts = new Set<string>()
    for (const code of READ_FAILURE_CODES) {
      expectFilled(readFailureText(code))
      texts.add(readFailureText(code))
    }
    expect(texts.size).toBe(6)
    const line = readFailureCauseLine({ code: 'FILE_UNREADABLE', osCode: 'EACCES' })
    expect(line).toContain(readFailureText('FILE_UNREADABLE'))
    expect(line).toContain('(EACCES)')
    expect(readFailureCauseLine({ code: 'JSON_PARSE_FAILED' })).not.toContain('(')
  })

  test('TC-063 저장 단계 5가지에 비어 있지 않은 문구가 있다', () => {
    expect([...SAVE_STAGES]).toEqual(['write_temp', 'sync', 'verify', 'backup', 'replace'])
    expect(sorted(Object.keys(SAVE_STAGE_LABEL))).toEqual(sorted(SAVE_STAGES))
    const texts = new Set<string>()
    for (const stage of SAVE_STAGES) {
      expectFilled(saveStageText(stage))
      texts.add(saveStageText(stage))
    }
    expect(texts.size).toBe(5)
  })

  test('TC-063 직전 저장본 상태 3가지에 문구가 있고 수동 절차 문구는 유효할 때만 나온다', () => {
    const states: ReadFailure['backup'][] = ['valid', 'invalid', 'absent']
    expect([...BACKUP_STATES].sort()).toEqual([...states].sort())
    const backupPath = 'C:\\data\\kanban-data.json.bak'
    const lines = states.map((state) => backupStateText(state, backupPath))
    for (const line of lines) expectFilled(line)
    expect(new Set(lines).size).toBe(3)
    expect(backupStateText('valid', backupPath)).toContain(backupPath)

    expectFilled(READ_FAILURE_MANUAL_STEPS)
    expect(READ_FAILURE_MANUAL_STEPS).toContain('kanban-data.json')
    expect(manualStepsText('valid')).toBe(READ_FAILURE_MANUAL_STEPS)
    expect(manualStepsText('invalid')).toBeNull()
    expect(manualStepsText('absent')).toBeNull()
  })
})
