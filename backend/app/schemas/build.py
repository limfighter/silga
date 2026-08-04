from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

from app.schemas.compare import VerdictBasisItem


class BuildItemCreate(BaseModel):
    category: str
    code: int


class BuildCreateRequest(BaseModel):
    name: str
    market_price: Optional[int] = None
    items: List[BuildItemCreate]


class BuildSummary(BaseModel):
    id: int
    name: str
    market_price: Optional[int] = None
    created_at: datetime
    item_count: int
    total_price: Optional[int] = None  # 즉시가 — 의미 안 바뀜
    total_price_formatted: Optional[str] = None
    verdict: Optional[str] = None  # market_price 없으면 판정 불가 -> None
    verdict_confidence: Optional[str] = None  # "high" | "low", verdict 없으면 None
    ma_window: Optional[int] = None  # 실제 적용된 이동평균 기간, verdict 없으면 None


class BuildItemDetail(BaseModel):
    category: str
    code: int
    title: Optional[str] = None
    price: Optional[int] = None


class BuildDetail(BaseModel):
    id: int
    name: str
    market_price: Optional[int] = None
    created_at: datetime
    items: List[BuildItemDetail]
    total_price: int              # 즉시가 — 의미 안 바뀜
    total_price_formatted: str
    verdict_basis_price: Optional[int] = None       # 판정에 실제 쓰인 이동평균/fallback 기준가
    verdict_basis_price_formatted: Optional[str] = None
    verdict_confidence: Optional[str] = None        # "high" | "low"
    verdict_basis_breakdown: List[VerdictBasisItem] = []
    ma_window: Optional[int] = None
    verdict: Optional[str] = None
    diff_percent: Optional[float] = None
