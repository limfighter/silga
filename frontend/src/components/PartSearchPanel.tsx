import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type SearchResultItem, type SearchSpecParams } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { CATEGORY_SPEC_FILTERS } from "../lib/specFilters";

// BuildCreatePage 전용 마스터-디테일 검색 패널 — 왼쪽에서 고른 카테고리
// 하나에 대한 검색만 담당(패널 자체는 한 번에 하나만 렌더링됨, 기존
// PartRow처럼 카테고리마다 인라인으로 8개 반복되지 않음). PartRow는
// StatsPage/FavoritesPage/SearchPage가 계속 쓰는 별도 위젯이라 그대로 둠.
export default function PartSearchPanel({
  category,
  onPick,
  onClose,
}: {
  category: string;
  onPick: (item: SearchResultItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 500); // 매너 크롤링 — 타건마다 호출 방지
  const [specValue, setSpecValue] = useState<{ key: keyof SearchSpecParams; value: string } | null>(null);

  const specDefs = CATEGORY_SPEC_FILTERS[category] ?? [];
  const spec: SearchSpecParams | undefined = specValue
    ? { [specValue.key]: specValue.key === "memoryGb" ? Number(specValue.value) : specValue.value }
    : undefined;

  // query가 비어있어도 category 기본 목록이 바로 뜸(검색어 없이도 기본
  // 크롤링 결과를 보여주는 /search 동작을 그대로 활용 — SearchPage와 동일 패턴)
  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced, category, specValue],
    queryFn: () => api.search(debounced || undefined, category, spec),
  });

  return (
    <>
      <div className="bc-panel-header">
        <span className="bc-panel-title">{category} 검색</span>
        <button className="bc-panel-close" onClick={onClose}>✕ 닫기</button>
      </div>

      {specDefs.length > 0 && (
        <div className="bc-panel-specs">
          {specDefs.map((def) => (
            <select
              key={def.specKey}
              className="bc-spec-filter"
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
        </div>
      )}

      <input
        className="bc-search-input"
        type="text"
        placeholder={`${category} 부품을 검색하세요`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="bc-results">
        {isFetching && <div className="bc-no-results">검색 중...</div>}
        {!isFetching && data?.length === 0 && <div className="bc-no-results">결과 없음</div>}
        {data?.map((item) => (
          <div className="bc-result-row" key={item.code} onClick={() => onPick(item)}>
            {item.img ? (
              <img className="bc-thumb" src={item.img} alt="" loading="lazy" />
            ) : (
              <span className="bc-thumb bc-thumb-empty" aria-hidden="true" />
            )}
            <span className="bc-result-title">{item.title ?? `#${item.code}`}</span>
            <span className="bc-result-price">{item.price_formatted ?? "-"}</span>
          </div>
        ))}
      </div>
    </>
  );
}
