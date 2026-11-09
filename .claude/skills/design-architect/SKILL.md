---
name: design-architect
description: 설계 전용 스킬. 요구사항(spec.md)을 입력으로 받아 기술 스택, 데이터 모델(ERD)·API 설계, UI/UX(시각 와이어프레임 포함), 아키텍처, 파일 맵, 구현 작업 Task 목록을 생성한다. 모든 요구사항이 Task로 커버되는지 누락 검증한다. spec-planner의 spec.md를 옵셔널 입력으로 활용하되 없으면 단독 동작한다. 사용 시점 — (1) "설계해줘/아키텍처 짜줘/기술스택 정해줘/ERD 그려줘", (2) spec.md를 ERD·API·화면·파일구조·작업목록으로 구체화, (3) 기존 설계 수정.
---

# /design-architect — 설계 (기술스택 · 데이터/API · UI/UX · 아키텍처 · 파일맵 · 작업Task)

요구사항을 받아 빈틈 없는 설계 산출물을 단계별로 생성하고, **모든 요구사항이 구현 Task로 커버되는지 검증**한다.

**독립 스킬**: 에이전트·템플릿은 이 스킬 폴더 안에 자체 포함(`references/`)되어 있으며 다른 스킬 폴더를 참조하지 않는다.

**입력은 옵셔널 참조, 출력은 프로젝트 로컬.** spec.md가 있으면 활용하고, 없으면 사용자 요구사항으로 단독 동작한다.

**철학: 속도보다 완전성.** 단계별 전용 에이전트 + 단계별 사용자 확인으로 기획·설계의 빈틈을 최대한 잡는다.

---

## 트리거

```
/design-architect [수정 지시]
```

| 형태 | 동작 |
|------|------|
| `/design-architect` | 입력 감지 → 신규 설계 (기존 설계 발견 시 모드 선택) |
| `/design-architect [수정 지시]` | 기존 설계를 영향 범위만 재실행 |

---

## 산출물 경로 (docs/05-design/)

```
docs/05-design/
├── requirement-sketch.md  # Step 0: (spec 없을 때만) 최소 요구사항 골격
├── 01-tech-stack.md       # Step 1: 기술 스택
├── 02-data-model.md       # Step 2: 논리 ERD + 스키마
├── 03-api-spec.md         # Step 2: API/데이터 접근 인터페이스
├── 04-ui-spec.md          # Step 3: UI/UX 설계
├── _variants/          # Step 3-0b: 화면 시안 비교 기록 (하네스 기록, 승인 대상 아님)
│   ├── directions.md   #   축 비교와 시안 설명
│   ├── V-A-SCR-xxx.svg #   시안 화면
│   └── choice.md       #   사용자가 고른 시안과 기각 사유 (선택 결과는 04-ui-spec.md 로 올라간다)
├── wireframes/         # Step 3: 화면별 시각 와이어프레임 (SVG)
│   └── SCR-xxx.svg
├── 05-architecture.md     # Step 4: 아키텍처 + 디렉토리 구조
├── 06-file-map.md         # Step 5: Wave별 파일 맵
├── 07-test-plan.md        # Step 5-T: 시험 계획 (인수 기준 → 시험 시나리오 TC)
└── 08-tasks.md            # Step 6: 구현 작업 Task(담당 TC 포함) + 커버리지 검증
```

> 입력 spec은 `docs/04-spec/spec.md`(spec-planner 산출물)를 우선 사용.

---

## 번들 리소스 (자체 포함)

```
references/
├── agents/
│   ├── tech-researcher.md          # Step 1
│   ├── data-api-designer.md        # Step 2
│   ├── ui-designer.md              # Step 3
│   ├── architecture-designer.md    # Step 4
│   ├── file-mapper.md              # Step 5
│   └── task-planner.md             # Step 6
│   (Step 5-T 는 역할 카드 .claude/agents/design-test.md 를 그대로 쓴다)
└── templates/
    ├── architecture-template.md    # 05-architecture.md + 06-file-map.md
    ├── data-model-template.md      # 02-data-model.md + 03-api-spec.md
    ├── test-plan-template.md       # 07-test-plan.md
    ├── tasks-template.md           # 08-tasks.md
    ├── ui-spec-template.md         # 04-ui-spec.md
    └── ui-checklist-{mobile,webapp,web}.md
```

각 Task 호출 시 해당 에이전트/템플릿을 Read하여 프롬프트에 인라인 주입한다.

---

## 워크플로우

> 각 Step은 sonnet 서브에이전트가 산출물을 생성한다. 사용자 확인은 부담을 줄이려고 **4곳에서 묶어서** 받는다: ① Step 1 끝(기술 스택 **후보를 보고 고른다**) ② Step 3 시작(화면 **시안을 보고 고른다**, 화면이 있을 때) ③ Step 2~3 끝(예/조정) ④ Step 4~6 끝(예/조정). 각 Step의 `확인:` 줄은 그 묶음의 확인 화면에 요약을 더하라는 뜻이다.
> "조정" 선택 시 피드백을 수집해 해당 산출물을 갱신한 뒤 다음 Step으로 진행한다.

### Step 0 — 입력 감지 + 모드 판정

```
[0-1] 요구사항 입력 감지 (우선순위)
  docs/04-spec/spec.md → 없음
  존재 시: spec_content = Read(해당 파일), "요구사항 입력 감지: {경로}", has_spec = true
  없음:    사용자 설명을 raw_input으로. 부실하면 핵심 3개 질문(목적/핵심기능/플랫폼/규모). has_spec = false
           (정형 명세가 필요하면 /spec-planner 선행 권장 — 강제 아님)

[0-1b] 최소 요구사항 스케치 (has_spec == false 일 때만 — 독립 동작 보강)
  목적: 정형 spec이 없어도 설계·누락 검증이 작동하도록 "설계가 돌아갈 최소 골격"을 자체 확보.
        (spec-planner의 완전 정형 명세를 대체하지 않음 — 최소 골격만)
  raw_input + (필요 시 WebSearch 도메인 파악)으로 가볍게 도출:
    - 핵심 기능 후보 → 임시 FR ID (FR-001…)
    - 주요 엔티티 후보, 주요 화면 후보 → 임시 SCR ID
    - 명시적/추론 NFR·제약 (있으면)
  → Write(docs/05-design/requirement-sketch.md)  (임시 ID 출처 명시 + "[스케치]" 태그)
  → spec_content = requirement-sketch.md 내용 (이후 모든 Step의 요구사항 입력으로 사용)
  안내: "정형 명세가 없어 최소 요구사항 스케치를 생성했습니다. 더 엄밀히 하려면 /spec-planner 권장."

  has_spec == true 이면 이 단계 생략 (spec_content 그대로 사용).

[0-2] mkdir -p docs/05-design docs/05-design/wireframes

[0-3] 모드 판정
  IF docs/05-design/05-architecture.md 존재:
    AskUserQuestion(["수정 모드 (영향 범위만)", "재설계 (전체)", "취소"])
    취소→종료 / 수정→수정 모드 절차 / 재설계→백업 후 Step 1부터
  ELSE: 신규 → Step 1
```

---

### Step 1 — 기술 스택  (agent: tech-researcher)

```
Task(general-purpose, sonnet, prompt:
  {Read(.claude/skills/design-architect/references/agents/tech-researcher.md)}
  요구사항: {spec_content}
  → NFR·CON(플랫폼/규제)이 기술 선택에 미치는 영향 반영. 사용자 지정 제약 최우선. WebSearch 활용.
  → 모든 기술/패키지에 **정확한 핀 버전** 명시("latest" 금지).
  → **환경/빌드/실행 가이드**(런타임 버전·초기화·설치·빌드·실행·테스트·린트·env·CI) 필수 작성.
  → **`후보 비교` 섹션 필수**(후보 2~3개, 선택 1개, 탈락 사유. 요구를 못 맞추는 허수 후보 금지. 형식은 tech-researcher.md). 게이트 VAL-21.)
→ Write(docs/05-design/01-tech-stack.md)
확인: 기술 스택 후보 화면 (형식: .claude/skills/discover-to-design/references/screens.md "기술 스택 후보 화면")
  AskUserQuestion — 추천안으로 / 다른 후보로 / 조건을 더해 다시
  - 팀이 아는 기술·배포 환경·운영 부담·기존 시스템처럼 명세에 없어 후보 판단이 갈리는 것은 이 화면에서 후보와 함께 구체적으로 묻는다 (생성 전에 미리 묻지 않는다)
  - "다른 후보로" → 같은 Task 를 "후보 X로 확정"과 함께 다시 실행해 문서를 다시 쓴다 (`선택` 칸이 바뀐다)
  - "조건을 더해 다시" → 사용자가 말한 조건을 넣어 다시 실행. 다시 만들기는 합쳐서 1회로 제한한다. 그 뒤에는 그대로 진행
```

---

### Step 2 — 데이터 모델 + API 설계  (agent: data-api-designer)

```
Task(general-purpose, sonnet, prompt:
  {Read(.claude/skills/design-architect/references/agents/data-api-designer.md)}
  요구사항: {spec_content}
  기술 스택: {Read(docs/05-design/01-tech-stack.md)}
  → spec의 데이터 모델(개념)·도메인 규칙·상태 전이·외부 시스템 카탈로그를
    논리 ERD + API/인터페이스로 구체화.
  템플릿: {Read(contracts/templates/design/data-model-template.md)})
→ Write(docs/05-design/02-data-model.md)
→ Write(docs/05-design/03-api-spec.md)
확인: 요약(엔티티 N개, API/인터페이스 N개) → "데이터/API 설계 확인?" (예/조정)
```

---

### Step 3 — UI/UX + 와이어프레임  (agent: ui-designer + 와이어프레임 생성)

```
[3-0] 플랫폼 판별 (spec_content + tech-stack)
  모바일계열 → ui-checklist-mobile / 대시보드·어드민·웹앱 → ui-checklist-webapp / 그 외 → ui-checklist-web

[3-0b] 시안 단계 (명세에 SCR 이 있을 때. 화면이 없으면 생략)
  목적: 디자인 방향을 하나만 정해 보여 주지 않고, 서로 다른 시안을 두고 사용자가 고르게 한다.

  ① 취향 질문 (AskUserQuestion 2문항, 건너뛰기 허용. 형식: .claude/skills/discover-to-design/references/screens.md "시안 선택 화면"의 취향 질문)
     - 좋아하는 서비스·사이트 1~3개(이름이나 링크)와 싫어하는 느낌 한 줄
     - 이 서비스를 쓸 때 느꼈으면 하는 분위기 (차분 / 활기 / 전문적 / 친근 / 직접 입력)
     건너뛰면 PRD 의 타겟 사용자와 서비스 성격만으로 방향을 고른다.
  ② 시안 생성
     Task(general-purpose, sonnet, prompt:
       {Read(.claude/agents/design-ui-direction.md)의 본문 (머리 --- 블록 제외)}
       호출: 오케스트레이터 design-architect. 시안 수: {화면 3개 이하면 2, 아니면 3}. 취향 답변: {①의 답}.
       사용자 참고 자료: {있으면}. 산출물 docs/05-design/_variants/ 만 쓴다.)
     → docs/05-design/_variants/directions.md, V-A-SCR-NNN.svg …
  ③ 시안 선택 (형식: .claude/skills/discover-to-design/references/screens.md "시안 선택 화면"): 시안별 이름·한 줄·잘 맞는 곳·대가와 파일 경로를 보이고
     AskUserQuestion — 하나 고르기 / 조합(예: A 의 색 + B 의 구성) / 전부 기각(이유) / 취향을 바꿔 다시
     - 추천은 하지 않는다 (역할이 `결정 필요`에 올린 추천이 있으면 하나만 이유와 함께 덧붙인다)
     - "취향을 바꿔 다시"와 "전부 기각"은 합쳐서 1회까지만 시안을 다시 만든다. 그 뒤에는 남은 시안에서 고른다
  ④ 선택 기록: Write(docs/05-design/_variants/choice.md) — 아래 형식. 기각한 시안과 사유도 남긴다 (같은 논의 반복 방지)
       # 시안 선택
       > 작성일: YYYY-MM-DD
       - 선택: V-A (조합이면 "V-A의 글자·색 + V-B의 구성")
       - 기각: V-B (사유), V-C (사유)
       - 사용자 메모: {있으면}

[3-1] UI 설계
  Task(general-purpose, sonnet, prompt:
    {Read(.claude/skills/design-architect/references/agents/ui-designer.md)}
    플랫폼: {platform}
    요구사항: {spec_content}  / 기술스택: {Read(docs/05-design/01-tech-stack.md)}
    사용자 여정: {docs/04-spec/notes/user-journeys.md 있으면 Read, 없으면 "없음"}
    시안 선택: {Read(docs/05-design/_variants/choice.md)}  / 시안 설명: {Read(docs/05-design/_variants/directions.md)}  (3-0b 를 했을 때. 안 했으면 "없음")
    AI 티 규칙: {Read(contracts/design/anti-slop.md)}
    체크리스트: {Read(contracts/templates/design/ui-checklist-{platform}.md)}
    → WebSearch 5회+ 트렌드/벤치마킹, 디자인시스템 선택, 화면을 SCR/FR과 1:1 매핑,
      체크리스트 각 항목 "결정+근거", 플랫폼 부적합 패턴 금지.
    → 시안 선택이 있으면 **디자인 방향을 새로 정하지 않고 선택을 따른다.** `디자인 방향`에 선택·기각 줄을 옮기고,
      `디자인 토큰` 표(색·글꼴·글자 크기·간격·모서리·움직임)와 화면마다 `시선 위계`를 쓴다.
    템플릿: {Read(contracts/templates/design/ui-spec-template.md)})
  → Write(docs/05-design/04-ui-spec.md)

[3-2] 시각 와이어프레임 생성 (주체: Claude 직접)
  04-ui-spec.md의 주요 화면(SCR)마다 저충실도 SVG 와이어프레임을 생성:
    - 레이아웃/영역/주요 컴포넌트 배치를 박스+레이블로 표현 (플랫폼 비율 반영)
    - 파일: Write(docs/05-design/wireframes/{SCR-ID}.svg)
  최소 P0 화면 전부 + 핵심 P1 화면.

확인: "UI/UX 방향 + 와이어프레임 {N}장 확인?" (예/조정)
```

---

### Step 4 — 아키텍처  (agent: architecture-designer)

```
Task(general-purpose, sonnet, prompt:
  {Read(.claude/skills/design-architect/references/agents/architecture-designer.md)}
  요구사항: {spec_content}
  기술스택: {Read(docs/05-design/01-tech-stack.md)}
  데이터/API: {Read(docs/05-design/02-data-model.md)} {Read(docs/05-design/03-api-spec.md)}
  UI 설계: {Read(docs/05-design/04-ui-spec.md) 있으면, 없으면 "추론"}
  → 패턴+근거, 레이어별 컴포넌트(책임/의존/인터페이스), 데이터 흐름, NFR 대응, ADR,
    디렉토리 구조(tree), 코딩 스타일(아래 기본 원칙 + spec 사용자 지정 병합).
  ## 기본 코딩 원칙: 불필요한 추상화 금지(3회 미만 인라인)/단일책임 50줄/의도 드러나는 명명/
     주석은 "왜"만/프레임워크 관례 우선/유틸은 2곳+에서만 분리/중첩 3단계 이내/매직넘버 금지
  템플릿: {Read(contracts/templates/design/architecture-template.md)})
→ Write(docs/05-design/05-architecture.md)
확인: 요약(패턴, 컴포넌트 N, ADR N) → "아키텍처 확인?" (예/조정)
```

---

### Step 5 — File Map  (agent: file-mapper)

```
Task(general-purpose, sonnet, prompt:
  {Read(.claude/skills/design-architect/references/agents/file-mapper.md)}
  요구사항: {spec_content}
  아키텍처: {Read(docs/05-design/05-architecture.md)}
  데이터/API: {Read(docs/05-design/02-data-model.md)} {Read(docs/05-design/03-api-spec.md)}
  UI 설계: {Read(docs/05-design/04-ui-spec.md) 있으면, 없으면 "없음"}
  기술스택: {Read(docs/05-design/01-tech-stack.md)}
  → Wave별 파일(의존성 기반, 순환 금지), 파일별 상세(목적/export/관련 FR/예상 LOC≤300),
    UI 컴포넌트 파일, 테스트 파일 계획, Directory Structure.
  템플릿: {Read(contracts/templates/design/architecture-template.md)의 "## 06-file-map.md 템플릿" 섹션})
→ Write(docs/05-design/06-file-map.md)

[5-B] 경로 안전성 검증
  모든 경로에 "../"·절대경로·node_modules/·.git/ 금지. 위반 시 06-file-map.md 수정.

확인: "총 {N}개 파일, {N}개 Wave" → "파일 구성 확인?" (예/조정)
```

---

### Step 5-T — 시험 계획  (agent: design-test 역할 카드)

```
Task(general-purpose, sonnet, prompt:
  {Read(.claude/agents/design-test.md)의 본문 (머리 --- 블록 제외)}
  호출: 오케스트레이터 design-architect. 산출물 docs/05-design/07-test-plan.md 하나만 쓴다.)
→ docs/05-design/07-test-plan.md

[5-T-B] 덮임 확인 (주체: Claude 직접)
  명세의 모든 AC-NNN 이 어떤 TC 의 '근거'에 있는지, TC 의 '실행' 값이 cli/browser/device/manual 이고
  manual 이 아닌 실행 위치가 01-tech-stack.md 의 '시험 환경' 표와 '명령' 표(실행 위치 열)에 있는지, manual TC 마다 '수동 사유'가 있는지 본다
  (게이트 REF-09·VAL-14·VAL-15 와 같은 기준). 설계 폴더에 문서 외의 파일·폴더가 생기지 않았는지도 본다 (FMT-05).
  빠지면 같은 에이전트에 보강 요청 (최대 1회). 시험 환경 표에 없는 실행 위치가 필요하면 Step 1 산출물 수정 대상으로 사용자에게 올린다.

확인: Step 6 확인 화면에 "시험 시나리오 {N}개 (자동 {n} / 수동 {n} — 수동 사유 한 줄씩), 인수 기준 {n}/{N} 덮음"을 함께 보여 준다.
```

---

### Step 6 — 구현 작업 Task + 커버리지 검증  (agent: task-planner)

```
Task(general-purpose, sonnet, prompt:
  {Read(.claude/skills/design-architect/references/agents/task-planner.md)}
  요구사항: {spec_content}
  설계: {Read(docs/05-design/05-architecture.md)} {Read(docs/05-design/06-file-map.md)} {Read(docs/05-design/02-data-model.md)} {Read(docs/05-design/03-api-spec.md)} {Read(docs/05-design/04-ui-spec.md)}
  시험 계획: {Read(docs/05-design/07-test-plan.md)}
  → 요구사항·설계를 의존성 순서의 체크박스 Task로 분해.
    각 Task에 covers(FR/SCR/NFR/UC)·deps·file/data/api·check(담당 TC) 매핑. manual 이 아닌 TC 는 모두 어떤 Task 의 check 에.
    file-map의 Wave 순서를 정렬 축으로 사용.
    끝에 "요구사항 커버리지 점검표" 작성 — 모든 P0가 1개+ Task에 매핑, 미매핑은 ⚠️ 누락 표시.
  템플릿: {Read(contracts/templates/design/tasks-template.md)})
→ Write(docs/05-design/08-tasks.md)

[6-B] 누락 검증 (주체: Claude 직접 — 결정적 교차 점검)
  요구사항 ID 출처 = spec_content (정형 spec 또는 Step 0-1b 요구사항 스케치).
  모든 FR/SCR/NFR/UC ID를 추출 → 08-tasks.md covers와 대조.
  매핑 안 된 요구사항이 있으면:
    → 사용자에게 보고: "다음 요구사항이 어떤 Task에도 없음: {목록}"
    → task-planner에 보강 요청(Task 추가) 또는 "범위 제외" 명시
  모든 P0 커버 확인될 때까지 반복(최대 2회).

확인: "Task {N}개, 커버리지 {FR n/N}, 누락 {n}건" → "작업 목록 확인?" (예/조정)
```

---

### Step 7 — 통합 검증 (주체: Claude 직접)

```
Read: spec(또는 입력) + tech-stack + data-model + api-spec + ui-spec + architecture + file-map + test-plan + tasks

[7-A] 요구사항 커버리지·실현 가능성
  1. P0 FR → architecture 컴포넌트 매핑
  2. NFR 대응 설계 존재
  3. tasks 커버리지: 모든 P0 요구사항이 Task로 커버 (Step 6-B 재확인)
  4. 파일 단일 책임 / Wave 순환 없음 / LOC≤300 / Directory와 경로 일치 / Wave 순서=의존성

[7-B] 교차 산출물 일관성 (이름·개수 단위 결정적 대조)
  설계 산출물 간 식별자를 추출해 1:1 대조하고 불일치를 표로 리포트:
  1. data-model 엔티티명 집합 == api-spec이 참조하는 엔티티명 집합 (누락/오타/유령 탐지)
  2. api-spec 인터페이스/엔드포인트 == file-map의 해당 파일 export 목록
  3. architecture 컴포넌트 == file-map 파일 (1:1, 고아 컴포넌트/파일 탐지)
  4. ui-spec 화면(SCR) == wireframes/{SCR}.svg 파일 == file-map UI 컴포넌트
  5. tasks의 covers ID == spec/스케치의 실제 ID (유령 ID 탐지)
  6. tasks의 check TC == test-plan 의 TC, manual 이 아닌 TC 는 모두 어떤 Task 에 (REF-10)
  → 불일치 발견 시: 해당 산출물 수정 후 재대조.

각 산출물 "## 검증 기록"에 [7-A]/[7-B] 결과 기록.
CRITICAL 발견 시 유형별 재실행 (최대 2회):
  데이터/API → Step 2+4+5+6 / UI → Step 3+4+5+6 /
  아키텍처 → Step 4+5+5-T+6 / 파일맵 → Step 5+5-T+6 / 시험 누락 → Step 5-T+6 / Task 누락 → Step 6
```

---

### Step 8 — 다관점 병렬 리뷰 (1회)

```
주체: Claude(오케스트레이션) + 서브에이전트 3인 병렬 (sonnet)
처리 규칙: contracts/review-handling.md — 지적의 유형이 처리 권한을 정한다. 리뷰어 수(합의)는 검토 순서에만 쓴다.

[8-A] 리뷰 실행
  한 메시지에서 Task × 3 동시 발사. 각 리뷰어에 전체 설계 산출물을 전달:

    Task(general-purpose, sonnet, prompt:
      {Read(contracts/reviewers/design-consistency.md)}
      검토 대상: {tech-stack + data-model + api-spec + ui-spec + architecture + file-map + test-plan + tasks + spec/스케치}
      지침의 JSON 형식 그대로, JSON 만 docs/05-design/_review/consistency.json 에 쓴다.)
    Task(... contracts/reviewers/design-feasibility.md → docs/05-design/_review/feasibility.json ...)
    Task(... contracts/reviewers/design-risk.md → docs/05-design/_review/risk.json ...)

  - 리뷰어가 파일을 못 썼으면 응답의 JSON 을 오케스트레이터가 같은 파일에 저장한다. JSON 이 아니면 그 리뷰어는 실패다.
  - 실패한 리뷰어는 경고 후 제외, ≤1 성공 시 사용자 확인.

[8-B] 분류 (주체: Claude 직접)
  모든 지적을 contracts/review-handling.md 의 표로 분류한다: 불일치 / 구현 / 요구·정책 / 선호.
  - 같은 target 을 여러 리뷰어가 짚었으면 합의 수가 많은 순서로 본다. 합의 수는 권한이 아니다.
  - 판단이 모호하면(어느 쪽이 기준인지 불분명, 사용자가 확인한 선택을 건드림) 요구·정책으로 본다.
  - 명백한 오해는 기각한다 (근거: 어느 문서의 어디를 보면 되는지).

[8-C] 처리
  - 불일치·구현 → 근거를 적고 수정한다. 수정을 에이전트 하나에게 맡겨도 되지만 지적 ID 별로
    "어느 문서의 어디를 어떻게 바꿨는지" 목록을 돌려받는다 (목록 없는 수정은 받지 않는다).
  - 요구·정책 → 모아서 사용자에게 한 번에 묻는다 (AskUserQuestion, 한 묶음 최대 4개, 넘치면 심각도·영향 순,
    나머지는 기록). 선택지: 수정 적용 / 그대로 둔다(기록) / 기각. 명세를 바꾸는 결정이면 허브의 "명세가 바뀌는 결정"을 따른다.
  - 선호 → 기록만. 수정하지 않는다.
  - CRITICAL 은 유형과 관계없이 반드시 닫는다 (수정 / 기각+근거 / 사용자 결정).

[8-D] 기록
  docs/05-design/_review/resolution.md 에 지적마다 한 행 (이슈 | 유형 | 처리 | 근거) — 형식은 contracts/review-handling.md.
  각 산출물 "## 검증 기록"에는 요약 한 줄과 resolution.md 경로만 둔다.
  수정했으면 node scripts/gate.js design 을 돌리고 영향 시 Step 7 [7-B] 재대조. CRITICAL 을 수정으로 닫았으면 해당 관점 재확인을 권한다.

루프 방지: 리뷰는 1회만. (사용자가 명시 요청 시에만 1회 추가, 총 2회 한도)
```

---

### Step 9 — 개발 진입점 인덱스 + 출력 요약

```
[9-A] 개발 진입점 인덱스 생성 (주체: Claude 직접)
  docs/05-design/README.md 작성 — 개발자가 "무엇을 먼저 보는지" 한눈에:
    - spec(무엇/왜) vs design(어떻게) 구분
    - 개발 시 보는 순서: tech-stack(셋업) → tasks(메인 지시서) → 각 Task 구현 시 file-map, 담당 TC(test-plan), data-model/api-spec/architecture/ui-spec 참조
    - 산출물 목록 표(파일/내용/주 사용 시점)
    - 구현 흐름 예시 1건 + 미해결 잔존 사항
  → Write(docs/05-design/README.md)

[9-B] 요약 표시
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  설계 완료
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • tech-stack: {언어}+{프레임워크}
  • data-model: 엔티티 {N}개  |  api-spec: {N}개 인터페이스
  • ui-spec: 화면 {N}개 + 와이어프레임 {N}장, 디자인시스템 {이름}
  • architecture: {패턴}, 컴포넌트 {N}, ADR {N}
  • file-map: {N}개 파일, {N}개 Wave
  • test-plan: 시험 시나리오 {N}개 (자동 {n} / 수동 {n}) · 인수 기준 {n}/{N} 덮음
  • tasks: {N}개 Task / 커버리지 FR {n}/{N} · 누락 {n}건
  • 다관점 리뷰: 지적 {n}건 — 수정 {n} / 사용자 결정 {n} / 기록 {n} / 기각 {n} (docs/05-design/_review/resolution.md)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  산출 경로: docs/05-design/ (진입점: README.md)
  다음 단계: 설계 승인 → 구현 (README.md → tech-stack 셋업 → 08-tasks.md Wave 순서, Task마다 담당 TC 테스트). 08-tasks.md 체크박스는 승인 대상이라 바꾸지 않는다
```

---

## 수정 모드

`/design-architect [수정 지시]` + 기존 `docs/05-design/05-architecture.md` 존재 시, 영향 범위만 최소 재실행:

```
기술스택 변경  → Step 1→2→3→4→5→5-T→6→7→8→9
데이터/API 변경 → Step 2→4→5→5-T→6→7→8→9
UI 변경        → Step 3→4→5→5-T→6→7→8→9  (시안 선택을 바꾸려면 3-0b 부터. 시안 선택이 바뀌면 와이어프레임도 다시 만든다)
아키텍처 변경  → Step 4→5→5-T→6→7→8→9
파일구조 변경  → Step 5→5-T→6→7→8→9
시험 계획 변경 → Step 5-T→6→7→9
Task만 갱신    → Step 6→7→9 (다관점 리뷰 Step 8은 설계 변경 시에만)

기존 산출물은 갱신(백업 권장). 삭제는 사용자 확인 후에만.
요구사항 변경 시 Step 5-T(인수 기준 덮임)와 Step 6 커버리지 검증을 반드시 다시 수행.
```

---

## 에러 처리

| 시나리오 | 처리 |
|---------|------|
| spec/prd 입력 없음 | 사용자 설명으로 단독 진행 (부실 시 핵심 3개 질문) |
| 에이전트 실패 (tech/ui) | 사용자 지정/기존값 사용, ui 실패 시 ui-spec 스킵 |
| 에이전트 실패 (data-api/architecture/file-mapper/task) | 오류 보고 후 중단 (기존 산출물 보존) |
| WebSearch 실패 | 기본 패턴으로 진행 |
| 경로 안전성 위반 | 06-file-map.md 자동 수정 |
| 요구사항 커버리지 누락 | 사용자 보고 + Task 보강 또는 범위 제외 명시 (P0는 반드시 해소) |
| 교차 산출물 불일치(Step 7-B) | 해당 산출물 수정 후 재대조 |
| 다관점 리뷰어 실패 | 1~2인 실패 시 경고 후 진행, ≤1인 성공 시 사용자 확인(재시도/진행/스킵) |
| 검증 CRITICAL | 유형별 재실행 (최대 2회) |

**공통 원칙**: 어떤 실패든 `docs/05-design/` 기존 산출물을 삭제하지 않는다.

---

## 다른 스킬과의 관계 (옵셔널 참조)

```
interview → prd-writer → prd.md → spec-planner → spec.md → design-architect → docs/05-design/*

- design-architect는 docs/04-spec/spec.md를 옵셔널 입력으로 받는다(없어도 동작).
- 08-tasks.md는 구현 단계에서 진행 체크 + 요구사항 누락 검증의 기준이 된다.
```
