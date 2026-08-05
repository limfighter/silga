import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type SearchResultItem, type SearchSpecParams } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";

export interface SelectedPart {
  code: number;
  title: string;
  price: number | null; // 빌드 생성 화면의 러닝 총액 계산용 raw 값
  priceFormatted: string | null;
}

// 아래 옵션 배열들은 backend/app/main.py의 대응 ATTRIBUTES 딕셔너리 키와
// 정확히 일치해야 함(값이 어긋나면 필터가 조용히 무시됨 — main.py 주석 참조)
const GPU_MEMORY_OPTIONS = ["4", "6", "8", "10", "11", "12", "16", "20", "24", "32", "48"];
const GPU_CHIPSET_OPTIONS = ["NVIDIA", "AMD", "Intel"];
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
const COOLER_TYPE_OPTIONS = ["CPU 쿨러", "시스템 쿨러", "VGA 쿨러", "M.2 SSD 쿨러", "써멀그리스"];

interface SpecFilterDef {
  specKey: keyof SearchSpecParams;
  placeholder: string;
  title: string;
  options: string[];
  formatOption?: (value: string) => string;
}

// 카테고리별 스펙 필터 select 구성. 같은 카테고리 안의 필터끼리는 항상
// 상호 배타(하나 고르면 나머지는 자동으로 풀림) — 백엔드가 attribute 값을
// 하나만 받을 수 있어서(다중 결합 규칙 미검증) 동시 적용이 안 되기 때문
// (backend/app/main.py::search() 참조)
const CATEGORY_SPEC_FILTERS: Record<string, SpecFilterDef[]> = {
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

// .part-spec-filter 폭(116px) + .part-row gap(14px) — 오른쪽에 붙는 select
// 개수만큼 자동완성 드롭다운 오른쪽 여백을 늘리는 데 씀
const SPEC_FILTER_SLOT_WIDTH = 130;

export default function PartRow({
  category,
  selected,
  onSelect,
}: {
  category: string;
  selected: SelectedPart | null;
  onSelect: (part: SelectedPart | null) => void;
}) {
  const [input, setInput] = useState("");
  const debounced = useDebouncedValue(input, 500); // 매너 크롤링 — 타건마다 호출 방지
  const [focused, setFocused] = useState(false);
  const [specValue, setSpecValue] = useState<{ key: keyof SearchSpecParams; value: string } | null>(null);

  const specDefs = CATEGORY_SPEC_FILTERS[category] ?? [];
  const spec: SearchSpecParams | undefined = specValue
    ? { [specValue.key]: specValue.key === "memoryGb" ? Number(specValue.value) : specValue.value }
    : undefined;

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced, category, specValue],
    queryFn: () => api.search(debounced, category, spec),
    enabled: debounced.trim().length > 1 && focused,
  });

  const handlePick = (item: SearchResultItem) => {
    onSelect({
      code: item.code,
      title: item.title ?? `#${item.code}`,
      price: item.price,
      priceFormatted: item.price_formatted,
    });
    setInput("");
    setFocused(false);
  };

  return (
    <div className="part-row">
      <span className="part-cat">{category}</span>

      {selected ? (
        <div
          className="part-selected"
          onClick={() => {
            onSelect(null);
            setFocused(true);
          }}
          title="클릭하면 다시 검색할 수 있어요"
        >
          <span className="nm">{selected.title}</span>
          <span className="pr">{selected.priceFormatted ?? "-"}</span>
        </div>
      ) : (
        <>
          <input
            className="part-input"
            type="text"
            placeholder="부품을 검색하세요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
          />
          {specDefs.map((def) => (
            <select
              key={def.specKey}
              className="part-spec-filter"
              value={specValue?.key === def.specKey ? specValue.value : ""}
              onChange={(e) =>
                setSpecValue(e.target.value ? { key: def.specKey, value: e.target.value } : null)
              }
              title={def.title}
            >
              <option value="">{def.placeholder}</option>
              {def.options.map((opt) => (
                <option key={opt} value={opt}>
                  {def.formatOption ? def.formatOption(opt) : opt}
                </option>
              ))}
            </select>
          ))}
        </>
      )}

      {focused && !selected && debounced.trim().length > 1 && (
        <div
          className="autocomplete-list"
          style={specDefs.length > 0 ? { right: 16 + specDefs.length * SPEC_FILTER_SLOT_WIDTH } : undefined}
        >
          {isFetching && <div className="autocomplete-item" style={{ pointerEvents: "none" }}>검색 중...</div>}
          {!isFetching && data?.length === 0 && (
            <div className="autocomplete-item" style={{ pointerEvents: "none" }}>결과 없음</div>
          )}
          {data?.slice(0, 8).map((item) => (
            <div
              key={item.code}
              className="autocomplete-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(item)}
            >
              <span className="nm">{item.title}</span>
              <span className="pr">{item.price_formatted ?? "-"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
