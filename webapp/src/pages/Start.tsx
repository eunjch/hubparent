/** S0 시작 화면 — 역할 선택 (리디자인 00_start).
 *
 *  문구 → 심볼 + MEDIC + 한 줄 소개 → 헤드라인 → 자녀예요 / 부모예요 카드 → 로그인 링크 →
 *  하단 "Care Connects Better Days".
 *  부모와 자녀가 같은 번들을 쓴다(계획서 3장). 첫 화면에서 갈라진다.
 */

import { useNavigate } from "react-router-dom";

import { Art } from "../shared/art";
import { Glyph } from "../shared/glyphs";

export default function Start() {
  const nav = useNavigate();

  return (
    <div className="screen start">
      <main className="screen-body">
        <p className="start-tagline">
          가까이 있어도, 멀리 있어도
          <br />
          언제나, 함께.
        </p>

        <div className="start-hero">
          <Art name="logo" className="start-logo" />
          <h1 className="start-brand">MEDIC</h1>
          <p className="start-sub">
            가족의 건강을 이어주는
            <br />
            스마트 헬스케어
          </p>
        </div>

        <p className="start-lede">
          사랑하는 가족의 건강을
          <br />
          쉽고 따뜻하게 연결해요
        </p>

        <div className="role-list">
          <button className="role-card child" onClick={() => nav("/login")}>
            <span className="face">
              <Art name="avatarFamily" />
            </span>
            <span className="body">
              <span className="t">자녀예요</span>
              <span className="d">로그인 · 회원가입</span>
            </span>
            <span className="chev" aria-hidden="true">
              <Glyph name="chevron" size={22} />
            </span>
          </button>

          <button className="role-card parent" onClick={() => nav("/join")}>
            <span className="face">
              <Art name="avatarGrandmaLg" />
            </span>
            <span className="body">
              <span className="t">부모예요</span>
              <span className="d">자녀 이름과 전화번호로 시작</span>
            </span>
            <span className="chev" aria-hidden="true">
              <Glyph name="chevron" size={22} />
            </span>
          </button>
        </div>

        <button className="text-link" onClick={() => nav("/login")}>
          이미 가입하셨나요? 로그인
        </button>

        <div className="start-foot" aria-hidden="true">
          <span>
            Care Connects
            <br />
            Better Days
          </span>
        </div>
      </main>
    </div>
  );
}
