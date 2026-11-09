import type { ReactNode } from 'react'

// 인라인 SVG 아이콘. 14px 격자, 선 굵기 1.3~1.6. 외부 아이콘 세트·라이브러리를 쓰지 않는다 (NFR-001).
// 도형은 모두 직접 그린 것이다 (06-file-map 결정 필요 7의 임시 가정).
// 색은 currentColor 라서 부모의 글자색(`color`)을 따른다.

const SHAPES = {
  // 개발 버그 칩의 종류 아이콘 (NFR-004)
  bug: (
    <>
      <ellipse cx="7" cy="8.2" rx="2.6" ry="3.4" />
      <path d="M5.5 4.9a1.5 1.5 0 0 1 3 0" />
      <path d="M7 5.6v6" />
      <path d="M4.4 7H2.4M9.6 7h2M4.6 9.6 3.2 11M9.4 9.6 10.8 11M4.8 5.4 3.4 4.2M9.2 5.4l1.4-1.2" />
    </>
  ),
  // 할 일 종류 아이콘 (체크 칸)
  task: (
    <>
      <rect x="2" y="2" width="10" height="10" rx="2" />
      <path d="m4.8 7.2 1.6 1.6 3-3.3" />
    </>
  ),
  // 마감 지남 (삼각형) — 오류 아이콘(원)과 모양이 다르다
  warning: (
    <>
      <path d="M7 2 12.6 11.6H1.4z" />
      <path d="M7 5.8v2.7M7 10.1h.01" />
    </>
  ),
  // 오류 (원 안 느낌표)
  error: (
    <>
      <circle cx="7" cy="7" r="5.3" />
      <path d="M7 4.2v3.4M7 9.7h.01" />
    </>
  ),
  // 완료, 저장됨 (원 안 체크)
  'check-circle': (
    <>
      <circle cx="7" cy="7" r="5.3" />
      <path d="m4.6 7.1 1.8 1.8 3-3.4" />
    </>
  ),
  moon: <path d="M11.6 8.4A5 5 0 0 1 5.6 2.4a5 5 0 1 0 6 6z" />,
  sun: (
    <>
      <circle cx="7" cy="7" r="2.4" />
      <path d="M7 1.2v1.5M7 11.3v1.5M1.2 7h1.5M11.3 7h1.5M2.9 2.9l1.1 1.1M10 10l1.1 1.1M2.9 11.1 4 10M10 4l1.1-1.1" />
    </>
  ),
  // 더보기 ⋯ (채운 점 세 개)
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="2.8" cy="7" r="1.1" />
      <circle cx="7" cy="7" r="1.1" />
      <circle cx="11.2" cy="7" r="1.1" />
    </g>
  ),
  search: (
    <>
      <circle cx="6" cy="6" r="3.9" />
      <path d="m9 9 3.2 3.2" />
    </>
  ),
  close: <path d="m3 3 8 8M11 3l-8 8" />,
  plus: <path d="M7 2.4v9.2M2.4 7h9.2" />,
  'chevron-left': <path d="M8.6 3 4.6 7l4 4" />,
  'chevron-right': <path d="m5.4 3 4 4-4 4" />,
  'chevron-down': <path d="m3 5.4 4 4 4-4" />,
  archive: (
    <>
      <rect x="1.8" y="2.4" width="10.4" height="3" rx="0.9" />
      <path d="M2.8 5.4v5.3a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1V5.4M5.5 8h3" />
    </>
  ),
  trash: (
    <>
      <path d="M2.4 4h9.2M5.4 4V2.5h3.2V4" />
      <path d="m3.7 4 .5 7.5h5.6l.5-7.5M5.9 6.2v3.3M8.1 6.2v3.3" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof SHAPES

export const ICON_NAMES = Object.keys(SHAPES) as IconName[]

export interface IconProps {
  name: IconName
  /** 한 변 길이(px). 기본 14 (격자와 같다). */
  size?: number
  /** 선 굵기. 기본 1.5 (허용 범위 1.3~1.6). */
  strokeWidth?: number
  /** 있으면 스크린리더가 읽는 이름이 된다. 없으면 장식이라 숨긴다 (옆에 글자가 있을 때). */
  label?: string
  className?: string
}

export function Icon({ name, size = 14, strokeWidth = 1.5, label, className }: IconProps) {
  const a11y = label ? ({ role: 'img', 'aria-label': label } as const) : ({ 'aria-hidden': true } as const)
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      {SHAPES[name]}
    </svg>
  )
}
