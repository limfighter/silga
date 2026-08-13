import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type FavoriteItem } from "../lib/api";
import PartRow, { type SelectedPart } from "../components/PartRow";
import Answer, { errorMessage } from "../components/Answer";
import { manwon, won } from "../lib/format";

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

  // 가격은 목록을 열 때마다 다시 조회하므로 여기 합계도 매번 새 값 —
  // 저장된 스냅샷이 아님(DB에 price_history 테이블을 두지 않는 설계)
  const pricedItems = items.filter((it) => it.price != null);
  const total = pricedItems.reduce((sum, it) => sum + it.price!, 0);
  const failedCount = items.length - pricedItems.length;
  const topItem = pricedItems.reduce<FavoriteItem | null>(
    (max, it) => (max === null || it.price! > max.price! ? it : max),
    null
  );

  const answer = isLoading ? (
    <Answer
      state="pending"
      kick="즐겨찾기"
      headline={
        <>
          관심 부품의 <mark>지금 가격을 조회하는 중</mark>입니다
        </>
      }
      because="즐겨찾기는 상품코드만 저장합니다 — 가격은 목록을 열 때마다 다시 조회합니다"
    />
  ) : isError ? (
    <Answer
      state="failed"
      kick="즐겨찾기"
      headline={
        <>
          목록을 <mark>불러오지 못했습니다</mark>
        </>
      }
      because={<>{errorMessage(error)}</>}
    />
  ) : items.length === 0 ? (
    <Answer
      kick="즐겨찾기"
      headline={
        <>
          등록한 관심 부품이 <mark>아직 없습니다</mark>
        </>
      }
      because="아래에서 부품을 검색해 추가하면, 열 때마다 최신 최저가로 다시 조회합니다"
    />
  ) : (
    <Answer
      kick="즐겨찾기"
      headline={
        <>
          관심 부품 <mark>{items.length}종</mark> · 합계 {won(total)}원
        </>
      }
      because={
        <>
          가격은 목록을 열 때마다 다시 조회합니다 — 저장된 값이 아닙니다
          {failedCount > 0 && (
            <>
              <br />
              <b>{failedCount}종</b>은 지금 가격을 가져오지 못해 합계에서 빠졌습니다
            </>
          )}
        </>
      }
    />
  );

  return (
    <div>
      {answer}

      {items.length > 0 && (
        <div className="strip">
          <div className="st">
            <p className="st-k">등록 부품</p>
            <p className="st-v">{items.length}종</p>
            <p className="st-s">최대 제한 없음</p>
          </div>
          <div className="st">
            <p className="st-k">합계</p>
            <p className="st-v">{won(total)}원</p>
            <p className="st-s">{manwon(total)} · 즉시 최저가</p>
          </div>
          <div className="st">
            <p className="st-k">최고가</p>
            <p className="st-v">{topItem ? (topItem.title ?? `#${topItem.code}`) : "—"}</p>
            <p className="st-s">{topItem ? `${won(topItem.price!)}원` : "가격 조회 실패"}</p>
          </div>
          <div className="st">
            <p className="st-k">조회 실패</p>
            <p className="st-v">{failedCount}종</p>
            <p className="st-s">{failedCount === 0 ? "전부 정상" : "합계에서 제외됨"}</p>
          </div>
        </div>
      )}

      <div className="stats-picker" style={{ marginTop: 26 }}>
        <PartRow key={pickerKey} category="검색" selected={null} onSelect={handleSelect} />
      </div>

      {addMutation.isError && (
        <div className="status-line error">추가 실패: {errorMessage(addMutation.error)}</div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="empty-state">
          <div className="t">위 검색창에서 부품을 찾아 추가하세요</div>
          <div className="d">추가한 부품은 열 때마다 최신 최저가로 다시 조회됩니다</div>
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
