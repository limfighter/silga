def format_won(price) -> str:
    """
    원 단위 가격을 "만원" 표기 문자열로 변환 (예: 558000 -> "55.8만원").
    price가 None이거나 숫자로 변환 불가하면 None 반환.
    """
    if price is None:
        return None
    try:
        value = int(price)
    except (TypeError, ValueError):
        return None
    return "{:.1f}만원".format(value / 10000)
