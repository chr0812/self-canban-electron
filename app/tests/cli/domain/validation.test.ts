import { describe, expect, test } from 'vitest'
import {
  normalizeTitle,
  validateCardInput,
  validateCardQuery,
  validateId,
  validateProgressInput,
  validateStatus,
  validateTheme,
} from '../../../src/shared/domain/validation'
import { makeCard } from '../support/builders'

describe('title', () => {
  test.each([
    ['빈 문자열', { title: '' }],
    ['공백뿐', { title: '   ' }],
    ['탭·줄바꿈뿐', { title: '\t\n ' }],
    ['제목 생략', {}],
  ])('TC-006 제목이 %s 이면 title/REQUIRED 위반이다', (_name, input) => {
    expect(validateCardInput(input, 'create')).toEqual([{ field: 'title', reason: 'REQUIRED' }])
  })

  test('TC-006 제목 "세금 신고" 는 위반이 없다', () => {
    expect(validateCardInput({ title: '세금 신고' }, 'create')).toEqual([])
  })

  test('TC-006 앞뒤에 공백이 있어도 글자가 있으면 위반이 없다', () => {
    expect(validateCardInput({ title: '  세금 신고  ' }, 'create')).toEqual([])
    expect(normalizeTitle('  세금 신고  ')).toBe('세금 신고')
  })

  test('수정에서 제목을 비우면 title/REQUIRED, 제목을 보내지 않으면 위반이 없다 (AC-035)', () => {
    expect(validateCardInput({ title: '' }, 'update')).toEqual([{ field: 'title', reason: 'REQUIRED' }])
    expect(validateCardInput({ title: '  ' }, 'update')).toEqual([{ field: 'title', reason: 'REQUIRED' }])
    expect(validateCardInput({ memo: '메모' }, 'update')).toEqual([])
    expect(validateCardInput({}, 'update')).toEqual([])
  })

  test('제목이 문자열이 아니면 title/INVALID_TYPE 이다', () => {
    expect(validateCardInput({ title: 5 }, 'create')).toEqual([{ field: 'title', reason: 'INVALID_TYPE' }])
    expect(validateCardInput({ title: null }, 'create')).toEqual([{ field: 'title', reason: 'INVALID_TYPE' }])
  })

  test('제목 길이 상한은 두지 않는다', () => {
    expect(validateCardInput({ title: '가'.repeat(100_000) }, 'create')).toEqual([])
  })
})

describe('status', () => {
  test.each(['todo', 'in_progress', 'done'])('TC-008 수정 입력의 status %s 는 위반이 없다', (status) => {
    expect(validateCardInput({ status }, 'update')).toEqual([])
    expect(validateStatus(status)).toEqual([])
  })

  test.each(['archived', 'blocked', ''])('TC-008 수정 입력의 status "%s" 는 status/INVALID_VALUE 이다', (status) => {
    expect(validateCardInput({ status }, 'update')).toEqual([{ field: 'status', reason: 'INVALID_VALUE' }])
    expect(validateStatus(status)).toEqual([{ field: 'status', reason: 'INVALID_VALUE' }])
  })

  test('문자열이 아닌 status 도 status/INVALID_VALUE 이다', () => {
    expect(validateStatus(1)).toEqual([{ field: 'status', reason: 'INVALID_VALUE' }])
    expect(validateStatus(null)).toEqual([{ field: 'status', reason: 'INVALID_VALUE' }])
    expect(validateStatus(undefined)).toEqual([{ field: 'status', reason: 'INVALID_VALUE' }])
  })

  test.each(['todo', 'in_progress'])('TC-156 만들기 입력의 status %s 는 위반이 없다', (status) => {
    expect(validateCardInput({ title: 'a', status }, 'create')).toEqual([])
  })

  test('TC-156 만들기 입력에서 status 를 생략해도 위반이 없다', () => {
    expect(validateCardInput({ title: 'a' }, 'create')).toEqual([])
    expect(validateCardInput({ title: 'a', status: undefined }, 'create')).toEqual([])
  })

  test.each(['done', 'archived', 'blocked', '', 1, null])(
    'TC-156 만들기 입력의 status %j 는 status/INVALID_VALUE 이다 (UNKNOWN_FIELD 가 아니다)',
    (status) => {
      expect(validateCardInput({ title: 'a', status }, 'create')).toEqual([{ field: 'status', reason: 'INVALID_VALUE' }])
    },
  )

  test('TC-156 같은 done 이 수정 입력에서는 위반이 없다', () => {
    expect(validateCardInput({ status: 'done' }, 'update')).toEqual([])
  })

  test('TC-156 만들기에서 제목이 비고 status 도 틀리면 위반 두 건이 함께 돌아온다', () => {
    const violations = validateCardInput({ title: '', status: 'done' }, 'create')
    expect(violations).toEqual([
      { field: 'title', reason: 'REQUIRED' },
      { field: 'status', reason: 'INVALID_VALUE' },
    ])
  })
})

describe('priority 와 kind', () => {
  test.each([['high'], ['medium'], ['low'], [null]])('TC-009 우선순위 %s 는 위반이 없다', (priority) => {
    expect(validateCardInput({ title: 'a', priority }, 'create')).toEqual([])
    expect(validateCardInput({ priority }, 'update')).toEqual([])
  })

  test('TC-009 우선순위를 생략해도 위반이 없다', () => {
    expect(validateCardInput({ title: 'a' }, 'create')).toEqual([])
    expect(validateCardInput({ title: 'a', priority: undefined }, 'create')).toEqual([])
  })

  test('TC-009 우선순위 urgent 는 priority/INVALID_VALUE 이다', () => {
    expect(validateCardInput({ title: 'a', priority: 'urgent' }, 'create')).toEqual([
      { field: 'priority', reason: 'INVALID_VALUE' },
    ])
    expect(validateCardInput({ priority: 'urgent' }, 'update')).toEqual([
      { field: 'priority', reason: 'INVALID_VALUE' },
    ])
  })

  test.each([['bug'], ['task']])('TC-009 종류 %s 는 위반이 없다', (kind) => {
    expect(validateCardInput({ title: 'a', kind }, 'create')).toEqual([])
    expect(validateCardInput({ kind }, 'update')).toEqual([])
  })

  test('TC-009 종류 epic 은 kind/INVALID_VALUE 이다', () => {
    expect(validateCardInput({ title: 'a', kind: 'epic' }, 'create')).toEqual([
      { field: 'kind', reason: 'INVALID_VALUE' },
    ])
    expect(validateCardInput({ kind: 'epic' }, 'update')).toEqual([{ field: 'kind', reason: 'INVALID_VALUE' }])
  })

  test('종류를 생략해도 위반이 없다 (저장 때 task 가 된다, AC-014)', () => {
    expect(validateCardInput({ title: 'a' }, 'create')).toEqual([])
  })

  test('종류는 null 이 될 수 없다', () => {
    expect(validateCardInput({ title: 'a', kind: null }, 'create')).toEqual([
      { field: 'kind', reason: 'INVALID_VALUE' },
    ])
  })
})

describe('dueDate', () => {
  test.each([['2026-11-03'], ['2028-02-29'], ['2026-12-31'], [null]])('마감일 %s 는 위반이 없다', (dueDate) => {
    expect(validateCardInput({ title: 'a', dueDate }, 'create')).toEqual([])
    expect(validateCardInput({ dueDate }, 'update')).toEqual([])
  })

  test('마감일을 생략해도 위반이 없다 (AC-008)', () => {
    expect(validateCardInput({ title: 'a' }, 'create')).toEqual([])
  })

  test.each([['2026-02-30'], ['2027-02-29'], ['2026-13-01'], ['2026-00-10'], ['2026-1-3'], ['11/03/2026'], ['']])(
    '존재하지 않거나 형식이 틀린 마감일 "%s" 는 dueDate/INVALID_DATE 이다 (AC-029)',
    (dueDate) => {
      expect(validateCardInput({ title: 'a', dueDate }, 'create')).toEqual([
        { field: 'dueDate', reason: 'INVALID_DATE' },
      ])
      expect(validateCardInput({ dueDate }, 'update')).toEqual([{ field: 'dueDate', reason: 'INVALID_DATE' }])
    },
  )

  test('문자열도 null 도 아닌 마감일은 dueDate/INVALID_TYPE 이다', () => {
    expect(validateCardInput({ title: 'a', dueDate: 20261103 }, 'create')).toEqual([
      { field: 'dueDate', reason: 'INVALID_TYPE' },
    ])
    expect(validateCardInput({ dueDate: {} }, 'update')).toEqual([{ field: 'dueDate', reason: 'INVALID_TYPE' }])
  })
})

describe('description 과 memo', () => {
  test('빈 문자열도 허용한다', () => {
    expect(validateCardInput({ title: 'a', description: '', memo: '' }, 'create')).toEqual([])
  })

  test('문자열이 아니면 INVALID_TYPE 이다', () => {
    expect(validateCardInput({ title: 'a', description: 1, memo: null }, 'create')).toEqual([
      { field: 'description', reason: 'INVALID_TYPE' },
      { field: 'memo', reason: 'INVALID_TYPE' },
    ])
  })
})

describe('알 수 없는 필드', () => {
  test('id, archivedAt, createdAt 은 UNKNOWN_FIELD 이다 (만들기와 수정 모두)', () => {
    const extra = { id: 'x', archivedAt: null, createdAt: '2026-11-03T00:00:00.000Z' }
    const expected = [
      { field: 'id', reason: 'UNKNOWN_FIELD' },
      { field: 'archivedAt', reason: 'UNKNOWN_FIELD' },
      { field: 'createdAt', reason: 'UNKNOWN_FIELD' },
    ]
    expect(validateCardInput({ title: 'a', ...extra }, 'create')).toEqual(expected)
    expect(validateCardInput({ ...extra }, 'update')).toEqual(expected)
  })

  test('카드 전체를 patch 로 보내면 바꿀 수 없는 필드가 모두 UNKNOWN_FIELD 로 나온다', () => {
    const violations = validateCardInput(makeCard(), 'update')
    expect(violations).toEqual([
      { field: 'id', reason: 'UNKNOWN_FIELD' },
      { field: 'archivedAt', reason: 'UNKNOWN_FIELD' },
      { field: 'createdAt', reason: 'UNKNOWN_FIELD' },
    ])
  })

  test('값이 undefined 인 알 수 없는 필드도 거부한다', () => {
    expect(validateCardInput({ title: 'a', foo: undefined }, 'create')).toEqual([
      { field: 'foo', reason: 'UNKNOWN_FIELD' },
    ])
  })

  test('진행 기록 입력의 cardId·statusAtTime 은 UNKNOWN_FIELD 이다 (AC-018)', () => {
    expect(validateProgressInput({ content: '확인', cardId: 'c', statusAtTime: 'done' })).toEqual([
      { field: 'cardId', reason: 'UNKNOWN_FIELD' },
      { field: 'statusAtTime', reason: 'UNKNOWN_FIELD' },
    ])
  })

  test('조회 조건의 알 수 없는 필드도 UNKNOWN_FIELD 이다', () => {
    expect(validateCardQuery({ scope: 'board', limit: 5 })).toEqual([{ field: 'limit', reason: 'UNKNOWN_FIELD' }])
  })
})

describe('위반을 모아서 돌려주기', () => {
  test('여러 필드가 동시에 틀리면 모두 돌려준다', () => {
    const violations = validateCardInput(
      { title: ' ', kind: 'epic', description: 3, dueDate: '2026-02-30', priority: 'urgent', memo: 1, id: 'x' },
      'create',
    )
    expect(violations).toEqual([
      { field: 'title', reason: 'REQUIRED' },
      { field: 'kind', reason: 'INVALID_VALUE' },
      { field: 'description', reason: 'INVALID_TYPE' },
      { field: 'dueDate', reason: 'INVALID_DATE' },
      { field: 'priority', reason: 'INVALID_VALUE' },
      { field: 'memo', reason: 'INVALID_TYPE' },
      { field: 'id', reason: 'UNKNOWN_FIELD' },
    ])
  })

  test('수정에서 제목과 마감일과 상태가 함께 틀리면 셋 모두 나온다', () => {
    const violations = validateCardInput({ title: '', dueDate: '2026-02-30', status: 'archived' }, 'update')
    expect(violations).toEqual(
      expect.arrayContaining([
        { field: 'title', reason: 'REQUIRED' },
        { field: 'dueDate', reason: 'INVALID_DATE' },
        { field: 'status', reason: 'INVALID_VALUE' },
      ]),
    )
    expect(violations).toHaveLength(3)
  })

  test('알 수 없는 필드가 여럿이면 필드마다 하나씩 담는다', () => {
    const violations = validateCardInput({ title: '', foo: 1, bar: 2 }, 'create')
    expect(violations).toHaveLength(3)
  })
})

describe('입력 모양', () => {
  test.each([[null], [undefined], ['제목'], [5], [[]], [['title']]])(
    '객체가 아닌 입력 %j 는 input/INVALID_TYPE 이다',
    (input) => {
      expect(validateCardInput(input, 'create')).toEqual([{ field: 'input', reason: 'INVALID_TYPE' }])
      expect(validateCardInput(input, 'update')).toEqual([{ field: 'input', reason: 'INVALID_TYPE' }])
      expect(validateProgressInput(input)).toEqual([{ field: 'input', reason: 'INVALID_TYPE' }])
      expect(validateCardQuery(input)).toEqual([{ field: 'input', reason: 'INVALID_TYPE' }])
    },
  )

  test('JSON 으로 들어온 __proto__ 키도 알 수 없는 필드로 거부한다', () => {
    const input: unknown = JSON.parse('{"title":"a","__proto__":{"x":1}}')
    expect(validateCardInput(input, 'create')).toEqual([{ field: '__proto__', reason: 'UNKNOWN_FIELD' }])
  })

  test('상속 속성은 입력으로 세지 않는다', () => {
    const input = Object.create({ title: '상속' }) as unknown
    expect(validateCardInput(input, 'create')).toEqual([{ field: 'title', reason: 'REQUIRED' }])
  })
})

describe('진행 기록 입력', () => {
  test('내용이 있으면 위반이 없다', () => {
    expect(validateProgressInput({ content: '재현 조건 확인' })).toEqual([])
  })

  test.each([[{ content: '' }], [{ content: '  \n' }], [{}]])(
    '내용이 비었거나 없으면 content/REQUIRED 이다: %j',
    (input) => {
      expect(validateProgressInput(input)).toEqual([{ field: 'content', reason: 'REQUIRED' }])
    },
  )

  test('내용이 문자열이 아니면 content/INVALID_TYPE 이다', () => {
    expect(validateProgressInput({ content: 1 })).toEqual([{ field: 'content', reason: 'INVALID_TYPE' }])
  })
})

describe('조회 조건', () => {
  test('scope 두 값과 선택 조건은 위반이 없다', () => {
    expect(validateCardQuery({ scope: 'board' })).toEqual([])
    expect(validateCardQuery({ scope: 'archive', text: '', kind: 'bug', priority: 'low' })).toEqual([])
  })

  test('scope 가 없거나 목록 밖이면 scope/INVALID_VALUE 이다', () => {
    expect(validateCardQuery({})).toEqual([{ field: 'scope', reason: 'INVALID_VALUE' }])
    expect(validateCardQuery({ scope: 'all' })).toEqual([{ field: 'scope', reason: 'INVALID_VALUE' }])
  })

  test('text 가 문자열이 아니면 INVALID_TYPE, kind·priority 가 목록 밖이면 INVALID_VALUE 이다', () => {
    expect(validateCardQuery({ scope: 'board', text: 1, kind: 'epic', priority: 'urgent' })).toEqual([
      { field: 'text', reason: 'INVALID_TYPE' },
      { field: 'kind', reason: 'INVALID_VALUE' },
      { field: 'priority', reason: 'INVALID_VALUE' },
    ])
  })
})

describe('값 하나짜리 검사', () => {
  test('theme 은 dark·light 만 받는다', () => {
    expect(validateTheme('dark')).toEqual([])
    expect(validateTheme('light')).toEqual([])
    expect(validateTheme('blue')).toEqual([{ field: 'theme', reason: 'INVALID_VALUE' }])
    expect(validateTheme('')).toEqual([{ field: 'theme', reason: 'INVALID_VALUE' }])
    expect(validateTheme(1)).toEqual([{ field: 'theme', reason: 'INVALID_TYPE' }])
    expect(validateTheme(undefined)).toEqual([{ field: 'theme', reason: 'INVALID_TYPE' }])
  })

  test('id 는 문자열이면 된다', () => {
    expect(validateId('card-1')).toEqual([])
    expect(validateId(1)).toEqual([{ field: 'id', reason: 'INVALID_TYPE' }])
    expect(validateId(undefined)).toEqual([{ field: 'id', reason: 'INVALID_TYPE' }])
  })
})
