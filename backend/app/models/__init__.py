"""
모델 패키지 — Base.metadata.create_all() 호출 시 4개 테이블 전부 등록되도록
여기서 한 번에 임포트.
"""

from app.models.product import Product
from app.models.build import Build
from app.models.build_item import BuildItem
from app.models.favorite import Favorite

__all__ = ["Product", "Build", "BuildItem", "Favorite"]
