# 실가 (silga) — Claude Code 진입점

이 파일은 세션 시작 시 자동으로 읽힌다. 아래 순서대로 문서를 확인할 것.

## 필수 — 세션 시작 시 반드시 읽기
1. **실가_인수인계.md** — 현재 상태 / 진행 중인 작업 / 수정 예정 / 미결 사항.
   가장 먼저, 반드시 읽는다.
2. **실가_REFERENCE.md** — 규칙 / 저장소 구조 / API 계약 / DB 스키마 / 버전
   관리 규칙. 작업과 관련된 섹션만 필요할 때 찾아본다 (전체를 외울 필요는 없음).
3. **실가_HISTORY.md** — 변경 이력(append-only). 특정 시점 이력을 추적할
   때만 필요.

프로젝트 성격: 다나와(Danawa) 실시간 최저가 기반 PC 부품 가격 추적 + 조립PC
적정가 판정 개인 도구. 웹앱(이 리포)과, 이후 AI 라우터(Claude 등)가 REST
API를 tool처럼 호출하는 용도 두 갈래. 인증/로그인 없음, 상업적 이용 없음,
1인 개발 — 과설계(메시지 큐, 마이그레이션 프레임워크, 조기 확장) 금지.

## 개발 명령어

### 백엔드 (FastAPI, Python 3.11+)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger UI: `http://localhost:8000/docs`. 린터/포매터/유닛테스트 설정이
없음 — 임의로 명령어를 지어내지 말 것.

### 프론트엔드 (Vite + React + TypeScript)
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, 기본적으로 http://localhost:8000 백엔드 호출
npm run build
npm run typecheck    # tsc --noEmit
```
다른 백엔드 주소를 쓰려면 `frontend/.env`에 `VITE_API_BASE` 설정
(`frontend/src/lib/api.ts` 참조). ESLint 설정 없음 — `typecheck`가 유일한
자동 검증.

### E2E 스모크 테스트
```bash
pip install playwright && playwright install chromium
# 백엔드(:8000) + 프론트(:5173) 둘 다 띄운 상태에서
python3 scripts/e2e_smoke_test.py
```
리포 내 유일한 테스트 — Playwright로 검색→빌드생성→상세→목록 흐름을
실브라우저로 검증하는 단일 선형 스크립트. 개별 테스트 필터링은 없음.
스크린샷 경로(`/home/claude/e2e_*.png`)는 하드코딩된 절대경로라 다른
환경에서는 조정이 필요함.

## 작업 시 지켜야 할 것 (핵심 규칙)
- **응답 필드명 임의 변경 금지**: `app-shell-mockup.html` / `silga-mockup.html`이
  REFERENCE.md의 API 계약을 전제로 이미 만들어져 있음.
- **실측 합계·판정 계산에는 `lowest_price` 필드만 사용** — `prices` 리스트에서
  직접 min() 계산하는 코드는 작성 금지. `prices`는 화면 표시 전용이고 상위
  일부(약 10건)만 잘려 있으며, 다나와가 공식 최저가 산정에서 제외한 판매처가
  섞여 있을 수 있음 (근거는 REFERENCE.md #엔드포인트-설계 참조).
- **variants(정품/벌크/해외구매)는 참고 표시 전용** — `/estimate`, `/compare`의
  판정 로직에는 절대 반영 금지. 해외구매는 통관/배송 지연/AS 불가 등 국내
  구매와 리스크가 근본적으로 달라 판정 로직을 오염시킬 수 있음.
- **시간대는 KST 통일** (UTC 아님) — 다나와 자체가 KST 기준 서비스라서.
  SQLAlchemy의 `DateTime(timezone=True)`는 SQLite에서 사실상 no-op(오프셋
  소실)이라, 모든 datetime 컬럼은 `timezone_utils.py`의 커스텀 `KSTDateTime`
  TypeDecorator를 쓰고 타임스탬프는 반드시 `now_kst()`로 생성할 것 — naive
  datetime을 넘기면 예외 발생.
- **크롤링은 예의 있게**: 요청 간격 최소 5~10초, 동시 병렬 요청 지양.
  `main.py`의 `_compute_estimate()`가 빌드 아이템마다 `danawa.get_product()`를
  순차 호출하는 것도 이 원칙 때문.
- **스크래퍼 장애 vs 정상 품절 구분**: `requests.RequestException` → 503
  ("데이터 소스 연결 실패"), 파싱은 됐지만 데이터/상품 없음 → 404, 정상
  품절 상품은 에러가 아니라 `in_stock` 필드로 표현 (PALIT RTX5070Ti 실측
  사례는 `실가_HISTORY.md` 참조).
- `/product/{code}` 응답의 `category`(브레드크럼), `cash_price`(현금최저가)는
  2026-08-04 파싱 구현 완료 — 데이터가 없는 상품(예: 현금결제 전용 판매처가
  없는 상품)에서는 `None`이 정상이며 파싱 실패가 아님 (`실가_HISTORY.md` v8
  참조). GPU/CPU 두 카테고리 페이지로만 검증됐고 나머지 카테고리는 미검증.
- 커밋 메시지: `type: 내용 요약` (feat/fix/refactor/docs/chore) 형식.
  버전 규칙(세 번째/두 번째/첫 번째 자리 기준)은 REFERENCE.md
  #버전-관리-규칙 참조.

## 코드/문서 수정 후 반드시 할 것
- 엔드포인트/DB 스키마 등 상태가 바뀌면 → `실가_인수인계.md` 갱신 +
  `실가_HISTORY.md`에 append.
- 구조(REFERENCE.md에 적힌 규칙 자체)가 바뀔 때만 → `실가_REFERENCE.md` 갱신.
- 두 번째 자리 이상 버전 변경 시 → 커밋 필수.
- API 응답 필드명/구조 변경은 계약 변경 — 프론트가 이 계약을 전제로 만들어져
  있으므로 REFERENCE.md도 같이 갱신할 것, 임의로 필드명을 바꾸지 말 것.

## 아키텍처

### 저장소 구조
API를 별도 폴더로 쪼개지 않음 — API는 `backend/` 자체.
```
backend/app/
  main.py            FastAPI 라우트 전부 (라우터 분리 안 함)
  database.py        SQLAlchemy 엔진/세션, SQLite WAL 모드
  timezone_utils.py  KST 헬퍼 (KSTDateTime 등)
  utils.py           format_won() (원화 표시 포맷)
  services/
    danawa.py        vendoring된 패치본 다나와 스크래퍼 (아래 참조)
    verdict.py        calc_verdict() — 적정가/고가/저가 판정
  models/            SQLAlchemy 모델: Product, Build, BuildItem
  schemas/           Pydantic 요청/응답 모델, API 계약과 1:1 대응

frontend/src/
  components/        AppShell(사이드바/탑바), PartRow(자동완성 행)
  pages/             Search, BuildList, BuildCreate, BuildDetail, Placeholder
  lib/               api.ts(백엔드 클라이언트), useDebouncedValue.ts
  styles/global.css  디자인 토큰 CSS 변수

scripts/             e2e_smoke_test.py (위 참조)
```
`flutter/`는 Phase 5(모바일 이식)용으로 예정돼 있으나 아직 없음 — 미리
스캐폴딩하지 말 것.

### 데이터 소스: 다나와 스크래핑, 정식 API 아님
`backend/app/services/danawa.py`는 비공식 `MineEric64/danawa-py` 라이브러리를
손으로 패치해서 vendoring한 것 (PyPI 미등록, setup.py 없음 — pip install
불가, 파일을 그대로 복사해 편입). 다나와가 예고 없이 DOM을 바꾸는 탓에 3개
함수 중 2개(`get_product_codes`, `get_product`)가 이미 한 번 사이트 개편으로
깨져서 재패치했음 (2026-08-03, `실가_HISTORY.md` 참조). `get_price_variance`는
원본 그대로 사용 중.

### 판정(verdict) 계산
`services/verdict.py::calc_verdict(estimate_total, market_price)`가
`diff_percent = (market_price - estimate_total) / estimate_total * 100`을
계산해서 ±5%(`VERDICT_THRESHOLD_PERCENT`) 기준으로 `저가`/`적정가`/`고가`로
분류한다. 이 ±5%는 검증되지 않은 가정값 — `실가_인수인계.md`에 결정 필요
항목으로 남아 있음. `/estimate`와 `/build/compare`는 `main.py`의
`_compute_estimate()` 헬퍼로 이 합산 로직을 공유하므로, 따로 중복
구현하지 말 것.

### DB는 구조 저장 전용, 가격 캐시가 아님
`products`(메타데이터 캐시 — title/category/spec/img, 가격 필드 없음, 다나와
상품코드가 PK), `builds`(저장된 빌드: 이름, 비교용 `market_price` 선택 입력),
`build_items`(빌드↔부품 조인 + category 문자열), `favorites`(즐겨찾기 북마크
— product_code + created_at만, 2026-08-04 추가) 4테이블뿐. `price_history`
테이블은 의도적으로 없음 — 가격 이력은 로컬에 축적하지 않고 항상
`danawa.get_price_variance()`를 그때그때 호출해서 계산한다. DB의 역할은
"빌드가 무엇으로 구성됐는지/무엇을 즐겨찾기했는지"를 기억하는 것으로 한정 —
이 결정을 확인하지 않고 가격 스냅샷 테이블을 추가하지 말 것
(REFERENCE.md #DB-스키마).

### API 응답 형태 컨벤션
가격이 포함된 응답은 항상 raw 숫자 필드 + `*_formatted`(원화 문자열,
`utils.format_won()`) 필드를 함께 가진다 — 프론트는 formatted 필드, AI
라우터는 raw 필드 사용. 응답을 이원화(별도 엔드포인트/모드)하지 말고 같은
객체에 두 필드를 유지할 것 (`backend/app/schemas/`의 기존 스키마 패턴을
따를 것).

`/product/{code}/compare`(단일 상품 기준)와 `/build/compare`(빌드 전체
기준)가 별도 엔드포인트인 이유는 원래 `/compare`가 단일상품/빌드전체 중
어느 쪽을 뜻하는지 계약이 모호했기 때문 (REFERENCE.md #엔드포인트-설계
참조) — 재확인 없이 다시 하나로 합치지 말 것.

### 프론트엔드 구조
Vite SPA (Next.js/SSR 아님 — 백엔드가 이미 별도 FastAPI 서비스로 분리돼
있어 SSR이 불필요). 라우팅은 `App.tsx`에 플랫하게 정의돼 있고, 모든
페이지가 `AppShell` 레이아웃 라우트(사이드바+탑바) 하위에 중첩됨. 서버
상태는 TanStack Query로 관리하고 별도 전역 상태 스토어는 없음.
`lib/api.ts`의 타입은 `backend/app/schemas/*.py`와 1:1 대응하도록 맞춰져
있음 — Pydantic 스키마를 바꾸면 같은 변경에서 TS 인터페이스도 갱신할 것.
스타일링은 순수 CSS + `styles/global.css`의 디자인 토큰 CSS 변수 사용 —
Tailwind, CSS-in-JS 미사용. 2026-08-05 사용자 제공 참조 디자인으로 톤 전면
교체: 종이/잉크(paper/ink) 에디토리얼, 모노크롬(accent color 없음, 상태는
▲▼— 기호로 구분), border-radius/box-shadow 글로우 미사용(hairline 보더만).
Pretendard(본문·헤드라인 전체) + IBM Plex Mono(데이터/코드) — 이전
Black Han Sans/시안·마젠타·앰버 네온 톤은 폐기. 상세는 REFERENCE.md
#디자인-토큰 참조.

사이드바 7탭 전부 실데이터 연동 완료(2026-08-04) — `PlaceholderPage`
컴포넌트 자체가 더 이상 안 쓰여서 삭제됨. 최근기록/설정의 이동평균
기간은 서버 없이 `localStorage`만 쓰고(백엔드 엔드포인트 없음), 나머지는
전부 대응하는 백엔드 엔드포인트가 있음 — 탭이 존재한다고 새 엔드포인트가
필요하다고 임의로 가정하지 말고 `lib/api.ts`를 먼저 확인할 것.
