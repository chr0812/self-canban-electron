// preload 와 main 이 같은 표에서 만드는 IPC 채널 이름 (docs/05-design/03-api-spec.md).
// 이 표에 없는 채널은 main 이 등록하지 않는다.

import type { KanbanApi } from './types/api'

export type { KanbanApi }

/** window.kanban 의 함수 경로 (예: 'cards.changeStatus'). KanbanApi 에서 만든다. */
export type KanbanFunctionPath = {
  [G in keyof KanbanApi]: `${G & string}.${keyof KanbanApi[G] & string}`
}[keyof KanbanApi]

/** 함수 경로 -> 채널 이름. 규칙은 `kanban:<그룹>:<동작>` 이다. */
export const IPC_CHANNELS = {
  'store.getStatus': 'kanban:store:getStatus',
  'store.retryOpen': 'kanban:store:retryOpen',
  'cards.list': 'kanban:cards:list',
  'cards.get': 'kanban:cards:get',
  'cards.create': 'kanban:cards:create',
  'cards.update': 'kanban:cards:update',
  'cards.changeStatus': 'kanban:cards:changeStatus',
  'cards.archive': 'kanban:cards:archive',
  'cards.delete': 'kanban:cards:delete',
  'progress.add': 'kanban:progress:add',
  'settings.get': 'kanban:settings:get',
  'settings.setTheme': 'kanban:settings:setTheme',
} as const satisfies Record<KanbanFunctionPath, string>

export type IpcChannelKey = keyof typeof IPC_CHANNELS
export type IpcChannelName = (typeof IPC_CHANNELS)[IpcChannelKey]
