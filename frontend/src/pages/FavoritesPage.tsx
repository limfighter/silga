import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type FavoriteItem } from "../lib/api";
import PartRow, { type SelectedPart } from "../components/PartRow";

function formatAddedAt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FavoritesPage() {
  const queryClient = useQueryClient();

  // PartRow는 여기서 selected를 항상 null로 두고 재사용(선택 즉시 추가 후
  // 다시 검색 상태로 돌아옴) — pickerKey를 바꿔 매 선택 후 강제 remount해서
  // 내부 focused 상태를 초기화함. PartRow.handlePick()이 선택 시
  // setFocused(false)를 호출하는데, 다른 화면(빌드생성/통계)은 재검색을
  // .part-selected 클릭으로 시작해서 그 클릭 핸들러가 setFocused(true)로
  // 되돌려주지만, 여기는 selected가 항상 null이라 .part-selected 자체가
  // 렌더링되지 않아 그 경로가 없음 — remount로 우회 (2026-08-04 실측 발견)
  const [pickerKey, setPickerKey] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["favorites"],
    queryFn: api.listFavorites,
  });

  const addMutation = useMutation({
    mutationFn: (code: number) => api.addFavorite(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (code: number) => api.removeFavorite(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const handleSelect = (part: SelectedPart | null) => {
    if (part) {
      addMutation.mutate(part.code);
      setPickerKey((k) => k + 1);
    }
  };

  const handleRemove = (code: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeMutation.mutate(code);
  };

  const items: FavoriteItem[] = data ?? [];

  return (
    <div>
      <div className="section-label">SAVED PARTS</div>
      <div className="build-header">
        <h2>즐겨찾기</h2>
      </div>

      <div className="stats-picker">
        <PartRow key={pickerKey} category="검색" selected={null} onSelect={handleSelect} />
      </div>

      {addMutation.isError && (
        <div className="status-line error">
          추가 실패: {addMutation.error instanceof Error ? addMutation.error.message : "알 수 없는 오류"}
        </div>
      )}

      {isLoading && <div className="status-line">불러오는 중...</div>}
      {isError && (
        <div className="status-line error">
          즐겨찾기를 불러오지 못했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="empty-state">
          <div className="t">즐겨찾기한 부품이 없어요</div>
          <div className="d">위에서 부품을 검색해 추가해보세요</div>
        </div>
      )}

      {items.length > 0 && (
        <div className="recent-list">
          {items.map((item) => (
            <Link
              className="recent-row"
              to="/stats"
              state={{ code: item.code, title: item.title, priceFormatted: item.price_formatted }}
              key={item.code}
            >
              <span className="nm">
                {item.title ?? `#${item.code}`}
                <span className="code">#{item.code}</span>
              </span>
              <span className="time">{formatAddedAt(item.created_at)}</span>
              <span className="pr">{item.price_formatted ?? "-"}</span>
              <button
                className="remove"
                onClick={(e) => handleRemove(item.code, e)}
                title="즐겨찾기에서 제거"
                aria-label="즐겨찾기에서 제거"
              >
                ×
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
