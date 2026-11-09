---
name: pre-research
description: 주제 기반 사전 조사 스킬. 도메인·경쟁사·트렌드를 조사하고 외부 자료를 통합해 조사 산출물(domain-analysis, competitor-analysis, trend-analysis, raw-sources, overview)을 만든다. 인터뷰의 '조사 필요 항목'이 있으면 그것에 초점을 맞춘다. 브레인스토밍과 PRD 작성은 하지 않는다(각각 interview, prd-writer 담당). 사용 시점 — (1) "시장 조사해줘/경쟁사 분석해줘/도메인 조사", (2) 인터뷰에서 나온 조사 필요 항목 확인, (3) 낯선 분야의 사전 파악.
---

# /pre-research — 사전 조사

주제를 받아 **외부 자료 통합 → 조사(도메인·경쟁사·트렌드) → 출처 정리 → 요약**을 수행한다.
대화형 토론과 PRD 작성은 하지 않는다. (인터뷰는 `interview`, PRD는 `prd-writer`)

산출물은 `interview`의 사전 자료, `prd-writer`의 옵셔널 입력이 된다.

**스킬도 산출물도 프로젝트 로컬.**

---

## 트리거

```
/pre-research [주제] [--depth light|standard|deep] [--focus domain|competitor|tech|all] [--no-web]
```

| 플래그 | 기본값 | 용도 |
|--------|--------|------|
| `--depth` | `standard` | 조사 깊이 |
| `--focus` | `all` | 조사 초점 (특정 영역만 집중) |
| `--no-web` | false | WebSearch/WebFetch 비활성화 |

주제를 생략하면 `docs/01-interview/interview.md`의 요약에서 가져온다. 둘 다 없으면 주제를 묻는다.

---

## 산출물 경로

```
<프로젝트>/docs/02-research/
├── inputs/                  # 사용자가 넣는 외부 자료
│   └── (PDF, 문서, 이미지, 메모, URL 목록 등)
├── 01-overview.md           # Step 4: 전체 요약 (먼저 읽는 문서라 번호가 앞이다)
├── 02-domain.md             # Step 2: 도메인 분석
├── 03-competitors.md        # Step 2: 경쟁사 분석
├── 04-trends.md             # Step 2: 트렌드 분석
└── 05-sources.md            # Step 3: 출처 목록
```

경로는 `./docs/02-research/` 로 고정한다. 산출물 규약은 `contracts/artifact-contract.md`를 따른다.

---

## 워크플로우

### Step 0 — 입력 파싱 + 준비

```
입력 파싱:
  - 주제 텍스트, 플래그(--depth, --focus, --no-web) 추출

산출물 경로:
  base = ./docs/02-research/
  mkdir -p {base}/inputs

기존 결과 감지:
  IF {base}/01-overview.md 존재:
    AskUserQuestion("기존 조사 결과 발견. 어떻게 진행할까요?", [
      "보강 (기존 유지 + 추가 조사)",
      "재조사 (처음부터, 기존 파일은 .bak으로 보존)",
      "취소"
    ])
    IF "취소": 종료
    IF "보강": 기존 파일 Read → 보강 베이스로 활용

인터뷰 감지:
  IF docs/01-interview/interview.md 존재:
    Read → 다음 절을 추출
      - 조사 필요 항목   ← 조사의 우선 대상
      - 문제와 배경, 사용자 ← 도메인 키워드와 경쟁 서비스 선정에 활용
    "인터뷰 감지: 조사 필요 항목 {N}건을 우선 조사합니다"
    조사 필요 항목이 없으면 일반 조사로 진행한다.
```

---

### Step 1 — 외부 자료 수집

```
주체: Claude (직접 수행)

[1-1] inputs/ 자동 감지
  Glob({base}/inputs/*)
  IF 파일 존재:
    → "외부 자료 {N}개 감지: {파일명 목록}"
    → 각 파일 Read → 내용 분석
      - PDF: 텍스트 추출 + 핵심 내용 요약
      - 이미지: 시각 분석 (와이어프레임, 스크린샷 등)
      - 마크다운/텍스트: 직접 읽기
    → 분석 결과를 이후 단계 컨텍스트로 활용

[1-2] 추가 자료 확인
  AskUserQuestion("참고할 외부 자료가 있나요?", [
    "없음, 진행",
    "파일/URL 추가 입력"
  ])
  IF "파일/URL 추가 입력":
    → 경로: Read로 읽기
    → URL: WebFetch로 수집
    → 분석 결과 컨텍스트에 추가

외부 자료 분석 결과 = 이후 모든 단계에서 참조하는 컨텍스트
```

---

### Step 2 — 조사 수행

```
주체: Claude (직접 수행) + WebSearch/WebFetch

[2-0] 도메인 키워드 추출
  주제에서 핵심 도메인 식별:
    예: "커피 주문 앱" → 푸드테크, 모바일 오더, F&B O2O
    예: "독서 기록 앱" → 독서 관리, 도서 추천, EdTech
  + 외부 자료(Step 1)와 인터뷰(Step 0)에서 추가 키워드 추출
  + 조사 필요 항목은 각각 어느 분석(도메인/경쟁사/트렌드)에서 답할지 배정

[2-1] 도메인 분석
  Read(.claude/skills/pre-research/references/domain-analysis-guide.md)

  조사 항목:
  - 도메인 핵심 용어 정의 (5~10개)
  - 비즈니스 규칙 / 도메인 룰
  - 규제 요건 (해당 시)
  - 일반적 비즈니스 모델
  - 데이터 규모 추정

  IF --no-web == false:
    TRY: WebSearch + WebFetch
      검색 키워드:
        - "{도메인} 시장 트렌드 {현재연도}"
        - "{도메인} 규제 한국"
        - "{도메인} 핵심 개념"
    ON FAIL: 일반 지식 + [일반 지식 폴백] 태그
  ELSE:
    일반 지식 + [일반 지식 폴백] 태그

  → Write({base}/02-domain.md)

[2-2] 경쟁사 분석
  Read(.claude/skills/pre-research/references/competitor-analysis-guide.md)

  경쟁사 수: light 3개 / standard 3~5개 / deep 5~7개+SWOT
  각 경쟁사: 서비스명, URL, 핵심 기능, 차별점, 약점, 타겟

  → Write({base}/03-competitors.md)

[2-3] 트렌드 분석
  Read(.claude/skills/pre-research/references/trend-analysis-guide.md)

  시장 트렌드 + 기술 트렌드 + 적용 판단

  → Write({base}/04-trends.md)

--focus 처리: 지정된 영역만 수행하고 나머지 스킵.
--depth light: 개별 파일 생략, Step 4에서 01-overview.md 하나로 통합.
```

**기능 제안 금지**: 조사 결과는 사실, 출처, 해석을 쓴다. "이 기능을 만들어야 한다"는 결론을 쓰지 않는다. 경쟁사에 있는 기능은 사실로만 기록하고, 요구사항이 될지는 인터뷰와 PRD에서 사용자가 정한다.

---

### Step 3 — 출처 정리

```
주체: Claude (직접 수행)

조사 중 수집한 모든 출처 + 외부 자료 출처를 통합 정리:

| # | URL/출처 | 타입 | 신뢰도 | 수집일 | 사용 위치 |
|---|---------|------|--------|--------|----------|

신뢰도: HIGH / MEDIUM / LOW / FALLBACK / INPUT(사용자 제공)

→ Write({base}/05-sources.md)
```

---

### Step 4 — 요약

```
주체: Claude (직접 수행)

01-overview.md 작성:

  # Research Overview: {주제}

  > 작성일: {YYYY-MM-DD}
  > 깊이: {depth}
  > 외부 자료: {N}건
  > 출처: WebSearch {N}건 / WebFetch {N}건 / 일반 지식 {N}건

  ## 핵심 인사이트
  1. {인사이트 1}
  2. {인사이트 2}
  3. {인사이트 3}

  ## 조사 필요 항목 대응   (인터뷰가 있을 때만)
  | 항목 | 결과 위치 | 결론 | 해소 여부 |
  |------|----------|------|-----------|
  | {인터뷰의 조사 필요 항목} | 02-domain.md | {1줄} | 해소 / 부분 / 미해소 |

  ## 프로세스 요약
  - 외부 자료: {수집 내용 요약}
  - 조사: {도메인/경쟁사/트렌드 요약}

  ## 산출물 목록
  - [02-domain.md](./02-domain.md)
  - [03-competitors.md](./03-competitors.md)
  - [04-trends.md](./04-trends.md)
  - [05-sources.md](./05-sources.md)

→ Write({base}/01-overview.md)

허브가 호출한 경우(인자에 "허브가 호출했다"가 있을 때): 아래 완료 배너와 다음 단계 안내를 출력하지 않는다. 한 줄(예: "조사를 마쳤다")만 쓰고 곧바로 `node scripts/gate.js status --json`을 실행해 허브의 다음 단계로 계속한다. 이 스킬의 완료는 작업 전체의 끝이 아니다.

완료 보고:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Research 완료: {주제}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  경로: {base}/
  도메인: {도메인명}  |  경쟁사: {N}개
  출처: {N}건  |  인사이트: {N}개
  조사 필요 항목: 해소 {a} / 부분 {b} / 미해소 {c}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  다음 단계:
  - 조사로 새로 알게 된 것을 인터뷰에 반영하려면: /interview --resume
  - 인터뷰가 끝났다면: prd-writer 로 PRD 작성
```

---

## depth별 동작 요약

| 항목 | light | standard | deep |
|------|-------|----------|------|
| 조사 출력 | 01-overview.md 통합 | 개별 파일 | 개별 파일 (심층) |
| 경쟁사 수 | 3개 간략 | 3~5개 | 5~7개 + SWOT |
| WebSearch 쿼리 | 3~5회 | 8~12회 | 15~20회 |

---

## 외부 자료 등록

```
사용자가 외부 자료를 넣는 3가지 방법:

1. 사전 등록 (스킬 실행 전)
   → <프로젝트>/docs/02-research/inputs/ 에 파일 복사
   → /pre-research 실행 시 Step 1에서 자동 감지

2. 실행 중 등록 (Step 1)
   → AskUserQuestion에서 "파일/URL 추가 입력" 선택
   → 파일 경로 또는 URL 입력

3. 보강 모드 (스킬 재실행)
   → inputs/에 파일 추가 후 /pre-research 재실행
   → "보강" 선택 → 새 자료 포함하여 갱신

지원 형식:
  - 마크다운, 텍스트, PDF
  - 이미지 (와이어프레임, 스크린샷 — 시각 분석)
  - URL (WebFetch로 수집)
```

---

## 보강 모드

기존 `{base}/01-overview.md` 발견 시 "보강" 선택:

```
기존 모든 산출물 Read → 보강 베이스로 활용

진입 지점 선택:
  - 새 외부 자료 추가 → Step 1부터
  - 조사 업데이트 → Step 2부터

보강 시:
  - 기존 내용 유지 + 변경분 추가
  - 01-overview.md에 "보강일: {YYYY-MM-DD}" 추가
  - 변경된 항목에 [보강] 태그
```

---

## 에러 처리

| 시나리오 | 처리 |
|---------|------|
| WebSearch 전체 실패 | 일반 지식 폴백 + 경고 |
| WebFetch URL 실패 | 해당 URL 스킵 + 나머지 진행 |
| 외부 자료 Read 실패 | 해당 파일 스킵 + 경고 |
| `--no-web` 활성 | 일반 지식 분석 + [일반 지식 폴백] 태그 |
| 인터뷰 파일 파싱 실패 | 경고 후 일반 조사로 진행 |
| Write 실패 | 즉시 중단 + 에러 표시 |
| "취소" 선택 | 즉시 종료, 기존 파일 보존 |

**공통 원칙**: 어떤 실패든 기존 산출물을 삭제하지 않는다.

---

## 다른 스킬과의 관계 (옵셔널 참조)

```
interview ──조사 필요 항목──▶ pre-research ──조사 결과──▶ interview (보강)
                                  └─────────────────▶ prd-writer (옵셔널 입력)

- pre-research 는 docs/01-interview/interview.md 의 '조사 필요 항목'을 조사의 초점으로 삼는다(없어도 동작).
- interview 는 docs/02-research/*.md 를 사전 자료로 읽는다(없어도 동작).
- prd-writer 는 docs/02-research/*.md 를 옵셔널 입력으로 읽는다.
- 어떤 스킬도 /pre-research 산출물에 의존하지 않는다. 있으면 품질이 올라갈 뿐이다.
```

---

## 참고

- `references/domain-analysis-guide.md` — 도메인 분석 절차 + 출력 형식
- `references/competitor-analysis-guide.md` — 경쟁사 분석 절차 + 출력 형식
- `references/trend-analysis-guide.md` — 트렌드 분석 절차 + 출력 형식
