import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type PriceHistory, type PricePoint } from "../lib/api";
import PartRow, { type SelectedPart } from "../components/PartRow";
import { addRecentProduct } from "../lib/recentProducts";

const MONTH_OPTIONS = [1, 3, 6, 12] as const;
type MonthOption = (typeof MONTH_OPTIONS)[number];

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 260;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 200;

function formatWon(value: number): string {
  return `${(value / 10000).toFixed(1)}만원`;
}

// full_date는 "YY-MM-DD" 포맷으로 실측 확인됨 (실가_HISTORY.md 2026-08-04
// v5 참조) — date 필드는 연도가 없어 1년 이상 차이 나는 두 시점이 같은
// 월.일로 보여 혼동될 수 있어, 있으면 항상 full_date를 우선 사용
function formatDateLabel(point: PricePoint): string {
  if (point.full_date) {
    const [yy, mm, dd] = point.full_date.split("-");
    if (yy && mm && dd) return `20${yy}.${mm}.${dd}`;
  }
  return point.date;
}

function buildPoints(history: PriceHistory): string {
  const min = Number(history.min);
  const max = Number(history.max);
  const range = Math.max(max - min, 1);
  const n = history.prices.length;

  return history.prices
    .map((p, i) => {
      const x = n <= 1 ? CHART_WIDTH / 2 : (i / (n - 1)) * CHART_WIDTH;
      const value = Number(p.price);
      const y = PLOT_TOP + (1 - (value - min) / range) * (PLOT_BOTTOM - PLOT_TOP);
      return `${x},${y}`;
    })
    .join(" ");
}

function HistoryChart({ title, selectedPrice, history }: {
  title: string;
  selectedPrice: string | null;
  history: PriceHistory;
}) {
  if (history.prices.length === 0) {
    return (
      <div className="empty-state">
        <div className="t">가격 히스토리가 없습니다</div>
        <div className="d">이 기간에는 관측된 가격 데이터가 없어요</div>
      </div>
    );
  }

  const linePoints = buildPoints(history);
  const polygonPoints = `${linePoints} ${CHART_WIDTH},${CHART_HEIGHT} 0,${CHART_HEIGHT}`;
  const first = history.prices[0];
  const last = history.prices[history.prices.length - 1];

  return (
    <div className="chart-card">
      <div className="chart-legend">
        <div className="name">
          {title}
          <span>{formatDateLabel(first)} — {formatDateLabel(last)}</span>
        </div>
        <div className="chart-stats">
          <div><span>최저</span><b className="min">{formatWon(Number(history.min))}</b></div>
          <div><span>최고</span><b className="max">{formatWon(Number(history.max))}</b></div>
          <div><span>현재</span><b style={{ color: "var(--text)" }}>{selectedPrice ?? "-"}</b></div>
        </div>
      </div>

      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" height="260" preserveAspectRatio="none">
        <defs>
          <linearGradient id="statsFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B0B0B" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0B0B0B" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g stroke="#D2CFC7" strokeWidth="1">
          <line x1="0" y1="20" x2={CHART_WIDTH} y2="20" />
          <line x1="0" y1="80" x2={CHART_WIDTH} y2="80" />
          <line x1="0" y1="140" x2={CHART_WIDTH} y2="140" />
          <line x1="0" y1="200" x2={CHART_WIDTH} y2="200" />
        </g>

        <polygon points={polygonPoints} fill="url(#statsFillGrad)" />
        <polyline points={linePoints} fill="none" stroke="#0B0B0B" strokeWidth="2" />
      </svg>
    </div>
  );
}

export default function StatsPage() {
  const location = useLocation();
  const initialSelected = (location.state as SelectedPart | null | undefined) ?? null;

  const [selected, setSelected] = useState<SelectedPart | null>(initialSelected);
  const [months, setMonths] = useState<MonthOption>(3);

  const handleSelect = (part: SelectedPart | null) => {
    setSelected(part);
    if (part) addRecentProduct(part);
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["history", selected?.code, months],
    queryFn: () => api.getHistory(selected!.code, months),
    enabled: selected !== null,
  });

  return (
    <div>
      <div className="section-label">PRICE HISTORY</div>
      <div className="build-header">
        <h2>가격 히스토리</h2>
      </div>

      <div className="stats-picker">
        <PartRow category="부품" selected={selected} onSelect={handleSelect} />
      </div>

      {selected && (
        <div className="month-tabs">
          {MONTH_OPTIONS.map((m) => (
            <button
              key={m}
              className={`month-tab${m === months ? " active" : ""}`}
              onClick={() => setMonths(m)}
            >
              {m}개월
            </button>
          ))}
        </div>
      )}

      {!selected && (
        <div className="empty-state">
          <div className="t">부품을 검색하세요</div>
          <div className="d">최근 가격 추이를 확인할 수 있어요</div>
        </div>
      )}

      {selected && isLoading && <div className="status-line">불러오는 중...</div>}
      {selected && isError && (
        <div className="status-line error">
          히스토리를 불러오지 못했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
        </div>
      )}

      {selected && data && (
        <HistoryChart title={selected.title} selectedPrice={selected.priceFormatted} history={data} />
      )}
    </div>
  );
}
