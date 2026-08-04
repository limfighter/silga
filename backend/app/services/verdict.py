"""
판정(verdict) 계산 로직.

임계값(±5%)은 실가_REFERENCE.md에 명시된 수치가 없어 임의로 잡은 가정값.
실사용하면서 판정 게이지 체감과 안 맞으면 VERDICT_THRESHOLD_PERCENT만 조정하면 됨.

공식 검증: silga-mockup.html API 터미널 예시(estimate_total=3390000,
market_price=3464000 → diff_percent=2.1)로 역산해보면
(3464000-3390000)/3390000*100 ≈ 2.18%로 근사 일치 — 이 공식이 맞다는 근거.
"""

from datetime import datetime, timedelta

VERDICT_THRESHOLD_PERCENT = 5.0

# 판정 기준가 계산에 쓰는 이동평균 기간(일) 선택지 — main.py의 ma_window
# 쿼리파라미터/요청필드가 이 값들만 허용함 (2026-08-04 결정, 실가_인수인계.md 참조)
MA_WINDOW_CHOICES = (7, 14, 30)


def calc_verdict(basis_price: int, market_price: int):
    """
    basis_price(판정 기준가) 대비 market_price(판매가)가 얼마나 비싼지 계산.
    basis_price는 즉시가(estimate_total) 또는 이동평균 기준가
    (verdict_basis_price) 둘 다 받을 수 있는 범용 함수 — 어떤 걸 넘길지는
    호출부(main.py) 책임.

    diff_percent > 0 → 판매가가 기준가보다 비쌈 (고가 쪽)
    diff_percent < 0 → 판매가가 기준가보다 쌈 (저가 쪽)
    """
    if not basis_price:
        raise ValueError("basis_price는 0이거나 None일 수 없음 (판정 계산 불가)")

    diff_percent = round((market_price - basis_price) / basis_price * 100, 1)

    if diff_percent > VERDICT_THRESHOLD_PERCENT:
        verdict = "고가"
    elif diff_percent < -VERDICT_THRESHOLD_PERCENT:
        verdict = "저가"
    else:
        verdict = "적정가"

    return verdict, diff_percent


def compute_ma_price(prices: list, window: int):
    """
    부품 하나의 가격 시계열(danawa.get_price_variance()['prices'] 형식 —
    [{"date", "price", "full_date"}, ...])에서 최근 window일 이동평균을 계산.

    실측 확인(2026-08-04, 로컬 환경 라이브 검증): 다나와는 daily가 아니라
    **주 단위**로 데이터를 준다 (1개월치 조회해도 포인트가 4개 안팎). 그래서
    최초 설계였던 "정확히 window개 항목이 있어야 유효"는 폐기함 — window=7을
    골라도 원본이 4개뿐이라 항상 무효(None) 처리되는 문제가 실측으로 확인됨.
    대신 "엄격" 원칙을 날짜 기준으로 재정의: 최근 window일 이내 날짜의
    데이터를 모아 평균 내되, **히스토리 자체가 window일 전체를 커버하는
    경우에만** 유효로 침(가장 오래된 데이터가 cutoff 이전부터 있어야 함) —
    신상품이라 히스토리가 window일보다 짧으면 무효(None), 호출부(main.py)가
    즉시가로 fallback 처리함.

    full_date 포맷은 "YY-MM-DD"(예: "26-05-12")로 실측 확인됨 — datetime으로
    명시 파싱해서 정렬/구간 계산한다(리스트 원본 순서는 신뢰하지 않음).
    """
    if not prices or not all(p.get("full_date") for p in prices):
        return None

    try:
        parsed = sorted(
            ((datetime.strptime(p["full_date"], "%y-%m-%d"), p["price"]) for p in prices),
            key=lambda pair: pair[0],
        )
    except ValueError:
        return None

    earliest_date = parsed[0][0]
    latest_date = parsed[-1][0]
    cutoff = latest_date - timedelta(days=window)

    if earliest_date > cutoff:
        return None  # 히스토리 자체가 window일보다 짧음 -> 무효

    in_window = [price for date, price in parsed if date >= cutoff]
    if not in_window:
        return None

    try:
        values = [int(price) for price in in_window]
    except (TypeError, ValueError):
        return None

    return round(sum(values) / len(values))
