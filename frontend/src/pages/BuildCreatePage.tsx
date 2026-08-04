import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import PartRow, { type SelectedPart } from "../components/PartRow";
import { useMaWindow } from "../lib/settings";
import { addRecentProduct } from "../lib/recentProducts";

const CATEGORIES = ["CPU", "GPU", "메인보드", "RAM", "SSD", "케이스", "파워", "쿨러"];

export default function BuildCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [maWindow] = useMaWindow();

  const [name, setName] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [parts, setParts] = useState<Record<string, SelectedPart | null>>(
    Object.fromEntries(CATEGORIES.map((c) => [c, null]))
  );

  const mutation = useMutation({
    mutationFn: api.createBuild,
    onSuccess: (build) => {
      queryClient.invalidateQueries({ queryKey: ["builds"] });
      navigate(`/build/${build.id}`);
    },
  });

  const selectedCount = Object.values(parts).filter(Boolean).length;
  const canSubmit = name.trim().length > 0 && selectedCount > 0 && !mutation.isPending;

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
      <div className="detail-head">
        <Link className="btn-ghost" to="/build">← 목록으로</Link>
      </div>

      <div className="form-shell">
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
            {CATEGORIES.map((category) => (
              <PartRow
                key={category}
                category={category}
                selected={parts[category]}
                onSelect={(part) => {
                  setParts((prev) => ({ ...prev, [category]: part }));
                  if (part) addRecentProduct(part);
                }}
              />
            ))}
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
            저장 후 판정은 {maWindow}일 이동평균 기준가로 계산됩니다 (설정
            탭에서 변경 가능).
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
      </div>
    </div>
  );
}
