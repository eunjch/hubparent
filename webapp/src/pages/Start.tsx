/** S0 시작 화면 — 역할 선택.
 *
 *  부모와 자녀가 같은 번들을 쓴다(계획서 3장). 첫 화면에서 갈라진다.
 *  어르신 쪽 문구는 "초대"나 "코드" 같은 말 대신 실제로 겪는 상황으로 적는다(계획서 9장).
 */

import { useNavigate } from "react-router-dom";

import { AvatarGuardian, AvatarSenior, IconFamily } from "../shared/icons";
import { Scene } from "../shared/Scene";

export default function Start() {
  const nav = useNavigate();

  return (
    <div className="screen onboard">
      <Scene variant="senior" />

      <main className="screen-body">
        <div className="hero">
          <span className="hero-badge">
            <IconFamily size={60} />
          </span>
          <h1>HUB FAMILY</h1>
          <p>
            사랑하는 가족의 건강을
            <br />
            쉽고 따뜻하게 연결해요
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-tight)" }}>
          <button className="role-card child" onClick={() => nav("/setup")}>
            <span className="face">
              <AvatarGuardian size={68} />
            </span>
            <span>
              <span className="t">자녀예요</span>
              <span className="d">부모님을 등록하고 하루를 확인해요</span>
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>

          <button className="role-card parent" onClick={() => nav("/join")}>
            <span className="face">
              <AvatarSenior size={68} />
            </span>
            <span>
              <span className="t">부모예요</span>
              <span className="d">자녀가 알려준 번호를 넣어요</span>
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
