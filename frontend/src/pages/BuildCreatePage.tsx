import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SearchResultItem } from "../lib/api";
import { type SelectedPart } from "../components/PartRow";
import PartSearchPanel from "../components/PartSearchPanel";
import { useMaWindow } from "../lib/settings";
import { addRecentProduct } from "../lib/recentProducts";
import { CATEGORIES } from "../lib/specFilters";

export default function BuildCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [maWindow] = useMaWindow();

  const [name, setName] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [parts, setParts] = useState<Record<string, SelectedPart | null>>(
    Object.fromEntries(CATEGORIES.map((c) => [c, null]))
  );
  // 왼쪽에서 고른 카테고리 하나만 오른쪽 패널에서 검색 — 마스터-디테일 레이아웃
  // (기존엔 8개 행 전부가 각자 검색창+자동완성을 인라인으로 들고 있었음)
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: api.createBuild,
    onSuccess: (build) => {
      queryClient.invalidateQueries({ queryKey: ["builds"] });
      navigate(`/build/${build.id}`);
    },
  });

  const selectedParts = CATEGORIES.map((c) => parts[c]).filter(
    (p): p is SelectedPart => p != null
  );
  const selectedCount = selectedParts.length;
  const canSubmit = name.trim().length > 0 && selectedCount > 0 && !mutation.isPending;

  // 러닝 총액 — 저장 전에도 "지금 담은 것까지 얼마"를 바로 보여줌.
  // 가격을 못 가져온 부품(price=null)은 합계에서 빠지므로 개수를 따로 표기.
  const runningTotal = selectedParts.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const unpricedCount = selectedParts.filter((p) => p.price == null).length;

  // 부품을 고르면 자동으로 다음 미선택 카테고리로 넘어감(전부 채워지면 패널 닫힘)
  const handlePick = (category: string, item: SearchResultItem) => {
    const part: SelectedPart = {
      code: item.code,
      title: item.title ?? `#${item.code}`,
      price: item.price,
      priceFormatted: item.price_formatted,
    };
    const nextParts = { ...parts, [category]: part };
    setParts(nextParts);
    addRecentProduct(part);
    setActiveCategory(CATEGORIES.find((c) => !nextParts[c]) ?? null);
  };

  const handleSubmit = () => {
    const items = CATEGORIES.filter((c) => parts[c]).map((c) => ({
      category: c,
      code: parts[c]!.code,
    }));

    mutation.mutate({
      name: name.trim(),
      market_price: marketPrice ? Number(marketPrice.replace(/[^0-9]/g, "")) : undefined,
      items,
    });
  };

  return (
    <div>
      <div className="section-label">NEW BUILD</div>
      <div className="detail-head">
        <Link className="btn-ghost" to="/build">← 목록으로</Link>
        <h2>새 빌드 만들기</h2>
      </div>

      <div className="bc-shell">
        <div className="bc-left">
          <div className="field">
            <label>빌드 이름</label>
            <input
              type="text"
              placeholder="예: 5070 Ti 조합"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <label>부품 구성</label>
            <div className="part-rows">
              {CATEGORIES.map((category) => {
                const part = parts[category];
                return (
                  <div
                    key={category}
                    className={`bc-row${activeCategory === category ? " active" : ""}`}
                    onClick={() => setActiveCategory(category)}
                  >
                    <span className="part-cat">{category}</span>
                    <span className={`bc-row-text${part ? " filled" : ""}`}>
                      {part ? part.title : "부품을 검색하세요"}
                    </span>
                    {part && <span className="bc-row-price">{part.priceFormatted ?? "-"}</span>}
                    <span className="bc-row-chevron">›</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label>비교할 판매가 (선택)</label>
            <input
              type="text"
              placeholder="예: 3,464,000"
              value={marketPrice}
              onChange={(e) => setMarketPrice(e.target.value)}
            />
            <div className="field-hint">
              비워두면 즉시가를 {maWindow}일 이동평균 기준가와 비교해서 자동
              판정합니다. 완제품 판매가를 아는 경우에만 입력하세요(설정
              탭에서 이동평균 기간 변경 가능).
            </div>
          </div>

          {mutation.isError && (
            <div className="status-line error">
              저장 실패: {mutation.error instanceof Error ? mutation.error.message : "알 수 없는 오류"}
            </div>
          )}

          <div className="form-actions">
            <Link className="btn-ghost" to="/build">취소</Link>
            <button className="btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
              {mutation.isPending ? "분석 중..." : "분석하기"}
            </button>
          </div>

          <div className="build-summary">
            <div className="bs-progress">
              <span className="bs-k">구성</span>
              <span className="bs-count">{selectedCount} / {CATEGORIES.length}</span>
              <span className="bs-ticks">
                {CATEGORIES.map((c) => (
                  <i key={c} className={`bs-tick${parts[c] ? " on" : ""}`} title={c} />
                ))}
              </span>
            </div>
            <div className="bs-total">
              <span className="bs-k">현재 합계</span>
              <span className="v">
                {runningTotal > 0 ? `${runningTotal.toLocaleString()}원` : "—"}
                {unpricedCount > 0 && (
                  <em style={{ fontStyle: "normal", fontSize: 11, color: "var(--mute-dk)", marginLeft: 8 }}>
                    {unpricedCount}종 가격 미조회
                  </em>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="bc-panel">
          {activeCategory ? (
            <PartSearchPanel
              key={activeCategory}
              category={activeCategory}
              onPick={(item) => handlePick(activeCategory, item)}
              onClose={() => setActiveCategory(null)}
            />
          ) : (
            <div className="bc-empty-panel">
              왼쪽에서 부품 카테고리를 선택하면
              <br />
              검색 결과가 여기 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
