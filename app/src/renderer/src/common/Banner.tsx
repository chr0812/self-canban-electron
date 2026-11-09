import { Button } from './Button'
import { Icon } from './Icon'
import { DETAILS_LABEL } from '../text/labels'

// 알림 줄 (저장 실패, 예상 못한 오류). role="alert" 라서 나타나면 스크린리더가 바로 읽는다.
// 예상 못한 오류(INTERNAL)는 일반 문구(message) + 접힌 `자세히`(detail, 진단 문장)로 보인다.
// 오류는 색이 아니라 아이콘 + 문구 + 2px 아래 선으로 알린다 (common.css .banner).

export interface BannerProps {
  message: string
  /** 있으면 `자세히` 로 접어 둔다. 진단 문장이라 기본은 닫혀 있다. */
  detail?: string
  /** 있으면 오른쪽에 버튼이 나온다 (예: `다시 저장`). onAction 과 함께 준다. */
  actionLabel?: string
  onAction?: () => void
}

export function Banner({ message, detail, actionLabel, onAction }: BannerProps) {
  return (
    <div className="banner" role="alert">
      <div className="banner__message">
        <Icon name="error" />
        <span>{message}</span>
      </div>
      {actionLabel && onAction ? (
        <Button small className="banner__action" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
      {detail ? (
        <details className="banner__detail">
          <summary>{DETAILS_LABEL}</summary>
          <p style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{detail}</p>
        </details>
      ) : null}
    </div>
  )
}
