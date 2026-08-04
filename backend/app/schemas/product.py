from pydantic import BaseModel
from typing import Optional, List


class ProductVariant(BaseModel):
    type: Optional[str] = None
    price: Optional[str] = None
    mall_count: Optional[str] = None
    pcode: Optional[int] = None
    is_current: bool = False


class ProductDetail(BaseModel):
    code: int
    title: Optional[str] = None

    # 카테고리 브레드크럼(예: "컴퓨터/노트북/조립PC > 주요부품 > 그래픽카드(GPU)").
    # get_product()가 페이지 인라인 스크립트의 oGlobalSetting.sUICategoryName에서
    # 파싱 (2026-08-04 구현, 실가_HISTORY.md 참조)
    category: Optional[str] = None

    current_price: Optional[int] = None      # get_product()의 lowest_price를 매핑

    # 현금최저가 — "카드가/현금가 비교"가 아니라 쇼핑몰별 최저가 목록 중
    # 현금결제 전용으로 표시된 판매처의 최저가(모든 상품에 있는 건 아님).
    # get_product()가 og:description 메타태그에서 파싱 (2026-08-04 구현,
    # 실가_HISTORY.md 참조)
    cash_price: Optional[int] = None

    spec: Optional[str] = None
    variants: List[ProductVariant] = []

    # REFERENCE.md 원 계약에는 없던 추가 필드 — "일시 품절"과 "스크래핑 실패"를
    # 구분하기 위해 추가함 (2026-08-03 실동작 중 발견, PALIT 5070Ti 76465883
    # 실측 사례: history는 있는데 현재가는 없음 → 품절 확인됨)
    in_stock: Optional[bool] = None
