# 리뷰 처리 기록

> 작성일: 2026-11-03
> 리뷰 3관점(consistency, feasibility, risk) 지적 43건(CRITICAL 1, WARN 23, INFO 19). 리뷰는 1회만 실행했다.
> 사용자 결정 3건(보관 카드 삭제 허용 D1, 저장 성공 뒤 화면 변경 D2, 읽기 실패는 안내 문구만 보강 D3)은 이 기록의 `사용자 결정` 행에 있다. 그 결과 명세를 v3로 고쳤고(UC-009 선행 조건, ASM-015, SCR-004, AC-040, NFR-001 범위) 재승인이 필요하다.

| 이슈 | 유형 | 처리 | 근거 |
|------|------|------|------|
| DC-001 | 요구·정책 | 사용자 결정 | 사용자가 보관한 카드의 삭제를 허용하기로 정했다(D1). 명세 v3: UC-009 선행 조건 수정, ASM-015, SCR-004 관련 FR에 FR-011, AC-040. 설계 02·03·04·05·06·07·08과 wireframes/SCR-004.svg(삭제 버튼) 반영 |
| DC-002 | 요구·정책 | 사용자 결정 | 사용자가 "저장 성공 뒤에 화면 바꾸기"를 골랐다(D2). 04·03·05 ChangeRunner·ADR-006을 낙관적 반영 없는 방향으로 일치시켰고 TC-115를 다시 썼다. 밝기 전환만 명세 UC-011대로 낙관적 유지 |
| DC-003 | 불일치 | 수정 | 04-ui-spec.md SCR-001 `에러: 읽기 실패`에 읽지 못한 파일 경로·오류 코드 문구·직전 저장본 안내 추가(03 ReadFailure, 05, 07 TC-117과 일치) |
| DC-004 | 불일치 | 수정 | 03-api-spec.md cards.list 보관함 사용 방법을 05 데이터 흐름(scope 목록을 한 번 받아 renderer가 matchesQuery로 거름)에 맞췄다 |
| DC-005 | 불일치 | 수정 | 07-test-plan.md TC-010 시험 파일을 card-rules.test.ts, TC-036을 data-file-repository.test.ts로 바꿔 08 Task 소유와 일치시킴 |
| DC-006 | 구현 | 수정 | 08-tasks.md T-040/T-041/T-042를 재배분하고 각 Task에 E2E가 검증하는 구현 Task를 명시. 구현 파일이 부족해 더 잘게 못 나눈 이유는 08 결정 필요 2 |
| DC-007 | 구현 | 수정 | 08-tasks.md covers에 소유 TC가 확인하는 FR/UC/NFR을 보강하고 점검표 갱신(TC 근거와 전수 대조해 누락 0건 확인) |
| DC-008 | 불일치 | 수정 | 01-tech-stack.md 머리 문단·추천 스택·결정 필요·검증 기록을 "사용자가 A(Electron)를 골랐다(CON-002, Q-005 해소)"로 수정 |
| DC-009 | 불일치 | 수정 | 02 설계 메모와 05 ADR-002의 "사용자가 확정"을 "후보 A(JSON 파일 1개 저장 구성 포함)를 골랐다"로 바꾸고 01 결정 필요 5를 ADR-002로 닫음 |
| DC-010 | 불일치 | 수정 | 명세 NFR-001 적용 범위를 FR-001~FR-014로 고침(명세 v3, 재승인 필요). 07 TC-125 근거와 일치 |
| DC-011 | 불일치 | 수정 | 07 TC-066 근거를 AC-031·ADR-004, TC-064 근거를 NFR-001·ADR-004로 고치고 추적 요약 표 갱신 |
| DC-012 | 불일치 | 수정 | 04-ui-spec.md "필드 6개"를 입력 항목 7개로 수정 |
| DC-013 | 불일치 | 수정 | 04에 "와이어프레임의 앱 이름은 임시 문구"를 적고 wireframes/SCR-004.svg 주석의 결과 없음 문구를 04와 일치시킴 |
| DC-014 | 불일치 | 수정 | 05 tests/cli에 text/ 추가·model/ 설명 보강, 04 컴포넌트 트리 SearchBox를 common/으로 이동해 06과 일치 |
| FE-001 | 구현 | 수정 | CRITICAL. 01-tech-stack.md build 스크립트와 명령 표를 `tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit && electron-vite build`로 수정, 06 루트 tsconfig를 `{ "files": [] }`로 바꾸고 node/web에 types 명시, 08 T-001 check 반영 |
| FE-002 | 구현 | 수정 | 05 ADR-005와 06에 preload CJS 출력(out/preload/index.cjs), electron.vite.config.ts 설정, import.meta.dirname 경로를 확정값으로 기재. 실행 확인은 구현 첫 Task로 표시 |
| FE-003 | 구현 | 수정 | 08-tasks.md에 새 T-043(Wave 9) 스모크 Task 추가, 07 TC-154. playwright.config.ts와 network-observer.ts를 T-043으로 이동 |
| FE-004 | 구현 | 수정 | T-040/T-041/T-042를 재배분하고(browser TC 배분 T-043 3 / T-040 29 / T-041 22 / T-042 17) covers 보강 |
| FE-005 | 구현 | 수정 | T-020에서 progress-rules를 새 T-044로 분리. T-030/T-031은 나누지 않은 사유를 08 결정 필요 3에 기록 |
| FE-006 | 구현 | 수정 | 06에 tests/cli/state/reducers.test.ts, change-runner.test.ts 추가, 07 TC-143~147, 08 T-031 |
| FE-007 | 구현 | 수정 | 05·06 IpcHandlers의 INTERNAL console.error, AppLifecycle 처리, render-process-gone/did-fail-load, React 오류 경계 추가. 07 TC-141 |
| FE-008 | 구현 | 수정 | CSP를 production build에서만 주입(05, 06, 07 TC-126, 08 T-001/T-041) |
| FE-009 | 선호 | 기록 | 파일을 합쳐 규모를 줄이는 제안은 구조 취향이며 요구·화면 결정을 줄이지 않는다. 구현 중 판단, README 기록 |
| FE-010 | 구현 | 수정 | 05 의존 규칙에 src/main/**에서 node:path 허용, 06 data-file-names는 path.join 사용 |
| FE-011 | 구현 | 수정 | 06 playwright.config.ts에 workers 1, fullyParallel false, timeout 30000, retries 0, launch-app try/finally 종료와 임시 폴더 정리 |
| FE-012 | 선호 | 기록 | T-003을 없애려면 Task 번호를 당겨야 해 ID 재사용 금지 원칙과 충돌한다. 번호는 유지하고 T-003은 prettier.config.js만 남았다고 README 기록 |
| FE-013 | 선호 | 기록 | 수정 불필요(리뷰어 판단). 선택이 끝났으므로 구현 단계에서 01-tech-stack.md의 B·C 비교를 부록으로 분리할 수 있다 |
| FE-014 | 구현 | 수정 | 06 package.json에 engines `>=22.13.0`(사용자가 Node 24를 고르면 `>=24.0.0`), 01에 eslint 10 engines 확인 항목 추가 |
| FE-015 | 구현 | 수정 | NodeFileSystem.rename에서 EPERM/EBUSY/EACCES일 때만 짧게 재시도(02 저장 절차, 05, 06, 07 TC-138·TC-140) |
| FE-016 | 구현 | 수정 | 05·06 preload에 documentElement가 없을 때 MutationObserver로 data-theme을 적는 방법과 Bootstrap settings.get 안전망, 07 TC-131에 첫 화면 색 깜빡임 확인 |
| RK-001 | 요구·정책 | 사용자 결정 | 사용자가 "저장 성공 뒤에 화면 바꾸기"를 골랐다(D2). 칸 이동·보관·삭제는 성공 뒤 반영, 실패하면 화면 불변과 다시 저장 |
| RK-002 | 구현 | 수정 | ChangeRunner가 변경을 쌓지 않고 즉시 보내며, IpcHandlers의 whenIdle()을 창 close에서 기다린 뒤 닫도록 05·06 수정. 07 TC-142·TC-152. 창이 닫히는 순간 main에 도착하지 않은 요청이 있는지는 실행해 확인하지 못함 |
| RK-003 | 요구·정책 | 사용자 결정 | 사용자가 앱 안 복구 동작 없이 "안내 문구만 보강"을 골랐다(D3). ReadFailure에 backupPath·preMigrationCopies, 패널에 수동 절차 문구, 07 TC-117·TC-139 |
| RK-004 | 구현 | 수정 | 05 AppLifecycle·ADR-012와 06에 app.ready 전에 userData를 고정 상수 폴더로 지정(--user-data-dir이 있으면 건드리지 않음, 개발 실행은 -dev 접미사). 앱 이름은 미정 그대로, -dev 접미사는 README에 사용자 확인 항목으로 둠 |
| RK-005 | 구현 | 수정 | README에 Electron 45 지원 종료(2027-04-27)와 업그레이드 절차 단락, 01 결정 필요 6 이동 |
| RK-006 | 요구·정책 | 기록 | 필드 길이 상한은 사용자 정책이다. 사용자가 말하지 않아 만들지 않았고 README 기록에 남긴다. 대용량 측정 TC 추가는 하지 않았다 |
| RK-007 | 구현 | 수정 | 05 NetworkGuard·06 network-guard.ts에 Chromium 레벨 완화책 후보(host-resolver-rules, setProxy direct)를 구현 첫 Task에서 확인할 후보로 기재. 07 TC-132(수동)에 --log-net-log 확인 |
| RK-008 | 구현 | 수정 | 허용 목록을 앱 번들 폴더 URL 접두사로 좁히고 포장 퓨즈를 electron-builder.yml에 기재(05, 06). 07 TC-065, TC-154, TC-155(수동) |
| RK-009 | 구현 | 수정 | 02 저장 파일 표와 README에 "직전 저장본과 버전 변환 사본에는 삭제 전 내용이 남을 수 있음" 기재 |
| RK-010 | 구현 | 수정 | 임시 파일 이름을 kanban-data.json.<프로세스 id>.tmp로 변경(02, 05, 06), 고아 .tmp는 읽을 때 무시. 동시 실행 차단은 사용자가 기각했으므로 차단은 제안하지 않음. 07 TC-137·TC-040 |
| RK-011 | 선호 | 기록 | 규모 대비 구조 크기에 대한 의견. smoke 묶음 표시는 구현 중 판단. 사용자 요구·결정을 줄이지 않는 제안만 있어 README 기록 |
| RK-012 | 구현 | 수정 | FE-007과 같다. INTERNAL console.error, 화면에 접힌 자세히(04), 07 TC-141 |
| RK-013 | 구현 | 수정 | FE-015와 같다. rename 재시도, 07 TC-138·TC-140 |
