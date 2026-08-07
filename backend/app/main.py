"""
실가 backend — FastAPI 스켈레톤

구현된 엔드포인트: /search, /product/{code}, /product/{code}/history,
/estimate, /product/{code}/compare(단일 상품 기준), /build/compare(빌드 전체
기준, REFERENCE.md 원문에는 없던 신규 엔드포인트 — /compare의 단일상품 vs
빌드전체 스펙 불일치를 해결하기 위해 추가함. REFERENCE.md #엔드포인트-설계
갱신 필요, 계약 변경이라 버전 v0.2 표기 대상).
"""

import time
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import requests

from app.services import danawa
from app.services.verdict import calc_verdict, compute_ma_price, MA_WINDOW_CHOICES
from app.schemas.search import SearchResultItem
from app.schemas.product import ProductDetail, ProductVariant
from app.schemas.history import PriceHistory, PricePoint
from app.schemas.estimate import (
    EstimateItem,
    BreakdownItem,
    EstimateResponse,
    BuildCompareRequest,
    BuildCompareResponse,
)
from app.schemas.compare import ProductCompareResponse, VerdictBasisItem
from app.schemas.build import (
    BuildCreateRequest,
    BuildSummary,
    BuildDetail,
    BuildItemDetail,
)
from app.schemas.favorite import FavoriteCreateRequest, FavoriteItem
from app.utils import format_won
from app.database import Base, engine, get_db
from app.models import Product, Build, BuildItem, Favorite
from app.timezone_utils import now_kst

# /search?category= 값 → danawa.get_product_codes(category_label=...) 매핑.
# 값은 다나와 상품 li의 productItem_categoryInfo_{code} 필드 마지막 조각과
# 정확히 일치해야 함 — 8개 전부 실제 상품 li HTML로 직접 검증 완료
# (실가_HISTORY.md 2026-08-05 참조. CPU는 "9800X3D" 검색 40건 중 완제품 PC
# 39건을 걸러내고 CPU 단품 1건만 남기는 것까지 실측 확인 — 필터가 실제로
# 필요한 이유를 보여주는 사례). CATEGORY_LABELS에 없는 category 값은 필터
# 없이 무시됨(frontend/src/pages/BuildCreatePage.tsx의 CATEGORIES 상수와
# 키 일치해야 함).
CATEGORY_LABELS = {
    "CPU": "CPU",
    "GPU": "그래픽카드",
    "메인보드": "메인보드",
    "RAM": "RAM",
    "SSD": "SSD",
    "케이스": "케이스",
    "파워": "파워",
    "쿨러": "쿨러/튜닝",
}

# /search?q= 생략 시(검색 버튼을 안 눌러도 카테고리 선택만으로 기본 목록을
# 보여주기 위한 용도) 대신 사용할 검색어. CATEGORY_LABELS와 달리 이건 다나와
# 검색창에 실제로 넣는 키워드라 값이 다를 수 있음(예: 쿨러는 label이
# "쿨러/튜닝"이지만 검색어로는 "쿨러"만 넣어야 함) — 8개 전부 실측으로
# category_label 사후 필터까지 거쳐도 40건 안팎이 나오는 것 확인
# (2026-08-07, 실가_HISTORY.md 참조)
CATEGORY_DEFAULT_QUERY = {
    "CPU": "CPU",
    "GPU": "그래픽카드",
    "메인보드": "메인보드",
    "RAM": "RAM",
    "SSD": "SSD",
    "케이스": "케이스",
    "파워": "파워",
    "쿨러": "쿨러",
}

# /search?memory_gb= 값(GPU 전용, category=GPU일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑. "{속성코드}-{값코드}-OR"
# 형식은 다나와 상세검색 필터 체크박스 클릭 시 실측 URL에서 그대로 가져온 값
# (속성코드 663 = GPU 메모리 용량, 실가_HISTORY.md 2026-08-05 참조). 이 필터는
# category_label과 달리 다나와 서버측 요청 자체를 좁히는 필터라 사후 필터링이
# 아님 — 다중 선택(예: 12GB+16GB 동시)은 결합 규칙 미검증이라 미지원, 값 하나만 허용.
# 1GB 미만·1~3GB·5GB(구형 저용량)와 72/80/94/96GB(데이터센터급)는 실측은
# 됐지만 개인 조립 PC 범위 밖이라 제외 — frontend/src/components/PartRow.tsx의
# GPU_MEMORY_OPTIONS와 반드시 키를 맞출 것(2026-08-05 리뷰에서 여기 dict에만
# 1/2/3/5GB가 남아있고 프론트엔 없던 불일치 발견해서 정정함)
GPU_MEMORY_ATTRIBUTES = {
    4: "663-110066-OR",
    6: "663-137546-OR",
    8: "663-188704-OR",
    10: "663-693454-OR",
    11: "663-213321-OR",
    12: "663-213322-OR",
    16: "663-188705-OR",
    20: "663-765568-OR",
    24: "663-306820-OR",
    32: "663-306823-OR",
    48: "663-339463-OR",
}

# /search?socket= 값(CPU 전용, category=CPU일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑. GPU_MEMORY_ATTRIBUTES와
# 동일한 방식(속성코드 41 = 소켓 구분). AMD는 "9800X3D", 인텔은 "i5-14600K"
# 검색으로 각각 실측(실가_HISTORY.md 2026-08-05 참조) — 워크스테이션/서버/구형
# 소켓(sWRX8·sTRX4·TR4·sTR5·SP3·FM2·AM3+·AM3, 2066·4677·4189·3647·2011 계열·
# 1366·1150·1155·1156·775, 1200·1151v2·1151)은 현재 시장에서 신품으로 거의
# 안 팔려서 제외 — 현행 유통 소켓 4개만 채택
CPU_SOCKET_ATTRIBUTES = {
    "AM5": "41-801631-OR",
    "AM4": "41-212331-OR",
    "LGA1851": "41-906295-OR",
    "LGA1700": "41-748240-OR",
}

# /search?chipset= 값(GPU 전용, category=GPU일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑(속성코드 654 = 칩셋
# 제조사). "RTX 5070 Ti" 검색 결과 필터 사이드바에서 실측(실가_HISTORY.md
# 2026-08-05 참조) — FuriosaAI(AI 가속기 칩 제조사, 일반 소비자용
# 그래픽카드 아님)는 제외하고 실제 소비자용 그래픽카드 제조사 3개만 채택.
# memory_gb와 동시 지정 시 다중 attribute 결합 규칙이 미검증이라 둘 다
# 적용하지 않고 chipset을 우선 적용(아래 search() 참조)
GPU_CHIPSET_ATTRIBUTES = {
    "NVIDIA": "654-3518-OR",
    "AMD": "654-3517-OR",
    "Intel": "654-805627-OR",
}

# /search?length= 값(GPU 전용, category=GPU일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑(속성코드 682 = 가로(길이)).
# "그래픽카드"(전체 모델) 검색 결과 #prodArea 실측 — 이 필터는 지금까지 쓴
# 다른 GPU/CPU 등 필터와 달리 다나와 "기본검색"(RepOption,가로형) UI가 아니라
# "상세검색"(searchAttributeValue[]) UI에만 노출돼 있고, 값 형식도
# "{카테고리seq}|{속성seq}|{값seq}|OR"(예: "753|682|3993|OR")로 달랐음.
# 다나와 접근이 이 환경에서 잠깐 열렸을 때 라이브로 직접 검증: 카테고리seq를
# 빼고 하이픈으로 바꾼 "682-3993-OR" 형식이 기존 attribute= 파라미터에
# 그대로 먹힘 확인(140~149mm 필터 → GT1030/GT730 등 초소형 카드만,
# 360mm~ 필터 → RTX 5080/5090 등 초대형 카드만 반환되는 것으로 실측 확인).
# 콤마/파이프/파라미터 반복 전부 시도했으나 여러 구간을 하나로 묶는 다중
# attribute 결합은 안 됨 확인(기존 "다중 attribute 결합 규칙 미검증" 제약과
# 동일) — 그래서 PSU_WATTAGE_ATTRIBUTES와 같은 방식으로 다나와가 제공하는
# 10mm 단위 구간(전체 23개) 중 현재 시장 판매 카드가 몰려 있는 실사용
# 범위(190~369mm)에서 7개만 골라 채택. 140~189mm(구형 로우프로파일
# 업무용 카드 GT710/GT730급, 개인 게이밍 조립 범위 밖)는 제외 — 기존
# 트리밍 원칙과 동일
GPU_LENGTH_ATTRIBUTES = {
    "190~199mm": "682-203119-OR",
    "260~269mm": "682-3989-OR",
    "280~289mm": "682-3991-OR",
    "300~309mm": "682-857731-OR",
    "320~329mm": "682-857734-OR",
    "340~349mm": "682-857740-OR",
    "360mm~": "682-3993-OR",
}

# /search?socket= 값(메인보드 전용, category=메인보드일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑(속성코드 500 = CPU 소켓,
# "B650" 검색 결과 필터 사이드바에서 실측). CPU_SOCKET_ATTRIBUTES와 값 이름은
# 같지만(AM5/AM4/LGA1851/LGA1700) 다나와 내부 코드 자체가 카테고리마다
# 별도라 값이 다름(예: CPU 카테고리 AM5=41-801631-OR, 메인보드 카테고리
# AM5=500-801682-OR) — 카테고리 간 attribute 코드는 절대 재사용 불가,
# 매번 그 카테고리 자체의 필터 사이드바에서 다시 확보해야 함 확인됨
MAINBOARD_SOCKET_ATTRIBUTES = {
    "AM5": "500-801682-OR",
    "AM4": "500-212831-OR",
    "LGA1851": "500-987856-OR",
    "LGA1700": "500-748870-OR",
}

# /search?formfactor= 값(메인보드/케이스 공용 파라미터, category=메인보드
# 또는 케이스일 때만 적용) → 카테고리별로 다른 딕셔너리(아래 참조)를 거쳐
# danawa.get_product_codes(attribute=...)에 전달. 메인보드는 "자기 자신의
# 크기"(속성코드 506), 케이스는 "장착 가능한 보드 크기"(속성코드 6196,
# 값 형식이 -AND — 케이스 하나가 여러 폼팩터를 동시에 지원할 수 있어서
# 다중선택 결합에 AND를 쓰는 것으로 보이나, 단일 값 선택만 지원하는 현재
# 구현에서는 -OR와 동작상 차이 없음)로 의미가 다름 — 같은 파라미터명이지만
# 백엔드에서 카테고리별로 분리해서 처리(아래 search() 참조).
# 후면커넥터형(BTF류)·SSI-CEB/EEB·M-DTX 등은 소수 규격이라 제외, 4개만 채택
MAINBOARD_FORMFACTOR_ATTRIBUTES = {
    "ATX": "506-2459-OR",
    "M-ATX": "506-2460-OR",
    "ITX": "506-2464-OR",
    "E-ATX": "506-2461-OR",
}
CASE_FORMFACTOR_ATTRIBUTES = {
    "ATX": "6196-22391-AND",
    "M-ATX": "6196-22392-AND",
    "ITX": "6196-22398-AND",
    "E-ATX": "6196-22394-AND",
}

# /search?ram_type= 값(RAM 전용, category=RAM일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑(속성코드 277 = 제품
# 분류, "DDR5 32GB" 검색 결과 필터 사이드바에서 실측). DDR3/DDR2(구형),
# LPDDR 계열(노트북용)은 제외 — 데스크탑 신규 조립 기준 DDR5/DDR4만 채택
RAM_TYPE_ATTRIBUTES = {
    "DDR5": "277-748099-OR",
    "DDR4": "277-164333-OR",
}

# /search?wattage= 값(파워 전용, category=파워일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑(속성코드 1088 = 정격출력,
# "850W" 검색 결과 필터 사이드바에서 실측). 250W 미만~400W(저사양 사무용)와
# 1300W 이상(익스트림 워크스테이션)은 일반 게이밍/조립 PC 범위 밖이라 제외
PSU_WATTAGE_ATTRIBUTES = {
    "450W~499W": "1088-5555-OR",
    "500W~599W": "1088-5556-OR",
    "600W~699W": "1088-5558-OR",
    "700W~799W": "1088-173072-OR",
    "800W~899W": "1088-173073-OR",
    "900W~999W": "1088-173074-OR",
    "1000W~1299W": "1088-976690-OR",
}

# /search?interface= 값(SSD 전용, category=SSD일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑(속성코드 14690 = 인터페이스,
# "NVMe 2TB" 검색 결과 필터 사이드바에서 실측). PCIe x8 레인/U.2/기타(서버·
# 엔터프라이즈용)는 제외 — 일반 소비자용 M.2/SATA 조합 4개만 채택
SSD_INTERFACE_ATTRIBUTES = {
    "SATA3": "14690-88980-OR",
    "PCIe3.0x4": "14690-213230-OR",
    "PCIe4.0x4": "14690-402191-OR",
    "PCIe5.0x4": "14690-859759-OR",
}

# /search?formfactor= 값(SSD 전용, category=SSD일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑(속성코드 14695 = 폼팩터,
# "NVMe 2TB" 검색 결과 필터 사이드바에서 실측). 같은 파라미터명을 메인보드/
# 케이스가 이미 쓰고 있지만 그쪽과 마찬가지로 카테고리별 별도 딕셔너리로
# 분리 처리(아래 search() 참조) — attribute 코드 자체는 SSD 전용(14695),
# 재사용 아님. Mini SATA(mSATA, 구형 노트북용)·PCIe 카드(애드인 카드,
# 소수 규격)·기타(불명확)는 제외 — M.2(22110, 서버/엔터프라이즈용)도 개인
# 조립 PC 범위 밖이라 제외하고 소비자용 4개만 채택. interface와 동시 지정
# 시 interface 우선 적용(둘 다 SSD 자체 성격을 정의하는 축이라 우선순위
# 기준 명확한 원칙은 없음 — SSD 성능/세대를 더 직접적으로 나타내는
# interface를 우선한 것으로 결정)
SSD_FORMFACTOR_ATTRIBUTES = {
    "M.2 2280": "14695-202347-OR",
    "M.2 2242": "14695-202350-OR",
    "M.2 2230": "14695-656345-OR",
    "2.5인치": "14695-86092-OR",
}

# /search?cooler_type= 값(쿨러 전용, category=쿨러일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑(속성코드 687 = 제품 종류,
# "CPU 쿨러" 검색 결과 필터 사이드바에서 실측). 다나와 "쿨러/튜닝" 카테고리는
# 다른 카테고리와 달리 성격이 다른 상품이 한 카테고리에 섞여 있어서
# (CPU 쿨러 + 케이스팬 + 써멀그리스 + 조명기기 + VGA 지지대 …) category
# 필터만으로는 CPU 쿨러가 안 걸러짐 — 이 카테고리에 제품 종류 필터가 특히
# 필요한 이유. 실측된 17종 중 VGA 지지대/가이드/수랭 부속품/RAM·HDD 쿨러/
# 팬컨트롤러/써멀패드·퍼티/조명기기/방열판/팬 부속품/튜닝 용품은 개인 조립
# PC의 부품 견적 범위 밖이라 기존 트리밍 원칙대로 제외하고 5종만 채택.
# 키는 우리 API 계약 값이라 다나와 라벨과 꼭 같지는 않음("써멀그리스"의
# 다나와 원 라벨은 "써멀컴파운드(그리스)") — frontend/src/components/
# PartRow.tsx의 COOLER_TYPE_OPTIONS와 반드시 키를 맞출 것
COOLER_TYPE_ATTRIBUTES = {
    "CPU 쿨러": "687-4015-OR",
    "시스템 쿨러": "687-4017-OR",
    "VGA 쿨러": "687-4016-OR",
    "M.2 SSD 쿨러": "687-259565-OR",
    "써멀그리스": "687-4023-OR",
}

# /search?socket= 값(쿨러 전용, category=쿨러일 때만 적용) →
# danawa.get_product_codes(attribute=...) 전달값 매핑. 쿨러 카테고리는 소켓
# 필터 그룹이 인텔(속성코드 6805)/AMD(6806) 둘로 나뉘어 있어서 CPU·메인보드와
# 달리 값에 따라 속성코드 자체가 갈림 — 그래도 우리 API 계약(socket 파라미터,
# AM5/AM4/LGA1851/LGA1700 4개)은 다른 카테고리와 동일하게 유지하려고 한
# 딕셔너리로 합쳤음. 형식이 -OR이 아니라 -AND인 것도 실측값 그대로(쿨러
# 하나가 여러 소켓을 동시 지원해서 다중선택 결합에 AND를 쓰는 것으로 보이나,
# 케이스 폼팩터와 마찬가지로 단일 값만 지원하는 현재 구현에서는 차이 없음).
# CPU/메인보드 카테고리와 값 이름은 같지만 코드는 전혀 다름 — 카테고리 간
# attribute 코드 재사용 불가 원칙이 여기서도 그대로 확인됨.
# 워크스테이션/서버/구형 소켓(LGA1954는 미출시 차세대, LGA1200 이하 인텔
# 구형, TR5/SP6/SP5/TR4/sWRX8/sTRX4/SP3 등 HEDT·서버, FMx/AM2,3·AM1 구형
# AMD)은 CPU_SOCKET_ATTRIBUTES와 동일한 기준으로 제외
COOLER_SOCKET_ATTRIBUTES = {
    "AM5": "6806-776764-AND",
    "AM4": "6806-213365-AND",
    "LGA1851": "6805-906253-AND",
    "LGA1700": "6805-743326-AND",
}


def _validate_ma_window(ma_window: int) -> int:
    """
    ma_window 쿼리파라미터 검증. Literal[7,14,30] 타입 힌트로 FastAPI가
    자동 검증하게 하는 방법도 시도했으나, 쿼리파라미터는 항상 문자열로
    들어와서 Literal[int, ...]가 "14"(str)를 14(int)로 캐스팅하지 않고
    그대로 422 처리해버리는 문제가 있어(fastapi 0.141 / pydantic 2.13
    실측 확인) /history의 months 검증과 같은 방식(수동 체크)으로 통일함.
    """
    if ma_window not in MA_WINDOW_CHOICES:
        raise HTTPException(status_code=422, detail="ma_window는 7, 14, 30 중 하나여야 함")
    return ma_window

app = FastAPI(title="실가 backend", version="0.1.0")


@app.on_event("startup")
def _create_tables():
    # 개인 프로젝트 규모 — Alembic 등 마이그레이션 도구 없이 create_all로 충분
    Base.metadata.create_all(bind=engine)

# 개인 프로젝트, 인증 없음 — 로컬 프론트(Vite dev server)에서 크로스 오리진 호출 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/search", response_model=list[SearchResultItem])
def search(
    q: Optional[str] = Query(
        None,
        min_length=1,
        description="검색 키워드 — 생략 시 category 기준 기본 목록(CATEGORY_DEFAULT_QUERY) 반환, "
                     "q와 category 둘 다 없으면 400",
    ),
    category: Optional[str] = Query(
        None,
        description="CPU/GPU/메인보드/RAM/SSD/케이스/파워/쿨러 중 하나 — "
                     "지정 시 해당 카테고리 상품만 반환 (매칭 안 되는 값은 무시)",
    ),
    memory_gb: Optional[int] = Query(
        None,
        description="GPU 메모리 용량(GB) 스펙 필터 — category=GPU일 때만 적용, "
                     "그 외에는 무시. GPU_MEMORY_ATTRIBUTES에 없는 값도 무시",
    ),
    socket: Optional[str] = Query(
        None,
        description="소켓 스펙 필터(AM5/AM4/LGA1851/LGA1700) — category=CPU/메인보드/쿨러일 때만 "
                     "적용(카테고리별로 다나와 내부 코드가 달라 각각 다른 매핑 사용), 그 외 무시. "
                     "매칭 안 되는 값도 무시",
    ),
    chipset: Optional[str] = Query(
        None,
        description="GPU 칩셋 제조사 스펙 필터(NVIDIA/AMD/Intel) — category=GPU일 때만 적용, "
                     "그 외에는 무시. memory_gb와 동시 지정 시 chipset 우선 적용",
    ),
    length: Optional[str] = Query(
        None,
        description="GPU 가로(길이) 스펙 필터(예: 300~309mm, 360mm~) — category=GPU일 때만 적용, "
                     "GPU_LENGTH_ATTRIBUTES 키와 정확히 일치해야 함, 그 외 무시. "
                     "chipset/memory_gb와 동시 지정 시 그쪽이 우선 적용",
    ),
    formfactor: Optional[str] = Query(
        None,
        description="폼팩터 스펙 필터 — category=메인보드/케이스일 때는 ATX/M-ATX/ITX/E-ATX "
                     "(메인보드=자기 크기, 케이스=장착 가능한 보드 크기), category=SSD일 때는 "
                     "M.2 2280/M.2 2242/M.2 2230/2.5인치. 그 외 category에서는 무시. "
                     "메인보드는 socket과, SSD는 interface와 동시 지정 시 그쪽이 우선 적용",
    ),
    ram_type: Optional[str] = Query(
        None,
        description="RAM 규격 스펙 필터(DDR5/DDR4) — category=RAM일 때만 적용, 그 외 무시",
    ),
    wattage: Optional[str] = Query(
        None,
        description="파워 정격출력 스펙 필터(예: 800W~899W) — category=파워일 때만 적용, "
                     "PSU_WATTAGE_ATTRIBUTES 키와 정확히 일치해야 함, 그 외 무시",
    ),
    interface: Optional[str] = Query(
        None,
        description="SSD 인터페이스 스펙 필터(SATA3/PCIe3.0x4/PCIe4.0x4/PCIe5.0x4) — "
                     "category=SSD일 때만 적용, 그 외 무시. formfactor와 동시 지정 시 interface 우선 적용",
    ),
    cooler_type: Optional[str] = Query(
        None,
        description="쿨러 제품 종류 스펙 필터(CPU 쿨러/시스템 쿨러/VGA 쿨러/M.2 SSD 쿨러/써멀그리스) — "
                     "category=쿨러일 때만 적용, 그 외 무시. socket과 동시 지정 시 cooler_type 우선 적용",
    ),
):
    """
    GET /search?q={keyword, 선택}&category={CATEGORY_LABELS 키, 선택}&memory_gb={GPU 전용}&chipset={GPU 전용}&
        length={GPU 전용}&socket={CPU/메인보드/쿨러 전용}&formfactor={메인보드/케이스/SSD 전용}&
        ram_type={RAM 전용}&wattage={파워 전용}&interface={SSD 전용}&cooler_type={쿨러 전용}
        (스펙 파라미터는 전부 선택, category와 안 맞으면 무시) →
        [{code, title, price, price_formatted, img}, ...]

    q 생략 시 category의 CATEGORY_DEFAULT_QUERY 키워드로 대신 검색(검색 버튼을
    누르지 않아도 카테고리 선택만으로 기본 목록이 뜨도록 하기 위함) — q와
    category 둘 다 없으면 400.
    """
    if not q:
        q = CATEGORY_DEFAULT_QUERY.get(category) if category else None
        if not q:
            raise HTTPException(status_code=400, detail="q 또는 유효한 category가 필요합니다")

    category_label = CATEGORY_LABELS.get(category) if category else None
    attribute = None
    if category == "GPU":
        attribute = (
            GPU_CHIPSET_ATTRIBUTES.get(chipset)
            or GPU_MEMORY_ATTRIBUTES.get(memory_gb)
            or GPU_LENGTH_ATTRIBUTES.get(length)
        )
    elif category == "CPU":
        attribute = CPU_SOCKET_ATTRIBUTES.get(socket)
    elif category == "메인보드":
        attribute = MAINBOARD_SOCKET_ATTRIBUTES.get(socket) or MAINBOARD_FORMFACTOR_ATTRIBUTES.get(formfactor)
    elif category == "케이스":
        attribute = CASE_FORMFACTOR_ATTRIBUTES.get(formfactor)
    elif category == "RAM":
        attribute = RAM_TYPE_ATTRIBUTES.get(ram_type)
    elif category == "파워":
        attribute = PSU_WATTAGE_ATTRIBUTES.get(wattage)
    elif category == "SSD":
        attribute = SSD_INTERFACE_ATTRIBUTES.get(interface) or SSD_FORMFACTOR_ATTRIBUTES.get(formfactor)
    elif category == "쿨러":
        attribute = COOLER_TYPE_ATTRIBUTES.get(cooler_type) or COOLER_SOCKET_ATTRIBUTES.get(socket)
    try:
        results = danawa.get_product_codes(q, category_label=category_label, attribute=attribute)
    except requests.RequestException:
        # 데이터 소스 자체 장애 (다나와 연결 실패) — 상품 없음과 구분
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")

    return [
        SearchResultItem(
            code=item["code"],
            title=item.get("title"),
            price=item.get("price"),
            price_formatted=format_won(item.get("price")),
            img=item.get("img"),
        )
        for item in results
    ]


@app.get("/product/{code}", response_model=ProductDetail)
def get_product_detail(code: int):
    """
    GET /product/{code} → {code, title, category, current_price, cash_price,
                            spec, variants: [...]}

    category(카테고리 브레드크럼)와 cash_price(현금최저가)는 2026-08-04
    파싱 구현 완료(danawa.py::get_product 참조) — 둘 다 데이터가 없는
    상품(예: 현금결제 전용 판매처가 없는 상품)에서는 None 그대로 반환됨,
    파싱 실패가 아니라 정상적으로 없는 값.
    """
    try:
        data = danawa.get_product(code)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")

    if not data or "title" not in data:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없음")

    lowest_price = data.get("lowest_price")
    current_price = None
    if lowest_price is not None:
        try:
            current_price = int(lowest_price)
        except (TypeError, ValueError):
            current_price = None

    variants = [
        ProductVariant(
            type=v.get("type"),
            price=v.get("price"),
            mall_count=v.get("mall_count"),
            pcode=v.get("pcode"),
            is_current=v.get("is_current", False),
        )
        for v in data.get("variants", [])
    ]

    return ProductDetail(
        code=code,
        title=data.get("title"),
        category=data.get("category"),
        current_price=current_price,
        cash_price=data.get("cash_price"),
        spec=data.get("spec"),
        variants=variants,
        in_stock=data.get("in_stock"),
    )


def _fetch_lowest_price(code: int):
    """
    단일 상품의 title/lowest_price를 조회.
    실측 합계/판정 계산 원칙(REFERENCE.md #엔드포인트-설계)에 따라 항상
    lowest_price 필드만 사용 — prices 리스트에서 min() 계산 금지.
    """
    data = danawa.get_product(code)
    if not data or "title" not in data:
        return None, None

    lowest_price = data.get("lowest_price")
    price_int = None
    if lowest_price is not None:
        try:
            price_int = int(lowest_price)
        except (TypeError, ValueError):
            price_int = None

    return data.get("title"), price_int


def _compute_estimate(items: list[EstimateItem]):
    """
    POST /estimate, POST /build/compare가 공유하는 견적 계산 로직.

    주의: 항목 수만큼 danawa.get_product()를 순차 호출함 — 매너 크롤링 원칙
    (요청 간격 5~10초, 동시 병렬 지양)을 지키려면 부품 수가 많은 빌드일수록
    응답이 느려짐. 개인용 규모라 지금은 별도 스로틀링/캐싱 없이 그대로 감.
    부품 수가 많아져서 체감 지연이 문제되면 그때 재검토.

    부품 하나의 danawa 연결이 끊겨도(requests.RequestException) 전체 요청을
    실패시키지 않고 그 부품만 가격 정보 없음(title/price=None)으로 처리하고
    계속 진행 — POST /builds(create_build)·_fetch_ma_price의 기존 부품별
    fallback 관례를 따름(2026-08-04 결정, 실가_인수인계.md 참조). 단일 상품
    조회(GET /product/{code}, GET /product/{code}/compare)는 이 관례 대상이
    아니고 연결 장애 시 즉시 503 처리 유지.
    """
    breakdown = []
    total_price = 0

    for item in items:
        try:
            title, price = _fetch_lowest_price(item.code)
        except requests.RequestException:
            title, price = None, None
        breakdown.append(
            BreakdownItem(category=item.category, title=title, price=price)
        )
        if price is not None:
            total_price += price

    return total_price, breakdown


_VERDICT_BASIS_CACHE_TTL_SECONDS = 300  # 5분
_verdict_basis_cache: dict[tuple[int, int], tuple[float, tuple]] = {}


def _fetch_ma_price(code: int, ma_window: int):
    """
    최근 ma_window일 이동평균 최저가. get_price_variance(code, 3)(3개월치)을
    불러서 compute_ma_price()로 계산.

    by_month=1이 아니라 3을 쓰는 이유(2026-08-04 로컬 라이브 검증으로 발견):
    다나와는 daily가 아니라 주 단위로 데이터를 줘서 1개월치는 포인트가 4개
    안팎뿐 — compute_ma_price()의 "엄격" 기준(히스토리가 window일 전체를
    커버해야 유효, services/verdict.py 참조)을 window=30일 때 만족하기엔
    범위가 부족함. 3개월치를 받아두면 최근 30일 컷오프보다 훨씬 이전
    데이터까지 확보돼서 정상 상품이면 세 window(7/14/30) 전부 판단 가능.

    히스토리 조회 자체가 실패하거나(장애/데이터 없음) "엄격" 기준을 못
    채우면(신상품 등) None — 호출부에서 즉시가로 fallback 처리.
    """
    try:
        variance = danawa.get_price_variance(code, 3)
    except (requests.RequestException, TypeError):
        return None
    return compute_ma_price(variance["prices"], ma_window)


def _compute_verdict_basis(items: list[EstimateItem], breakdown: list[BreakdownItem], ma_window: int):
    """
    판정(verdict) 기준가 계산. 부품별로 이동평균(ma_window일)이 유효하면 그
    값을, 무효(신상품이라 데이터 부족 등)하면 breakdown의 즉시가로 대체
    (fallback)해서 합산한다. 부품 하나라도 fallback되면 전체 판정을
    null로 날리지 않고 verdict_confidence를 "low"로 낮춰 투명하게 표시함
    (2026-08-04 결정, 실가_인수인계.md "결정 완료" 참조).

    breakdown은 _compute_estimate()가 이미 계산해둔 즉시가를 그대로
    재사용 — fallback용으로 danawa.get_product()를 다시 호출하지 않기
    위함(중복 스크래핑 방지).
    """
    basis_total = 0
    has_price = False
    confidence = "high"
    basis_breakdown = []

    for item, bd in zip(items, breakdown):
        ma_price = _fetch_ma_price(item.code, ma_window)
        if ma_price is not None:
            price, source = ma_price, "ma"
        else:
            price, source = bd.price, "current_fallback"
            confidence = "low"

        if price is not None:
            basis_total += price
            has_price = True

        basis_breakdown.append(VerdictBasisItem(code=item.code, price=price, source=source))

    basis_price = basis_total if has_price else None
    return basis_price, confidence, basis_breakdown


def _get_cached_verdict_basis(
    build_id: int, ma_window: int, items: list[EstimateItem], breakdown: list[BreakdownItem]
):
    """
    GET /builds, GET /builds/{id} 전용 캐시(같은 캐시를 공유). 저장된
    빌드를 매번 순회 재계산하는 구조라, 이동평균 도입으로 부품당 스크래핑이
    2배(get_product + get_price_variance)가 되는 부담과, 목록↔상세 이동
    시 캐시 미스 타이밍 차이로 판정이 다르게 뜨는 문제를 함께 완화하려고
    (build_id, ma_window) 키로 5분간 프로세스 메모리에 들고 있음 (DB 저장
    아님 — "가격 자체 축적 금지" 원칙과는 별개, 총 견적가 total_price는
    이 캐시 대상이 아니고 항상 새로 조회함). 2026-08-04 결정,
    실가_인수인계.md 참조.
    """
    cache_key = (build_id, ma_window)
    now = time.monotonic()
    cached = _verdict_basis_cache.get(cache_key)
    if cached and now - cached[0] < _VERDICT_BASIS_CACHE_TTL_SECONDS:
        return cached[1]

    result = _compute_verdict_basis(items, breakdown, ma_window)
    _verdict_basis_cache[cache_key] = (now, result)
    return result


@app.get("/product/{code}/history", response_model=PriceHistory)
def get_price_history(code: int, months: int = Query(..., description="1, 3, 6, 12 중 하나")):
    """
    GET /product/{code}/history?months={1|3|6|12} → {min, max, prices: [...]}
    """
    if months not in (1, 3, 6, 12):
        raise HTTPException(status_code=422, detail="months는 1, 3, 6, 12 중 하나여야 함")

    try:
        variance = danawa.get_price_variance(code, months)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")
    except TypeError:
        # danawa.get_price_variance는 해당 기간 데이터가 없으면 TypeError 발생
        raise HTTPException(status_code=404, detail="가격 히스토리를 찾을 수 없음")

    return PriceHistory(
        min=str(variance["min"]),
        max=str(variance["max"]),
        prices=[
            PricePoint(date=p["date"], price=str(p["price"]), full_date=p.get("full_date"))
            for p in variance["prices"]
        ],
    )


@app.post("/estimate", response_model=EstimateResponse)
def estimate(items: list[EstimateItem]):
    """
    POST /estimate  body: [{code}, {code, category}, ...]
                    → {total_price, total_price_formatted, breakdown: [...]}
    """
    total_price, breakdown = _compute_estimate(items)

    return EstimateResponse(
        total_price=total_price,
        total_price_formatted=format_won(total_price),
        breakdown=breakdown,
    )


@app.get("/product/{code}/compare", response_model=ProductCompareResponse)
def compare_single_product(
    code: int,
    market_price: int = Query(...),
    ma_window: int = Query(14, description="판정 기준 이동평균 기간(일), 7/14/30 중 하나"),
):
    """
    GET /product/{code}/compare?market_price={n}&ma_window={7|14|30}
        → {title, lowest_price, estimate_total, verdict_basis_price,
           verdict_confidence, verdict_basis_breakdown, ma_window,
           market_price, verdict, diff_percent}

    단일 상품 기준 — estimate_total(즉시가)은 그 상품 하나의 lowest_price와
    동일값, 의미 안 바뀜. 판정(verdict)은 이동평균 기준가
    (verdict_basis_price)로 계산하고, 이동평균 데이터가 부족하면 즉시가로
    대체(fallback)하면서 verdict_confidence를 "low"로 표시함 (2026-08-04
    결정, 실가_인수인계.md 참조).

    단일 상품 조회라 GET /product/{code}(get_product_detail)와 동일하게
    danawa 연결 장애(requests.RequestException)는 즉시 503 처리 — 다중
    부품을 합산하는 /estimate·/build/compare·GET /builds류와 달리 부품별
    fallback 관례를 적용할 대상이 없음(2026-08-04 결정, 실가_인수인계.md 참조).
    """
    ma_window = _validate_ma_window(ma_window)

    try:
        title, lowest_price = _fetch_lowest_price(code)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")
    if lowest_price is None:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없거나 최저가 정보 없음")

    ma_price = _fetch_ma_price(code, ma_window)
    if ma_price is not None:
        basis_price, confidence, source = ma_price, "high", "ma"
    else:
        basis_price, confidence, source = lowest_price, "low", "current_fallback"

    verdict, diff_percent = calc_verdict(basis_price, market_price)

    return ProductCompareResponse(
        title=title,
        lowest_price=lowest_price,
        estimate_total=lowest_price,
        verdict_basis_price=basis_price,
        verdict_basis_price_formatted=format_won(basis_price),
        verdict_confidence=confidence,
        verdict_basis_breakdown=[VerdictBasisItem(code=code, price=basis_price, source=source)],
        ma_window=ma_window,
        market_price=market_price,
        verdict=verdict,
        diff_percent=diff_percent,
    )


@app.post("/build/compare", response_model=BuildCompareResponse)
def compare_build(payload: BuildCompareRequest):
    """
    POST /build/compare  body: {items: [{code, category}, ...], market_price, ma_window?}
                         → {total_price, total_price_formatted, breakdown,
                            verdict_basis_price, verdict_confidence,
                            verdict_basis_breakdown, ma_window, market_price,
                            verdict, diff_percent}

    REFERENCE.md 원문에는 없던 신규 엔드포인트. app-shell-mockup.html의
    "빌드 상세 → 판정 게이지"가 실제로 필요로 하는 건 빌드 전체 합계 대
    판매가 비교라, 문서상 단일상품용이던 /product/{code}/compare와는 별도로
    빌드 전체용을 추가함 (사용자 확인 완료).

    total_price(즉시가)는 지금처럼 순간 스크래핑 값 그대로, 의미 안 바뀜.
    판정은 verdict_basis_price(부품별 이동평균, 무효한 부품은 즉시가로
    fallback)로 계산함 (2026-08-04 결정, 실가_인수인계.md 참조).
    """
    total_price, breakdown = _compute_estimate(payload.items)

    if total_price == 0:
        raise HTTPException(status_code=404, detail="부품 가격을 하나도 찾지 못해 판정 불가")

    basis_price, confidence, basis_breakdown = _compute_verdict_basis(
        payload.items, breakdown, payload.ma_window
    )

    if basis_price is None:
        raise HTTPException(status_code=404, detail="부품 가격을 하나도 찾지 못해 판정 불가")

    verdict, diff_percent = calc_verdict(basis_price, payload.market_price)

    return BuildCompareResponse(
        total_price=total_price,
        total_price_formatted=format_won(total_price),
        breakdown=breakdown,
        verdict_basis_price=basis_price,
        verdict_basis_price_formatted=format_won(basis_price),
        verdict_confidence=confidence,
        verdict_basis_breakdown=basis_breakdown,
        ma_window=payload.ma_window,
        market_price=payload.market_price,
        verdict=verdict,
        diff_percent=diff_percent,
    )


def _cache_product(
    db: Session,
    code: int,
    title: Optional[str] = None,
    category: Optional[str] = None,
    spec: Optional[str] = None,
    img: Optional[str] = None,
):
    """
    products 테이블은 재조회 최소화용 캐시(가격 제외, REFERENCE.md #DB-스키마
    참조) — build_item.product_code FK가 가리킬 로우가 있어야 하므로, 빌드/
    즐겨찾기 저장 시점에 title/category/spec/img를 upsert 해둠. 가격은 여기
    저장하지 않음.
    """
    existing = db.query(Product).filter(Product.code == code).first()
    if existing:
        if title is not None:
            existing.title = title
        if category is not None:
            existing.category = category
        if spec is not None:
            existing.spec = spec
        if img is not None:
            existing.img = img
        existing.cached_at = now_kst()
    else:
        db.add(Product(code=code, title=title, category=category, spec=spec, img=img, cached_at=now_kst()))
    db.commit()


@app.post("/builds", response_model=BuildSummary, status_code=201)
def create_build(payload: BuildCreateRequest, db: Session = Depends(get_db)):
    """
    POST /builds  body: {name, market_price?, items: [{category, code}, ...]}

    REFERENCE.md 원 계약에는 없던 신규 엔드포인트 — DB 스키마(builds/build_items)는
    이미 설계돼 있었는데 이걸 채워넣는 CRUD가 누락돼 있었음. 빌드 탭 "생성 →
    분석하기" 흐름이 실제로 저장까지 하려면 필요.
    """
    build = Build(name=payload.name, market_price=payload.market_price, created_at=now_kst())
    db.add(build)
    db.commit()
    db.refresh(build)

    for item in payload.items:
        # products 캐시에 없으면 채워넣기 (FK 무결성 + 목록 화면 title 표시용)
        try:
            data = danawa.get_product(item.code)
        except requests.RequestException:
            data = {}
        _cache_product(db, item.code, title=data.get("title"), category=data.get("category"), spec=data.get("spec"), img=data.get("img"))

        db.add(BuildItem(build_id=build.id, category=item.category, product_code=item.code))
    db.commit()

    return BuildSummary(
        id=build.id,
        name=build.name,
        market_price=build.market_price,
        created_at=build.created_at,
        item_count=len(payload.items),
        total_price=None,
        total_price_formatted=None,
        verdict=None,
    )


@app.get("/builds", response_model=list[BuildSummary])
def list_builds(
    ma_window: int = Query(14, description="판정 기준 이동평균 기간(일), 7/14/30 중 하나"),
    db: Session = Depends(get_db),
):
    """
    GET /builds?ma_window={7|14|30} → 저장된 빌드 목록 (앱 셸 "내 빌드" 카드
    목록에 대응)

    카드에 적정가/고가/저가 태그를 보여주려면 라이브 가격 조회가 필요해서,
    목록 조회 시점에 빌드마다 _compute_estimate를 다시 돌림 — 개인 프로젝트
    규모라 지금은 그대로 감(빌드 개수 많아지면 느려질 수 있음, 나중에 재검토).

    total_price(즉시가)는 항상 새로 조회. verdict는 이동평균 기준가로
    계산하되 (build_id, ma_window) 단위 5분 캐시(_get_cached_verdict_basis)를
    씀 — 이동평균 도입으로 부품당 스크래핑이 2배 늘어난 부담을 덜기 위함
    (2026-08-04 결정, 실가_인수인계.md 참조).
    """
    ma_window = _validate_ma_window(ma_window)

    builds = db.query(Build).all()
    results = []

    for build in builds:
        items = [EstimateItem(code=bi.product_code, category=bi.category) for bi in build.items]
        total_price, breakdown = _compute_estimate(items) if items else (0, [])

        verdict = None
        confidence = None
        if build.market_price and total_price and items:
            basis_price, confidence, _ = _get_cached_verdict_basis(build.id, ma_window, items, breakdown)
            if basis_price:
                verdict, _ = calc_verdict(basis_price, build.market_price)

        results.append(
            BuildSummary(
                id=build.id,
                name=build.name,
                market_price=build.market_price,
                created_at=build.created_at,
                item_count=len(items),
                total_price=total_price or None,
                total_price_formatted=format_won(total_price) if total_price else None,
                verdict=verdict,
                verdict_confidence=confidence if verdict else None,
                ma_window=ma_window if verdict else None,
            )
        )

    return results


@app.get("/builds/{build_id}", response_model=BuildDetail)
def get_build_detail(
    build_id: int,
    ma_window: int = Query(14, description="판정 기준 이동평균 기간(일), 7/14/30 중 하나"),
    db: Session = Depends(get_db),
):
    """
    GET /builds/{id}?ma_window={7|14|30} → 빌드 상세 (판정 게이지 + breakdown,
    앱 셸 빌드 상세 화면에 대응)

    total_price(즉시가)는 항상 새로 조회. verdict/verdict_basis_price는
    이동평균 기준(무효한 부품은 즉시가 fallback)이고, GET /builds(목록)와
    같은 (build_id, ma_window) 캐시를 공유해서 목록↔상세 이동 시 판정이
    서로 다르게 뜨는 걸 방지함 (2026-08-04 결정, 실가_인수인계.md 참조).
    """
    ma_window = _validate_ma_window(ma_window)

    build = db.query(Build).filter(Build.id == build_id).first()
    if build is None:
        raise HTTPException(status_code=404, detail="빌드를 찾을 수 없음")

    items = [EstimateItem(code=bi.product_code, category=bi.category) for bi in build.items]
    total_price, breakdown = _compute_estimate(items) if items else (0, [])

    verdict = None
    diff_percent = None
    basis_price = None
    confidence = None
    basis_breakdown = []
    if build.market_price and total_price and items:
        basis_price, confidence, basis_breakdown = _get_cached_verdict_basis(
            build.id, ma_window, items, breakdown
        )
        if basis_price:
            verdict, diff_percent = calc_verdict(basis_price, build.market_price)

    return BuildDetail(
        id=build.id,
        name=build.name,
        market_price=build.market_price,
        created_at=build.created_at,
        items=[
            BuildItemDetail(
                category=bd.category,
                code=item.code,
                title=bd.title,
                price=bd.price,
            )
            for bd, item in zip(breakdown, items)
        ],
        total_price=total_price,
        total_price_formatted=format_won(total_price),
        verdict_basis_price=basis_price,
        verdict_basis_price_formatted=format_won(basis_price),
        verdict_confidence=confidence if verdict else None,
        verdict_basis_breakdown=basis_breakdown if verdict else [],
        ma_window=ma_window if verdict else None,
        verdict=verdict,
        diff_percent=diff_percent,
    )


@app.post("/favorites", response_model=FavoriteItem, status_code=201)
def add_favorite(payload: FavoriteCreateRequest, db: Session = Depends(get_db)):
    """
    POST /favorites  body: {code} → 즐겨찾기 추가 (2026-08-04 신규 — 즐겨찾기
    탭 채우는 첫 엔드포인트, DB에 favorites 테이블 신설)

    이미 즐겨찾기된 상품이면 새로 추가하지 않고 기존 항목을 그대로
    반환(idempotent) — 중복 추가를 에러로 취급하지 않음.
    danawa.get_product()를 한 번만 호출해서 존재 확인 + products 캐시
    upsert + 응답용 즉시가까지 한 번에 처리(중복 스크래핑 방지).
    단일 상품 조회라 GET /product/{code}와 동일하게 연결 장애는 즉시 503.
    """
    existing = db.query(Favorite).filter(Favorite.product_code == payload.code).first()

    try:
        data = danawa.get_product(payload.code)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="데이터 소스(다나와) 연결 실패")

    if not data or "title" not in data:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없음")

    lowest_price = data.get("lowest_price")
    price = None
    if lowest_price is not None:
        try:
            price = int(lowest_price)
        except (TypeError, ValueError):
            price = None

    if existing is None:
        _cache_product(db, payload.code, title=data.get("title"), category=data.get("category"), spec=data.get("spec"), img=data.get("img"))
        existing = Favorite(product_code=payload.code, created_at=now_kst())
        db.add(existing)
        db.commit()
        db.refresh(existing)

    return FavoriteItem(
        code=payload.code,
        title=data.get("title"),
        price=price,
        price_formatted=format_won(price) if price is not None else None,
        created_at=existing.created_at,
    )


@app.get("/favorites", response_model=list[FavoriteItem])
def list_favorites(db: Session = Depends(get_db)):
    """
    GET /favorites → 즐겨찾기 목록, 상품별 실시간 최저가 포함 (2026-08-04 신규)

    GET /builds와 마찬가지로 조회 시점마다 danawa를 순차 재조회(매너 크롤링
    원칙) — 개인 프로젝트 규모라 캐시 없이 그대로 감. 부품 하나의 연결
    장애가 전체 목록을 죽이지 않도록 항목별로 실패를 삼키고 계속 진행
    (POST /builds·_compute_estimate와 동일한 다중 부품 fallback 관례,
    2026-08-04 결정 — 실가_인수인계.md 참조).
    """
    favorites = db.query(Favorite).order_by(Favorite.created_at.desc()).all()
    results = []

    for fav in favorites:
        try:
            title, price = _fetch_lowest_price(fav.product_code)
        except requests.RequestException:
            title, price = None, None

        results.append(
            FavoriteItem(
                code=fav.product_code,
                title=title,
                price=price,
                price_formatted=format_won(price) if price is not None else None,
                created_at=fav.created_at,
            )
        )

    return results


@app.delete("/favorites/{code}", status_code=204)
def remove_favorite(code: int, db: Session = Depends(get_db)):
    """DELETE /favorites/{code} → 즐겨찾기 제거 (2026-08-04 신규)"""
    favorite = db.query(Favorite).filter(Favorite.product_code == code).first()
    if favorite is None:
        raise HTTPException(status_code=404, detail="즐겨찾기에 없는 상품")

    db.delete(favorite)
    db.commit()


@app.get("/health")
def health():
    return {"status": "ok"}
