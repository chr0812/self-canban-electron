# 기술 스택

> 작성일: 2026-11-03
> 입력: docs/04-spec/spec.md

실행 형태는 사용자가 A(Electron)를 골랐다(CON-002, Q-005 해소). `후보 비교` 표는 사용자가 고를 때 본 후보 세 개를 같은 잣대로 조사한 선택 근거 기록이다. `추천 스택`과 이후 섹션(패키지, 가이드, 명령, 시험 환경)은 `선택`으로 표시한 후보 A 기준이다. 나중에 사용자가 다른 후보로 바꾸면 이 문서 전체를 그 후보로 다시 쓴다.

버전 확인일은 2026-11-03이고 확인 수단은 각 `출처`의 npm 레지스트리, crates.io, endoflife.date, Electron 릴리스 페이지다. 확인하지 못한 내용은 본문에 `추정`으로 표시했다.

## 프로젝트 기술 요구사항

| 명세 항목 | 기술적 시사점 |
|-----------|--------------|
| CON-001 (내 PC 한 대, 서버·계정 없음, 오프라인) | 백엔드 서버와 외부 DB가 필요 없다. 저장은 이 PC의 로컬 저장소 하나다. 로그인·동기화 계층이 없다 |
| CON-002, Q-005 (해소: 사용자가 Electron 선택) | 화면 기술은 웹 표준(HTML/CSS/TS)이고, 실행 껍데기는 Electron이다. 후보 B·C는 선택 근거로 `후보 비교`에 남겼다 |
| NFR-001 (설치 뒤 네트워크 요청 0건, 외부 글꼴·라이브러리 금지) | 모든 자원(글꼴, 라이브러리, 아이콘)을 앱 안에 묶는다. 업데이터·원격 분석·CDN을 쓰지 않는다. 요청이 0건임을 시험으로 관찰할 수 있어야 한다 |
| NFR-002 (저장 중 강제 종료에도 직전 저장본으로 열림) | 저장 방식이 "쓰다 만 상태"를 남기지 않아야 한다 (임시 파일 쓰기 뒤 교체, 또는 트랜잭션 저장소). 강제 종료를 흉내 내는 시험이 가능해야 한다 |
| NFR-003 (이전 버전 데이터 100% 읽힘) | 저장 데이터에 스키마 버전을 넣고 이전 버전에서 올리는 변환 단계를 둔다. 이 요구는 실행 형태와 무관하다 |
| NFR-004 (색 외 글자·아이콘 구분) | 화면 기술의 문제이고 실행 형태와 무관하다. 아이콘은 앱에 포함된 SVG/글자를 쓴다 |
| ASM-003 (Windows) | Windows 11에서 개발·실행·시험이 모두 되어야 한다. 다른 OS를 쓰게 되면 `호환성 참고사항`을 다시 본다 |
| ASM-010 (수백~수천 건) | 한 사람의 이 규모는 JSON 파일 하나나 IndexedDB 어느 쪽도 부담이 없다 (조사로 측정하지 않은 추정) |
| RISK-005 (웹은 브라우저가 저장소를 지울 수 있음) | 웹 후보는 이 위험을 어떻게 줄이는지, 줄이고도 남는 것이 무엇인지 `후보 비교`에 쓴다 |
| 외부 시스템: PC 알림은 요구 범위 밖 (ASM-011) | 알림 API는 현재 선택 기준이 아니다. 나중에 Q-004로 필요해지면 Electron·Tauri는 운영체제 알림을 직접 쓸 수 있다 (일반 지식, 이번에 조사하지 않음) |

화면 코드는 세 후보가 같다: TypeScript + React. 후보 사이의 차이는 실행 껍데기, 저장소, 시험 방법, 개발 환경에 있다.

## 추천 스택

> 사용자가 A (Electron)를 골랐다 (CON-002, Q-005 해소).

| 레이어 | 기술 | 핀 버전 | 근거 |
|--------|------|---------|------|
| 언어 | TypeScript | 6.0.3 | typescript-eslint 8.72.1이 TypeScript `>=4.8.4 <6.1.0`만 지원한다. 레지스트리의 최신 7.0.2는 이 범위 밖이라 쓰지 않고 6.x의 마지막 안정판으로 고정 |
| 실행 껍데기 | Electron | 45.2.1 | 2026-11-03 기준 최신 안정 메이저(지원 종료 2027-04-27). 내장 Node 24.22.1, Chromium 156 |
| 화면 | React + React DOM | 19.3.1 | 보드·캘린더·보관함 4화면을 컴포넌트로 나누기 쉽다. 달력·드래그 라이브러리는 설계에서 필요할 때만 추가 |
| 번들러 | Vite + electron-vite | 8.3.5 + 6.0.0 | main·preload·renderer 세 곳을 한 설정으로 빌드. electron-vite 6.0.0의 vite 범위에 8이 포함됨 |
| 저장소 | JSON 파일 1개 (앱 데이터 폴더, 임시 파일에 쓴 뒤 교체) | - (Node 내장 `fs`) | 네이티브 모듈이 없어 빌드가 단순하다. NFR-002는 "임시 파일 쓰기 → 디스크 반영 → 교체 + 직전 저장본 보관"으로 푼다. 구체 절차는 아키텍처 설계가 정한다. SQLite로 바꿀 수 있다는 점은 `결정 필요` 참고 |
| 시험 러너 | Vitest | 5.1.0 | 단위·통합(cli). JUnit XML 리포터 내장, 이 PC에서 빈 시험으로 결과 파일 생성까지 확인함 |
| 화면 시험 | Playwright (`_electron`) | 1.64.1 | 실제 Electron 창을 띄워 조작하고 요청을 관찰한다. 공식 문서가 Electron 지원을 "experimental"로 표시한다 |
| 패키징 | electron-builder | 26.18.0 | Windows용 실행 폴더/설치 파일. 코드 서명은 하지 않는다 (`호환성 참고사항`) |
| 린트·포맷 | ESLint + typescript-eslint + Prettier | 10.14.0 + 8.72.1 + 3.9.10 | 표준 조합 |

## 후보 비교

> 사용자가 이 표를 보고 A를 골랐다(선택 근거 기록). 세 후보 모두 CON-001, NFR-001, NFR-002, NFR-003을 만족하도록 설계할 수 있다. 차이는 "무엇이 쉬워지고 무엇이 어려워지는가"다. 모두 Windows 11 기준이다 (ASM-003).

| 후보 | 구성 | 잘 맞는 점 | 대가 (약점) | 근거 | 선택 |
|------|------|-----------|------------|------|------|
| A. Electron 데스크톱 앱 | Electron 45.2.1 + React 19 + TypeScript 6.0.3. 저장은 앱 데이터 폴더의 JSON 파일(원자적 교체). 한 언어(TypeScript)로 화면과 파일 저장을 모두 작성 | 데이터가 브라우저 저장소가 아니라 일반 파일이라 "브라우저 데이터 정리"로 사라지지 않는다 (RISK-005를 구조적으로 피함). 파일 쓰기·강제 종료 시험을 Node에서 직접 흉내 낼 수 있어 NFR-002를 시험하기 쉽다. 외부 요청을 앱이 직접 차단할 수 있다 (NFR-001). Playwright로 실제 창을 띄워 재시작 유지(AC-011)까지 자동 시험 가능. Rust 같은 추가 언어가 필요 없다. 나중에 알림(Q-004)이 필요해져도 운영체제 알림을 쓸 수 있다 | 설치 파일이 크고 메모리를 더 쓴다 (Chromium을 통째로 포함. 크기는 이번에 측정하지 않은 추정). 오프라인이라 자동 업데이트가 없으니 보안 수정을 받으려면 직접 새 Electron 메이저로 올려 다시 빌드해야 한다 (지원 중인 메이저는 최신 3개뿐이고 45의 지원 종료는 약 6개월 뒤). 창 이름·보안 설정(렌더러 격리)을 처음에 제대로 잡아야 한다. Playwright의 Electron 지원은 아직 "experimental"이라 버전 업 때 깨질 수 있다. 서명하지 않은 설치 파일은 Windows가 경고를 띄울 수 있다 (추정) | https://endoflife.date/api/electron.json , https://releases.electronjs.org/release/v45.2.1 , https://playwright.dev/docs/api/class-electron | 선택 |
| B. 웹 앱 (설치형 PWA) | Vite 8.3.5 + React 19 + TypeScript 6.0.3 + vite-plugin-pwa 2.0.0. 저장은 브라우저의 IndexedDB(idb 8.0.4). Edge/Chrome에서 "앱으로 설치"해 서비스 워커로 오프라인 실행 | 설치할 프로그램이 거의 없고 빌드 결과가 정적 파일뿐이다. 설치 크기가 가장 작다. 브라우저 개발자 도구와 Playwright Chromium으로 시험이 가장 쉽다. 나중에 Electron으로 옮길 때 화면 코드를 그대로 쓸 수 있다 | 데이터가 브라우저 안에 있어 브라우저 설정의 "인터넷 사용 기록/사이트 데이터 삭제"를 하면 카드가 모두 사라진다 (RISK-005, 백업이 없어 복구 불가). 저장 영구 요청(`navigator.storage.persist()`)을 해도 사용자가 브라우저 설정에서 직접 지우는 경우는 막지 못한다 (MDN: 영구 모드도 사용자가 설정에서 지우면 삭제됨). 줄이는 수단: persist 요청 결과를 시작 때 확인해 거부되면 경고 표시, 강제 종료 대비로 IndexedDB 트랜잭션을 `durability: "strict"`로 지정(브라우저 기본은 완화 모드, 지식 기반 추정), 필요하면 파일 거울 저장(File System Access API, Chromium 계열만). 그러나 파일 거울 저장은 명세가 범위에서 뺀 "백업"과 겹칠 수 있어 사용자 결정이 필요하다. 오프라인 실행하려면 서비스 워커를 쓸 수 있는 주소(HTTPS 또는 localhost)에서 한 번 설치해야 한다. 즉 정적 파일을 어딘가에서 서빙해야 하는데, 외부 호스트에 두면 실행할 때마다 서비스 워커 갱신 확인 요청이 외부로 나가 NFR-001과 충돌할 수 있고(추정), localhost로 서빙하면 로컬 서버 프로세스를 직접 띄워야 한다. 파일을 더블클릭하는 `file://` 방식은 서비스 워커를 쓸 수 없고 저장소 안정성이 낮아 제외한다 (지식 기반 추정). 브라우저마다 저장 정책이 달라 Edge 하나로 고정해야 한다 | https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria , https://registry.npmjs.org/vite-plugin-pwa/latest | 탈락: 사용자가 정기적으로 브라우저 데이터를 지우는 환경이라면 백업이 없는 이 앱의 데이터가 통째로 사라질 수 있고(RISK-005), 이를 막는 수단이 모두 사용자 결정이나 브라우저 호의에 기댄다. 사용자가 "브라우저 데이터 삭제는 감수"(Q-005)로 결정하면 가장 가벼운 대안이 된다 |
| C. Tauri 데스크톱 앱 | Tauri 2.12.5(Rust 크레이트) + @tauri-apps/cli 2.12.4 + React 19 + TypeScript 6.0.3. 화면은 Windows에 있는 WebView2에 띄우고, 저장은 Rust에서 파일(또는 SQLite)에 쓴다. Rust 1.99.1 | 설치 파일과 메모리가 Electron보다 훨씬 작다 (Chromium을 포함하지 않음. 정확한 수치는 이번에 측정하지 않은 추정). 데이터가 일반 파일이라 RISK-005를 피한다. 파일 접근 권한을 기능별로 좁혀 줄 수 있다. 화면 코드는 A와 같아 나중에 갈아타기 쉽다 | Rust 도구 체인(Rust + Visual Studio C++ 빌드 도구, 수 GB)을 설치하고 Rust로 저장 코드를 짜야 한다. 사용자가 Rust를 아는지 명세에 없어 배우는 시간이 든다. 처음 빌드가 오래 걸린다. 화면 시험 자동화가 A보다 번거롭다: Playwright로 Tauri 앱을 직접 구동하는 공식 경로는 확인하지 못했고, WebDriver 기반 `tauri-driver`와 msedgedriver 버전 맞추기가 필요할 것으로 추정한다. 이번 조사에서 Windows 11에서의 `tauri-driver` 동작은 확인하지 못했다. WebView2 버전이 PC마다 달라질 수 있다 (OS별 렌더링 차이는 명세 조사에서도 언급됨. Windows만 쓰면 영향 작음) | https://v2.tauri.app/blog/ , https://crates.io/api/v1/crates/tauri , https://registry.npmjs.org/@tauri-apps/cli/latest , https://endoflife.date/api/rust.json | 탈락: 이 규모(한 명, 카드 수백~수천 건)에서는 Electron과 요구 충족 차이가 없는데, Rust 도구와 시험 자동화 비용이 더 크다. 설치 크기나 메모리를 가장 중시하거나 Rust를 쓰고 싶다면 가장 좋은 대안 |

### 후보 비교를 읽는 법

- 세 후보 모두 CON-001(서버·계정 없음)을 만족한다. 외부 서버가 필요 없다. 단 B는 처음 설치할 때 정적 파일을 서빙할 곳이 필요하다.
- NFR-001(설치 뒤 외부 요청 0건)은 A·C에서는 앱이 직접 차단하고 시험으로 확인할 수 있다. B는 서비스 워커 갱신 확인 때문에 어디서 서빙하느냐에 따라 달라진다 (추정).
- NFR-002(강제 종료)는 A·C에서 "임시 파일 쓴 뒤 교체"로 풀고 B에서는 IndexedDB 트랜잭션에 맡긴다. A·C는 직접 만든 코드라 시험으로 증명해야 하고, B는 브라우저 구현을 믿어야 한다.
- NFR-003(버전 호환)은 세 후보가 같다: 저장 데이터에 스키마 버전을 넣고 변환 단계를 둔다.
- 사용자가 B를 고르면 RISK-005 때문에 두 가지를 함께 정해야 한다: 브라우저 데이터 삭제를 NFR-002에서 제외할지 포함할지(Q-005), 파일 거울 저장을 허용할지.

## 패키지 의존성 (핀 버전)

> 선택 후보 A 기준. 모두 `package.json`에 `^`·`~` 없이 정확한 버전으로 적는다 (`npm install --save-exact`). 설계 단계에서 필요해진 라이브러리는 이 표에 추가한 뒤 쓴다.

| 패키지 | 핀 버전 | 용도 | 비고 |
|--------|---------|------|------|
| electron | 45.2.1 | 실행 껍데기 | devDependencies. 내장 Node 24.22.1 |
| electron-vite | 6.0.0 | Electron main/preload/renderer 빌드·개발 서버 | peer: vite ^6 \|\| ^7 \|\| ^8 |
| vite | 8.3.5 | 번들러 | engines: node ^20.19.0 \|\| >=22.12.0 |
| @vitejs/plugin-react | 6.2.1 | React 변환 | peer: vite ^8.0.0 |
| react | 19.3.1 | 화면 | |
| react-dom | 19.3.1 | 화면 | react와 같은 버전 |
| typescript | 6.0.3 | 언어 | 7.0.2 대신 쓰는 이유는 `추천 스택` 참고 |
| @types/node | 24.19.2 | Node 타입 | Electron 내장 Node 24와 맞춤 |
| @types/react | 19.3.0 | React 타입 | |
| @types/react-dom | 19.3.0 | React DOM 타입 | |
| vitest | 5.1.0 | 단위·통합 시험, JUnit XML 출력 | peer: vite ^6.4 \|\| ^7 \|\| ^8. engines: node ^22.12.0 \|\| ^24.0.0 \|\| >=26 |
| @playwright/test | 1.64.1 | 화면 시험(Electron 구동), JUnit XML 출력 | `_electron`은 이 패키지에서 가져온다. 브라우저 별도 다운로드 불필요(추정) |
| electron-builder | 26.18.0 | Windows 패키징 | 서명 안 함 |
| eslint | 10.14.0 | 린트 | |
| @eslint/js | 10.0.1 | ESLint 기본 규칙 | |
| typescript-eslint | 8.72.1 | TS 린트 | peer: typescript >=4.8.4 <6.1.0, eslint ^8.57 \|\| ^9 \|\| ^10 |
| prettier | 3.9.10 | 포맷 | |

도구 버전(npm 패키지가 아님): Node.js 24.22.2, npm은 Node에 딸린 것. 확인 PC의 Node는 22.23.2였다 (`호환성 참고사항`).

## 환경 / 빌드 / 실행 가이드

- **개발 환경 요구**: Windows 11. Node.js 24.22.2 (24.x LTS, Electron 45의 내장 Node 메이저와 맞춤), npm(Node에 포함). 이 PC에 이미 있는 Node 22.23.2는 위 패키지의 `engines`(electron >=22.12.0, vite ^20.19\|\|>=22.12, vitest ^22.12\|\|^24\|\|>=26)를 만족하므로 당장 막히지는 않는다. eslint 10.14.0의 `engines`는 확인하지 못했으므로 첫 Task가 `npm view eslint@10.14.0 engines`로 확인한다 (22.23.2에서 만족할 가능성이 높지만 확인한 것은 아니다). 단 시험이 내장 Node 24와 같은 메이저에서 도는 쪽이 안전해 24.22.2를 권고한다. Git 이외의 추가 도구(Visual Studio, Rust)는 필요 없다. 설치 시 Electron 바이너리를 내려받으므로 처음 한 번은 인터넷이 필요하다 (개발 시점에만. 앱 실행에는 필요 없다).
- **프로젝트 초기화**: 스캐폴딩 생성기는 버전을 고정하지 못하므로 쓰지 않는다. `app/`에서 `npm init -y` 후 `package.json`을 직접 쓴다. `"main": "out/main/index.js"`, `"type": "module"`, `"engines": { "node": ">=22.13.0" }`(결정 필요 4에서 사용자가 24를 고르면 `>=24.0.0`으로 바꾼다), 스크립트는 아래와 같다. 의존성은 `npm install --save-exact --save-dev <패키지>@<핀 버전>`으로 위 표대로 넣고 `package-lock.json`을 커밋한다. `electron.vite.config.ts`와 `tsconfig` 3개(루트 `tsconfig.json`은 에디터용 `{ "files": [] }`이고, 검사는 `tsconfig.node.json`과 `tsconfig.web.json`을 `-p`로 각각 지정한다. 자세한 구성은 06-file-map.md)를 두고, 각 `tsconfig`의 `include`가 비면 `tsc`가 실패(TS18003)하므로 첫 Task가 빈 진입 파일을 함께 만든다. `tsconfig.node.json`에는 `types: ["node"]`, `tsconfig.web.json`에는 `types: ["vite/client"]`를 명시한다 (TypeScript 6.0의 `types` 기본값 변화는 확인하지 못해 명시로 피한다).

  | 스크립트 | 내용 |
  |----------|------|
  | `dev` | `electron-vite dev` |
  | `build` | `tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit && electron-vite build` |
  | `start` | `electron-vite preview` (빌드 결과 실행) |
  | `lint` | `eslint .` |
  | `format` | `prettier --write .` |
  | `test` | `vitest run --passWithNoTests` (JUnit 옵션은 `명령` 표의 명령 참고) |
  | `test:e2e` | `npm run build && playwright test -c playwright.config.ts` |
  | `package` | `electron-builder --win --dir` (설치 파일이 아니라 실행 폴더. 설치 파일이 필요하면 `--win nsis`) |

- **설치**: `app/`에서 `npm ci`.
- **빌드 / 실행 / 테스트**: 개발 실행 `npm run dev`, 빌드 `npm run build`, 빌드 결과 실행 `npm run start`, 포장 `npm run package`(결과는 `app/release/`), 단위·통합 시험과 화면 시험은 `명령` 표.
- **린트 / 포맷**: ESLint 10 flat config(`eslint.config.js`) + typescript-eslint 8.72.1, Prettier 3.9.10. 린트 `npm run lint`, 포맷 `npm run format`.
- **화면 코드 보안 기본값**: 렌더러에 `contextIsolation: true`, `nodeIntegration: false`, 파일 접근은 preload가 노출하는 좁은 함수로만. 앱 안에서 외부 URL 로드·`autoUpdater`·원격 분석을 쓰지 않는다 (NFR-001). 글꼴·아이콘은 앱에 포함. 이 값들의 구체 위치는 아키텍처 설계가 정한다.
- **환경 변수 / 시크릿**: 필요한 시크릿 없음 (서버·계정이 없다, CON-001). 시험이 임시 데이터 폴더를 쓰도록 지정하는 키 하나가 필요할 수 있으나 이름과 방식(앱 데이터 경로 지정 인자 또는 환경 변수)은 아키텍처 설계가 정한다. `.env` 파일은 쓰지 않는다.
- **CI 권장**: 현재 CI가 없다 (명세에 요구 없음). 둔다면 Windows 러너에서 `npm ci` → `npm run lint` → `npm run build` → `test` → `test:e2e` 순서. Playwright의 Electron 시험은 창이 뜨는 데스크톱 세션이 필요해 일반 Linux 러너에서는 별도 설정이 필요하다 (추정).

## 명령

> 모든 명령은 `app/`을 현재 폴더로 삼아 실행한다 (`cd app` 뒤). 코드와 `package.json`은 `app/` 안에만 둔다. 결과 파일 경로도 `app/` 기준이다.

| 용도 | 명령 | 결과 파일 | 실행 위치 | 증거 | 비고 |
|------|------|-----------|-----------|------|------|
| install | `npm ci` | - | - | - | 필수. `package-lock.json` 필요. 첫 설치는 Electron 바이너리 다운로드로 네트워크 필요 |
| lint | `npm run lint` | - | - | - | 시험 파일이 없어도 통과해야 한다 (`eslint .`는 대상 파일이 있어야 하므로 첫 Task가 진입 파일을 만든다) |
| build | `npm run build` | - | - | - | 두 하위 tsconfig를 `tsc -p ... --noEmit`로 각각 검사한 뒤 `electron-vite build`. 루트 tsconfig는 검사에 쓰지 않는다. 첫 Task 시점에도 통과해야 한다 |
| test | `npx vitest run --passWithNoTests --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml` | reports/junit.xml | cli | - | 필수. 단위·통합. 시험 파일이 없어도 종료 코드 0과 빈 결과 파일을 남기는 것을 이 PC에서 확인함 (vitest 5.1.0) |
| test:e2e | `npm run test:e2e` | reports/e2e.xml | browser | test-results | 화면 시나리오(실제 Electron 창). 빌드 후 `playwright test -c playwright.config.ts`. junit 리포터와 출력 경로 `reports/e2e.xml`, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `outputDir: 'test-results'`는 `playwright.config.ts`에 둔다. 시험마다 임시 데이터 폴더를 쓰고 이전 데이터를 재사용하지 않는다. 창이 뜨는 시험이라 헤드리스가 아니다 |
| package | `npm run package` | - | - | - | 배포용 실행 폴더 만들기. 검증 필수는 아님 (릴리스 때만) |

## 시험 환경

> 구현 단계에서 자동 시험이 쓰는 실행 위치 두 곳이다. `device`는 쓰지 않는다 (모바일·실기기 없음, 명세 범위 제외).

| 실행 위치 | 도구 | 확인 명령 |
|-----------|------|-----------|
| cli | Node.js 24.22.2 + Vitest 5.1.0 | `node --version` |
| browser | Playwright 1.64.1 `_electron` (Electron 45.2.1 내장 Chromium. 별도 브라우저 설치 없음, 추정) | `npx playwright --version` |

시나리오를 어느 실행 위치에 둘지 권고(최종은 시험 계획이 정한다): 도메인 규칙(마감이 지난 판정, 검증 규칙, 검색·필터, 보관 규칙)과 저장 모듈(원자적 교체, 저장 중 강제 종료 흉내, 이전 버전 데이터 읽기, 읽기 실패 시 덮어쓰기 금지 — NFR-002, NFR-003, AC-031, AC-032)은 `cli`, 보드·캘린더·보관함 화면 흐름, 앱 재시작 뒤 유지(AC-011), 오프라인·요청 0건 관찰(NFR-001, AC-012)은 `browser`. 색 없이 구분되는지(NFR-004)는 화면 확인이 필요해 자동화가 어려우면 수동으로 둔다.

## 호환성 참고사항

- **TypeScript 7.0.2를 쓰지 않는 이유**: 레지스트리 최신은 7.0.2지만 typescript-eslint 8.72.1의 peer가 `<6.1.0`이다. 6.0.3으로 고정했고, typescript-eslint가 7을 지원하면 올린다.
- **Node 버전**: 이 PC의 Node 22.23.2는 eslint 10을 제외한 패키지의 `engines`를 만족하나(위 가이드. eslint 10은 첫 Task가 확인) 핀 권고 24.22.2와 다르다. `package.json`의 `engines.node`는 `>=22.13.0`으로 두고 사용자가 24를 고르면 `>=24.0.0`으로 바꾼다. `npm ci`로 `package-lock.json`을 만든 Node 버전은 첫 Task 기록에 남긴다. 더 나은 일치를 원하면 Node를 올린다. 최신 Node 26.13.0은 2026-10-28에 LTS가 되었으나 Electron 내장 Node(24)와 메이저가 달라 쓰지 않는다.
- **Electron 보안 수명**: Electron은 최신 3개 메이저만 지원한다. 45의 지원 종료는 2027-04-27(endoflife.date). 오프라인이라 자동 업데이트가 없으므로 그 전에 사용자가 새 메이저로 올려 다시 빌드해야 한다.
- **Playwright의 Electron 지원은 experimental**이다. Electron 21 이상 지원, `EnableNodeCliInspectArguments` fuse를 끄지 않아야 한다.
- **네트워크 요청 0건의 관찰 범위**: Playwright로는 앱 창의 요청만 본다. Chromium 프로세스 자체의 요청(DNS 선조회 등)은 이 방법으로 보이지 않는다. 필요하면 Chromium 넷로그(`--log-net-log`)로 확인할 수 있다 (이번에 시도하지 않은 추정). 실제 요청은 앱 쪽에서 외부 URL 차단으로 막는 것이 기본이다.
- **저장 방식**: JSON 한 파일은 카드 수천 건(ASM-010)에 충분하다고 추정하지만 측정하지 않았다. 매 저장마다 전체를 다시 쓰므로 크기가 수십 MB로 커지면 SQLite를 검토한다. Electron 45 내장 Node 24에는 `node:sqlite`가 있을 수 있으나 이번에 확인하지 못했다.
- **패키징**: 코드 서명을 하지 않아 Windows SmartScreen이 첫 실행 때 경고할 수 있다 (추정). 개인 PC 한 대용이라 서명 인증서는 비용 대비 선택 사항이다.
- **후보를 바꾸면**: B로 바꾸면 `electron`, `electron-vite`, `electron-builder`가 빠지고 `vite-plugin-pwa` 2.0.0(workbox-build 7.4.1 peer), `idb` 8.0.4가 들어오며, 화면 시험은 Playwright Chromium으로, `build`는 `vite build`로 바뀐다. C로 바꾸면 Rust 1.99.1, Visual Studio C++ 빌드 도구, `@tauri-apps/cli`/`@tauri-apps/api` 2.12.4, tauri 2.12.5가 들어오고 `install`·`build`·시험 명령이 `cargo`를 포함하며 화면 시험 방법은 새로 조사해야 한다.

## 출처

- Electron 릴리스 주기·지원 종료일: https://endoflife.date/api/electron.json (45.2.1, 2026-10-31 릴리스, 지원 종료 2027-04-27)
- Electron 45.2.1 내장 Node 24.22.1 / Chromium 156: https://releases.electronjs.org/release/v45.2.1
- Electron 지원 정책(최신 3개 메이저, 짝수 Chromium 주기): https://electronjs.org/docs/latest/tutorial/electron-timelines (웹 검색 결과 요약으로 확인, 페이지 본문은 열지 않음)
- Playwright Electron(experimental, Electron 21+): https://playwright.dev/docs/api/class-electron
- Node.js 버전과 LTS: https://endoflife.date/api/nodejs.json (24.22.2 LTS, 26.13.0 LTS 시작 2026-10-28)
- 브라우저 저장소 best-effort/persistent, 사용자 삭제: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- npm 레지스트리(버전·peer·engines): https://registry.npmjs.org/electron/45.2.1 , https://registry.npmjs.org/vite/latest , https://registry.npmjs.org/vitest/latest , https://registry.npmjs.org/@playwright/test/latest , https://registry.npmjs.org/react/latest , https://registry.npmjs.org/typescript/latest , https://registry.npmjs.org/typescript-eslint/latest , https://registry.npmjs.org/electron-vite/latest , https://registry.npmjs.org/electron-builder/latest , https://registry.npmjs.org/@vitejs/plugin-react/latest , https://registry.npmjs.org/vite-plugin-pwa/latest , https://registry.npmjs.org/@tauri-apps/cli/latest
- Tauri 2 크레이트 버전: https://crates.io/api/v1/crates/tauri (2.12.5). Rust 버전: https://endoflife.date/api/rust.json (1.99.1)
- Tauri 2 안정판 공지: https://v2.tauri.app/blog/ (웹 검색에서 확인)
- 그 밖의 핀 버전(eslint, prettier, @types/*, idb, workbox-build, @eslint/js)은 npm 레지스트리 조회 결과. 일부는 `npm view`로 확인
- 확인하지 못한 것: 설치 파일 크기·메모리 실측, Tauri 앱의 Windows 화면 시험 방법(`tauri-driver`), PWA 설치 시 Chromium의 persist 승인 기준, 서비스 워커 갱신 확인 요청 방식, Electron 내장 Node의 `node:sqlite` 지원, Chromium 넷로그 동작. 모두 위 본문에서 `추정`으로 표시했다. Electron·Vite·React 앱의 실제 동작은 이번 조사에서 실행해 보지 않았다 (Vitest 빈 시험의 JUnit 출력만 이 PC에서 확인)

## 결정 필요

1. **실행 형태 선택 (Q-005)**: 해소됨. 사용자가 A Electron을 골랐다(CON-002). 선택 근거는 데이터가 브라우저 밖의 파일이라 RISK-005를 구조적으로 피하고, 추가 언어 없이 강제 종료 시험이 가능한 점이다. 대가는 설치 크기·메모리, 수동 보안 업데이트, Playwright Electron 지원이 experimental인 점이다.
2. **웹(B)을 고를 때만**: 해당 없음(B는 선택되지 않았다). 참고로 남긴 질문: (a) 브라우저 설정에서 사이트 데이터를 지우는 경우를 NFR-002 범위에서 제외할지 포함할지, (b) 파일 거울 저장을 쓸지(명세가 백업·내보내기를 범위 제외로 둠 — 그것과 같은 것으로 볼지 사용자가 판단), (c) 정적 파일을 어디서 서빙할지(외부 호스트는 NFR-001과 충돌 가능, localhost는 로컬 서버 프로세스 필요).
3. **운영체제 확인 (ASM-003, RISK-006)**: Windows 전용이 맞는지. Windows 외 운영체제가 필요하면 후보 판단이 달라진다 (특히 C와 서명·패키징).
4. **Node 버전**: 현재 PC는 22.23.2다. 권고대로 24.22.2로 올릴지, 22.23.2로 진행할지. 어느 쪽이든 패키지 엔진 범위는 만족한다.
5. **저장 형식**: 해소됨. 아키텍처 설계가 확정했다(05-architecture.md ADR-002: 사용자가 후보 A를 골랐고 저장은 앱 데이터 폴더의 JSON 파일 1개 구성이다). 자동 이력(Q-002)이 정해져 기록량이 늘면 SQLite를 검토한다.
6. **코드 서명과 업데이트 방식**: 서명 없이 개인 PC 한 대에 쓰는 것으로 가정했다. 사용자가 말한 바가 없어 확정하지 않았다.

## 검증 기록

- 후보 비교: 후보 3개, `선택` 1개(A, 사용자가 골랐다: CON-002, Q-005 해소), 나머지는 `탈락: 사유`. 세 후보 모두 CON-001, NFR-001~NFR-003을 만족하도록 설계할 수 있음을 본문에서 비교했다. B의 NFR-001은 서빙 위치에 따라 달라질 수 있어 조건부로 적었다.
- `추천 스택`의 기술(Electron 45.2.1 등)은 `선택`인 후보 A와 같다.
- 모든 패키지에 정확한 핀 버전을 적었다. 버전 조회일 2026-11-03. 후보 B·C 전용 패키지(vite-plugin-pwa, idb, workbox-build, Tauri, Rust)도 핀 버전을 적었으나 B·C로 확정되면 호환 재확인이 필요하다.
- 명령 표에 `install`, `test`, `test:e2e`가 있고 모두 비대화형이다. `test`와 `test:e2e`에 JUnit `결과 파일`과 `실행 위치`가 있다. `test:e2e`의 `증거`는 `test-results`.
- `build` 스크립트의 두 `tsc -p` 호출과 `types` 설정은 실행해 확인하지 못했다. 첫 Task가 실행해 통과를 확인한다.
- 직접 실행해 확인한 것: Vitest 5.1.0 + Vite 8.3.5 조합에서 `--passWithNoTests` 빈 시험이 종료 코드 0과 `reports/junit.xml`을 만든다 (임시 폴더에서 확인, 프로젝트에는 파일을 만들지 않음). 나머지 명령은 `app/`이 아직 없어 실행하지 못했다.
- 첫 Task 시점에도 매번 도는 명령(`lint`, `build`, `test`)이 통과하도록 조건(진입 파일, `--passWithNoTests`)을 가이드에 적었다. `test:e2e`는 browser 시나리오를 맡은 Task가 생긴 뒤에만 돈다.
- `시험 환경`에 쓰는 실행 위치(cli, browser)마다 확인 명령이 있다. `device`는 쓰지 않는다.
- 이 PC 확인: Node v22.23.2, npm 10.9.8.
