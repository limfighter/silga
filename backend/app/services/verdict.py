"""
판정(verdict) 계산 로직.

임계값(±5%)은 실가_REFERENCE.md에 명시된 수치가 없어 임의로 잡은 가정값.
실사용하면서 판정 게이지 체감과 안 맞으면 VERDICT_THRESHOLD_PERCENT만 조정하면 됨.

공식 검증: silga-mockup.html API 터미널 예시(estimate_total=3390000,
market_price=3464000 → diff_percent=2.1)로 역산해보면
(3464000-3390000)/3390000*100 ≈ 2.18%로 근사 일치 — 이 공식이 맞다는 근거.
"""

VERDICT_THRESHOLD_PERCENT = 5.0


def calc_verdict(estimate_total: int, market_price: int):
    """
    estimate_total(실측 부품 합계) 대비 market_price(판매가)가 얼마나 비싼지 계산.

    diff_percent > 0 → 판매가가 실측 합계보다 비쌈 (고가 쪽)
    diff_percent < 0 → 판매가가 실측 합계보다 쌈 (저가 쪽)
    """
    if not estimate_total:
        raise ValueError("estimate_total은 0이거나 None일 수 없음 (판정 계산 불가)")

    diff_percent = round((market_price - estimate_total) / estimate_total * 100, 1)

    if diff_percent > VERDICT_THRESHOLD_PERCENT:
        verdict = "고가"
    elif diff_percent < -VERDICT_THRESHOLD_PERCENT:
        verdict = "저가"
    else:
        verdict = "적정가"

    return verdict, diff_percent
