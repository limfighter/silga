import { Link } from "react-router-dom";
import { useMaWindow } from "../lib/settings";
import { useBuilds } from "../lib/useBuilds";
import { useDeleteBuild } from "../lib/useDeleteBuild";
import Answer, { errorMessage } from "../components/Answer";
import BuildCard from "../components/BuildCard";
import VerdictAxis from "../components/VerdictAxis";
import { manwon, won } from "../lib/format";

const RECENT_BUILD_COUNT = 4;

export default function HomePage() {
  const [maWindow] = useMaWindow();

  // 구조를 먼저 받아 카드를 그리고 가격은 뒤따라 채운다 — 자세한 이유는
  // lib/useBuilds.ts 참조
  const { builds, isLoading, isPricesPending, isError, error } = useBuilds(maWindow);

  const { deleteBuild } = useDeleteBuild();
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
              저장한 빌드를 <mark>불러오는 중</mark>입니다
            </>
          }
          because="DB에서 바로 읽는 단계라 금방 끝납니다"
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
    // 구조는 왔지만 가격이 아직인 상태 — 이미 아는 것(빌드 수/부품 수)은
    // 확정해서 보여주고, 아직 모르는 것(총액/판정)만 대기로 표시한다
    if (isPricesPending) {
      return (
        <Answer
          state="pending"
          kick={`대시보드 · ${maWindow}일 이동평균 기준`}
          headline={
            <>
              빌드 {builds.length}개 · <mark>지금 가격을 조회하는 중</mark>입니다
            </>
          }
          because={
            <>
              부품 <b>{partCount}종</b>의 최저가를 하나씩 다시 물어보는 중이라 몇 초
              걸립니다 — 총액과 판정은 조회가 끝나면 채워집니다
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
          {/* 가격이 아직 안 온 단계에서 0원/판정 불가로 적으면 사실이 아님 —
              "모른다"와 "0이다"는 다른 말이라 대기 중에는 값을 비운다 */}
          <div className="st">
            <p className="st-k">추적 총액</p>
            <p className="st-v">{isPricesPending ? "—" : `${won(trackedTotal)}원`}</p>
            <p className="st-s">
              {isPricesPending ? "가격 조회 중" : `${manwon(trackedTotal)} · 실측 최저가 합`}
            </p>
          </div>
          <div className="st">
            <p className="st-k">판정 분포</p>
            <p className="st-v">{isPricesPending ? "—" : `▲${high} · —${fair} · ▼${low}`}</p>
            <p className="st-s">
              {isPricesPending
                ? "가격 조회 중"
                : unjudged > 0
                  ? `판정 불가 ${unjudged}`
                  : "밴드 ±5%"}
            </p>
          </div>
          <div className="st">
            <p className="st-k">판정 기준</p>
            <p className="st-v">{maWindow}일 이동평균</p>
            <p className="st-s">설정에서 변경</p>
          </div>
        </div>
      )}

      {builds.length > 0 && <VerdictAxis builds={builds} />}

      {recentBuilds.length > 0 && (
        <>
          <div className="sec-head">
            <h3 className="sec-title">최근 빌드</h3>
            <span className="sec-note">최근 저장순 {recentBuilds.length}개</span>
            <Link className="btn-ghost" to="/build">전체보기</Link>
          </div>
          <div className="build-grid" style={{ marginTop: 26 }}>
            {recentBuilds.map((build) => (
              <BuildCard
                key={build.id}
                build={build}
                onDelete={deleteBuild}
                pricesPending={isPricesPending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
