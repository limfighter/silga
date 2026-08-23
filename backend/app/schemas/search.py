from pydantic import BaseModel
from typing import Optional


class SearchResultItem(BaseModel):
    code: int
    title: Optional[str] = None
    price: Optional[int] = None          # raw 필드 (AI/계산용)
    price_formatted: Optional[str] = None  # 사람이 읽는 필드 (예: "55.8만원")
    img: Optional[str] = None            # 썸네일 URL, 없으면 None(플레이스홀더 이미지 등 제외됨)
    # 다나와 상품 li에 박혀 있는 카테고리 조각(예: "CPU", "데스크탑").
    # category 필터를 안 걸었을 때 결과가 부품 단품인지 완제품 PC인지
    # 화면에서 구분하는 용도 — 예: "9800X3D" 무필터 검색은 40건 중 39건이
    # 완제품 PC임(v0.17 추가)
    category: Optional[str] = None
