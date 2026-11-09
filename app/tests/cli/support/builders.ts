// 시험 데이터 만들기: 카드, 진행 기록, 저장 문서, 고정 시계, 순번 아이디.
// 기본값은 모두 고정이라 시험이 필요한 필드만 overrides 로 바꾼다.

import { CURRENT_SCHEMA_VERSION, DEFAULT_THEME } from '../../../src/shared/constants'
import type { Card, DataFile, ProgressEntry } from '../../../src/shared/types/card'
import type { RuleContext } from '../../../src/shared/domain/rule-support'

/** makeContext 와 makeCard 가 쓰는 기본 시각. */
export const BASE_INSTANT = '2026-11-03T09:00:00.000Z'

export function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    title: '시험 카드',
    status: 'todo',
    kind: 'task',
    description: '',
    dueDate: null,
    priority: null,
    memo: '',
    archivedAt: null,
    createdAt: BASE_INSTANT,
    ...overrides,
  }
}

export function makeEntry(overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  return {
    id: 'entry-1',
    cardId: 'card-1',
    content: '진행 내용',
    statusAtTime: 'todo',
    createdAt: BASE_INSTANT,
    ...overrides,
  }
}

/** 빈 보드 문서가 기본이다. cards·progressEntries·settings 를 통째로 바꿀 수 있다. */
export function makeDoc(overrides: Partial<DataFile> = {}): DataFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { theme: DEFAULT_THEME },
    cards: [],
    progressEntries: [],
    ...overrides,
  }
}

/** 부를 때마다 같은 시각을 돌려주는 시계. 호출마다 새 Date 를 만든다 (받은 쪽이 바꿔도 영향 없음). */
export function fixedClock(iso: string = BASE_INSTANT): () => Date {
  return () => new Date(iso)
}

/** `${prefix}-1`, `${prefix}-2` ... 순번 아이디 만들기. */
export function sequentialIds(prefix = 'id'): () => string {
  let n = 0
  return () => {
    n += 1
    return `${prefix}-${n}`
  }
}

/** 고정 시계와 순번 아이디를 묶은 규칙 함수 ctx. */
export function makeContext(iso: string = BASE_INSTANT, prefix = 'id'): RuleContext {
  return { now: fixedClock(iso), newId: sequentialIds(prefix) }
}
