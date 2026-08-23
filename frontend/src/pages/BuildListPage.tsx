import { useState } from "react";
import { Link } from "react-router-dom";
import { type BuildSummary } from "../lib/api";
import { useMaWindow } from "../lib/settings";
import { useBuilds } from "../lib/useBuilds";
import { useDeleteBuild } from "../lib/useDeleteBuild";
import Answer, { errorMessage } from "../components/Answer";
import BuildCard from "../components/BuildCard";
import { won } from "../lib/format";

type Filter = "전체" | "고가" | "적정가" | "저가";
const FILTERS: Filter[] = ["전체", "고가", "적정가", "저가"];

export default function BuildListPage() {
  const [maWindow] = useMaWindow();
  const [filter, setFilter] = useState<Filter>("전체");

  // 구조 먼저 / 가격 나중 — lib/useBuilds.ts 참조
  const { builds, isLoading, isPricesPending, isError, error } = useBuilds(maWindow);

  const { deleteBuild } = useDeleteBuild();
  const countOf = (f: Filter) =>
    f === "전체" ? builds.length : builds.filter((b) => b.verdict === f).length;
  // 판정 필터는 순수 클라이언트 필터 — 이미 받아온 목록을 거르기만 하므로
  // 추가 조회가 없음(탭을 눌러도 다나와를 다시 부르지 않음)
  const shown: BuildSummary[] =
    filter === "전체" ? builds : builds.filter((b) => b.verdict === filter);

  const high = countOf("고가");
  const fair = countOf("적정가");
  const low = countOf("저가");
  const trackedTotal = builds.reduce((sum, b) => sum + (b.total_price ?? 0), 0);

  const answer = (() => {
    if (isLoading) {
      return (
        <Answer
          state="pending"
          kick={`내 빌드 · ${maWindow}일 이동평균 기준`}
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
          kick={`내 빌드 · ${maWindow}일 이동평균 기준`}
          headline={
            <>
              목록을 <mark>불러오지 못했습니다</mark>
            </>
          }
          because={<>{errorMessage(error)}</>}
        />
      );
    }
    if (builds.length === 0) {
      return (
        <Answer
          kick="내 빌드"
          headline={
            <>
              저장된 빌드가 <mark>아직 없습니다</mark>
            </>
          }
          because="부품을 골라 빌드를 만들면 조회할 때마다 실시간 최저가로 다시 계산합니다"
          actions={<Link className="btn-primary" to="/build/new">+ 새 빌드 만들기</Link>}
        />
      );
    }
    // 카드는 이미 떠 있고 가격만 오는 중 — 확정된 개수는 그대로 말하고
    // 총액/판정만 대기로 둔다
    if (isPricesPending) {
      return (
        <Answer
          state="pending"
          kick={`내 빌드 · ${maWindow}일 이동평균 기준`}
          headline={
            <>
              빌드 {builds.length}개 · <mark>지금 가격을 조회하는 중</mark>입니다
            </>
          }
          because="부품 최저가를 하나씩 다시 물어보는 중이라 몇 초 걸립니다 — 총액과 판정은 조회가 끝나면 채워집니다"
          actions={<Link className="btn-primary" to="/build/new">+ 새 빌드 만들기</Link>}
        />
      );
    }
    return (
      <Answer
        kick={`내 빌드 · ${maWindow}일 이동평균 기준`}
        headline={
          <>
            빌드 {builds.length}개 · <mark>{won(trackedTotal)}원</mark> 추적 중
          </>
        }
        because={
          <>
            고가 <b>{high}</b> · 적정 <b>{fair}</b> · 저가 <b>{low}</b>
            {high > 0 && ` — 고가 ${high}건은 판정 기준가보다 5% 넘게 비쌉니다`}
          </>
        }
        actions={<Link className="btn-primary" to="/build/new">+ 새 빌드 만들기</Link>}
      />
    );
  })();

  return (
    <div>
      {answer}

      {builds.length > 0 && (
        <div className="sort-tabs" style={{ marginTop: 26 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`sort-tab${f === filter ? " active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {/* 가격 대기 중엔 전부 0으로 보이는데, 판정이 없는 게 아니라
                  아직 안 온 것이므로 개수를 숨긴다 */}
              {f === "적정가" ? "적정" : f}
              {!isPricesPending && ` ${countOf(f)}`}
            </button>
          ))}
        </div>
      )}

      <div className="build-grid" style={{ marginTop: 26 }}>
        {shown.map((build) => (
          <BuildCard
            key={build.id}
            build={build}
            onDelete={deleteBuild}
            pricesPending={isPricesPending}
          />
        ))}

        {filter === "전체" && (
          <Link className="build-card new" to="/build/new">
            <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            새 빌드 만들기
          </Link>
        )}
      </div>

      {builds.length > 0 && shown.length === 0 && (
        <div className="empty-state" style={{ marginTop: 26 }}>
          <div className="t">{filter} 판정을 받은 빌드가 없습니다</div>
          <div className="d">위 탭에서 &quot;전체&quot;를 눌러 전부 보기</div>
        </div>
      )}
    </div>
  );
}
