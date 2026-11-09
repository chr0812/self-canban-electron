import { useEffect, useRef, useState } from 'react'
import type { Status } from '@shared/types/card'
import { Button } from '../../common/Button'
import { Icon } from '../../common/Icon'
import { TextArea } from '../../common/TextFields'
import { RETRY_SAVE_LABEL, SAVE_FAILED_PROGRESS_TEXT, STATUS_LABEL } from '../../text/labels'
import './card-dialog.css'

// 진행 기록 입력과 `기록 추가` (SCR-002 오른쪽 열 아래, FR-009 / UC-006).
// 카드 입력 항목의 `저장`과 별개로 누르는 즉시 저장한다. 저장은 부모가 한다: onSubmit 이 true 로 끝나면
// 저장된 것이라 입력을 비우고, false 로 끝나면(저장 실패) 입력을 남기고 입력 아래에 실패 줄과 `다시 저장`을 보인다.
// 보관한 카드의 보기 전용 모드에서는 이 컴포넌트를 그리지 않는다 (ASM-015).

export const PROGRESS_INPUT_LABEL = '기록 내용'
export const ADD_PROGRESS_LABEL = '기록 추가'

/** 기록에 붙는 상태 줄 글자. 저장된 카드 상태를 보여 준다. */
export function progressStatusText(status: Status): string {
  return `기록에 붙는 상태: ${STATUS_LABEL[status]}`
}

export interface ProgressInputProps {
  /** 카드의 저장된 상태. 위 입력 항목에서 상태를 고쳤어도 카드를 저장하기 전에는 바뀌지 않는다. */
  status: Status
  /** 기록을 저장한다. 저장되면 true, 실패하면 false. 예외는 실패로 본다. */
  onSubmit: (content: string) => Promise<boolean>
}

export function ProgressInput({ status, onSubmit }: ProgressInputProps) {
  const [content, setContent] = useState('')
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // 빈 내용이거나 공백뿐이면 눌리지 않는다 (UC-006 Alt Flow 1). 저장 중에는 겹쳐 누르지 못한다.
  const canSubmit = content.trim() !== '' && !pending

  async function submit() {
    if (!canSubmit) return
    setPending(true)
    setFailed(false)
    const saved = await onSubmit(content).catch(() => false)
    if (!mounted.current) return
    setPending(false)
    if (saved) setContent('')
    else setFailed(true)
  }

  return (
    <div className="progress-input">
      <TextArea label={PROGRESS_INPUT_LABEL} value={content} onChange={setContent} rows={3} readOnly={pending} />
      {failed ? (
        <div className="progress-input__failed" role="alert">
          <p className="progress-input__failed-text">
            <Icon name="error" />
            <span>{SAVE_FAILED_PROGRESS_TEXT}</span>
          </p>
          <Button small onClick={() => void submit()} disabled={!canSubmit}>
            {RETRY_SAVE_LABEL}
          </Button>
        </div>
      ) : null}
      <div className="progress-input__row">
        <span className="progress-input__status">{progressStatusText(status)}</span>
        <Button variant="primary" onClick={() => void submit()} disabled={!canSubmit}>
          {ADD_PROGRESS_LABEL}
        </Button>
      </div>
    </div>
  )
}
