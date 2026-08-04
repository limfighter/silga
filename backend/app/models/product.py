"""
products — 부품 기본정보 캐시 (code PK, title, category, spec, img, cached_at)

재조회 최소화용 캐시일 뿐, 실시간 가격은 여기 저장하지 않고 항상 danawa
재조회로 처리 (실가_REFERENCE.md #DB-스키마 참조). 즉 lowest_price/prices 같은
가격 필드는 이 테이블에 의도적으로 없음.
"""

from sqlalchemy import Column, Integer, String, Text

from app.database import Base
from app.timezone_utils import now_kst, KSTDateTime


class Product(Base):
    __tablename__ = "products"

    code = Column(Integer, primary_key=True)  # 다나와 상품 코드 그대로 사용
    title = Column(String, nullable=True)
    category = Column(String, nullable=True)  # 카테고리 브레드크럼, 2026-08-04부터 실제 값 채워짐
    spec = Column(Text, nullable=True)
    img = Column(String, nullable=True)
    cached_at = Column(KSTDateTime, default=now_kst, nullable=False)
