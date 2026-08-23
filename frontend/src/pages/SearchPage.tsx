import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SearchResultItem } from "../lib/api";
import { CATEGORIES, useSpecFilters } from "../lib/specFilters";
import type { SelectedPart } from "../components/PartRow";
import { addRecentProduct } from "../lib/recentProducts";
import Answer, { errorMessage } from "../components/Answer";
import { manwon, won } from "../lib/format";

type SortKey = "popular" | "low" | "high";

// 다나와 검색 결과는 한 페이지 40건이 상한(limit 파라미터로는 못 늘리고
// &page=N으로만 넘길 수 있음 — 2026-08-22/23 실측). 40건이 꽉 차서 왔다는
// 건 다음 페이지가 있다는 뜻이라 "더 보기"를 띄우는 기준으로도 쓴다.
const PAGE_LIMIT = 40;

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
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [cart, setCart] = useState<Record<string, SelectedPart | null>>(
    Object.fromEntries(CATEGORIES.map((c) => [c, null]))
  );
  const [buildName, setBuildName] = useState("");

  // 같은 카테고리의 스펙 필터를 동시에 걸 수 있음(백엔드가 AND로 결합).
  // 카테고리 전환 시 조건 초기화도 훅이 처리함
  const { defs: specDefs, spec, setValue, clear, activeLabels } = useSpecFilters(category);

  // q가 비어 있으면 백엔드가 category 기본 키워드로 대신 검색 — 검색 버튼을
  // 안 눌러도 카테고리 선택만으로 기본 목록이 뜨도록 하기 위함
  // 페이지를 눌러서 더 받는 구조라 무한 쿼리 — 자동 무한스크롤은 쓰지 않는다
  // (사용자가 누를 때만 다나와에 추가 요청이 나가도록, 매너 크롤링 원칙)
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["search", query, category, spec],
      queryFn: ({ pageParam }) => api.search(query || undefined, category, spec, pageParam),
      initialPageParam: 1,
      // 마지막 페이지가 40건을 꽉 채웠으면 다음 페이지가 있다고 본다
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length >= PAGE_LIMIT ? allPages.length + 1 : undefined,
    });

  // 정렬은 지금까지 받아온 전체를 대상으로 — 페이지별로 따로 정렬하면
  // "낮은가격순"이 페이지 안에서만 맞는 이상한 목록이 된다
  const loaded = useMemo(() => (data?.pages ?? []).flat(), [data]);
  const results = useMemo(() => sortResults(loaded, sort), [loaded, sort]);

  const submit = () => setQuery(input.trim());

  const cartCount = CATEGORIES.filter((c) => cart[c]).length;
  // 저장 전에도 "지금까지 얼마"가 보여야 함 — 가격을 못 가져온 부품은
  // 합계에서 빠지므로 개수를 따로 표기
  const cartTotal = CATEGORIES.reduce((sum, c) => sum + (cart[c]?.price ?? 0), 0);
  const cartUnpriced = CATEGORIES.filter((c) => cart[c] && cart[c]!.price == null).length;

  const pricedResults = results.filter((r) => r.price != null);
  const priceLow = pricedResults.length > 0 ? Math.min(...pricedResults.map((r) => r.price!)) : null;
  const priceHigh = pricedResults.length > 0 ? Math.max(...pricedResults.map((r) => r.price!)) : null;

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

  // 걸려 있는 조건을 결론 블록 근거 줄에 그대로 노출 — 별도 칩 UI를 만들지
  // 않고 .because(이미 모노스페이스)에 얹는다
  const condLine =
    activeLabels.length > 0 ? (
      <>
        {" "}
        · 조건{" "}
        {activeLabels.map((c) => (
          <span className="cond" key={c.key}>
            {c.label}
          </span>
        ))}
      </>
    ) : null;

  const answer = (() => {
    const cartLine =
      cartCount > 0 ? (
        <>
          <br />
          담은 부품 <b>{cartCount}개</b> · 지금까지 <b>{won(cartTotal)}원</b>
        </>
      ) : null;

    if (isLoading) {
      return (
        <Answer
          state="pending"
          kick={`부품 검색 · ${category}`}
          headline={
            <>
              {category} <mark>목록을 불러오는 중</mark>입니다
            </>
          }
          because={<>다나와 실시간 최저가 조회{condLine}{cartLine}</>}
        />
      );
    }
    if (isError) {
      return (
        <Answer
          state="failed"
          kick={`부품 검색 · ${category}`}
          headline={
            <>
              검색에 <mark>실패했습니다</mark>
            </>
          }
          because={<>{errorMessage(error)}</>}
        />
      );
    }
    if (results.length === 0) {
      return (
        <Answer
          kick={`부품 검색 · ${category}`}
          headline={
            <>
              조건에 맞는 {category}가 <mark>없습니다</mark>
            </>
          }
          because={
            <>
              검색어나 스펙 필터를 줄여보세요{condLine}{cartLine}
            </>
          }
          actions={
            activeLabels.length > 0 ? (
              <button className="spec-clear" onClick={clear}>
                조건 지우기
              </button>
            ) : undefined
          }
        />
      );
    }
    return (
      <Answer
        kick={`부품 검색 · ${category}`}
        headline={
          <>
            {category} <mark>
              {results.length}건{hasNextPage ? "+" : ""}
            </mark>
            {priceLow != null && priceHigh != null && (
              <>
                {" "}
                · {manwon(priceLow)} ~ {manwon(priceHigh)}
              </>
            )}
          </>
        }
        because={
          <>
            다나와 실시간 최저가 ·{" "}
            {sort === "popular" ? "인기상품순" : sort === "low" ? "낮은가격순" : "높은가격순"}
            {query.length === 0 && ` · 검색어 없이 ${category} 기본 목록`}
            {condLine}
            {hasNextPage && " · 아래 \"더 보기\"로 다음 40건을 불러올 수 있습니다"}
            {cartLine}
          </>
        }
      />
    );
  })();

  return (
    <div>
      {answer}

      <div className="category-tabs" style={{ marginTop: 26 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`category-tab${c === category ? " active" : ""}`}
            onClick={() => setCategory(c)}
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
                  value={String(spec[def.specKey] ?? "")}
                  onChange={(e) => setValue(def.specKey, e.target.value)}
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
              {activeLabels.length > 0 && (
                <button className="spec-clear" onClick={clear}>조건 지우기</button>
              )}
            </div>
          )}

          {isLoading && <div className="status-line">검색 중...</div>}

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
                      {item.img ? (
                        <img className="thumb" src={item.img} alt="" loading="lazy" />
                      ) : (
                        <span className="thumb thumb-empty" aria-hidden="true" />
                      )}
                      {/* 이 화면은 카테고리 탭으로 항상 좁혀져 있어서 결과의
                          카테고리가 전부 같음 — 배지를 붙이면 중복 정보인 데다
                          제목을 밀어내서 잘림. 배지는 카테고리를 안 고를 수
                          있는 PartRow 자동완성에서만 쓴다 */}
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

              {hasNextPage && (
                <button
                  className="btn-more"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
                </button>
              )}
            </>
          )}
        </div>

        <aside className="cart-panel">
          <div className="cart-head">
            <span className="cart-title">견적 카트</span>
            <span className="cart-count">{cartCount} / {CATEGORIES.length}</span>
          </div>

          {/* 슬롯 목록을 끝까지 훑지 않아도 몇 칸이 찼는지 보이게 */}
          <div className="bs-ticks">
            {CATEGORIES.map((c) => (
              <i key={c} className={`bs-tick${cart[c] ? " on" : ""}`} title={c} />
            ))}
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
            <div className="cart-sum">
              <span className="cart-sum-k">지금까지</span>
              <span className="cart-sum-val">
                {won(cartTotal)}원
                {cartUnpriced > 0 && <em>{cartUnpriced}종 가격 미조회</em>}
              </span>
            </div>
          )}

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
