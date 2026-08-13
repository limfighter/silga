// 판정 시각화 좌표계. 빌드 상세의 게이지(.gauge-track)와 홈의 판정 축(.axis)이
// "같은 자"를 써야 두 화면을 오갈 때 위치 감각이 유지되므로 여기 한 곳에만 둔다.
//
// 범위(±30%) 자체는 REFERENCE.md에 수치가 없어 임의로 잡은 시각화용 가정값.
// 적정 밴드는 services/verdict.py의 VERDICT_THRESHOLD_PERCENT(±5%)를 그대로 반영.
export const GAUGE_RANGE = 30;
export const VERDICT_THRESHOLD_PERCENT = 5;

/** diff_percent → 바 위 0~100% 위치. 범위 밖은 양 끝으로 클램프됨 */
export function markerPosition(diffPercent: number | null): number {
  if (diffPercent === null) return 50;
  const clamped = Math.max(-GAUGE_RANGE, Math.min(GAUGE_RANGE, diffPercent));
  return ((clamped + GAUGE_RANGE) / (GAUGE_RANGE * 2)) * 100;
}

// 클램프된 핀은 실제 값과 무관하게 끝에 붙으므로, 끝에 선 게 "딱 ±30%"인지
// "범위 밖"인지 구분되지 않으면 거짓말이 됨 — 방향 글리프로 표시한다
export function rangeGlyph(diffPercent: number): string | null {
  if (diffPercent > GAUGE_RANGE) return "»";
  if (diffPercent < -GAUGE_RANGE) return "«";
  return null;
}

/** 라벨이 트랙 밖으로 잘리지 않게 가장자리에서 안쪽으로 접는 방향 */
export function labelEdge(pos: number): "l" | "r" | undefined {
  if (pos < 12) return "l";
  if (pos > 88) return "r";
  return undefined;
}

export const ZONE_LEFT = ((-VERDICT_THRESHOLD_PERCENT + GAUGE_RANGE) / (GAUGE_RANGE * 2)) * 100;
export const ZONE_WIDTH = ((VERDICT_THRESHOLD_PERCENT * 2) / (GAUGE_RANGE * 2)) * 100;
