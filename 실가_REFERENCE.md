# 실가 REFERENCE — 규칙 · 구조 · 절차
이 파일은 거의 바뀌지 않는 정보만 담는다. 현재 상태/수정예정 → 실가_인수인계.md, 이력 → 실가_HISTORY.md
규칙/구조 자체가 변경될 때만 이 파일을 갱신한다.

※ 정식 이름 "실가"로 확정됨 (2026-08-03). 그 전까지는 PPE(Parts Price Engine)라는
  임시 코드네임을 썼음 — 3파일 파일명+본문 일괄 치환 완료.

---

## 프로젝트 개요
- 다나와 실시간 최저가 기반 PC 부품 가격 추적 + 조립PC 적정가 판정 엔진
- 용도 2갈래: ① 개인용 웹앱 (직접 사용) ② AI 라우터 경유지 (Claude 등이 tool처럼 호출)
- 개발 순서: 웹 프론트 먼저 (디버깅 편의) → API 명세 확정 → Flutter로 이식
- 백엔드 후보: FastAPI (Python) — Playwright/danawa-py 등 크롤링 생태계 우위로 우선 채택
- 개인 프로젝트: 인증/로그인 없음, 상업적 이용·재판매 없음
- 서버 시간대: KST 통일 (다나와 자체가 KST 기준 서비스라 GTHV의 UTC 통일 규칙과 다름 — 주의)
- 종결 목표 없음 (개인 도구, 필요 기능 생기면 그때 확장)

---

## 버전 관리 규칙
```
세 번째 자리: 버그수정 / 잔업데이트 (API 계약 변경 없음)     예: v0.1.1
두 번째 자리: 기능 추가 / 엔드포인트 변경 (계약 영향)         예: v0.2
첫 번째 자리: 전면 재설계 (아키텍처 변경)                    예: v1.0

Git 커밋 기준:
  - 두 번째 자리 이상 변경 시 커밋 필수
  - 세 번째 자리 변경은 커밋 선택
  - bak 파일은 두 번째 자리 변경 시만 생성 (백엔드 단일 진입 파일 한정)

커밋 메시지 컨벤션:
  "type: 내용 요약" 형식 — feat / fix / refactor / docs / chore
  예: git commit -m "feat: /compare 엔드포인트 추가 (v0.2)"

커밋 방법:
  git add <변경 파일만>
  git commit -m "feat: v0.2 변경내용 요약"

롤백 방법:
  git log --oneline
  git checkout <해시> <파일>
```

---

## 개발 시작 전 체크리스트
```
매 개발 세션 시작 시 반드시 확인

[ ] 실가_인수인계.md 수정 예정 사항 확인
    → 오늘 작업과 겹치는 항목 있으면 같이 처리

[ ] API 계약(본 문서 "엔드포인트 설계") ↔ 실제 코드 일치 확인
    → 프론트가 이미 이 계약대로 목업돼 있음 (app-shell-mockup.html) — 응답 필드명 임의 변경 금지

[ ] 수정 파일 버전 주석 업데이트
[ ] 엔드포인트/DB 스키마 수정 시:
    → 실가_인수인계.md 상태 갱신 + 실가_HISTORY.md append
[ ] 구조 변경(두 번째 자리 이상) 완료 시:
    → REFERENCE.md 엔드포인트 설계 / 데이터 소스 섹션 갱신 여부 확인
[ ] 크롤링/비공식 API 관련 수정 시:
    → "데이터 소스 신뢰도" 섹션의 매너 크롤링 원칙(요청 간격 등) 재확인
[ ] datetime은 KST 통일, 타임존 미표기 값 저장 금지
```

---

## 저장소 구조 (확정 — 2026-08-03, 2026-08-03 실제 생성+git 리포 형성 완료)
```
silga/                (git 리포 루트, 커밋 4개: v0.2 백엔드/v0.3 빌드CRUD/v0.4 프론트/docs)
├── README.md          로컬 실행 방법 + 현재 상태 요약
├── .gitignore
├── backend/          FastAPI (API 엔드포인트 전부 여기 포함, 별도 API 레이어 분리 안 함)
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py         SQLAlchemy 엔진/세션, SQLite(WAL)
│   │   ├── timezone_utils.py   KST 헬퍼 + KSTDateTime 커스텀 타입 (#기술-스택 하단 참조)
│   │   ├── utils.py            format_won()
│   │   ├── services/
│   │   │   ├── danawa.py       danawa_patched.py 편입 완료 + 원본 get_price_variance 통합
│   │   │   └── verdict.py      calc_verdict() (#엔드포인트-설계 verdict 임계값 참조)
│   │   ├── models/              product.py / build.py / build_item.py (#DB-스키마 참조)
│   │   └── schemas/             search/product/history/estimate/compare/build.py
│   │                            (#엔드포인트-설계 계약과 1:1 대응)
│   └── requirements.txt
├── frontend/         Vite+React+TS+React Router+TanStack Query (app-shell-mockup.html 재구현)
│   └── src/
│       ├── components/  AppShell.tsx(사이드바/탑바), PartRow.tsx(자동완성)
│       ├── pages/        Search/BuildList/BuildCreate/BuildDetail/Placeholder
│       ├── lib/           api.ts(백엔드 클라이언트), useDebouncedValue.ts
│       └── styles/global.css  디자인 토큰 이식
├── scripts/
│   └── e2e_smoke_test.py       Playwright E2E 스모크 테스트
└── deploy/                     GCP e2-micro 배포 설정 (2026-08-07 신설)
    ├── README.md                셋업 절차(gcloud 명령 포함)
    ├── silga-backend.service    systemd 유닛(uvicorn)
    ├── nginx-silga.conf         nginx 설정(정적 서빙 + /api/ 리버스 프록시)
    └── deploy.sh                업데이트 스크립트(git pull+재빌드+재시작)

Phase 5(Flutter 이식) 시점에 flutter/ 추가되어 3개 체제로 전환 예정 (지금은 2개)
```

---

## DB 스키마 (2026-08-03 확정, 2026-08-04 favorites 테이블 추가)
```
products      부품 기본정보 캐시 (code PK, title, category, spec, img, cached_at)
              → 재조회 최소화용 캐시, 실시간 가격은 항상 danawa 재조회

builds        저장한 조립샷 (id PK, name, market_price, created_at)

build_items   빌드-부품 연결 (id PK, build_id FK, category, product_code FK)

favorites     즐겨찾기 북마크 (id PK, product_code FK, created_at)
              → 2026-08-04 신규(즐겨찾기 탭). 가격 저장 안 함(다른 테이블과
                동일 원칙) — 목록 조회 시 항상 danawa 재조회. product_code에
                유니크 제약(같은 상품 중복 즐겨찾기 방지)

price_history 테이블 없음 — 의도적 제외 (아래 참조)
```

**⚠️ SQLite + datetime 타임존 관련 실device 이슈 (2026-08-03 발견, 해결 완료):**
SQLAlchemy의 `DateTime(timezone=True)`는 SQLite 다이얼렉트에서 사실상
no-op임 — 오프셋 없이 저장되고, 복원 시 tzinfo가 사라져서 "datetime은 KST
통일, 타임존 미표기 값 저장 금지" 체크리스트 원칙과 충돌함. `KSTDateTime`
커스텀 TypeDecorator(`backend/app/timezone_utils.py`)로 해결 — 오프셋
포함 ISO 8601 문자열로 직접 저장/복원, naive datetime 저장 시도는 예외
발생. **앞으로 이 프로젝트에서 datetime 컬럼을 추가할 땐 `DateTime(timezone=True)`
대신 반드시 `KSTDateTime`을 쓸 것.**

**price_history를 안 만들기로 한 이유 (오버엔지니어링 판단):**
- 개별 부품 가격 추이(홈 탭 동향, 통계 탭)는 danawa의 `get_price_variance()`가
  이미 히스토리를 제공하므로 우리가 스케줄러 돌려서 중복 축적할 필요 없음
- "내 빌드 총액이 시간에 따라 어떻게 변하는지"도 결국 `build_items`의
  `product_code`들로 그때그때 `get_price_variance()`를 호출해서 날짜별로
  합산하면 되는 문제 — 별도 스냅샷 테이블 불필요
- 결론: DB는 순수 "구조 저장용"(빌드 구성 자체를 기억하는 용도)으로 한정,
  가격 데이터는 절대 자체 축적하지 않고 항상 danawa를 통해 실시간/준실시간
  계산. APScheduler(자동 주기 크롤링)도 이 결정에 따라 우선순위 낮음 유지
  (지정가 알림 기능 등 실제로 주기적 감시가 필요해지는 시점에만 재검토)

---

## 기술 스택 (전체 확정 — 2026-08-03)
```
백엔드     FastAPI (Python 3.11+)
데이터소스  1순위: danawa-py 방식 (다나와 비공식 내부 API 직접 호출) — 검증 전
           2순위(1순위 장애 시 대체): Playwright 기반 자체 크롤러
           참고 구현: sammy310/Danawa-Crawler (Scrapy+Selenium, GitHub Actions 매일 크론)
스케줄러   APScheduler (Celery 등 무거운 큐 불필요 — 개인 프로젝트 규모)
DB         SQLite (WAL 모드) — 개인용 트래픽 규모에 충분, 서버 운영 부담 없음
           트래픽/데이터량 커지면 PostgreSQL 이전 검토 (지금은 과설계 지양)

웹 프론트   Vite + React + TypeScript + React Router
           → Next.js 미채택: 백엔드가 FastAPI로 이미 분리돼 있어 SSR 불필요,
             순수 SPA가 가볍고 Flutter 이식 시 라우팅 구조 매핑도 더 직관적
서버상태   TanStack Query (React Query) — REST 캐싱/재검증 직접 구현 안 함
차트       Recharts — 목업의 손그림 SVG(gauge 제외)를 실 라이브러리로 교체
           판정 게이지(SVG 반원 다이얼)는 Recharts로 안 되는 커스텀 컴포넌트라
           목업 그대로 SVG 직접 구현 유지
스타일링   바닐라 CSS, 디자인 토큰(REFERENCE.md #디자인-토큰) 그대로 CSS 변수 사용
           → Tailwind 미채택: 이미 커스텀 토큰 시스템이 있어 얹으면 충돌/중복

모바일(이식 단계) Flutter + Riverpod(상태관리) + go_router(라우팅)
           웹/Flutter 공통: 동일 REST API 한 벌만 사용, 프론트는 얇은 렌더링 레이어

알림       FCM (Flutter 이식 이후 적용, 웹 단계에서는 보류)
배포       확정(2026-08-07) — GCP Compute Engine e2-micro 무료 티어 VM 단일
           인스턴스. 사용자가 GCP를 자주 다뤄봐서 익숙하다는 이유로 선택 —
           Fly.io/Railway(마찰은 더 적었을 후보)보다 우선. 프론트(정적
           빌드)+백엔드(FastAPI) 같은 VM 하나에서 서빙(nginx가 정적파일
           서빙 + `/api/`만 uvicorn으로 리버스 프록시) — 이 구성이면
           프론트가 같은 오리진으로 호출하게 되어 CORS 자체가 불필요해짐
           (프로덕션 한정, 로컬 dev는 여전히 크로스 오리진이라 CORS 필요).
           도메인/HTTPS는 아직 없음 — VM 외부 IP로 HTTP 직접 접속, 도메인
           생기면 그때 certbot 추가 예정. 셋업 절차/systemd·nginx 설정은
           `deploy/` 참조
           (기각된 후보, 참고용)
                Fly.io / Railway — SQLite+단일 프로세스에 특화, 마찰
                최소였을 후보지만 GCP 익숙함을 우선해 선택 안 함
                GCP Cloud Run — 서버리스 자동 확장, 단 SQLite 파일을 GCS
                FUSE로 마운트해야 해서 단일 인스턴스 고정 필요 — 결국
                SQLite 쓰는 한 확장성 이점 못 씀. 진짜 확장 필요해지면
                Postgres 이전 + 멀티 인스턴스가 정공법
                Cloudflare(Workers) — Python은 Pyodide 경유라
                FastAPI/uvicorn이 그대로 안 올라가고, SQLite도 D1/Durable
                Objects로 갈아타야 해서 스택 재설계 수준의 변경 필요해 제외
```

---

## 데이터 소스 신뢰도 기준 (불변 사실)
```
danawa-py (MineEric64/danawa-py, Apache-2.0):
  - 다나와 개발자가 아닌 유저가 만든 비공식 API. 다나와가 내부적으로 쓰는
    엔드포인트를 리버스 엔지니어링한 것으로 추정 (요청/응답 방식이 스크래핑이
    아니라 API 콜 형태)
  - 제공 함수 3개: get_product_codes(keyword) / get_product(product_code) /
    get_price_variance(product_code, by_month)
  - 저장소 커밋 9개뿐, 유지보수 활발하지 않음 — 2026-08-03 실동작 검증 결과
    이 우려가 실제로 맞아떨어짐 확인됨: get_product_codes / get_product
    2개 함수가 다나와 측 DOM 구조 변경으로 이미 깨져 있었음(get_price_variance만
    원본 그대로 정상). 상세 원인/패치 내역은 실가_HISTORY.md 2026-08-03 v1 참조
  - PyPI 미등록, setup.py/pyproject.toml도 없어 pip install 불가(git URL
    설치도 불가) — 단일 파일(danawa.py)을 프로젝트에 직접 vendoring해야 함
  - **결론: 원본 그대로는 채택 불가, 자체 패치본(danawa_patched.py) 사용
    확정.** get_product_codes/get_product는 재작성, get_price_variance는
    원본 그대로 사용. danawa_patched.py는 아직 실가 프로젝트 정식 경로로
    편입 전(실가_인수인계.md "수정 예정 사항" 참조)
  - 법적 리스크: 낮음 (개인용, 비상업), 단 다나와 이용약관상 자동화 접근에
    대한 태도가 우호적이지 않을 수 있음 (robots.txt가 danawa.com 계열 전체를
    막고 있음을 확인함, 2026-08-03) — 과도한 요청 빈도 지양

sammy310/Danawa-Crawler (MIT):
  - Scrapy + Selenium, PC부품 전 카테고리, GitHub Actions로 매일 09:00 KST
    자동 실행 중인 걸로 확인됨(2026-08-03 기준 살아있는 프로젝트)
  - danawa-py가 막히거나 필드 부족 시 셀렉터 구조 참고용 / 대체 수단

다나와 공식 오픈API (api.danawa.com):
  - 2012년 "열린 개발자 공간"으로 공개된 이력 확인, 카테고리/검색/뉴스/장터
    API 제공 — 단 "가격정보/최저가"가 공개 범위에 명시적으로 포함되는지
    불확실, 2026년 현재도 키 발급이 되는지 미검증
  - robots.txt 차단으로 자동 조회 불가 → 사람이 직접 브라우저로 확인 필요
  - 상태: 미검증 (인수인계 확인 필요 항목)

매너 크롤링 원칙 (danawa-py/자체 크롤러 공통):
  - 요청 간격 최소 5~10초, 동시 병렬 요청 지양
  - User-Agent 명시
  - 상업적 재판매/API 재공개 목적 아님 (개인 참고용 한정)
```

---

## 엔드포인트 설계 (계약 — app-shell-mockup.html이 이 계약 전제로 만들어짐)
```
GET  /search?q={keyword, 선택}&category={선택}&memory_gb={GPU}&chipset={GPU}&length={GPU}&socket={CPU|메인보드|쿨러}
     &formfactor={메인보드|케이스|SSD}&ram_type={RAM}&wattage={파워}&interface={SSD}
     &cooler_type={쿨러}
  → [{code, title, price, price_formatted, img}, ...]
  ※ q 선택화 + img 필드(v0.9.2, 2026-08-07 추가) — 검색 버튼을 안 눌러도
    카테고리 선택만으로 기본 목록이 뜨도록, q 생략 시 backend/app/main.py의
    CATEGORY_DEFAULT_QUERY(카테고리별 기본 검색어, 예: GPU→"그래픽카드")로
    대신 검색함. q와 category 둘 다 없으면 400. img는 danawa.get_product_codes()가
    상품 li의 div.thumb_image img에서 파싱한 썸네일 URL — 실측 결과 상위
    소수만 즉시로딩(src)이고 대다수는 lazyload라 실제 URL이 data-src에 있어
    data-src 우선 사용(둘 다 없거나 noImg 플레이스홀더면 None, 프론트가 자체
    플레이스홀더 처리)
  ※ category(v0.5, 2026-08-05 추가) — 검색어가 다른 카테고리 상품과 겹칠 때
    결과를 좁히는 선택적 필터. 값은 backend/app/main.py의 CATEGORY_LABELS 키
    (CPU/GPU/메인보드/RAM/SSD/케이스/파워/쿨러)와 정확히 일치해야 적용됨
    (안 맞으면 무필터, 하위 호환). danawa.get_product_codes(category_label=...)가
    각 상품 li의 input#productItem_categoryInfo_{code} 값 마지막 "_" 뒤 조각과
    비교해서 사후 필터링(요청 URL에 새 파라미터를 추가하는 방식이 아님) — 8개
    전부 실제 상품 li HTML로 직접 검증 완료(실가_HISTORY.md 2026-08-05 참조)
  ※ 스펙 파라미터(memory_gb/chipset/socket/formfactor/ram_type/wattage/
    interface는 v0.5, cooler_type은 v0.7, formfactor의 SSD 적용은 v0.8,
    length는 v0.9 추가) — category와 달리 다나와 서버측 요청 자체를
    좁히는 필터. danawa.get_product_codes(attribute=...)로 "{속성코드}-
    {값코드}-OR"(또는 케이스만 -AND, 동작상 차이 없음) 형식 문자열을 다나와
    요청 URL에 그대로 전달(다나와 상세검색 필터 체크박스 클릭 시 실측 URL에서
    확인한 형식, 실가_HISTORY.md 2026-08-05 참조. length는 다나와의 "상세검색"
    UI — 원래 값 형식이 "{카테고리seq}|{속성seq}|{값seq}|OR"로 다른데, 카테고리seq를
    빼고 하이픈으로 바꾸면 동일한 attribute= 파라미터로 그대로 동작하는 것까지
    라이브로 검증 완료, 실가_HISTORY.md 2026-08-06 참조). 각 파라미터는 정해진
    category일 때만 적용되고 그 외엔 무시:

    | 파라미터    | 적용 category | 값 예시               | 매핑 딕셔너리(main.py)         |
    |-------------|---------------|------------------------|----------------------------------|
    | memory_gb   | GPU           | 16 (GB)                | GPU_MEMORY_ATTRIBUTES            |
    | chipset     | GPU           | NVIDIA/AMD/Intel        | GPU_CHIPSET_ATTRIBUTES           |
    | length      | GPU           | "300~309mm"/"360mm~" 등(10mm 단위 구간, 7개) | GPU_LENGTH_ATTRIBUTES (케이스 장착 호환성 참고용 — 구간 결합 미지원이라 정확한 "이하/이상" 필터는 아님, 근사치로만 사용) |
    | socket      | CPU, 메인보드, 쿨러 | AM5/AM4/LGA1851/LGA1700| CPU_SOCKET_ATTRIBUTES / MAINBOARD_SOCKET_ATTRIBUTES / COOLER_SOCKET_ATTRIBUTES (카테고리마다 다나와 내부 코드 자체가 달라 값도 다름 — 절대 재사용 불가. 쿨러는 "그 쿨러가 지원하는 소켓" 의미이고, 인텔(6805)/AMD(6806) 필터 그룹이 나뉘어 있어 값에 따라 속성코드까지 갈림) |
    | formfactor  | 메인보드, 케이스, SSD | 메인보드/케이스: ATX/M-ATX/ITX/E-ATX, SSD: M.2 2280/M.2 2242/M.2 2230/2.5인치 | MAINBOARD_FORMFACTOR_ATTRIBUTES / CASE_FORMFACTOR_ATTRIBUTES / SSD_FORMFACTOR_ATTRIBUTES (메인보드=자기 크기, 케이스=장착 가능한 보드 크기, SSD=드라이브 규격 — 의미가 다름) |
    | ram_type    | RAM           | DDR5/DDR4               | RAM_TYPE_ATTRIBUTES              |
    | wattage     | 파워          | "800W~899W" 등          | PSU_WATTAGE_ATTRIBUTES           |
    | interface   | SSD           | SATA3/PCIe3.0x4/PCIe4.0x4/PCIe5.0x4 | SSD_INTERFACE_ATTRIBUTES |
    | cooler_type | 쿨러          | CPU 쿨러/시스템 쿨러/VGA 쿨러/M.2 SSD 쿨러/써멀그리스 | COOLER_TYPE_ATTRIBUTES (다나와 "쿨러/튜닝" 카테고리엔 CPU 쿨러·케이스팬·써멀그리스·조명기기가 다 섞여 있어 category 필터만으론 안 걸러짐 — 이 카테고리에 특히 필요한 필터) |

    **같은 category 안에 스펙 파라미터가 여러 개 있는 경우(GPU: memory_gb+
    chipset+length, 메인보드: socket+formfactor, 쿨러: cooler_type+socket,
    SSD: interface+formfactor) 동시에 못 씀** — attribute 인자가 값 하나만
    받을 수 있어서(다중 attribute 결합 규칙 미검증 — GPU length로 실제
    콤마/파이프/파라미터 반복 다 시도해봤으나 전부 실패 확인, 실가_HISTORY.md
    2026-08-06 참조) chipset(GPU는 memory_gb보다도 우선)/socket/cooler_type/
    interface가 우선 적용되고 나머지는 무시됨(main.py::search()의 `A or B or C`
    체이닝 참조). 프론트(PartRow)는 이 제약을 반영해 같은 카테고리의 스펙
    select를 상호 배타로 구현(하나 고르면 다른 하나 자동 해제) — API를 직접
    호출하는 쪽(AI 라우터 등)도 이 우선순위를 알아야 함
  ※ 다른 카테고리/스펙으로 더 확장하려면 매번 그 카테고리 자체의 필터
    사이드바에서 다시 확보해야 함(체크박스 클릭 → 바뀐 URL의 attribute= 값
    확인) — 카테고리 간 attribute 코드는 절대 재사용 불가로 확인됨(예: CPU
    소켓 AM5=41-801631-OR, 메인보드 소켓 AM5=500-801682-OR로 서로 다름)

GET  /product/{code}
  → {code, title, category, current_price, cash_price, spec,
     variants: [{type, price, mall_count, pcode, is_current}, ...]}
  ※ variants(정품/벌크/해외구매 등 유형별 최저가 비교)는 참고 정보 전용.
    /estimate, /compare의 실측 합계·판정 계산에는 절대 미반영 — 해외구매는
    통관/배송 지연/AS 불가 등 국내 구매와 리스크가 근본적으로 달라 판정
    로직을 오염시킬 수 있음. 프론트에서 "해외구매 참고가" 형태의 부가
    표시로만 사용할 것 (합계·게이지 계산에서 제외)

GET  /product/{code}/history?months={1|3|6|12}
  → {min, max, prices: [{date, price}, ...]}

POST /estimate
  body: [{code}, {code}, ...]
  → {total_price, total_price_formatted, breakdown: [{category, title, price}, ...]}

GET  /product/{code}/compare?market_price={n}&ma_window={7|14|30}
  → {title, lowest_price, estimate_total, verdict_basis_price,
     verdict_basis_price_formatted, verdict_confidence, verdict_basis_breakdown,
     ma_window, market_price, verdict, diff_percent}
  verdict ∈ {"저가", "적정가", "고가"} — 판정 게이지(빌드 상세 화면) 구간과 1:1 대응
  ※ 단일 상품 기준 — estimate_total(즉시가)은 그 상품 하나의 lowest_price와 동일값

POST /build/compare  (신규, v0.3 — 원 계약에 없었음)
  body: {items: [{code, category}, ...], market_price, ma_window?(기본 14)}
  → {total_price, total_price_formatted, breakdown: [...],
     verdict_basis_price, verdict_basis_price_formatted, verdict_confidence,
     verdict_basis_breakdown, ma_window, market_price, verdict, diff_percent}
  ※ 빌드 전체 기준. /compare 엔드포인트가 "단일상품"인지 "빌드전체"인지 스펙
    불일치가 있었음(silga-mockup.html API 예시 숫자가 빌드전체 기준이었음,
    2026-08-03 발견) → 확인 후 단일상품용(위 GET, 원 계약 유지)과 빌드전체용
    (이 엔드포인트, 신규) 둘 다 만듦. /estimate와 계산 로직 공유

POST /builds  (신규, v0.3 — 원 계약에 없었음)
  body: {name, market_price?, items: [{category, code}, ...]}
  → BuildSummary {id, name, market_price, created_at, item_count,
     total_price, total_price_formatted, verdict, verdict_confidence, ma_window}
  ※ builds/build_items DB 테이블은 있었는데 채워넣는 CRUD가 누락돼 있었음
  ※ 생성 직후엔 verdict/verdict_confidence/ma_window 전부 null (아직 라이브
    가격 계산 전) — 목록/상세 조회 시점에 채워짐

GET  /builds?ma_window={7|14|30}  (신규, v0.3)
  → [BuildSummary, ...]  — 저장된 빌드 목록(앱 셸 "내 빌드" 카드 목록)
  ※ 카드에 판정 태그를 보여주려면 라이브 가격 재조회가 필요해서, 목록
    조회 시점에 빌드마다 계산을 다시 돌림 — 개인 프로젝트 규모라 지금은
    그대로 감, 빌드 개수 많아지면 재검토
  ※ total_price는 즉시가로 매번 새로 조회. verdict는 이동평균 기준가로
    계산하며 (build_id, ma_window) 단위 5분 메모리 캐시를 씀(아래 "verdict
    판정 기준가" 항목 참조)

GET  /builds/{id}?ma_window={7|14|30}  (신규, v0.3)
  → BuildDetail {id, name, market_price, created_at, items: [...],
     total_price, total_price_formatted, verdict_basis_price,
     verdict_basis_price_formatted, verdict_confidence, verdict_basis_breakdown,
     ma_window, verdict, diff_percent}
  ※ GET /builds와 같은 verdict 기준가 캐시를 공유 — 목록↔상세 이동 시
    판정이 서로 다르게 뜨는 걸 방지

POST /favorites  (신규, v0.4.4 — 즐겨찾기 탭 채우는 첫 엔드포인트)
  body: {code}
  → FavoriteItem {code, title, price, price_formatted, created_at}
  ※ 이미 즐겨찾기된 상품이면 새로 추가하지 않고 기존 항목 그대로
    반환(idempotent) — 중복 추가를 에러로 취급하지 않음
  ※ 단일 상품 조회라 GET /product/{code}와 동일하게 danawa 연결 장애 시
    즉시 503 (다중부품 fallback 관례 대상 아님)

GET  /favorites  (신규, v0.4.4)
  → [FavoriteItem, ...]  — 즐겨찾기 목록(최근 추가순), 상품별 실시간 최저가
  ※ GET /builds와 동일하게 조회 시점마다 danawa 순차 재조회, 캐시 없음
  ※ 부품 하나의 연결 장애가 전체 목록을 죽이지 않도록 항목별로 실패를
    삼키고 계속 진행(POST /builds·_compute_estimate와 동일한 다중부품
    fallback 관례)

DELETE /favorites/{code}  (신규, v0.4.4)
  → 204 No Content. 즐겨찾기에 없는 code면 404

verdict 판정 임계값:
  diff_percent = (market_price - basis_price) / basis_price * 100
  diff_percent > +5%  → "고가"
  diff_percent < -5%  → "저가"
  그 외              → "적정가"
  ※ ±5%는 REFERENCE.md에 수치가 없어 2026-08-03 구현 시 임의로 잡은 가정값
    (backend/app/services/verdict.py::VERDICT_THRESHOLD_PERCENT). silga-mockup.html
    API 예시(estimate_total=3390000, market_price=3464000 → diff_percent=2.1,
    "적정가")로 공식 자체는 검증됨. 2026-08-04 재논의 결과 임계값 자체(±5%,
    대칭)는 그대로 유지하기로 확정 — 대신 아래처럼 basis_price(판정 기준가)
    계산 방식을 이동평균 도입으로 개선함 (실가_인수인계.md 2026-08-04
    "결정 완료" 참조)

verdict 판정 기준가(basis_price) — 이동평균 도입 (2026-08-04, v0.4 예정)
  배경: basis_price로 조회 시점의 순간 스크래핑 값(즉시가)만 쓰면, 부품이
    일시 특가/재고 급변으로 순간 폭락·폭등할 때 같은 빌드인데도 조회
    타이밍에 따라 고가↔저가↔적정가로 판정이 오락가락하는 문제가 있음.
    → estimate_total/total_price(견적가, 화면에 보이는 "총 가격")는 지금처럼
      즉시가 그대로 유지 — "지금 당장 사면 얼마"라는 의미 보존
    → verdict 판정에 쓰는 basis_price(verdict_basis_price)만 별도로 부품별
      이동평균 기준 계산으로 분리

  이동평균 계산 (services/verdict.py::compute_ma_price):
    - danawa.get_price_variance(code, 3)(3개월치 시계열)을 재사용, 신규
      스크래핑 함수 없음
    - ⚠️ 실측 확인(2026-08-04, 로컬 라이브 검증): 다나와는 daily가 아니라
      **주 단위**로 데이터를 줌(1개월치 조회해도 포인트 4개 안팎, 7일 간격).
      그래서 by_month=1이 아니라 3을 씀 — 1개월치만으론 window=30일 커버리지
      체크(아래) 자체가 항상 부족해서 무효 처리만 나옴
    - N(기간)은 쿼리파라미터/요청필드 ma_window로 선택: 7 | 14 | 30, 기본 14
      (다만 실제 데이터가 주 단위라 window=7이면 보통 데이터 포인트 1~2개
      평균이 됨 — "7일선"이라는 이름과 별개로 정밀한 daily 스무딩은 아님)
    - "엄격" 원칙(v5, 실측 후 재정의): "정확히 N개 항목 존재"가 아니라
      **날짜 기준으로 최근 N일 이내 데이터를 모아 평균 + 히스토리 자체가
      N일 전체를 커버해야 유효**(가장 오래된 데이터가 cutoff 이전부터 있어야
      함). 신상품처럼 히스토리 자체가 N일보다 짧으면 무효(None) — 최초
      설계(v4)였던 "정확히 N개 daily 항목 필요"는 주 단위 데이터에서 항상
      실패하는 게 실측으로 확인돼 폐기함 (실가_HISTORY.md 2026-08-04 v4→v5 참조)
    - 정렬은 리스트 원본 순서를 신뢰하지 않고 매번 full_date를 datetime으로
      파싱해서 명시 정렬 — full_date 포맷은 "YY-MM-DD"(예: "26-05-12")로
      실측 확인됨(사전순 정렬이 날짜순과 일치하지만 구간 계산을 위해 명시
      파싱). full_date 없는 항목이 섞이면 정렬 신뢰 불가로 보고 무효 처리

  이동평균 무효 시 fallback (부품 단위):
    - 이동평균이 무효인 부품은 그 부품만 즉시가(lowest_price)로 대체해서
      basis_price 합산을 계속 진행 — 빌드 전체 판정을 null로 날리지 않음
      (최초 검토안이었던 "부품 하나라도 무효면 전체 null" 원칙을 뒤집음)
    - 신뢰도를 투명하게 노출: verdict_confidence("high" — 전 부품 이동평균
      정상 | "low" — 하나 이상 즉시가로 fallback됨)
    - verdict_basis_breakdown: [{code, price, source: "ma"|"current_fallback"}]
      부품별로 어떤 값을 썼는지 노출

  GET /builds, GET /builds/{id} 전용 캐시:
    - 저장된 빌드를 매번 순회 재계산하는 구조라, 이동평균 도입으로 부품당
      스크래핑이 2배(get_product + get_price_variance)가 되는 부담 +
      목록↔상세 이동 시 캐시 미스 타이밍 차이로 판정이 다르게 뜨는 문제를
      막기 위해 (build_id, ma_window) 키로 5분간 프로세스 메모리 캐시
      (_verdict_basis_cache, main.py) — DB 저장 아님, total_price(즉시가)는
      캐시 대상 아니고 항상 새로 조회
    - POST /build/compare(build_id 없음), GET /product/{code}/compare(반복
      조회 문제 없음)는 이 캐시 대상 아님

/product/{code} 응답 추가 필드 (원 계약 외, 2026-08-03 추가):
  + in_stock: bool
  "일시 품절"(다나와 페이지의 lowest_blank 클래스)과 "스크래핑 실패"를
  구분하기 위해 추가. 실측 사례: PALIT RTX5070Ti(76465883, silga-mockup.html
  API 예시에 쓰인 코드)가 검증 당시 실제로 품절 상태였음

설계 원칙:
  - 응답에 사람이 읽는 필드(*_formatted)와 AI/계산용 raw 필드(숫자)를 함께 포함
    → 프론트는 formatted 필드, AI 라우터는 raw 필드 사용. 응답 이원화하지 않음
  - 실측 합계(estimate_total/total_price)와 판정 기준가(verdict_basis_price)는
    항상 다나와 공식 lowest_price(즉시가) 또는 그 daily 시계열(이동평균,
    2026-08-04부터) 기반으로만 계산. 판매처별 가격 리스트(prices)에서
    직접 min() 계산해서 최저가로 대체하는 로직은 금지 — 리스트에 다나와가
    최저가 산정에서 제외한(안전결제 미지원 등으로 추정) 판매처가 섞여
    있고, 우리가 가져오는 리스트 자체도 상위 일부만 잘려 있어 불완전함
    (2026-08-03 danawa-py 검증 시 실측 확인, 실가_HISTORY.md 참조)
  - 에러는 명확한 상태코드로 구분 ("상품 없음" vs "데이터 소스 자체 장애")
```

---

## 화면/탭 구조 (app-shell-mockup.html 기준 → frontend/에 실제 구현, 2026-08-03,
   2026-08-04 홈/통계/최근기록/설정/즐겨찾기 5개 탭 추가 완료로 갱신)
```
사이드바 (기본 아이콘 레일 72px, 햄버거로 240px 확장)
├─ 홈       — ✅ 완료, 최근 빌드 4개 카드(GET /builds 재사용) + 빠른 액션
│              버튼("새 빌드 만들기"/"부품 검색")
├─ 검색     — ✅ 완료, /search 실데이터 연동
├─ 빌드     — ✅ 완료, 3단계 흐름 전부 실데이터 연동
│    ├─ 목록   GET /builds 연동, 적정가/고가/저가 태그 + 총액 실시간 계산
│    ├─ 생성   카테고리별 자동완성(디바운스 500ms) + POST /builds 저장
│    │        + 비교 판매가 입력 → "분석하기" → 저장 후 상세로 자동 이동
│    └─ 상세   GET /builds/{id} 연동, 판정 게이지(SVG 반원 다이얼, diff_percent
│              기반 니들 각도 동적 계산) + 부품별 breakdown + 합계
├─ 즐겨찾기  — ✅ 완료, PartRow로 검색→즉시 추가(POST /favorites), 목록
│              (GET /favorites)에서 클릭 시 통계 탭으로 이동해 가격 히스토리
│              바로 확인, 개별 제거(DELETE /favorites/{code})
├─ 최근기록  — ✅ 완료, localStorage 기반 최근 조회 부품(서버 저장 없음),
│              통계 탭/빌드 생성 화면에서 부품 선택 시 자동 계측
├─ 통계      — ✅ 완료, 오실로스코프풍 라인차트(GET /product/{code}/history)
│              + PartRow로 부품 검색 + 1/3/6/12개월 탭
└─ 설정      — ✅ 완료, verdict 이동평균 기간(ma_window, 7/14/30일)
              드롭다운 + localStorage 저장

Playwright E2E 스모크 테스트(scripts/e2e_smoke_test.py)로 검색→자동완성→
빌드생성→상세→목록 전체 흐름 실브라우저 검증 완료(2026-08-03 시점).
그 이후 추가된 화면(홈/통계/최근기록/즐겨찾기)은 이 스크립트에 아직
반영 안 됨 — 세션별로 mock 백엔드+Playwright 임시 스크립트로 개별
검증만 함(실가_HISTORY.md v9~v11 참조), scripts/e2e_smoke_test.py 자체
갱신은 별도 작업으로 남아있음.
```

---

## 디자인 토큰
```
2026-08-05 전면 교체 — 사용자가 제공한 참조 디자인(에디토리얼 빌드 명세서
HTML, 종이/잉크 톤)을 그대로 실가 전체에 적용. 이전 다크+네온(시안/마젠타/
앰버) 톤은 폐기. 재적용/확장 시 이 팔레트·규칙을 따를 것 — 채도 있는
accent color를 추가하지 말 것(모노크롬 원칙, 아래 참조).

배경(사이드바·탑바, ink) #0B0B0B / #171716(서페이스) / #2E2E2B(선)
배경(본문 영역, paper)   #F4F3EF / #E7E5DF(서페이스) / #D2CFC7(선)
텍스트  ink #0B0B0B (본문 영역 primary) / paper #F4F3EF (사이드바·탑바 primary)
       mute-dk #8C8A83 (ink 배경 위 보조) / mute-lt #6B6963 (paper 배경 위 보조)

accent — 없음(모노크롬 원칙). 상태 구분은 색이 아니라 기호로:
  고가 ▲ (ink 배경 채움) / 저가 ▼ / 적정가 — (테두리만, 중립)
  에러 상태는 색 대신 "!" 접두사 + ink 굵게

폰트
  헤드라인/본문 Pretendard Variable (display 항목도 Pretendard 확정, 별도
                display 서체 없음 — 예전 Black Han Sans는 폐기)
  데이터/코드   IBM Plex Mono (가격 숫자, kicker 라벨, 코드 블록) — 예전
                JetBrains Mono에서 교체

레이아웃 규칙
  border-radius 전면 미사용(카드/버튼/인풋 전부 각짐), box-shadow 글로우
  전면 미사용 — hairline(1px) 보더로만 위계 표현
  CSS Grid에 "그리드 라인 트릭"(컨테이너 background + gap:1px) 쓸 때 자식
  개수가 고정이 아니면 빈 셀에 컨테이너 배경이 그대로 노출되는 버그 발생
  (build-grid에서 실측 발견) — 아이템 수가 가변인 그리드는 개별 카드에
  자체 border를 주는 방식 사용, flex-column 리스트(search-results 등)는
  자식이 항상 꽉 채워지므로 트릭 사용 가능

시그니처 요소
  판정 게이지 — 예전 SVG 반원 다이얼+니들에서 flat 수평 바(.gauge-track/
  .gauge-zone/.gauge-marker)로 교체. diff_percent를 ±30% 클램프해 바
  0~100% 위치에 매핑, VERDICT_THRESHOLD_PERCENT(±5%) 구간을 음영(.gauge-zone)
  으로 표시

스펙시트 컴포넌트 (2026-08-05 2차 — 참조 디자인 요소 추가 이식)
  .strip/.st        4칸 고정 스탯 스트립(빌드 상세 상단 요약). 셀 수가 항상
                    4로 고정이라 위의 "빈 셀 노출" 함정에 해당 없음
  .total-row        큰 총액 숫자 + 우측 메타 블록
  .confirm-row      견적↔판매가 대비(.confirm-num 2개 + .confirm-arrow),
                    .diff-badge로 차액·증감률 표기
  .sec-head         섹션 제목 + 우측 note (하단 1px ink 룰)
  .grp              부품 그룹 헤더(연산부/그래픽/…), ::after로 우측 채움선
  .spec-row         부품 행 3열(.spec-cat | .spec-name+.spec-desc | .spec-price)
  .prop-bar         부품별 총액 비중 바(참조 디자인 .sp-bar)
  .sum              소계(상단 2px ink 룰)
  .build-summary    빌드 생성 화면 하단 sticky 러닝 총액 + 진행 틱(.bs-tick)
  .rv               스크롤/마운트 리빌(prefers-reduced-motion에서 무효화)

숫자 정렬 규칙 (중요)
  가격이 열로 정렬되려면 자릿수 폭이 같아야 함 — 모노 폰트를 쓰는 클래스는
  전부 font-variant-numeric:tabular-nums 적용(global.css 상단 셀렉터 목록).
  새 가격 표시 클래스를 추가하면 그 목록에도 같이 넣을 것

인쇄
  빌드 상세는 견적서로 출력 가능해야 함 — @page margin 14mm, 사이드바/탑바/
  버튼/sticky 요약은 @media print에서 숨김, .spec-row/.strip/.sum은
  break-inside:avoid
```

---

## 산출물 파일 목록
```
/mnt/user-data/outputs/silga-mockup.html       랜딩형 목업 (참고용, 앱 셸로 대체됨)
/mnt/user-data/outputs/app-shell-mockup.html   초기 채택 목업 — frontend/에 실제 구현으로 대체됨
/mnt/user-data/outputs/ppe-final.zip           2026-08-03 세션 최종 산출물 — git 리포 전체
                                                (backend/ frontend/ scripts/ + 커밋 4개)
                                                ※ 컨테이너 세션 리셋되므로 로컬 보관 후
                                                  GitHub 원격 리포에 push 권장 (README.md 참조)
```
