import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CREATE_STATUSES, PRIORITIES, STATUSES, KINDS } from '@shared/constants'
import type { Kind, Priority, Status } from '@shared/types/card'
import type { Violation } from '@shared/types/result'
import { SegmentedControl } from '../../common/SegmentedControl'
import type { SegmentedOption } from '../../common/SegmentedControl'
import { TextArea, TextInput } from '../../common/TextFields'
import { KindChip } from '../../common/Chips'
import { Icon } from '../../common/Icon'
import { KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL, violationText } from '../../text/labels'
import type { FormValues } from './card-form-state'
import './card-dialog.css'

// 카드 입력칸 묶음 (SCR-002 왼쪽 열, FR-001 / FR-004 / FR-007 / FR-008 / FR-011).
// 값은 부모(CardDialog)가 쥔다 (controlled). 칸 아래 오류는 errors 의 field 로 붙인다 (제목, 마감일).
// 모드: new = 상태는 할 일·진행 중 중에서 고른다(처음 할 일, 완료 없음) / edit = 세 상태 모두 입력 가능 /
//       readonly = 보관한 카드, 입력 대신 읽기 전용 글자.
// 마감일은 브라우저 기본 날짜 입력칸(type="date")이다. 입력하다 만 값은 validity.badInput 으로 부모에 알린다 (AC-029, AC-043).

export type CardFormMode = 'new' | 'edit' | 'readonly'

export const TITLE_LABEL = '제목'
export const TITLE_REQUIRED_HINT = '필수'
export const KIND_FIELD_LABEL = '종류'
export const STATUS_FIELD_LABEL = '상태'
export const DUE_DATE_LABEL = '마감일'
export const PRIORITY_FIELD_LABEL = '우선순위'
export const PRIORITY_NONE_LABEL = '없음'
export const DESCRIPTION_LABEL = '상세 설명'
export const MEMO_LABEL = '추가 메모'
/** 읽기 전용 모드에서 값이 비었을 때 보이는 글자. */
export const EMPTY_VALUE_TEXT = '없음'

const KIND_OPTIONS: readonly SegmentedOption<Kind>[] = KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }))

const PRIORITY_OPTIONS: readonly SegmentedOption<Priority | ''>[] = [
  { value: '', label: PRIORITY_NONE_LABEL },
  ...PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABEL[priority] })),
]

const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }
const cellStyle: CSSProperties = { flex: '0 0 auto' }
const wideStyle: CSSProperties = { flex: '1 1 160px' }
const readTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: '20px',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

/** 입력칸 이름에 해당하는 오류 문구. 없으면 null. */
function messageFor(errors: readonly Violation[], field: string): string | null {
  const found = errors.find((violation) => violation.field === field)
  return found ? violationText(found) : null
}

export interface CardFormProps {
  values: FormValues
  /** 저장 전 미리 검증 또는 `VALIDATION_FAILED` 의 위반. field 가 title·dueDate 인 것이 칸 아래에 붙는다. */
  errors: readonly Violation[]
  mode: CardFormMode
  /** 칸 하나의 값이 바뀔 때: 바뀐 칸만 담아 부른다. */
  onChange: (patch: Partial<FormValues>) => void
  /** 입력을 잠근다 (저장 중). 읽기 전용 모드와 달리 입력 모양은 그대로다. */
  disabled?: boolean
}

function ReadOnlyItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <dt className="field__label">{label}</dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  )
}

function ReadOnlyValues({ values }: { values: FormValues }) {
  const textOrNone = (text: string) => (text === '' ? EMPTY_VALUE_TEXT : text)
  return (
    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ReadOnlyItem label={TITLE_LABEL}>
        <p style={{ ...readTextStyle, fontWeight: 600 }}>{values.title}</p>
      </ReadOnlyItem>
      <div style={rowStyle}>
        <ReadOnlyItem label={KIND_FIELD_LABEL}>
          <KindChip kind={values.kind} />
        </ReadOnlyItem>
        <ReadOnlyItem label={STATUS_FIELD_LABEL}>
          <p style={readTextStyle}>{STATUS_LABEL[values.status]}</p>
        </ReadOnlyItem>
        <ReadOnlyItem label={DUE_DATE_LABEL}>
          <p style={readTextStyle}>{textOrNone(values.dueDate)}</p>
        </ReadOnlyItem>
        <ReadOnlyItem label={PRIORITY_FIELD_LABEL}>
          <p style={readTextStyle}>{values.priority === '' ? EMPTY_VALUE_TEXT : PRIORITY_LABEL[values.priority]}</p>
        </ReadOnlyItem>
      </div>
      <ReadOnlyItem label={DESCRIPTION_LABEL}>
        <p style={readTextStyle}>{textOrNone(values.description)}</p>
      </ReadOnlyItem>
      <ReadOnlyItem label={MEMO_LABEL}>
        <p style={readTextStyle}>{textOrNone(values.memo)}</p>
      </ReadOnlyItem>
    </dl>
  )
}

export function CardForm({ values, errors, mode, onChange, disabled = false }: CardFormProps) {
  const statusId = useId()
  const dueDateId = useId()
  if (mode === 'readonly') return <ReadOnlyValues values={values} />

  const dueDateError = messageFor(errors, 'dueDate')
  // 새 카드는 할 일·진행 중 둘 중에서 고른다(완료 없음, AC-042). 상세(편집)는 세 상태 모두.
  const statusChoices: readonly Status[] = mode === 'new' ? CREATE_STATUSES : STATUSES
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TextInput
        label={TITLE_LABEL}
        hint={TITLE_REQUIRED_HINT}
        value={values.title}
        onChange={(title) => onChange({ title })}
        error={messageFor(errors, 'title')}
        readOnly={disabled}
        autoComplete="off"
      />
      <div style={rowStyle}>
        <div className="field" style={cellStyle}>
          <span className="field__label">{KIND_FIELD_LABEL}</span>
          <SegmentedControl
            options={KIND_OPTIONS}
            value={values.kind}
            onChange={(kind) => onChange({ kind })}
            ariaLabel={KIND_FIELD_LABEL}
            disabled={disabled}
          />
        </div>
        <div className="field" style={wideStyle}>
          <label className="field__label" htmlFor={statusId}>
            {STATUS_FIELD_LABEL}
          </label>
          <select
            id={statusId}
            className="field__input"
            value={values.status}
            disabled={disabled}
            onChange={(event) => onChange({ status: event.target.value as Status })}
          >
            {statusChoices.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={rowStyle}>
        <div className="field" style={wideStyle} data-invalid={dueDateError ? 'true' : undefined}>
          <label className="field__label" htmlFor={dueDateId}>
            {DUE_DATE_LABEL}
          </label>
          <input
            id={dueDateId}
            type="date"
            className="field__input"
            value={values.dueDate}
            disabled={disabled}
            aria-invalid={dueDateError ? true : undefined}
            aria-describedby={dueDateError ? `${dueDateId}-error` : undefined}
            onChange={(event) =>
              onChange({ dueDate: event.target.value, dueDateBadInput: event.target.validity.badInput })
            }
          />
          {dueDateError ? (
            <p className="field__error" id={`${dueDateId}-error`} style={{ margin: 0 }}>
              <Icon name="error" />
              <span>{dueDateError}</span>
            </p>
          ) : null}
        </div>
        <div className="field" style={cellStyle}>
          <span className="field__label">{PRIORITY_FIELD_LABEL}</span>
          <SegmentedControl
            options={PRIORITY_OPTIONS}
            value={values.priority}
            onChange={(priority) => onChange({ priority })}
            ariaLabel={PRIORITY_FIELD_LABEL}
            disabled={disabled}
          />
        </div>
      </div>
      <TextArea
        label={DESCRIPTION_LABEL}
        value={values.description}
        onChange={(description) => onChange({ description })}
        rows={4}
        readOnly={disabled}
      />
      <TextArea
        label={MEMO_LABEL}
        value={values.memo}
        onChange={(memo) => onChange({ memo })}
        rows={3}
        readOnly={disabled}
      />
    </div>
  )
}
