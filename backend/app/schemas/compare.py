from pydantic import BaseModel
from typing import Optional


class ProductCompareResponse(BaseModel):
    title: Optional[str] = None
    lowest_price: int
    estimate_total: int  # 단일 상품 기준이라 lowest_price와 동일값
    market_price: int
    verdict: str
    diff_percent: float
