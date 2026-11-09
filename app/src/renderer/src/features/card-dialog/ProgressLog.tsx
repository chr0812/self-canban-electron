import { useEffect, useRef } from 'react'
import type { Instant, ProgressEntry } from '@shared/types/card'
import { Chip } from '../../common/Chips'
import { STATUS_LABEL } from '../../text/labels'
import './card-dialog.css'

// 진행 기록 목록 (SCR-002 오른쪽 열, FR-009).
// 남긴 순서대로 위에서 아래로 쌓이고(받은 순서 그대로 그린다) 새 기록이 맨 아래에 붙으면 그 위치로 스크롤한다 (AC-017).
// 기록마다 남긴 때와 그때의 카드 상태 칩이 함께 보인다 (AC-018). 기록의 수정·삭제는 만들지 않는다 (CAND-009).
// 보관한 카드의 보기 전용 모드에서도 그대로 쓴다: 이 컴포넌트에는 입력이 없다.

export const PROGRESS_TITLE = '진행 기록'
export const PROGRESS_EMPTY_TEXT = '아직 남긴 기록이 없습니다'

function two(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * 기록을 남긴 때를 화면 글자로 바꾼다. 저장은 UTC 문자열이고 여기서만 현지 시각으로 바꾼다.
 * 올해면 `MM/DD HH:mm`, 해가 다르면 `YYYY/MM/DD HH:mm`. 읽을 수 없는 값은 받은 글자 그대로 둔다.
 */
export function formatEntryTime(createdAt: Instant, now: Date = new Date()): string {
  const at = new Date(createdAt)
  if (Number.isNaN(at.getTime())) return createdAt
  const day = `${two(at.getMonth() + 1)}/${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`
  return at.getFullYear() === now.getFullYear() ? day : `${at.getFullYear()}/${day}`
}

export interface ProgressLogProps {
  /** 이 카드의 기록. 남긴 순서(오래된 것이 앞)로 받는다. */
  entries: readonly ProgressEntry[]
  /** 올해 판정 기준. 시험이 고정하려고 둔다. 기본은 지금. */
  now?: Date
}

export function ProgressLog({ entries, now }: ProgressLogProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const count = entries.length

  // 건수가 늘면(새 기록) 맨 아래로. 처음 열 때도 가장 최근 기록이 보이게 한다.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [count])

  return (
    <section className="progress-log" aria-label={PROGRESS_TITLE}>
      <header className="progress-log__head">
        <h3 className="progress-log__title">{PROGRESS_TITLE}</h3>
        <span className="progress-log__count">{count}건</span>
      </header>
      {count === 0 ? (
        <p className="progress-log__empty">{PROGRESS_EMPTY_TEXT}</p>
      ) : (
        <ol className="progress-log__list" ref={listRef} tabIndex={0} aria-label={`${PROGRESS_TITLE} ${count}건`}>
          {entries.map((entry) => (
            <li key={entry.id} className="progress-log__item">
              <div className="progress-log__meta">
                <time className="progress-log__time" dateTime={entry.createdAt}>
                  {formatEntryTime(entry.createdAt, now)}
                </time>
                <Chip variant="outline" className="progress-log__status" data-status={entry.statusAtTime}>
                  {STATUS_LABEL[entry.statusAtTime]}
                </Chip>
              </div>
              <p className="progress-log__content">{entry.content}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
