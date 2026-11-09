// 화면 밝기 설정 규칙 (docs/05-design/03-api-spec.md settings.get, settings.setTheme).
// 순수 모듈이다: 받은 문서를 바꾸지 않고 새 문서를 돌려준다. 저장은 저장소의 일이다.

import { DEFAULT_THEME } from '../constants'
import type { DataFile, Settings } from '../types/card'
import type { Result } from '../types/result'
import { fail, ok, type RuleOutcome } from './rule-support'
import { validateTheme } from './validation'

/** 저장된 판을 돌려준다. 설정이 없거나 판 값이 없으면 어두운 판이다 (ASM-017, AC-038). */
export function getSettings(doc: DataFile): Result<Settings> {
  const theme = doc.settings?.theme
  return ok({ theme: theme ?? DEFAULT_THEME })
}

/**
 * 판 전환. 목록 밖의 값은 VALIDATION_FAILED (theme / INVALID_VALUE, 문자열이 아니면 INVALID_TYPE).
 * 지금과 같은 값이면 성공이지만 changed 가 false 라서 저장하지 않는다.
 */
export function setTheme(doc: DataFile, theme: unknown): RuleOutcome<Settings> {
  const violations = validateTheme(theme)
  if (violations.length > 0) {
    return fail('VALIDATION_FAILED', '화면 밝기 값이 올바르지 않다', { violations })
  }
  const next = theme as Settings['theme']
  const current = doc.settings?.theme ?? DEFAULT_THEME
  if (next === current) {
    return ok({ next: doc, value: { theme: current }, changed: false })
  }
  return ok({ next: { ...doc, settings: { ...doc.settings, theme: next } }, value: { theme: next }, changed: true })
}
