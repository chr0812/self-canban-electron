---
name: spec-planner
description: 앱·서비스 기획 전문 스킬. 아이디어/요구사항을 받아 정형 spec.md(FR/NFR/CON/ASM/US/UC/SCR ID 체계, MoSCoW 우선순위, 조사 근거 테이블, 유스케이스 명세, 권한 매트릭스, 데이터 모델(개념), 상태 전이, 외부 시스템 카탈로그, 도메인 규칙)로 구조화. 도메인 조사, 경쟁사 분석, 사용자 여정, 화면 구조, KPI, 마일스톤, 리스크 평가, 4-페르소나 병렬 검증 포함. 자유 형식 기획서가 아닌 검증 가능한 정형 명세를 산출, 설계 단계가 ERD/API/UI 와이어프레임 결정에 바로 활용 가능한 입력값 제공. 사용 시점 - (1) "앱 기획해줘/spec 작성해줘", (2) 아이디어를 구조화된 요구사항으로 정리, (3) 기존 기획서 보완.
---

# /spec-planner — 정형 spec.md 생성 스킬

사용자 아이디어를 받아 도메인 조사·사용자 여정·4-페르소나 검증을 거쳐 정형 `spec.md`를 생성한다.

---

## 트리거

```
/spec-planner [설명] [--ref <경로,URL,...>] [--out <경로>] [--no-web]
```

| 플래그 | 기본값 | 용도 |
|--------|--------|------|
| `--ref` | (없음) | 참고 자료 경로/URL (쉼표 구분 다중) |
| `--out` | `docs/04-spec/` | 산출물 저장 디렉토리 (하네스에서는 바꾸지 않는다) |
| `--no-web` | false | WebSearch/WebFetch 비활성화 |

---

## 산출물

```
{out}/
├── spec.md                    # 21 섹션 정형 명세 (최종)
├── inputs/                    # (선택) 사용자가 미리 둔 참고 자료
└── notes/                     # 명세 작성 보조 분석 (구현 기준 아님)
    ├── summary.md             # Step 1: 수집된 자료 요약
    ├── domain-research.md     # Step 4: 도메인 + 경쟁사 + 트렌드
    └── user-journeys.md       # Step 4: Persona + 여정 + Edge case
```

---

## 워크플로우

### Step 0 — 입력 파싱 + 모드 판정

```
입력 파싱:
  - 설명 텍스트 추출
  - --ref: 파일/폴더(Read/Glob) / URL(WebFetch) / 이미지(Read) 자동 분기
  - --out 경로 결정 (기본 docs/04-spec/)
  - --no-web 플래그 저장

작업 디렉토리 준비:
  mkdir -p {out}/inputs {out}/notes

모드 판정 (한 번에 결정):
  IF {out}/spec.md 존재:
    AskUserQuestion("기존 spec.md 발견. 어떻게 진행할까요?", [
      "수정 모드 (보강)",
      "재조사 모드 (도메인/여정 다시)",
      "신규 모드 (덮어쓰기)"
    ])
  ELSE:
    → 신규 모드
```

---

### Step 1 — 참고 자료 수집

```
1. {out}/inputs/ 자동 감지
   IF 파일 존재:
     Glob({out}/inputs/*) → 파일 목록
     "참고 자료 {N}개 감지: {파일명 목록}"
     각 파일 Read → 내용 분석 (PRD/와이어프레임/문서)

2. --ref 인자 처리
   - 파일/폴더 경로: Read/Glob
   - URL: WebFetch (실패 시 경고 + 해당 자료 스킵, 나머지 진행)
   - 이미지: Read (시각 분석)

3. 입력 자료 없음:
   AskUserQuestion("참고 자료가 있나요?", ["없음 진행", "파일/URL 입력"])
   IF "파일/URL 입력":
     입력 받아 처리

→ Write({out}/notes/summary.md)
   형식:
     # 참고 자료 요약
     | # | 출처 | 타입 | 핵심 내용 |
     |---|------|------|----------|
```

---

### Step 2 — 입력 완성도 평가

```
Read(.claude/skills/spec-planner/references/input-assessor.md)
→ 평가 로직 로드

5개 항목 × 0-2점 평가:
  목적 / 사용자 / 핵심 기능 / 기술 제약(선택) / 범위

총점 분기:
  ≥ 8 → auto-fast    : 요약 표시 후 즉시 Step 3
  = 7 → auto-confirm : 요약 + 부족 항목 표시 → 1회 확인
  ≤ 6 → interactive  : 부족 항목 AskUserQuestion (최대 3회)
```

---

### Step 3 — 요구사항 추출 + 초안 spec.md

```
Read(.claude/skills/spec-planner/references/requirements-analyst.md)
Read(.claude/skills/spec-planner/references/spec-template.md)

[3-1] 요구사항 추출
  FR  : 시스템이 해야 하는 것
  NFR : 성능/보안/접근성 (측정 가능한 수치 강제)
  CON : 기술/환경/규제 제약
  ASM : 합리적 추론 ([가정] 태그 강제, 설계 영향 높음/보통/낮음 표기 — requirements-analyst.md 6)

[3-2] 우선순위 (MoSCoW): P0 (Must) / P1 (Should) / P2 (Nice)

[3-2b] 인수 기준 (P0·P1 FR 필수, 게이트 VAL-13)
  FR 아래 "- 인수 기준:" 밑에 "- AC-NNN: {관찰할 수 있는 결과}" 1~3개 (정상 + 대표 실패·경계)
  출처: 인터뷰 시나리오·성공 기준, PRD 기능 설명, UC 흐름. 없는 정책·수치는 지어내지 않고 사용자 확인 대상으로 남긴다.

[3-3] 사용자 스토리 변환
  US-NNN: AS [역할] / I WANT [기능] / SO THAT [가치]

[3-4] 엔티티 추출 (데이터 모델 개념 수준 초안)
  FR/US 본문에서 명사 → 후보 엔티티 식별
  각 엔티티: 이름(PascalCase), 1줄 설명, 필수 속성 후보, 라이프사이클
  엔티티 간 관계 (1:1 / 1:N / N:M) 추론
  → ## 데이터 모델 (개념) 섹션 초안. ERD 다이어그램은 Step 5에서 mermaid로 완성.

[3-5] 역할(Role) 식별 (권한 매트릭스 초안)
  Persona/사용자 정의에서 Role 추출 (User/Trainer/Admin/Guest 등)
  각 Role의 도입 Phase 추정
  → ## 권한 매트릭스 섹션 Role 목록 초안. 기능 권한 표는 Step 5에서 FR과 매핑.

수정 모드 ID 충돌 회피:
  종류별 max(ID-NNN) + 1 부터 부여
  삭제된 ID는 재사용 금지 (변경 이력에 기록)

규칙:
  - 입력에 없는 요구사항을 임의 추가 금지
  - ASM은 반드시 [가정] 태그와 `- 설계 영향: 높음|보통|낮음 — 이유` 줄 (게이트 VAL-20). 인터뷰의 A-n 이 ASM 이 될 때도 매긴다
  - 모든 FR에 `근거` 필드 필수
  - P0·P1 FR에 `인수 기준`(AC-NNN) 1개 이상
  - 모든 NFR에 측정 수치 + 환경 필수
  - 엔티티는 PascalCase, 역할은 영문 단어 (Role 표준)

Write({out}/spec.md) — 초안 (Step 4-5에서 보강됨)
```

---

### Step 4 — 도메인 조사 + 사용자 여정 (순차 수행)

```
주체: Claude 직접 수행. Task() 병렬 호출 사용 안 함 (검증 단계에서만 사용).

[1] 도메인 조사
   Read(.claude/skills/spec-planner/references/domain-researcher.md)

   IF --no-web == false:
     TRY: WebSearch + WebFetch
       - 도메인 핵심 개념/용어
       - 경쟁 서비스 3~5개 식별 + 분석
       - 시장 트렌드 / 기술 트렌드
     ON FAIL: 일반 지식 분석 + 출처에 [일반 지식 폴백] 태그
   ELSE:
     일반 지식 분석

   Write({out}/notes/domain-research.md)

[2] 사용자 여정 + 유스케이스 명세
   Read(.claude/skills/spec-planner/references/user-journey-analyst.md)

   - Persona 2~4개 식별 (목표/맥락/불편사항)
   - 핵심 여정 설계 (진입 → 액션 → 결과 → 이탈) + FR 매핑
   - Edge case 3개+ (오류/빈 상태/대량 데이터)
   - FR 커버리지 검증 (모든 P0 FR이 최소 1개 여정에 등장)

   추가 (유스케이스 명세화):
   - 모든 P0 US에 대응하는 UC 작성 (UC-NNN ID 부여)
   - 각 UC: Actor / Goal / Precondition / Trigger / Main Flow / Alt Flow / Postcondition
   - Edge case는 Alt Flow로 통합 (예: "Edge 2: 네트워크 끊김" → UC-001 Alt Flow 1)
   - 핵심 P1 UC도 작성 (Alt Flow 복잡 시 우선)

   Write({out}/notes/user-journeys.md)  ← 여정 + UC 명세 모두 포함
```

---

### Step 5 — 통합 보강 + 4-페르소나 병렬 리뷰

```
# Phase A: 통합 보강

도메인 조사 결과 → spec.md 보강:
  - 규제/규칙/법적 요건 → CON 확정 추가
  - 경쟁사 기능 → ## Candidate Requirements (추천, 확정 아님)
  - 시장 트렌드 → ## Candidate Requirements

사용자 여정 + 유스케이스 결과 → spec.md 보강:
  - UC-NNN 명세를 spec.md ## 유스케이스 명세 섹션에 정리 (Step 4 추출 결과)
  - 핵심 여정의 필수 단계 누락 → Candidate Requirements (사용자 확인 후 FR로 승격)
  - Edge case / 편의 기능 → Candidate Requirements
  - 화면 매핑 → ## 화면 구조 (SCR) 작성 (각 SCR에 관련 UC 매핑 포함)

데이터 모델 완성 → ## 데이터 모델 (개념) 섹션:
  - Step 3-4 엔티티 초안 + 도메인 조사에서 발견된 엔티티 통합
  - 엔티티 관계 mermaid erDiagram 작성
  - 데이터 양 추정: 사용자당 / 1년 / 시스템 전체 (KPI-001 DAU 기준)
  - 설계 영향 메모 (DB 선택, 캐싱, 암호화 연계)

권한 매트릭스 완성 → ## 권한 매트릭스 섹션:
  - Step 3-5 Role 목록 + Role × FR 매트릭스 작성
  - 모든 FR이 최소 1개 Role에 정의 (강제)
  - 조건부 권한(⚠️)은 조건 명시

외부 시스템 카탈로그 → ## 외부 시스템 카탈로그:
  - FR/NFR/Cand에 산재된 외부 시스템 통합 (OAuth, 인증, 분석, AI API, 푸시 등)
  - 각 시스템: 목적, 의존성(필수/선택/조건부), 데이터 방향, 인증 방식
  - 복잡한 통합은 mermaid flowchart로 데이터 흐름 표현

상태 전이 → ## 상태 전이 섹션:
  - 비자명한 상태 흐름을 가진 엔티티만 작성 (CRUD만 있는 단순 엔티티 생략)
  - mermaid stateDiagram-v2 + 상태별 진입 조건/액션/다음 상태 표

도메인 규칙 → ## 도메인 규칙 섹션:
  - 계산 공식 (도메인 조사에서 발견된 공식 + 사용자 입력 기반 추론)
  - 검증 규칙 (필드별 범위/형식)
  - 정책 (차단, 신고, 환불, 데이터 삭제 등)
  - 도메인 용어 (Glossary) — domain-research.md에서 핵심 발췌

리스크 평가 → ## Risk Assessment 추가:
  - 기술 리스크 (도메인 복잡도, 기술 한계, 외부 시스템 장애)
  - 비즈니스 리스크 (경쟁, 규제)
  - 일정/예산 리스크
  - ASM 깨질 시 영향 (인프라 마이그레이션 등)

KPI 도출 → ## KPI 섹션:
  - 사용자 / 기능 / 기술 / 비즈니스 카테고리별
  - 데이터 양 추정과 정합

마일스톤 초안 → ## 마일스톤 섹션:
  - 포함 항목에 FR / SCR / UC 모두 표기 (3중 매핑)

Write({out}/spec.md) — 보강본 (21개 섹션 모두 채워짐)

# Phase B: 4-페르소나 병렬 리뷰 (1회만 실행)

Read(.claude/skills/spec-planner/references/review-integration-rules.md)

한 메시지에서 Task × 4 동시 발사:

  Task(subagent_type: "general-purpose", model: "sonnet", prompt: """
    당신은 critical-reviewer입니다. 다음 지침을 따르세요.
    {Read(.claude/skills/spec-planner/references/reviewers/critical-reviewer.md) 내용}

    검토 대상 spec.md:
    {Read({out}/spec.md) 내용}

    공통 JSON 스키마로 결과를 출력하세요.
  """)

  Task(... technical-reviewer.md ...)
  Task(... user-advocate.md ...)
  Task(... business-reviewer.md ...)

→ 약 30~60초 후 4개 JSON 응답 수신

# Phase C: 통합 + 판단 (review-integration-rules.md 따름)

1. 수집 (실패한 페르소나 처리)
   4/4 성공 → 정상 진행
   3/4 성공 → 경고 표시 + 진행
   ≤2/4 → AskUserQuestion (재시도/진행/중단)

2. 그룹화 (target_ref 기준)

3. Consensus score 계산 (검토 순서용. 처리 권한이 아니다)

4. 처리 분기 (contracts/review-handling.md — 유형이 권한을 정한다):
   불일치·구현          → 근거를 적고 자동 spec.md 수정
   요구·정책            → AskUserQuestion (모아서 한 번에, 최대 4개, 나머지 "기록만")
   선호                 → ## 검증 기록에 기록
   CRITICAL             → 유형과 관계없이 반드시 닫는다 (수정 / 기각+사유 / 사용자 결정)

5. ## 검증 기록 섹션 작성/갱신

Write({out}/spec.md) — 최종본
```

---

### Step 6 — 최종 확인 + 출력

```
요약 표시:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 spec.md 완성
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • FR: {N}개 (P0: {n}, P1: {n}, P2: {n})
  • NFR: {N}개  |  CON: {N}개  |  ASM: {N}개
  • 도메인: {도메인명}, 경쟁사 {N}개
  • Persona: {N}개  |  여정: {N}개  |  Edge case: {N}개
  • SCR: {N}개  |  Candidate: {N}개
  • Risk: {N}개  |  KPI: {N}개  |  Milestone: {N}개
  • 4-페르소나 리뷰: CRITICAL {n}, WARN {n} 반영 / INFO {n} 기록
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AskUserQuestion("결과를 확인해주세요", ["확정", "수정 요청", "재시작"])
  IF "수정 요청":
    피드백 수집 → 변경 범위 판단:
      요구사항 추가/변경 → Step 3 재진입
      검증 재실행 요청 → Step 5 Phase B 1회 추가 (사용자 명시 요청 한정)
  IF "재시작":
    백업 후 Step 0부터 다시

산출 경로: {out}/spec.md, {out}/notes/*.md
```

---

## 수정 모드

기존 `{out}/spec.md`가 있을 때 `/spec-planner` 실행 시:

```
Step 0에서 모드 선택:
  - 수정 모드 → 기존 spec.md 읽어 보강 베이스로 사용. Step 3부터 진행
  - 재조사 모드 → 기존 spec.md 유지, Step 4 재실행
  - 신규 모드 → 백업 후 처음부터

ID 충돌 회피:
  종류별 max(NNN) + 1 부터 새 ID 부여
  삭제된 ID는 ## 변경 이력에 기록, 재사용 금지

변경 이력:
  ## 변경 이력 테이블에 버전/일자/추가/삭제 누적
```

---

## 에러 처리

| 시나리오 | 처리 |
|---------|------|
| `--ref` URL 접근 실패 | 경고 + 해당 자료 스킵, 나머지 진행 |
| `--ref` 파일 경로 없음 | 경고 + 스킵 |
| WebSearch/WebFetch 실패 | 일반 지식 폴백 + `[일반 지식 폴백]` 태그 |
| 사용자가 AskUserQuestion 거부/취소 | 현재까지 진행한 부분 저장 + 상태 보고 |
| Task (페르소나) 1개 실패 | 3/4 결과로 진행 + 경고 |
| Task 2개 이상 실패 | 사용자 확인: 재시도 / 진행 / 중단 |
| spec.md Write 실패 | 즉시 중단 + 에러 표시 |
| 수정 모드 기존 spec.md 파싱 실패 | 사용자 확인: 신규 모드 전환 / 중단 |

**공통 원칙**: 어떤 실패든 `{out}/` 기존 산출물 삭제하지 않는다.

---

## 하네스 계약과 게이트

- 산출물의 섹션 이름, ID 형식, 근거 태그, 우선순위 표기는 `contracts/artifact-contract.md`를 따른다. 충돌하면 계약이 우선한다.
- 입력은 승인된 `docs/03-prd/prd.md`와 확정된 `docs/01-interview/interview.md`다. `--ref`로 넘기지 않아도 둘을 읽는다.
- 작성이 끝나면 `node scripts/gate.js spec`으로 내용을 검사한다. 승인은 사용자가 한 뒤에 `node scripts/gate.js approve spec --by <승인자>`로 기록한다.
- 경로는 `docs/04-spec/`로 고정한다 (`--out`을 바꾸지 않는다).

---

## 참고

- `references/input-assessor.md` — 5점 척도 평가 로직
- `references/requirements-analyst.md` — FR/NFR/CON/ASM 추출 규칙
- `references/domain-researcher.md` — 도메인 조사 절차
- `references/user-journey-analyst.md` — Persona/여정 설계
- `references/spec-template.md` — spec.md 21 섹션 완전 템플릿
- `references/review-integration-rules.md` — 4-페르소나 통합 알고리즘
- `references/reviewers/critical-reviewer.md` — 비판적 검토자
- `references/reviewers/technical-reviewer.md` — 기술 검토자
- `references/reviewers/user-advocate.md` — 사용자 옹호자
- `references/reviewers/business-reviewer.md` — 비즈니스 검토자
