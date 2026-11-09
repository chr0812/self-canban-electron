import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

const SHARED_DIR = fileURLToPath(new URL('./src/shared', import.meta.url))
const RENDERER_ROOT = fileURLToPath(new URL('./src/renderer', import.meta.url))

// style-src 'unsafe-inline': React의 style 속성이 인라인 스타일이라 필요하다 (정확한 값은 구현에서 확인).
const CSP_VALUE = [
  "default-src 'self'",
  "connect-src 'none'",
  "font-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

// 개발 서버의 인라인 refresh 스크립트와 HMR WebSocket을 막지 않으려고 build 일 때만 넣는다 (FE-008).
function cspOnBuild(): Plugin {
  let isBuild = false
  return {
    name: 'csp-on-build',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    transformIndexHtml() {
      if (!isBuild) return undefined
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_VALUE },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

const alias = { '@shared': SHARED_DIR }

export default defineConfig({
  main: {
    resolve: { alias },
  },
  preload: {
    resolve: { alias },
    build: {
      // 샌드박스 preload 는 ESM 이 될 수 없어 CJS(index.cjs)로 내보낸다. main 은 ESM(index.js).
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: RENDERER_ROOT,
    resolve: { alias },
    plugins: [react(), cspOnBuild()],
  },
})
