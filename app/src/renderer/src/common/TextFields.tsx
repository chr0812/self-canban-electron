import { useId } from 'react'
import type { ChangeEvent, InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react'
import { Icon } from './Icon'

// 글 입력과 여러 줄 입력. 항상 보이는 라벨, 오류 줄(오류 아이콘 + 문구), 오류일 때 2px 테두리.
// 모양은 common.css 의 .field 규칙이 정한다. 값은 부모가 쥔다 (controlled): onChange 는 글자를 바로 준다.
// 오류는 색만으로 알리지 않는다: 아이콘 + 문구 + 테두리 굵기 (NFR-004 와 같은 원칙).

interface FieldShellProps {
  id: string
  label: string
  error: string | null | undefined
  className: string | undefined
  /** 라벨 줄 오른쪽에 붙는 보조 글자 (예: 글자 수). */
  hint: ReactNode
  children: ReactNode
}

function FieldShell({ id, label, error, className, hint, children }: FieldShellProps) {
  const invalid = Boolean(error)
  return (
    <div className={className ? `field ${className}` : 'field'} data-invalid={invalid ? 'true' : undefined}>
      <label className="field__label" htmlFor={id}>
        {label}
        {hint ? <span style={{ marginLeft: 8, fontWeight: 400 }}>{hint}</span> : null}
      </label>
      {children}
      {invalid ? (
        <p className="field__error" id={`${id}-error`} style={{ margin: 0 }}>
          <Icon name="error" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

interface FieldCommonProps {
  /** 입력칸 위에 항상 보이는 라벨. */
  label: string
  value: string
  onChange: (value: string) => void
  /** 오류 문구. 있으면 오류 줄과 2px 테두리가 나타난다. */
  error?: string | null
  hint?: ReactNode
  className?: string
}

type NativeInput = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className' | 'id'>
type NativeTextArea = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className' | 'id'>

export interface TextInputProps extends FieldCommonProps, NativeInput {
  ref?: Ref<HTMLInputElement>
  /** 부모가 정한 id. 없으면 자동으로 만든다 (오류가 붙은 입력칸을 찾는 데 쓴다). */
  id?: string
}

export function TextInput({
  label,
  value,
  onChange,
  error,
  hint,
  className,
  id,
  ref,
  type = 'text',
  ...rest
}: TextInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell id={inputId} label={label} error={error} className={className} hint={hint}>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        type={type}
        className="field__input"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

export interface TextAreaProps extends FieldCommonProps, NativeTextArea {
  ref?: Ref<HTMLTextAreaElement>
  id?: string
}

export function TextArea({
  label,
  value,
  onChange,
  error,
  hint,
  className,
  id,
  ref,
  rows = 3,
  ...rest
}: TextAreaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell id={inputId} label={label} error={error} className={className} hint={hint}>
      <textarea
        {...rest}
        ref={ref}
        id={inputId}
        rows={rows}
        className="field__input"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}
