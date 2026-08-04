from pydantic import BaseModel
from typing import Literal, Optional, List

from app.schemas.compare import VerdictBasisItem


class EstimateItem(BaseModel):
    code: int
    # REFERENCE.md 원문은 body: [{code}, ...]만 명시하지만, breakdown 응답에
    # category가 필요해서 프론트가 이미 알고 있는 카테고리(빌드 생성 폼의
    # 카테고리별 입력행)를 함께 보내도록 확장함. 안 보내도 동작은 함(None으로 표시).
    category: Optional[str] = None


class BreakdownItem(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    price: Optional[int] = None  # lowest_price 파싱 실패/조회 실패 시 None


class EstimateResponse(BaseModel):
    total_price: int
    total_price_formatted: str
    breakdown: List[BreakdownItem]


class BuildCompareRequest(BaseModel):
    items: List[EstimateItem]
    market_price: int
    ma_window: Literal[7, 14, 30] = 14  # 판정 기준 이동평균 기간(일), 2026-08-04 결정


class BuildCompareResponse(BaseModel):
    total_price: int              # 즉시가 합계 — 의미 안 바뀜
    total_price_formatted: str
    breakdown: List[BreakdownItem]
    verdict_basis_price: Optional[int] = None       # 판정에 실제 쓰인 이동평균/fallback 기준가
    verdict_basis_price_formatted: Optional[str] = None
    verdict_confidence: Optional[str] = None        # "high" | "low"
    verdict_basis_breakdown: List[VerdictBasisItem] = []
    ma_window: int
    market_price: int
    verdict: Optional[str] = None
    diff_percent: Optional[float] = None
