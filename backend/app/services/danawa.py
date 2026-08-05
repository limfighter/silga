"""
danawa.py — 실가 프로젝트 데이터소스 모듈

출처:
  - get_product, get_product_codes: MineEric64/danawa-py(Apache-2.0) 원본을
    실가 프로젝트용으로 패치한 버전. 패치 근거는 실가_HISTORY.md 2026-08-03 v1 참조.
  - get_price_variance: MineEric64/danawa-py 원본 그대로 (패치 불필요 확인됨,
    실가_HISTORY.md 2026-08-03 v1 참조). GitHub main 브랜치 기준 코드 이식.
  - _get_header: 원본 공통 헤더 헬퍼, 변경 없음.

주의:
  - PyPI 미등록 패키지라 vendoring(파일 직접 복사) 방식으로 편입함.
  - 판정/합계 계산(estimate, compare)에는 반드시 lowest_price 단일 필드만
    사용할 것 — prices 리스트로 직접 min() 계산 금지
    (실가_REFERENCE.md #엔드포인트-설계 설계 원칙 참조).
"""

import html
import re
import requests
from bs4 import BeautifulSoup


def _get_header(host: str, referer: str = None):
    header = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0",
        "Host": host
    }
    if referer is not None:
        header["Referer"] = referer
    return header


def get_product_codes(keyword: str, category_label: str = None) -> list:
    """
    검색어로 상품 코드 목록을 조회한다.

    PATCHED (원본 대비 변경점):
      - 검색어를 quote()로 URL 인코딩 (원본은 인코딩 없이 그대로 format() 해서
        한글 키워드 검색 시 항상 0건 반환하는 문제가 있었음)
      - li 태그 클래스 매칭을 "prod_item 포함 여부"로 완화 (원본은
        "prod_item width_change" 고정 셀렉터라 GPU 카테고리만 우연히 매칭되고
        CPU/RAM/SSD 등은 전부 0건 반환하는 문제가 있었음)
      - category_label 인자 신규 추가(2026-08-05): 검색어가 다른 카테고리
        상품과 겹칠 때(예: 그래픽카드 이름이 마우스/키보드 상품 설명에도 걸리는
        경우) 결과를 좁히는 용도. 다나와 요청 URL에 새 파라미터를 추측해서
        붙이는 대신, 각 상품 li에 이미 박혀 있는
        input#productItem_categoryInfo_{code}의 value(예: "PC 주요 부품_그래픽카드")
        마지막 "_" 뒤 조각으로 사후 필터링 — 이 필드는 40개 상품 전체에서
        존재/일관성 확인됨(GPU 실측). 참고로 같은 li 안의
        hidden_cate_sub_c1/c2/c3는 첫 번째 상품에서만 발견돼 상품별 필드가
        아닌 것으로 보여 사용하지 않음 (실가_HISTORY.md 2026-08-05 참조).
        None이면 기존과 동일하게 전체 반환
    """
    from urllib.parse import quote
    response = requests.get("https://search.danawa.com/dsearch.php?query={}&tab=main".format(quote(keyword)),
                            headers=_get_header(host="search.danawa.com"))
    if response.status_code != 200:
        response.raise_for_status()

    bs = BeautifulSoup(response.text, "html.parser")
    prodlist = bs.find("div", {"class": "main_prodlist main_prodlist_list"})
    product_list = (prodlist or None) and prodlist.select_one("ul.product_list")
    # PATCHED: width_change 클래스가 카테고리별로 없는 경우가 있어 prod_item만으로 매칭
    products = (product_list or None) and product_list.find_all(
        "li", class_=lambda c: c and "prod_item" in c
    )

    if not products:
        return []

    product_codes = []
    for product in products:
        code1 = product.get("id")
        code2 = (code1 or None) and code1.replace("productItem", "")
        if code2 is None or not code2.isdigit():
            continue
        code3 = int(code2)

        if category_label is not None:
            cate_input = product.find(
                "input", {"id": lambda x: x and x.startswith("productItem_categoryInfo_")}
            )
            cate_value = (cate_input or None) and cate_input.get("value")
            if cate_value is None or cate_value.rsplit("_", 1)[-1] != category_label:
                continue

        price1 = product.find_next("input", {"id": "min_price_{}".format(code3)})
        price2 = (price1 or None) and price1.get("value")

        title = product.select_one("div.prod_main_info > div.prod_info > p.prod_name > a")

        prod = {"code": code3}
        if price2 is not None:
            prod["price"] = int(price2)
        if title is not None:
            prod["title"] = title.text.strip()

        product_codes.append(prod)

    return product_codes


def get_product(product_code: int) -> dict:
    """
    상품 코드로 상세 정보(제목/스펙/이미지/최저가/판매처별 가격/유형별 비교)를 조회한다.

    PATCHED (원본 대비 변경점):
      - 최저가/판매처 리스트 파싱 구조를 lowest_area(원본, 구 구조) →
        price-summary(신 구조)로 전면 교체. 다나와 측 상품 상세 페이지 개편으로
        원본 셀렉터가 더 이상 아무것도 못 찾아 항상 빈 값을 반환하는 문제가 있었음
      - 최저가는 렌더링 텍스트 대신 input#min_price_{code} hidden value 사용
        (파싱 리스크가 더 낮음)
      - 판매처명은 로고 이미지형(대형몰)/텍스트형(소형몰) 두 케이스 모두 대응
      - variants(정품/벌크/해외구매 등 유형별 최저가 비교) 필드 신규 추가
        — 원본에는 없던 필드. 참고 정보 전용이며 estimate/compare 계산에는
        절대 미반영 (실가_REFERENCE.md #엔드포인트-설계 참조)
    """
    response = requests.get("https://prod.danawa.com/info/?pcode={}".format(product_code),
                            headers=_get_header(host="prod.danawa.com"))
    if response.status_code != 200:
        response.raise_for_status()

    bs = BeautifulSoup(response.text, "html.parser")
    summary_info = bs.select_one("div.summary_info")
    top_summary = (summary_info or None) and summary_info.select_one("div.top_summary")
    detail_summary = (summary_info or None) and summary_info.select_one("div.detail_summary")

    summary = {}

    # 카테고리 브레드크럼: div.location_wrap의 중첩 loca_item 구조를 직접
    # 파싱하는 대신, 페이지 하단 인라인 <script>의 oGlobalSetting.sUICategoryName
    # 값을 사용 — 이미 "컴퓨터/노트북/조립PC &gt; 주요부품 &gt; 그래픽카드(GPU)"
    # 형태로 정리돼 있는 단일 문자열이라 더 안정적 (2026-08-04 실측 확인,
    # GPU/CPU 두 카테고리 페이지에서 동일 패턴 확인)
    category_match = re.search(r'sUICategoryName:\s*"([^"]*)"', response.text)
    if category_match:
        summary["category"] = html.unescape(category_match.group(1))

    # 현금가(현금최저가): "카드가/현금가 비교"가 아니라 쇼핑몰별 최저가 목록 중
    # 현금결제 전용(badge__cash)으로 표시된 몰의 최저가 — og:description
    # 메타태그에 다나와가 이미 계산해 넣어주는 값을 사용. 우리가 스크래핑하는
    # 쇼핑몰별 가격 목록(prices, 상위 약 10건만 잘림)에서 badge__cash 항목을
    # 직접 찾아 최솟값을 구하면 절단 구간 밖의 진짜 최저 현금가를 놓칠 수
    # 있어서, 다나와가 전체 목록 기준으로 계산해준 값을 그대로 신뢰함
    # (2026-08-04 실측 확인, CPU 카테고리 페이지에서 존재 확인 — GPU 페이지는
    # 해당 상품이 일시 품절이라 아예 없었음. 값이 없는 상품은 필드 자체 생략)
    cash_price_match = re.search(r'현금최저가:\s*([\d,]+)원', response.text)
    if cash_price_match:
        summary["cash_price"] = int(cash_price_match.group(1).replace(",", ""))

    if top_summary is not None:
        title = top_summary.select_one("div.top_summary > h3.prod_tit > span.title")
        spec = top_summary.select_one(
            "div.h_area > div.sub_dsc > div.spec_set_wrap > dl.spec_set > dd > div.spec_list > div.items")
        if title is not None:
            summary["title"] = title.text
        if spec is not None:
            summary["spec"] = spec.text

    if detail_summary is not None:
        image_link1 = detail_summary.select_one("div.summary_left > div.thumb_area > div.photo_w")
        image_link2 = (image_link1 or None) and image_link1.find("a", {"id": "imgExtensionAnchorLayer"})
        image_link3 = (image_link2 or None) and image_link2.select_one("img")
        if image_link3 is not None:
            summary["img"] = image_link3.get("src")

        # --- PATCHED: 신 구조 (price-summary) 대응 ---
        price_summary = detail_summary.select_one("div.summary_left > div.price-summary")

        if price_summary is not None:
            # 일시 품절 등으로 가격 정보 자체가 없는 경우 구분
            # (스크래핑 실패와 다른 케이스 — 다나와 자체에 판매처가 없는 상태)
            price_classes = price_summary.get("class") or []
            summary["in_stock"] = "lowest_blank" not in price_classes

            # 최저가: hidden input이 가장 안정적 (렌더링 텍스트보다 파싱 리스크 낮음)
            min_price_input = price_summary.find("input", id=lambda x: x and x.startswith("min_price_"))
            if min_price_input is not None:
                summary["lowest_price"] = min_price_input.get("value")

            # 판매처별 가격 리스트 (쇼핑몰명 + 가격 + 최저가 여부)
            mall_items = price_summary.select("ul.list__mall-price > li.list-item")
            prices = []
            for item in mall_items:
                price_el = item.select_one("div.box__price span.text__num")
                if price_el is None:
                    continue

                # 쇼핑몰명: 로고 이미지형(대형몰) / 텍스트형(소형몰) 둘 다 대응
                logo_img = item.select_one("div.box__logo img")
                logo_text = item.select_one("div.box__logo span.text__logo")
                if logo_img is not None:
                    mall_name = logo_img.get("alt")
                elif logo_text is not None:
                    mall_name = logo_text.get("aria-label") or logo_text.text.strip()
                else:
                    mall_name = None

                is_lowest = item.select_one("div.box__price.lowest") is not None

                prices.append({
                    "mall": mall_name,
                    "price": price_el.text.strip(),
                    "is_lowest": is_lowest
                })

            if prices:
                summary["prices"] = prices

    # --- 유형별(정품/벌크/해외구매 등) 최저가 비교 — summary_info 밖의 별도 섹션 ---
    variant_section = bs.select_one("section.variant-selector")
    if variant_section is not None:
        variants = []
        for li in variant_section.select("ul.list__variant-selector > li.list-item"):
            spec_div = li.select_one("div.text__spec")
            # div.text__spec 안에 용어사전 링크(<a>)가 섞여 있어 첫 텍스트 노드만 사용
            spec_text = spec_div.contents[0].strip() if spec_div and spec_div.contents else None

            price_el = li.select_one("span.text__num")
            mall_count_el = li.select_one("div.text__count-mall")
            link_el = li.select_one("a.link__full")

            pcode = None
            if link_el is not None:
                href = link_el.get("href") or ""
                match = re.search(r"pcode=(\d+)", href)
                if match:
                    pcode = int(match.group(1))

            variants.append({
                "type": spec_text,
                "price": price_el.get_text(strip=True) if price_el is not None else None,
                "mall_count": mall_count_el.get_text(strip=True) if mall_count_el is not None else None,
                "pcode": pcode,
                "is_current": "is-active" in (li.get("class") or [])
            })

        if variants:
            summary["variants"] = variants

    return summary


def get_price_variance(product_code: int, by_month: int = 1) -> dict:
    """
    상품 코드로 기간별(1/3/6/12개월) 가격 추이를 조회한다.

    원본(MineEric64/danawa-py) 그대로 사용 — 2026-08-03 실동작 검증 결과 이
    함수만 다나와 측 구조 변경 영향 없이 정상 동작함을 확인함
    (실가_HISTORY.md 2026-08-03 v1 참조). 패치 없음.

    /product/{code}/history 엔드포인트, 홈 탭 "동향" 섹션, 통계 탭에서 사용.
    price_history 테이블을 따로 두지 않고 이 함수를 그때그때 호출하는 방식으로
    대체하기로 확정됨 (실가_REFERENCE.md #DB-스키마 참조).
    """
    if by_month not in (1, 3, 6, 12):
        raise AttributeError("by_month value must be 1, 3, 6 or 12.")

    response = requests.get(
        "https://prod.danawa.com/info/ajax/getProductPriceList.ajax.php?productCode={}&period=1".format(product_code),
        headers=_get_header(host="prod.danawa.com", referer="danawa.com"))
    if response.status_code != 200:
        response.raise_for_status()

    json_data = response.json()
    period_data = json_data.get(str(by_month))

    if period_data is None:
        raise TypeError("json is None")

    variance = {
        "min": period_data["minPrice"],
        "max": period_data["maxPrice"],
        "prices": []
    }

    for data in period_data["result"]:
        price_data = {"price": data["minPrice"], "date": data["date"]}
        if "Fulldate" in data:
            price_data["full_date"] = data["Fulldate"]
        variance["prices"].append(price_data)

    return variance
