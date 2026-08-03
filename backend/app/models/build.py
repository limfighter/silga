"""
builds — 저장한 조립샷 (id PK, name, market_price, created_at)

market_price는 "비교할 판매가" (선택 입력, app-shell-mockup.html 빌드 생성 화면
"비교할 판매가 (선택)" 필드에 대응) — 실측 합계와 비교해서 /compare 판정에 사용.
"""

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base
from app.timezone_utils import now_kst, KSTDateTime


class Build(Base):
    __tablename__ = "builds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    market_price = Column(Integer, nullable=True)  # 선택 입력이라 nullable
    created_at = Column(KSTDateTime, default=now_kst, nullable=False)

    items = relationship("BuildItem", back_populates="build", cascade="all, delete-orphan")
