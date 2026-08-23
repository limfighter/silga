import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type PriceHistory, type PricePoint } from "../lib/api";
import PartRow, { type SelectedPart } from "../components/PartRow";
import { addRecentProduct } from "../lib/recentProducts";
import Answer, { errorMessage } from "../components/Answer";
import { manwon, signedPercent, won } from "../lib/format";

const MONTH_OPTIONS = [1, 3, 6, 12] as const;
type MonthOption = (typeof MONTH_OPTIONS)[number];

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 260;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 200;
// 격자선이 그려지는 y좌표 — y축 금액 라벨도 같은 좌표에 붙는다
const GRID_Y = [PLOT_TOP, 80, 140, PLOT_BOTTOM] as const;

// 점 2개를 이으면 무슨 값이든 완벽한 직선이 나온다 — 추세처럼 보이지만
// 추세가 아니다. 이 미만이면 꺾은선 대신 관측값을 그대로 나열한다
// (신제품이나 조회 기간이 짧을 때 실제로 생기는 상태).
const MIN_POINTS_FOR_LINE = 4;

function formatWon(value: number): string {
  return `${(value / 10000).toFixed(1)}만원`;
}

/** 직전 관측 대비 증감 — 색 대신 기호로만 구분(모노크롬 원칙) */
function deltaLabel(prev: number, curr: number): string {
  const diff = curr - prev;
  if (diff === 0) return "— 변동 없음";
  const glyph = diff > 0 ? "▲" : "▼";
  const pct = prev > 0 ? Math.abs((diff / prev) * 100) : 0;
  // 1,534,000 → 1,533,990처럼 몇 원짜리 변동은 "▼ 0.0%"가 되어 화살표와
  // 숫자가 서로 다른 말을 한다. 그런 건 퍼센트 대신 금액으로 적는다.
  if (pct < 0.05) return `${glyph} ${won(Math.abs(diff))}원`;
  return `${glyph} ${pct.toFixed(1)}%`;
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

/**
 * 관측 기록 표 — 화면에서는 기본 접힘, 눌러야 아래로 펼쳐진다.
 *
 * SVG 하나만 있으면 스크린리더 입장에서는 빈 그림 한 장이라 읽을 게 없다.
 * 홈 판정 축이 같은 문제를 .axis-list로 풀어놨는데(VerdictAxis.tsx) 이
 * 차트에만 대응이 없었음. <details>는 닫혀 있어도 접근성 트리에 남으므로
 * 화면은 안 어지럽히면서 표를 읽을 수 있다.
 */
function HistoryTable({ title, prices }: { title: string; prices: PricePoint[] }) {
  const values = prices.map((p) => Number(p.price));
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <details className="ch-table-wrap">
      <summary>데이터 표로 보기 ({prices.length}건)</summary>
      <table className="ch-table">
        <caption>{title} · 최저가 관측 기록</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">최저가</th>
            <th scope="col">직전 대비</th>
          </tr>
        </thead>
        <tbody>
          {prices.map((p, i) => {
            const value = values[i];
            // 같은 값이 여러 번 나오면 첫 번째에만 배지 — 최저/최고는 하나씩만.
            // 마지막 행이 곧 최고가인 경우가 흔해서 배지는 겹쳐 붙인다
            // (하나만 고르면 "최고"가 통째로 사라짐)
            const tags = [
              value === min && values.indexOf(min) === i ? "최저" : null,
              value === max && values.indexOf(max) === i ? "최고" : null,
              i === prices.length - 1 ? "마지막" : null,
            ].filter((t): t is string => t !== null);
            return (
              <tr key={`${p.full_date ?? p.date}-${i}`} className={tags.length ? "mark" : undefined}>
                <td>
                  {formatDateLabel(p)}
                  {tags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </td>
                <td>{won(value)}원</td>
                <td>{i === 0 ? "—" : deltaLabel(values[i - 1], value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

/** 관측이 MIN_POINTS_FOR_LINE 미만일 때 — 선 대신 값을 그대로 보여준다 */
function SparsePrices({ prices }: { prices: PricePoint[] }) {
  return (
    <>
      <div className="ch-sparse">
        {prices.map((p, i) => {
          const value = Number(p.price);
          return (
            <div key={`${p.full_date ?? p.date}-${i}`}>
              <div className="d">{formatDateLabel(p)}</div>
              <div className="v">{won(value)}원</div>
              <div className="c">
                {i === 0 ? "첫 관측" : deltaLabel(Number(prices[i - 1].price), value)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="ch-why">
        관측이 {MIN_POINTS_FOR_LINE}건 미만이면 꺾은선 대신 수치로 표시합니다.
      </p>
    </>
  );
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

  const prices = history.prices;
  const first = prices[0];
  const last = prices[prices.length - 1];
  const min = Number(history.min);
  const max = Number(history.max);
  const sparse = prices.length < MIN_POINTS_FOR_LINE;

  const linePoints = buildPoints(history);
  const polygonPoints = `${linePoints} ${CHART_WIDTH},${CHART_HEIGHT} 0,${CHART_HEIGHT}`;

  // 첫 관측 → 지금까지의 변화. 판정이 아니라 관측 구간의 사실 서술이라
  // verdict.py의 ±5% 기준과는 무관하다.
  const firstValue = Number(first.price);
  const lastValue = Number(last.price);
  const overall = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : null;
  const fromBottom = min > 0 ? ((lastValue - min) / min) * 100 : null;

  const summary = (() => {
    if (sparse) {
      return (
        <>
          관측이 {prices.length}건뿐이라 추세는 판단할 수 없습니다.
          <span className="sub">기록된 값만 그대로 표시합니다</span>
        </>
      );
    }
    if (overall == null) return null;
    const verb = overall < 0 ? "내렸" : overall > 0 ? "올랐" : "변동이 없었";
    // 현재가 최고/최저와 같으면 "바닥에서 +0.0% 올라온" 같은 말이 나온다.
    // 그 경우엔 상대 거리 대신 지금 서 있는 자리를 그대로 말한다.
    // "지금"이라고 쓰면 안 된다 — 위 legend의 "현재"는 상품의 실시간 최저가
    // (selectedPrice)이고 여기 lastValue는 마지막 주 단위 관측치라 서로 다른
    // 값이다. 한 카드 안에서 같은 이름표로 다른 숫자를 보여주면 거짓말이 됨.
    // 바닥이 곧 첫 관측이면 fromBottom과 overall이 같은 값이라
    // "+18.0% 올랐고, 바닥에서 +18.0% 올라온 자리입니다"가 된다 — 그럴 땐
    // 앞 문장이 이미 다 말했으므로 덧붙이지 않는다
    const bottomIsFirst = firstValue <= min;
    const tail =
      lastValue >= max ? (
        <> 마지막 관측이 이 구간의 최고가입니다</>
      ) : fromBottom == null || fromBottom < 0.05 ? (
        <> 마지막 관측이 이 구간의 바닥입니다</>
      ) : bottomIsFirst ? null : (
        <>
          {" "}
          마지막 관측은 바닥에서{" "}
          <span className="num">{signedPercent(fromBottom, 1)}</span> 올라온 자리입니다
        </>
      );
    return (
      <>
        이 구간에서 <span className="num">{signedPercent(overall, 1)}</span>{" "}
        {/* 뒤에 붙일 절이 있으면 연결어미("내렸고,"), 없으면 종결("내렸습니다") */}
        {tail ? `${verb}고,` : `${verb}습니다`}
        {tail}.
        {/* 최저·최고는 이미 위 legend에 있으므로 되풀이하지 않고, 대신 위
            퍼센트가 어디서 어디까지를 잰 값인지를 밝힌다 */}
        <span className="sub">
          {formatDateLabel(first)} {formatWon(firstValue)} → {formatDateLabel(last)}{" "}
          {formatWon(lastValue)}
        </span>
      </>
    );
  })();

  return (
    <div className="chart-card">
      <div className="chart-legend">
        <div className="name">
          {title}
          <span>
            {formatDateLabel(first)} — {formatDateLabel(last)} · 관측 {prices.length}건
          </span>
        </div>
        <div className="chart-stats">
          <div><span>최저</span><b className="min">{formatWon(min)}</b></div>
          <div><span>최고</span><b className="max">{formatWon(max)}</b></div>
          <div><span>현재</span><b style={{ color: "var(--text)" }}>{selectedPrice ?? "-"}</b></div>
        </div>
      </div>

      {summary && <p className="ch-summary">{summary}</p>}

      {sparse ? (
        <SparsePrices prices={prices} />
      ) : (
        // y축 금액 라벨은 SVG가 아니라 HTML로 얹는다 — 이 SVG는
        // preserveAspectRatio="none"으로 가로를 늘려 그리기 때문에
        // <text>를 안에 넣으면 글자까지 같이 늘어난다
        <div className="ch-plot">
          <div className="ch-yaxis" aria-hidden="true">
            {GRID_Y.map((y) => {
              const ratio = 1 - (y - PLOT_TOP) / (PLOT_BOTTOM - PLOT_TOP);
              return (
                <i key={y} style={{ top: y }}>
                  {/* 눈금 4줄에 "만원"을 네 번 반복하면 노이즈라 단위는 뗀다 */}
                  {((min + ratio * (max - min)) / 10000).toFixed(1)}만
                </i>
              );
            })}
          </div>
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            width="100%"
            height="260"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${title} 최저가 추이. 자세한 값은 아래 데이터 표 참조.`}
          >
            <defs>
              <linearGradient id="statsFillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B0B0B" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#0B0B0B" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g stroke="#D2CFC7" strokeWidth="1">
              {GRID_Y.map((y) => (
                <line key={y} x1="0" y1={y} x2={CHART_WIDTH} y2={y} />
              ))}
            </g>

            <polygon points={polygonPoints} fill="url(#statsFillGrad)" />
            <polyline points={linePoints} fill="none" stroke="#0B0B0B" strokeWidth="2" />
          </svg>
        </div>
      )}

      <HistoryTable title={title} prices={prices} />
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
