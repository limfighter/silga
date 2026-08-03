"""
PPE backend — FastAPI 스켈레톤

구현된 엔드포인트: /search, /product/{code}, /product/{code}/history,
/estimate, /product/{code}/compare(단일 상품 기준), /build/compare(빌드 전체
기준, REFERENCE.md 원문에는 없던 신규 엔드포인트 — /compare의 단일상품 vs
빌드전체 스펙 불일치를 해결하기 위해 추가함. REFERENCE.md #엔드포인트-설계
갱신 필요, 계약 변경이라 버전 v0.2 표기 대상).
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import requests

from app.services import danawa
from app.services.verdict import calc_verdict
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
from app.schemas.compare import ProductCompareResponse
from app.utils import format_won
from app.database import Base, engine
import app.models  # noqa: F401 — Base.metadata에 3개 테이블 등록시키기 위한 임포트

app = FastAPI(title="PPE backend", version="0.1.0")


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

    주의 (미구현 필드):
      - category: 스크래퍼가 아직 파싱하지 않음 → 항상 None
      - cash_price: 스크래퍼가 아직 파싱하지 않음 → 항상 None
      (app/schemas/product.py TODO 주석 참조)
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
        category=None,   # TODO: 미구현
        current_price=current_price,
        cash_price=None,  # TODO: 미구현
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
    """
    breakdown = []
    total_price = 0

    for item in items:
        title, price = _fetch_lowest_price(item.code)
        breakdown.append(
            BreakdownItem(category=item.category, title=title, price=price)
        )
        if price is not None:
            total_price += price

    return total_price, breakdown


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
def compare_single_product(code: int, market_price: int = Query(...)):
    """
    GET /product/{code}/compare?market_price={n}
        → {title, lowest_price, estimate_total, market_price, verdict, diff_percent}

    단일 상품 기준 — estimate_total은 그 상품 하나의 lowest_price와 동일값.
    """
    title, lowest_price = _fetch_lowest_price(code)
    if lowest_price is None:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없거나 최저가 정보 없음")

    verdict, diff_percent = calc_verdict(lowest_price, market_price)

    return ProductCompareResponse(
        title=title,
        lowest_price=lowest_price,
        estimate_total=lowest_price,
        market_price=market_price,
        verdict=verdict,
        diff_percent=diff_percent,
    )


@app.post("/build/compare", response_model=BuildCompareResponse)
def compare_build(payload: BuildCompareRequest):
    """
    POST /build/compare  body: {items: [{code, category}, ...], market_price}
                         → {total_price, total_price_formatted, breakdown,
                            market_price, verdict, diff_percent}

    REFERENCE.md 원문에는 없던 신규 엔드포인트. app-shell-mockup.html의
    "빌드 상세 → 판정 게이지"가 실제로 필요로 하는 건 빌드 전체 합계 대
    판매가 비교라, 문서상 단일상품용이던 /product/{code}/compare와는 별도로
    빌드 전체용을 추가함 (사용자 확인 완료).
    """
    total_price, breakdown = _compute_estimate(payload.items)

    if total_price == 0:
        raise HTTPException(status_code=404, detail="부품 가격을 하나도 찾지 못해 판정 불가")

    verdict, diff_percent = calc_verdict(total_price, payload.market_price)

    return BuildCompareResponse(
        total_price=total_price,
        total_price_formatted=format_won(total_price),
        breakdown=breakdown,
        market_price=payload.market_price,
        verdict=verdict,
        diff_percent=diff_percent,
    )


@app.get("/health")
def health():
    return {"status": "ok"}
