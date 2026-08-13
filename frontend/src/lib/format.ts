// 화면 표시용 가격 포맷. 백엔드의 *_formatted 필드(= utils.format_won,
// "340.9만원")는 그대로 쓰되, 여러 부품/빌드를 프론트에서 합산한 값처럼
// 대응하는 서버 필드가 없는 경우에만 여기 함수를 쓴다.

/** 3409000 -> "3,409,000" (단위 "원"은 호출부에서 <span>으로 따로 붙임) */
export function won(value: number): string {
  return value.toLocaleString("ko-KR");
}

/** 3409000 -> "340.9만원" — 백엔드 format_won()과 같은 규칙 */
export function manwon(value: number): string {
  return `${(value / 10000).toFixed(1)}만원`;
}

/** 2026-08-11T09:41:00+09:00 -> "2026.08.11" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

/** 증감률 앞에 붙는 판정 글리프 — 색 대신 기호로만 구분(모노크롬 원칙) */
export function verdictGlyph(verdict: string | null): string {
  if (verdict === "고가") return "▲";
  if (verdict === "저가") return "▼";
  return "—";
}

/** +6.5 -> "+6.5%", -1.2 -> "−1.2%" (빼기표는 U+2212로 자릿수 정렬 유지) */
export function signedPercent(value: number): string {
  return value < 0 ? `−${Math.abs(value)}%` : `+${value}%`;
}
