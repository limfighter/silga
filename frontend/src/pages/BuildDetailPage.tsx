import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
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

  const markerPos = markerPosition(data.diff_percent);

  return (
    <div>
      <div className="section-label">BUILD DETAIL</div>
      <div className="detail-head">
        <Link className="btn-ghost" to="/build">← 목록으로</Link>
        <h2>{data.name}</h2>
      </div>

      <div className="verdict">
        <div className="gauge-card">
          {data.verdict ? (
            <div className={verdictTagClass(data.verdict)}>{data.verdict} 판정</div>
          ) : (
            <div className="verdict-tag">비교 판매가 없음</div>
          )}
          <div className="price">{data.total_price_formatted}</div>
          {data.market_price != null && (
            <div className="price-range">
              판매가 {data.market_price.toLocaleString()}원
              {data.diff_percent != null && ` (${data.diff_percent > 0 ? "+" : ""}${data.diff_percent}%)`}
            </div>
          )}
          {data.ma_window != null && (
            <div className="verdict-basis-note">
              판정 기준: {data.ma_window}일 이동평균
              {data.verdict_confidence === "low" && " · 일부 부품은 데이터 부족으로 즉시가 대체"}
            </div>
          )}

          <div className="gauge-track">
            <div className="gauge-zone" style={{ left: `${ZONE_LEFT}%`, width: `${ZONE_WIDTH}%` }} />
            <div className="gauge-marker" style={{ left: `${markerPos}%` }} />
          </div>
          <div className="gauge-labels">
            <span>저가</span>
            <span>적정</span>
            <span>고가</span>
          </div>
        </div>

        <div className="breakdown">
          {data.items.map((item, i) => (
            <div className="b-row" key={i}>
              <span className="part"><b>{item.category}</b> · {item.title ?? `#${item.code}`}</span>
              <span className="val">{item.price != null ? `${(item.price / 10000).toFixed(1)}만원` : "가격 정보 없음"}</span>
            </div>
          ))}
          <div className="b-row total">
            <span className="part">실측 합계</span>
            <span className="val">{data.total_price_formatted}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
