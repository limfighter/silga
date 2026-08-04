from pydantic import BaseModel
from typing import Optional, List


class VerdictBasisItem(BaseModel):
    """판정 기준가 계산에 부품별로 이동평균/즉시가 중 뭘 썼는지 (2026-08-04 결정)"""
    code: int
    price: Optional[int] = None
    source: str  # "ma" | "current_fallback"


class ProductCompareResponse(BaseModel):
    title: Optional[str] = None
    lowest_price: int
    estimate_total: int  # 즉시가 — 단일 상품 기준이라 lowest_price와 동일값
    verdict_basis_price: Optional[int] = None       # 판정에 실제 쓰인 이동평균/fallback 기준가
    verdict_basis_price_formatted: Optional[str] = None
    verdict_confidence: Optional[str] = None        # "high"(이동평균 정상) | "low"(즉시가 fallback 섞임)
    verdict_basis_breakdown: List[VerdictBasisItem] = []
    ma_window: int                                  # 실제 적용된 이동평균 기간(7/14/30)
    market_price: int
    verdict: Optional[str] = None
    diff_percent: Optional[float] = None
