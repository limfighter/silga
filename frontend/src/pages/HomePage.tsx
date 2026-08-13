import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useMaWindow } from "../lib/settings";
import { useDeleteBuild } from "../lib/useDeleteBuild";
import Answer, { errorMessage } from "../components/Answer";
import BuildCard from "../components/BuildCard";
import { manwon, won } from "../lib/format";

const RECENT_BUILD_COUNT = 4;

export default function HomePage() {
  const [maWindow] = useMaWindow();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["builds", maWindow],
    queryFn: () => api.listBuilds(maWindow),
  });

  const { deleteBuild } = useDeleteBuild();

  const builds = data ?? [];
  const recentBuilds = [...builds]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, RECENT_BUILD_COUNT);

  // 판정 분포 — verdict가 null인 빌드(가격 조회 실패로 판정 불가)는 어느
  // 쪽에도 넣지 않고 따로 셈. "사도 되는 가격"은 저가 + 적정가.
  const high = builds.filter((b) => b.verdict === "고가").length;
  const fair = builds.filter((b) => b.verdict === "적정가").length;
  const low = builds.filter((b) => b.verdict === "저가").length;
  const unjudged = builds.filter((b) => b.verdict == null).length;
  const buyOk = fair + low;

  const trackedTotal = builds.reduce((sum, b) => sum + (b.total_price ?? 0), 0);
  const partCount = builds.reduce((sum, b) => sum + b.item_count, 0);

  const answer = (() => {
    if (isLoading) {
      return (
        <Answer
          state="pending"
          kick={`대시보드 · ${maWindow}일 이동평균 기준`}
          headline={
            <>
              저장한 빌드의 <mark>지금 가격을 조회하는 중</mark>입니다
            </>
          }
          because="빌드마다 부품 가격을 하나씩 다시 물어보기 때문에 몇 초 걸립니다"
        />
      );
    }
    if (isError) {
      return (
        <Answer
          state="failed"
          kick={`대시보드 · ${maWindow}일 이동평균 기준`}
          headline={
            <>
              지금은 <mark>판정할 수 없습니다</mark>
            </>
          }
          because={
            <>
              빌드 목록을 불러오지 못했습니다 — <b>{errorMessage(error)}</b>
              <br />
              데이터 소스(다나와) 연결이 끊겼거나 백엔드가 꺼져 있을 수 있습니다
            </>
          }
        />
      );
    }
    if (builds.length === 0) {
      return (
        <Answer
          kick="대시보드"
          headline={
            <>
              아직 <mark>추적 중인 빌드가 없습니다</mark>
            </>
          }
          because="빌드를 만들면 부품 최저가 합계와 적정가 판정을 여기서 한눈에 봅니다"
          actions={
            <>
              <Link className="btn-primary" to="/build/new">+ 새 빌드 만들기</Link>
              <Link className="btn-secondary" to="/search">부품 검색</Link>
            </>
          }
        />
      );
    }
    return (
      <Answer
        kick={`대시보드 · ${maWindow}일 이동평균 기준`}
        headline={
          buyOk > 0 ? (
            <>
              저장한 빌드 {builds.length}개 중{" "}
              <mark>{buyOk}개는 지금 사도 되는 가격</mark>입니다
            </>
          ) : (
            <>
              저장한 빌드 {builds.length}개가 <mark>전부 기준가보다 비쌉니다</mark>
            </>
          )
        }
        because={
          <>
            추적 총액 <b>{won(trackedTotal)}원</b> · 판정 ▲ 고가 <b>{high}</b> · — 적정{" "}
            <b>{fair}</b> · ▼ 저가 <b>{low}</b>
            {unjudged > 0 && (
              <>
                {" "}
                · 판정 불가 <b>{unjudged}</b>
              </>
            )}
            <br />
            &quot;사도 되는 가격&quot;은 적정가 + 저가 — 기준가 대비 ±5% 밴드 안이거나 그보다 쌉니다
          </>
        }
        actions={
          <>
            <Link className="btn-primary" to="/build/new">+ 새 빌드 만들기</Link>
            <Link className="btn-secondary" to="/search">부품 검색</Link>
          </>
        }
      />
    );
  })();

  return (
    <div>
      {answer}

      {builds.length > 0 && (
        <div className="strip">
          <div className="st">
            <p className="st-k">저장 빌드</p>
            <p className="st-v">{builds.length}개</p>
            <p className="st-s">부품 {partCount}종</p>
          </div>
          <div className="st">
            <p className="st-k">추적 총액</p>
            <p className="st-v">{won(trackedTotal)}원</p>
            <p className="st-s">{manwon(trackedTotal)} · 실측 최저가 합</p>
          </div>
          <div className="st">
            <p className="st-k">판정 분포</p>
            <p className="st-v">▲{high} · —{fair} · ▼{low}</p>
            <p className="st-s">{unjudged > 0 ? `판정 불가 ${unjudged}` : "밴드 ±5%"}</p>
          </div>
          <div className="st">
            <p className="st-k">판정 기준</p>
            <p className="st-v">{maWindow}일 이동평균</p>
            <p className="st-s">설정에서 변경</p>
          </div>
        </div>
      )}

      {recentBuilds.length > 0 && (
        <>
          <div className="sec-head">
            <h3 className="sec-title">최근 빌드</h3>
            <span className="sec-note">최근 저장순 {recentBuilds.length}개</span>
            <Link className="btn-ghost" to="/build">전체보기</Link>
          </div>
          <div className="build-grid" style={{ marginTop: 26 }}>
            {recentBuilds.map((build) => (
              <BuildCard key={build.id} build={build} onDelete={deleteBuild} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
