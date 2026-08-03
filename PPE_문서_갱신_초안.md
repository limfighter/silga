# PPE 문서 갱신 초안 (2026-08-03, Phase 3~4 세션분)

> 이 세션에서 진행한 내용을 실제 PPE_REFERENCE.md / PPE_인수인계.md / PPE_HISTORY.md
> 3파일에 반영하기 위한 초안. 프로젝트 파일이 읽기전용이라 직접 수정을 못 해서
> 이 문서에 정리함 — 아래 내용을 각 파일에 복사/병합해서 반영하면 됨.

---

## 1. PPE_REFERENCE.md #엔드포인트-설계 — 추가/수정할 내용

### 신규 엔드포인트 3개 추가 (계약 변경, v0.2~v0.3)

```
POST /build/compare
  body: {items: [{code, category}, ...], market_price}
  → {total_price, total_price_formatted, breakdown: [...],
     market_price, verdict, diff_percent}
  ※ 원래 /product/{code}/compare가 단일상품용인지 빌드전체용인지 스펙 불일치가
    있었음 (silga-mockup.html 예시 숫자가 빌드전체 기준이었음) → 사용자 확인 후
    단일상품용(/product/{code}/compare, 원 계약 유지)과 빌드전체용(신규) 둘 다 만듦

POST /builds
  body: {name, market_price?, items: [{category, code}, ...]}
  → BuildSummary {id, name, market_price, created_at, item_count,
     total_price, total_price_formatted, verdict}
  ※ builds/build_items DB 테이블은 이미 설계돼 있었는데 채워넣는 CRUD가
    누락돼 있었음 — 빌드 탭 "생성→분석하기" 흐름이 실제로 저장까지 하려면 필요

GET /builds
  → [BuildSummary, ...]  (저장된 빌드 목록, 앱 셸 "내 빌드" 카드 목록에 대응)
  ※ 목록에 적정가/고가/저가 태그를 보여주려면 빌드마다 라이브 가격 재조회 필요
    — 개인 프로젝트 규모라 지금은 그대로 감, 빌드 개수 많아지면 재검토

GET /builds/{id}
  → BuildDetail {id, name, market_price, created_at, items: [...],
     total_price, total_price_formatted, verdict, diff_percent}
```

### /product/{code} 응답 필드 추가

```
+ in_stock: bool  (원 계약에 없던 추가 필드)
```
2026-08-03 실동작 중 발견: PALIT RTX 5070Ti(76465883, 마침 silga-mockup.html
API 예시에 쓰인 코드)가 실제로 "일시 품절" 상태라 가격이 없었음. 스크래핑
실패인 줄 알았는데 다나와 페이지 자체의 `lowest_blank` 클래스로 품절 표시가
있는 걸 확인 → `get_product()`에 `in_stock` 필드 추가해서 "품절"과 "스크래핑
실패"를 구분하도록 개선.

### 판정(verdict) 임계값 — 신규 확정 필요 항목

REFERENCE.md에 verdict 판정 경계 수치가 없어서 이번 세션에 **±5%로 가정**하고
구현함 (`backend/app/services/verdict.py`의 `VERDICT_THRESHOLD_PERCENT` 상수).
검증 근거는 있음(silga-mockup.html API 예시 diff_percent=2.1 → 적정가 판정과
일치하는 공식 확인함), 하지만 상한/하한 경계값 자체는 확정된 게 아니라서
실사용해보고 조정 필요 여부 논의 요망 — 인수인계.md "결정 필요" 섹션에 등재 권장.

### 미구현 필드 (기존에 이미 알려진 category/cash_price, 재확인)

`/product/{code}`의 `category`, `cash_price`는 여전히 스크래퍼 미구현.
`backend/app/schemas/product.py`에 TODO 주석으로 남겨둠.

---

## 2. PPE_REFERENCE.md #저장소-구조 — 실제 상태 반영

```
ppe/                          ← 실제로 생성됨 (git 리포, 커밋 3개: v0.2/v0.3/v0.4)
├── .gitignore
├── README.md                 ← 신규, 실행방법+현재상태 요약
├── backend/                  ← FastAPI, 5+3개 엔드포인트 전부 구현+라이브 검증 완료
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py       ← SQLite(WAL), get_db() 세션 제너레이터
│   │   ├── timezone_utils.py ← KSTDateTime 커스텀 타입 (아래 3번 항목 참조)
│   │   ├── utils.py          ← format_won()
│   │   ├── models/           ← product.py, build.py, build_item.py
│   │   ├── schemas/          ← search/product/history/estimate/compare/build.py
│   │   └── services/
│   │       ├── danawa.py     ← 통합본 (get_product_codes/get_product 패치 +
│   │       │                   get_price_variance 원본, 하나의 모듈로 vendoring 완료)
│   │       └── verdict.py    ← calc_verdict()
│   └── requirements.txt
├── frontend/                 ← Vite+React+TS+React Router+TanStack Query 스캐폴딩 완료
│   └── src/
│       ├── components/       ← AppShell.tsx, PartRow.tsx
│       ├── pages/            ← Search/BuildList/BuildCreate/BuildDetail/Placeholder
│       ├── lib/               ← api.ts, useDebouncedValue.ts
│       └── styles/global.css ← 목업 디자인 토큰 이식
└── scripts/
    └── e2e_smoke_test.py     ← Playwright E2E 스모크 테스트 (검색→빌드생성→상세→목록)
```

---

## 3. PPE_REFERENCE.md #기술-스택 또는 신규 섹션 — SQLite+SQLAlchemy 관련 주의사항 추가 권장

```
주의: SQLAlchemy의 DateTime(timezone=True)는 SQLite 다이얼렉트에서 사실상
no-op임 (오프셋 없이 저장되고, 복원 시 tzinfo가 사라짐) — "datetime은 KST
통일, 타임존 미표기 값 저장 금지" 체크리스트 원칙과 충돌함. 발견해서
timezone_utils.py에 KSTDateTime 커스텀 TypeDecorator를 만들어 해결함
(오프셋 포함 ISO 문자열로 직접 저장/복원, naive datetime 저장 시도는 예외 발생).
앞으로 이 프로젝트에서 datetime 컬럼 추가할 때 DateTime(timezone=True) 대신
반드시 KSTDateTime 사용할 것.
```

---

## 4. PPE_인수인계.md — 수정 예정 사항 갱신

### 🟡 우선순위 높음 — 완료 처리
```
[x] 저장소 구조 실제 생성 → 완료 (git 리포 커밋 3개)
[x] danawa_patched.py를 backend/app/services/danawa.py로 편입 → 완료
    (get_price_variance 원본과 통합)
[x] FastAPI 스켈레톤 + /search, /product/{code} 구현 → 완료 + 라이브 검증
[x] DB 스키마 실제 구현 → 완료 (products/builds/build_items, KSTDateTime 이슈 해결)
[x] /product/{code}/history, /estimate, /compare 엔드포인트 구현 → 완료
    (+ /build/compare, /builds CRUD 신규 추가, 위 1번 참조)
[x] 검색 탭 프론트 실데이터 연동 → 완료
[x] 빌드 탭 "생성" 화면 부품 검색 자동완성 연결 → 완료 (디바운스 500ms 적용)
```

### 신규 미결 항목 추가
```
[ ] REFERENCE.md 문서 자체 갱신 (이 문서의 1~3번 내용 실제 반영)
[ ] verdict 판정 임계값(±5% 가정값) 확정 논의
[ ] category, cash_price 필드 스크래퍼 구현 (다나와 브레드크럼/현금가 파싱)
[ ] 홈/즐겨찾기/최근기록/통계/설정 5개 탭 여전히 "준비 중" (프론트 스캐폴딩만 됨)
[ ] .env 기반 API_BASE 설정 문서화 (지금은 하드코딩된 localhost:8000 기본값만 있음)
[ ] 배포 시 CORS allow_origins=["*"] → 실제 배포 도메인으로 좁히기 (지금은 로컬 전용이라 허용)
```

---

## 5. PPE_HISTORY.md — 추가할 새 섹션 (v4)

```
#### v4 — Phase 3~4 백엔드 구현 + 프론트 실데이터 연동 (2026-08-03, 별도 세션)

[✓] danawa_patched.py를 backend/app/services/danawa.py로 편입, get_price_variance
    원본(MineEric64/danawa-py GitHub)과 통합
[✓] SQLite(WAL) DB 스키마 실제 구현, KSTDateTime 커스텀 타입으로 SQLAlchemy+SQLite
    타임존 소실 버그 해결 (naive datetime 저장 시 예외 발생하도록 방어)
[✓] FastAPI 5개 엔드포인트 구현 + 실제 다나와 라이브 호출로 검증
    (/search, /product/{code}, /product/{code}/history, /estimate,
    /product/{code}/compare)
[✓] /compare 스펙 불일치 발견 (단일상품 vs 빌드전체) → 사용자 확인 후 둘 다 구현
    (/product/{code}/compare 유지 + POST /build/compare 신규)
[✓] 빌드 CRUD 신규 추가 (POST/GET /builds, GET /builds/{id}) — DB 스키마는
    있었는데 누락돼 있던 부분
[✓] "일시 품절"과 "스크래핑 실패" 구분 안 되는 문제 발견 (PALIT 5070Ti
    76465883 실측 사례) → in_stock 필드 추가로 해결
[✓] 프론트엔드 Vite+React+TS 스캐폴딩, 검색/빌드탭 실데이터 연동 완료
[✓] Playwright E2E 스모크 테스트로 검색→빌드생성→상세→목록 전체 흐름 실브라우저 검증
[✓] git 리포 형성 (커밋 3개: v0.2 백엔드 스켈레톤, v0.3 빌드 CRUD, v0.4 프론트)

[ ] 다음 세션 시작 시
    → REFERENCE.md/인수인계.md 문서 실제 갱신 (이 문서 1~4번 참조)
    → verdict 임계값 확정 논의
    → 홈/즐겨찾기/최근기록/통계/설정 탭 순차 구현
```
