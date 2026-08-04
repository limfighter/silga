"""
판정(verdict) 계산 로직.

임계값(±5%)은 실가_REFERENCE.md에 명시된 수치가 없어 임의로 잡은 가정값.
실사용하면서 판정 게이지 체감과 안 맞으면 VERDICT_THRESHOLD_PERCENT만 조정하면 됨.

공식 검증: silga-mockup.html API 터미널 예시(estimate_total=3390000,
market_price=3464000 → diff_percent=2.1)로 역산해보면
(3464000-3390000)/3390000*100 ≈ 2.18%로 근사 일치 — 이 공식이 맞다는 근거.
"""

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
    부품 하나의 daily 가격 시계열(danawa.get_price_variance()['prices'] 형식 —
    [{"date", "price", "full_date"?}, ...])에서 최근 window일 이동평균을 계산.

    "엄격" 원칙 (2026-08-04 결정, 실가_인수인계.md 참조): 선택한 기간(window)만큼
    daily 데이터가 정확히 다 있어야 유효. 데이터가 window개 미만이면 무효(None) —
    호출부(main.py)가 즉시가로 fallback 처리함.

    정렬 관련 주의: 다나와 API가 반환하는 리스트의 실제 정렬 순서(오름차순/
    내림차순)를 이 프로젝트 개발 환경에서 라이브로 검증하지 못했음(네트워크
    정책상 danawa.com 접근 차단, 실가_인수인계.md 참조) — 그래서 리스트
    자체의 순서는 신뢰하지 않고 매번 full_date로 명시 정렬한다. full_date가
    없는 항목이 하나라도 있으면 정렬을 신뢰할 수 없다고 보고 무효(None) 처리 —
    순서를 잘못 추정해서 오래된 데이터를 "최근"으로 잘못 평균 내는 것보다
    안전한 쪽(무효 처리 후 즉시가 fallback)을 택함. 로컬 환경에서 실제 응답의
    full_date 포맷(예: "20260801")을 반드시 한 번 확인할 것.
    """
    if len(prices) < window:
        return None

    if not all(p.get("full_date") for p in prices):
        return None

    recent = sorted(prices, key=lambda p: p["full_date"])[-window:]

    try:
        values = [int(p["price"]) for p in recent]
    except (TypeError, ValueError):
        return None

    return round(sum(values) / len(values))
