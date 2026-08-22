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
const FORMFACTOR_OPTIONS = ["ATX", "M-ATX", "ITX", "E-ATX"];
const RAM_TYPE_OPTIONS = ["DDR5", "DDR4"];
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
  CPU: [
    { specKey: "socket", placeholder: "소켓 전체", title: "소켓으로 좁혀서 검색", options: SOCKET_OPTIONS },
  ],
  메인보드: [
    { specKey: "socket", placeholder: "소켓 전체", title: "소켓으로 좁혀서 검색", options: SOCKET_OPTIONS },
    {
      specKey: "formfactor",
      placeholder: "폼팩터 전체",
      title: "폼팩터로 좁혀서 검색",
      options: FORMFACTOR_OPTIONS,
    },
  ],
  케이스: [
    {
      specKey: "formfactor",
      placeholder: "지원 폼팩터 전체",
      title: "장착 가능한 메인보드 폼팩터로 좁혀서 검색",
      options: FORMFACTOR_OPTIONS,
    },
  ],
  RAM: [
    { specKey: "ramType", placeholder: "규격 전체", title: "DDR 규격으로 좁혀서 검색", options: RAM_TYPE_OPTIONS },
  ],
  파워: [
    { specKey: "wattage", placeholder: "출력 전체", title: "정격출력으로 좁혀서 검색", options: PSU_WATTAGE_OPTIONS },
  ],
  SSD: [
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
      return next;
    });

  // 지금 걸려 있는 조건 목록 — 라벨은 select에 표시되는 문자열(formatOption
  // 적용분)과 같은 값을 쓴다. 라벨은 필터끼리 겹칠 수 있어서 React key로는
  // specKey를 쓰라고 같이 넘김
  const activeLabels = defs
    .filter((d) => spec[d.specKey] != null)
    .map((d) => {
      const v = String(spec[d.specKey]);
      return { key: d.specKey, label: d.formatOption ? d.formatOption(v) : v };
    });

  return { defs, spec, setValue, clear: () => setSpec({}), activeLabels };
}
