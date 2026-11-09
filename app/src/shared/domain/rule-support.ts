// 규칙 함수가 공유하는 타입과 Result 만들기 (docs/05-design/05-architecture.md CardRules).
// 순수 모듈이다: 디스크와 시계를 직접 모른다. 시각과 아이디는 ctx 로 받는다.

import type { DataFile } from '../types/card'
import type { ErrorCode, Result } from '../types/result'

/** 규칙 함수에 주입하는 시계와 아이디 만들기. */
export type RuleContext = { now: () => Date; newId: () => string }

/**
 * 변경 규칙의 반환. changed 가 false 면 저장하지 않는다 (같은 status, 빈 patch, 같은 theme).
 * next 는 새 문서이고 받은 문서는 바꾸지 않는다.
 */
export type RuleOutcome<T> = Result<{ next: DataFile; value: T; changed: boolean }>

/** 성공 결과. */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

/** 실패 결과. details 가 없으면 키를 만들지 않는다. */
export function fail(code: ErrorCode, message: string, details?: unknown): Result<never> {
  return {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  }
}
