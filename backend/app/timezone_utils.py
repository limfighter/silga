"""
서버 시간대 KST 통일 (실가_REFERENCE.md #프로젝트-개요 참조 — 다나와 자체가 KST
기준 서비스라 GTHV 프로젝트의 UTC 통일 규칙과 다름, 주의).

타임존 미표기(naive) datetime 값 저장 금지 원칙 — 모든 DB 컬럼은
DateTime(timezone=True) + 아래 now_kst()로 생성한 aware datetime만 사용.
"""

from datetime import datetime, timezone, timedelta

from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    return datetime.now(KST)


class KSTDateTime(TypeDecorator):
    """
    SQLite용 타임존 인지 datetime 컬럼.

    SQLAlchemy의 DateTime(timezone=True)는 SQLite 다이얼렉트에서 사실상 no-op —
    오프셋 없이 저장되고, 읽어올 때도 tzinfo가 복원되지 않음(naive datetime으로
    돌아옴). REFERENCE.md 체크리스트의 "타임존 미표기 값 저장 금지" 원칙과
    충돌하므로, 오프셋을 포함한 ISO 8601 문자열로 직접 저장/복원한다.
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError(
                "타임존 미표기(naive) datetime은 저장할 수 없음 — now_kst() 등으로 "
                "aware datetime을 생성해서 넘길 것"
            )
        return value.isoformat()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return datetime.fromisoformat(value)
