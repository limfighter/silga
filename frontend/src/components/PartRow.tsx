import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type SearchResultItem } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";

export interface SelectedPart {
  code: number;
  title: string;
  priceFormatted: string | null;
}

// GPU 메모리 용량(GB) 필터 옵션 — backend/app/main.py::GPU_MEMORY_ATTRIBUTES 키와 일치해야 함
const GPU_MEMORY_OPTIONS = [4, 6, 8, 10, 11, 12, 16, 20, 24, 32, 48];
// CPU 소켓 필터 옵션 — backend/app/main.py::CPU_SOCKET_ATTRIBUTES 키와 일치해야 함
const CPU_SOCKET_OPTIONS = ["AM5", "AM4", "LGA1851", "LGA1700"];

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
  const [memoryGb, setMemoryGb] = useState<number | undefined>(undefined);
  const [socket, setSocket] = useState<string | undefined>(undefined);
  const showMemoryFilter = category === "GPU";
  const showSocketFilter = category === "CPU";
  const showSpecFilter = showMemoryFilter || showSocketFilter;

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced, category, memoryGb, socket],
    queryFn: () => api.search(debounced, category, memoryGb, socket),
    enabled: debounced.trim().length > 1 && focused,
  });

  const handlePick = (item: SearchResultItem) => {
    onSelect({
      code: item.code,
      title: item.title ?? `#${item.code}`,
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
          {showMemoryFilter && (
            <select
              className="part-spec-filter"
              value={memoryGb ?? ""}
              onChange={(e) => setMemoryGb(e.target.value ? Number(e.target.value) : undefined)}
              title="메모리 용량으로 좁혀서 검색"
            >
              <option value="">용량 전체</option>
              {GPU_MEMORY_OPTIONS.map((gb) => (
                <option key={gb} value={gb}>
                  {gb}GB
                </option>
              ))}
            </select>
          )}
          {showSocketFilter && (
            <select
              className="part-spec-filter"
              value={socket ?? ""}
              onChange={(e) => setSocket(e.target.value || undefined)}
              title="소켓으로 좁혀서 검색"
            >
              <option value="">소켓 전체</option>
              {CPU_SOCKET_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {focused && !selected && debounced.trim().length > 1 && (
        <div className={`autocomplete-list${showSpecFilter ? " autocomplete-list--with-filter" : ""}`}>
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
