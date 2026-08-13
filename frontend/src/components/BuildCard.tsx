import { Link } from "react-router-dom";
import type { BuildSummary } from "../lib/api";
import { shortDate, signedPercent, verdictGlyph, won } from "../lib/format";

function tagClass(verdict: BuildSummary["verdict"]): string {
  if (verdict === "고가") return "bc-tag high";
  if (verdict === "저가") return "bc-tag low";
  if (verdict === "적정가") return "bc-tag fair";
  return "bc-tag";
}

// 홈/빌드 목록이 같은 카드를 쓰는데, 판정 근거(.bc-diff) 줄이 붙으면서
// 양쪽에 30줄씩 복붙돼 있던 걸 컴포넌트로 뺌
export default function BuildCard({
  build,
  onDelete,
}: {
  build: BuildSummary;
  onDelete: (id: number, name: string) => void;
}) {
  return (
    <Link className="build-card" to={`/build/${build.id}`}>
      {build.verdict && <span className={tagClass(build.verdict)}>{build.verdict}</span>}
      <button
        className="bc-delete"
        onClick={(e) => {
          // 카드 전체가 Link라서 둘 다 필요 — preventDefault는 Link의 네비게이션을,
          // stopPropagation은 상위로의 전파를 막음
          e.preventDefault();
          e.stopPropagation();
          onDelete(build.id, build.name);
        }}
        aria-label="빌드 삭제"
        title="빌드 삭제"
      >
        ×
      </button>
      <div className="bc-title">{build.name}</div>
      <div className="bc-meta">
        부품 {build.item_count}종 · {shortDate(build.created_at)} 저장
      </div>
      <div className="bc-price">
        {build.total_price != null ? (
          <>
            {won(build.total_price)}
            <span>원</span>
          </>
        ) : (
          "조회 실패"
        )}
      </div>
      {/* 이동평균이 즉시가로 대체된 빌드는 수치를 단정하지 않고 파선으로 표시 —
          같은 화면에서 신뢰도가 다른 숫자가 똑같이 읽히면 안 됨 */}
      {build.diff_percent != null && (
        <div className={`bc-diff${build.verdict_confidence === "low" ? " low" : ""}`}>
          기준가 대비{" "}
          <b>
            {verdictGlyph(build.verdict)} {signedPercent(build.diff_percent)}
          </b>
          {build.verdict_confidence === "low" && " · 일부 즉시가 대체"}
        </div>
      )}
    </Link>
  );
}
