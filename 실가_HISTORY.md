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
