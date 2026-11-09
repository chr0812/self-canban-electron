// NFR-001 의 차단 장치: 앱 번들 폴더 밖 요청·이동·새 창·권한·webview 를 막는다 (docs/05-design/05-architecture.md NetworkGuard).
// 허용 목록은 file: 전체가 아니라 앱 번들 폴더(out/renderer)의 주소 접두사다 (RK-008).

import type { App, BrowserWindow, Session } from 'electron'

export type NetworkGuardOptions = {
  /** 허용할 주소 접두사. 앱 번들 폴더(file:)이고, 개발 실행(dev)이면 개발 서버의 http: 주소도 들어간다. */
  allowedPrefixes: string[]
  /** 개발 실행이면 true. true 일 때만 http:·ws: 접두사를 허용한다. */
  dev: boolean
}

/** 개발 실행에서도 막지 않을 호스트 (개발 서버). */
const DEV_HOST_EXCLUDES = ['localhost', '127.0.0.1']

/** 네트워크를 쓰지 않는 주소 종류. 개발자 도구 화면과 인라인 데이터. */
const LOCAL_SCHEMES = ['devtools:', 'data:']

/**
 * 가장 최근에 설치한 허용 설정. lockWindowNavigation 이 같은 허용 목록을 쓰게 하려고 모듈에 둔다
 * (설계된 시그니처가 접두사를 받지 않는다). 설치 전에는 이동을 모두 거부한다.
 */
let installed: NetworkGuardOptions | null = null

/**
 * Windows 의 file: 주소는 경로 대소문자를 가리지 않고 퍼센트 인코딩의 16진 대소문자도 달라질 수 있어
 * file: 만 소문자로 맞춰 비교한다. 다른 주소는 있는 그대로 비교한다.
 * `..` 같은 경로 조각은 URL 파서가 먼저 정리한다.
 */
function normalize(url: URL): string {
  return url.protocol === 'file:' ? url.href.toLowerCase() : url.href
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/** 허용 목록 판정. 순수 함수다. 파싱할 수 없는 주소는 허용하지 않는다. */
export function isAllowedUrl(raw: string, options: NetworkGuardOptions): boolean {
  const url = parseUrl(raw)
  if (url === null) return false
  if (LOCAL_SCHEMES.includes(url.protocol)) return true
  const target = normalize(url)
  for (const prefixRaw of options.allowedPrefixes) {
    const prefix = parseUrl(prefixRaw)
    if (prefix === null) continue
    if (prefix.protocol === 'file:') {
      if (url.protocol === 'file:' && target.startsWith(normalize(prefix))) return true
      continue
    }
    if (!options.dev) continue
    if (prefix.protocol === 'http:' || prefix.protocol === 'https:') {
      // 개발 서버: 접두사 아래의 http 요청과, 같은 호스트의 ws 연결(HMR)
      if (url.protocol === prefix.protocol && target.startsWith(normalize(prefix))) return true
      const wsProtocol = prefix.protocol === 'http:' ? 'ws:' : 'wss:'
      if (url.protocol === wsProtocol && url.host === prefix.host) return true
    }
  }
  return false
}

/** 세션 단위 차단: 요청 취소, 권한 거부, 프록시 직접 연결. */
export function installNetworkGuard(session: Session, options: NetworkGuardOptions): void {
  const rules: NetworkGuardOptions = { allowedPrefixes: [...options.allowedPrefixes], dev: options.dev }
  installed = rules

  session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedUrl(details.url, rules)
    if (!allowed) console.error(`[network-guard] blocked request: ${details.method} ${details.url}`)
    callback({ cancel: !allowed })
  })

  // 권한(카메라, 알림 등)은 모두 거부한다.
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.setPermissionCheckHandler(() => false)
  session.setDevicePermissionHandler(() => false)

  // 프록시 자동 감지(WPAD) 요청을 없애는 후보 (RK-007). 효과는 첫 Electron 구동의 넷로그로 확인한다.
  session.setProxy({ mode: 'direct' }).catch((error: unknown) => {
    console.error('[network-guard] setProxy failed', error)
  })
}

/** 창 단위 차단: 새 창, 앱 주소 밖 이동·리다이렉트, webview. */
export function lockWindowNavigation(win: BrowserWindow): void {
  const contents = win.webContents
  contents.setWindowOpenHandler((details) => {
    console.error(`[network-guard] blocked new window: ${details.url}`)
    return { action: 'deny' }
  })
  const guardNavigation = (event: { preventDefault: () => void }, url: string): void => {
    if (installed !== null && isAllowedUrl(url, installed)) return
    console.error(`[network-guard] blocked navigation: ${url}`)
    event.preventDefault()
  }
  contents.on('will-navigate', (event) => guardNavigation(event, event.url))
  contents.on('will-redirect', (event) => guardNavigation(event, event.url))
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
}

/**
 * Chromium 프로세스 자체의 요청(DNS 선조회 등)을 줄이는 후보 (RK-007). app.ready 전에 부른다.
 * 효과는 첫 Electron 구동에서 --log-net-log 로 확인한다. 개발 서버·시험을 깨면 호출을 빼고 넷로그 관찰만 한다.
 */
export function restrictChromiumNetwork(app: App, options: { dev: boolean }): void {
  const excludes = options.dev ? DEV_HOST_EXCLUDES : ['localhost']
  app.commandLine.appendSwitch('host-resolver-rules', `MAP * ~NOTFOUND, EXCLUDE ${excludes.join(', EXCLUDE ')}`)
}
