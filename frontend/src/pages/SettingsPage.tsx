import { MA_WINDOW_OPTIONS, useMaWindow } from "../lib/settings";

export default function SettingsPage() {
  const [maWindow, setMaWindow] = useMaWindow();

  return (
    <div>
      <div className="build-header">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>설정</h2>
      </div>

      <div className="form-shell">
        <div className="field">
          <label>판정 기준 이동평균 기간</label>
          <select
            value={maWindow}
            onChange={(e) => setMaWindow(Number(e.target.value) as typeof maWindow)}
          >
            {MA_WINDOW_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}일
              </option>
            ))}
          </select>
          <div className="field-hint">
            빌드 목록/상세의 적정가·고가·저가 판정에 쓰이는 기준가를 최근
            며칠간의 평균가로 계산할지 선택합니다. 견적 총액(즉시가)에는
            영향을 주지 않으며, 이 기기에만 저장됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}
