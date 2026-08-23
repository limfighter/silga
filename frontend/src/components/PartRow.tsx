import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type SearchResultItem } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { CATEGORIES, useSpecFilters } from "../lib/specFilters";

export interface SelectedPart {
  code: number;
  title: string;
  price: number | null; // 빌드 생성 화면의 러닝 총액 계산용 raw 값
  priceFormatted: string | null;
}

export default function PartRow({
  category,
  selected,
  onSelect,
  categorySelectable = false,
}: {
  category: string;
  selected: SelectedPart | null;
  onSelect: (part: SelectedPart | null) => void;
  /**
   * true면 왼쪽 카테고리 라벨이 select로 바뀌어 사용자가 직접 고른다.
   * StatsPage/FavoritesPage는 category로 "부품"/"검색"처럼 실제 카테고리가
   * 아닌 값을 넘겨서 백엔드 카테고리 필터가 통째로 무시되고 있었음 —
   * "9800X3D"를 치면 40건 중 39건이 완제품 PC로 나오던 버그(2026-08-23 수정).
   * 고른 카테고리는 검색 필터와 스펙 select를 함께 구동한다.
   */
  categorySelectable?: boolean;
}) {
  const [input, setInput] = useState("");
  const debounced = useDebouncedValue(input, 500); // 매너 크롤링 — 타건마다 호출 방지
  const [focused, setFocused] = useState(false);
  // 빈 문자열 = "전체"(카테고리 필터 없음). categorySelectable이 아니면
  // 부모가 준 category를 그대로 쓴다
  const [picked, setPicked] = useState("");
  const activeCategory = categorySelectable ? picked : category;
  const { defs: specDefs, spec, setValue, optionsFor } = useSpecFilters(activeCategory);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced, activeCategory, spec],
    queryFn: () => api.search(debounced, activeCategory || undefined, spec),
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
      {categorySelectable ? (
        <select
          className="part-cat-select"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          title="카테고리로 좁혀서 검색 — 안 좁히면 완제품 PC가 섞여 나옵니다"
        >
          <option value="">전체</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : (
        <span className="part-cat">{category}</span>
      )}

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
          {specDefs.map((def) => {
            const opts = optionsFor(def);
            return (
              <select
                key={def.specKey}
                className="part-spec-filter"
                value={String(spec[def.specKey] ?? "")}
                onChange={(e) => setValue(def.specKey, e.target.value)}
                title={def.title}
                disabled={opts.length === 0}
              >
                <option value="">
                  {opts.length === 0 ? (def.emptyPlaceholder ?? def.placeholder) : def.placeholder}
                </option>
                {opts.map((opt) => (
                  <option key={opt} value={opt}>
                    {def.formatOption ? def.formatOption(opt) : opt}
                  </option>
                ))}
              </select>
            );
          })}
        </>
      )}

      {/* 예전엔 스펙 select 개수만큼 자동완성 드롭다운의 right 오프셋을 줘서
          오른쪽 끝을 입력창에 맞췄는데, 좁은 컨테이너(.stats-picker는 560px)에서
          오프셋이 컨테이너 폭을 넘겨 폭이 음수가 되고 목록이 통째로 안 보이는
          문제가 있었음(스펙 필터가 죽은 경로였던 동안 숨어 있던 버그).
          드롭다운은 어차피 행 아래(top:52px)라 select를 가리지 않으므로
          CSS 기본값(left/right)만 쓴다 */}
      {focused && !selected && debounced.trim().length > 1 && (
        <div className="autocomplete-list">
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
              <span className="nm">
                {item.title}
                {/* 카테고리를 좁힌 상태면 전부 같은 값이라 중복 — "전체"일 때만
                    붙인다. 이때가 완제품 PC가 섞여 나오는 경우라 꼭 필요함 */}
                {!activeCategory && item.category && (
                  <span className="cat-badge">{item.category}</span>
                )}
              </span>
              <span className="pr">{item.price_formatted ?? "-"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
