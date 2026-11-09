/// <reference types="vite/client" />

import type { KanbanApi } from '../../shared/types/api'

declare global {
  interface Window {
    /** preload 가 contextBridge 로 노출하는 열두 함수. */
    kanban: KanbanApi
  }
}

export {}
