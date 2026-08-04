"""
favorites — 즐겨찾기(관심 상품) 북마크 (id PK, product_code FK, created_at)

가격은 저장하지 않음(products/builds와 동일한 원칙) — 목록 조회 시 항상
danawa에서 새로 가져옴. product_code에 유니크 제약을 걸어 같은 상품을
두 번 즐겨찾기하지 못하게 함(중복 시 애플리케이션에서 idempotent 처리).
"""

from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.timezone_utils import now_kst, KSTDateTime


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("product_code", name="uq_favorites_product_code"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_code = Column(Integer, ForeignKey("products.code"), nullable=False)
    created_at = Column(KSTDateTime, default=now_kst, nullable=False)

    product = relationship("Product")
