from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class FavoriteCreateRequest(BaseModel):
    code: int


class FavoriteItem(BaseModel):
    code: int
    title: Optional[str] = None
    price: Optional[int] = None  # lowest_price 조회 실패/데이터 없음 시 None
    price_formatted: Optional[str] = None
    created_at: datetime
