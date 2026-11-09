import { describe, expect, test } from 'vitest'
import {
  emptyForm,
  fieldErrors,
  formFromCard,
  toCreateInput,
  toPatch,
} from '../../../src/renderer/src/features/card-dialog/card-form-state'
import type { FormValues } from '../../../src/renderer/src/features/card-dialog/card-form-state'
import { PRIORITY_LABEL } from '../../../src/renderer/src/text/labels'
import { makeCard } from '../support/builders'

function titled(title: string, overrides: Partial<FormValues> = {}): FormValues {
  return { ...emptyForm(), title, ...overrides }
}

describe('입력칸 값 -> 만들기 입력', () => {
  test('TC-061 비워 둔 마감일과 우선순위 입력칸은 비움 값으로 변환된다', () => {
    const blank = toCreateInput(titled('로그인 오류 수정'))
    expect(blank.ok).toBe(true)
    if (!blank.ok) return
    expect(blank.value.dueDate).toBeNull()
    expect(blank.value.priority).toBeNull()
    expect(blank.value.title).toBe('로그인 오류 수정')

    // 우선순위 `높음`은 화면 글자이고 입력칸 값은 high 다.
    expect(PRIORITY_LABEL.high).toBe('높음')
    const filled = toCreateInput(titled('세금 신고', { dueDate: '2026-11-06', priority: 'high' }))
    expect(filled.ok).toBe(true)
    if (!filled.ok) return
    expect(filled.value.dueDate).toBe('2026-11-06')
    expect(filled.value.priority).toBe('high')

    // 우선순위 `중간`은 medium 이다 (명세 v4).
    expect(PRIORITY_LABEL.medium).toBe('중간')
    const medium = toCreateInput(titled('세금 신고', { dueDate: '2026-11-06', priority: 'medium' }))
    expect(medium.ok).toBe(true)
    if (!medium.ok) return
    expect(medium.value.dueDate).toBe('2026-11-06')
    expect(medium.value.priority).toBe('medium')
  })

  test('TC-061 공백뿐인 마감일 칸도 비움 값(null)이 된다', () => {
    const result = toCreateInput(titled('제목', { dueDate: '   ' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.dueDate).toBeNull()
  })

  test('TC-061 종류·설명·메모가 그대로 전달된다 (AC-015)', () => {
    const result = toCreateInput(titled('제목', { kind: 'bug', description: '상세', memo: '메모' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        title: '제목',
        status: 'todo',
        kind: 'bug',
        description: '상세',
        dueDate: null,
        priority: null,
        memo: '메모',
      })
    }
  })
})

describe('오류', () => {
  test('TC-062 빈 제목과 존재하지 않는 마감일은 해당 입력칸의 오류로 변환된다', () => {
    const values = titled('', { dueDate: '2026-02-30' })
    const errors = fieldErrors(values)
    expect(errors).toContainEqual({ field: 'title', reason: 'REQUIRED' })
    expect(errors).toContainEqual({ field: 'dueDate', reason: 'INVALID_DATE' })
    expect(errors).toHaveLength(2)

    const created = toCreateInput(values)
    expect(created.ok).toBe(false)
    if (!created.ok) expect(created.errors).toEqual(errors)
    expect('value' in created).toBe(false)
  })

  test('TC-062 수정 모드에서도 빈 제목은 제목 칸 오류가 되고 저장 값은 만들어지지 않는다', () => {
    const card = makeCard({ title: '기존 제목' })
    const result = toPatch({ ...formFromCard(card), title: '' }, card)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toEqual([{ field: 'title', reason: 'REQUIRED' }])
    expect('value' in result).toBe(false)
  })

  test('TC-062 공백뿐인 제목은 빈 제목과 같이 제목 칸 오류다', () => {
    expect(fieldErrors(titled('   '))).toEqual([{ field: 'title', reason: 'REQUIRED' }])
  })

  test('TC-062 마감일 칸이 비어 있어도 입력하다 만 값 플래그가 켜져 있으면 마감일 칸 오류이고 마감 없음으로 변환되지 않는다', () => {
    const values = titled('세금 신고', { dueDate: '', dueDateBadInput: true })
    const errors = fieldErrors(values)
    expect(errors).toEqual([{ field: 'dueDate', reason: 'INVALID_DATE' }])

    const created = toCreateInput(values)
    expect(created.ok).toBe(false)
    if (!created.ok) expect(created.errors).toEqual(errors)
    expect('value' in created).toBe(false)

    const card = makeCard({ dueDate: '2026-11-06' })
    const patched = toPatch({ ...formFromCard(card), dueDate: '', dueDateBadInput: true }, card)
    expect(patched.ok).toBe(false)
    if (!patched.ok) expect(patched.errors).toEqual([{ field: 'dueDate', reason: 'INVALID_DATE' }])
    expect('value' in patched).toBe(false)

    // 플래그가 꺼진 빈 칸은 오류가 아니다 (칸을 지운 경우).
    expect(fieldErrors(titled('세금 신고', { dueDate: '', dueDateBadInput: false }))).toEqual([])
  })

  test('TC-062 형식이 틀린 마감일도 마감일 칸 오류다', () => {
    expect(fieldErrors(titled('제목', { dueDate: '11/06' }))).toEqual([{ field: 'dueDate', reason: 'INVALID_DATE' }])
    expect(fieldErrors(titled('제목', { dueDate: '2026-11-06' }))).toEqual([])
  })
})

describe('카드 -> 입력칸 값, 수정 값', () => {
  test('TC-061 formFromCard 는 null 마감일·우선순위를 빈 칸으로 채운다', () => {
    const form = formFromCard(makeCard({ dueDate: null, priority: null }))
    expect(form.dueDate).toBe('')
    expect(form.priority).toBe('')
    const filled = formFromCard(makeCard({ dueDate: '2026-11-06', priority: 'low', status: 'done' }))
    expect(filled.dueDate).toBe('2026-11-06')
    expect(filled.priority).toBe('low')
    expect(filled.status).toBe('done')
  })

  test('TC-061 마감일·우선순위를 비우고 저장하면 patch 에 null 이 담긴다', () => {
    const card = makeCard({ dueDate: '2026-11-06', priority: 'high' })
    const result = toPatch({ ...formFromCard(card), dueDate: '', priority: '' }, card)
    expect(result).toEqual({ ok: true, value: { dueDate: null, priority: null } })
  })

  test('TC-061 바꾸지 않은 칸은 patch 에 없다 (AC-022)', () => {
    const card = makeCard({ title: '기존', dueDate: '2026-11-06' })
    expect(toPatch(formFromCard(card), card)).toEqual({ ok: true, value: {} })
    const changed = toPatch({ ...formFromCard(card), title: '고친 제목', status: 'in_progress', memo: '새 메모' }, card)
    expect(changed).toEqual({ ok: true, value: { title: '고친 제목', status: 'in_progress', memo: '새 메모' } })
  })

  test('TC-062 새 입력칸 값은 종류 할 일, 상태 할 일, 나머지는 비어 있다', () => {
    expect(emptyForm()).toEqual({
      title: '',
      kind: 'task',
      status: 'todo',
      dueDate: '',
      dueDateBadInput: false,
      priority: '',
      description: '',
      memo: '',
    })
  })
})

describe('새 카드의 상태', () => {
  test('TC-158 새 카드 입력칸의 처음 상태는 할 일이고 고른 상태가 만들기 입력의 상태가 된다', () => {
    expect(emptyForm().status).toBe('todo')

    const first = toCreateInput(titled('세금 신고'))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.status).toBe('todo')

    const second = toCreateInput(titled('세금 신고', { status: 'in_progress' }))
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.status).toBe('in_progress')

    // 수정 모드: 카드의 현재 상태 그대로 (세 값 모두 가질 수 있다).
    const done = makeCard({ status: 'done' })
    expect(formFromCard(done).status).toBe('done')
    expect(toPatch(formFromCard(done), done)).toEqual({ ok: true, value: {} })
    expect(toPatch({ ...formFromCard(done), status: 'todo' }, done)).toEqual({ ok: true, value: { status: 'todo' } })
  })

  test('TC-158 완료로는 만들 수 없다 (AC-042)', () => {
    const result = toCreateInput(titled('세금 신고', { status: 'done' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toEqual([{ field: 'status', reason: 'INVALID_VALUE' }])
  })
})

describe('날짜 입력칸 값', () => {
  test('TC-159 날짜 입력칸의 값은 달력으로 고르든 직접 입력하든 같은 마감일 입력으로 변환된다', () => {
    const picked = toCreateInput(titled('세금 신고', { dueDate: '2026-11-20' })) // 달력으로 고른 값
    const typed = toCreateInput(titled('세금 신고', { dueDate: '2026-11-20' })) // 직접 입력한 값
    expect(picked.ok).toBe(true)
    expect(picked).toEqual(typed)
    if (picked.ok) expect(picked.value.dueDate).toBe('2026-11-20')

    // 칸을 지운 경우: 만들기는 마감일 null, 수정은 dueDate: null patch.
    const cleared = toCreateInput(titled('세금 신고', { dueDate: '', dueDateBadInput: false }))
    expect(cleared.ok).toBe(true)
    if (cleared.ok) expect(cleared.value.dueDate).toBeNull()
    const card = makeCard({ dueDate: '2026-11-06' })
    expect(toPatch({ ...formFromCard(card), dueDate: '' }, card)).toEqual({ ok: true, value: { dueDate: null } })

    // 일부만 채운 경우: 마감일 칸 오류이고 저장 값이 없다.
    const partial = toCreateInput(titled('세금 신고', { dueDate: '', dueDateBadInput: true }))
    expect(partial.ok).toBe(false)
    if (!partial.ok) expect(partial.errors).toEqual([{ field: 'dueDate', reason: 'INVALID_DATE' }])
    expect('value' in partial).toBe(false)
    const partialEdit = toPatch({ ...formFromCard(card), dueDate: '', dueDateBadInput: true }, card)
    expect(partialEdit.ok).toBe(false)
    if (!partialEdit.ok) expect(partialEdit.errors).toEqual([{ field: 'dueDate', reason: 'INVALID_DATE' }])
  })
})
