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

    # TODO(미구현): get_product() 스크래퍼가 아직 카테고리 정보를 파싱하지 않음.
    # 다나와 상품 상세 페이지의 브레드크럼(예: div.blur_link 또는 유사 경로)에서
    # 추가 파싱 필요. 인수인계.md "수정 예정 사항"에 등재 예정.
    category: Optional[str] = None

    current_price: Optional[int] = None      # get_product()의 lowest_price를 매핑

    # TODO(미구현): 현금가(무이자 할부 제외 실결제가) 별도 필드가 다나와 페이지
    # 어디서 오는지 아직 확인 안 됨. get_product()에 파싱 로직 추가 필요.
    cash_price: Optional[int] = None

    spec: Optional[str] = None
    variants: List[ProductVariant] = []

    # REFERENCE.md 원 계약에는 없던 추가 필드 — "일시 품절"과 "스크래핑 실패"를
    # 구분하기 위해 추가함 (2026-08-03 실동작 중 발견, PALIT 5070Ti 76465883
    # 실측 사례: history는 있는데 현재가는 없음 → 품절 확인됨)
    in_stock: Optional[bool] = None
