import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SearchResultItem, type SearchSpecParams } from "../lib/api";
import { CATEGORIES, CATEGORY_SPEC_FILTERS } from "../lib/specFilters";
import type { SelectedPart } from "../components/PartRow";
import { addRecentProduct } from "../lib/recentProducts";

type SortKey = "popular" | "low" | "high";

// 인기상품순은 API가 준 순서 그대로(다나와 정렬 기준 위임), 가격순은
// 프론트에서 재정렬. 가격 조회 실패(price null) 상품은 정렬 기준이 없어
// 항상 맨 뒤로 보냄.
function sortResults(items: SearchResultItem[], sort: SortKey): SearchResultItem[] {
  if (sort === "popular") return items;
  const priced = items.filter((i) => i.price != null);
  const unpriced = items.filter((i) => i.price == null);
  priced.sort((a, b) => (sort === "low" ? a.price! - b.price! : b.price! - a.price!));
  return [...priced, ...unpriced];
}

export default function SearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [specValue, setSpecValue] = useState<{ key: keyof SearchSpecParams; value: string } | null>(null);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [cart, setCart] = useState<Record<string, SelectedPart | null>>(
    Object.fromEntries(CATEGORIES.map((c) => [c, null]))
  );
  const [buildName, setBuildName] = useState("");

  const specDefs = CATEGORY_SPEC_FILTERS[category] ?? [];
  const spec: SearchSpecParams | undefined = specValue
    ? { [specValue.key]: specValue.key === "memoryGb" ? Number(specValue.value) : specValue.value }
    : undefined;

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["search", query, category, specValue],
    queryFn: () => api.search(query, category, spec),
    enabled: query.length > 0,
  });

  const results = useMemo(() => sortResults(data ?? [], sort), [data, sort]);

  const submit = () => setQuery(input.trim());

  const cartCount = CATEGORIES.filter((c) => cart[c]).length;

  const mutation = useMutation({
    mutationFn: api.createBuild,
    onSuccess: (build) => {
      queryClient.invalidateQueries({ queryKey: ["builds"] });
      navigate(`/build/${build.id}`);
    },
  });

  const handleAdd = (item: SearchResultItem) => {
    const part: SelectedPart = {
      code: item.code,
      title: item.title ?? `#${item.code}`,
      price: item.price,
      priceFormatted: item.price_formatted,
    };
    setCart((prev) => ({ ...prev, [category]: part }));
    addRecentProduct(part);
  };

  const handleRemove = (c: string) => setCart((prev) => ({ ...prev, [c]: null }));

  const handleSave = () => {
    const items = CATEGORIES.filter((c) => cart[c]).map((c) => ({ category: c, code: cart[c]!.code }));
    mutation.mutate({ name: buildName.trim(), items });
  };

  return (
    <div>
      <div className="section-label">REAL-TIME SCAN</div>
      <div className="build-header">
        <h2>부품 검색</h2>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`category-tab${c === category ? " active" : ""}`}
            onClick={() => {
              setCategory(c);
              setSpecValue(null);
            }}
          >
            {c}
            {cart[c] && <i className="ct-dot" />}
          </button>
        ))}
      </div>

      <div className="search-shell">
        <div className="search-main">
          <div className="search-box">
            <input
              type="text"
              placeholder={`${category} 검색어를 입력하세요 (예: RTX 5070 Ti 16GB)`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button className="btn-primary" onClick={submit}>검색</button>
          </div>

          {specDefs.length > 0 && (
            <div className="search-spec-filters">
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
            </div>
          )}

          {query.length === 0 && (
            <div className="empty-state">
              <div className="t">검색어를 입력하세요</div>
              <div className="d">다나와 실시간 최저가 기준 · {category} 카테고리</div>
            </div>
          )}

          {isFetching && <div className="status-line">검색 중...</div>}
          {isError && (
            <div className="status-line error">
              검색 실패: {error instanceof Error ? error.message : "알 수 없는 오류"}
            </div>
          )}
          {data && data.length === 0 && !isFetching && (
            <div className="status-line">검색 결과가 없습니다.</div>
          )}

          {results.length > 0 && (
            <>
              <div className="sort-tabs">
                <button
                  className={`sort-tab${sort === "popular" ? " active" : ""}`}
                  onClick={() => setSort("popular")}
                >
                  인기상품순
                </button>
                <button
                  className={`sort-tab${sort === "low" ? " active" : ""}`}
                  onClick={() => setSort("low")}
                >
                  낮은가격순
                </button>
                <button
                  className={`sort-tab${sort === "high" ? " active" : ""}`}
                  onClick={() => setSort("high")}
                >
                  높은가격순
                </button>
              </div>

              <div className="search-results">
                {results.map((item) => {
                  const isInCart = cart[category]?.code === item.code;
                  return (
                    <div className="search-result-row" key={item.code}>
                      <span className="nm">
                        {item.title ?? "(제목 없음)"}
                        <span className="code">#{item.code}</span>
                      </span>
                      <span className="pr">{item.price_formatted ?? "-"}</span>
                      <button className={`btn-cart${isInCart ? " on" : ""}`} onClick={() => handleAdd(item)}>
                        {isInCart ? "담음" : "담기"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="cart-panel">
          <div className="cart-head">
            <span className="cart-title">견적 카트</span>
            <span className="cart-count">담은 부품 {cartCount}개</span>
          </div>

          <div className="cart-list">
            {CATEGORIES.map((c) => (
              <div key={c} className={`cart-slot${cart[c] ? " filled" : ""}${c === category ? " current" : ""}`}>
                <button className="cs-select" onClick={() => setCategory(c)}>
                  <span className="cs-cat">{c}</span>
                  {cart[c] ? (
                    <span className="cs-part">{cart[c]!.title}</span>
                  ) : (
                    <span className="cs-empty">미선택</span>
                  )}
                </button>
                {cart[c] && (
                  <button className="cs-remove" onClick={() => handleRemove(c)} aria-label={`${c} 담기 취소`}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {cartCount > 0 && (
            <div className="cart-actions">
              <input
                type="text"
                placeholder="빌드 이름"
                value={buildName}
                onChange={(e) => setBuildName(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={buildName.trim().length === 0 || mutation.isPending}
                onClick={handleSave}
              >
                {mutation.isPending ? "저장 중..." : "이 구성으로 빌드 만들기"}
              </button>
              {mutation.isError && (
                <p className="status-line error" style={{ marginTop: 8, marginBottom: 0 }}>
                  저장 실패: {mutation.error instanceof Error ? mutation.error.message : "알 수 없는 오류"}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
