import { useState } from "react";
import { MA_WINDOW_OPTIONS, useMaWindow } from "../lib/settings";
import { API_BASE } from "../lib/api";
import { getRecentProducts, clearRecentProducts } from "../lib/recentProducts";
import Answer from "../components/Answer";

export default function SettingsPage() {
  const [maWindow, setMaWindow] = useMaWindow();
  const [recentCount, setRecentCount] = useState(() => getRecentProducts().length);

  const handleClearRecent = () => {
    clearRecentProducts();
    setRecentCount(0);
  };

  return (
    <div>
      {/* "바꾸면 빌드 N개가 다시 계산된다"까지 쓰고 싶지만, 그 N을 알려면
          /builds를 불러야 하고 그건 빌드마다 부품 가격을 전부 재조회하는
          호출임 — 설정 화면을 여는 것만으로 크롤링을 유발할 수는 없어서
          개수는 빼고 문장으로만 알림 */}
      <Answer
        kick="설정"
        headline={
          <>
            판정 기준은 <mark>{maWindow}일 이동평균</mark>입니다
          </>
        }
        because={
          <>
            기간을 줄이면 최근 시세에 민감해지고, 늘리면 일시적 급등락을 무시합니다
            <br />
            바꾸면 저장된 빌드의 판정이 다음 조회부터 전부 다시 계산됩니다
          </>
        }
      />

      <div className="set-list" style={{ marginTop: 26 }}>
        <div className="set-row">
          <div>
            <p className="t">판정 기준 이동평균 기간</p>
            <p className="d">
              7일 — 최근 시세에 민감. 급등락이 그대로 판정에 반영
              <br />
              14일 — 기본값. 주 단위 변동을 한 번 걸러냄
              <br />
              30일 — 둔감. 장기 추세만 봄
            </p>
          </div>
          <select
            value={maWindow}
            aria-label="판정 기준 이동평균 기간"
            onChange={(e) => setMaWindow(Number(e.target.value) as typeof maWindow)}
          >
            {MA_WINDOW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}일{n === 14 ? " (기본값)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="set-row">
          <div>
            <p className="t">최근기록 비우기</p>
            <p className="d">
              이 브라우저에 저장된 최근 조회 {recentCount}건을 지웁니다. 즐겨찾기와 빌드는 그대로
              남습니다.
            </p>
          </div>
          <button className="btn-ghost" onClick={handleClearRecent} disabled={recentCount === 0}>
            {recentCount === 0 ? "비어 있음" : "최근기록 비우기"}
          </button>
        </div>

        <div className="set-row">
          <div>
            <p className="t">API 서버</p>
            <p className="d">
              {API_BASE} — frontend/.env의 VITE_API_BASE로 바꿉니다
            </p>
          </div>
          <p className="st-s" style={{ margin: 0 }}>
            견적 총액(즉시가)에는 영향 없음
          </p>
        </div>
      </div>
    </div>
  );
}
