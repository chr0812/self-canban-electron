import { useCallback, useEffect } from 'react'
import type { Theme } from '@shared/types/card'
import { useData, useDispatch } from './app-state'
import { useChanges } from './change-runner'

// <html data-theme> 적용과 판 전환 연결 (ThemeController, FR-014, UC-011).
// - 판을 고르면 곧바로 data-theme 를 바꾸고 ChangeRunner.setTheme 으로 저장한다. 화면 사본은 ChangeRunner 가 먼저 바꾼다.
// - 저장이 실패해도 판을 되돌리지 않는다 (실패 알림은 AppShell 의 알림 줄과 사이드바 저장 상태가 맡는다).
// - 읽기 실패 상태에서는 저장을 시도하지 않고 이번 실행에만 적용한다 (설계 임시 가정 10). 새 저장이 일어나지 않아
//   읽지 못한 데이터를 덮어쓰지 않는다 (AC-032).

const ATTRIBUTE = 'data-theme'

/** `<html data-theme>` 를 바꾼다. DOM 이 없는 환경(Node 시험)에서는 아무것도 하지 않는다. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute(ATTRIBUTE, theme)
}

export type ThemeControl = {
  /** 지금 화면의 판. */
  theme: Theme
  /** 판을 고른다. 이미 그 판이면 아무 일도 하지 않는다. */
  setTheme: (theme: Theme) => void
}

export function useTheme(): ThemeControl {
  const data = useData()
  const dispatch = useDispatch()
  const changes = useChanges()
  const { theme, boot } = data
  const loading = boot.phase === 'loading'
  const readFailed = boot.phase === 'read_failed'

  // 읽는 중에는 기본값(어두운 판)으로 덮어쓰지 않는다. preload 가 적은 저장된 판이 이미 <html> 에 있다 (ADR-008).
  useEffect(() => {
    if (!loading) applyTheme(theme)
  }, [theme, loading])

  const setTheme = useCallback(
    (next: Theme) => {
      if (next === theme) return
      applyTheme(next) // 즉시 바꾼다 (효과를 기다리지 않는다)
      if (readFailed) {
        dispatch({ type: 'data/theme_set', theme: next }) // 저장하지 않는다
        return
      }
      void changes.setTheme(next) // 화면 사본은 ChangeRunner 가 응답 전에 먼저 바꾼다
    },
    [theme, readFailed, dispatch, changes],
  )

  return { theme, setTheme }
}
