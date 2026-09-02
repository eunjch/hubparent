/** S0 시작 화면 — 역할 선택.
 *
 *  이 앱은 부모와 자녀가 같은 번들을 쓴다(계획서 3장). 첫 화면에서 갈라진다.
 *  어르신 쪽 문구는 "초대"나 "코드" 같은 말 대신 실제로 겪는 상황으로 적는다(계획서 9장).
 */

import { useNavigate } from "react-router-dom";

import { BigButton, Screen } from "../shared/ui";

export default function Start() {
  const nav = useNavigate();

  return (
    <Screen sky>
      <div style={{ textAlign: "center", padding: "var(--gap-loose) 0" }}>
        <p style={{ fontSize: 64, margin: 0, lineHeight: 1 }} aria-hidden="true">
          👨‍👩‍👧‍👦
        </p>
        <p className="lede" style={{ marginTop: "var(--gap)" }}>
          HUB FAMILY
        </p>
        <p className="sub" style={{ marginTop: 6 }}>
          사랑하는 가족의 건강을
          <br />
          쉽고 따뜻하게 연결해요
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-tight)", marginTop: "auto" }}>
        <BigButton tone="primary" className="role-btn" onClick={() => nav("/setup")}>
          <span className="ico" aria-hidden="true">
            🙋‍♀️
          </span>
          <span>
            자녀입니다
            <span style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 400, marginTop: 2, opacity: 0.9 }}>
              부모님을 등록하고 하루를 확인합니다
            </span>
          </span>
        </BigButton>

        <BigButton className="role-btn" onClick={() => nav("/join")}>
          <span className="ico" aria-hidden="true">
            👵
          </span>
          <span>
            부모입니다
            <span style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 400, marginTop: 2, color: "var(--ink-2)" }}>
              자녀가 알려준 번호를 넣습니다
            </span>
          </span>
        </BigButton>
      </div>
    </Screen>
  );
}
