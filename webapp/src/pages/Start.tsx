/** S0 시작 화면 — 역할 선택 (시안 "첫 페이지").
 *
 *  심볼 + MEDIC + 한 줄 소개 → 헤드라인 → 자녀예요 / 부모예요 카드 → 로그인 링크 →
 *  하단 "EVERYDAY WELLNESS, TOGETHER" + 물결.
 *  부모와 자녀가 같은 번들을 쓴다(계획서 3장). 첫 화면에서 갈라진다.
 */

import { useNavigate } from "react-router-dom";

import { BG, Backdrop, Icon, LOGO } from "../shared/icons";

export default function Start() {
  const nav = useNavigate();

  return (
    <div className="screen decorated start">
      <Backdrop variant="leaf" />
      <main className="screen-body">
        <div className="start-hero">
          {/* 시안의 손글씨 문구 — 장식이다 */}
          <span className="start-note left" aria-hidden="true">
            가까이 있어도,
            <br />
            멀리 있어도,
            <br />
            언제나, 함께.
          </span>
          <span className="start-note right" aria-hidden="true">
            Care
            <br />
            Connects
            <br />
            Better Days
          </span>

          <img className="start-logo" src={LOGO.petals} alt="" aria-hidden="true" />
          <h1 className="start-brand">MEDIC</h1>
          <p className="start-sub">
            가족의 건강을 이어주는
            <br />
            스마트 헬스케어
          </p>
        </div>

        <p className="start-lede">
          <span className="accent">사랑하는 가족의 건강</span>을
          <br />
          쉽고 따뜻하게 연결해요
        </p>

        <div className="role-list">
          <button className="role-card child" onClick={() => nav("/login")}>
            <span className="face">
              <Icon name="caregiver" />
            </span>
            <span className="body">
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
            <span className="body">
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

        <div className="start-foot" aria-hidden="true">
          <img className="mini-logo" src={LOGO.petals} alt="" />
          <span>
            EVERYDAY WELLNESS,
            <br />
            TOGETHER
          </span>
        </div>
        <img className="bottom-wave" src={BG.bottomWave} alt="" aria-hidden="true" />
      </main>
    </div>
  );
}
