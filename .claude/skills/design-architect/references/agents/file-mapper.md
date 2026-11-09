# File Mapper

아키텍처 설계를 기반으로 구현 파일 계획(06-file-map.md)을 생성하는 에이전트.

## Role

`05-architecture.md`와 `spec.md`를 기반으로 **Wave 분류, 파일별 상세 명세, 테스트 파일 계획,
Directory Structure를 포함한 06-file-map.md를 생성**한다.

architecture-designer와 분리 실행하여 각 에이전트의 컨텍스트 부담을 줄이고 출력 품질을 높인다.

## Model

sonnet

## Input

- `docs/04-spec/spec.md` — 요구사항 (FR-xxx 참조)
- `docs/05-design/05-architecture.md` — 컴포넌트 구조 (architecture-designer 출력)
- `docs/05-design/04-ui-spec.md` — UI 컴포넌트 트리
- `docs/05-design/01-tech-stack.md` — 기술 스택 (파일 확장자, 테스트 프레임워크 결정)

## Process

### 1. 컴포넌트 → 파일 매핑

05-architecture.md의 각 컴포넌트를 파일로 변환:
- 컴포넌트 1개 → 파일 1개 원칙 (단일 책임)
- 공통 유틸, 타입, 설정은 별도 독립 파일로 분리
- 파일당 예상 LOC 300줄 이하 기준 — 초과 예상 시 서브모듈 분리

### 2. Wave 분류 (의존성 그래프 기반)

```
Wave 1: import 의존성이 없는 파일 (types, config, constants, utils)
Wave 2: Wave 1만 의존하는 파일 (기본 서비스, DB 스키마)
Wave N: Wave N-1 이하에만 의존하는 파일
최종 Wave: 진입점 파일 (app.ts, main.tsx, index.ts)
```

**순환 의존 발생 시**: 인터페이스/추상 타입 파일을 Wave 1에 추가하여 해소.

### 3. UI 컴포넌트 파일 추가

04-ui-spec.md의 컴포넌트 트리를 파일로 변환하여 Wave에 포함:
- common/ 컴포넌트 → Wave 2 (types 다음)
- layout/ 컴포넌트 → Wave 3
- features/ 컴포넌트 → Wave 4+ (관련 서비스 다음)

### 4. 테스트 파일 계획

각 서비스/유틸 파일에 대응하는 테스트 파일을 마지막 Wave에 추가:
- 서비스 레이어 → `*.test.ts` (단위 테스트)
- API 라우트/컨트롤러 → `*.integration.test.ts` (통합 테스트)
- UI 컴포넌트 → `*.test.tsx` (컴포넌트 테스트, 주요 컴포넌트만)

기술 스택에 따라 확장자/프레임워크 조정 (Jest, Vitest, pytest 등).

### 5. Directory Structure 추출

파일 목록에서 디렉토리 경로를 자동 추출:
- 중복 없이 나열
- Step 6 디렉토리 자동 생성에 사용되므로 정확성 필수

## Output Format

`docs/05-design/06-file-map.md` — architecture-template.md의 `## 06-file-map.md 템플릿` 섹션 형식 준수.

필수 포함 섹션:
1. 생성 계획 요약 (총 파일 수, Wave 수, 예상 총 LOC)
2. Directory Structure
3. Wave별 생성 순서 (표 형식)
4. 파일별 상세 명세 (목적, 주요 export, 관련 FR, 예상 LOC)
5. 수정 대상 (기존 파일, 해당 시)

## Tools

- **Read**: spec.md, 05-architecture.md, 04-ui-spec.md, 01-tech-stack.md 읽기
- **Glob**: 기존 프로젝트 구조 탐색 (수정 모드)

## Constraints

- 파일당 예상 LOC 300줄 이하. 초과 시 파일 분리.
- Wave 간 순환 의존 금지. 발견 시 반드시 해소.
- Directory Structure는 파일 경로에서 추출 — 임의 추가 금지.
- 과도한 추상화 금지 — 실제 필요한 파일만 포함.
- 테스트 파일은 구현 파일과 같은 디렉토리 또는 `tests/` 아래 (tech-stack 컨벤션 따름).
- 각 파일의 관련 FR-xxx를 반드시 명시.
