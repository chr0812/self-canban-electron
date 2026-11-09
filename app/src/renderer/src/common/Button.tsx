import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

// 버튼과 아이콘 버튼. 모양은 common.css 의 .btn 규칙이 정한다 (높이 28~36, 글자 14, 포커스 링).
// type 은 기본 "button" 이다: 입력칸 묶음 안에서 눌러도 폼이 제출되지 않는다.

export type ButtonVariant = 'primary' | 'secondary' | 'text'

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>

export interface ButtonProps extends NativeButtonProps {
  /** 주요(채움) / 보조(테두리) / 글자(테두리 없음). 기본 보조. */
  variant?: ButtonVariant
  /** 작은 버튼 (높이 28, 글자 12). */
  small?: boolean
  /** 글자 앞에 놓는 아이콘 (예: 카드 만들기의 +). */
  icon?: IconName
  className?: string
  ref?: Ref<HTMLButtonElement>
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  small = false,
  icon,
  className,
  type = 'button',
  children,
  ref,
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`]
  if (small) classes.push('btn--sm')
  if (className) classes.push(className)
  return (
    <button ref={ref} type={type} className={classes.join(' ')} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  )
}

export interface IconButtonProps extends NativeButtonProps {
  icon: IconName
  /** 스크린리더가 읽는 이름. 글자가 없는 버튼이라 반드시 있어야 한다. */
  label: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ icon, label, className, type = 'button', ref, title, ...rest }: IconButtonProps) {
  const classes = ['btn', 'btn--text', 'btn--icon']
  if (className) classes.push(className)
  return (
    <button ref={ref} type={type} className={classes.join(' ')} aria-label={label} title={title ?? label} {...rest}>
      <Icon name={icon} />
    </button>
  )
}
