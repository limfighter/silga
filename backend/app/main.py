"""
실가 backend — FastAPI 스켈레톤

구현된 엔드포인트: /search, /product/{code}, /product/{code}/history,
/estimate, /product/{code}/compare(단일 상품 기준), /build/compare(빌드 전체
기준, REFERENCE.md 원문에는 없던 신규 엔드포인트 — /compare의 단일상품 vs
빌드전체 스펙 불일치를 해결하기 위해 추가함. REFERENCE.md #엔드포인트-설계
갱신 필요, 계약 변경이라 버전 v0.2 표기 대상).
"""

import time
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import requests

from app.services import danawa
from app.services.verdict import calc_verdict, compute_ma_price, MA_WINDOW_CHOICES
from app.schemas.search import SearchResultItem
from app.schemas.product import ProductDetail, ProductVariant
from app.schemas.history import PriceHistory, PricePoint
from app.schemas.estimate import (
    EstimateItem,
    BreakdownItem,
    EstimateResponse,
    BuildCompareRequest,
    BuildCompareResponse,
)
from app.schemas.compare import ProductCompareResponse, VerdictBasisItem
from app.schemas.build import (
    BuildCreateRequest,
    BuildSummary,
    BuildDetail,
    BuildItemDetail,
)
from app.schemas.favorite import FavoriteCreateRequest, FavoriteItem
from app.utils import format_won
from app.database import Base, engine, get_db
from app.models import Product, Build, BuildItem, Favorite
from app.timezone_utils import now_kst

def _validate_ma_window(ma_window: int) -> int:
    """
    ma_window 쿼리파라미터 검증. Literal[7,14,30] 타입 힌트로 FastAPI가
    자동 검증하게 하는 방법도 시도했으나, 쿼리파라미터는 항상 문자열로
    들어와서 Literal[int, ...]가 "14"(str)를 14(int)로 캐스팅하지 않고
    그대로 422 처리해버리는 문제가 있어(fastapi 0.141 / pydantic 2.13
    실측 확인) /history의 months 검증과 같은 방식(수동 체크)으로 통일함.
    """
    if ma_window not in MA_WINDOW_CHOICES:
        raise HTTPException(status_code=422, detail="ma_window는 7, 14, 30 중 하나여야 함")
    return ma_window

app = FastAPI(title="실가 backend", version="0.1.0")


@app.on_event("startup")
def _create_tables():
    # 개인 프로젝트 규모 — Alembic 등 마이그레이션 도구 없이 create_all로 충분
    Base.metadata.create_all(bind=engine)

# 개인 프로젝트, 인증 없음 — 로컬 프론트(Vite dev server)에서 크로스 오리진 호출 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/search", response_model=list[SearchResultItem])
def search(q: str = Query(..., min_length=1, description="검색 키워드")):
    """
    GET /search?q={keyword} → [{code, title, price, price_formatted}, ...]
    """
    try:
        results = danawa.get_product_codes(q)
    except requests.RequestException:
        # 데이터 소스 자체 장애 (다나와 연결 실패) — 상품 없음과 구분
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")

    return [
        SearchResultItem(
            code=item["code"],
            title=item.get("title"),
            price=item.get("price"),
            price_formatted=format_won(item.get("price")),
        )
        for item in results
    ]


@app.get("/product/{code}", response_model=ProductDetail)
def get_product_detail(code: int):
    """
    GET /product/{code} → {code, title, category, current_price, cash_price,
                            spec, variants: [...]}

    category(카테고리 브레드크럼)와 cash_price(현금최저가)는 2026-08-04
    파싱 구현 완료(danawa.py::get_product 참조) — 둘 다 데이터가 없는
    상품(예: 현금결제 전용 판매처가 없는 상품)에서는 None 그대로 반환됨,
    파싱 실패가 아니라 정상적으로 없는 값.
    """
    try:
        data = danawa.get_product(code)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")

    if not data or "title" not in data:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없음")

    lowest_price = data.get("lowest_price")
    current_price = None
    if lowest_price is not None:
        try:
            current_price = int(lowest_price)
        except (TypeError, ValueError):
            current_price = None

    variants = [
        ProductVariant(
            type=v.get("type"),
            price=v.get("price"),
            mall_count=v.get("mall_count"),
            pcode=v.get("pcode"),
            is_current=v.get("is_current", False),
        )
        for v in data.get("variants", [])
    ]

    return ProductDetail(
        code=code,
        title=data.get("title"),
        category=data.get("category"),
        current_price=current_price,
        cash_price=data.get("cash_price"),
        spec=data.get("spec"),
        variants=variants,
        in_stock=data.get("in_stock"),
    )


def _fetch_lowest_price(code: int):
    """
    단일 상품의 title/lowest_price를 조회.
    실측 합계/판정 계산 원칙(REFERENCE.md #엔드포인트-설계)에 따라 항상
    lowest_price 필드만 사용 — prices 리스트에서 min() 계산 금지.
    """
    data = danawa.get_product(code)
    if not data or "title" not in data:
        return None, None

    lowest_price = data.get("lowest_price")
    price_int = None
    if lowest_price is not None:
        try:
            price_int = int(lowest_price)
        except (TypeError, ValueError):
            price_int = None

    return data.get("title"), price_int


def _compute_estimate(items: list[EstimateItem]):
    """
    POST /estimate, POST /build/compare가 공유하는 견적 계산 로직.

    주의: 항목 수만큼 danawa.get_product()를 순차 호출함 — 매너 크롤링 원칙
    (요청 간격 5~10초, 동시 병렬 지양)을 지키려면 부품 수가 많은 빌드일수록
    응답이 느려짐. 개인용 규모라 지금은 별도 스로틀링/캐싱 없이 그대로 감.
    부품 수가 많아져서 체감 지연이 문제되면 그때 재검토.

    부품 하나의 danawa 연결이 끊겨도(requests.RequestException) 전체 요청을
    실패시키지 않고 그 부품만 가격 정보 없음(title/price=None)으로 처리하고
    계속 진행 — POST /builds(create_build)·_fetch_ma_price의 기존 부품별
    fallback 관례를 따름(2026-08-04 결정, 실가_인수인계.md 참조). 단일 상품
    조회(GET /product/{code}, GET /product/{code}/compare)는 이 관례 대상이
    아니고 연결 장애 시 즉시 503 처리 유지.
    """
    breakdown = []
    total_price = 0

    for item in items:
        try:
            title, price = _fetch_lowest_price(item.code)
        except requests.RequestException:
            title, price = None, None
        breakdown.append(
            BreakdownItem(category=item.category, title=title, price=price)
        )
        if price is not None:
            total_price += price

    return total_price, breakdown


_VERDICT_BASIS_CACHE_TTL_SECONDS = 300  # 5분
_verdict_basis_cache: dict[tuple[int, int], tuple[float, tuple]] = {}


def _fetch_ma_price(code: int, ma_window: int):
    """
    최근 ma_window일 이동평균 최저가. get_price_variance(code, 3)(3개월치)을
    불러서 compute_ma_price()로 계산.

    by_month=1이 아니라 3을 쓰는 이유(2026-08-04 로컬 라이브 검증으로 발견):
    다나와는 daily가 아니라 주 단위로 데이터를 줘서 1개월치는 포인트가 4개
    안팎뿐 — compute_ma_price()의 "엄격" 기준(히스토리가 window일 전체를
    커버해야 유효, services/verdict.py 참조)을 window=30일 때 만족하기엔
    범위가 부족함. 3개월치를 받아두면 최근 30일 컷오프보다 훨씬 이전
    데이터까지 확보돼서 정상 상품이면 세 window(7/14/30) 전부 판단 가능.

    히스토리 조회 자체가 실패하거나(장애/데이터 없음) "엄격" 기준을 못
    채우면(신상품 등) None — 호출부에서 즉시가로 fallback 처리.
    """
    try:
        variance = danawa.get_price_variance(code, 3)
    except (requests.RequestException, TypeError):
        return None
    return compute_ma_price(variance["prices"], ma_window)


def _compute_verdict_basis(items: list[EstimateItem], breakdown: list[BreakdownItem], ma_window: int):
    """
    판정(verdict) 기준가 계산. 부품별로 이동평균(ma_window일)이 유효하면 그
    값을, 무효(신상품이라 데이터 부족 등)하면 breakdown의 즉시가로 대체
    (fallback)해서 합산한다. 부품 하나라도 fallback되면 전체 판정을
    null로 날리지 않고 verdict_confidence를 "low"로 낮춰 투명하게 표시함
    (2026-08-04 결정, 실가_인수인계.md "결정 완료" 참조).

    breakdown은 _compute_estimate()가 이미 계산해둔 즉시가를 그대로
    재사용 — fallback용으로 danawa.get_product()를 다시 호출하지 않기
    위함(중복 스크래핑 방지).
    """
    basis_total = 0
    has_price = False
    confidence = "high"
    basis_breakdown = []

    for item, bd in zip(items, breakdown):
        ma_price = _fetch_ma_price(item.code, ma_window)
        if ma_price is not None:
            price, source = ma_price, "ma"
        else:
            price, source = bd.price, "current_fallback"
            confidence = "low"

        if price is not None:
            basis_total += price
            has_price = True

        basis_breakdown.append(VerdictBasisItem(code=item.code, price=price, source=source))

    basis_price = basis_total if has_price else None
    return basis_price, confidence, basis_breakdown


def _get_cached_verdict_basis(
    build_id: int, ma_window: int, items: list[EstimateItem], breakdown: list[BreakdownItem]
):
    """
    GET /builds, GET /builds/{id} 전용 캐시(같은 캐시를 공유). 저장된
    빌드를 매번 순회 재계산하는 구조라, 이동평균 도입으로 부품당 스크래핑이
    2배(get_product + get_price_variance)가 되는 부담과, 목록↔상세 이동
    시 캐시 미스 타이밍 차이로 판정이 다르게 뜨는 문제를 함께 완화하려고
    (build_id, ma_window) 키로 5분간 프로세스 메모리에 들고 있음 (DB 저장
    아님 — "가격 자체 축적 금지" 원칙과는 별개, 총 견적가 total_price는
    이 캐시 대상이 아니고 항상 새로 조회함). 2026-08-04 결정,
    실가_인수인계.md 참조.
    """
    cache_key = (build_id, ma_window)
    now = time.monotonic()
    cached = _verdict_basis_cache.get(cache_key)
    if cached and now - cached[0] < _VERDICT_BASIS_CACHE_TTL_SECONDS:
        return cached[1]

    result = _compute_verdict_basis(items, breakdown, ma_window)
    _verdict_basis_cache[cache_key] = (now, result)
    return result


@app.get("/product/{code}/history", response_model=PriceHistory)
def get_price_history(code: int, months: int = Query(..., description="1, 3, 6, 12 중 하나")):
    """
    GET /product/{code}/history?months={1|3|6|12} → {min, max, prices: [...]}
    """
    if months not in (1, 3, 6, 12):
        raise HTTPException(status_code=422, detail="months는 1, 3, 6, 12 중 하나여야 함")

    try:
        variance = danawa.get_price_variance(code, months)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")
    except TypeError:
        # danawa.get_price_variance는 해당 기간 데이터가 없으면 TypeError 발생
        raise HTTPException(status_code=404, detail="가격 히스토리를 찾을 수 없음")

    return PriceHistory(
        min=variance["min"],
        max=variance["max"],
        prices=[
            PricePoint(date=p["date"], price=str(p["price"]), full_date=p.get("full_date"))
            for p in variance["prices"]
        ],
    )


@app.post("/estimate", response_model=EstimateResponse)
def estimate(items: list[EstimateItem]):
    """
    POST /estimate  body: [{code}, {code, category}, ...]
                    → {total_price, total_price_formatted, breakdown: [...]}
    """
    total_price, breakdown = _compute_estimate(items)

    return EstimateResponse(
        total_price=total_price,
        total_price_formatted=format_won(total_price),
        breakdown=breakdown,
    )


@app.get("/product/{code}/compare", response_model=ProductCompareResponse)
def compare_single_product(
    code: int,
    market_price: int = Query(...),
    ma_window: int = Query(14, description="판정 기준 이동평균 기간(일), 7/14/30 중 하나"),
):
    """
    GET /product/{code}/compare?market_price={n}&ma_window={7|14|30}
        → {title, lowest_price, estimate_total, verdict_basis_price,
           verdict_confidence, verdict_basis_breakdown, ma_window,
           market_price, verdict, diff_percent}

    단일 상품 기준 — estimate_total(즉시가)은 그 상품 하나의 lowest_price와
    동일값, 의미 안 바뀜. 판정(verdict)은 이동평균 기준가
    (verdict_basis_price)로 계산하고, 이동평균 데이터가 부족하면 즉시가로
    대체(fallback)하면서 verdict_confidence를 "low"로 표시함 (2026-08-04
    결정, 실가_인수인계.md 참조).

    단일 상품 조회라 GET /product/{code}(get_product_detail)와 동일하게
    danawa 연결 장애(requests.RequestException)는 즉시 503 처리 — 다중
    부품을 합산하는 /estimate·/build/compare·GET /builds류와 달리 부품별
    fallback 관례를 적용할 대상이 없음(2026-08-04 결정, 실가_인수인계.md 참조).
    """
    ma_window = _validate_ma_window(ma_window)

    try:
        title, lowest_price = _fetch_lowest_price(code)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")
    if lowest_price is None:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없거나 최저가 정보 없음")

    ma_price = _fetch_ma_price(code, ma_window)
    if ma_price is not None:
        basis_price, confidence, source = ma_price, "high", "ma"
    else:
        basis_price, confidence, source = lowest_price, "low", "current_fallback"

    verdict, diff_percent = calc_verdict(basis_price, market_price)

    return ProductCompareResponse(
        title=title,
        lowest_price=lowest_price,
        estimate_total=lowest_price,
        verdict_basis_price=basis_price,
        verdict_basis_price_formatted=format_won(basis_price),
        verdict_confidence=confidence,
        verdict_basis_breakdown=[VerdictBasisItem(code=code, price=basis_price, source=source)],
        ma_window=ma_window,
        market_price=market_price,
        verdict=verdict,
        diff_percent=diff_percent,
    )


@app.post("/build/compare", response_model=BuildCompareResponse)
def compare_build(payload: BuildCompareRequest):
    """
    POST /build/compare  body: {items: [{code, category}, ...], market_price, ma_window?}
                         → {total_price, total_price_formatted, breakdown,
                            verdict_basis_price, verdict_confidence,
                            verdict_basis_breakdown, ma_window, market_price,
                            verdict, diff_percent}

    REFERENCE.md 원문에는 없던 신규 엔드포인트. app-shell-mockup.html의
    "빌드 상세 → 판정 게이지"가 실제로 필요로 하는 건 빌드 전체 합계 대
    판매가 비교라, 문서상 단일상품용이던 /product/{code}/compare와는 별도로
    빌드 전체용을 추가함 (사용자 확인 완료).

    total_price(즉시가)는 지금처럼 순간 스크래핑 값 그대로, 의미 안 바뀜.
    판정은 verdict_basis_price(부품별 이동평균, 무효한 부품은 즉시가로
    fallback)로 계산함 (2026-08-04 결정, 실가_인수인계.md 참조).
    """
    total_price, breakdown = _compute_estimate(payload.items)

    if total_price == 0:
        raise HTTPException(status_code=404, detail="부품 가격을 하나도 찾지 못해 판정 불가")

    basis_price, confidence, basis_breakdown = _compute_verdict_basis(
        payload.items, breakdown, payload.ma_window
    )

    if basis_price is None:
        raise HTTPException(status_code=404, detail="부품 가격을 하나도 찾지 못해 판정 불가")

    verdict, diff_percent = calc_verdict(basis_price, payload.market_price)

    return BuildCompareResponse(
        total_price=total_price,
        total_price_formatted=format_won(total_price),
        breakdown=breakdown,
        verdict_basis_price=basis_price,
        verdict_basis_price_formatted=format_won(basis_price),
        verdict_confidence=confidence,
        verdict_basis_breakdown=basis_breakdown,
        ma_window=payload.ma_window,
        market_price=payload.market_price,
        verdict=verdict,
        diff_percent=diff_percent,
    )


def _cache_product(
    db: Session,
    code: int,
    title: Optional[str] = None,
    category: Optional[str] = None,
    spec: Optional[str] = None,
    img: Optional[str] = None,
):
    """
    products 테이블은 재조회 최소화용 캐시(가격 제외, REFERENCE.md #DB-스키마
    참조) — build_item.product_code FK가 가리킬 로우가 있어야 하므로, 빌드/
    즐겨찾기 저장 시점에 title/category/spec/img를 upsert 해둠. 가격은 여기
    저장하지 않음.
    """
    existing = db.query(Product).filter(Product.code == code).first()
    if existing:
        if title is not None:
            existing.title = title
        if category is not None:
            existing.category = category
        if spec is not None:
            existing.spec = spec
        if img is not None:
            existing.img = img
        existing.cached_at = now_kst()
    else:
        db.add(Product(code=code, title=title, category=category, spec=spec, img=img, cached_at=now_kst()))
    db.commit()


@app.post("/builds", response_model=BuildSummary, status_code=201)
def create_build(payload: BuildCreateRequest, db: Session = Depends(get_db)):
    """
    POST /builds  body: {name, market_price?, items: [{category, code}, ...]}

    REFERENCE.md 원 계약에는 없던 신규 엔드포인트 — DB 스키마(builds/build_items)는
    이미 설계돼 있었는데 이걸 채워넣는 CRUD가 누락돼 있었음. 빌드 탭 "생성 →
    분석하기" 흐름이 실제로 저장까지 하려면 필요.
    """
    build = Build(name=payload.name, market_price=payload.market_price, created_at=now_kst())
    db.add(build)
    db.commit()
    db.refresh(build)

    for item in payload.items:
        # products 캐시에 없으면 채워넣기 (FK 무결성 + 목록 화면 title 표시용)
        try:
            data = danawa.get_product(item.code)
        except requests.RequestException:
            data = {}
        _cache_product(db, item.code, title=data.get("title"), category=data.get("category"), spec=data.get("spec"), img=data.get("img"))

        db.add(BuildItem(build_id=build.id, category=item.category, product_code=item.code))
    db.commit()

    return BuildSummary(
        id=build.id,
        name=build.name,
        market_price=build.market_price,
        created_at=build.created_at,
        item_count=len(payload.items),
        total_price=None,
        total_price_formatted=None,
        verdict=None,
    )


@app.get("/builds", response_model=list[BuildSummary])
def list_builds(
    ma_window: int = Query(14, description="판정 기준 이동평균 기간(일), 7/14/30 중 하나"),
    db: Session = Depends(get_db),
):
    """
    GET /builds?ma_window={7|14|30} → 저장된 빌드 목록 (앱 셸 "내 빌드" 카드
    목록에 대응)

    카드에 적정가/고가/저가 태그를 보여주려면 라이브 가격 조회가 필요해서,
    목록 조회 시점에 빌드마다 _compute_estimate를 다시 돌림 — 개인 프로젝트
    규모라 지금은 그대로 감(빌드 개수 많아지면 느려질 수 있음, 나중에 재검토).

    total_price(즉시가)는 항상 새로 조회. verdict는 이동평균 기준가로
    계산하되 (build_id, ma_window) 단위 5분 캐시(_get_cached_verdict_basis)를
    씀 — 이동평균 도입으로 부품당 스크래핑이 2배 늘어난 부담을 덜기 위함
    (2026-08-04 결정, 실가_인수인계.md 참조).
    """
    ma_window = _validate_ma_window(ma_window)

    builds = db.query(Build).all()
    results = []

    for build in builds:
        items = [EstimateItem(code=bi.product_code, category=bi.category) for bi in build.items]
        total_price, breakdown = _compute_estimate(items) if items else (0, [])

        verdict = None
        confidence = None
        if build.market_price and total_price and items:
            basis_price, confidence, _ = _get_cached_verdict_basis(build.id, ma_window, items, breakdown)
            if basis_price:
                verdict, _ = calc_verdict(basis_price, build.market_price)

        results.append(
            BuildSummary(
                id=build.id,
                name=build.name,
                market_price=build.market_price,
                created_at=build.created_at,
                item_count=len(items),
                total_price=total_price or None,
                total_price_formatted=format_won(total_price) if total_price else None,
                verdict=verdict,
                verdict_confidence=confidence if verdict else None,
                ma_window=ma_window if verdict else None,
            )
        )

    return results


@app.get("/builds/{build_id}", response_model=BuildDetail)
def get_build_detail(
    build_id: int,
    ma_window: int = Query(14, description="판정 기준 이동평균 기간(일), 7/14/30 중 하나"),
    db: Session = Depends(get_db),
):
    """
    GET /builds/{id}?ma_window={7|14|30} → 빌드 상세 (판정 게이지 + breakdown,
    앱 셸 빌드 상세 화면에 대응)

    total_price(즉시가)는 항상 새로 조회. verdict/verdict_basis_price는
    이동평균 기준(무효한 부품은 즉시가 fallback)이고, GET /builds(목록)와
    같은 (build_id, ma_window) 캐시를 공유해서 목록↔상세 이동 시 판정이
    서로 다르게 뜨는 걸 방지함 (2026-08-04 결정, 실가_인수인계.md 참조).
    """
    ma_window = _validate_ma_window(ma_window)

    build = db.query(Build).filter(Build.id == build_id).first()
    if build is None:
        raise HTTPException(status_code=404, detail="빌드를 찾을 수 없음")

    items = [EstimateItem(code=bi.product_code, category=bi.category) for bi in build.items]
    total_price, breakdown = _compute_estimate(items) if items else (0, [])

    verdict = None
    diff_percent = None
    basis_price = None
    confidence = None
    basis_breakdown = []
    if build.market_price and total_price and items:
        basis_price, confidence, basis_breakdown = _get_cached_verdict_basis(
            build.id, ma_window, items, breakdown
        )
        if basis_price:
            verdict, diff_percent = calc_verdict(basis_price, build.market_price)

    return BuildDetail(
        id=build.id,
        name=build.name,
        market_price=build.market_price,
        created_at=build.created_at,
        items=[
            BuildItemDetail(
                category=bd.category,
                code=item.code,
                title=bd.title,
                price=bd.price,
            )
            for bd, item in zip(breakdown, items)
        ],
        total_price=total_price,
        total_price_formatted=format_won(total_price),
        verdict_basis_price=basis_price,
        verdict_basis_price_formatted=format_won(basis_price),
        verdict_confidence=confidence if verdict else None,
        verdict_basis_breakdown=basis_breakdown if verdict else [],
        ma_window=ma_window if verdict else None,
        verdict=verdict,
        diff_percent=diff_percent,
    )


@app.post("/favorites", response_model=FavoriteItem, status_code=201)
def add_favorite(payload: FavoriteCreateRequest, db: Session = Depends(get_db)):
    """
    POST /favorites  body: {code} → 즐겨찾기 추가 (2026-08-04 신규 — 즐겨찾기
    탭 채우는 첫 엔드포인트, DB에 favorites 테이블 신설)

    이미 즐겨찾기된 상품이면 새로 추가하지 않고 기존 항목을 그대로
    반환(idempotent) — 중복 추가를 에러로 취급하지 않음.
    danawa.get_product()를 한 번만 호출해서 존재 확인 + products 캐시
    upsert + 응답용 즉시가까지 한 번에 처리(중복 스크래핑 방지).
    단일 상품 조회라 GET /product/{code}와 동일하게 연결 장애는 즉시 503.
    """
    existing = db.query(Favorite).filter(Favorite.product_code == payload.code).first()

    try:
        data = danawa.get_product(payload.code)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")

    if not data or "title" not in data:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없음")

    lowest_price = data.get("lowest_price")
    price = None
    if lowest_price is not None:
        try:
            price = int(lowest_price)
        except (TypeError, ValueError):
            price = None

    if existing is None:
        _cache_product(db, payload.code, title=data.get("title"), category=data.get("category"), spec=data.get("spec"), img=data.get("img"))
        existing = Favorite(product_code=payload.code, created_at=now_kst())
        db.add(existing)
        db.commit()
        db.refresh(existing)

    return FavoriteItem(
        code=payload.code,
        title=data.get("title"),
        price=price,
        price_formatted=format_won(price) if price is not None else None,
        created_at=existing.created_at,
    )


@app.get("/favorites", response_model=list[FavoriteItem])
def list_favorites(db: Session = Depends(get_db)):
    """
    GET /favorites → 즐겨찾기 목록, 상품별 실시간 최저가 포함 (2026-08-04 신규)

    GET /builds와 마찬가지로 조회 시점마다 danawa를 순차 재조회(매너 크롤링
    원칙) — 개인 프로젝트 규모라 캐시 없이 그대로 감. 부품 하나의 연결
    장애가 전체 목록을 죽이지 않도록 항목별로 실패를 삼키고 계속 진행
    (POST /builds·_compute_estimate와 동일한 다중 부품 fallback 관례,
    2026-08-04 결정 — 실가_인수인계.md 참조).
    """
    favorites = db.query(Favorite).order_by(Favorite.created_at.desc()).all()
    results = []

    for fav in favorites:
        try:
            title, price = _fetch_lowest_price(fav.product_code)
        except requests.RequestException:
            title, price = None, None

        results.append(
            FavoriteItem(
                code=fav.product_code,
                title=title,
                price=price,
                price_formatted=format_won(price) if price is not None else None,
                created_at=fav.created_at,
            )
        )

    return results


@app.delete("/favorites/{code}", status_code=204)
def remove_favorite(code: int, db: Session = Depends(get_db)):
    """DELETE /favorites/{code} → 즐겨찾기 제거 (2026-08-04 신규)"""
    favorite = db.query(Favorite).filter(Favorite.product_code == code).first()
    if favorite is None:
        raise HTTPException(status_code=404, detail="즐겨찾기에 없는 상품")

    db.delete(favorite)
    db.commit()


@app.get("/health")
def health():
    return {"status": "ok"}
