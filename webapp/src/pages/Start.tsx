/** S0 시작 화면 — 역할 선택.
 *
 *  부모와 자녀가 같은 번들을 쓴다(계획서 3장). 첫 화면에서 갈라진다.
 *  역할만 묻고 끝나면 "어디서 로그인하지?" 가 되므로 행동을 문구에 드러낸다.
 */

import { useNavigate } from "react-router-dom";

import { Icon } from "../shared/icons";

export default function Start() {
  const nav = useNavigate();

  return (
    <div className="screen">
      <main className="screen-body">
        <div className="hero">
          <span className="hero-badge">
            <Icon name="family" />
          </span>
          <h1>MEDIC</h1>
          <p>
            사랑하는 가족의 건강을
            <br />
            쉽고 따뜻하게 연결해요
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-tight)" }}>
          <button className="role-card child" onClick={() => nav("/login")}>
            <span className="face">
              <Icon name="caregiver" />
            </span>
            <span>
              <span className="t">자녀예요</span>
              <span className="d">로그인 · 회원가입</span>
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>

          <button className="role-card parent" onClick={() => nav("/join")}>
            <span className="face">
              <Icon name="heart" />
            </span>
            <span>
              <span className="t">부모예요</span>
              <span className="d">자녀 이름과 전화번호로 시작</span>
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>
        </div>

        <button className="text-link" onClick={() => nav("/login")}>
          이미 가입하셨나요? 로그인
        </button>
      </main>
    </div>
  );
}
