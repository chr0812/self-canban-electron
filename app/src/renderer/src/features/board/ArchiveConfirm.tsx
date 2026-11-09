import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from '../../common/Button'
import { CANCEL_LABEL } from '../../text/labels'

// 완료 카드의 `보관` 인라인 2단계 확인 (04-ui-spec.md 결정 필요 3의 임시 안전장치). 별도 팝업을 겹치지 않는다:
// `보관` 을 누르면 같은 자리가 `보관 확인` `취소` 두 버튼으로 바뀐다.
// `보관 확인` 은 onConfirm 만 부르고 원래 모양으로 돌아간다. 카드가 사라지는 것은 저장이 성공한 뒤의 일이고
// (낙관적 반영 없음), 저장이 실패하면 카드는 그대로 남고 알림 줄의 `다시 저장` 이 같은 요청을 다시 보낸다.
// 완료 카드에만 쓴다: 완료가 아닌 카드에는 이 컴포넌트를 그리지 않는다 (AC-021 — 판정은 부르는 쪽과 저장소가 한다).
// 버튼이 바뀌면 눌린 버튼이 사라지므로 포커스를 새 버튼으로 옮긴다.

const ARCHIVE_LABEL = '보관'
const CONFIRM_LABEL = '보관 확인'

export interface ArchiveConfirmProps {
  /** `보관 확인` 을 눌렀을 때. */
  onConfirm: () => void
  disabled?: boolean
}

export function ArchiveConfirm({ onConfirm, disabled = false }: ArchiveConfirmProps) {
  const [confirming, setConfirming] = useState(false)
  const archiveRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  // 포커스는 사용자가 단계를 바꾼 뒤에만 옮긴다 (처음 그릴 때 훔치지 않는다).
  const moveFocus = useRef(false)

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    if (confirming) confirmRef.current?.focus()
    else archiveRef.current?.focus()
  }, [confirming])

  function change(next: boolean) {
    moveFocus.current = true
    setConfirming(next)
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    change(false)
  }

  if (!confirming) {
    return (
      <Button
        ref={archiveRef}
        small
        className="archive-confirm__btn"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          change(true)
        }}
      >
        {ARCHIVE_LABEL}
      </Button>
    )
  }

  return (
    // 두 버튼 묶음: 클릭·키가 카드(열기)로 번지지 않게 막는다.
    <span className="archive-confirm" onClick={(event) => event.stopPropagation()} onKeyDown={onKeyDown}>
      <Button
        ref={confirmRef}
        small
        variant="primary"
        className="archive-confirm__btn"
        disabled={disabled}
        onClick={() => {
          change(false)
          onConfirm()
        }}
      >
        {CONFIRM_LABEL}
      </Button>
      <Button small className="archive-confirm__btn" onClick={() => change(false)}>
        {CANCEL_LABEL}
      </Button>
    </span>
  )
}
