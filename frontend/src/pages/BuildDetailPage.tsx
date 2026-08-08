import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type BuildDetail, type BuildItemDetail } from "../lib/api";
import { useMaWindow } from "../lib/settings";

// 게이지 위치 매핑: diff_percent를 -GAUGE_RANGE~+GAUGE_RANGE 구간으로 클램프해서
// 바 위 0~100% 위치로 선형 매핑 (범위 자체는 REFERENCE.md에 수치가 없어 임의로 잡은
// 시각화용 가정값). 적정가 음영 구간은 services/verdict.py의 VERDICT_THRESHOLD_PERCENT(±5%)를
// 그대로 반영.
const GAUGE_RANGE = 30;
const VERDICT_THRESHOLD_PERCENT = 5;

function markerPosition(diffPercent: number | null): number {
  if (diffPercent === null) return 50;
  const clamped = Math.max(-GAUGE_RANGE, Math.min(GAUGE_RANGE, diffPercent));
  return ((clamped + GAUGE_RANGE) / (GAUGE_RANGE * 2)) * 100;
}

const ZONE_LEFT = ((-VERDICT_THRESHOLD_PERCENT + GAUGE_RANGE) / (GAUGE_RANGE * 2)) * 100;
const ZONE_WIDTH = ((VERDICT_THRESHOLD_PERCENT * 2) / (GAUGE_RANGE * 2)) * 100;

// 부품을 기능 단위로 묶어서 스펙시트처럼 읽히게 함. 여기 없는 카테고리는
// 맨 아래 "기타"로 모임 — 카테고리가 늘어나도 누락되지 않게.
const PART_GROUPS: { label: string; categories: string[] }[] = [
  { label: "연산부", categories: ["CPU", "메인보드", "쿨러"] },
  { label: "그래픽", categories: ["GPU"] },
  { label: "메모리 · 저장", categories: ["RAM", "SSD"] },
  { label: "섀시 · 전원", categories: ["케이스", "파워"] },
];

function groupItems(items: BuildItemDetail[]): { label: string; items: BuildItemDetail[] }[] {
  const used = new Set<BuildItemDetail>();
  const groups = PART_GROUPS.map((g) => {
    const matched = items.filter((it) => g.categories.includes(it.category));
    matched.forEach((it) => used.add(it));
    return { label: g.label, items: matched };
  }).filter((g) => g.items.length > 0);

  const rest = items.filter((it) => !used.has(it));
  if (rest.length > 0) groups.push({ label: "기타", items: rest });
  return groups;
}

function manwon(value: number): string {
  return `${(value / 10000).toFixed(1)}만원`;
}

function verdictTagClass(verdict: string | null): string {
  if (verdict === "고가") return "verdict-tag high";
  if (verdict === "저가") return "verdict-tag low";
  return "verdict-tag";
}

export default function BuildDetailPage() {
  const { id } = useParams<{ id: string }>();
  const buildId = Number(id);
  const [maWindow] = useMaWindow();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["build", buildId, maWindow],
    queryFn: () => api.getBuild(buildId, maWindow),
    enabled: Number.isFinite(buildId),
  });

  if (isLoading) return <div className="status-line">불러오는 중...</div>;
  if (isError || !data) {
    return (
      <div className="status-line error">
        빌드를 불러오지 못했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
      </div>
    );
  }

  return <BuildDetailView data={data} />;
}

// 데이터가 도착한 뒤에 마운트되므로, 여기서 잡는 mounted 플래그가 곧
// "값이 확정된 시점"이 됨 — 비중 바/리빌 애니메이션의 시작점으로 씀
function BuildDetailView({ data }: { data: BuildDetail }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const markerPos = markerPosition(data.diff_percent);
  const groups = groupItems(data.items);

  // market_price(비교 판매가)를 입력 안 한 빌드는 즉시가를 이동평균
  // 기준가와 비교해서 판정함(2026-08-08 결정) — 그 경우 우측 비교값은
  // market_price가 아니라 verdict_basis_price가 됨
  const hasMarketPrice = data.market_price != null;
  const compareLabel = hasMarketPrice ? "비교 판매가" : `최근 ${data.ma_window ?? "N"}일 평균가`;
  const compareValue = hasMarketPrice ? data.market_price! : data.verdict_basis_price;

  // 이동평균이 무효라 즉시가로 대체된 부품 — 판정 신뢰도를 부품 단위로
  // 드러내기 위해 code로 조회할 수 있게 Set으로 만들어둠
  const fallbackCodes = new Set(
    data.verdict_basis_breakdown.filter((b) => b.source === "current_fallback").map((b) => b.code)
  );

  const priced = data.items.filter((it) => it.price != null);
  const topItem = priced.reduce<BuildItemDetail | null>(
    (max, it) => (max === null || it.price! > max.price! ? it : max),
    null
  );
  const missingCount = data.items.length - priced.length;

  let rowIndex = 0;

  return (
    <div>
      <div className="section-label">BUILD DETAIL</div>
      <div className="detail-head">
        <Link className="btn-ghost" to="/build">← 목록으로</Link>
        <h2>{data.name}</h2>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={() => window.print()}>
          견적서 인쇄
        </button>
      </div>

      <div className="strip">
        <div className="st">
          <p className="st-k">부품 구성</p>
          <p className="st-v">
            {data.items.length}종
            {missingCount > 0 && <em>{missingCount}종 가격 조회 실패</em>}
          </p>
        </div>
        <div className="st">
          <p className="st-k">최고가 부품</p>
          <p className="st-v">
            {topItem ? topItem.category : "—"}
            {topItem && (
              <em>
                {manwon(topItem.price!)} · 전체의{" "}
                {((topItem.price! / data.total_price) * 100).toFixed(0)}%
              </em>
            )}
          </p>
        </div>
        <div className="st">
          <p className="st-k">판정 기준</p>
          <p className="st-v">
            {data.ma_window != null ? `${data.ma_window}일 이동평균` : "—"}
            {data.verdict_confidence === "low" && <em>일부 부품 즉시가 대체</em>}
            {data.verdict_confidence === "high" && <em>전 부품 이동평균 적용</em>}
          </p>
        </div>
        <div className="st">
          <p className="st-k">판정</p>
          <p className="st-v">
            {data.verdict ?? "—"}
            {data.verdict == null && <em>가격 조회 실패로 판정 불가</em>}
            {data.diff_percent != null && (
              <em>
                {data.diff_percent > 0 ? "+" : ""}
                {data.diff_percent}% vs {data.market_price != null ? "판매가" : "평균가"}
              </em>
            )}
          </p>
        </div>
      </div>

      <div className="total-row">
        <div>
          <p className="total-label">실측 합계</p>
          <p className="total-num">
            {data.total_price.toLocaleString()}<span>원</span>
          </p>
        </div>
        <p className="total-meta">
          다나와 실시간 최저가 기준
          <br />
          {new Date(data.created_at).toLocaleDateString("ko-KR")} 저장
          {data.verdict_basis_price_formatted && (
            <>
              <br />
              판정 기준가 {data.verdict_basis_price_formatted}
            </>
          )}
        </p>
      </div>

      {data.diff_percent != null && compareValue != null && (
        <div className="gauge-card" style={{ marginBottom: 40 }}>
          <div className="confirm-row">
            <div className="confirm-col">
              <p className="confirm-k">실측 합계</p>
              <p className="confirm-num">
                {data.total_price.toLocaleString()}<span>원</span>
              </p>
            </div>
            <div className="confirm-arrow">→</div>
            <div className="confirm-col">
              <p className="confirm-k">{compareLabel}</p>
              <p className="confirm-num">
                {compareValue.toLocaleString()}<span>원</span>
              </p>
            </div>
          </div>

          <p className={`diff-badge${data.diff_percent < 0 ? " dn" : ""}`}>
            {data.diff_percent > 0 ? "▲" : data.diff_percent < 0 ? "▼" : "—"}{" "}
            {Math.abs(compareValue - data.total_price).toLocaleString()}원 ·{" "}
            {data.diff_percent > 0 ? "+" : ""}
            {data.diff_percent}%
          </p>

          <div className="gauge-track">
            <div className="gauge-zone" style={{ left: `${ZONE_LEFT}%`, width: `${ZONE_WIDTH}%` }} />
            <div className="gauge-marker" style={{ left: `${mounted ? markerPos : 50}%` }} />
            {data.diff_percent != null && (
              <span className="gauge-marker-value" style={{ left: `${mounted ? markerPos : 50}%` }}>
                {data.diff_percent > 0 ? "+" : ""}
                {data.diff_percent}%
              </span>
            )}
          </div>
          <div className="gauge-labels">
            <span>저가</span>
            <span>적정 ±{VERDICT_THRESHOLD_PERCENT}%</span>
            <span>고가</span>
          </div>

          {data.verdict && <div className={verdictTagClass(data.verdict)} style={{ marginTop: 18 }}>{data.verdict} 판정</div>}
        </div>
      )}

      <div className="sec-head">
        <h3 className="sec-title">부품 구성</h3>
        <span className="sec-note">실시간 최저가 기준 · 단위 : 원</span>
      </div>

      {groups.map((group) => (
        <div key={group.label}>
          <p className="grp">{group.label}</p>
          <div className="spec-row-container">
          {group.items.map((item) => {
            const share = item.price != null ? (item.price / data.total_price) * 100 : 0;
            const delay = `${Math.min(rowIndex++, 12) * 45}ms`;
            return (
              <div
                className={`spec-row rv${mounted ? " in" : ""}`}
                key={`${item.category}-${item.code}`}
                style={{ transitionDelay: delay }}
              >
                <span className="spec-cat">{item.category}</span>
                <div>
                  <p className="spec-name">{item.title ?? `#${item.code}`}</p>
                  <p className="spec-desc">
                    #{item.code}
                    {item.price != null && ` · 전체의 ${share.toFixed(1)}%`}
                    {fallbackCodes.has(item.code) && (
                      <span className="fallback"> · 판정에 즉시가 대체 적용</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className={`spec-price${item.price == null ? " missing" : ""}`}>
                    {item.price != null ? manwon(item.price) : "조회 실패"}
                  </p>
                  {item.price != null && (
                    <p className="prop-bar">
                      <i style={{ width: mounted ? `${share}%` : 0, transitionDelay: delay }} />
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ))}

      <div className="sum">
        <span className="sum-k">실측 합계</span>
        <span className="sum-val">{data.total_price_formatted}</span>
      </div>
    </div>
  );
}
