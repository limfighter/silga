from pydantic import BaseModel
from typing import Optional, List


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


class BuildCompareResponse(BaseModel):
    total_price: int
    total_price_formatted: str
    breakdown: List[BreakdownItem]
    market_price: int
    verdict: str
    diff_percent: float
