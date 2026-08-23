import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type PriceHistory, type PricePoint } from "../lib/api";
import PartRow, { type SelectedPart } from "../components/PartRow";
import { addRecentProduct } from "../lib/recentProducts";
import Answer, { errorMessage } from "../components/Answer";
import { manwon, won } from "../lib/format";

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

  // 평균은 서버가 주지 않아 프론트에서 계산 — min/max만 응답에 있음.
  // 다나와는 주 단위 포인트를 주므로(실가_HISTORY.md v5) 이 평균도 주 단위
  // 관측치의 산술평균이지 일 단위 평균이 아님.
  const points = data?.prices ?? [];
  const avg =
    points.length > 0
      ? Math.round(points.reduce((sum, p) => sum + Number(p.price), 0) / points.length)
      : null;
  const current = selected?.price ?? null;
  const vsAvg = avg != null && current != null && avg > 0 ? ((current - avg) / avg) * 100 : null;

  const answer = (() => {
    if (!selected) {
      return (
        <Answer
          kick="가격 이력"
          headline={
            <>
              부품을 고르면 <mark>최근 가격 추이</mark>를 봅니다
            </>
          }
          because="가격 이력은 로컬에 쌓지 않고 조회할 때마다 다나와에서 그때그때 가져옵니다"
        />
      );
    }
    if (isLoading) {
      return (
        <Answer
          state="pending"
          kick={`가격 이력 · 최근 ${months}개월`}
          headline={
            <>
              {selected.title}의 <mark>가격 이력을 가져오는 중</mark>입니다
            </>
          }
        />
      );
    }
    if (isError) {
      return (
        <Answer
          state="failed"
          kick={`가격 이력 · 최근 ${months}개월`}
          headline={
            <>
              가격 이력을 <mark>불러오지 못했습니다</mark>
            </>
          }
          because={<>{errorMessage(error)}</>}
        />
      );
    }
    if (vsAvg == null) {
      return (
        <Answer
          kick={`가격 이력 · 최근 ${months}개월`}
          headline={
            <>
              {selected.title}의 <mark>평균 대비 위치를 계산할 수 없습니다</mark>
            </>
          }
          because="현재가 또는 이력 데이터가 없어 비교 기준이 서지 않습니다"
        />
      );
    }
    return (
      <Answer
        kick={`가격 이력 · 최근 ${months}개월`}
        headline={
          <>
            지금 가격은 {months}개월 평균보다{" "}
            <mark>
              {Math.abs(vsAvg).toFixed(1)}% {vsAvg >= 0 ? "높습니다" : "낮습니다"}
            </mark>
          </>
        }
        because={
          <>
            현재 <b>{won(current!)}원</b> · 평균 <b>{won(avg!)}원</b> · 최저{" "}
            <b>{manwon(Number(data!.min))}</b> · 최고 <b>{manwon(Number(data!.max))}</b>
            <br />
            다나와는 주 단위로 가격을 주기 때문에 이 평균도 주 단위 관측치({points.length}개)의
            평균입니다
          </>
        }
      />
    );
  })();

  return (
    <div>
      {answer}

      <div className="stats-picker" style={{ marginTop: 26 }}>
        <PartRow category="부품" categorySelectable selected={selected} onSelect={handleSelect} />
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
          <div className="t">위 검색창에서 부품을 고르세요</div>
          <div className="d">즐겨찾기·최근기록에서 부품을 눌러 들어와도 됩니다</div>
        </div>
      )}

      {selected && data && (
        <HistoryChart title={selected.title} selectedPrice={selected.priceFormatted} history={data} />
      )}
    </div>
  );
}
