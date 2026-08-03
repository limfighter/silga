import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

// 게이지 각도 매핑: diff_percent를 -30%~+30% 구간으로 클램프해서 -80deg~+80deg에 선형 매핑.
// (임계값과 마찬가지로 REFERENCE.md에 수치가 없어 임의로 잡은 시각화용 가정값)
function needleAngle(diffPercent: number | null): number {
  if (diffPercent === null) return -6; // market_price 없을 때 목업 기본값 그대로
  const clamped = Math.max(-30, Math.min(30, diffPercent));
  return (clamped / 30) * 80;
}

function verdictTagClass(verdict: string | null): string {
  if (verdict === "고가") return "verdict-tag high";
  if (verdict === "저가") return "verdict-tag low";
  return "verdict-tag";
}

export default function BuildDetailPage() {
  const { id } = useParams<{ id: string }>();
  const buildId = Number(id);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["build", buildId],
    queryFn: () => api.getBuild(buildId),
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

  const angle = needleAngle(data.diff_percent);

  return (
    <div>
      <div className="detail-head">
        <Link className="btn-ghost" to="/build">← 목록으로</Link>
        <h2>{data.name}</h2>
      </div>

      <div className="verdict">
        <div className="gauge-card">
          <svg viewBox="0 0 340 200" width="100%">
            <path d="M 20 170 A 150 150 0 0 1 121 34" fill="none" stroke="#5eead4" strokeWidth="16" strokeLinecap="round" opacity="0.85" />
            <path d="M 121 34 A 150 150 0 0 1 219 34" fill="none" stroke="#f2f3f5" strokeWidth="16" strokeLinecap="round" opacity="0.5" />
            <path d="M 219 34 A 150 150 0 0 1 320 170" fill="none" stroke="#ff3b6e" strokeWidth="16" strokeLinecap="round" opacity="0.85" />
            <g className="needle" style={{ transform: `rotate(${angle}deg)`, transition: "transform 1s cubic-bezier(.2,.9,.25,1)" }}>
              <line x1="170" y1="170" x2="170" y2="42" stroke="#5eead4" strokeWidth="3" />
              <circle cx="170" cy="170" r="9" fill="#5eead4" />
            </g>
            <text x="30" y="196" fill="#8b8f97" fontFamily="JetBrains Mono" fontSize="11">저가</text>
            <text x="152" y="24" fill="#8b8f97" fontFamily="JetBrains Mono" fontSize="11">적정</text>
            <text x="284" y="196" fill="#8b8f97" fontFamily="JetBrains Mono" fontSize="11">고가</text>
          </svg>

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
