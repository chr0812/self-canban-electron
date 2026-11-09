import { Button } from './Button'
import { Icon } from './Icon'
import type { IconName } from './Icon'

// 빈 칸·빈 목록·결과 없음 문구. 오류가 아니라서 오류 아이콘을 쓰지 않는다:
// 결과 없음은 `search` 아이콘을 준다 (04-ui-spec.md SCR-001). 시작 안내에는 보조 버튼(`카드 만들기`)이 붙을 수 있다.

export interface EmptyStateProps {
  message: string
  /** 있으면 문구 아래에 보조 버튼이 나온다. onAction 과 함께 준다. */
  actionLabel?: string
  onAction?: () => void
  /** 문구 앞 아이콘 (결과 없음에 `search`). */
  icon?: IconName
  /** 흐린 글자색 한 줄 (카드가 없는 다른 칸). 기본은 본문 보조색. */
  muted?: boolean
}

export function EmptyState({ message, actionLabel, onAction, icon, muted = false }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        padding: '12px 4px',
        color: muted ? 'var(--text-mute)' : 'var(--text-sub)',
        fontSize: 14,
        lineHeight: '20px',
      }}
    >
      <p style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: 0 }}>
        {icon ? <Icon name={icon} /> : null}
        <span>{message}</span>
      </p>
      {actionLabel && onAction ? (
        <Button small onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
