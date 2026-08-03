"""
DB 엔진/세션 설정.

- SQLite(WAL 모드) 확정 (실가_REFERENCE.md #기술-스택 참조)
  → 개인용 트래픽 규모에 충분, 서버 운영 부담 없음. 규모 커지면 Postgres 이전 검토.
- DB는 "구조 저장용"으로만 사용 (빌드 구성 자체를 기억하는 용도).
  가격 데이터는 절대 자체 축적하지 않고 danawa.get_price_variance()를 그때그때
  호출해서 계산 (실가_REFERENCE.md #DB-스키마 "price_history를 안 만들기로 한 이유" 참조)
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./ppe.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # FastAPI가 여러 스레드에서 세션 사용 가능하도록
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """WAL 모드 활성화 (동시 읽기/쓰기 성능, 개인용 규모에 충분)"""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI Depends()용 세션 제너레이터"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
