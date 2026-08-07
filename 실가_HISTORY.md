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

[✓] 커밋/push 완료(1624454)

---

### 2026-08-05 (같은 날, 이어서 — "추가로 이런거 할만한 부품 있나" 이후)

#### 메인보드 소켓/폼팩터 · RAM 규격 · 케이스 폼팩터 · 파워 출력 · SSD 인터페이스

[✓] 배경
    → GPU 칩셋 필터 완료 후 사용자가 "추가로 이런거 할만한 부품 있나"로
      확장 후보를 물어봄 → 호환성이 가장 치명적인 순서로 4순위 제안
      (①메인보드 소켓 ②RAM 규격 ③메인보드/케이스 폼팩터 ④파워 출력/SSD
      인터페이스) → 사용자가 "1~4까지 자동진행, 선택/정보 필요하면 요청"
      으로 승인 → 필요한 데이터가 이미 확보해둔 category 라벨 검증용
      상품목록 HTML(메인보드/RAM/케이스/파워/SSD 5개 파일)에 필터
      사이드바까지 통째로 포함돼 있었던 걸 발견해서 추가 자료 수집 없이
      전부 바로 진행

[✓] 실측 데이터로 확인된 중요 사실 — **카테고리 간 attribute 코드는
    절대 재사용 불가**
    → 메인보드 "CPU 소켓" 필터가 CPU 카테고리의 "소켓 구분" 필터와 같은
      물리적 스펙(AM5 등)을 다루는데도 다나와 내부 속성코드/값코드가
      완전히 다름을 발견: CPU 카테고리 AM5="41-801631-OR" vs 메인보드
      카테고리 AM5="500-801682-OR". 처음엔 재사용 가능할 거라 예상했던
      가설이 실측으로 틀렸다는 게 확인된 것 — 앞으로 새 카테고리로
      확장할 때마다 절대 다른 카테고리 코드를 재사용하지 말고 매번 그
      카테고리 자신의 필터 사이드바에서 다시 확보해야 함이 명문화됨
    → 메인보드 필터 사이드바 하나에서 "CPU 소켓"(속성코드 500)과
      "폼팩터"(속성코드 506) 둘 다 확보. RAM 파일에서 "메모리 규격"이
      DDR4/DDR5가 아니라 DIMM/SO-DIMM/RDIMM 등 물리 폼팩터를 뜻한다는
      걸 발견(예상과 다름) — DDR4/DDR5는 "제품 분류"(속성코드 277) 쪽에
      있었음. 케이스의 "지원보드규격"은 다른 필터들과 달리 값 형식이
      "-AND"(다른 건 전부 "-OR") — 케이스 하나가 여러 폼팩터를 동시
      지원할 수 있어서로 추정되나, 단일값 선택만 하는 현재 구현에서는
      동작 차이 없어서 그대로 채택

[✓] backend/app/main.py 신규 딕셔너리 6개 + /search 파라미터 5개 추가
    → MAINBOARD_SOCKET_ATTRIBUTES(AM5/AM4/LGA1851/LGA1700, 값은 CPU와
      다름), MAINBOARD_FORMFACTOR_ATTRIBUTES·CASE_FORMFACTOR_ATTRIBUTES
      (ATX/M-ATX/ITX/E-ATX, 메인보드=자기 크기 vs 케이스=장착 가능한
      보드 크기라 의미가 다름), RAM_TYPE_ATTRIBUTES(DDR5/DDR4),
      PSU_WATTAGE_ATTRIBUTES(450W~499W ~ 1000W~1299W 7구간, 저사양/
      익스트림 구간 제외), SSD_INTERFACE_ATTRIBUTES(SATA3/PCIe3.0x4/
      PCIe4.0x4/PCIe5.0x4, x8 레인·U.2 등 엔터프라이즈용 제외)
    → /search에 socket(CPU/메인보드 공용, 카테고리별로 다른 딕셔너리),
      formfactor(메인보드/케이스 공용), ram_type, wattage, interface
      쿼리파라미터 추가. category 분기를 elif 체인으로 정리
      (GPU/CPU/메인보드/케이스/RAM/파워/SSD 7가지, 메인보드는
      socket 우선 + formfactor 폴백으로 GPU의 chipset/memory_gb
      패턴 재사용)
    → 검증: FastAPI TestClient로 9가지 조합(메인보드 socket 단독/
      formfactor 단독/둘 다 지정 시 socket 우선, 케이스 formfactor,
      RAM ram_type, 파워 wattage, SSD interface, CPU에 formfactor
      지정 시 무시, 쿨러에 socket 지정 시 무시) 전부 기대값과 일치

[✓] 프론트 리팩터 — CATEGORY_SPEC_FILTERS 설정 객체 도입
    → 카테고리가 늘면서(GPU/CPU/메인보드/RAM/SSD/케이스/파워, 7개 중
      6개가 스펙 select를 가짐) 이전처럼 `{showXFilter && <select>...}`를
      매번 손으로 반복하면 중복이 심해질 상황이라, 카테고리→스펙필터
      목록(specKey/placeholder/title/options) 선언적 배열로 정리하고
      `.map()`으로 렌더링하도록 리팩터
    → 상호배타 로직도 단순화됨 — 기존엔 카테고리마다 "다른 state 지우기"
      onChange 콜백을 따로 썼는데, 이번엔 아예 `specValue: {key, value} |
      null` 단일 상태 하나로 바꿔서 자연히 하나만 선택 가능해짐(새 값
      설정이 곧 이전 값 대체)
    → frontend/src/lib/api.ts::api.search(q, category?, spec?) —
      SearchSpecParams 객체 + URLSearchParams로 재작성. 포지셔널 인자가
      (q, category, memoryGb, socket, chipset, ...)로 계속 늘어나는 걸
      막으려고 이번에 리팩터함(파라미터 늘어날 때마다 호출부 다 고쳐야
      하는 문제 해결)
    → CSS 폴리시: `.part-spec-filter` 폭을 96px→116px로 넓힘("800W~899W"
      같은 긴 라벨이 잘리는 걸 Playwright 스크린샷으로 발견), SSD
      "인터페이스 전체" placeholder도 "인터페이스"로 줄임(96px 시절
      폭 기준으로 넉넉했던 문자열이 새 레이아웃에서도 여전히 타이트해서
      한 번 더 줄임). 자동완성 드롭다운 우측 여백도 select 개수 기반
      계산식의 슬롯폭을 110→130(116+14)으로 맞춰 갱신

[✓] Playwright 실브라우저 검증 — 8개 카테고리 전부
    → select 개수 기대값과 실제값 일치(CPU 1/GPU 2/메인보드 2/RAM 1/
      SSD 1/케이스 1/파워 1/쿨러 0), 메인보드 소켓↔폼팩터 상호배타
      동작, 각 카테고리 실제 검색 시 올바른 쿼리파라미터로 요청 나가고
      mock 백엔드가 필터링된 결과만 돌려주는 것, 전체 화면 스크린샷으로
      레이아웃 깨짐 없음(긴 라벨 잘림 2건 발견해서 그 자리에서 수정)
      확인. mock 백엔드/Vite dev 서버 프로세스 정리 확인

[✓] 실가_인수인계.md "오늘 세션 마무리" 섹션 대대적으로 압축 — 하루 동안
    여러 차례 이어진 작업(카테고리 필터→GPU 메모리→라벨 검증→CPU
    소켓→GPU 칩셋→이번 6종)이 순차 append로 쌓이면서 다음 세션이 읽기
    부담스러울 정도로 길어져서, 최종 상태 중심의 요약으로 재작성함
    (인수인계.md는 append-only가 아니라 "현재 상태" 문서라는 원래
    성격에 맞춤 — 상세 이력은 이 파일(HISTORY.md)에 그대로 남아있음)

[✓] 커밋/push 완료(ab60a3e)

---

### 2026-08-05 (같은 날, 이어서 — "문제점 있어?" 코드 리뷰)

[✓] GPU_MEMORY_ATTRIBUTES/GPU_MEMORY_OPTIONS 불일치 발견+수정
    → 백엔드-프론트 스펙 딕셔너리 8쌍을 전부 스크립트로 대조 검증하다가
      GPU_MEMORY_ATTRIBUTES(backend)에만 1/2/3/5GB가 남아있고
      GPU_MEMORY_OPTIONS(frontend)엔 4GB부터만 있는 걸 발견 — UI로는
      절대 선택 못 하는 죽은 딕셔너리 항목이었음. 나머지 7쌍(칩셋/소켓
      2종/폼팩터 2종/RAM/파워/SSD)은 전부 정확히 일치 확인
    → backend/app/main.py::GPU_MEMORY_ATTRIBUTES에서 1/2/3/5GB 제거해서
      11개(4~48GB)로 프론트와 맞춤. FastAPI TestClient로 memory_gb=1(제거된
      값 → 무필터)/memory_gb=16(정상) 재확인
    → 잔여 리스크로 기록만 해둠(수정 안 함, 검증 불가): 케이스 폼팩터
      필터만 값 형식이 "-AND"(나머지 전부 "-OR")인데 라이브 검증 불가라
      단일값 선택에서 -OR와 동일하게 동작하는지 100% 확인은 안 됨

[✓] 커밋/push 완료(c312020, e686a79) — PR #7로 오픈 후 머지됨(사용자가
    직접 관리)

---

### 2026-08-05 (같은 날, 이어서 — 프론트 디자인 전면 교체)

[✓] UI 톤 다듬기 1차 — 탑바/제목 중복 제거, section-label(kicker), 빈
    상태 카드화 (커밋 c312020, 다크네온 톤 유지한 채로 진행)

[✓] 사이드바 접힘 상태 가로 스크롤바 노출 버그 수정 (커밋 e686a79)
    → nav-item 라벨이 opacity:0으로 숨겨져도 white-space:nowrap 때문에
      실제 너비를 계속 차지해서, overflow-y:auto인 .side-nav의
      overflow-x가 암묵적으로 auto로 계산돼 가로 스크롤바가 함께 뜨던
      문제. overflow-x:hidden 명시로 해결

[✓] 사용자가 첨부한 참조 디자인(에디토리얼 "빌드 명세서" HTML, 종이/잉크
    톤 — 컴퓨존/다나와 기준 실제 견적서 스타일 문서)을 기준으로 프론트
    전체 톤 교체 결정 — "전체 테마를 이걸로 교체" 확인받고 진행
    → 이전 다크+시안/마젠타/앰버 네온(Black Han Sans+JetBrains Mono) 폐기
    → 신규 팔레트: ink(#0B0B0B)/paper(#F4F3EF) 모노크롬, accent color
      없음. 상태 구분은 ▲(고가, ink 채움)/▼(저가)/—(적정가, 중립 테두리)
      기호로. 에러 상태도 색 대신 "!" 접두사+ink 굵게
    → 폰트 교체: Pretendard(헤드라인 포함 전체) + IBM Plex Mono(데이터).
      frontend/index.html 구글폰트 링크에서 Black Han Sans 제거,
      IBM Plex Mono 추가
    → 레이아웃 규칙 변경: border-radius/box-shadow 글로우 전면 제거,
      hairline(1px) 보더로만 위계 표현
    → frontend/src/styles/global.css 전체 재작성(클래스명은 유지 —
      대부분의 TSX는 className 변경 없이 그대로 재사용됨)
    → BuildDetailPage.tsx 판정 게이지 재설계: SVG 반원+니들 →
      flat 수평 바(.gauge-track/.gauge-zone/.gauge-marker).
      needleAngle() 삭제, markerPosition()으로 교체 — diff_percent를
      ±GAUGE_RANGE(30)로 클램프해 바 0~100% 위치에 선형 매핑,
      VERDICT_THRESHOLD_PERCENT(±5%, services/verdict.py와 동일 가정값)
      구간을 .gauge-zone 음영으로 표시
    → StatsPage.tsx 가격 히스토리 차트: feGaussianBlur 글로우 필터 +
      시안 그라디언트 라인 제거, flat ink 라인(#0B0B0B)+옅은 회색
      fill로 교체

[✓] 실측 버그 발견+수정: build-grid CSS 그리드 "라인 트릭"
    (컨테이너 background:var(--line-lt) + gap:1px, 자식 카드는
    background:var(--paper)만) 사용 시, grid-template-columns:repeat(3,1fr)
    인데 아이템이 3의 배수가 아니면 마지막 행의 빈 셀에 컨테이너
    배경색이 그대로 노출되는 문제 실측 발견(홈 화면 빌드 1개일 때 옆에
    베이지색 빈 블록 노출). CSS Grid는 고정 열 트랙을 항상 만들기 때문에
    빈 셀도 컨테이너 배경이 비쳐 보임 — flex-column 리스트(search-results,
    recent-list)는 자식이 항상 꽉 채워지는 구조라 같은 트릭을 써도
    문제없음. build-grid만 개별 카드에 자체 border를 주는 방식(레거시
    다크테마 방식과 동일)으로 되돌려 수정. REFERENCE.md #디자인-토큰에
    함정으로 기록
    → 원인: danawa.com 접근이 프록시로 막혀 있어 실제 danawa 함수를
      monkeypatch한 mock 백엔드(임시 SQLite) + Playwright로 빌드 1개
      생성해서 실측 — 빈 데이터 상태만으로는 안 드러나던 버그

[✓] Playwright 실브라우저 검증 — 9개 화면(홈/검색/빌드목록/빌드생성/
    빌드상세(게이지 포함, mock 빌드 데이터로 고가 판정 케이스 확인)/
    즐겨찾기/최근기록/통계(mock 가격 히스토리로 차트 렌더링 확인)/설정)
    전부 확인. npm run typecheck 통과. 검증 후 mock 백엔드 종료하고
    원래 dev 백엔드로 복귀

[✓] 실가_REFERENCE.md #디자인-토큰, CLAUDE.md, 실가_인수인계.md
    "확정된 사항" 갱신 완료

[✓] 커밋/push 완료(db61895)

---

### 2026-08-05 (같은 날, 이어서 — 스펙시트 고도화 + UI/UX 리서치 반영)

배경: "종이/잉크 + IBM Plex Mono 에디토리얼 스펙시트 스타일에 맞추되,
UI/UX도 리서치로 고도화해서 실제 시중 빌드 웹 디자인처럼" 요청.
1차 교체(db61895)는 색/폰트/보더만 바꿨고 참조 디자인의 구조적 요소
(그룹 헤더·비중 바·스탯 스트립·소계 규칙·델타 배지)는 대부분 미사용
상태였음 — 그걸 실제로 이식하고, 빌드 사이트 관례를 얹음.

[✓] 리서치 — PCPartPicker(부품 리스트 UX 표준) 관례 조사. pcpartpicker.com
    직접 fetch는 403, 다나와는 이 환경 프록시 차단이라 검색 결과 + 도메인
    지식으로 보완. 채택한 관례:
    → 빌드 진행률 + 러닝 총액을 항상 눈에 보이게(저장 전에도 "지금까지 얼마")
    → 카테고리 행은 비어 있어도 항상 자리를 지킴(기존 PartRow가 이미 충족)
    → 가격 열 정렬 + 총액/소계 행
    → 미채택: 소비전력 추정(PCPartPicker의 핵심 기능이지만 부품별 TDP
      데이터가 우리 스크래퍼에 없음 — 백엔드 작업 필요, 이번 범위 밖)

[✓] font-variant-numeric:tabular-nums 전면 적용 — 스펙시트에서 가격이
    열로 정렬되려면 자릿수 폭이 같아야 함. global.css 상단에 모노 계열
    클래스 셀렉터를 모아서 일괄 지정

[✓] BuildDetailPage 전면 재구성 — 단순 2단(게이지+breakdown) 레이아웃을
    실제 견적서 구조로 교체:
    → .strip 4칸 스탯 스트립(부품 구성/최고가 부품+비중/판정 기준/판정)
    → .total-row 큰 실측 합계 + 우측 메타(저장일·판정 기준가)
    → .confirm-row 실측 합계 → 비교 판매가 대비 + .diff-badge(차액·증감률)
      + 기존 게이지 바(적정 ±5% 구간 라벨 추가)
    → 부품을 기능 그룹(연산부/그래픽/메모리·저장/섀시·전원)으로 묶어
      .grp 헤더와 함께 표시. PART_GROUPS에 없는 카테고리는 "기타"로
      모이게 해서 카테고리가 늘어도 누락되지 않음
    → 부품별 .spec-row 3열 + 총액 대비 비중(%)과 .prop-bar 시각화
    → verdict_basis_breakdown의 source를 부품 행에 노출 — 이동평균이 무효라
      즉시가로 대체된 부품을 행 단위로 표시(기존엔 빌드 전체 신뢰도
      한 줄로만 알 수 있었음)
    → .sum 소계로 마감
    → 데이터 도착 후 마운트되는 BuildDetailView 서브컴포넌트로 분리 —
      여기서 잡는 mounted 플래그가 곧 "값이 확정된 시점"이라 비중 바/
      리빌 애니메이션 시작점으로 씀(IntersectionObserver 불필요)

[✓] BuildCreatePage — PCPartPicker식 sticky 요약 바(.build-summary) 추가.
    "구성 N/8" + 카테고리별 진행 틱 + 현재 합계(러닝 총액). 가격 조회
    실패한 부품은 합계에서 빠지므로 개수를 따로 표기
    → 이를 위해 PartRow의 SelectedPart에 raw price 필드 추가
      (기존엔 priceFormatted 문자열만 들고 있어서 합산 불가).
      recentProducts/StatsPage/FavoritesPage는 구조적 타이핑이라 무변경

[✓] 인쇄 스타일 추가 — 빌드 상세를 실제 견적서로 출력 가능하게.
    @page margin 14mm, 사이드바/탑바/버튼/sticky 요약 숨김,
    .spec-row/.strip/.sum break-inside:avoid. Playwright
    emulate_media(print)로 A4 1장에 스펙시트가 온전히 떨어지는 것 확인

[✓] 검증 — mock danawa(8종 실제 시세 근사값 + 상품별 주 단위 시계열)로
    8종 풀 구성 빌드를 만들어서 확인. 빌드 상세(스트립/총액/견적 대비/
    그룹 4개/비중 바/소계), 인쇄 레이아웃, 빌드 생성 sticky 요약,
    빌드 목록(▲▼ 배지), 검색 결과 정렬 전부 실브라우저 확인.
    npm run typecheck 통과

[ ] 커밋/push 대기 — 다음 "커밋하자" 지시 대기

---

### 2026-08-05 (같은 날, PR #9 머지 후 이어서)

#### 쿨러 스펙 필터 추가 — 제품 종류 + 지원 소켓 (backend v0.7 / frontend v0.9.1)

[✓] 배경
    → 스펙 필터 확장의 마지막 남은 카테고리. 8개 카테고리 중 쿨러만
      카테고리 필터(CATEGORY_LABELS "쿨러/튜닝")만 있고 스펙 필터가 없었음
    → 다나와 "쿨러/튜닝" 카테고리는 다른 카테고리와 성격이 다름 — CPU 쿨러,
      케이스팬(시스템 쿨러), 써멀그리스, 조명기기, VGA 지지대, 튜닝 용품이
      한 카테고리에 다 섞여 있어서 category 필터를 걸어도 CPU 쿨러가
      안 걸러짐. 제품 종류 필터가 이 카테고리에 특히 필요한 이유

[✓] 실측 — 사용자가 로컬 브라우저에서 "CPU 쿨러" 검색 결과의 #prodArea
    outerHTML 제공(이 환경은 danawa.com 프록시 차단 지속, search.danawa.com:443
    CONNECT 403 재확인). 필터 사이드바 + 상품목록 40건이 모두 포함된 형태
    → 필터 그룹 46개 / attribute 체크박스 480개 파싱. 쿨러 카테고리에서
      개인 조립PC에 쓸 만한 그룹은 3개:
        제품 종류(687, -OR) 17종
        냉각 방식(315758, -OR) 공랭/수랭 2종
        인텔 소켓(6805, -AND) 15종 / AMD 소켓(6806, -AND) 15종
      나머지 43개 그룹은 팬 베어링 40종·LCD 해상도 20종·펌프수명·풍압(정압)
      같은 매니악한 스펙이라 제외
    → 사용자와 논의해서 제품 종류 + 소켓 2개 채택(select 2개, 기존 GPU·
      메인보드와 같은 최대치). 냉각 방식은 검색어("수랭"/"공랭")로 대체
      가능해서 미채택 — 어차피 같은 카테고리 스펙끼리는 상호배타라
      3개를 넣어도 동시에 못 씀

[✓] 소켓 그룹이 인텔/AMD로 갈려 있는 케이스 — 기존 API 계약 유지 방식 결정
    → 쿨러는 소켓 필터 그룹이 인텔(6805)/AMD(6806) 둘로 나뉘어 있어서
      CPU·메인보드와 달리 값에 따라 속성코드 자체가 갈림
    → 그래도 socket 파라미터 하나 + 기존 4개 값(AM5/AM4/LGA1851/LGA1700)
      계약을 그대로 유지하려고 두 그룹을 한 딕셔너리로 합침
      (COOLER_SOCKET_ATTRIBUTES). 프론트도 SOCKET_OPTIONS 상수를 그대로 재사용
    → 형식이 -OR이 아니라 -AND인 것도 실측값 그대로. 쿨러 하나가 여러 소켓을
      동시 지원해서 다중선택 결합에 AND를 쓰는 것으로 보이나, 케이스 폼팩터와
      마찬가지로 단일 값만 지원하는 현재 구현에서는 동작 차이 없음
    → 카테고리 간 attribute 코드 재사용 불가 원칙이 또 확인됨:
      AM5가 CPU=41-801631-OR, 메인보드=500-801682-OR, 쿨러=6806-776764-AND로
      전부 다름

[✓] 채택값 (실측 17종/15종에서 기존 트리밍 원칙대로 축소)
    → COOLER_TYPE_ATTRIBUTES 5종: CPU 쿨러(687-4015-OR) / 시스템 쿨러
      (687-4017-OR) / VGA 쿨러(687-4016-OR) / M.2 SSD 쿨러(687-259565-OR) /
      써멀그리스(687-4023-OR). 제외 12종 — VGA 지지대·가이드·수랭 부속품·
      RAM/HDD 쿨러·팬컨트롤러·써멀패드·써멀퍼티·조명기기·방열판·팬 부속품·
      튜닝 용품(개인 조립PC의 부품 견적 범위 밖)
    → "써멀그리스"는 우리 API 계약 키이고 다나와 원 라벨은
      "써멀컴파운드(그리스)" — 116px select에 안 들어가서 줄인 것
    → COOLER_SOCKET_ATTRIBUTES 4종: AM5(6806-776764-AND) /
      AM4(6806-213365-AND) / LGA1851(6805-906253-AND) /
      LGA1700(6805-743326-AND). 제외 — LGA1954(미출시 차세대), LGA1200 이하
      인텔 구형, TR5/SP6/SP5/TR4/sWRX8/sTRX4/SP3(HEDT·서버),
      FMx/AM2,3·AM1(구형 AMD)

[✓] 구현
    → backend/app/main.py: COOLER_TYPE_ATTRIBUTES / COOLER_SOCKET_ATTRIBUTES
      신규, cooler_type 쿼리파라미터 신규, search()에 `elif category == "쿨러"`
      분기(cooler_type 우선, `A or B` 체이닝은 기존과 동일)
    → frontend/src/lib/api.ts: SearchSpecParams.coolerType → cooler_type
    → frontend/src/components/PartRow.tsx: COOLER_TYPE_OPTIONS 상수 +
      CATEGORY_SPEC_FILTERS.쿨러 항목. 선언적 구조(PR #7 리팩터) 덕에
      컴포넌트 로직은 한 줄도 안 건드림 — 설정 객체에 항목 하나 추가로 끝
    → 실가_REFERENCE.md #엔드포인트-설계 표/우선순위 설명 갱신

[✓] 검증
    ① 오프라인 매핑 테스트 12케이스 전부 통과 (FastAPI TestClient +
       requests.get mock으로 실제 요청 URL의 attribute= 값 확인):
       cooler_type 5종/socket 4종 전달, 둘 다 오면 cooler_type 우선,
       매칭 안 되는 값 무시, category 안 맞으면 무시,
       그리고 CPU/메인보드/케이스 회귀 3건(쿨러 코드가 다른 카테고리로
       새지 않는지)
    ② 사용자가 준 실제 HTML을 fixture로 get_product_codes 실행 —
       상품 li 40건 전부 "주변기기_쿨러/튜닝"으로, category_label="쿨러/튜닝"
       필터 40건 통과 / "그래픽카드" 필터 0건. 쿨러 카테고리 사후 필터링도
       이번에 처음 실제 상품목록으로 재확인됨
    ③ mock 백엔드(위 fixture 사용) + Vite dev + Playwright로 UI 실조작 —
       쿨러 행 select 2개/옵션 목록, 종류 선택 시 cooler_type 전달,
       소켓 선택 시 종류 자동 해제(상호배타) + socket 전달, 부품 선택까지.
       기존 카테고리 select 개수 회귀(GPU 2/CPU 1/메인보드 2/SSD 1/RAM 1),
       자동완성 드롭다운이 select를 안 덮는지(PR #7에서 잡았던 겹침 회귀),
       가장 긴 옵션 "M.2 SSD 쿨러"가 116px select에서 안 잘리는지 전부 확인
    → npm run typecheck 통과

[✓] 부수 발견 (이번 변경과 무관, 미수정)
    → 케이스 행 select의 placeholder "지원 폼팩터 전체"가 116px 폭에서
      "지원 폼팩터 전"으로 잘려 보임(PR #7 때부터 있던 것). 기능 영향 없고
      이번 작업 범위 밖이라 손대지 않음 — 고치려면 placeholder를 짧게
      줄이거나(예: "폼팩터 전체") select 폭을 늘리면 됨

---

### 2026-08-06 디자인 다듬기 (frontend v0.9.2)

[✓] 배경 — 사용자가 앞서 전달받은 스크린샷 6장 + design_context.md(토큰/규칙
    브리핑)를 가지고 claude.ai에서 디자인을 다듬어 "Bundled Page"(아티팩트
    export) 형태로 가져옴. Playwright로 실브라우저에 열어 언패킹된 최종 DOM
    + 스크린샷을 뽑아 10개 섹션(00~10, 패치노트 형식)을 확인, 전체 CSS
    코드블록(global.css 적용 코드) 추출

[✓] 적용한 것 — 기존 클래스명 그대로 유지하면서 CSS/필요한 곳만 마크업 조정
    (제안 문서의 새 클래스명은 기존 실제 클래스명에 맞춰 재번역해서 적용,
    "클래스명 변경 없음" 전제를 실제로 지킴):
    → 버튼 위계: `.btn-secondary` 신규(잉크 보더, hover 시 반전) — 홈 "부품
      검색" 링크를 btn-ghost→btn-secondary로 변경. `.btn-primary:disabled`도
      opacity 대신 배경/보더 색 전환으로 명확화
    → `.part-spec-filter` 116→144px + ellipsis — 2026-08-05 세션에 남아있던
      "지원 폼팩터 전체" 잘림 이슈 해결. PartRow.tsx의 SPEC_FILTER_SLOT_WIDTH도
      130→158로 같이 갱신(자동완성 드롭다운 오른쪽 여백 계산용)
    → 판정 게이지: 저가/고가 구간을 잉크로 완전히 채우고 적정 구간만 페이퍼로
      비우는 방식으로 반전(기존 회색 그라데이션은 대비가 흐릿했음). 마커에
      삼각형 팁 추가 + 마커 위 뜨는 퍼센트 라벨(`.gauge-marker-value`) 신규 —
      BuildDetailPage.tsx에 diff_percent 표시 span 추가
    → 소계(`.sum`) 잉크 전체 채움으로 반전 — "이게 최종 숫자다" 위계 명확화
    → 부품 그룹에 `.spec-row-container`(2px 잉크 보더) 추가 — BuildDetailPage
      그룹 렌더링에 wrapper div 추가
    → 탑바: 기존 "실가 / 홈" 텍스트뿐이던 `.topbar-kicker`를 인장(도장) 모티프
      마크 + 워드마크 + hairline 구분자 + 현재 위치 강조로 교체(AppShell.tsx
      topbar 마크업 재구성). 더 이상 안 쓰는 `.topbar-kicker` CSS 삭제
    → 자동완성 드롭다운(`.autocomplete-list`)의 box-shadow 글로우 제거,
      보더를 잉크로 — REFERENCE.md #디자인-토큰의 "box-shadow 글로우 전면
      미사용" 원칙을 어기고 있던 기존 버그를 겸사겸사 수정

[ ] 보류 — 다듬기 범위를 넘어서는 것으로 판단해 적용 안 함:
    → `09·부품 검색 UX 개편`(필터 사이드바 체크박스 + 정렬 탭 + 우측 견적
      카트) — 제안 문서 스스로도 "CSS만으론 안 되고 컴포넌트 구조 변경
      필요"라고 명시. 검색(SearchPage)과 빌드생성(BuildCreatePage per-category
      PartRow)이 분리된 현재 플로우 자체를 견적 카트 개념으로 합치는 것이라
      디자인 다듬기가 아니라 신규 기능 — 별도 논의 필요
    → `06·카드 좌상단 판정 배지`의 포지셔닝 변경은 홈/빌드목록이 카드
      그리드를 공유하는데, 제안 문서의 00B(빌드 목록) 예시는 카드 그리드가
      아니라 리스트 레이아웃이라 전제가 어긋남 — 그리드 유지할지 리스트로
      바꿀지 레이아웃 결정 먼저 필요해서 보류
    → 확인행(`.confirm-row`)의 실측합계→판매가 원화 비교 숫자는 제안대로
      삭제하지 않고 유지 — 게이지 위 퍼센트 라벨은 추가했지만 원화 절대값
      정보 손실은 순수 디자인 변경이 아니라고 판단해 보수적으로 유지

[✓] 검증 — npm run typecheck 통과. mock 백엔드(8개 카테고리 실제 시세
    근사값) + Vite dev + Playwright로 홈/빌드상세/빌드생성 화면 실브라우저
    확인(게이지 반전, 소계 반전, 그룹 보더, 탑바 인장, select 잘림 해결,
    secondary 버튼 전부 스크린샷으로 확인). 콘솔 에러 체크 — 폰트 CDN
    프록시 차단(이 환경 고유 네트워크 제약)만 있고 React/앱 로직 에러 없음

---

### 2026-08-06 (같은 날, 디자인 다듬기 세션 이어서)

#### 보류 항목 처리 — 빌드 카드 배지 재배치 + 검색 UX 개편 (frontend v0.10)

[✓] 배경
    → v0.9.2(디자인 패치노트 반영) 때 컴포넌트 구조 변경이 필요해 보류했던
      2건. 사용자에게 각각 선택지를 제시해서 방향 확정 후 진행:
      (1) 카드 배지 — "카드 유지 + 배지만 좌상단 겹침" 선택
          (리스트 레이아웃 전환은 기각)
      (2) 검색 UX — "전체 적용 — 새 검색+카트 플로우로" 선택
          (필터 사이드바만 적용/보류 대신 전체 구현)

[✓] 빌드 카드 판정 배지 좌상단 겹침
    → .build-card에 position:relative 추가, .bc-tag를 inline-block에서
      position:absolute(top:-13px, left:-1px)로 변경 — 카드 위쪽 hairline에
      살짝 걸치는 탭 형태. 고가/저가는 배경을 잉크로 완전히 채우고 적정은
      아웃라인만(색 대신 채움 여부로 구분하는 기존 원칙 유지)
    → HomePage/BuildListPage 둘 다 같은 .bc-tag를 쓰므로 JSX 변경 없이
      CSS만으로 두 화면 동시 반영

[✓] 검색 화면(SearchPage) 카테고리+견적 카트 플로우로 전면 재구성
    → 기존 SearchPage는 카테고리 개념 자체가 없는 단순 키워드 검색이었음
      (스펙 필터는 PartRow/빌드생성 화면에만 있었고 검색 화면엔 없었음)
    → 새 구조: 카테고리 탭 8개 → 검색창 + 카테고리별 스펙 필터(select) →
      정렬 탭(인기상품순/낮은가격순/높은가격순) → 결과 리스트(행마다
      "담기"/"담음" 버튼) → 우측 "견적 카트" 패널(카테고리 8슬롯, 채워진
      슬롯 클릭 시 × 로 제거, 하단에 빌드 이름 입력 + "이 구성으로 빌드
      만들기" 버튼)
    → 정렬: 인기상품순은 API가 준 순서 그대로(다나와 정렬 기준에 위임),
      낮은/높은가격순은 프론트에서 재정렬(가격 조회 실패 상품은 항상
      맨 뒤). 백엔드에 정렬 파라미터 추가하지 않음 — 서버측 정렬 필요성이
      아직 확인 안 됐고, 이미 받은 결과를 재배열하는 것뿐이라 클라이언트
      단에서 충분
    → "빌드 만들기"는 기존 POST /builds(api.createBuild) 그대로 재사용 —
      새 엔드포인트 없음. 성공 시 BuildCreatePage와 동일하게 새 빌드
      상세로 navigate

[✓] CATEGORIES/CATEGORY_SPEC_FILTERS 단일 소스화 (frontend/src/lib/specFilters.ts 신규)
    → 기존엔 PartRow.tsx 안에 카테고리별 스펙 필터 정의(GPU 메모리/칩셋,
      CPU·메인보드·쿨러 소켓 등 8개 옵션 배열 + CATEGORY_SPEC_FILTERS 맵)가
      갇혀 있었고, BuildCreatePage.tsx는 CATEGORIES 배열을 따로 들고 있었음
    → SearchPage도 똑같은 정의가 필요해지면서 3번째 복사본을 만드는 대신
      specFilters.ts로 추출 — PartRow/BuildCreatePage/SearchPage 3곳이
      이제 이 파일 하나를 단일 소스로 import. main.py 주석에 있던 "프론트
      상수와 키가 정확히 일치해야 함" 경고를 코드 구조로 강제하게 됨
      (더 이상 세 곳을 따로 손대다 값이 어긋날 위험이 없음)

[✓] 검증
    → npx tsc --noEmit 통과
    → mock 백엔드(8종 실제 시세 근사값) + Vite dev + Playwright로:
      카테고리 탭 전환(CPU→GPU→쿨러) 시 스펙 필터가 카테고리에 맞게
      자동 교체되는지, 특정 스펙(GPU 제조사 등) 지정 검색이 attribute로
      제대로 나가는지, "담기" 클릭 시 카트에 반영되고 버튼이 "담음"으로
      바뀌는지, 다른 카테고리로 넘어가 담아도 기존 카트가 유지되는지,
      정렬 탭 전환이 결과 순서를 바꾸는지, 실제 "빌드 만들기" 클릭 →
      POST /builds → 빌드 상세 페이지로 navigate까지 end-to-end 확인
      (CPU 62.9만원 + GPU 99.9만원 담아 저장 → 빌드 상세 총액 162.8만원
      정확히 일치 확인)
    → 회귀 확인: 8개 라우트(홈/빌드목록/빌드생성/검색/통계/즐겨찾기/
      최근기록/설정) 전부 pageerror 0건. specFilters.ts 추출이 기존
      두 소비처를 안 깨뜨렸는지 BuildCreatePage(.part-row 8개 렌더 확인)와
      StatsPage(.stats-picker .part-row 1개 렌더 확인)로 별도 확인

[동작특성] 검색 화면의 견적 카트와 BuildCreatePage(기존 빌드 생성 화면)는
  완전히 독립된 두 진입 경로 — 상태를 공유하지 않고 각자 로컬 React
  state만 씀. 검색 화면에서 담다가 새로고침하면 카트가 날아감(기존
  BuildCreatePage의 PartRow 선택도 원래 같은 특성 — 이번에 새로 생긴
  제약이 아님)

---

### 2026-08-06 (이어진 세션)

#### backend v0.8 / frontend v0.10.1 — SSD 폼팩터 스펙 필터 추가

[✓] 배경
    → PR #11 머지 확인 후, 사용자가 "스펙 필터 확장 → SSD 폼팩터"를 선택.
      SSD는 그동안 interface(SATA3/PCIe 세대)만 있고 폼팩터(M.2 길이/규격)
      필터가 없었음
    → 이 환경은 danawa.com 접근이 프록시로 차단돼 있어(반복 확인된 제약),
      사용자가 다나와 "SSD" 검색결과 페이지의 #prodArea outerHTML을
      통째로 제공 — 기존에 자리잡은 검증 패턴(체크박스 값+상품목록을
      한 파일로 확보) 그대로 재사용

[✓] SSD_FORMFACTOR_ATTRIBUTES 신규 (속성코드 14695 = 폼팩터)
    → 실측 8종 전부 확인: M.2(2280)=202347, M.2(2242)=202350,
      M.2(2230)=656345, M.2(22110)=203997, 6.4cm(2.5형)=86092,
      Mini SATA(mSATA)=109348, PCIe 카드=108308, 기타=86094
      (전부 "{14695}-{값코드}-OR" 형식, #prodArea 내 체크박스 value
      속성에서 직접 확보 — 필터 UI를 조작해서 URL 변화를 관찰하는 대신
      정적 HTML의 value 속성을 바로 읽는 방식, 이전 세션들과 동일)
    → 채택 4종: M.2 2280(가장 흔한 규격) / M.2 2242 / M.2 2230(소형
      폼팩터, 미니PC 등) / 2.5인치(SATA, 여전히 보조 저장장치로 흔함)
    → 제외 4종: M.2(22110, 서버/엔터프라이즈용 — 개인 조립 PC 범위 밖),
      Mini SATA(mSATA, 구형 노트북 전용 규격 — 데스크탑 신규 조립에
      해당 없음), PCIe 카드(애드인 카드 형태, 소수 규격), 기타(라벨
      자체가 불명확) — 기존 데이터 트리밍 원칙(CLAUDE.md, 워크스테이션/
      서버/구형 값 제외) 그대로 적용

[✓] /search?formfactor= 파라미터의 적용 category를 SSD까지 확장
    → 새 쿼리파라미터를 만들지 않고 기존 formfactor 파라미터를 재사용 —
      메인보드(속성코드 506)/케이스(6196)가 이미 같은 파라미터명을
      카테고리별로 다른 딕셔너리로 분리해서 쓰던 방식 그대로 SSD용
      SSD_FORMFACTOR_ATTRIBUTES를 추가(backend/app/main.py::search()의
      `elif category == "SSD":` 분기)
    → SSD는 이제 interface(기존)+formfactor(신규) 2개 스펙 파라미터 보유.
      동시 지정 시 `SSD_INTERFACE_ATTRIBUTES.get(interface) or
      SSD_FORMFACTOR_ATTRIBUTES.get(formfactor)` 체이닝으로 interface
      우선 적용 — GPU(chipset 우선)/메인보드(socket 우선)/쿨러
      (cooler_type 우선)와 동일한 "값 하나만 허용" 제약(다중 attribute
      결합 규칙 미검증) 때문. SSD는 세대/성능을 더 직접 나타내는
      interface를 우선하기로 결정(엄밀한 원칙이 있다기보다 이번에도
      다른 2-스펙 카테고리처럼 임의로 하나 고른 것)
    → API 계약 변경(기존엔 SSD에서 formfactor가 무시됐는데 이제 적용됨)이라
      두 번째 자리 v0.7→v0.8

[✓] 프론트: frontend/src/lib/specFilters.ts의 SSD 항목에 formfactor select
  추가
    → SSD_FORMFACTOR_OPTIONS = ["M.2 2280", "M.2 2242", "M.2 2230", "2.5인치"]
      상수 추가 + CATEGORY_SPEC_FILTERS.SSD 배열에 항목 하나 추가
    → PartRow.tsx/SearchPage.tsx 둘 다 CATEGORY_SPEC_FILTERS[category]를
      specDefs로 받아 .map()으로 select를 렌더링하는 범용 구조라 컴포넌트
      코드 변경 전혀 없이 SSD가 select 1개→2개로 자동 확장됨 — GPU/
      메인보드/쿨러가 이미 2-스펙 카테고리라 이 렌더링 경로 자체는 기존에
      검증된 상태였음(자동완성 드롭다운 우측 오프셋도
      `specDefs.length * SPEC_FILTER_SLOT_WIDTH`로 계산되는 범용 로직이라
      마찬가지로 자동 대응)
    → api.ts의 SearchSpecParams.formfactor 주석에 SSD 추가

[✓] 검증
    → npm run typecheck 통과 (node_modules 세션 리셋으로 재설치 필요했음 —
      이 환경 반복 특이사항)
    → mock 백엔드(danawa.get_product_codes를 attribute값별로 다른 픽스처
      반환하도록 monkeypatch) + curl로 백엔드 단독 검증: formfactor=M.2
      2280 필터링 확인, interface+formfactor 동시 지정 시 interface 우선
      확인, 무필터/다른 category(CPU)에서 formfactor 무시 확인 — 4가지
      케이스 모두 기대값과 일치
    → Vite dev + Playwright(사전 설치 Chromium)로 실브라우저 검증:
      SearchPage SSD 탭에서 select 2개(인터페이스/폼팩터) 정상 렌더링,
      폼팩터에서 "M.2 2280" 선택 후 검색 → 결과가 실제로 그 필터가 적용된
      상품만 표시되는 것 화면에서 확인(스크린샷). BuildCreatePage(PartRow)
      SSD 행도 select 2개 정상 렌더링 + 자동완성 드롭다운이 겹치지 않는
      것 확인. 두 화면 모두 pageerror 0건
    → 검증에 쓴 mock 서버/스크린샷은 스크래치패드에서만 작업(리포에
      커밋 안 함), 임시로 생성됐던 backend/silga.db도 검증 후 삭제

#### 스펙 필터 확장 종료 — GPU 길이·쿨러 냉각 방식 미채택 (코드 변경 없음)

[x] GPU 길이 실측 결과 보고 후 미채택 결정
    → 사용자가 "그래픽카드"(전체 모델 기준) 검색결과 #prodArea 제공, 실측
      결과 "가로(길이)" 필터가 지금까지 쓴 모든 스펙 필터의 "기본검색"
      방식(RepOption, "{속성코드}-{값코드}-OR")이 아니라 다른 UI 체계인
      "상세검색" 방식(input name="searchAttributeValue[]", 값 형식
      "{카테고리seq}|{속성seq}|{값seq}|OR", 예: "753|682|3993|OR")으로
      구현돼 있는 걸 발견 — danawa.py의 attribute= 파라미터가 이 형식을
      받아주는지 실증된 적 없어 바로 구현 불가
    → 값도 10mm 단위로 23개(140~149mm ~ 360mm 이상)나 쪼개져 있고 다중
      attribute 결합이 미검증이라 "300mm 이상"처럼 뭉뚱그린 옵션도 못
      만드는 제약 확인. 카테고리 nav의 "길이 300mm 미만"(cate=11355105)
      서브카테고리 링크는 고정 URL이라 select 필터로 전환 불가
    → 사용자에게 (1) attribute=682-3993-OR 형태로 변환해서 시도해볼 수는
      있으나 다나와 서버가 상세검색 파라미터를 인식하는지 이 환경에서
      검증 불가(사용자 브라우저 확인 필요) (2) 10mm 단위 옵션의 실효성이
      낮다는 점을 보고 → 사용자가 "안 쓸 것 같다"며 코드 구현 없이 미채택

[x] 쿨러 냉각 방식(공랭/수랭) 재검토 후 미채택 재확정
    → 2026-08-05 세션에서 "검색어로 대체 가능, 같은 카테고리 스펙끼리는
      상호배타라 3개를 넣어도 동시 사용 불가"로 이미 미채택했던 항목
      (속성코드 315758만 알고 값별 코드는 실측 안 한 상태) — 이번에 남은
      확장 후보로 다시 거론했으나 재실측 없이 사용자가 그대로 미채택 확정

→ 이 시점 기준 스펙 필터 확장 작업 종료. 8개 카테고리 스펙 필터 구성은
  이대로 최종 — 새로 강하게 필요해지기 전까진 재검토 안 함

---

### 2026-08-07

#### backend v0.9 / frontend v0.10.2 — GPU 길이 스펙 필터 추가 (danawa.com 접근 일시 개방)

[✓] 배경
    → 세션 도중 이 환경의 danawa.com 프록시 차단이 풀림(사용자가 "그거 내가
      풀었는데"로 알려줌) — 실제로 search.danawa.com에 curl/requests 직접
      요청이 200으로 성공하는 것 확인. 사용자가 매번 HTML을 복사해서
      붙여주던 기존 방식 대신, 이 세션에서는 스크래퍼로 직접 danawa를
      호출해서 실측/검증까지 전부 자체적으로 진행한 첫 사례
    → 직전 세션(2026-08-06)에서 "실효성 낮다"고 GPU 길이·쿨러 냉각방식을
      미채택했었는데, 사용자가 "실효성 문제였지, 되면 넣어달라"고 GPU
      길이만 다시 검토 요청. 쿨러 냉각방식은 이번엔 대상에서 제외

[✓] "가로(길이)" 필터가 "상세검색" UI 소속이라는 문제를 라이브로 직접 해결
    → danawa.get_product_codes()로 "그래픽카드"(전체 모델) 실검색 →
      category_label="그래픽카드"로 40건 정상 반환 확인(스크래퍼 자체가
      여전히 살아있는지부터 재확인)
    → "가로(길이)" 필터(속성코드 682)는 원래 값 형식이
      "{카테고리seq}|{속성seq}|{값seq}|OR"(예: "753|682|3993|OR")로,
      지금까지 쓴 다른 스펙 필터의 "{속성코드}-{값코드}-OR" 형식과 달라서
      기존 attribute= 파라미터가 인식할지 불확실했던 문제 — 카테고리seq를
      버리고 하이픈으로 바꾼 "682-3993-OR" 형식으로 실제 요청을 보내서
      직접 검증: count만 비교했을 땐 오判(대부분 페이지당 40건 고정이라
      필터 여부와 무관하게 count가 같아 보임)했다가, 반환된 code 집합을
      비교해서 실제로 다른 상품 집합이 오는 것 확인 → 최종적으로 극단값
      두 개(140~149mm, 360mm~)의 실제 상품 타이틀을 찍어봐서 140~149mm는
      GT1030/GT730/GT710 등 초소형 카드만, 360mm~는 RTX 5080/5090 등
      초대형 카드만 나오는 것으로 확정 검증
    → 여러 구간을 하나로 묶는 다중 attribute 결합 시도(콤마 조인, 파이프
      조인, attribute= 파라미터 반복 전송 3가지) 전부 라이브로 테스트 —
      셋 다 기대한 합집합이 안 나옴(콤마: baseline과도 다른 정체불명 집합,
      파이프: 첫 값만 적용되고 나머지 무시, 파라미터 반복: 역시 다른 값) →
      기존에 문서화돼 있던 "다중 attribute 결합 규칙 미검증" 제약이 실제
      요청으로도 다시 확인됨. 이번에도 결합 없이 단일 값만 지원

[✓] GPU_LENGTH_ATTRIBUTES 신규 — 23개 중 7개 채택
    → 다나와가 제공하는 10mm 단위 구간 전체: 140~149mm ~ 360mm~ (23개,
      전부 attribute value seq 확보 완료 — 지난 세션에 사용자가 제공한
      #prodArea에서 이미 다 뽑아뒀던 값 재사용)
    → 채택 7개(현재 시장 판매 카드가 몰려 있는 실사용 범위 190~369mm):
      190~199mm / 260~269mm / 280~289mm / 300~309mm / 320~329mm /
      340~349mm / 360mm~
    → 제외: 140~189mm 구간(GT710/GT730/GT1030 등 구형 로우프로파일
      업무용 카드 — 개인 게이밍 조립 PC 범위 밖, 기존 트리밍 원칙과 동일),
      200~259mm 구간(현재 세대 카드가 드문 공백 구간이라 생략)
    → main.py::search()의 GPU 분기를
      `GPU_CHIPSET_ATTRIBUTES.get(chipset) or GPU_MEMORY_ATTRIBUTES.get(memory_gb)
      or GPU_LENGTH_ATTRIBUTES.get(length)`로 확장 — chipset이 기존에도
      memory_gb보다 우선이었던 순서를 유지하고 length를 가장 낮은 우선순위로
      추가. 실측: chipset=AMD + length=360mm~ 동시 지정 시 라데온 결과만
      반환되는 것으로 우선순위 확인
    → 새 쿼리파라미터 신설(length)이라 API 계약 변경, 두 번째 자리
      v0.8→v0.9

[✓] 프론트: specFilters.ts GPU 항목에 length select 추가
    → GPU_LENGTH_OPTIONS 상수 추가 + CATEGORY_SPEC_FILTERS.GPU 배열에
      세 번째 항목 추가(제조사/용량/길이). PartRow.tsx/SearchPage.tsx는
      기존과 마찬가지로 컴포넌트 코드 변경 전혀 없이 select 2개→3개로
      자동 확장(SSD formfactor 추가 때 이미 검증된 범용 렌더링 구조 재사용)
    → api.ts: SearchSpecParams.length 필드 추가 + api.search()의
      URLSearchParams 조립부에 length 파라미터 추가

[✓] 검증 — 이번엔 mock이 아니라 실제 danawa 라이브 데이터로 진행
    → npm run typecheck 통과
    → 백엔드: 로컬 FastAPI 서버(mock 아님, 실제 danawa 호출) + curl로
      /search?category=GPU&length=360mm~ 응답이 RTX 5080/5090 카드만
      반환하는 것 확인
    → 프론트: Vite dev + Playwright로 GPU 탭 select 3개 렌더링 확인 →
      길이 select에서 "360mm~" 선택 → "그래픽카드" 검색 → 실제 화면에
      RTX 5080/5090은 나오고 RTX 5060(짧은 카드)은 안 나오는 것 확인
      (스크린샷). 라이브 스크래핑이라 mock보다 느려서(약 5~8초) 대기시간을
      기존 패턴보다 길게 잡아야 했음 — 다음에 라이브로 검증할 때 참고.
      pageerror 0건
    → 검증에 쓴 로컬 서버/스크린샷/테스트 스크립트는 스크래치패드에서만
      작업(리포에 커밋 안 함), 임시 생성된 silga.db도 검증 후 삭제

[메모] danawa.com 접근이 이번 세션에서만 열린 건지 앞으로도 계속 열려있을
  건지는 불확실 — 다음 세션에서 다시 막혀 있으면 기존 방식(사용자가
  #prodArea outerHTML을 붙여주는 방식)으로 돌아가면 됨. 코드/문서 어느
  쪽도 접근 가능 여부에 의존하도록 바꾸지 않음(danawa.py 자체는 원래도
  그냥 requests로 직접 호출하는 구조라 프록시 정책 변화에 영향받지 않음)

#### 오래 미결이던 조사 항목 2건 확인 (코드 변경 없음)

[x] 다나와 공식 오픈API 생사 확인
    → api.danawa.com / developer.danawa.com은 502 Bad Gateway(호스트 자체
      불능으로 추정) — 대신 openapi.danawa.com이 살아있고
      auth.danawa.com/login으로 리다이렉트되는 로그인형 개발자 포털로
      확인됨. 로그인 이후 단계(가격정보 API 공개 여부, 무료 발급 가능
      여부)는 여전히 사람이 직접 가입해서 봐야 함 — "죽음" 결론이 아니라
      "다음 확인 단계"까지 좁혀짐

[x] danawa.com / search.danawa.com robots.txt 상세 확인
    → www.danawa.com: 계정·에러 페이지(/user_report/, /my/, /member/,
      /error/ 등)만 제외, 상품/검색 페이지는 허용
    → search.danawa.com(우리가 실제 스크래핑하는 도메인): /api_ui/,
      /classes/, /genfile/, /globalData/, /snippets/, /tpl/,
      /mobile/tpl/ 만 Disallow — 우리가 쓰는 /dsearch.php는 안 걸림
    → **Crawl-delay: 10 명시 확인** — CLAUDE.md의 "요청 간격 최소
      5~10초" 원칙이 다나와 자체 robots.txt 권고와 정확히 일치. 지금까지
      추정치였던 매너 크롤링 간격에 공식 근거가 생김

#### 다나와 공식 오픈API 조사 마무리 — openapi.danawa.com/robots.txt 확인 (코드 변경 없음)

[✓] 사용자가 "API 조사 이어가자"고 해서 openapi.danawa.com을 좀 더 파봄
    → curl -L로 실제 진입해보니 auth.danawa.com/login으로 최종 리다이렉트
      (로그인 폼 HTML 28KB 확인) — 예상대로 로그인 게이트
    → openapi.danawa.com/robots.txt 확인 → `Disallow: /`로 서브도메인
      전체가 크롤링 차단. /guide, /docs, /api-guide, /member/join,
      /sitemap.xml 등 로그인 없이 접근 가능한 공개 문서 경로가 있는지
      찔러봤으나 전부 404 — 공개 문서 페이지 자체가 없거나 전부 로그인
      뒤에 있음
    → robots.txt의 전면 Disallow를 우회해서 더 스크래핑하는 건 매너
      크롤링 원칙(CLAUDE.md) 위반이라 여기서 조사 중단 — "가격정보 API
      실제 공개 여부/무료 발급 가능 여부/요청 한도"는 사람이 직접
      브라우저로 로그인·가입해야 확인 가능한 것으로 최종 확정. 이 항목은
      더 이상 자동화로 좁힐 수 있는 부분이 없어서 인수인계.md에도
      "사람 몫"으로 명시

#### 다나와 공식 오픈API 최종 결론: 채택 안 함 — 준비 코드 되돌림

[✓] 사용자가 실제로 openapi.danawa.com에서 API 키를 발급받아 공유(보여주기
    용, 이후 폐기 예정이라고 밝힘) — 이를 계기로 공식 API 채택 가능성을
    끝까지 파봄

[✓] happycgi.com/16560 (사용자가 링크로 제공한 페이지) 확인
    → 오래된 링크 모음 사이트 게시물, 실제 문서 아님. 가리키는 주소가
      `http://api.danawa.com/main/index.html` — 우리가 이미 죽은 걸로
      확인한 구버전 도메인. 재확인해도 여전히 DNS 실패/502

[✓] 웹서치 + 3차 소스 크로스체크로 "다나와 공식 오픈API"가 실은 서로
    다른 두 개의 서비스였다는 것 확인
    → **구버전(api.danawa.com)**: 2012-02-21 출시 발표(dpg.danawa.com
      뉴스 기사에서 원문 확인 — "자사의 응용프로그램개발환경(API)을
      외부 개발자에 공개한다고 21일 밝혔다"). 카테고리별 상품목록/
      카테고리정보/뉴스목록/장터/검색 제공, "열린 개발자 공간"이라는
      이름으로 http://api.danawa.com 안내
    → **구버전 공식 종료 확인**: ERPia(전자상거래 ERP 솔루션 업체,
      erpia.net)가 자사 고객 대상으로 2019-05-20 14:46에 올린 공지사항
      원문 직접 확인 — "[공지] 다나와 OPEN API 서비스를 종료되었습니다...
      다나와 OPEN API를 활용하여 이알피아를 이용하셨던 고객님께 안내
      드립니다. 다나와 OPEN API 서비스를 종료했습니다. 이로 인해
      이알피아에서 지원하던 서비스(외부상품등록)도 더 이상 지원이
      어렵게 되었습니다." — 즉 공식적으로 종료된 지 7년 지난 서비스임을
      1차 소스로 확정
    → img.danawa.com에 구버전용 정적 API 가이드 페이지가 아직 남아있는 것
      발견(`img.danawa.com/new/open_api/api_guide.html`, 200 응답) — 다만
      요청 파라미터 표를 파싱해보니 "필수여부" 칸에 "서버 프로그램의
      오류" 같은 에러 설명이 잘못 들어가 있고 탭 메뉴에 "탭2 내용" 같은
      플레이스홀더가 그대로 남아있는 등 미완성 템플릿이 방치된 상태 —
      내용 자체를 신뢰할 수 없음
    → **신버전(openapi.danawa.com, 사용자가 키 발급받은 곳)**은 성격이
      다름 — `site:openapi.danawa.com` 검색 결과 0건(공개 마케팅 대상이
      아니라는 신호), 로그인 후 대시보드 안내 문구가 "허용된 IP를
      통해서만 상품관리가 가능합니다" — 쿠팡/스마트스토어/G마켓 등
      이커머스 업계에서 흔한 "입점 판매자가 자기 상품을 등록·관리하는
      API" 패턴(IP 화이트리스트 + "상품관리" 용어 + 판매자 대상)과 동일.
      즉 제3자가 전체 상품 가격을 조회하는 공개 API가 아니라 판매자
      전용 포털일 가능성이 높음(추정, 사용자가 직접 API 문서를 못 찾아서
      100% 확정은 아니지만 근거는 충분히 쌓임)
    → 로그인 후 API 가이드 페이지 자체도 "charset은 UTF-8로 입력하셔야
      합니다" 에러만 뜨는 고장 상태라는 것도 사용자가 직접 확인

[✓] 준비해뒀던 코드/설정 되돌림 (사용자 지시: "아까 만든 경로 파기하자
    env랑")
    → main.py의 `load_dotenv()` + `DANAWA_OPENAPI_KEY` 로드 코드 제거
      (커밋 4455929에서 추가했던 부분)
    → requirements.txt에서 `python-dotenv` 제거
    → backend/.env.example git rm (커밋 25c9aaf에서 추가됐던 파일)
    → backend/.env(로컬 전용, 실제 키 값이 든 파일, 커밋된 적 없음) 자체
      삭제
    → 데이터소스는 scraping(services/danawa.py) 단일 경로로 원복. 앱
      임포트/기동 정상 확인(python3 -c "import app.main")
    → 버전 번호는 원래 이 dotenv 배선 커밋 자체가 버전을 안 올렸어서
      (인프라 준비 단계라 계약 변경 없음 판단), 되돌려도 별도 버전
      다운그레이드 처리 불필요 — backend는 v0.9(GPU 길이) 그대로 유지

→ 다나와 공식 API 관련 조사는 여기서 완전히 종결. 다음에 이 주제가 다시
  나오면 이 항목부터 먼저 읽을 것 — 도메인이 살아나거나 사용자가 명확한
  API 문서를 직접 확보하지 않는 한 재조사 불필요

---

### 2026-08-07 (이어진 세션)

#### GCP e2-micro 무료 티어 배포 준비 — deploy/ 디렉토리 신규 (코드 실행 검증은 못 함)

[✓] 배경
    → 사용자가 "슬슬 웹 종결하고 서버 붙일까?"로 배포 논의 시작. 배포
      플랫폼 후보는 REFERENCE.md에 이미 정리돼 있었음(Fly.io/Railway/
      GCP Compute Engine VM/GCP Cloud Run, Cloudflare는 제외 확정) —
      Fly.io/Railway가 SQLite+단일 프로세스엔 마찰이 더 적은 후보였지만,
      사용자가 "GCP를 자주 다뤄봐서" 익숙함을 이유로 GCP e2-micro
      무료 티어 선택
    → 배포 구성 확정 전 AskUserQuestion으로 두 가지 확인: (1) 프론트도
      같은 VM에서 서빙할지 vs Vercel 등 별도 호스팅 — 같은 VM 선택
      (2) 도메인/HTTPS 여부 — 일단 VM IP로만, HTTP

[✓] 아키텍처: nginx 정적 서빙 + /api/ 리버스 프록시 단일 VM 구성
    → frontend/dist를 nginx가 직접 서빙, `/api/`로 들어오는 요청만
      `proxy_pass http://127.0.0.1:8000/;`로 로컬 uvicorn에 넘김(경로
      앞의 /api/ 는 프록시 단계에서 벗겨짐 — 백엔드 라우트 자체는
      코드 수정 없이 기존 그대로 씀)
    → 프론트는 `VITE_API_BASE=/api`로 빌드 — 상대경로라 브라우저 입장에서
      완전히 같은 오리진 호출이 됨. **부수효과로 프로덕션에서는 CORS가
      아예 발동하지 않음** — preflight 자체가 안 걸림(브라우저의 CORS
      검사는 크로스 오리진 요청에만 적용되는 것이므로). 오래 보류 중이던
      "배포 시 CORS allow_origins=["*"] 좁히기" 항목이 이 구성 때문에
      전제 자체가 사라짐 — 코드는 안 건드림(로컬 dev는 Vite :5173 →
      백엔드 :8000으로 여전히 크로스 오리진이라 와일드카드 유지 필요),
      인수인계.md "수정 예정 사항"에서 [x] 처리하고 사유 기록
    → 백엔드는 systemd로 관리, `127.0.0.1:8000`에만 바인딩(외부에서
      직접 8000 포트로 못 들어옴 — nginx를 통한 80포트만 노출)해서
      매너 크롤링 우회 목적의 직접 API 노출 리스크도 같이 줄임(의도한
      부수효과는 아니지만 결과적으로 안전한 구성)

[✓] deploy/ 디렉토리 신규 (파일 4개)
    → `silga-backend.service`: systemd 유닛. 전용 시스템 유저 `silga`로
      실행(root 아님), `WorkingDirectory=/opt/silga/backend`라 DB 파일
      (`ppe.db`, 상대경로)이 자동으로 그 아래 생김 — database.py 코드
      수정 없이 그대로 동작
    → `nginx-silga.conf`: 정적 서빙 + `/api/` 프록시 + SPA 라우팅
      (`try_files $uri /index.html`로 React Router 새로고침 시 404
      방지)
    → `deploy.sh`: git pull + 백엔드 venv pip install + 프론트 npm
      install/build + systemctl restart/reload를 한 번에 — 이후 코드
      갱신 시 VM에서 이 스크립트 한 번만 실행하면 되게 함
    → `README.md`: gcloud VM 생성 명령부터 방화벽 규칙, 전용 유저 생성,
      Node.js 20 LTS 설치(Ubuntu 22.04 기본 apt 버전이 낮아 nodesource
      사용), systemd/nginx 등록까지 전체 절차를 순서대로 정리. e2-micro
      무료 티어가 특정 리전(us-west1/us-central1/us-east1) 한정이라는
      것도 명시
    → 루트 README.md에 "## 배포" 섹션 추가해서 deploy/README.md로 연결
    → REFERENCE.md #기술-스택 배포 항목을 "미정"에서 확정 상태로 갱신,
      기각된 후보(Fly.io/Railway/Cloud Run/Cloudflare)는 사유와 함께
      남겨둠(구조 결정이라 REFERENCE.md도 같이 갱신 — CLAUDE.md 규칙),
      #저장소-구조 트리에도 deploy/ 추가

[주의/미검증] 이 세션 환경엔 GCP 인증이 없어서(`gcloud` 명령 자체가
    설치 안 돼 있음) 실제 VM 생성이나 이 배포 스크립트/설정 파일의 실제
    동작을 검증하지 못함 — 파일 내용은 설계 검토 수준으로만 확인. 실제
    VM에서 처음 돌려볼 때 오탈자/권한/방화벽 이슈 등이 나올 수 있음.
    사용자가 직접 실행해보고 문제 생기면 다음 세션에서 대응 필요

---

### 2026-08-07 (같은 세션, 실제 GCP VM 배포 진행하며 이어서)

#### GCP e2-micro 실배포 — 문제 4건 발견·해결, 최종 정상 확인 (PR #16~#19)

[✓] PR #16 — deploy/ 준비 커밋들이 main에 안 올라가 있던 것 뒤늦게 발견
    → 사용자가 `git clone`으로 VM에 리포 받았는데 `deploy/silga-backend.service`가
      "No such file or directory" — 원인은 GCP 배포 준비 작업 커밋들을
      만들어놓고 PR을 안 만든 채 방치했던 것(직전 세션에서 "PR 만들어서
      머지할까요?"라고 물어놓고 실제로 안 함). 부랴부랴 PR #16 생성+머지,
      main에 deploy/ 반영. **교훈: 커밋 쌓아두지 말고 그때그때 PR 만들어서
      머지할 것** — 이후 이 세션에서는 커밋마다 바로 PR 만들어서 머지하는
      패턴으로 전환(#17~#19가 그 예)

[✓] `git clone` "destination path already exists and is not an empty
    directory" 반복 발생 — 원인 규명에 몇 차례 시행착오
    → 1차: `useradd -m -d /opt/silga`가 홈 디렉토리 생성 시 스켈레톤
      파일(.bash_logout/.bashrc/.profile)을 자동으로 넣어놔서 "비어있지
      않음" 판정 — 해당 3개 파일만 지우고 재시도해서 1차 클론 성공
    → 2차(deploy/ 뒤늦게 머지 후 재클론 시도): 이번엔 `rm -rf
      /opt/silga/* /opt/silga/.[!.]*` 글롭 방식으로 지웠는데도 동일 에러
      재발 — 사용자가 확인 중 실수로 `ls -la`를 인자 없이 쳐서 자기
      홈 디렉토리(`/home/wltjd0623`)를 보고 "/opt/silga 맞나" 헷갈렸던
      해프닝 있었음(연결 문제 아니었음, 단순 경로 착오)
    → 최종 해결: `/opt/silga`를 통째로 `rm -rf`한 뒤 `mkdir -p` +
      `chown silga:silga`로 새로 만들고 클론 — 이 과정에서 `/opt`
      자체가 root 소유라 `silga` 유저가 직접 `git clone .../opt/silga`로
      새 디렉토리를 만들 권한이 없다는 것도 확인(mkdir을 root가 먼저
      해줘야 함)

[✓] PR #17 — 실사용 버그 2건 + nginx 타임아웃 선제 조정
    → `sudo journalctl -u silga-backend -f`로 재현 로그 확보, 정확한
      원인 파악: `PriceHistory.min`/`max`(schemas/history.py, `str` 타입)에
      `danawa.get_price_variance()`가 반환하는 int(`minPrice`/`maxPrice`)를
      그대로 대입해서 pydantic ValidationError → 500. `PricePoint.price`는
      이미 `str(p["price"])`로 캐스팅돼 있었는데 `min`/`max`만 빠져있던
      실수 — `str()` 캐스팅 추가로 해결
    → 왜 "3개월 이상만" 증상으로 보였는지: 데이터가 아예 없는 기간은
      `get_price_variance`가 `TypeError`를 던지고 엔드포인트가 그걸
      404로 먼저 처리해버려서 이 타입버그 지점까지 도달을 안 함 — 실제
      가격 데이터가 있는 기간(사용자가 테스트한 상품 기준 3/6/12개월)만
      끝까지 진행되다가 크래시가 드러난 것
    → nginx `/api/` 프록시 타임아웃도 60→180초로 미리 늘림(`create_build`가
      부품마다 `danawa.get_product()` 순차 호출 — 매너 크롤링 원칙상
      병렬화 안 하는 기존 설계라 부품 많은 빌드는 오래 걸릴 수 있음,
      main.py 기존 주석에도 명시돼 있던 특성)

[✓] PR #18 — `deploy.sh` 권한 구조 버그
    → 사용자가 안내대로 `sudo -u silga ./deploy.sh` 실행 → 스크립트 내부
      `sudo systemctl restart silga-backend` 지점에서 `[sudo] password
      for silga:` 프롬프트 뜨고 실패(`silga`는 `-s /usr/sbin/nologin`으로
      만든 로그인 불가 시스템 계정이라 애초에 유효한 비밀번호가 없음,
      sudoers도 아님)
    → `deploy.sh`를 **root로 실행**하도록 재구성 — 스크립트 시작 시
      `id -u -ne 0`이면 에러로 즉시 중단, 파일 작업(git pull/pip/npm)만
      내부에서 `sudo -u silga bash -c "..."`로 낮춰서 처리, systemctl은
      이미 root 컨텍스트라 그대로 실행. README.md "이후 업데이트" 절차도
      같이 수정 + "nginx/systemd 설정 파일 자체가 바뀐 경우 deploy.sh만으론
      부족함" 안내 추가(설정 파일은 자동 동기화 안 되는 구조라서)

[✓] PR #19 — danawa.py 타임아웃 누락
    → PR #17~#18 반영 후 재배포하는 과정에서 `sudo systemctl restart`가
      즉시 안 끝나고 `State 'stop-sigterm' timed out. Killing.` →
      SIGKILL로 강제 종료되는 로그 확인 — 90초 넘게 이전 프로세스가
      graceful shutdown 신호에 응답을 안 함
    → 원인: `danawa.py`의 `requests.get()` 3곳(get_product_codes/
      get_product/get_price_variance) 전부 `timeout=` 파라미터가 없었음
      — 다나와 쪽 요청이 어딘가에서 멈추면 무한정 대기하다가 워커
      스레드를 붙잡고 있을 수 있는 구조였음(실제로 그게 원인이었는지
      100% 확증은 못 했지만 정황상 가장 유력, 재현 로그에 특정 요청
      단계가 안 찍히고 그냥 멈춰있었음)
    → 셋 다 `timeout=20` 추가. `requests.Timeout`이
      `requests.RequestException`의 서브클래스인 것 python으로 직접
      확인(`issubclass(requests.Timeout, requests.RequestException)` →
      True) — main.py 전역에 이미 깔려있는 503/부품별 fallback 예외
      처리가 타임아웃도 자동으로 커버하게 됨, 별도 except 분기 추가 불필요

[✓] 최종 검증 — 사용자가 실제 배포된 사이트(GCP e2-micro, 외부 IP
    34.56.49.73)에서 브라우저로 직접 확인
    → 검색 정상(이전엔 502 Bad Gateway로 전부 실패했었음)
    → 빌드 저장 정상
    → 히스토리 3/6개월 이상 조회 정상
    → 사용자 코멘트: "깔끔하게 잘 된다 다듬기만 하면 되겠네"

→ 실가가 처음으로 로컬 개발 환경을 벗어나 실제 서버에서 상시 구동되는
  상태 달성. 이후 코드 변경 시 재배포는 `deploy/README.md` "이후
  업데이트" 섹션 절차(PR #18로 고쳐진 버전) 그대로 따르면 됨
