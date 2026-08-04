import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getRecentProducts,
  removeRecentProduct,
  clearRecentProducts,
  type RecentProduct,
} from "../lib/recentProducts";

function formatViewedAt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecentHistoryPage() {
  const [items, setItems] = useState<RecentProduct[]>(() => getRecentProducts());

  const handleRemove = (code: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setItems(removeRecentProduct(code));
  };

  const handleClearAll = () => {
    clearRecentProducts();
    setItems([]);
  };

  return (
    <div>
      <div className="build-header">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>최근기록</h2>
        {items.length > 0 && (
          <button className="btn-ghost" onClick={handleClearAll}>전체 지우기</button>
        )}
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          <div className="t">최근 조회한 부품이 없어요</div>
          <div className="d">통계 탭이나 빌드 생성 화면에서 부품을 검색해보세요</div>
        </div>
      )}

      {items.length > 0 && (
        <div className="recent-list">
          {items.map((item) => (
            <Link
              className="recent-row"
              to="/stats"
              state={{ code: item.code, title: item.title, priceFormatted: item.priceFormatted }}
              key={item.code}
            >
              <span className="nm">
                {item.title}
                <span className="code">#{item.code}</span>
              </span>
              <span className="time">{formatViewedAt(item.viewedAt)}</span>
              <span className="pr">{item.priceFormatted ?? "-"}</span>
              <button
                className="remove"
                onClick={(e) => handleRemove(item.code, e)}
                title="기록에서 삭제"
                aria-label="기록에서 삭제"
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
