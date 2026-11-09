import { useEffect, useRef, useState } from 'react'
import type { Card, CardDetail, ProgressEntry } from '@shared/types/card'
import type { AppError, Result, Violation } from '@shared/types/result'
import { Banner } from '../../common/Banner'
import { Button, IconButton } from '../../common/Button'
import { KindChip } from '../../common/Chips'
import { useChanges } from '../../state/change-runner'
import {
  CANCEL_LABEL,
  DELETE_LABEL,
  ERROR_TEXT,
  LOADING_TEXT,
  RETRY_SAVE_LABEL,
  SAVE_FAILED_CARD_TEXT,
  SAVE_FAILED_DIALOG_TEXT,
  UNEXPECTED_ERROR_TEXT,
  errorText,
} from '../../text/labels'
import { CardForm } from './CardForm'
import type { CardFormMode } from './CardForm'
import { DeleteConfirmBar } from './DeleteConfirmBar'
import { emptyForm, formFromCard, toCreateInput, toPatch } from './card-form-state'
import type { FormValues } from './card-form-state'
import { ProgressInput } from './ProgressInput'
import { ProgressLog, formatEntryTime } from './ProgressLog'
import './card-dialog.css'

// 카드 입력·상세 대화상자 (SCR-002, 내장 <dialog> + showModal(), ADR-011).
// 모드: new(카드 만들기) / edit(카드 상세) / readonly(보관한 카드, 닫기와 삭제만. AC-040, ASM-015).
// 만들기·수정·삭제·보관은 낙관적 반영이 없다: 저장이 성공한 뒤에만 onClose 를 부른다.
// 저장이 실패하면 대화상자를 열어 둔 채 입력을 그대로 두고 머리 아래 알림 줄과 `다시 저장`을 보인다 (AC-031).
// 검증은 저장 전에 미리 하고(AC-002, AC-029, AC-035), main 의 VALIDATION_FAILED 위반도 같은 칸에 붙인다.
// 진행 기록 추가는 카드 저장과 별개로 즉시 저장한다. 닫으면 미저장 입력은 버려진다 (닫기 전 경고 없음).
// Electron 창에서 <dialog> 의 동작은 확인하지 못했다 (ADR-011).

export const DIALOG_TITLE: Record<CardFormMode, string> = {
  new: '카드 만들기',
  edit: '카드 상세',
  readonly: '보관한 카드',
}
export const CLOSE_LABEL = '닫기'
export const SAVE_LABEL = '저장'
export const ARCHIVE_LABEL = '보관'
export const ARCHIVE_CONFIRM_LABEL = '보관 확인'
export const NEW_CARD_LOG_NOTE = '카드를 저장한 뒤 기록을 남길 수 있습니다'
export const ARCHIVED_AT_LABEL = '보관한 날'

/** 입력칸이 있어 오류를 칸 아래에 붙일 수 있는 이름. 그 밖의 위반은 알림 줄로 알린다. */
const PLACED_FIELDS = ['title', 'dueDate']

type Retry = 'save' | 'delete' | 'archive'
type Step = 'none' | 'delete' | 'archive'
type Notice = { message: string; detail?: string; retry: Retry | null }

export interface CardDialogProps {
  mode: CardFormMode
  /** new 모드에서는 null. */
  cardId: string | null
  /** 닫을 때(취소·✕·Esc·저장 성공 뒤). 부모가 대화상자를 내린다. */
  onClose: () => void
}

function violationsOf(error: AppError): Violation[] {
  const details = error.details
  if (typeof details !== 'object' || details === null) return []
  const list = (details as { violations?: unknown }).violations
  if (!Array.isArray(list)) return []
  return list.filter(
    (item): item is Violation =>
      typeof item === 'object' && item !== null && typeof (item as { field?: unknown }).field === 'string',
  )
}

function internalResult(cause: unknown): Result<never> {
  return { ok: false, error: { code: 'INTERNAL', message: cause instanceof Error ? cause.message : String(cause) } }
}

/** mode/cardId 가 바뀌면 안쪽 상태를 새로 만들도록 key 를 건다. */
export function CardDialog(props: CardDialogProps) {
  return <CardDialogBody key={`${props.mode}:${props.cardId ?? ''}`} {...props} />
}

function CardDialogBody({ mode, cardId, onClose }: CardDialogProps) {
  const changes = useChanges()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mounted = useRef(true)

  const needsCard = mode !== 'new'
  const [detail, setDetail] = useState<CardDetail | null>(null)
  const [loadError, setLoadError] = useState<AppError | null>(null)
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [errors, setErrors] = useState<Violation[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [step, setStep] = useState<Step>('none')
  const [pending, setPending] = useState(false)

  const card: Card | null = detail?.card ?? null
  const progress: readonly ProgressEntry[] = detail?.progress ?? []
  const missingCard = needsCard && cardId === null
  const failure: AppError | null = missingCard ? { code: 'CARD_NOT_FOUND', message: 'cardId 가 없습니다' } : loadError
  const ready = !needsCard || card !== null
  // 보관된 카드는 어떤 모드로 열렸든 보기 전용이다 (ASM-015).
  const effectiveMode: CardFormMode = needsCard && card?.archivedAt ? 'readonly' : mode

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // 열기: 모달로 연다. 닫을 때는 부모가 이 컴포넌트를 내리면 요소가 사라지며 함께 닫힌다.
  useEffect(() => {
    const element = dialogRef.current
    if (!element || element.open) return
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
  }, [])

  // 카드와 기록을 받는다 (edit·readonly).
  useEffect(() => {
    if (!needsCard || cardId === null) return
    let alive = true
    void window.kanban.cards
      .get(cardId)
      .catch(internalResult)
      .then((result) => {
        if (!alive) return
        if (result.ok) {
          setDetail(result.value)
          setValues(formFromCard(result.value.card))
        } else {
          setLoadError(result.error)
        }
      })
    return () => {
      alive = false
    }
  }, [needsCard, cardId])

  // 처음 입력칸(제목)으로 포커스. 읽기 전용에서는 옮기지 않는다.
  useEffect(() => {
    if (!ready || effectiveMode === 'readonly') return
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus()
  }, [ready, effectiveMode])

  // 저장 전 검증이나 main 의 거절로 오류가 붙으면 첫 오류 칸으로 포커스.
  useEffect(() => {
    if (errors.length === 0) return
    dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])

  function requestClose() {
    if (!pending) onClose()
  }

  function fail(error: AppError, retry: Retry) {
    if (error.code === 'VALIDATION_FAILED') {
      const violations = violationsOf(error)
      setErrors(violations)
      if (violations.length === 0 || violations.some((v) => !PLACED_FIELDS.includes(v.field))) {
        setNotice({ message: ERROR_TEXT.VALIDATION_FAILED, retry: null })
      }
      return
    }
    if (error.code === 'SAVE_FAILED') {
      setNotice({ message: retry === 'save' ? SAVE_FAILED_DIALOG_TEXT : SAVE_FAILED_CARD_TEXT, retry })
    } else if (error.code === 'INTERNAL') {
      setNotice({ message: UNEXPECTED_ERROR_TEXT, detail: error.message, retry })
    } else {
      // 카드 없음·보관됨·잠김: 다시 보내도 같으므로 다시 저장은 없다.
      setNotice({ message: errorText(error.code), retry: null })
    }
  }

  /** 저장 요청 한 번. 성공하면 닫고, 실패하면 화면을 그대로 두고 알림을 보인다. */
  async function perform(call: () => Promise<Result<unknown>>, retry: Retry) {
    if (pending) return
    setPending(true)
    setNotice(null)
    const result = await call().catch(internalResult)
    if (!mounted.current) return
    setPending(false)
    if (result.ok) onClose()
    else fail(result.error, retry)
  }

  /**
   * 저장 시점의 입력값. 날짜 입력칸이 비어 있는 채로 월·일만 입력되면 값이 ''에서 ''로 그대로여서
   * 브라우저가 input 이벤트를 내지 않는다. 그래서 onChange 로 받은 dueDateBadInput 이 낡을 수 있으므로
   * 검증 직전에 입력칸의 validity.badInput 을 직접 읽어 반영한다 (AC-029).
   */
  function valuesForSubmit(): FormValues {
    const input = dialogRef.current?.querySelector<HTMLInputElement>('input[type="date"]')
    if (!input) return values
    const dueDateBadInput = input.validity.badInput
    return dueDateBadInput === values.dueDateBadInput ? values : { ...values, dueDateBadInput }
  }

  async function submit() {
    if (pending) return
    const current = valuesForSubmit()
    if (effectiveMode === 'new') {
      const made = toCreateInput(current)
      if (!made.ok) {
        setErrors(made.errors)
        return
      }
      setErrors([])
      await perform(() => changes.createCard(made.value), 'save')
    } else if (effectiveMode === 'edit' && card) {
      const made = toPatch(current, card)
      if (!made.ok) {
        setErrors(made.errors)
        return
      }
      setErrors([])
      if (Object.keys(made.value).length === 0) {
        onClose() // 바뀐 칸이 없으면 보낼 것이 없다
        return
      }
      await perform(() => changes.updateCard(card.id, made.value), 'save')
    }
  }

  async function removeCard() {
    if (card) await perform(() => changes.deleteCard(card.id), 'delete')
  }

  async function archiveCard() {
    if (card) await perform(() => changes.archiveCard(card.id), 'archive')
  }

  function retry() {
    if (notice?.retry === 'save') void submit()
    else if (notice?.retry === 'delete') void removeCard()
    else if (notice?.retry === 'archive') void archiveCard()
  }

  async function addProgress(content: string): Promise<boolean> {
    if (!card) return false
    const result = await changes.addProgress(card.id, content)
    if (!result.ok) return false
    if (mounted.current) {
      setDetail((current) => (current ? { ...current, progress: [...current.progress, result.value] } : current))
    }
    return true
  }

  function onFormChange(patch: Partial<FormValues>) {
    setValues((current) => ({ ...current, ...patch }))
    // 고친 칸의 오류는 지운다 (다음 저장에서 다시 검사한다)
    const touched = Object.keys(patch)
    setErrors((current) =>
      current.some((v) => touched.includes(v.field)) ? current.filter((v) => !touched.includes(v.field)) : current,
    )
  }

  function renderFoot() {
    if (failure !== null || !ready) {
      return (
        <div className="card-dialog__foot">
          <span />
          <div className="card-dialog__foot-actions">
            <Button onClick={requestClose}>{CLOSE_LABEL}</Button>
          </div>
        </div>
      )
    }
    if (step === 'delete' && card) {
      return (
        <DeleteConfirmBar
          progressCount={progress.length}
          pending={pending}
          onConfirm={() => void removeCard()}
          onCancel={() => {
            setStep('none')
            setNotice(null)
          }}
        />
      )
    }
    const canArchive = effectiveMode === 'edit' && card?.status === 'done' && card.archivedAt === null
    return (
      <div className="card-dialog__foot">
        <div className="card-dialog__foot-left">
          {effectiveMode === 'new' ? null : step === 'archive' ? (
            <>
              <Button variant="primary" disabled={pending} onClick={() => void archiveCard()}>
                {ARCHIVE_CONFIRM_LABEL}
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  setStep('none')
                  setNotice(null)
                }}
              >
                {CANCEL_LABEL}
              </Button>
            </>
          ) : (
            <>
              <Button icon="trash" disabled={pending} onClick={() => setStep('delete')}>
                {DELETE_LABEL}
              </Button>
              {canArchive ? (
                <Button icon="archive" disabled={pending} onClick={() => setStep('archive')}>
                  {ARCHIVE_LABEL}
                </Button>
              ) : null}
            </>
          )}
        </div>
        <div className="card-dialog__foot-actions">
          {effectiveMode === 'readonly' ? (
            <Button onClick={requestClose} disabled={pending}>
              {CLOSE_LABEL}
            </Button>
          ) : (
            <>
              <Button onClick={requestClose} disabled={pending}>
                {CANCEL_LABEL}
              </Button>
              <Button variant="primary" onClick={() => void submit()} disabled={pending}>
                {SAVE_LABEL}
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  const titleId = 'card-dialog-title'
  const alert = failure
    ? { message: errorText(failure.code), detail: failure.code === 'INTERNAL' ? failure.message : undefined }
    : notice

  return (
    <dialog
      ref={dialogRef}
      className="card-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: 요소가 스스로 닫히지 않게 하고 같은 경로(requestClose)로 닫는다. 저장 중에는 닫지 않는다.
        event.preventDefault()
        requestClose()
      }}
    >
      <header className="card-dialog__head">
        <h2 className="card-dialog__title" id={titleId}>
          {DIALOG_TITLE[effectiveMode]}
        </h2>
        {effectiveMode !== 'new' && card ? (
          <span className="card-dialog__kind">
            <KindChip kind={card.kind} />
          </span>
        ) : null}
        <span className="card-dialog__head-spacer" />
        <IconButton icon="close" label={CLOSE_LABEL} onClick={requestClose} disabled={pending} />
      </header>
      {alert ? (
        <div className="card-dialog__alert">
          <Banner
            message={alert.message}
            detail={alert.detail}
            actionLabel={'retry' in alert && alert.retry ? RETRY_SAVE_LABEL : undefined}
            onAction={'retry' in alert && alert.retry ? retry : undefined}
          />
        </div>
      ) : null}
      <div className="card-dialog__body">
        <div className="card-dialog__form-col">
          {ready && failure === null ? (
            <>
              <CardForm
                values={values}
                errors={errors}
                mode={effectiveMode}
                onChange={onFormChange}
                disabled={pending}
              />
              {effectiveMode === 'readonly' && card?.archivedAt ? (
                <p className="card-dialog__log-note">
                  {ARCHIVED_AT_LABEL}: {formatEntryTime(card.archivedAt)}
                </p>
              ) : null}
            </>
          ) : failure === null ? (
            <p className="card-dialog__log-note" role="status">
              {LOADING_TEXT}
            </p>
          ) : null}
        </div>
        <div className="card-dialog__log-col">
          {effectiveMode === 'new' ? (
            <p className="card-dialog__log-note">{NEW_CARD_LOG_NOTE}</p>
          ) : card ? (
            <>
              <ProgressLog entries={progress} />
              {effectiveMode === 'edit' ? <ProgressInput status={card.status} onSubmit={addProgress} /> : null}
            </>
          ) : null}
        </div>
      </div>
      {renderFoot()}
    </dialog>
  )
}
