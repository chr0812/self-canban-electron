// 저장 파일 이름·데이터 폴더 이름 상수 한 곳과 경로 합치기 (docs/05-design/02-data-model.md `저장 파일과 폴더`).
// node:path 는 파일에 접근하지 않는 문자열 처리라 src/main 에서 허용된다.

import { join } from 'node:path'

/** 현재 저장본. */
export const DATA_FILE_NAME = 'kanban-data.json'

/** 직전 저장본 이름을 만들 때 본 파일 이름 뒤에 붙인다 (kanban-data.json.bak). */
export const BACKUP_SUFFIX = '.bak'

/**
 * 데이터 폴더 이름. 표시용 앱 이름('일정관리')과 분리된 상수이고, 한 번 정하면 바꾸지 않는다
 * (바꾸면 기존 데이터 위치가 달라진다). 값은 구현 시작 전에 사용자가 정했다 (issues BI-001).
 */
export const APP_DATA_FOLDER = 'self-canban'

/** 개발 실행(포장하지 않은 실행)이 실제 카드 데이터를 건드리지 않도록 폴더 이름 뒤에 붙인다 (RK-004). */
export const DEV_FOLDER_SUFFIX = '-dev'

/** 포장한 실행은 APP_DATA_FOLDER 그대로, 개발 실행은 뒤에 '-dev' 를 붙인 이름. */
export function dataFolderName(isPackaged: boolean): string {
  return isPackaged ? APP_DATA_FOLDER : `${APP_DATA_FOLDER}${DEV_FOLDER_SUFFIX}`
}

/**
 * 저장 중 임시 파일 이름: kanban-data.json.<프로세스 id>.tmp.
 * 같은 폴더를 쓰는 두 실행의 임시 파일이 겹치지 않게 프로세스 id 를 붙인다 (RK-010).
 * 프로세스 id 는 인자로 받아 시험이 고정 값을 줄 수 있다.
 */
export function tempFileName(processId: number): string {
  return `${DATA_FILE_NAME}.${processId}.tmp`
}

/** 이전 버전(N) 파일을 새 버전으로 처음 저장하기 직전의 원본 사본 이름: kanban-data.pre-v{N}.json. */
export function preVersionName(n: number): string {
  return `kanban-data.pre-v${n}.json`
}

/** 폴더와 파일 이름을 합친다 (path.join). 자체 합치기를 두지 않아 Windows 에서 / 와 \ 가 섞이지 않는다. */
export function dataFilePath(dir: string, name: string): string {
  return join(dir, name)
}
