import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type SearchResultItem, type SearchSpecParams } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { CATEGORY_SPEC_FILTERS } from "../lib/specFilters";

export interface SelectedPart {
  code: number;
  title: string;
  price: number | null; // 빌드 생성 화면의 러닝 총액 계산용 raw 값
  priceFormatted: string | null;
}

// .part-spec-filter 폭(144px) + .part-row gap(14px) — 오른쪽에 붙는 select
// 개수만큼 자동완성 드롭다운 오른쪽 여백을 늘리는 데 씀
const SPEC_FILTER_SLOT_WIDTH = 158;

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
