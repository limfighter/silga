import type { ReactNode } from "react";

// 화면 최상단 결론 블록. 예전 헤더(.section-label "DASHBOARD" + <h2>홈</h2>)는
// 화면 이름만 되풀이해서 정보량이 0이었음 — 그 자리에 "그래서 결론이 뭔데"를
// 넣고, 근거는 .because 한 줄로 받친다.
//
// state가 따로 있는 이유: 이 앱의 데이터 소스는 예고 없이 DOM이 바뀌는
// 다나와 스크래퍼라 "결론이 아직 없음(pending)"과 "결론을 낼 수 없음(failed)"이
// 예외가 아니라 정상 상태 중 하나임. 최상단 4px 룰은 어느 상태에서나 그대로
// 두고(문서 구조가 깜빡이면 안 됨) 잉크 강조만 낮춤.
export type AnswerState = "ready" | "pending" | "failed";

export default function Answer({
  state = "ready",
  kick,
  headline,
  because,
  actions,
}: {
  state?: AnswerState;
  kick: string;
  headline: ReactNode;
  because?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`answer${state === "ready" ? "" : ` ${state}`}`}>
      <p className="kick">{kick}</p>
      <h2 aria-busy={state === "pending"}>{headline}</h2>
      {because && <p className="because">{because}</p>}
      {actions && <div className="answer-acts">{actions}</div>}
    </div>
  );
}

// 에러 객체에서 사람이 읽을 문구만 뽑음 — 각 페이지가 똑같은 삼항식을
// 반복하고 있었음
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류";
}
