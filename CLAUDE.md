# 실가 (silga) — Claude Code 진입점

이 파일은 세션 시작 시 자동으로 읽힌다. 아래 순서대로 문서를 확인할 것.

## 필수 — 세션 시작 시 반드시 읽기
1. **실가_인수인계.md** — 현재 상태 / 진행 중인 작업 / 수정 예정 / 미결 사항.
   가장 먼저, 반드시 읽는다.
2. **실가_REFERENCE.md** — 규칙 / 저장소 구조 / API 계약 / DB 스키마 / 버전
   관리 규칙. 작업과 관련된 섹션만 필요할 때 찾아본다 (전체를 외울 필요는 없음).
3. **실가_HISTORY.md** — 변경 이력(append-only). 특정 시점 이력을 추적할
   때만 필요.

## 작업 시 지켜야 할 것
- **응답 필드명 임의 변경 금지**: `app-shell-mockup.html` / `silga-mockup.html`
  이 REFERENCE.md의 API 계약을 전제로 이미 만들어져 있음.
- **실측 합계·판정 계산에는 `lowest_price` 필드만 사용** — `prices` 리스트에서
  직접 min() 계산 금지 (근거는 REFERENCE.md 참조).
- **variants(정품/벌크/해외구매)는 참고 표시 전용** — 판정 로직에 반영 금지.
- **시간대는 KST 통일** (UTC 아님).
- 커밋 메시지: `type: 내용 요약` (feat/fix/refactor/docs/chore).
  버전 규칙(세 번째/두 번째/첫 번째 자리 기준)은 REFERENCE.md #버전-관리-규칙 참조.

## 코드/문서 수정 후 반드시 할 것
- 엔드포인트/DB 스키마 등 상태가 바뀌면 → `실가_인수인계.md` 갱신 +
  `실가_HISTORY.md`에 append.
- 구조(REFERENCE.md에 적힌 규칙 자체)가 바뀔 때만 → `실가_REFERENCE.md` 갱신.
- 두 번째 자리 이상 버전 변경 시 → 커밋 필수.

## 저장소 구조 요약 (상세는 REFERENCE.md)
```
backend/    FastAPI (API 전부 여기 포함, 별도 API 레이어 없음)
frontend/   Vite + TS
scripts/    e2e 스모크 테스트 등
```
