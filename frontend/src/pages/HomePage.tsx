import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type BuildSummary } from "../lib/api";
import { useMaWindow } from "../lib/settings";

const RECENT_BUILD_COUNT = 4;

function tagClass(verdict: BuildSummary["verdict"]): string {
  if (verdict === "고가") return "bc-tag high";
  if (verdict === "저가") return "bc-tag low";
  if (verdict === "적정가") return "bc-tag fair";
  return "bc-tag";
}

export default function HomePage() {
  const [maWindow] = useMaWindow();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["builds", maWindow],
    queryFn: () => api.listBuilds(maWindow),
  });

  const recentBuilds = data
    ? [...data]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, RECENT_BUILD_COUNT)
    : [];

  return (
    <div>
      <div className="section-label">DASHBOARD</div>
      <div className="build-header">
        <h2>홈</h2>
      </div>

      <div className="home-actions">
        <Link className="btn-primary" to="/build/new">+ 새 빌드 만들기</Link>
        <Link className="btn-ghost" to="/search">부품 검색</Link>
      </div>

      <div className="build-header" style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 18 }}>최근 빌드</h2>
        {data && data.length > 0 && (
          <Link className="btn-ghost" to="/build">전체보기</Link>
        )}
      </div>

      {isLoading && <div className="status-line">불러오는 중...</div>}
      {isError && (
        <div className="status-line error">
          빌드를 불러오지 못했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="empty-state">
          <div className="t">아직 저장된 빌드가 없어요</div>
          <div className="d">새 빌드를 만들어서 가격을 추적해보세요</div>
        </div>
      )}

      {recentBuilds.length > 0 && (
        <div className="build-grid">
          {recentBuilds.map((build) => (
            <Link className="build-card" to={`/build/${build.id}`} key={build.id}>
              {build.verdict && <span className={tagClass(build.verdict)}>{build.verdict}</span>}
              <div className="bc-title">{build.name}</div>
              <div className="bc-meta">부품 {build.item_count}종</div>
              <div className="bc-price">{build.total_price_formatted ?? "계산 중..."}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
