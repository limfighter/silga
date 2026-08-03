from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


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
    total_price: Optional[int] = None
    total_price_formatted: Optional[str] = None
    verdict: Optional[str] = None  # market_price 없으면 판정 불가 -> None


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
    total_price: int
    total_price_formatted: str
    verdict: Optional[str] = None
    diff_percent: Optional[float] = None
