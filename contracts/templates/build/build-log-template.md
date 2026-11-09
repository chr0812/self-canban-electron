# 구현 기록

> 작성일: {YYYY-MM-DD}
> 설계: docs/05-design/ (승인본). 진행 상태의 기준은 `node scripts/build.js status`이고, 이 문서는 사람이 읽는 기록이다.

## Task 기록

검증을 통과한 Task 마다 아래 형식의 블록을 하나 둔다. `- 설계와 다른 점:` 줄은 필수다 (없으면 "없음").

```markdown
### T-001 package.json 작성
- 검증: 통과 (docs/_gate/build/T-001-20261028-143012.log)
- 바꾼 파일: app/package.json, app/.nvmrc
- 설계와 다른 점: 없음
- 메모:
```

## 설계와 다른 점 모음

구현 차이 보고(`유형: 구현 차이`)를 모아, 구현이 끝날 때 설계를 한 번 정정할지 기록으로 둘지 사용자와 정한다. 목록은 `issues.md`가 기준이다.
