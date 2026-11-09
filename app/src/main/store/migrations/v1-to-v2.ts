// 버전 1 → 2 변환 (docs/05-design/02-data-model.md `스키마 버전과 이전 버전 변환`).
// 한 번 배포한 변환 함수는 지우지 않는다. 입력을 바꾸지 않고 새 문서를 돌려준다.

import { DEFAULT_THEME } from '../../../shared/constants'
import type { Card, DataFile, ProgressEntry } from '../../../shared/types/card'

/** 버전 1 저장 문서: 버전 2에서 더해진 settings 가 없다. */
export type DataFileV1 = {
  schemaVersion: 1
  cards: Card[]
  progressEntries: ProgressEntry[]
}

/**
 * settings 가 없는 버전 1 문서에 { theme: DEFAULT_THEME } 를 채우고 schemaVersion 을 2로 올린다.
 * 사용자가 판을 고른 적이 없는 파일이라 처음 실행과 같은 기본값이다 (ASM-017, AC-038).
 * cards, progressEntries 는 그대로 둔다. 이미 settings 가 있으면 덮어쓰지 않는다
 * (그런 파일은 이어지는 구조 검증이 판정한다).
 */
export function migrateV1ToV2(doc: DataFileV1): DataFile {
  const existing = (doc as { settings?: unknown }).settings
  return {
    ...doc,
    schemaVersion: 2,
    settings: (existing ?? { theme: DEFAULT_THEME }) as DataFile['settings'],
  }
}
