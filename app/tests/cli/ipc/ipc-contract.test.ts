import { describe, expect, test } from 'vitest'
import { IPC_CHANNELS } from '../../../src/shared/ipc-contract'

// docs/05-design/03-api-spec.md 의 채널 목록 (기대값을 시험에 적어 둔다).
const EXPECTED_CHANNELS = [
  'kanban:store:getStatus',
  'kanban:store:retryOpen',
  'kanban:cards:list',
  'kanban:cards:get',
  'kanban:cards:create',
  'kanban:cards:update',
  'kanban:cards:changeStatus',
  'kanban:cards:archive',
  'kanban:cards:delete',
  'kanban:progress:add',
  'kanban:settings:get',
  'kanban:settings:setTheme',
]

describe('IPC 채널 표', () => {
  const channels = Object.values(IPC_CHANNELS) as string[]

  test('TC-064 IPC 채널 이름은 열두 개이며 API 명세 목록과 같다', () => {
    expect(EXPECTED_CHANNELS).toHaveLength(12)
    expect(channels).toHaveLength(12)
    expect([...channels].sort()).toEqual([...EXPECTED_CHANNELS].sort())
  })

  test('TC-064 채널 이름에 중복이 없다', () => {
    expect(new Set(channels).size).toBe(channels.length)
    expect(new Set(EXPECTED_CHANNELS).size).toBe(EXPECTED_CHANNELS.length)
  })

  test('TC-064 채널 이름은 함수 이름과 같은 규칙 kanban:<그룹>:<동작> 이다', () => {
    for (const [path, channel] of Object.entries(IPC_CHANNELS)) {
      expect(channel).toBe(`kanban:${path.replace('.', ':')}`)
    }
  })
})
