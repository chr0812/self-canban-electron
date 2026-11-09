// 허용 값 목록과 상수. 매직 넘버·문자열은 이 파일에 둔다 (docs/05-design/06-file-map.md).
// 순수 모듈이다: 다른 모듈을 import 하지 않는다.

/** 칸. 보관은 상태가 아니라 Card.archivedAt 표시다 (AC-004). */
export const STATUSES = ['todo', 'in_progress', 'done'] as const

/** 카드를 만들 때 고를 수 있는 상태. 완료로는 만들 수 없다 (AC-041, AC-042). */
export const CREATE_STATUSES = ['todo', 'in_progress'] as const

/** 종류. 개발 버그 / 할 일. */
export const KINDS = ['bug', 'task'] as const

/** 우선순위. 배열 순서 = 화면 표시 순서(낮음, 중간, 높음). 값이 없음은 null 로 표현한다 (이 목록에 넣지 않는다). */
export const PRIORITIES = ['low', 'medium', 'high'] as const

/** 화면 밝기 판. 어두운 판 / 밝은 판. */
export const THEMES = ['dark', 'light'] as const

/** 사용자가 판을 고른 적이 없을 때의 밝은 판 (ASM-017, AC-038). 이미 저장된 값은 그대로 읽는다. */
export const DEFAULT_THEME = 'light' as const

/** 이 앱이 쓰는 저장 파일 스키마 버전. 이보다 높은 파일은 읽지 않는다 (SCHEMA_TOO_NEW). */
export const CURRENT_SCHEMA_VERSION = 2

/**
 * main 이 preload 에 초기 판을 넘기는 additionalArguments 접두사.
 * main(window-factory)과 preload 가 같은 문자열을 쓰게 하려고 한 곳에 둔다.
 * 사용 예: `${THEME_ARGUMENT_PREFIX}dark`
 */
export const THEME_ARGUMENT_PREFIX = '--kanban-theme='
