from pydantic import BaseModel
from typing import Optional, List


class PricePoint(BaseModel):
    date: str
    price: str  # danawa.get_price_variance 원본이 문자열로 반환 (예: '498440')
    full_date: Optional[str] = None


class PriceHistory(BaseModel):
    min: str
    max: str
    prices: List[PricePoint]
