# 아키텍처 설계 템플릿

architecture-designer가 05-architecture.md와 06-file-map.md를 생성할 때 사용하는 템플릿.

---

## 05-architecture.md 템플릿

```markdown
# 아키텍처 설계

## 설계 근거
### 기술 스택 선정 근거
| 기술 | 대안 검토 | 선정 이유 | 출처 |
(최소 주요 기술별 2개 이상 대안 비교)

### 아키텍처 패턴 선정 근거
| 패턴 | 장점 | 단점 | 적합도 |
(최소 2개 이상 패턴 비교)

### 설계 결정 요약
- 선정 패턴: [패턴명]
- 핵심 이유: [1~2문장]
- 기각 대안: [대안명 — 기각 이유]

## 아키텍처 개요
- **패턴**: [선택한 아키텍처 패턴]
- **근거**: [왜 이 패턴을 선택했는지]

## 시스템 구조

### 레이어 구성
```
[Presentation Layer]
        ↓
[Business Logic Layer]
        ↓
[Data Access Layer]
        ↓
[External Services]
```

### 컴포넌트 설계

#### [컴포넌트명]
- **책임**: [단일 책임 설명]
- **의존**: [의존하는 컴포넌트]
- **인터페이스**:
  - `functionName(params): returnType` — 설명

## 데이터 흐름
1. [요청 시작점]
2. [처리 단계들]
3. [응답 반환]

## NFR 대응 설계

### 성능
| NFR ID | 요구사항 | 대응 설계 | 관련 컴포넌트 |
|--------|----------|----------|--------------|
| NFR-001 | [예: 응답 200ms 이내] | [예: Redis 캐시 레이어 도입] | [캐시 서비스] |

### 보안
| NFR ID | 요구사항 | 대응 설계 | 관련 컴포넌트 |
|--------|----------|----------|--------------|
| NFR-002 | [예: 인증된 사용자만 접근] | [예: JWT 미들웨어] | [인증 미들웨어] |

### 확장성
| NFR ID | 요구사항 | 대응 설계 | 관련 컴포넌트 |
|--------|----------|----------|--------------|
| NFR-003 | [예: 동시 1000명 처리] | [예: 스테이트리스 설계 + 로드밸런서] | [앱 서버] |

> NFR이 없는 카테고리는 섹션 생략 가능.

## 디렉토리 구조
```
project/
├── src/
│   ├── types/       # 타입 정의
│   ├── config/      # 설정
│   ├── utils/       # 유틸리티
│   ├── services/    # 비즈니스 로직
│   ├── routes/      # API 라우트
│   └── app.ts       # 엔트리포인트
├── tests/
├── package.json
└── tsconfig.json
```

## 기술 결정 기록 (ADR)

### ADR-001: [결정 제목]
- **상태**: Accepted
- **맥락**: [왜 결정이 필요했는지]
- **결정**: [무엇을 결정했는지]
- **결과**: [결정의 영향]
- **관련 NFR**: [해당 시 NFR-xxx]
```

---

## 06-file-map.md 템플릿

```markdown
# File Map

## 생성 계획 요약
- 총 파일 수: N개
- Wave 수: N개
- 예상 총 LOC: ~N줄

## Directory Structure

> Step 6에서 이 섹션을 파싱하여 디렉토리를 자동 생성한다.
> 파일이 아닌 **디렉토리 경로만** 나열한다.

```
src/
src/types/
src/config/
src/utils/
src/services/
src/routes/
src/components/
src/components/common/
src/components/layout/
src/components/features/
src/components/features/{feature}/
src/stores/
src/pages/
public/
tests/
config/
```

## Wave 별 생성 순서

### Wave 1: 독립 모듈 (병렬 생성 가능)
| 파일 경로 | 유형 | 설명 | 예상 LOC |
|-----------|------|------|----------|
| `src/types/index.ts` | 신규 | 공통 타입 정의 | ~50 |

### Wave 2: 의존 모듈 (Wave 1 필요)
| 파일 경로 | 유형 | 설명 | 의존 | 예상 LOC |
|-----------|------|------|------|----------|
| `src/services/user.ts` | 신규 | 사용자 서비스 | types/ | ~100 |

## 파일별 상세 명세

### `src/types/index.ts`
- **목적**: 프로젝트 전체 공통 타입
- **주요 export**: `User`, `Config`, `ApiResponse`
- **관련 FR**: FR-001, FR-002
- **참고**: 다른 모든 파일이 이 파일을 import

### `src/services/user.ts`
- **목적**: 사용자 CRUD 비즈니스 로직
- **주요 export**: `createUser()`, `getUser()`, `updateUser()`
- **의존**: `types/index.ts`, `config/index.ts`
- **관련 FR**: FR-001

## 수정 대상 (기존 파일)
| 파일 경로 | 변경 유형 | 변경 내용 | 영향 범위 |
|-----------|-----------|-----------|-----------|
| (해당 시 기재) | | | |
```
