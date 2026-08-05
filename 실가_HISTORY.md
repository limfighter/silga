# 실가 HISTORY — 변경 이력 (append-only)

---

### 2026-08-03

#### v0 — 프로젝트 설계 착수, 목업 2건 제작

[✓] 배경
    → 쿠팡 조립PC(참쉬운PC) 스펙 대비 가격 적정성을 다나와 최저가 기준으로
      직접 검증하는 과정에서, 이 작업 자체를 자동화하는 개인용 도구 아이디어로 발전
    → 용도를 웹앱(개인 사용) + AI 라우터 경유지(Claude가 부품 가격을 바로
      조회할 수 있는 구조화된 엔드포인트) 두 가지로 정의

[✓] 목업 1 — 랜딩형 (silga-mockup.html)
    → 다크+네온(시안/마젠타/앰버) 톤, "정가 말고 실가" 컨셉
    → 판정 게이지(SVG 반원 다이얼), 부품 breakdown, 가격 히스토리
      오실로스코프 차트, API 터미널 목업 섹션 포함
    → 이후 "내 가이드 톤대로 짠 것"으로 판단, 앱 셸 쪵으로 요소 이식하고
      랜딩 자체는 보류

[✓] 목업 2 — 앱 셸 (app-shell-mockup.html), 최종 채택
    → 좌측 사이드바(아이콘 레일 72px ↔ 240px 확장, 햄버거 토글) + 7탭
      구조: 홈/검색/빌드/즐겨찾기/최근기록/통계/설정
    → 빌드 탭 3단계 흐름 구현: 목록(카드형, 적정가/고가/저가 태그) →
      생성(부품 카테고리별 입력 폼) → 상세(목업1의 판정 게이지+breakdown 재사용)
    → 나머지 6개 탭은 "준비 중" 빈 상태로만 존재 (의도적 — 다음 세션에 채울 것)
    → 순수 정적 목업, 데이터 fetch 없음 (JS는 탭/뷰 전환만)

[✓] 데이터소스 후보 조사
    → danawa-py (MineEric64, Apache-2.0) 발견 — 다나와 비공식 API 파이썬
      패키지, get_product_codes/get_product/get_price_variance 3개 함수
      제공. 커밋 9개뿐이라 신뢰도 미검증 상태로 1순위 후보 등재
    → sammy310/Danawa-Crawler (MIT) 발견 — Scrapy+Selenium, GitHub Actions로
      매일 09:00 KST 자동 실행 확인(2,298 커밋, 현재도 살아있음) — 대체
      수단/셀렉터 참고용으로 등재
    → 다나와 공식 오픈API(api.danawa.com) 2012년 공개 이력 확인, 단
      robots.txt 차단으로 자동 조회 불가 + "가격정보" 포함 여부 불확실
      → 미검증 상태로 남김 (사람이 직접 브라우저 확인 필요)

[✓] API 계약 초안 확정
    → GET /search, GET /product/{code}, GET /product/{code}/history,
      POST /estimate, GET /product/{code}/compare 5개
    → 응답에 사람용 formatted 필드 + AI/계산용 raw 필드 동시 포함 원칙 확정
      (응답 이원화하지 않음)

[✓] 문서 체계 도입
    → GTHV 프로젝트의 3파일 인수인계 체계(REFERENCE/인수인계/HISTORY)를
      그대로 이식, 임시 코드네임 PPE(Parts Price Engine) 부여
    → GTHV 대비 차이점 명시: 시간대 KST 통일(GTHV는 UTC), "실행 중인
      프로세스"/"장애 대응" 등 배포 이후 섹션은 아직 미작성(로컬 개발
      단계라 해당 없음)

[✓] 홈 탭 구성 확정 — "동향" 섹션
    → 카테고리별 아코디언(CPU/GPU/RAM/SSD/파워 등), 접힘=미니 스파크라인+등락,
      펼침=추적 상품 상세 그래프. 사이드바 신규 탭 대신 홈 안 섹션으로 결정
      (통계 탭과 역할 중복 방지 — 홈은 훑어보기, 통계는 상품 1개 딥다이브)
    → 추적 상품은 즐겨찾기 탭에서 선택하는 구조로 확정 (별도 선택 UI 안 만듦)
    → 참고: 시중 램 가격 그래프(퀘이사존 등)는 카테고리 전체 평균이 아니라
      "대표 상품 1개 코드"의 최저가 히스토리 방식임을 확인 —
      get_price_variance(product_code, months) 그대로 대응 가능, 별도
      카테고리 집계 API 불필요

[✓] 기술 스택 전체 확정
    → DB: SQLite(WAL) 채택, Postgres는 규모 커지면 이전
    → 웹 프론트: Vite+React+TS+React Router (Next.js 미채택 — SSR 불필요,
      Flutter 이식 시 라우팅 매핑 단순화 목적)
    → 서버상태: TanStack Query / 차트: Recharts(게이지만 SVG 직접 구현 유지)
    → 스타일: 바닐라 CSS + 기존 디자인 토큰 (Tailwind 미채택 — 토큰 시스템과 충돌)
    → REFERENCE.md #기술-스택 섹션에 전체 반영 완료

[ ] 다음 세션 시작 시
    → 실가_인수인계.md "검증 안 된 항목" 최우선 확인 (danawa-py 실동작 테스트)

---

#### v1 — danawa-py 실동작 검증 + 패치 (danawa_patched.py)

[✓] get_product_codes / get_product / get_price_variance 3개 함수 순차 테스트
    → 3개 다 예외 없이 호출은 됐으나 2개는 필드 파싱 실패 확인
    → get_price_variance는 원본 그대로 정상 (min/max/prices 전부 정상,
      2026-07 실데이터로 확인)

[✓] get_product_codes 원인 분석 + 패치
    → 원인 1: 검색어를 URL 인코딩 없이 그대로 format() → 한글 키워드
      검색 시 항상 0건 반환 (quote() 추가로 해결)
    → 원인 2: 결과 li 태그 클래스가 카테고리마다 다름. GPU 검색은 우연히
      원본 코드의 고정 셀렉터(li.prod_item.width_change)와 일치해서
      정상 동작했지만, CPU/RAM/SSD 등은 li 클래스가 prod_item 단독이라
      전부 0건 반환. class_ 매칭을 "prod_item 포함 여부"로 완화해서
      4개 카테고리(GPU/CPU/RAM/SSD) 전부 정상 확인, title/price 누락 0건

[✓] get_product 원인 분석 + 패치
    → 원인: 다나와 상품 상세 페이지의 최저가 영역 클래스가 lowest_area →
      price-summary로 개편되어 있었음(제작 시점 이후 다나와 측 변경으로
      추정). 기존 셀렉터가 신 구조에서 아무것도 못 찾아 lowest_price/
      prices가 항상 빈 값
    → 최저가: 렌더링 텍스트 대신 input#min_price_{code} hidden value
      사용으로 변경 (파싱 리스크 더 낮음)
    → 판매처 리스트: div.price-summary > ul.list__mall-price 로 재매핑,
      쇼핑몰명(대형몰=img alt / 소형몰=span.text__logo 텍스트 두 케이스
      모두 대응) + 최저가 배지 여부(is_lowest) 추가로 포함
    → GPU(PALIT 5070 Ti), CPU(9800X3D) 등 여러 상품에서 교차 검증, 정상

[✓] 판매처 리스트 이상 패턴 발견 (미해결 — 결정 필요 항목으로 등재)
    → 리스트 맨 끝에 다나와 자체 "최저가" 배지보다 더 싼 판매처가 종종
      섞여 나옴 (예: 배지 681,070원인데 리스트 끝에 630,000원 존재)
    → 안전결제 미지원 등 다나와가 최저가 산정에서 의도적으로 제외한
      판매처로 추정되나 확인은 안 됨. 실측 합계 계산 시 이 항목을
      신뢰할지는 인수인계.md "결정 필요" 섹션에 등재, 다음 세션 논의

[✓] variants(유형별 최저가 비교) 필드 신규 발견 + 추가
    → summary_info 바깥의 별도 섹션(section.variant-selector)에 정품/
      벌크/해외구매 등 "다른 구성" 비교 리스트가 정적 HTML로 이미
      렌더링되어 있음을 발견 (JS/AJAX 불필요, requests만으로 파싱 가능)
    → 각 유형마다 고유 pcode가 href에 포함돼 있어 get_product() 재귀
      호출로 해당 유형 자체를 그대로 조회 가능
    → 실측 사례: 라이젠7 9800X3D 해외구매가 국내 최저가 대비 -36%
      (681,070원 vs 432,200원, 61개 몰) — 조립PC 적정가 판정 로직에
      영향 클 수 있는 폭이라 API 계약(REFERENCE.md) 반영 여부를
      인수인계.md "결정 필요" 섹션에 등재, 다음 세션 논의
    → GPU(5070 Ti)처럼 variants 자체가 없는(단일 유형만 존재) 카테고리도
      확인, 필드 없을 때 자연스럽게 생략되도록 처리함

[✓] 패키징 방식 확인
    → PyPI 미등록(pip install 불가), setup.py/pyproject.toml도 없어서
      git URL 기반 pip 설치도 불가 → danawa_patched.py를 프로젝트에
      직접 vendoring(파일 복사)하는 방식으로 가야 함 확정

[ ] 다음 세션 시작 시
    → danawa_patched.py 실가 프로젝트 정식 경로 편입
    → "결정 필요" 2개 항목(variants API 반영 여부, prices 마지막 항목
      신뢰도) 논의 후 FastAPI 스켈레톤 착수

---

#### v2 — "결정 필요" 2개 항목 확정 (같은 세션 내 후속 논의)

[✓] variants(정품/벌크/해외구매 등) API 반영 여부 → 포함하되 참고 정보로 한정
    → /product/{code} 응답에 variants 필드로 노출
    → /estimate, /compare(실측 합계·판정 게이지) 계산에는 절대 미반영
      (해외구매는 통관/배송지연/AS불가 등 리스크가 근본적으로 달라
      판정 로직 오염 우려)
    → 빌드 상세 화면엔 "해외구매 참고가" 부가 라인으로만 표시, 합계
      계산에서는 제외하기로 확정
    → REFERENCE.md #엔드포인트-설계에 반영 완료

[✓] prices 리스트 마지막 항목 신뢰도 처리 → lowest_price 단일 기준 원칙 확정
    → 실측 합계/판정 계산은 항상 다나와 공식 lowest_price 필드만 사용
    → prices 리스트는 화면 표시(판매처 UI) 전용, 이 리스트로 직접 min()
      계산해서 최저가로 쓰는 로직은 금지 원칙으로 명문화
    → 근거: 리스트에 다나와가 최저가 산정에서 제외한 판매처가 섞여
      있고(신뢰도), 스크래핑 리스트 자체도 상위 일부만 잘려 있음(완전성)
    → REFERENCE.md #엔드포인트-설계 설계 원칙에 반영 완료

[ ] 다음 세션 시작 시
    → 두 결정 다 완료된 상태이므로 바로 FastAPI 스켈레톤 착수 가능
    → 착수 전 danawa_patched.py 정식 경로 편입만 먼저 처리

---

#### v3 — 저장소 구조 / DB 스키마 / 배포 후보 논의 (같은 세션 내 후속 논의)

[✓] 저장소 구조 → backend/ + frontend/ 2개로 확정
    → API는 backend(FastAPI) 안에 포함, 별도 폴더로 안 쪼갬
    → Flutter 이식 시점(Phase 5)에 flutter/ 추가되어 3개 체제로 전환 예정

[✓] DB에 정보를 쌓아 통계에 반영하는 방향 논의 → price_history 테이블은
    안 만들기로 결정 (오버엔지니어링 판단, 사용자 본인이 직접 캐치함)
    → 처음엔 "빌드 총액 히스토리 추적"을 위해 스케줄러+가격 스냅샷 테이블을
      고려했으나, danawa의 get_price_variance()를 그때그때 호출해서
      build_items의 product_code들로 합산하면 되는 문제라 결론
    → 최종 DB 스키마: products(캐시) / builds / build_items 3개 테이블만.
      APScheduler는 계속 우선순위 낮음 유지

[✓] 배포 플랫폼 후보 논의 (결정은 계속 보류, 후보만 갱신)
    → 사용자가 GCP(VM/Workers/Cloud Run) 경험 있음 확인
    → Cloud Run: SQLite를 GCS FUSE 마운트해야 해서 단일 인스턴스 고정
      필요 — "확장성 커진다"는 통념과 달리 SQLite 쓰는 한 서버리스
      자동확장 이점을 사실상 못 씀 (진짜 확장엔 Postgres 이전이 정공법)
    → VM(Compute Engine): 지금 스택 무수정 배포되지만 확장은 오히려 수동
      (Cloud Run보다 확장성이 작다는 점을 짚고 넘어감)
    → Cloudflare(Workers)는 후보에서 제외 확정 — Python Pyodide 경유라
      FastAPI가 그대로 안 올라가고 SQLite도 D1/Durable Objects로 갈아타야
      해서 스택 재설계 수준 변경 필요
    → 지금 트래픽 규모에서 확장성 차이가 사실상 없어 결정 자체를 계속
      미루기로 함 (원격 접근 필요해지는 시점까지)

[ ] 다음 세션 시작 시
    → 저장소 구조 실제 생성(backend/frontend 폴더) →
      danawa_patched.py를 backend/app/services/danawa.py로 편입 →
      FastAPI 스켈레톤 + /search, /product/{code} 구현 순서로 진행

---

### 2026-08-04

#### v4 — verdict 판정 기준가에 이동평균 도입 (백엔드만, 라이브 미검증)

[✓] 배경 논의
    → verdict가 조회 시점의 순간 스크래핑 값(즉시가) 하나로만 판정돼서,
      부품이 일시 특가/재고 급변으로 순간 폭락·폭등하면 같은 빌드인데도
      조회 타이밍에 따라 고가↔저가↔적정가로 판정이 오락가락하는 문제 논의
    → verdict 임계값(±5%, 대칭) 자체는 그대로 유지하기로 확정 — 비대칭
      임계값(고가/저가 다르게)도 검토했으나 채택 안 함

[✓] 설계 확정
    → estimate_total/total_price(견적가)는 즉시가 그대로 유지, verdict
      판정 기준가(verdict_basis_price)만 부품별 이동평균으로 분리
    → 이동평균 기간은 ma_window(7/14/30일, 기본 14)로 사용자 선택 —
      danawa.get_price_variance(code, 1)의 daily 시계열 재사용, 신규
      스크래핑 함수 없음
    → "엄격" 원칙: 선택 기간만큼 daily 데이터가 정확히 다 있어야 유효,
      모자란 부품은 이동평균 무효
    → 이동평균 무효 부품은 즉시가로 fallback해서 합산 계속 진행 —
      빌드 전체 판정을 null로 날리지 않고, 대신 verdict_confidence
      ("high"/"low") + verdict_basis_breakdown(부품별 source: "ma"|
      "current_fallback")로 신뢰도 투명하게 노출
    → GET /builds, GET /builds/{id} 전용 (build_id, ma_window) 키 5분
      프로세스 메모리 캐시 도입 — 목록이 저장된 빌드를 매번 순회
      재계산하는 구조라 이동평균 도입으로 스크래핑이 부품당 2배(get_product
      + get_price_variance)가 되는 부담 + 목록↔상세 이동 시 캐시 미스
      타이밍 차이로 판정이 다르게 뜨는 문제를 함께 완화

[✓] 백엔드 구현 완료
    → services/verdict.py: compute_ma_price() 신규
    → main.py: _fetch_ma_price(), _compute_verdict_basis(),
      _get_cached_verdict_basis() 신규. /product/{code}/compare,
      /build/compare, GET /builds, GET /builds/{id} 4개 엔드포인트에
      ma_window + verdict_basis_* 필드 반영
    → schemas/compare.py: VerdictBasisItem 신규. schemas/estimate.py,
      build.py에 필드 추가
    → REFERENCE.md #엔드포인트-설계에 "verdict 판정 기준가(basis_price) —
      이동평균 도입" 섹션 신설, 4개 엔드포인트 계약 갱신

[!] 개발 중 발견 — Literal 쿼리파라미터 캐스팅 버그
    → ma_window를 Literal[7,14,30] 타입으로 쿼리파라미터에 바로 선언하면
      fastapi 0.141.1 / pydantic 2.13.4 조합에서 쿼리스트링("14", str)을
      int로 캐스팅하지 않고 422 에러를 내버리는 문제 실측 확인 (JSON
      body의 Literal 필드는 정상 동작 — 쿼리파라미터에서만 발생)
    → int 타입 + 수동 검증(허용값 아니면 422)으로 변경해서 해결,
      /product/{code}/history의 months 검증과 동일 패턴으로 통일
    → FastAPI TestClient + danawa 함수 mock으로 이동평균 정상/fallback/
      캐시 동작 전부 로컬 검증 완료

[!] 미해결(당시) — 라이브 다나와 검증 안 됨
    → 이 개발 세션은 네트워크 정책상 danawa.com 접근 자체가 차단돼 있어
      (prod.danawa.com 프록시 403) get_price_variance()의 실제 응답
      포맷(특히 prices 리스트의 full_date 필드 존재 여부/포맷, 정렬 순서)을
      라이브로 확인 못 함
    → compute_ma_price()는 리스트 원본 순서를 신뢰하지 않고 매번 full_date로
      명시 정렬하도록 방어적으로 구현했지만, 로컬 환경에서 실제 호출로
      반드시 재검증 필요 (실가_인수인계.md "결정 완료" 참조)
    → 사용자가 로컬 환경에서 실측 → 아래 v5 참조, 같은 날 바로 수정

---

#### v5 — compute_ma_price 실측 기반 재설계 (같은 날, 사용자 로컬 라이브 검증 결과 반영)

[✓] 사용자 로컬 실측 결과 (RTX5070Ti, 76465883, get_price_variance(code, 1))
    → full_date 포맷 확인: "YY-MM-DD"(예: "26-05-12") — 사전순 정렬이
      날짜순과 일치함(정렬 로직 자체는 문제없었음)
    → ⚠️ 치명적 발견: 다나와가 daily가 아니라 **주 단위**로 데이터를 줌
      (1개월치 조회해도 포인트가 4개 안팎, 7일 간격). v4에서 "daily 시계열"
      이라고 가정하고 짠 "정확히 window개 항목 있어야 유효"(엄격 원칙)가
      이 주기에서는 항상 실패 — window=7/14/30 뭘 골라도 4개 < window라서
      MA가 무조건 None(즉시가로만 fallback)이 나오는 걸 실측으로 확인
      (compute_ma_price([...4개...], 7/14/30) 전부 None으로 재현됨)

[✓] compute_ma_price() 재설계
    → "정확히 N개 항목" 기준을 폐기하고 "날짜 기준 최근 window일 이내
      데이터를 모아 평균 + 히스토리 자체가 window일 전체를 커버해야 유효"로
      "엄격" 원칙 재정의 (가장 오래된 데이터가 cutoff 이전부터 있어야
      "그 기간 전체를 실제로 관측했다"고 신뢰 가능 — 신상품처럼 히스토리
      자체가 짧으면 여전히 무효 처리)
    → full_date를 datetime으로 명시 파싱("%y-%m-%d")해서 날짜 구간 계산
    → _fetch_ma_price(main.py)가 get_price_variance(code, 1) 대신
      get_price_variance(code, 3)(3개월치) 호출하도록 변경 — 주 단위
      데이터라 1개월치(~4개)만으로는 window=30일 커버리지 체크를 통과할
      데이터 자체가 부족해서, 여유 있게 3개월치를 받아둠
    → 사용자 실측 데이터 + 신상품(짧은 히스토리) 케이스로 재검증 완료,
      기존 mock 엔드포인트 테스트도 3개월치 주간 데이터로 다시 돌려 통과 확인

[✓] 다음 세션 시작 시
    → 프론트 연동(설정 탭 ma_window 드롭다운 + localStorage, Search/
      BuildCreate/BuildDetail에서 compare 호출 시 값 실어 보내기) 착수
    → PR #2 draft 해제 검토 (이번 실측 반영 완료 기준) — 완료, main에 머지됨
    → 아래 v6에서 프론트 연동 진행

---

### 2026-08-04 (같은 날, PR #2 머지 후 이어서)

#### v6 — verdict 이동평균 프론트 연동 (설정 탭 + localStorage + 목록/상세)

[✓] frontend/src/lib/settings.ts 신규
    → MA_WINDOW_OPTIONS([7,14,30] as const), DEFAULT_MA_WINDOW(14),
      getStoredMaWindow(), useMaWindow() 훅 — localStorage 키
      "silga:ma_window"에 저장, 값이 7/14/30 중 하나가 아니면(빈 값/오염된
      값 포함) 14로 폴백
    → 페이지 전환마다 useState 초기값을 localStorage에서 새로 읽어오는
      방식 — 같은 화면 내 실시간 동기화(storage 이벤트 리스너)는 개인용
      SPA 규모에 과설계라 판단해 넣지 않음(라우트 이동 시 리마운트로 충분)

[✓] frontend/src/pages/SettingsPage.tsx 신규, App.tsx의 /settings 라우트를
    PlaceholderPage → SettingsPage로 교체
    → 드롭다운(7일/14일/30일) 하나만 있는 최소 구성, 변경 즉시
      localStorage 저장(별도 저장 버튼 없음)
    → "이 기기에만 저장됩니다" 안내 문구로 서버 저장이 아님을 명시

[✓] frontend/src/lib/api.ts 갱신
    → BuildSummary에 verdict_confidence/ma_window 필드 추가,
      BuildDetail에 verdict_basis_price(_formatted)/verdict_confidence/
      verdict_basis_breakdown/ma_window 필드 추가, VerdictBasisItem
      인터페이스 신규 (backend/app/schemas/build.py, compare.py와 1:1 대응)
    → listBuilds/getBuild가 ma_window를 필수 인자로 받아 쿼리스트링에 실어
      보내도록 시그니처 변경(하드코딩된 기본값 14 의존 제거)

[✓] BuildListPage/BuildDetailPage가 useMaWindow() 훅으로 설정값을 읽어
    listBuilds(maWindow)/getBuild(id, maWindow) 호출 + TanStack Query
    queryKey에 maWindow 포함(다른 기간 선택 시 새로 fetch, 캐시 안 섞임)
    → BuildDetailPage에 "판정 기준: N일 이동평균" 안내 텍스트 추가,
      verdict_confidence가 "low"면 "일부 부품은 데이터 부족으로 즉시가
      대체" 문구 덧붙여 신뢰도를 화면에서도 투명하게 노출
      (REFERENCE.md #엔드포인트-설계 verdict_confidence 설계 취지 반영)

[✓] BuildCreatePage
    → POST /builds는 ma_window를 받지 않음(생성 직후엔 verdict 자체가
      null — REFERENCE.md 참조), 그래서 API 호출 자체는 변경 없음. 대신
      "비교할 판매가" 입력란 아래에 "저장 후 판정은 N일 이동평균
      기준가로 계산됩니다(설정 탭에서 변경 가능)" 안내만 추가 — 저장 직후
      이동하는 BuildDetailPage가 어차피 설정값을 자동으로 물고 가므로
      실질적 연동은 이미 BuildDetailPage 쪽에서 끝나 있음

[✓] SearchPage
    → 확인 결과 /search 엔드포인트 자체가 market_price/ma_window를 받지
      않고 판정(compare) 기능도 검색 화면에 없어(단순 목록) ma_window와
      무관 — 인수인계 문서의 "Search 연동"은 검색 결과에서 바로 비교하는
      기능이 아직 없다는 뜻이었던 것으로 판단, 변경 없음 (향후 검색
      결과에 "비교" 버튼을 추가하는 게 결정되면 그때 GET
      /product/{code}/compare?ma_window= 연동 필요)

[✓] 검증
    → npm run typecheck, npm run build 통과
    → Playwright로 실브라우저 검증: 설정 탭 드롭다운 선택 → localStorage
      반영 → 빌드 목록 페이지 이동 시 실제 네트워크 요청이
      `/builds?ma_window={선택값}`으로 나가는 것 확인, 빌드 상세도
      `/builds/{id}?ma_window={선택값}` 확인
    → 이 세션 환경은 프록시가 danawa.com 접근을 막아(실측: ProxyError
      403) 실제 다나와 데이터로는 검증 불가 → danawa.get_product/
      get_price_variance를 목(mock)으로 교체해 verdict_confidence="high"/
      "low", 판정 기준 문구, 게이지 렌더링까지 화면에서 직접 확인함

[발견, 같은 날 이어서 수정] GET /builds, GET /builds/{id}가 danawa 연결
    자체가 끊겼을 때(requests.RequestException) 처리가 안 돼 있음
    → main.py::_fetch_lowest_price()가 danawa.get_product() 호출을
      try/except로 감싸지 않아서, 네트워크 장애 시 CLAUDE.md 원칙(스크래퍼
      장애→503)을 못 지키고 500으로 죽는 걸 이번 세션에서 실측 확인
      (GET /product/{code}는 get_product_detail()에서 자체적으로
      감싸고 있어 이 문제 없음 — _fetch_lowest_price를 공유하는
      /estimate, /product/{code}/compare, /build/compare, GET /builds,
      GET /builds/{id} 5곳이 전부 같은 결함 있음)
    → v6 시점엔 프론트 연동 세션 범위 밖이라 기록만 남기고 미수정 —
      아래 v7에서 같은 날 이어서 수정

---

### 2026-08-04 (같은 날, v6 이어서)

#### v7 — _fetch_lowest_price() danawa 연결 장애 처리 수정 (v0.4.2)

[✓] 방향 결정: "엔드포인트별 기존 선례 따르기" 채택 (사용자 확인)
    → 새 정책을 만들지 않고, 저장소에 이미 있던 두 선례를 각 호출부
      성격에 맞게 그대로 적용
        - GET /product/{code}(get_product_detail): 연결 장애 → 즉시 503
        - POST /builds(create_build) / _fetch_ma_price: 부품별로 실패를
          삼키고 그 부품만 정보 없음 처리, 나머지는 계속 진행
    → _fetch_lowest_price() 자체는 그대로 두고(예외를 그대로 던짐),
      호출부 2곳에서 각자 다르게 감싸는 방식으로 구현 — 헬퍼 하나가
      단일상품/다중부품 두 성격을 동시에 만족시키려던 게 애초 결함의
      원인이었음

[✓] 구현 (backend/app/main.py)
    → compare_single_product(GET /product/{code}/compare): 호출부를
      try/except RequestException으로 감싸 503 반환 — get_product_detail과
      동일 패턴
    → _compute_estimate(POST /estimate, POST /build/compare, GET
      /builds, GET /builds/{id}가 공유): 루프 내부에서 항목별로
      try/except RequestException → title/price를 (None, None) 처리하고
      다음 항목 계속 진행 — create_build/_fetch_ma_price와 동일 패턴

[✓] 검증 (이 세션 환경은 프록시가 danawa.com을 막고 있어 실제
    RequestException이 매 요청마다 자연 발생 — 별도 mock 없이 실측 가능했음)
    → GET /product/{code}/compare → 503 "데이터 소스(다나와) 연결 실패"
      확인 (수정 전엔 500 unhandled exception이었음)
    → GET /builds, GET /builds/{id}, POST /estimate → 200으로 정상
      응답, 가격 조회 실패한 부품은 title/price null로 표시되고 나머지
      응답 구조는 정상 (수정 전엔 500으로 전체가 죽었음)
    → POST /build/compare → 부품 전부 가격 조회 실패 시 기존 로직대로
      404 "부품 가격을 하나도 찾지 못해 판정 불가" — 이건 total_price==0
      체크로 원래 있던 정상 분기라 회귀 아님, 확인만 함

---

### 2026-08-04 (같은 날, v7 이어서)

#### v8 — category·cash_price 필드 스크래퍼 구현 (v0.4.3)

[✓] 배경 — 이 세션 환경은 프록시 정책으로 danawa.com 자체가 막혀 있어
    (WebFetch도 403) 실제 페이지 HTML을 볼 방법이 없었음. 사용자에게
    로컬 브라우저에서 상품 페이지 소스보기(Ctrl+U) 전체를 복사해서
    붙여넣어 달라고 요청 → GPU(PALIT RTX5070Ti, pcode=76465883, 일시
    품절 상태)와 CPU(AMD 라이젠7 9800X3D, pcode=70531547) 두 상품의 실제
    HTML 원문을 확보해서 그걸로 구현

[✓] category(카테고리 브레드크럼) 구현
    → 실측 결과: div.location_wrap 안에 중첩된 loca_item 버튼들(각각
      "컴퓨터/노트북/조립PC", "주요부품", "그래픽카드(GPU)" 등)을 DOM으로
      직접 조립하는 대신, 페이지 하단 인라인 <script> 안의
      oGlobalSetting.sUICategoryName 값이 이미 완성된 형태로 있었음:
      `sUICategoryName: "컴퓨터/노트북/조립PC &gt; 주요부품 &gt; 그래픽카드(GPU)"`
      (CPU 페이지는 `"... &gt; CPU &gt; AMD"`) — HTML 엔티티(&gt;)만
      unescape하면 바로 쓸 수 있는 단일 문자열이라 이쪽을 채택
    → 정규식 `sUICategoryName:\s*"([^"]*)"` + html.unescape()로 파싱,
      두 샘플 페이지 모두에서 정확히 1회씩만 등장하는 것 육안 확인
      (다른 곳에 같은 패턴 없어 오탐 위험 낮음)

[✓] cash_price(현금최저가) 구현 — 최초 가정이 틀렸던 걸 실측으로 발견
    → 최초 가정(TODO 주석에 적혀 있던 것): "카드가/현금가 비교" — 노트북
      등 일부 카테고리에만 있는 기능일 거라 예상
    → 실측 결과: GPU 페이지엔 관련 텍스트가 전혀 없었음(해당 상품이
      일시 품절이라 가격 정보 자체가 없어서였을 수도 있음, 확정 못함).
      CPU 페이지엔 있었음 — 다만 "카드가 vs 현금가 비교"가 아니라,
      쇼핑몰별 최저가 목록(list__mall-price) 중 현금결제 전용으로
      표시된 판매처(span.badge__cash)의 최저가였음. 이 상품은 최저가
      681,360원과 현금최저가 630,000원이 서로 다른 값으로 확인됨
    → 파싱 위치: 우리가 이미 스크래핑하는 쇼핑몰별 가격 목록(prices)에서
      badge__cash 항목을 직접 찾아 최솟값을 구하는 방법도 가능했지만,
      그 목록 자체가 상위 약 10건만 잘려 있어(REFERENCE.md #엔드포인트
      -설계 기존 원칙) 절단 구간 밖의 진짜 최저 현금가를 놓칠 위험이
      있음 → 대신 다나와가 이미 전체 목록 기준으로 계산해서
      og:description 메타태그에 넣어주는 값(`"최저가 681,360원,
      현금최저가: 630,000원"`)을 그대로 신뢰하기로 함
    → 정규식 `현금최저가:\s*([\d,]+)원`으로 파싱, 값 없는 상품(GPU 샘플)은
      필드 자체 생략 → cash_price=None (파싱 실패 아니라 정상적으로
      없는 값으로 처리)

[✓] 구현 반영
    → backend/app/services/danawa.py::get_product(): 위 정규식 2개 추가
      (import html 추가), 기존 title/spec/price-summary/variants 파싱
      로직은 손대지 않음
    → backend/app/main.py::get_product_detail(): category=None,
      cash_price=None으로 하드코딩돼 있던 부분을 data.get()으로 교체,
      "미구현" 주석 제거
    → backend/app/schemas/product.py: category/cash_price 필드의
      TODO(미구현) 주석을 실제 파싱 방식 설명으로 교체

[✓] 검증
    → 정규식은 사용자가 준 실제 HTML 조각(sUICategoryName 라인,
      og:description 메타태그 라인)을 그대로 떼어내 파이썬으로 직접
      매칭 테스트 — category/cash_price 정상 추출, 값 없는 케이스(GPU
      og:description)도 None으로 정상 처리 확인
    → 전체 페이지 단위 왕복 재현(mock 서버로 danawa.get_product 전체
      플로우 실행)까지는 하지 않음 — 조각 단위 검증 + 패턴이 각 페이지에
      정확히 1회씩만 등장한다는 것 확인으로 충분하다고 판단. 다른
      카테고리(RAM/SSD/케이스/파워/쿨러/메인보드)에서의 실측은 아직 안 함
      — 두 필드 다 없는 상품에서 필드 생략(None)으로 안전하게 폴백되므로
      당장 깨질 위험은 낮다고 판단, 다만 다른 카테고리 페이지에서 다른
      구조가 나올 가능성은 남아있는 known gap

---

### 2026-08-04 (같은 날, v8 이어서)

#### v9 — 통계 탭 가격 히스토리 차트 구현 (frontend v0.3)

[✓] 대상 선정 — 홈/즐겨찾기/최근기록/통계 4개 탭 중 통계만 먼저 진행하기로
    사용자와 합의. 나머지 3개는 스펙 자체가 없거나(즐겨찾기/최근기록) 내용
    설계가 안 끝나서(홈) 임의로 손대지 않기로 함(실가_인수인계.md 참조)

[✓] 구현
    → frontend/src/pages/StatsPage.tsx 신규 — PartRow(빌드 생성 화면
      자동완성과 동일 컴포넌트, category prop만 다르게 줘서 재사용) +
      1/3/6/12개월 탭 + 오실로스코프풍 SVG 차트
    → API: lib/api.ts에 PricePoint/PriceHistory 타입, getHistory(code,
      months) 함수 추가 — GET /product/{code}/history는 이미 백엔드에
      구현/검증돼 있던 엔드포인트라 새 백엔드 작업 없음
    → 차트는 silga-mockup.html #history 섹션의 SVG(그래디언트 채움 +
      glow 필터 + 그리드 라인, 시안 네온)를 그대로 이식하되, 정적
      좌표 대신 prices 배열 길이/최소/최대에 맞춰 매번 polyline 좌표를
      계산하도록 동적화(buildPoints 함수)
    → 통계값 3개: 최저/최고는 응답의 min/max 필드 그대로 사용(별도 계산
      안 함 — 응답 자체가 이미 다나와 기준 최저/최고), "현재"는 history의
      마지막 포인트가 아니라 검색 시점에 PartRow가 이미 들고 있는 실측
      lowest_price 사용 — history가 주 단위 데이터라 마지막 포인트가
      최대 며칠 전 값일 수 있어(2026-08-04 앞서 발견한 사실) "현재"라고
      표시하면 오해 소지가 있다고 판단

[✓] 개발 중 발견한 문제 2건, 둘 다 그 자리에서 수정
    → 날짜 범위 라벨: 처음엔 prices[].date 필드로 "05.12 — 08.04"처럼
      표시했는데, mock으로 12개월 조회를 테스트하다가 1년 이상 차이나는
      두 시점이 연도 없이 같은 월.일로 보여서 헷갈리는 걸 발견(예:
      2025-08-12와 2026-08-04가 "08.12 — 08.04"로 표시돼 마치 최근인
      것처럼 보임) → full_date 필드("YY-MM-DD", 2026-08-04 앞서 실측
      확인된 포맷)가 있으면 그걸 우선 써서 "2025.08.12 — 2026.08.04"
      형태로 연도까지 표시하도록 수정
    → 자동완성 드롭다운 잘림: 새로 만든 .stats-picker에 다른 카드형
      컴포넌트들처럼 overflow:hidden을 넣었더니, PartRow의 자동완성
      목록(position:absolute)이 컨테이너 아래로 잘려서 하단 일부만
      보이는 문제 발견 → overflow:hidden 제거로 해결. 빌드 생성 화면의
      .part-rows(여러 행이 이어진 컨테이너)도 구조상 같은 CSS를 쓰고
      있어 이론적으로 같은 문제가 있을 수 있는데, 거기서는 아래에 다른
      행들이 있어서 드롭다운이 컨테이너 안쪽에 자연히 들어가 우연히
      안 드러났던 것으로 추정 — 이번엔 손대지 않음(범위 밖), 다음에
      비슷한 문제 재현되면 참고할 것

[✓] 검증 — 이 세션 환경은 danawa.com 접근이 막혀 있어 danawa.
    get_product_codes/get_product/get_price_variance를 mock으로 교체해서
    검색→선택→차트 렌더링 전체 흐름을 Playwright로 실브라우저 검증
    → 빈 상태(검색 전), 자동완성, 차트 렌더링(1개월 4포인트/12개월
      52포인트 등 데이터 개수 다른 케이스), 월 탭 전환 전부 확인
    → npm run typecheck, npm run build 통과

---

### 2026-08-04 (같은 날, v9 이어서)

#### v10 — 홈 탭 최근빌드 대시보드 구현 (frontend v0.4)

[✓] 범위 결정 — 홈/즐겨찾기/최근기록 3개 탭 중 홈부터 진행하기로 사용자와
    합의. 홈 탭 내용 후보 2개(최근 빌드 / 관심부품 변동) 중 "관심부품
    변동"은 즐겨찾기 기능 자체가 아직 스펙조차 없어 보여줄 데이터가 없다는
    이유로 제외, "최근 빌드 요약 + 빠른 액션"만 채택 — 기존 GET /builds
    하나로 새 백엔드/DB 작업 없이 끝낼 수 있는 범위

[✓] 구현
    → frontend/src/pages/HomePage.tsx 신규 — 상단 "새 빌드 만들기"/
      "부품 검색" 바로가기 버튼 2개(.home-actions, 새 CSS 한 줄만 추가),
      아래에 최근 빌드 최대 4개를 카드로 표시
    → GET /builds 응답은 정렬 순서를 보장하지 않아(main.py::list_builds가
      db.query(Build).all()로 순서 미지정 조회) 프론트에서 created_at
      기준 내림차순으로 정렬 후 상위 4개만 슬라이스
    → 빌드가 5개 이상이면 "전체보기" 링크로 /build(전체 목록) 이동,
      0개면 "새 빌드를 만들어서 가격을 추적해보세요" 빈 상태 표시
    → BuildListPage의 build-card/bc-tag 스타일을 그대로 재사용(tagClass
      함수는 3줄짜리라 굳이 공유 유틸로 안 빼고 각 페이지에 복제 —
      프로젝트 관례대로 과설계 지양)

[✓] 검증 — mock 백엔드로 POST /builds 5회 호출해서 테스트빌드 1~5 생성
    후 Playwright로 확인
    → 빈 상태(빌드 0개) 렌더링 확인
    → 5개 중 최근 4개(5,4,3,2번, created_at 내림차순)만 카드로 나오고
      "전체보기" 링크가 뜨는 것 확인
    → 카드 클릭 → /build/{id} 이동, "전체보기" 클릭 → /build 이동 둘 다
      확인
    → npm run typecheck, npm run build 통과

---

### 2026-08-04 (같은 날, v10 이어서 — PR #3 머지 후)

#### v11 — 최근기록 탭 구현 (frontend v0.5)

[✓] 범위 결정 — PR #3 머지 후 남은 즐겨찾기/최근기록 2개 탭 중 최근기록부터
    진행하기로 사용자와 합의(즐겨찾기는 새 DB 테이블이 필요해 더 무거움).
    이어서 "최근기록"이 정확히 뭘 기록할지도 결정 필요했음 — 이 앱엔 독립된
    상품 상세 페이지가 없어서(검색 결과를 클릭해도 어디로도 안 감) "조회"의
    정의 자체가 모호했음
    → 최종 채택: "최근 조회한 부품(상품)" — danawa 자체 헤더의 "최근 본
      상품" 드롭다운과 같은 개념. "최근 검색어"(정보량 적음)와 "최근 조회한
      빌드"(홈 탭 최근빌드와 사실상 중복)는 기각
    → 저장은 ma_window 설정과 동일하게 localStorage만 사용
      (silga:recent_products) — 인증/로그인이 없는 프로젝트라 "이
      브라우저에서"라는 전제가 항상 있고, 새 DB 테이블/엔드포인트가
      필요 없다고 판단
    → "조회" 계측 지점: 이 앱에서 특정 부품을 실제로 들여다보는 곳은
      (1) 통계 탭 부품 검색(가격 히스토리 조회), (2) 빌드 생성 화면
      부품 선택 — 둘 다 "조회"로 간주해서 두 군데 다 계측하기로 함

[✓] 구현
    → frontend/src/lib/recentProducts.ts 신규 — RecentProduct 타입(code,
      title, priceFormatted, viewedAt), getRecentProducts/addRecentProduct
      (같은 code 있으면 제거 후 맨 앞에 재삽입 — 최신순 유지)/
      removeRecentProduct/clearRecentProducts, MAX_RECENT_PRODUCTS=20
    → StatsPage.tsx: PartRow의 onSelect를 handleSelect로 감싸서
      addRecentProduct(part) 호출 추가. 추가로 useLocation().state를 초기
      선택값으로 사용하도록 확장 — RecentHistoryPage에서 넘어올 때 재검색
      없이 바로 그 부품의 차트가 뜨도록
    → BuildCreatePage.tsx: PartRow의 onSelect 인라인 콜백에도
      addRecentProduct(part) 한 줄 추가
    → frontend/src/pages/RecentHistoryPage.tsx 신규 — 목록(최신순),
      각 행 클릭 시 /stats로 이동하며 location.state로 {code, title,
      priceFormatted}를 실어 보냄(재검색 없이 바로 로드), 개별 삭제(×
      버튼, 클릭 시 Link 네비게이션 막으려고 preventDefault+stopPropagation
      필요), 전체 지우기, 빈 상태
    → global.css에 .recent-list/.recent-row 및 하위 요소(.nm/.code/.time/
      .pr/.remove) 스타일 추가 — 기존 .search-result-row와 비슷한
      톤이지만 항목 수가 더 많아(이름/코드/시각/가격/삭제버튼) 별도 클래스로
      분리

[✓] 검증 — 이 세션 환경은 danawa.com이 막혀 있어 mock 백엔드(search가
    쿼리와 무관하게 고정 2개 반환)로 진행
    → 통계 탭에서 서로 다른 부품 2개를 순서대로 선택 → 최근기록에
      최신순(나중에 본 게 위)으로 뜨는 것 확인
    → 첫 번째 테스트 시도에서 mock의 get_product_codes가 쿼리를 무시하고
      항상 같은 2개를 반환한다는 걸 놓쳐서 같은 상품을 두 번 선택하는
      테스트 버그 발생 → 두 번째 검색에서 자동완성 목록의 다른 인덱스를
      선택하도록 테스트 스크립트 수정해서 재검증
    → 최근기록 행 클릭 → /stats로 이동 + 해당 부품 차트 즉시 로드(재검색
      없이) 확인
    → 개별 삭제(2개 → 1개), 전체 지우기(1개 → 0개, 목록 비면 "전체
      지우기" 버튼도 같이 사라지는 것) 확인
    → npm run typecheck, npm run build 통과

---

### 2026-08-04 (같은 날, v11 이어서)

#### v12 — 즐겨찾기 탭 구현 (backend v0.4.4, frontend v0.6) — 사이드바 7탭 전부 완료

[✓] 범위 결정 — 최근기록 다음으로 즐겨찾기 진행. "관심 상품 북마크"로
    방향은 이미 잡혀있었음(2026-08-04 앞서 결정). 최근기록과 달리 새 DB
    테이블이 필요한 무거운 쪽이라 뒤로 미뤄뒀던 항목

[✓] 백엔드 구현
    → backend/app/models/favorite.py 신규 — Favorite 모델(id PK,
      product_code FK→products.code, created_at KSTDateTime),
      product_code UniqueConstraint로 중복 즐겨찾기 자체를 DB 레벨에서
      방지
    → backend/app/schemas/favorite.py 신규 — FavoriteCreateRequest({code}),
      FavoriteItem({code, title, price, price_formatted, created_at})
    → main.py에 3개 엔드포인트 추가:
      - POST /favorites: 이미 있으면 새로 안 만들고 기존 항목 그대로
        반환(idempotent, 에러 아님). danawa.get_product()를 한 번만
        호출해서 존재확인+products 캐시 upsert+응답용 즉시가까지 한
        번에 처리(중복 스크래핑 방지). 단일상품 조회라 연결 장애 시
        즉시 503(GET /product/{code}와 동일 패턴)
      - GET /favorites: 즐겨찾기 목록 + 상품별 실시간 최저가. GET
        /builds처럼 매번 순차 재조회, 캐시 없음. 항목 하나의 연결
        장애가 전체 목록을 안 죽이도록 부품별 fallback(2026-08-04
        앞서 확립한 다중부품 관례 그대로 적용)
      - DELETE /favorites/{code}: 204, 없으면 404
    → REFERENCE.md #DB-스키마·#엔드포인트-설계 갱신 완료(API 계약 변경)

[✓] 겸사겸사 발견+수정 — _cache_product()가 category 파라미터를 아예 안
    받고 있어서, 오늘 앞서 완료한 category 스크래퍼 구현(v0.4.3) 이후에도
    products 테이블의 category 컬럼은 계속 비어있었던 걸 발견
    → _cache_product 시그니처에 category: Optional[str] = None 추가,
      create_build·add_favorite 두 호출부 모두 category=data.get("category")
      전달하도록 수정
    → backend/app/models/product.py의 스테일한 TODO 주석("스크래퍼가
      아직 미제공")도 실제 상태에 맞게 정리

[✓] 프론트 구현
    → frontend/src/lib/api.ts: FavoriteItem 타입, listFavorites/
      addFavorite/removeFavorite 함수 추가. request()가 항상 res.json()을
      호출하고 있어서 DELETE의 204 No Content 응답에서 JSON 파싱 에러가
      날 뻔한 걸 미리 발견 → status===204면 파싱 없이 반환하도록 수정
    → frontend/src/pages/FavoritesPage.tsx 신규 — 상단 PartRow로
      검색→선택 즉시 POST /favorites 호출(추가), 아래 목록은
      RecentHistoryPage와 같은 .recent-list 스타일 재사용(같은 CSS
      클래스 그대로 씀, 새 스타일 없음). 각 행 클릭 시 최근기록과 동일한
      패턴으로 /stats 이동+즉시 로드, 개별 제거(DELETE), 빈 상태
    → frontend/src/App.tsx: /favorites 라우트를 FavoritesPage로 교체.
      이걸로 PlaceholderPage를 쓰는 곳이 하나도 안 남아서 컴포넌트 자체
      삭제(frontend/src/pages/PlaceholderPage.tsx 제거) — 사이드바 7탭
      전부 실데이터 연동 완료

[✓] 버그 발견+수정 — PartRow 재사용 패턴에서 실제 버그 하나 발견
    → 증상: FavoritesPage는 "선택 즉시 추가하고 계속 검색 상태 유지"가
      맞는 UX라서 PartRow에 selected={null}을 항상 고정으로 넘겨 재사용
      했는데, 첫 상품 선택 후 같은 input에 바로 다음 검색어를 타이핑해도
      자동완성이 안 뜨는 문제 발견(Playwright 테스트 중 autocomplete 개수
      0으로 나와서 발견)
    → 원인: PartRow.handlePick()이 선택 시 setFocused(false)를 호출함.
      BuildCreatePage/StatsPage는 재검색을 `.part-selected` 클릭으로
      시작하고 그 onClick 핸들러가 setFocused(true)로 되돌려주는데,
      FavoritesPage는 selected가 항상 null이라 `.part-selected` 자체가
      렌더링되지 않아 focused를 되돌릴 경로가 없음. document.activeElement
      확인 결과 DOM 포커스는 계속 유지되고 있어서 겉보기엔 멀쩡해
      보이지만, React 내부 focused state가 false로 고정돼 검색
      쿼리(enabled: debounced.length>1 && focused)가 다시 실행 안 됨
    → 수정: 공용 컴포넌트 PartRow 자체는 손대지 않고(다른 화면 영향
      최소화), FavoritesPage에서 선택 성공마다 pickerKey를 증가시켜
      PartRow를 key로 강제 remount — 내부 상태(focused/input)가 깨끗하게
      초기화됨

[✓] 검증
    → 백엔드: curl로 POST(신규/idempotent 재호출 — created_at 안 바뀌는
      것까지 확인)/GET(정렬 확인)/DELETE(성공+404) 전부 확인
    → products 테이블에 category가 실제로 채워지는지 sqlite3로 직접 조회
      (mock 데이터라 category 자체가 없어서 값은 None으로 나왔지만, 로직
      경로 자체는 정상 동작 확인 — data.get("category")가 없으면 None
      유지되는 게 맞는 동작)
    → 프론트: Playwright로 서로 다른 부품 2개 추가 → 목록에 둘 다 표시
      확인 → 같은 부품 재추가(중복) → 목록 개수 그대로(2개) 확인 →
      목록 항목 클릭 → /stats 이동 + 해당 부품 차트 즉시 로드 확인 →
      개별 제거(2개→1개) 확인
    → npm run typecheck, npm run build 통과, python3 -c "import app.main"
      통과

### 2026-08-04 (같은 날, v12 이어서 — Phase 4 마무리 항목)

#### v13 — frontend .env 문서화 보강 + e2e 스모크 테스트 4개 화면 확장

[✓] frontend .env 기반 API_BASE 설정 문서화
    → 배경: VITE_API_BASE 자체는 이미 frontend/src/lib/api.ts에 구현돼
      있었고 README.md에도 한 줄 언급은 있었지만, 예시 파일이 없고
      .gitignore에 .env가 없어 실수로 커밋될 위험이 있었음
    → .gitignore에 .env, .env.local 추가
    → frontend/.env.example 신규(VITE_API_BASE=http://localhost:8000 +
      설명 주석) — 복사해서 .env로 쓰는 흐름 안내
    → README.md .env 섹션을 .env.example 참조하도록 보강, "현재 구현
      상태" 표가 2026-08-03 v0.4 시점 그대로 방치돼 있던 걸 발견해서
      최신화(7탭 전부 연동 완료, favorites 테이블/엔드포인트, verdict
      이동평균 반영 — 프론트가 "준비 중" 플레이스홀더라고 적혀 있던 게
      가장 스테일한 부분이었음)
    → 배포 시 CORS allow_origins 좁히기 항목은 인수인계.md에 "실제 배포
      계획 생기면 진행"이라고 명시돼 있어 이번엔 보류(변경 없음)

[✓] scripts/e2e_smoke_test.py에 홈/통계/최근기록/즐겨찾기 4개 화면 스텝 추가
    → 기존 스크립트는 2026-08-03 시점 흐름(검색→빌드생성→상세→목록)만
      커버 — 그 이후 추가된 4개 화면(2026-08-04, v9~v12)은 세션별 임시
      mock+Playwright 검증만 해두고 정식 스크립트에는 반영 안 돼 있었음
    → 추가한 스텝: 홈(최근빌드 카드 클릭→상세 이동), 통계(부품 검색→
      차트 렌더링→12개월 탭 전환), 최근기록(통계/빌드생성 조회가
      실제로 계측됐는지 확인→행 클릭 시 통계 탭 즉시 로드), 즐겨찾기
      (검색→추가→목록 표시→제거→빈 상태)
    → 셀렉터는 전부 실제 페이지 컴포넌트(StatsPage/HomePage/
      RecentHistoryPage/FavoritesPage) 소스 확인 후 작성(.chart-card,
      .month-tab, .recent-row, .stats-picker .part-input 등)
    → 이 환경은 danawa.com이 막혀 있어 스크립트 자체를 라이브로 못
      돌림 — 기존 세션들이 써온 패턴대로 danawa.get_product_codes/
      get_product/get_price_variance를 mock으로 교체한 로컬 백엔드를
      띄우고, 이 mock 백엔드를 대상으로 확장된 스크립트 전체(기존
      4스텝 + 신규 8스텝, 총 12스텝)를 실제 Playwright로 끝까지 실행해
      전부 통과 확인(스크린샷 12장 포함) — 로직 자체가 셀렉터 오탈자나
      플로우 순서 문제 없이 동작하는 것까지 검증했고, 다나와 실제 HTML
      구조 대응 자체는 기존 검증된 danawa.py 파싱 로직을 그대로 신뢰
    → 이 과정에서 mock 스크립트 자체의 버그 2개 발견(실 코드 버그
      아님, 검증용 mock 데이터 문제) — get_product_codes mock이 반환
      형식(list[dict])을 안 지켜서 처음에 500 에러, get_price_variance
      mock의 min/max를 int로 반환해서 PriceHistory 스키마(문자열 필드)
      검증 실패 — 둘 다 mock을 실제 danawa.py 반환 형식에 맞춰 수정해서
      해결. 실 백엔드/프론트 코드는 변경 없음
    → 스크린샷 경로 하드코딩(/home/claude/e2e_*.png) 등 기존 스크립트의
      다른 특성은 그대로 유지(변경 범위 최소화)

---

### 2026-08-05

#### v0.5 — /search 카테고리 필터 구현 (danawa-scraper-filters)

[✓] 배경
    → 인수인계 문서에 "검색어가 다른 카테고리 상품과 섞일 수 있음"이라는
      이론적 우려가 남아 있었음(실측 버그로 확인된 적은 없음). 사용자가
      danawa 검색결과 페이지의 상세검색 필터 사이드바 실측을 도와줘서
      (이 환경은 danawa.com 프록시 차단 지속 — 사용자가 로컬 브라우저
      F12로 HTML 복사해서 전달하는 방식으로 진행, 기존 세션들과 동일 패턴)
      카테고리 필터를 실제로 구현함

[✓] 다나와 상세검색 필터 사이드바 구조 실측(GPU 검색 "RTX 5070 Ti" 기준)
    → 필터 그룹 39개 확인(제조사/칩셋/클럭/메모리/전원/크기 등), 체크박스
      803개
    → 필터 체크박스 클릭 시 별도 XHR 없이 URL 쿼리스트링이 통째로 바뀌는
      풀 페이지 재요청 방식 확인. 새로 붙는 파라미터는
      attribute={속성코드}-{값코드}-{연산자}(예: 658-1018240-OR) 형태 —
      스펙 속성(메모리용량 등) 필터용으로 보이나, 다중 선택 시 결합 규칙
      (콤마 구분? 반복 파라미터?)은 미검증이라 이번엔 채택 안 함
    → 검색결과 페이지 자체에 "이 검색어와 관련된 다른 카테고리" 트리가
      categorycode 속성과 함께 내려오는 걸 발견 — 카테고리 코드 확보에 활용
    → 상품 목록 li(class="prod_item") 안에서 카테고리 필터링에 쓸 수 있는
      필드 2종 발견:
        1) input#hidden_cate_sub_c1/c2/c3 — 숫자 카테고리 코드지만 실측
           결과 40개 상품 중 첫 번째 상품에만 존재(상품별 필드 아닌 것으로
           보임, 다른 위젯의 잔재로 추정) → 채택 안 함. 처음엔 이걸로
           구현했다가(hidden_cate_sub_c2 == 876 매칭) GPU 필터 결과가
           40건 중 1건만 나오는 걸 오프라인 fixture 테스트로 발견하고
           바로 폐기
        2) input#productItem_categoryInfo_{code}(값 예: "PC 주요
           부품_그래픽카드") — 40개 상품 전체에서 일관되게 존재/값 일치
           확인 → 이걸로 최종 구현

[✓] backend/app/services/danawa.py::get_product_codes 시그니처 변경
    → category_label: str = None 인자 추가(하위 호환, 기본값 None=기존과
      동일하게 전체 반환)
    → 상품 li별로 input#productItem_categoryInfo_{code} 값을 찾아 마지막
      "_" 뒤 조각이 category_label과 다르면 결과에서 제외
    → 검증: 사용자가 제공한 실제 GPU 검색결과 HTML을 requests.get mock
      응답으로 고정해서 오프라인 테스트 — 무필터 40건, category_label=
      "그래픽카드" 40/40건, category_label="CPU" 0/40건 확인

[✓] backend/app/main.py — CATEGORY_LABELS 상수 신규 + GET /search에
    category 쿼리파라미터(선택) 추가
    → CATEGORY_LABELS = {CPU, GPU→그래픽카드, 메인보드, RAM, SSD, 케이스,
      파워, 쿨러→쿨러/튜닝} 8개
    → GPU("그래픽카드")만 실제 상품 li HTML로 직접 검증됨. 나머지 7개
      라벨(CPU/메인보드/RAM/SSD/케이스/파워/쿨러)은 danawa 검색결과
      페이지의 "관련 카테고리" 트리 라벨 텍스트에서 확보 — 사용자가
      "CPU"(→메인보드 코드까지 덤으로 확보), "SSD", "쿨러" 3개 검색어로
      필터 사이드바 HTML을 순차로 제공해서 8개 카테고리 코드/라벨 전부
      모음. 다만 이 7개는 상품 li 안의 실제 categoryInfo 값으로 직접
      대조 검증된 건 아니라서(간접 검증), 실사용 중 특정 카테고리 필터가
      0건만 반환하면 라벨 문자열 불일치를 의심할 것
    → CATEGORY_LABELS에 없는 category 값(예: FavoritesPage/StatsPage의
      PartRow가 쓰는 "검색"/"부품")은 필터 없이 무시 — 기존 동작 그대로
      유지, 하위 호환
    → FastAPI TestClient로 /search?category= 정상/오매칭/None 3가지
      케이스 확인

[✓] 프론트 연동
    → frontend/src/lib/api.ts::api.search(q, category?) — category 있으면
      쿼리파라미터로 전달
    → frontend/src/components/PartRow.tsx — 기존엔 category prop을 화면
      표시용 라벨로만 쓰고 검색 호출엔 반영 안 하고 있었음(useQuery
      queryKey/queryFn 둘 다 q만 사용) → category도 queryKey/queryFn에
      포함시켜서 실제 검색 필터링에 반영되도록 수정
    → BuildCreatePage.tsx의 CATEGORIES 상수(CPU/GPU/메인보드/RAM/SSD/
      케이스/파워/쿨러)가 CATEGORY_LABELS 키와 이미 1:1 일치해서 별도
      프론트 코드 변경 없이 자동으로 필터 적용됨
    → npm run typecheck 통과 확인(노드모듈 최초 설치 필요했음 —
      환경 초기 상태라 react 타입 선언 자체가 없어서 나던 에러였고
      실 코드 문제 아니었음)

[ ] 보류 — 스펙 속성 필터(attribute=코드-값-OR)
    → 다중 선택 결합 규칙 미검증 + 카테고리별 스펙 코드 카탈로그(예: GPU
      메모리 용량, CPU 소켓 등) 구축이 필요해 범위가 큼. 구체적으로 어떤
      스펙에 UI가 필요한지 정해지면 이어서 진행 (실가_인수인계.md
      "다음 세션 시작 지점" 참조)

[ ] 커밋/push 대기 — 다음 "커밋 하자" 지시 대기 (브랜치
    claude/danawa-scraper-filters-bryp6q)

---

### 2026-08-05 (같은 날, 이어서)

#### v0.5 이어서 — GPU 메모리 용량 스펙 필터 구현

[✓] 배경
    → 위 "보류" 항목(스펙 속성 필터)에 대해 사용자가 "GPU 메모리 용량부터"로
      범위를 지정. 이미 확보해둔 GPU 필터 사이드바 실측 HTML에 메모리 용량
      그룹(속성코드 663) 체크박스 값이 전부 있어서(라벨: 1GB 미만 ~ 96GB
      총 19개 값, value 속성 형식 "663-{값코드}-OR") 추가 자료 수집 없이
      바로 구현. 1GB/3GB/5GB/1GB 미만 및 94/96/80/72GB(데이터센터급)는
      개인 PC 조립 도구 성격상 제외하고 실사용 범위(4~48GB) 11개만 채택

[✓] backend/app/services/danawa.py::get_product_codes에 attribute 인자 추가
    → category_label과 다른 성격 — 이건 사후 필터링이 아니라 다나와 요청
      URL 자체에 attribute={값} 파라미터로 그대로 전달(다나와 상세검색
      필터 체크박스 클릭 시 실측 URL에서 확인한 형식 그대로 사용, 2026-08-05
      이전 항목 참조). 값 하나만 지원 — 다중 선택 시 결합 규칙(콤마 구분?
      반복 파라미터?)이 여전히 미검증이라 리스트 지원은 보류
    → 검증: requests.get mock으로 호출 URL에 attribute=663-188705-OR가
      실제로 포함되는지 확인(오프라인, 라이브 호출 불가는 계속 동일)

[✓] backend/app/main.py — GPU_MEMORY_ATTRIBUTES 상수(GB → attribute 코드,
    11개) + GET /search에 memory_gb 쿼리파라미터 추가
    → category=GPU일 때만 적용, 그 외에는 무시(다른 카테고리에 메모리
      용량 개념 자체가 없거나 의미가 달라서 — 예: RAM 용량은 별도 속성
      코드일 것, 미확보)
    → FastAPI TestClient로 category=GPU&memory_gb=16 → attribute 정상 전달,
      category=CPU&memory_gb=16 → attribute 미전달(무시) 두 경우 확인

[✓] 프론트 연동 — frontend/src/lib/api.ts::api.search(q, category?,
    memoryGb?), frontend/src/components/PartRow.tsx에 GPU 행 전용 메모리
    용량 select 추가(GPU_MEMORY_OPTIONS 상수 — backend GPU_MEMORY_ATTRIBUTES
    키와 일치시켜야 함, 값 어긋나면 필터가 조용히 무시되니 주의)

[✓] CLAUDE.md "UI 변경은 브라우저에서 직접 확인 후 완료 보고" 원칙에 따라
    mock 백엔드(danawa.get_product_codes를 monkeypatch) + 실행 중인 Vite
    dev 서버를 Playwright(사전 설치된 Chromium, /opt/pw-browsers/chromium)로
    직접 조작해서 검증 — 이 과정에서 실제 레이아웃 버그 발견+수정:
    → 증상: GPU 행에서 메모리 용량 select가 폭 96px 지정에도 불구하고
      580px까지 늘어나고, 옆 텍스트 input이 30px로 찌그러지는 현상을
      스크린샷+bounding box 실측으로 확인
    → 원인: `<select>`에 appearance 리셋이 없으면 크롬이 네이티브 컨트롤
      렌더링을 우선해 명시한 width를 무시하고 옵션 텍스트 폭 기준으로
      늘어나는 경우가 있음(width:96px가 getComputedStyle에서 580px로
      나오는 걸 확인 — flex-shrink:0은 정상 적용됐는데 width만 무시되는
      비일관 현상)
    → 해결: `.part-memory-filter`에 appearance:none +
      -webkit-appearance:none + flex:0 0 96px + min-width:0 추가 → 수정
      후 재실측으로 input 378px / select 96px 정상 분할 확인, 스크린샷
      재확인(입력값 "RTX 5070 Ti" + "16GB" 선택 시 자동완성이 필터링된
      1건만 표시되는 것까지 눈으로 확인)
    → 검증 후 mock 백엔드/Vite dev 서버 프로세스 전부 종료(잔류 프로세스
      없음 확인)

[ ] 다음에 이어갈 것: 다른 카테고리/스펙(예: CPU 소켓, RAM 규격, 메인보드
    폼팩터) 확장은 GPU 때와 동일한 절차(다나와 필터 사이드바에서 체크박스
    클릭 → 바뀐 URL의 attribute= 값 확인) 필요 — 구체적 스펙이 정해지면
    진행

[ ] 커밋/push 여전히 대기 — 다음 "커밋 하자" 지시 대기 (브랜치
    claude/danawa-scraper-filters-bryp6q)

---

### 2026-08-05 (같은 날, PR #6 머지 후 이어서)

#### CATEGORY_LABELS 간접검증 라벨 직접검증 (5/7 완료)

[✓] 배경
    → PR #6(카테고리 필터 + GPU 메모리 용량 필터) 머지 후 코드 리뷰 요청을
      받아 다시 살펴보다가, CATEGORY_LABELS 8개 중 GPU만 실제 상품 li
      HTML로 직접 검증됐고 나머지 7개(CPU/메인보드/RAM/SSD/케이스/파워/
      쿨러)는 "관련 카테고리" 트리에서 가져온 간접 검증 상태라는 걸
      다시 짚었고, 사용자가 이어서 검증 진행을 요청

[✓] 상품목록 HTML 5건 실측 검증 (CPU/메인보드/RAM/SSD/케이스)
    → 사용자가 각 카테고리 대표 검색어(9800X3D/B650/DDR5 32GB/NVMe 2TB/
      미들타워)로 검색한 결과의 #prodArea(상품목록 포함) outerHTML을
      제공(이전 CPU/SSD/쿨러 시도 때는 필터 사이드바만 있어서 상품 li가
      없었던 것과 달리 이번엔 상품목록까지 포함됨)
    → input#productItem_categoryInfo_{code} 값을 직접 집계해서 예상 라벨과
      대조:
        메인보드: 40/40 "PC 주요 부품_메인보드" — 정확히 일치
        RAM: 40/40 "PC 주요 부품_RAM" — 정확히 일치
        케이스: 40/40 "PC 주요 부품_케이스" — 정확히 일치
        SSD: 37/40 "PC 주요 부품_SSD", 3/40 "주변기기_외장HDD/SSD" —
          "SSD" 라벨 정확, 나머지 3건(외장 SSD)은 다른 카테고리라 필터가
          걸러내는 게 맞는 동작
        CPU: 1/40만 "PC 주요 부품_CPU", 나머지 39/40은 "디지털
          완제품_데스크탑" — "9800X3D" 검색 결과 대부분이 그 CPU가 장착된
          완제품 PC였고 실제 CPU 단품은 1건(AMD 라이젠7-6세대9800X3D)뿐.
          category_label="CPU" 필터가 정확히 그 39건을 걸러내고 단품
          1건만 남기는 것까지 danawa.get_product_codes 오프라인 fixture
          테스트로 확인 — 처음 카테고리 필터를 만든 이유(관련없는 상품
          섞임)가 실제로 발생한 걸 실측으로 처음 확인한 사례
    → 5건 전부 danawa.get_product_codes(category_label=...) mock 테스트로
      기대 건수와 정확히 일치 확인(오프라인, 라이브 danawa 호출은 이
      환경에서 여전히 불가능)

[✓] backend/app/main.py::CATEGORY_LABELS 위 주석 갱신 — "GPU만 직접검증"
    → "GPU/CPU/메인보드/RAM/SSD/케이스 6개 직접검증, 파워/쿨러만 간접"으로
      정정. 실가_REFERENCE.md #엔드포인트-설계도 동일하게 갱신

[✓] 오탈자 수정 — main.py GPU_MEMORY_ATTRIBUTES 위 주석이 "값 하나만"에서
    문장이 끊겨 있던 것을 "값 하나만 허용"으로 완성 (코드 리뷰 중 발견)

[✓] 파워/쿨러 2개도 이어서 검증 완료(업로드 5개 제한 때문에 CPU/메인보드/
    RAM/SSD/케이스 5개 먼저 받고, 이어서 파워/쿨러 2개 추가로 받음)
    → 파워: 40/40 "PC 주요 부품_파워" — 정확히 일치
    → 쿨러: 40/40 "주변기기_쿨러/튜닝" — 정확히 일치(주변기기 카테고리
      소속이라 이전에 걱정했던 대로 861 PC 주요 부품 트리 밖에 있었지만
      라벨 자체는 예상대로였음)
    → 이걸로 CATEGORY_LABELS 8개 전부(GPU/CPU/메인보드/RAM/SSD/케이스/
      파워/쿨러) 실제 상품 li HTML 직접 검증 완료 — 간접 검증 상태로 남은
      라벨 없음
    → backend/app/main.py::CATEGORY_LABELS 주석, 실가_REFERENCE.md
      #엔드포인트-설계를 "8개 전부 직접 검증 완료"로 최종 정정

[✓] 오탈자 수정(main.py GPU_MEMORY_ATTRIBUTES 주석 "값 하나만" → "값 하나만
    허용")

---

### 2026-08-05 (같은 날, PR #6 머지 후 이어서 — 코드리뷰 요청에서 이어짐)

#### 폴리시 2건 + CPU 소켓 스펙 필터 신규

[✓] 배경
    → 사용자가 머지된 PR #6("지금 작업 어떤거 같아 깔끔해?")에 코드 리뷰를
      요청 → 리뷰 중 CATEGORY_LABELS 8개 라벨 검증 상태 재확인(위 항목들)
      + 리뷰에서 나온 두 가지 폴리시 항목 + 다음 스펙 필터로 CPU 소켓 진행

[✓] 폴리시 1 — 자동완성 드롭다운이 GPU 행 메모리 select를 덮던 문제
    → `.autocomplete-list`가 `right:16px`로 고정돼 있어서 GPU 행에서 select가
      추가된 뒤에도 여전히 select 영역까지 뒤덮고 있었음(select 자체는 위에
      떠서 클릭은 되지만 시각적으로 겹침)
    → PartRow.tsx에서 showSpecFilter(메모리/소켓 select 둘 중 하나라도
      보이는 행)일 때 `autocomplete-list--with-filter` modifier 클래스를
      추가로 붙이고, CSS에서 `right:126px`(select 폭 96px + row gap 14px +
      기존 16px)로 넓힘
    → Playwright로 재검증: dropdown bounding box(x=244, width=380, 즉 우측
      끝 624) vs select bounding box(x=638) — 겹침 없음, 14px 갭 확인

[✓] 폴리시 2 — 인수인계.md 스테일 체크리스트 정정
    → "danawa_patched.py 실가 프로젝트 정식 경로 편입" 항목이 실제로는
      오래전에 backend/app/services/danawa.py로 편입 완료됐는데 문서
      체크박스만 `[ ]`로 계속 방치돼 있던 걸 발견 → `[x]`로 정정하고 완료
      근거(파일 출처 명시된 도크스트링, 이후 세션들의 계속된 패치 이력)
      덧붙임

[✓] CPU 소켓 스펙 필터 신규 구현 (backend/app/main.py::CPU_SOCKET_ATTRIBUTES)
    → GPU 메모리 용량과 동일 패턴 재사용(danawa.get_product_codes의 범용
      attribute 인자를 그대로 씀 — 스크래퍼 코드 변경 없음, 속성코드만
      41 = 소켓 구분)
    → 실측: AMD는 이미 확보해둔 "9800X3D" 검색 결과에 필터 사이드바가
      통째로 포함돼 있어서 추가 자료 없이 바로 AM5/AM4 등 코드 확보.
      인텔 소켓은 "9800X3D"(AMD 칩) 검색 결과엔 아예 안 나타나서(다나와가
      현재 결과와 무관한 옵션값은 필터에 안 보여줌) "i5-14600K"로 한 번 더
      검색해서 LGA1851/LGA1700 등 확보 — 카테고리 필터 라벨 검증 때와
      달리 이번엔 "검색어에 따라 관련 옵션만 노출된다"는 danawa UI 특성
      때문에 제조사별로 검색을 나눠야 했던 케이스
    → 현재 시장에서 신품으로 유통되는 4개(AM5/AM4/LGA1851/LGA1700)만
      채택 — 워크스테이션/서버/구형 소켓(sWRX8·sTRX4·TR4·sTR5·SP3·FM2·
      AM3+·AM3, 2066·4677·4189·3647·2011 계열·1366·1150·1155·1156·775·
      1200·1151v2·1151)은 실측은 됐지만 GPU 메모리 데이터센터 값 제외
      때와 같은 원칙으로 제외
    → frontend/src/lib/api.ts::api.search에 socket 파라미터 추가,
      PartRow.tsx의 select 클래스명을 `.part-memory-filter` →
      `.part-spec-filter`로 일반화(이제 GPU 메모리/CPU 소켓 두 필터가
      같은 스타일 공유)
    → 검증: FastAPI 레벨(category=CPU&socket=AM5 → attribute 정상 전달,
      category=GPU&socket=AM5 → 무시, 오매칭 소켓 → 무시 3케이스),
      Playwright 실브라우저(CPU 행에만 소켓 select 노출·옵션 4개 정확,
      GPU/RAM 행엔 없음, AM5 선택 후 검색 시 실제
      `category=CPU&socket=AM5` 쿼리로 요청 나가는 것, 필터링된 자동완성
      결과 표시까지) 둘 다 확인

[✓] 커밋/push 완료(16e5ef5) — 위 3건(폴리시 2 + CPU 소켓 필터) + 앞서
    완료된 오탈자 수정/8개 라벨 검증 정정까지 전부 한 커밋으로 묶음
    (사용자 지시 — "3번 찾고 1,2 고치자", "한번에 하게"). PR #6은
    이미 머지·종료라 이번 커밋은 새 PR(#7 예정) 대상, 아직 PR은 안 만듦

---

### 2026-08-05 (같은 날, 이어서 — 사용자가 리뷰 후 "나머지도 할까" 제안)

#### GPU 칩셋 제조사(NVIDIA/AMD/Intel) 스펙 필터 신규

[✓] 배경
    → 사용자가 "cpu말고도 gpu는 라이젠것도 있고" — GPU에도 칩셋 제조사별
      필터가 있으면 좋겠다는 취지로 확인(AskUserQuestion으로 "칩셋
      제조사(NVIDIA/AMD/인텔)"가 맞는지 명확화)
    → 처음 GPU 필터 사이드바를 실측했을 때(2026-08-05 최초 세션) 이미
      "칩셋 제조사" 그룹(속성코드 654: NVIDIA/AMD(ATi)/Intel/FuriosaAI)
      데이터를 받아뒀던 상태라 추가 자료 수집 없이 바로 구현 가능했음

[✓] backend/app/main.py::GPU_CHIPSET_ATTRIBUTES 신규
    → NVIDIA(654-3518-OR)/AMD(654-3517-OR)/Intel(654-805627-OR) 3개 채택,
      FuriosaAI(654-981322-OR, AI 가속기 칩 제조사)는 일반 소비자용
      그래픽카드가 아니라서 제외(GPU 메모리 데이터센터 용량, CPU
      워크스테이션 소켓 제외 때와 같은 원칙)
    → /search에 chipset 쿼리파라미터 추가, category=GPU일 때만 적용

[✓] memory_gb·chipset 동시 지정 처리 — chipset 우선 + 폴백
    → danawa.get_product_codes의 attribute 인자가 값 하나만 받을 수 있어서
      (다중 attribute 결합 규칙 여전히 미검증) 같은 GPU 카테고리 안의
      스펙 필터 두 개를 동시에 적용할 방법이 없음
    → `attribute = GPU_CHIPSET_ATTRIBUTES.get(chipset) or
      GPU_MEMORY_ATTRIBUTES.get(memory_gb)` — chipset이 유효하면 그걸
      쓰고, chipset이 없거나 오매칭이면 memory_gb로 자연스럽게 폴백.
      처음엔 `if chipset: ... elif memory_gb: ...` 형태로 짰다가, 이
      방식이면 chipset에 오매칭 값이 들어왔을 때 memory_gb가 유효해도
      같이 무시돼버리는 버그가 있어서(첫 if 분기가 이미 선택됨) or
      체이닝으로 수정 — FastAPI TestClient로 "오매칭 chipset + 유효
      memory_gb → memory_gb 폴백" 케이스까지 포함해서 5가지 조합 검증
    → 프론트(PartRow)도 동일한 제약을 반영해 두 select를 상호 배타로
      구현 — 하나 선택하면 다른 하나 자동으로 빈 값(전체)으로 리셋

[✓] GPU 행 select가 최대 2개(칩셋 제조사 + 메모리 용량)까지 늘어나면서
    자동완성 드롭다운 겹침 방지 로직 일반화
    → 직전 커밋에서 추가한 `.autocomplete-list--with-filter`(고정
      right:126px, select 1개 기준)로는 select 2개인 GPU 행을 못 커버해서
      폐기하고, `specFilterCount`(그 행에 실제로 보이는 select 개수: GPU는
      칩셋+메모리 2개, CPU는 소켓 1개, 나머지는 0개) 기반 인라인 스타일
      계산으로 교체 — `right: 16 + specFilterCount * 110`(110 = select
      폭 96px + row gap 14px)
    → Playwright로 재검증: GPU 행(select 2개) dropdown 우측 끝(x=514)이
      첫 번째 select 시작(x=528)보다 작아 겹침 없음 확인. CPU 행(select
      1개)도 기존과 동일하게 겹침 없음 유지 확인

[✓] 검증
    → FastAPI TestClient: chipset 단독 지정/memory_gb 단독 지정/둘 다
      지정(chipset 우선)/오매칭 chipset+유효 memory_gb(폴백)/CPU
      카테고리에서 chipset 지정(무시) — 5가지 케이스 전부 기대한
      attribute 값과 일치
    → Playwright 실브라우저(mock 백엔드): GPU 행 select 2개 존재·칩셋
      옵션 4개(제조사 전체/NVIDIA/AMD/Intel) 정확, 메모리 용량 선택 후
      칩셋 선택하면 메모리 선택이 자동으로 풀리는 것, 실제 검색 시
      `category=GPU&chipset=NVIDIA` 쿼리로 요청 나가고 memory_gb는
      파라미터에서 빠지는 것, 필터링된 자동완성 결과(NVIDIA 카드만)
      표시까지 확인. mock 백엔드/Vite dev 서버 프로세스 전부 종료 확인

[ ] 커밋/push 대기 — 다음 지시 대기
