import { Link } from "react-router-dom";
import type { BuildSummary } from "../lib/api";
import { signedPercent, verdictGlyph, won } from "../lib/format";
import {
  GAUGE_RANGE,
  VERDICT_THRESHOLD_PERCENT,
  ZONE_LEFT,
  ZONE_WIDTH,
  markerPosition,
  rangeGlyph,
} from "../lib/verdictScale";

// 홈 판정 축 — 저장한 빌드를 빌드 상세 게이지와 같은 좌표계(±30%, 적정 ±5%)에
// 한꺼번에 올려서 "지금 어느 빌드가 싼가"를 한 화면에서 읽게 한다.
//
// 목업의 원안은 핀마다 라벨을 상시 노출하고 위/아래 두 줄로 번갈아 놓는
// 방식이었는데, 적정 밴드에 빌드가 몰리면(그게 오히려 정상 상태다) 라벨이
// 그대로 겹쳤다. 그래서 기본 상태는 눈금만 있는 자(ruler)로 두고 라벨은
// hover/포커스한 핀 하나만 띄운다 — 빌드가 몇 개든 안 깨진다.
//
// 인쇄물에는 hover도 포커스도 없으므로 같은 내용을 정렬된 목록(.axis-list)으로
// 항상 렌더해두고 @media print에서만 펼친다.
//
// 예외 하나 — 핀이 딱 하나면 겹칠 상대가 없으므로 라벨을 상시 노출한다.
// 그 경우 축이 "어디에 있는지 알 수 없는 눈금 한 줄"이 돼서 섹션 하나를
// 쓰고도 정보를 못 주고 있었음(빌드 1개 상태 실화면에서 확인, 2026-08-23).
export default function VerdictAxis({ builds }: { builds: BuildSummary[] }) {
  const plotted = builds
    .filter((b) => b.diff_percent != null)
    .sort((a, b) => a.diff_percent! - b.diff_percent!);

  if (plotted.length === 0) return null;

  // 겹침 걱정이 없는 유일한 경우 — 2개부터는 적정 밴드에 몰릴 수 있어서
  // 기존대로 hover/포커스에만 띄운다
  const alwaysLabel = plotted.length === 1;

  const describe = (b: BuildSummary) => {
    const glyph = rangeGlyph(b.diff_percent!);
    return [
      b.name,
      `기준가 대비 ${signedPercent(b.diff_percent!)}`,
      b.verdict ?? "판정 없음",
      glyph ? "표시 범위 밖" : null,
      b.verdict_confidence === "low" ? "일부 부품 즉시가 대체" : null,
    ]
      .filter(Boolean)
      .join(", ");
  };

  return (
    <>
      <div className="sec-head">
        <h3 className="sec-title">지금 시세 위치</h3>
        <span className="sec-note">
          기준가 대비 · 가운데 흰 구간이 적정 ±{VERDICT_THRESHOLD_PERCENT}%
        </span>
      </div>

      <div className="axis">
        <div className="axis-zone" style={{ left: `${ZONE_LEFT}%`, width: `${ZONE_WIDTH}%` }} />
        <div className="axis-mid" />
        {plotted.map((b) => {
          const glyph = rangeGlyph(b.diff_percent!);
          const inBand = Math.abs(b.diff_percent!) <= VERDICT_THRESHOLD_PERCENT;
          const pos = markerPosition(b.diff_percent!);
          return (
            <Link
              key={b.id}
              to={`/build/${b.id}`}
              aria-label={describe(b)}
              className={[
                "axis-pin",
                alwaysLabel ? "solo" : "",
                inBand ? "in" : "",
                // 이동평균이 즉시가로 대체된 빌드는 파선 — 카드(.bc-diff.low)와 같은 규칙
                b.verdict_confidence === "low" ? "low" : "",
                glyph ? "out" : "",
                // 라벨이 트랙 밖으로 나가지 않도록 왼쪽 절반은 오른쪽으로 펼침
                pos > 50 ? "r" : "l",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ left: `${pos}%` }}
            >
              <i aria-hidden="true" />
              <b aria-hidden="true">
                {glyph && `${glyph} `}
                {b.name} {signedPercent(b.diff_percent!)}
              </b>
            </Link>
          );
        })}
      </div>
      <p className="axis-cap">
        <span>저가 −{GAUGE_RANGE}%</span>
        <span>적정 ±{VERDICT_THRESHOLD_PERCENT}%</span>
        <span>고가 +{GAUGE_RANGE}%</span>
      </p>
      {!alwaysLabel && (
        <p className="axis-hint">핀에 마우스를 올리거나 탭 키로 이동하면 어느 빌드인지 표시됩니다</p>
      )}

      {/* 인쇄 전용 — 화면에서는 숨김(축의 hover 라벨이 그 역할을 함) */}
      <ol className="axis-list">
        {plotted.map((b) => (
          <li key={b.id}>
            <span className="al-v">
              {verdictGlyph(b.verdict)} {signedPercent(b.diff_percent!)}
              {rangeGlyph(b.diff_percent!) && " (범위 밖)"}
            </span>
            <span className="al-n">{b.name}</span>
            <span className="al-p">
              {b.total_price != null ? `${won(b.total_price)}원` : "조회 실패"}
              {b.verdict_confidence === "low" && " · 일부 즉시가 대체"}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
