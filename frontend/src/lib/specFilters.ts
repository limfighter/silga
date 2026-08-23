import { useEffect, useState } from "react";
import type { SearchSpecParams } from "./api";

// 빌드 구성 카테고리 8종 — backend/app/main.py CATEGORY_LABELS 키와 정확히
// 일치해야 함. SearchPage(부품 검색 탭)와 BuildCreatePage(빌드 생성)가
// 공유하는 단일 소스 — 여기서만 바뀌면 양쪽 다 반영됨.
export const CATEGORIES = ["CPU", "GPU", "메인보드", "RAM", "SSD", "케이스", "파워", "쿨러"];

// 아래 옵션 배열들은 backend/app/main.py의 대응 ATTRIBUTES 딕셔너리 키와
// 정확히 일치해야 함(값이 어긋나면 필터가 조용히 무시됨 — main.py 주석 참조)
const GPU_MEMORY_OPTIONS = ["4", "6", "8", "10", "11", "12", "16", "20", "24", "32", "48"];
const GPU_CHIPSET_OPTIONS = ["NVIDIA", "AMD", "Intel"];
// 칩셋 모델 — 제조사를 고르면 그 제조사 것만 보여준다. 다나와도 제조사별로
// 필터 그룹이 갈려 있고(NVIDIA 658 / AMD 657 / 인텔 338008), 백엔드는
// GPU_CHIP_ATTRIBUTES 한 딕셔너리로 합쳐서 받으므로 여기서는 "무엇을
// 보여줄지"만 정하면 된다. 키는 GPU_CHIPSET_OPTIONS 값과 일치해야 함
const GPU_CHIP_BY_MAKER: Record<string, string[]> = {
  NVIDIA: [
    "RTX 5090",
    "RTX 5080",
    "RTX 5070 Ti",
    "RTX 5070",
    "RTX 5060 Ti",
    "RTX 5060",
    "RTX 5050",
    "RTX 4080 SUPER",
    "RTX 4070 Ti",
    "RTX 4070 SUPER",
    "RTX 4070",
    "RTX 4060 Ti",
    "RTX 4060",
  ],
  AMD: [
    "RX 9070 XT",
    "RX 9070 GRE",
    "RX 9070",
    "RX 9060 XT",
    "RX 9060",
    "RX 7900 XTX",
    "RX 7800 XT",
    "RX 7700 XT",
    "RX 7600 XT",
    "RX 7600",
  ],
  Intel: ["ARC PRO B70", "ARC B580"],
};
const GPU_LENGTH_OPTIONS = [
  "190~199mm",
  "260~269mm",
  "280~289mm",
  "300~309mm",
  "320~329mm",
  "340~349mm",
  "360mm~",
];
const SOCKET_OPTIONS = ["AM5", "AM4", "LGA1851", "LGA1700"];
const CPU_TYPE_OPTIONS = [
  "코어 울트라9",
  "코어 울트라7",
  "코어 울트라5",
  "코어i9",
  "코어i7",
  "코어i5",
  "코어i3",
  "라이젠9",
  "라이젠7",
  "라이젠5",
  "라이젠3",
];
const IGPU_OPTIONS = ["탑재", "미탑재"];
const RAM_CAPACITY_OPTIONS = ["8GB", "16GB", "32GB", "48GB", "64GB"];
const RAM_COUNT_OPTIONS = ["1개", "2개", "4개"];
const SSD_CAPACITY_OPTIONS = ["256GB~130GB", "525GB~270GB", "1TB~600GB", "2TB~1.1TB", "4TB~3TB"];
const PSU_EFFICIENCY_OPTIONS = [
  "80 PLUS 티타늄",
  "80 PLUS 플래티넘",
  "80 PLUS 골드",
  "80 PLUS 실버",
  "80 PLUS 브론즈",
  "80 PLUS 스탠다드",
];
const CASE_SIZE_OPTIONS = ["빅타워", "미들타워", "미니타워", "미니ITX"];
// 케이스가 "받아주는" 최대치 — GPU의 length(카드 자체 길이), 쿨러의 height
// (쿨러 자체 높이)와 반대편 축이라 이름을 max_로 시작함
const CASE_MAX_VGA_LENGTH_OPTIONS = [
  "270~289mm", "290~309mm", "310~329mm", "330~349mm",
  "350~369mm", "370~399mm", "400mm~",
];
const CASE_MAX_COOLER_HEIGHT_OPTIONS = [
  "119mm 이하", "130~139mm", "140~149mm", "150~159mm", "160~169mm",
  "170~179mm", "180~189mm", "190~199mm", "200mm 이상",
];
const PSU_CABLE_OPTIONS = ["풀모듈러", "세미모듈러", "케이블일체형"];
const PSU_FORMFACTOR_OPTIONS = ["ATX", "M-ATX(SFX)", "TFX"];
const COOLER_COOLING_OPTIONS = ["공랭", "수랭"];
const COOLER_HEIGHT_OPTIONS = [
  "75~99mm", "100~124mm", "125~149mm", "150~159mm",
  "160~169mm", "170~199mm", "200mm~",
];
// 메인보드 세부 칩셋 — 채택 소켓 4종에 대응하는 현행 유통 칩셋만(소켓 순서로 정렬)
const MAINBOARD_CHIPSET_OPTIONS = [
  "X870E", "X870", "B850", "B840", "X670E", "X670", "B650E", "B650", "A620",
  "X570", "B550", "A520", "B450",
  "Z890", "B860", "H810",
  "Z790", "B760", "H610",
];
const FORMFACTOR_OPTIONS = ["ATX", "M-ATX", "ITX", "E-ATX"];
const RAM_TYPE_OPTIONS = ["DDR5", "DDR4"];
const RAM_DEVICE_OPTIONS = ["데스크탑용", "노트북용", "서버용"];
const PSU_WATTAGE_OPTIONS = [
  "450W~499W",
  "500W~599W",
  "600W~699W",
  "700W~799W",
  "800W~899W",
  "900W~999W",
  "1000W~1299W",
];
const SSD_INTERFACE_OPTIONS = ["SATA3", "PCIe3.0x4", "PCIe4.0x4", "PCIe5.0x4"];
const SSD_FORMFACTOR_OPTIONS = ["M.2 2280", "M.2 2242", "M.2 2230", "2.5인치"];
const COOLER_TYPE_OPTIONS = ["CPU 쿨러", "시스템 쿨러", "VGA 쿨러", "M.2 SSD 쿨러", "써멀그리스"];

export interface SpecFilterDef {
  specKey: keyof SearchSpecParams;
  placeholder: string;
  title: string;
  options: string[];
  formatOption?: (value: string) => string;
  /**
   * 다른 select의 선택값에 따라 목록이 바뀌는 경우 그 select의 키.
   * 지금은 GPU 칩셋 모델 하나뿐 — 제조사를 골라야 목록이 정해진다.
   * 부모 값이 바뀌면 이 select 값은 무효가 되므로 useSpecFilters가 비운다.
   */
  dependsOn?: keyof SearchSpecParams;
  /** dependsOn 값 → 보여줄 목록. 없는 값이면 빈 목록(= select 비활성) */
  optionsBy?: Record<string, string[]>;
  /** dependsOn이 아직 안 골라졌을 때 보여줄 문구 */
  emptyPlaceholder?: string;
}

// 카테고리별 스펙 필터 select 구성. 같은 카테고리 안의 필터는 동시에 걸 수
// 있음 — 백엔드가 서로 다른 속성코드를 콤마로 이어 다나와에 AND로 넘긴다
// (backend/app/main.py::search() 참조). backend v0.12까지는 attribute 값을
// 하나만 보낼 수 있어서 select끼리 상호 배타였음.
// select 상태 관리는 아래 useSpecFilters()가 담당하고, SearchPage /
// PartSearchPanel / PartRow가 이 정의와 훅을 함께 공유함.
export const CATEGORY_SPEC_FILTERS: Record<string, SpecFilterDef[]> = {
  GPU: [
    {
      specKey: "chipset",
      placeholder: "제조사 전체",
      title: "칩셋 제조사로 좁혀서 검색",
      options: GPU_CHIPSET_OPTIONS,
    },
    {
      specKey: "gpuChip",
      placeholder: "칩셋 전체",
      title: "칩셋 모델로 좁혀서 검색 — 제조사를 먼저 고르면 그 제조사 칩셋만 나옵니다",
      options: [],
      dependsOn: "chipset",
      optionsBy: GPU_CHIP_BY_MAKER,
      emptyPlaceholder: "제조사 먼저",
    },
    {
      specKey: "memoryGb",
      placeholder: "용량 전체",
      title: "메모리 용량으로 좁혀서 검색",
      options: GPU_MEMORY_OPTIONS,
      formatOption: (v) => `${v}GB`,
    },
    {
      specKey: "length",
      placeholder: "길이 전체",
      title: "카드 가로 길이로 좁혀서 검색(케이스 장착 호환성 참고용)",
      options: GPU_LENGTH_OPTIONS,
    },
  ],
  // CPU는 등급(종류)부터 좁히는 게 소켓보다 실구매 기준에 가까워서 종류를
  // 앞에 둔다 — 둘은 서로 다른 속성이라 동시 적용됨(AND)
  CPU: [
    {
      specKey: "cpuType",
      placeholder: "종류 전체",
      title: "CPU 등급(종류)으로 좁혀서 검색",
      options: CPU_TYPE_OPTIONS,
    },
    { specKey: "socket", placeholder: "소켓 전체", title: "소켓으로 좁혀서 검색", options: SOCKET_OPTIONS },
    {
      specKey: "igpu",
      placeholder: "내장그래픽 전체",
      // 고른 뒤 닫힌 select에는 값만 남아서 "탑재"만 보이면 무슨 탑재인지
      // 알 수 없음 — 조건 칩에도 같은 문자열이 쓰이므로 항목명을 붙여둔다
      title: "내장그래픽 유무로 좁혀서 검색(별도 GPU 없이 조립할 때 필수 조건)",
      options: IGPU_OPTIONS,
      formatOption: (v) => `내장그래픽 ${v}`,
    },
  ],
  메인보드: [
    { specKey: "socket", placeholder: "소켓 전체", title: "소켓으로 좁혀서 검색", options: SOCKET_OPTIONS },
    {
      // GPU와 같은 chipset 파라미터를 쓰지만 값은 완전히 다름(GPU=제조사,
      // 메인보드=칩셋 모델) — 백엔드도 카테고리별로 다른 딕셔너리를 봄
      specKey: "chipset",
      placeholder: "칩셋 전체",
      title: "세부 칩셋으로 좁혀서 검색(같은 소켓이라도 칩셋에 따라 가격대가 갈림)",
      options: MAINBOARD_CHIPSET_OPTIONS,
    },
    {
      specKey: "formfactor",
      placeholder: "폼팩터 전체",
      title: "폼팩터로 좁혀서 검색",
      options: FORMFACTOR_OPTIONS,
    },
  ],
  케이스: [
    {
      // formfactor(장착 가능한 보드 크기)와는 다른 축 — 이쪽은 케이스 자체의
      // 크기 등급이라 둘 다 동시에 걸 수 있음
      specKey: "caseSize",
      placeholder: "크기 전체",
      title: "케이스 크기로 좁혀서 검색",
      options: CASE_SIZE_OPTIONS,
    },
    {
      specKey: "formfactor",
      placeholder: "지원 폼팩터 전체",
      title: "장착 가능한 메인보드 폼팩터로 좁혀서 검색",
      options: FORMFACTOR_OPTIONS,
    },
    {
      specKey: "maxVgaLength",
      placeholder: "VGA 길이 전체",
      title: "받아주는 최대 그래픽카드 길이로 좁혀서 검색",
      options: CASE_MAX_VGA_LENGTH_OPTIONS,
    },
    {
      specKey: "maxCoolerHeight",
      placeholder: "쿨러 높이 전체",
      title: "받아주는 최대 CPU 쿨러 높이로 좁혀서 검색(쿨러 탭의 '높이'와 맞춰볼 것)",
      options: CASE_MAX_COOLER_HEIGHT_OPTIONS,
    },
  ],
  RAM: [
    { specKey: "ramType", placeholder: "규격 전체", title: "DDR 규격으로 좁혀서 검색", options: RAM_TYPE_OPTIONS },
    {
      // 편의가 아니라 정확성 — 안 걸면 노트북용(SO-DIMM)과 서버용(ECC/REG)이
      // 데스크탑 검색에 섞여 나온다(DDR5 40건 중 2건 실측). 그게 빌드에 담기면
      // 합계·판정이 통째로 틀어지므로 규격 바로 다음에 둔다
      specKey: "ramDevice",
      placeholder: "사용 장치 전체",
      title: "사용 장치로 좁혀서 검색 — 안 고르면 노트북용·서버용이 섞여 나옵니다",
      options: RAM_DEVICE_OPTIONS,
    },
    {
      specKey: "capacity",
      placeholder: "용량 전체",
      title: "패키지 총 용량으로 좁혀서 검색(모듈 1개당 용량이 아님)",
      options: RAM_CAPACITY_OPTIONS,
    },
    {
      specKey: "ramCount",
      placeholder: "개수 전체",
      title: "구성 모듈 개수로 좁혀서 검색 — 용량과 같이 걸면 32GB 1개인지 16GBx2인지 구분됨",
      options: RAM_COUNT_OPTIONS,
      formatOption: (v) => `램 ${v}`,
    },
  ],
  파워: [
    { specKey: "wattage", placeholder: "출력 전체", title: "정격출력으로 좁혀서 검색", options: PSU_WATTAGE_OPTIONS },
    {
      specKey: "efficiency",
      placeholder: "인증 전체",
      title: "80PLUS 인증 등급으로 좁혀서 검색(같은 출력이라도 등급이 가격을 가름)",
      options: PSU_EFFICIENCY_OPTIONS,
    },
    {
      specKey: "cableType",
      placeholder: "케이블 전체",
      title: "케이블 연결 방식으로 좁혀서 검색(같은 출력·등급이어도 가격을 가름)",
      options: PSU_CABLE_OPTIONS,
    },
    {
      // 케이스/메인보드/SSD와 같은 formfactor 키를 쓰지만 카테고리마다
      // 딕셔너리가 따로라 값이 섞이지 않음 — 여기선 파워 자체의 규격
      specKey: "formfactor",
      placeholder: "규격 전체",
      title: "파워 규격으로 좁혀서 검색(케이스의 지원파워규격과 맞춰볼 것)",
      options: PSU_FORMFACTOR_OPTIONS,
    },
  ],
  SSD: [
    {
      // SSD는 용량이 가격을 가장 크게 가르는 축이라 인터페이스/폼팩터보다 앞
      specKey: "capacity",
      placeholder: "용량 전체",
      title: "용량 구간으로 좁혀서 검색",
      options: SSD_CAPACITY_OPTIONS,
    },
    {
      specKey: "interface",
      placeholder: "인터페이스",
      title: "인터페이스로 좁혀서 검색",
      options: SSD_INTERFACE_OPTIONS,
    },
    {
      specKey: "formfactor",
      placeholder: "폼팩터 전체",
      title: "폼팩터로 좁혀서 검색",
      options: SSD_FORMFACTOR_OPTIONS,
    },
  ],
  // 쿨러는 다나와 "쿨러/튜닝" 카테고리에 CPU 쿨러·케이스팬·써멀그리스·조명기기가
  // 다 섞여 있어서 제품 종류를 먼저 두고, 소켓은 CPU/메인보드와 같은 파라미터·
  // 같은 값 목록을 쓰되 다나와 내부 코드만 쿨러 전용으로 따로 실측한 것
  // (backend/app/main.py::COOLER_SOCKET_ATTRIBUTES 참조)
  쿨러: [
    {
      specKey: "coolerType",
      placeholder: "종류 전체",
      title: "제품 종류로 좁혀서 검색",
      options: COOLER_TYPE_OPTIONS,
    },
    {
      specKey: "socket",
      placeholder: "소켓 전체",
      title: "지원하는 CPU 소켓으로 좁혀서 검색",
      options: SOCKET_OPTIONS,
    },
    {
      // coolerType("어디에 붙이는 쿨러냐")과는 다른 축이라 동시에 걸 수 있음
      specKey: "cooling",
      placeholder: "냉각 전체",
      title: "냉각 방식(공랭/수랭)으로 좁혀서 검색",
      options: COOLER_COOLING_OPTIONS,
    },
    {
      specKey: "height",
      placeholder: "높이 전체",
      title: "쿨러 자체 높이로 좁혀서 검색(케이스 탭의 '쿨러 높이'와 맞춰볼 것)",
      options: COOLER_HEIGHT_OPTIONS,
    },
  ],
};

/**
 * 스펙 필터 select들의 상태. 같은 로직이 SearchPage / PartSearchPanel /
 * PartRow에 3벌로 복붙돼 있던 것을 하나로 모은 것 — memoryGb만 number로
 * 캐스팅해야 하는 예외도 여기 한 곳에만 둔다.
 *
 * 반환하는 spec 객체를 그대로 api.search()에 넘기면 됨. 여러 키가 채워져
 * 있으면 백엔드가 전부 AND로 결합한다.
 */
export function useSpecFilters(category: string) {
  const [spec, setSpec] = useState<SearchSpecParams>({});
  const defs = CATEGORY_SPEC_FILTERS[category] ?? [];

  // 카테고리를 바꾸면 이전 카테고리 조건은 버린다(GPU에서 칩셋을 걸어둔 채
  // CPU 탭으로 넘어가면 그 값은 CPU에서 의미가 없고 백엔드에서도 무시됨)
  useEffect(() => setSpec({}), [category]);

  const setValue = (key: keyof SearchSpecParams, raw: string) =>
    setSpec((prev) => {
      const next = { ...prev };
      if (!raw) delete next[key];
      else if (key === "memoryGb") next.memoryGb = Number(raw);
      else next[key] = raw;
      // 이 값에 딸린 select(예: 제조사→칩셋 모델)는 목록이 통째로 바뀌므로
      // 기존 선택이 남아 있으면 안 됨 — NVIDIA에서 고른 RTX가 AMD로 바꾼
      // 뒤에도 남아 있으면 검색 결과가 0건이 된다
      for (const d of defs) if (d.dependsOn === key) delete next[d.specKey];
      return next;
    });

  /** 그 select가 지금 보여줘야 할 목록 — 의존 select가 비었으면 빈 배열 */
  const optionsFor = (def: SpecFilterDef): string[] => {
    if (!def.dependsOn) return def.options;
    const parent = spec[def.dependsOn];
    return (parent != null && def.optionsBy?.[String(parent)]) || [];
  };

  // 지금 걸려 있는 조건 목록 — 라벨은 select에 표시되는 문자열(formatOption
  // 적용분)과 같은 값을 쓴다. 라벨은 필터끼리 겹칠 수 있어서 React key로는
  // specKey를 쓰라고 같이 넘김
  const activeLabels = defs
    .filter((d) => spec[d.specKey] != null)
    .map((d) => {
      const v = String(spec[d.specKey]);
      return { key: d.specKey, label: d.formatOption ? d.formatOption(v) : v };
    });

  return { defs, spec, setValue, clear: () => setSpec({}), activeLabels, optionsFor };
}
