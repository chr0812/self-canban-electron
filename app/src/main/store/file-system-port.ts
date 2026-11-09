// 파일 접근을 좁히는 포트. 시험이 이 다섯 동작에 실패·중단을 주입한다 (docs/05-design/03-api-spec.md).
// 실제 구현은 node-file-system.ts 한 모듈이다.

export interface FileSystemPort {
  /** UTF-8 로 읽는다. 없으면 오류 코드 ENOENT. */
  readFile(path: string): Promise<string>
  exists(path: string): Promise<boolean>
  /** 쓰고 fsync 하고 닫는다 (덮어쓰기). */
  writeFileSynced(path: string, data: string): Promise<void>
  /** 덮어쓰기. */
  copyFile(from: string, to: string): Promise<void>
  /** 덮어쓰기 허용. */
  rename(from: string, to: string): Promise<void>
}
