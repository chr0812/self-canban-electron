# 산출물 안내

이 폴더는 기획~설계 하네스(`/discover-to-design`)의 산출물을 담는다. 폴더 번호는 작성 순서다.
진행 상태는 `node scripts/gate.js status`로 본다. 이 안내는 하네스가 만들며, 고쳐도 검사에 영향이 없다.

## 이름 규칙

- 폴더 번호는 고정이다. 선택 단계(조사)를 건너뛰면 그 번호의 폴더가 없을 뿐, 뒤 번호를 당기지 않는다.
- `_`로 시작하는 파일·폴더는 **하네스가 만드는 기록**이다. 손으로 고치지 않고, 구현할 때 보지 않는다.
- 각 문서의 첫 줄 제목이 한글 이름이다.

## 폴더와 파일

| 경로 | 이름 | 단계 | 구현 때 |
|------|------|------|:-------:|
| `01-interview/interview.md` | 인터뷰 정리본 | 발견 | - |
| `01-interview/interview-log.md` | 인터뷰 라운드 기록 | 발견 | - |
| `02-research/01-overview.md` | 조사 요약 (선택) | 발견 | - |
| `02-research/02-domain.md` · `03-competitors.md` · `04-trends.md` | 도메인·경쟁사·트렌드 분석 (선택) | 발견 | - |
| `02-research/05-sources.md` | 조사 출처 원문 (선택) | 발견 | - |
| `03-prd/prd.md` | PRD (제품 요구사항) | PRD | - |
| `04-spec/spec.md` | 명세 (요구사항과 FR별 인수 기준 `AC`의 기준 문서) | 명세 | 필요할 때 |
| `04-spec/notes/` | 명세 작성 보조 분석 | 명세 | - |
| `05-design/README.md` | **설계 진입점** (개발 시 읽는 순서, 미해결 사항) | 설계 | 처음에 |
| `05-design/01-tech-stack.md` | 기술 스택, 명령 표(설치·빌드·테스트), 시험 환경 | 설계 | 항상 |
| `05-design/02-data-model.md` | 데이터 모델 | 설계 | 데이터 작업 |
| `05-design/03-api-spec.md` | API·인터페이스 | 설계 | 인터페이스 작업 |
| `05-design/04-ui-spec.md` · `wireframes/` | 화면 설계와 와이어프레임 | 설계 | 화면 작업 |
| `05-design/05-architecture.md` | 아키텍처와 기술 결정 기록 | 설계 | 구조 판단 |
| `05-design/06-file-map.md` | 파일별 위치·책임·명세 | 설계 | 항상 |
| `05-design/07-test-plan.md` | 시험 계획 (인수 기준을 펼친 시험 시나리오 `TC`) | 설계 | 테스트 작성 |
| `05-design/08-tasks.md` | **구현 작업 목록** (Wave 순서, Task마다 담당 `TC`) | 설계 | 항상 |
| `06-build/build-log.md` | 구현 기록 (Task 별 검증, 설계와 다른 점) | 구현 | 기록 |
| `06-build/issues.md` | 구현 중 보고 (`BI`: 코드·구현 차이·설계·명세 결함) | 구현·시험 | 기록 |
| `07-test/test-report.md` | 시험 보고서 (시나리오별 결과, 인수 승인 대상) | 시험 | - |
| `03-prd/_approval.md` · `04-spec/_approval.md` · `05-design/_approval.md` · `07-test/_approval.md` | 승인 기록 (마지막은 인수 승인) | 각 단계 | - |
| `05-design/_review/` | 설계 리뷰 결과와 처리 기록 | 설계 | - |
| `05-design/_variants/` | 화면 시안 비교 기록 (시안 `V-A`, `V-B` … 과 서로 다른 점 비교표). 선택 결과는 `04-ui-spec.md`의 디자인 방향에 있다 | 설계 | - |
| `07-test/_evidence/` | 시험 실행 출력 (증거) | 시험 | - |
| `01-interview/_confirmation.md` | 인터뷰 확정 기록 (사용자가 확정한 정리본의 해시) | 발견 | - |
| `_gate/` | 게이트 검사 로그, 진행·검증 기록(`build.json`, `build/*.log`, `test.json`), 하네스 지문(`harness.json`), 면제 기록 | 전체 | - |

앱 코드와 테스트는 이 폴더 밖, 프로젝트 루트의 `app/`에 있다.

## 구현을 시작할 때

`05-design/README.md` → `01-tech-stack.md`(환경 준비) → `08-tasks.md`(Task를 Wave 순서로) → Task마다 `06-file-map.md`, 담당 `TC`(`07-test-plan.md`), 해당 설계 문서.
요구사항이 모호하면 `04-spec/spec.md`가 기준이다.
