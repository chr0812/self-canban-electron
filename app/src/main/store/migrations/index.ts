// 버전 변환 사슬 (docs/05-design/02-data-model.md `스키마 버전과 이전 버전 변환`, NFR-003).
// schemaVersion 을 읽어 현재 버전까지 N → N+1 을 차례로 적용한다. 메모리에서만 변환하고 파일은 건드리지 않는다.
// 현재보다 높은 버전은 SCHEMA_TOO_NEW. 입력 객체는 바꾸지 않는다 (사본에서 변환한다).

import { CURRENT_SCHEMA_VERSION } from '../../../shared/constants'
import { migrateV1ToV2, type DataFileV1 } from './v1-to-v2'

/** 버전 N 문서를 N+1 문서로 바꾸는 함수 표. 키가 N 이다. 한 번 배포한 변환은 지우지 않는다. */
export const MIGRATIONS: Record<number, (doc: unknown) => unknown> = {
  1: (doc) => migrateV1ToV2(doc as DataFileV1),
}

export type MigrateResult =
  | {
      ok: true
      doc: unknown
      /** 변환했으면 원래 버전, 현재 버전 그대로면 null (StoreStatus.migratedFromVersion). */
      fromVersion: number | null
    }
  | {
      ok: false
      code: 'SCHEMA_TOO_NEW' | 'MIGRATION_FAILED' | 'SCHEMA_INVALID'
      /** SCHEMA_TOO_NEW 일 때 파일의 버전. */
      fileSchemaVersion?: number
    }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 읽은 JSON 을 현재 버전 문서 모양으로 올린다. 구조 검증은 하지 않는다 (DataFileValidator 몫).
 * - 객체가 아니거나 schemaVersion 이 1 이상의 정수가 아니면 SCHEMA_INVALID
 * - 현재보다 높으면 SCHEMA_TOO_NEW
 * - 변환 함수가 던지거나, 없거나, 올바른 버전의 객체를 돌려주지 않으면 MIGRATION_FAILED
 */
export function migrate(raw: unknown): MigrateResult {
  if (!isPlainObject(raw)) return { ok: false, code: 'SCHEMA_INVALID' }
  const version = raw['schemaVersion']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, code: 'SCHEMA_INVALID' }
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return { ok: false, code: 'SCHEMA_TOO_NEW', fileSchemaVersion: version }
  }
  if (version === CURRENT_SCHEMA_VERSION) return { ok: true, doc: raw, fromVersion: null }

  try {
    // 변환 함수가 입력을 건드려도 원본에 닿지 않도록 사본에서 작업한다.
    let doc: unknown = structuredClone(raw)
    for (let from = version; from < CURRENT_SCHEMA_VERSION; from += 1) {
      const step = MIGRATIONS[from]
      if (step === undefined) return { ok: false, code: 'MIGRATION_FAILED' }
      doc = step(doc)
      if (!isPlainObject(doc) || doc['schemaVersion'] !== from + 1) {
        return { ok: false, code: 'MIGRATION_FAILED' }
      }
    }
    return { ok: true, doc, fromVersion: version }
  } catch {
    return { ok: false, code: 'MIGRATION_FAILED' }
  }
}
