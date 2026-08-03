"""
build_items — 빌드-부품 연결 (id PK, build_id FK, category, product_code FK)

category는 app-shell-mockup.html 빌드 생성 화면의 카테고리 목록과 대응:
CPU / GPU / 메인보드 / RAM / SSD / 케이스 / 파워 / 쿨러
(DB 레벨 enum 강제는 하지 않음 — 개인 프로젝트 규모라 애플리케이션 레벨 검증으로 충분)
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class BuildItem(Base):
    __tablename__ = "build_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    build_id = Column(Integer, ForeignKey("builds.id"), nullable=False)
    category = Column(String, nullable=False)
    product_code = Column(Integer, ForeignKey("products.code"), nullable=False)

    build = relationship("Build", back_populates="items")
    product = relationship("Product")
