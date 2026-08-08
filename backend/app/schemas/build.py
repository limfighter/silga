from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

from app.schemas.compare import VerdictBasisItem


class BuildItemCreate(BaseModel):
    category: str
    code: int


class BuildCreateRequest(BaseModel):
    name: str
    # 완제품/견적 판매가를 알 때만 채우는 선택 입력 — 없어도 판정은 항상 나옴
    # (즉시가를 이동평균 기준가와 비교, 2026-08-08 결정, 실가_인수인계.md 참조)
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
    # market_price 입력 시 그 값과, 없으면 즉시가(total_price)와 이동평균
    # 기준가를 비교해서 항상 계산됨 — total_price 자체가 없을 때만 None
    verdict: Optional[str] = None
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
    # market_price 입력 시 그 값과, 없으면 즉시가(total_price)와 verdict_basis_price를
    # 비교해서 항상 계산됨(2026-08-08 결정) — market_price가 null이어도
    # diff_percent는 그 자체로 유효한 값
    verdict: Optional[str] = None
    diff_percent: Optional[float] = None
