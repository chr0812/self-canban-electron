# Review Integration Rules

4-페르소나 병렬 리뷰 결과를 통합하여 spec.md를 갱신하는 알고리즘.

## 적용 시점

Step 5 Phase C에서 호출. Phase B(4-페르소나 병렬 Task)가 완료된 직후.

## 입력

4개 페르소나의 JSON 출력:
- critical_review (CR-NNN)
- technical_review (TR-NNN)
- user_review (UA-NNN)
- business_review (BR-NNN)

각 출력은 공통 스키마 (각 reviewer .md 참조):
```json
{
  "persona": "...",
  "verdict": "ACCEPT | REVISE | MAJOR_ISSUES",
  "summary": "...",
  "issues": [...],
  "metrics": {...}
}
```

---

## Step 1: 수집 (실패 처리)

```
Task 4개의 응답 상태 확인:
  4/4 성공 → 정상 진행
  3/4 성공 → 사용자에게 경고 표시:
    "⚠ {실패한 페르소나명} 리뷰 실패. 3개 결과로 진행"
    → 진행
  ≤ 2/4 성공 → AskUserQuestion:
    "{성공한 페르소나 N개}만 성공. 다음 중 선택:
      - 재시도 (4개 모두 다시)
      - 그대로 진행 (성공한 결과만 사용)
      - 중단"
    → 사용자 응답에 따라 분기
```

응답 파싱 실패도 "실패한 페르소나"로 간주.

---

## Step 2: 그룹화

모든 issue를 `target_ref` 기준으로 그룹화.

```
all_issues = []
for review in [cr, tr, ua, br]:
  for issue in review.issues:
    issue.source_persona = review.persona
    all_issues.append(issue)

groups = group_by(all_issues, key="target_ref")
```

### target_ref 정규화

다음은 같은 target으로 간주:
- `"FR-003"` ≡ `"FR-003 (오류 처리)"` → 정규식으로 ID만 추출
- `"NFR-002"` ≡ `"NFR-002 (보안)"`
- `"(전체)"` ≡ `"(Whole)"` ≡ `""` → 별도 "전반" 그룹

다른 target은 별도 그룹:
- `"FR-003"` ≠ `"FR-004"`
- `"FR-003"` ≠ `"Section 4 (NFR)"`

---

## Step 3: Consensus Score 계산

```
for group in groups:
  group.consensus_score = count_unique(issue.source_persona for issue in group)
  # 1: 단독 의견
  # 2: 합의
  # 3+: 강한 합의
```

같은 페르소나가 동일 target에 여러 이슈를 올렸어도 consensus_score는 1로 계산.

---

## Step 4: Effective Severity 산출

그룹 내 최고 severity로 통합:

```
severity_rank = {"CRITICAL": 3, "WARN": 2, "INFO": 1}

for group in groups:
  group.effective_severity = max(issue.severity for issue in group)
```

---

## Step 5: 처리 분기

처리 권한은 **지적의 유형**이 정한다 (`contracts/review-handling.md`). 합의 수(Step 3)는 검토 순서에만 쓰고 권한을 주지 않는다.

먼저 모든 그룹을 유형으로 분류한다. 명세에서의 뜻:

| 유형 | 명세에서의 예 | 처리 |
|------|---------------|------|
| 불일치 | 명세 안의 모순, ID·이름 오기, PRD·인터뷰(사용자가 확인한 기준)와 다른 곳 | **자동 수정** (기준 문서를 따른다) |
| 구현 | 사용자가 말한 범위 안에서 표현을 구체화(NFR 수치, 빠진 필드) | 근거를 적고 **자동 수정** |
| 요구·정책 | 기능·화면·유스케이스 추가·삭제, 우선순위·범위 변경, **사용자가 말하지 않은 새 요구 제안**, 정책 | **AskUserQuestion** (모아서 한 번에, 최대 4개, 넘치면 심각도·영향 순, 나머지는 "기록만") |
| 선호 | 권장·취향 | `## 검증 기록`에 "권장사항"으로 기록, 수정하지 않음 |
| (오해) | 존재하는 항목을 없다고 함 등 | **기각** (사유 기록) |

- CRITICAL 은 유형과 관계없이 반드시 닫는다 (수정 / 기각+사유 / 사용자 결정).
- 판단이 모호하면 요구·정책으로 본다.
- 단독 지적이라는 이유로 사용자에게 묻지 않고, 합의가 많다는 이유로 사용자 몫을 대신 정하지 않는다.

### 요구·정책 지적 처리 (사용자 질문)

```
AskUserQuestion 형식 예시:
  Q. {페르소나명} 검토자가 다음 항목을 지적했습니다. 어떻게 처리할까요?
     "{issue.description}"
     제안: "{issue.suggestion}"

     옵션:
       - 수정 적용
       - 기록만 (## 검증 기록에 noted, CAND 후보로 남길 수 있다)
       - 기각 (## 검증 기록에 rejected, 사유 입력)
```

---

## Step 6: spec.md 자동 수정

자동 수정 대상 (유형이 불일치·구현인 지적, 그리고 사용자가 "수정 적용"을 고른 요구·정책 지적):

```
for group in auto_fix_groups:
  최고 severity issue의 suggestion 적용 (또는 합치/요약)
  spec.md의 해당 target 부분 수정
    - FR-003 → ## 기능 요구사항 섹션의 FR-003 항목 수정
    - NFR-002 → ## 비기능 요구사항 섹션의 NFR-002 항목 수정
    - (전체) → 적절한 위치에 추가
```

수정 규칙:
- 기존 ID 유지 (텍스트만 변경)
- 새 항목 추가 시 max ID + 1 (Step 3 ID 충돌 회피 규칙 적용)
- 삭제는 자동으로 하지 않음 — 항상 사용자 확인

---

## Step 7: ## 검증 기록 섹션 작성

```markdown
## 검증 기록

### Run {YYYY-MM-DD HH:mm}

**리뷰 요약**
- Critical Reviewer: {verdict}, issues {N}
- Technical Reviewer: {verdict}, issues {N}
- User Advocate: {verdict}, issues {N}
- Business Reviewer: {verdict}, issues {N}

**자동 수정됨 (불일치·구현)**
- `[CRITICAL|WARN × {합의 수}]` {페르소나 목록} → {target_ref} ({유형}): {수정 내용 요약}

**사용자 결정 (요구·정책)**
- `[{severity}]` {페르소나} → {target_ref}: {description}
  - 사용자 결정: 수정 / 기록만 / 기각
  - {수정 또는 사유}

**INFO (기록만)**
- `[INFO × {N}]` {페르소나 목록} → {target_ref}: {description}

**Rejected**
- `[{severity}]` {페르소나} → {target_ref}: {description}
  - 기각 사유: {사용자가 입력한 사유 또는 "범위 초과"}
```

수정 모드에서는 이전 Run을 보존하고 새 Run 추가.

---

## Step 8: 무한 루프 방지

```
4-페르소나 리뷰는 1회만 실행.
수정 후 자동 재리뷰 안 함.

예외: Step 6 사용자 확인 시 "재검증 요청" 옵션이 있고,
      사용자가 명시적으로 요청한 경우에만 1회 추가 실행.
      그 경우에도 총 2회를 넘지 않음.
```

루프 방지 이유:
- 비용 (Task × 4 × N회)
- 시간
- 페르소나가 매번 다른 이슈를 발견할 가능성 (수렴 보장 없음)

---

## Edge Cases

### Case 1: 모든 페르소나가 ACCEPT 판정
```
verdict 모두 ACCEPT, issues 총합 0 → 정상 흐름:
  ## 검증 기록에 "이 Run에서 발견된 이슈 없음" 명시
  Step 6 진행
```

### Case 2: 페르소나가 spec.md를 잘못 이해
```
명백히 잘못된 지적 (예: 존재하는 FR을 누락이라고 함):
  → 자동 수정 안 함
  → ## 검증 기록의 Rejected에 "페르소나 오해" 사유로 기록
  → Claude가 판단하여 Rejected 처리
```

### Case 3: 페르소나 간 서로 모순된 제안
```
예: Critical "FR-005 너무 자세함" vs User "FR-005 너무 모호함"
→ AskUserQuestion으로 사용자 판단 위임
→ "두 의견이 충돌함. 어느 쪽을 따를까요?"
```

### Case 4: JSON 파싱 실패
```
Task 응답이 JSON이 아니거나 스키마 어긋남:
  → 해당 페르소나는 "실패" 처리 (Step 1 분기로)
  → 응답 텍스트는 ## 검증 기록의 "참고 메모"에만 보존
```

---

## 출력

- 갱신된 `{out}/spec.md` (## 검증 기록 섹션 포함)
- 사용자에게 보고할 통계:
  - 자동 수정된 이슈: {N}개
  - 사용자가 결정한 이슈: {N}개
  - 기록만 처리: {N}개
  - 기각: {N}개
