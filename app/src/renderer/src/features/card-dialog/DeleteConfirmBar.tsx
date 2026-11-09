import { useEffect, useRef } from 'react'
import { Button } from '../../common/Button'
import { CANCEL_LABEL, DELETE_CONFIRM_LABEL, deleteConfirmText } from '../../text/labels'
import './card-dialog.css'

// 삭제 확인 바닥 줄 (SCR-002, FR-011 / UC-009). `삭제`를 누르면 바닥 줄이 이 줄로 바뀐다 (별도 팝업 없음).
// 보관한 카드의 보기 전용 모드에서도 같은 줄을 쓴다 (AC-040).
// 삭제 확인을 눌러도 줄은 저장이 성공할 때까지 남는다(낙관적 반영 없음): 닫기는 부모가 저장 성공 뒤에 한다.
// 저장이 실패하면 부모가 알림을 띄우고 이 줄은 그대로 남아 `삭제 확인`을 다시 누를 수 있다.

export interface DeleteConfirmBarProps {
  /** 함께 삭제될 진행 기록 건수 (문구에 들어간다). */
  progressCount: number
  /** `삭제 확인`. 삭제 요청을 보낸다. */
  onConfirm: () => void
  /** `취소`. 원래 바닥 줄로 돌아가고 카드는 그대로다. */
  onCancel: () => void
  /** 삭제 저장이 진행 중이면 true: 두 버튼이 눌리지 않는다. */
  pending?: boolean
}

export function DeleteConfirmBar({ progressCount, onConfirm, onCancel, pending = false }: DeleteConfirmBarProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // 처음 포커스는 `취소` (실수로 바로 지우지 않게).
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div className="card-dialog__foot card-dialog__foot--confirm" role="group" aria-label="삭제 확인">
      <p className="card-dialog__confirm-text" role="status">
        {deleteConfirmText(progressCount)}
      </p>
      <div className="card-dialog__foot-actions">
        <Button ref={cancelRef} onClick={onCancel} disabled={pending}>
          {CANCEL_LABEL}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={pending}>
          {DELETE_CONFIRM_LABEL}
        </Button>
      </div>
    </div>
  )
}
