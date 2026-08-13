import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getRecentProducts,
  removeRecentProduct,
  clearRecentProducts,
  type RecentProduct,
} from "../lib/recentProducts";
import Answer from "../components/Answer";

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
      <Answer
        kick="최근기록"
        headline={
          items.length > 0 ? (
            <>
              이 브라우저에 남은 조회 <mark>{items.length}건</mark>
            </>
          ) : (
            <>
              이 브라우저에 남은 조회가 <mark>없습니다</mark>
            </>
          )
        }
        because={
          <>
            서버에 저장하지 않습니다 — 브라우저를 바꾸면 목록도 달라집니다
            <br />
            통계 탭과 빌드 생성 화면에서 부품을 고를 때 자동으로 쌓입니다
          </>
        }
        actions={
          items.length > 0 ? (
            <button className="btn-ghost" onClick={handleClearAll}>전체 비우기</button>
          ) : undefined
        }
      />

      {items.length === 0 && (
        <div className="empty-state" style={{ marginTop: 26 }}>
          <div className="t">통계 탭이나 빌드 생성 화면에서 부품을 검색해보세요</div>
          <div className="d">조회한 부품이 여기에 자동으로 쌓입니다</div>
        </div>
      )}

      {items.length > 0 && (
        <div className="recent-list" style={{ marginTop: 26 }}>
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
