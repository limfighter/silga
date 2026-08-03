from pydantic import BaseModel
from typing import Optional


class SearchResultItem(BaseModel):
    code: int
    title: Optional[str] = None
    price: Optional[int] = None          # raw 필드 (AI/계산용)
    price_formatted: Optional[str] = None  # 사람이 읽는 필드 (예: "55.8만원")
