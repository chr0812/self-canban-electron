// browser 시험 설정 (docs/05-design/01-tech-stack.md `test:e2e`, 06-file-map.md playwright.config.ts).
// 창이 뜨는 시험이라 헤드리스가 아니다. 병렬로 돌리면 창이 포커스를 뺏고 임시 폴더 정리·강제 종료 시험이 불안정해질 수 있어
// 한 번에 하나씩 순서대로 돌린다 (FE-011). 시험마다 임시 데이터 폴더를 쓰고 이전 데이터를 재사용하지 않는다 (launch-app.ts).

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/browser',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  reporter: [['list'], ['junit', { outputFile: 'reports/e2e.xml' }]],
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  retries: 0,
  forbidOnly: true,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
