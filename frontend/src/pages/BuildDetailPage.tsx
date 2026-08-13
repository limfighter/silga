import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type BuildDetail, type BuildItemDetail } from "../lib/api";
import { useMaWindow } from "../lib/settings";
import { useDeleteBuild } from "../lib/useDeleteBuild";
import Answer, { errorMessage } from "../components/Answer";
import { manwon, shortDate, signedPercent, won } from "../lib/format";
import {
  GAUGE_RANGE,
  VERDICT_THRESHOLD_PERCENT,
  ZONE_LEFT,
  ZONE_WIDTH,
  labelEdge,
  markerPosition,
  rangeGlyph,
} from "../lib/verdictScale";

// 부품을 기능 단위로 묶어서 스펙시트처럼 읽히게 함. 여기 없는 카테고리는
// 맨 아래 "기타"로 모임 — 카테고리가 늘어나도 누락되지 않게.
const PART_GROUPS: { label: string; categories: string[] }[] = [
  { label: "연산부", categories: ["CPU", "메인보드", "쿨러"] },
  { label: "그래픽", categories: ["GPU"] },
  { label: "메모리 · 저장", categories: ["RAM", "SSD"] },
  { label: "섀시 · 전원", categories: ["케이스", "파워"] },
];

// 색을 못 쓰므로 그룹 구분은 채움/빗금/세선/외곽선 4패턴 — 그룹이 5개
// 이상("기타"까지)이면 순환시킴
const FILLS = ["fill-solid", "fill-hatch", "fill-line", "fill-open"];

type Group = { label: string; items: BuildItemDetail[]; total: number };

function groupItems(items: BuildItemDetail[]): Group[] {
  const used = new Set<BuildItemDetail>();
  const withTotal = (label: string, matched: BuildItemDetail[]): Group => ({
    label,
    items: matched,
    total: matched.reduce((sum, it) => sum + (it.price ?? 0), 0),
  });

  const groups = PART_GROUPS.map((g) => {
    const matched = items.filter((it) => g.categories.includes(it.category));
    matched.forEach((it) => used.add(it));
    return withTotal(g.label, matched);
  }).filter((g) => g.items.length > 0);

  const rest = items.filter((it) => !used.has(it));
  if (rest.length > 0) groups.push(withTotal("기타", rest));
  return groups;
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

  if (isLoading) {
    return (
      <Answer
        state="pending"
        kick="판정 · 조회 중"
        headline={
          <>
            부품 가격을 <mark>하나씩 다시 조회하는 중</mark>입니다
          </>
        }
        because="저장된 가격을 쓰지 않고 매번 다나와에 다시 물어봅니다 — 부품 수만큼 걸립니다"
      />
    );
  }
  if (isError || !data) {
    return (
      <Answer
        state="failed"
        kick="판정"
        headline={
          <>
            이 빌드를 <mark>불러오지 못했습니다</mark>
          </>
        }
        because={<>{errorMessage(error)}</>}
        actions={<Link className="btn-secondary" to="/build">빌드 목록으로</Link>}
      />
    );
  }

  return <BuildDetailView data={data} />;
}

// 데이터가 도착한 뒤에 마운트되므로, 여기서 잡는 mounted 플래그가 곧
// "값이 확정된 시점"이 됨 — 비중 바/리빌 애니메이션의 시작점으로 씀
function BuildDetailView({ data }: { data: BuildDetail }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { deleteBuild, isPending: isDeleting, isError: isDeleteError, error: deleteError } = useDeleteBuild(() =>
    navigate("/build")
  );

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
  const topShare = topItem ? (topItem.price! / data.total_price) * 100 : 0;

  let rowIndex = 0;

  const verdictWord =
    data.verdict === "고가" ? "비쌉니다" : data.verdict === "저가" ? "쌉니다" : null;

  return (
    <div>
      {data.diff_percent != null ? (
        <Answer
          kick={`판정 · ${data.ma_window ?? "N"}일 이동평균 기준`}
          headline={
            verdictWord ? (
              <>
                이 견적은 기준가보다{" "}
                <mark>
                  {Math.abs(data.diff_percent)}% {verdictWord}
                </mark>
              </>
            ) : (
              <>
                이 견적은 <mark>기준가와 거의 같습니다</mark>
              </>
            )
          }
          because={
            <>
              {/* 기준가는 항상 verdict_basis_price(이동평균) — compareValue를 쓰면
                  market_price가 있는 빌드에서 "판매가 = 기준가"로 같은 숫자가
                  두 번 찍힘 */}
              {hasMarketPrice ? "판매가" : "실측 합계"}{" "}
              <b>{won(hasMarketPrice ? data.market_price! : data.total_price)}원</b>
              {data.verdict_basis_price != null && (
                <>
                  {" "}
                  · 기준가 <b>{won(data.verdict_basis_price)}원</b> · 차이{" "}
                  <b>
                    {signedPercent(data.diff_percent)} (
                    {won(
                      Math.abs(
                        (hasMarketPrice ? data.market_price! : data.total_price) -
                          data.verdict_basis_price
                      )
                    )}
                    원)
                  </b>
                </>
              )}
              <br />
              적정 밴드는 ±{VERDICT_THRESHOLD_PERCENT}%
              {fallbackCodes.size > 0 ? (
                <>
                  {" "}
                  — {data.items.length}개 부품 중 <b>{fallbackCodes.size}개</b>는 이동평균 대신
                  즉시가로 대체 적용
                </>
              ) : (
                " — 전 부품에 이동평균이 정상 적용됨"
              )}
            </>
          }
          actions={
            <>
              <Link className="btn-ghost" to="/build">← 목록으로</Link>
              <button className="btn-ghost" onClick={() => window.print()}>견적 인쇄</button>
              <button
                className="btn-delete"
                onClick={() => deleteBuild(data.id, data.name)}
                disabled={isDeleting}
                aria-label="빌드 삭제"
                title="빌드 삭제"
              >
                ×
              </button>
            </>
          }
        />
      ) : (
        <Answer
          state="failed"
          kick="판정"
          headline={
            <>
              가격을 조회하지 못해 <mark>판정할 수 없습니다</mark>
            </>
          }
          because={
            <>
              {data.name} · 부품 {data.items.length}종 중 <b>{missingCount}종</b>의 가격을 가져오지
              못했습니다
              <br />
              다나와 응답이 정상으로 돌아오면 다시 조회할 때 자동으로 판정됩니다
            </>
          }
          actions={
            <>
              <Link className="btn-ghost" to="/build">← 목록으로</Link>
              <button
                className="btn-delete"
                onClick={() => deleteBuild(data.id, data.name)}
                disabled={isDeleting}
                aria-label="빌드 삭제"
                title="빌드 삭제"
              >
                ×
              </button>
            </>
          }
        />
      )}

      {isDeleteError && (
        <div className="status-line error">삭제 실패: {errorMessage(deleteError)}</div>
      )}

      <div className="strip">
        <div className="st">
          <p className="st-k">부품 구성</p>
          <p className="st-v">
            {data.items.length}종 · {groups.length}그룹
          </p>
          <p className="st-s">{missingCount > 0 ? `${missingCount}종 가격 조회 실패` : "누락 없음"}</p>
        </div>
        <div className="st">
          <p className="st-k">최고 비중</p>
          <p className="st-v">
            {topItem ? `${topItem.category} ${topShare.toFixed(1)}%` : "—"}
          </p>
          <p className="st-s">{topItem ? `${won(topItem.price!)}원` : "가격 조회 실패"}</p>
        </div>
        <div className="st">
          <p className="st-k">판정 기준</p>
          <p className="st-v">{data.ma_window != null ? `${data.ma_window}일 이동평균` : "—"}</p>
          <p className="st-s">
            {data.verdict_confidence === "low"
              ? "일부 부품 즉시가 대체"
              : data.verdict_confidence === "high"
                ? "전 부품 이동평균 적용"
                : "설정에서 변경"}
          </p>
        </div>
        <div className="st">
          <p className="st-k">판정</p>
          <p className="st-v">
            {data.verdict != null
              ? `${data.verdict === "고가" ? "▲" : data.verdict === "저가" ? "▼" : "—"} ${data.verdict}`
              : "—"}
          </p>
          <p className="st-s">
            {data.diff_percent != null
              ? `기준가 대비 ${signedPercent(data.diff_percent)}`
              : "가격 조회 실패로 판정 불가"}
          </p>
        </div>
      </div>

      <div className="total-row">
        <div>
          <p className="total-label">실측 합계 · 즉시 최저가</p>
          <p className="total-num">
            {won(data.total_price)}<span>원</span>
          </p>
        </div>
        <p className="total-meta">
          저장 <b>{shortDate(data.created_at)}</b>
          <br />
          다나와 실시간 최저가 기준
          {data.verdict_basis_price_formatted && (
            <>
              <br />
              판정 기준가 <b>{data.verdict_basis_price_formatted}</b>
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
                {won(data.total_price)}<span>원</span>
              </p>
            </div>
            <div className="confirm-arrow">→</div>
            <div className="confirm-col">
              <p className="confirm-k">{compareLabel}</p>
              <p className="confirm-num">
                {won(compareValue)}<span>원</span>
              </p>
            </div>

            {/* 두 배지의 기준이 서로 다름 — 원 차액은 실측 합계 대비,
                증감률은 판정 기준가 대비 */}
            <div className="deltas">
              <div className="diff-badge">
                <span className="base">실측 대비 차액</span>
                <b>
                  {compareValue > data.total_price ? "▲" : compareValue < data.total_price ? "▼" : "—"}{" "}
                  {won(Math.abs(compareValue - data.total_price))}원
                </b>
              </div>
              <div className="diff-badge fill">
                <span className="base">기준가 대비 증감률</span>
                <b>
                  {data.verdict === "고가" ? "▲" : data.verdict === "저가" ? "▼" : "—"}{" "}
                  {signedPercent(data.diff_percent)}
                </b>
              </div>
            </div>
          </div>

          <div className="gauge-track">
            <div className="gauge-zone" style={{ left: `${ZONE_LEFT}%`, width: `${ZONE_WIDTH}%` }} />
            <div className="gauge-marker" style={{ left: `${mounted ? markerPos : 50}%` }} />
            <span
              className="gauge-marker-value"
              data-edge={mounted ? labelEdge(markerPos) : undefined}
              style={{ left: `${mounted ? markerPos : 50}%` }}
            >
              {/* 범위 밖이면 마커가 끝에 클램프되므로 값만 보여주면 "딱 ±30%"와
                  구분이 안 됨 */}
              {rangeGlyph(data.diff_percent)} {signedPercent(data.diff_percent)}
            </span>
          </div>
          <div className="gauge-labels">
            <span>저가 −{GAUGE_RANGE}%</span>
            <span>적정 ±{VERDICT_THRESHOLD_PERCENT}%</span>
            <span>고가 +{GAUGE_RANGE}%</span>
          </div>
        </div>
      )}

      {groups.length > 1 && data.total_price > 0 && (
        <>
          <div className="sec-head">
            <h3 className="sec-title">돈이 몰린 곳</h3>
            <span className="sec-note">그룹 {groups.length} · 합계 {won(data.total_price)}원</span>
          </div>
          <div
            className="stack-bar"
            style={{ marginTop: 26 }}
            role="img"
            aria-label={groups
              .map((g) => `${g.label} ${((g.total / data.total_price) * 100).toFixed(1)}%`)
              .join(", ")}
          >
            {groups.map((g, i) => (
              <i
                key={g.label}
                className={FILLS[i % FILLS.length]}
                style={{ width: `${(g.total / data.total_price) * 100}%` }}
              />
            ))}
          </div>
          <div className="legend">
            {groups.map((g, i) => (
              <div key={g.label}>
                <span className={`sw ${FILLS[i % FILLS.length]}`} />
                {g.label}{" "}
                <b>
                  {((g.total / data.total_price) * 100).toFixed(1)}% · {won(g.total)}
                </b>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec-head">
        <h3 className="sec-title">부품 구성</h3>
        <span className="sec-note">실시간 최저가 기준 · 단위 : 원</span>
      </div>

      {groups.map((group) => (
        <div key={group.label}>
          <p className="grp">
            {group.label}
            <span className="amt">{won(group.total)}</span>
          </p>
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
                    {item.price != null ? won(item.price) : "조회 실패"}
                    {item.price != null && <em>{manwon(item.price)}</em>}
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
        <span className="sum-val">{won(data.total_price)}원</span>
      </div>
    </div>
  );
}
