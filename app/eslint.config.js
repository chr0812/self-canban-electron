import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

// 폴더별 의존 규칙 (docs/05-design/05-architecture.md 의존 규칙 표).
// globals 패키지는 설계 표에 없어 쓰지 않는다. 금지할 전역 이름만 직접 적는다.

const MSG_NODE = 'src/main 에서는 node:path 외의 node:* 를 쓰지 않는다 (파일 접근은 FileSystemPort 로).'
const BARE_NODE_MODULES = ['fs', 'fs/promises', 'path', 'os', 'child_process', 'crypto', 'url', 'util']

const forbidRenderer = { group: ['**/renderer', '**/renderer/**'], message: 'main 은 renderer 를 import 하지 않는다.' }
const forbidPreload = { group: ['**/preload', '**/preload/**'], message: 'main 은 preload 를 import 하지 않는다.' }
const forbidMain = { group: ['**/main', '**/main/**'], message: '이 폴더는 main 을 import 하지 않는다.' }
const forbidReact = { group: ['react', 'react-dom', 'react-dom/*', 'react/*'], message: '이 폴더는 react 를 import 하지 않는다.' }
const forbidElectron = { group: ['electron'], message: '이 폴더는 electron 을 import 하지 않는다.' }

// gitignore 식 부정(!)은 node:fs/promises 처럼 슬래시가 있는 이름을 다시 허용하지 못해 정규식을 쓴다.
function nodeExceptions(allowed) {
  const names = allowed.join('|')
  return { regex: `^node:(?!(?:${names})$)`, message: MSG_NODE }
}

function restrict({ patterns, paths = [] }) {
  return { 'no-restricted-imports': ['error', { paths, patterns }] }
}

function restrictGlobals(names, message) {
  return { 'no-restricted-globals': ['error', ...names.map((name) => ({ name, message }))] }
}

const barePaths = (allowed) =>
  BARE_NODE_MODULES.filter((name) => !allowed.includes(name)).map((name) => ({
    name,
    message: `node:${name} 형태로 쓰고, src/main 에서는 허용된 것만 쓴다.`,
  }))

const DOM_GLOBALS = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'requestAnimationFrame']

export default defineConfig([
  { ignores: ['out/', 'release/', 'reports/', 'test-results/', 'node_modules/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // shared: 순수. electron, node:*, react, window, document, process 금지
    files: ['src/shared/**'],
    rules: {
      ...restrict({
        patterns: [
          forbidElectron,
          forbidReact,
          { group: ['node:*'], message: 'shared 는 node:* 를 쓰지 않는다.' },
        ],
        paths: barePaths([]),
      }),
      ...restrictGlobals(['window', 'document', 'process'], 'shared 는 순수 코드다.'),
    },
  },
  {
    // main 전체: node:path 만 허용, renderer/preload 금지
    files: ['src/main/**'],
    rules: restrict({
      patterns: [nodeExceptions(['path']), forbidRenderer, forbidPreload],
      paths: barePaths([]),
    }),
  },
  {
    // main/store: electron, react 도 금지 (Electron 없이 시험된다)
    files: ['src/main/store/**'],
    rules: restrict({
      patterns: [nodeExceptions(['path']), forbidElectron, forbidReact, forbidRenderer, forbidPreload],
      paths: barePaths([]),
    }),
  },
  {
    // NodeFileSystem 한 모듈만 node:fs/promises 허용
    files: ['src/main/store/node-file-system.ts'],
    rules: restrict({
      patterns: [nodeExceptions(['path', 'fs/promises']), forbidElectron, forbidReact, forbidRenderer, forbidPreload],
      paths: barePaths([]),
    }),
  },
  {
    // preload: electron 허용, main/renderer/node:* 금지
    files: ['src/preload/**'],
    rules: restrict({
      patterns: [
        forbidMain,
        { group: ['**/renderer', '**/renderer/**'], message: 'preload 는 renderer 를 import 하지 않는다.' },
        { group: ['node:*'], message: 'preload 는 node:* 를 쓰지 않는다.' },
      ],
      paths: barePaths([]),
    }),
  },
  {
    // renderer: electron, node:*, main, preload 금지
    files: ['src/renderer/**'],
    rules: restrict({
      patterns: [
        forbidElectron,
        forbidMain,
        { group: ['**/preload', '**/preload/**'], message: 'renderer 는 preload 를 import 하지 않는다.' },
        { group: ['node:*'], message: 'renderer 는 node:* 를 쓰지 않는다.' },
      ],
      paths: barePaths([]),
    }),
  },
  {
    // renderer model: 순수. react, DOM 전역 금지
    files: ['src/renderer/src/model/**'],
    rules: {
      ...restrict({
        patterns: [
          forbidElectron,
          forbidMain,
          forbidReact,
          { group: ['**/preload', '**/preload/**'], message: 'model 은 preload 를 import 하지 않는다.' },
          { group: ['node:*'], message: 'model 은 node:* 를 쓰지 않는다.' },
        ],
        paths: barePaths([]),
      }),
      ...restrictGlobals(DOM_GLOBALS, 'model 은 Node 에서 시험하는 순수 코드다 (DOM 전역 금지).'),
    },
  },
])
