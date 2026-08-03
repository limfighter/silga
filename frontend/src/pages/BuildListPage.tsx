import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type BuildSummary } from "../lib/api";

function tagClass(verdict: BuildSummary["verdict"]): string {
  if (verdict === "고가") return "bc-tag high";
  if (verdict === "저가") return "bc-tag low";
  if (verdict === "적정가") return "bc-tag fair";
  return "bc-tag";
}

export default function BuildListPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["builds"],
    queryFn: api.listBuilds,
  });

  return (
    <div>
      <div className="build-header">
        <h2>내 빌드</h2>
        <Link className="btn-primary" to="/build/new">+ 새 빌드</Link>
      </div>

      {isLoading && <div className="status-line">불러오는 중...</div>}
      {isError && (
        <div className="status-line error">
          목록을 불러오지 못했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
        </div>
      )}

      <div className="build-grid">
        {data?.map((build) => (
          <Link className="build-card" to={`/build/${build.id}`} key={build.id}>
            {build.verdict && <span className={tagClass(build.verdict)}>{build.verdict}</span>}
            <div className="bc-title">{build.name}</div>
            <div className="bc-meta">부품 {build.item_count}종</div>
            <div className="bc-price">
              {build.total_price_formatted ?? "계산 중..."}
            </div>
          </Link>
        ))}

        <Link className="build-card new" to="/build/new">
          <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          새 빌드 만들기
        </Link>
      </div>
    </div>
  );
}
