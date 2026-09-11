/** 화면 S1-더보기 탭 — 어르신 (리디자인 16_s_more). 설정 화면은 없다 (계획서 7.4).
 *
 *  자녀에게 전화하기(민트 카드)가 첫 줄이다. 그 다음 내 정보, 로그아웃.
 *  글자 크기는 기기 설정을 따르므로 여기서 바꾸지 않는다 (계획서 9.1).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { prettyPhone } from "../shared/format";
import { Glyph } from "../shared/glyphs";
import { SeniorTabs } from "../shared/tabs";
import type { Me, Member } from "../shared/types";
import { Card, Notice, Spinner } from "../shared/ui";

export default function SeniorMore() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [guardians, setGuardians] = useState<Member[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([request<Me>("/me"), request<Member[]>("/family/members")])
      .then(([info, members]) => {
        setMe(info);
        setGuardians(members.filter((m) => m.role === "guardian"));
      })
      .catch(() => setError("정보를 불러오지 못했습니다."));
  }, []);

  async function signOut() {
    // 화면에서 가장 큰 버튼이라 스크롤하다 닿기 쉽다. 한 번 묻는다 (2026-09-11 점검).
    if (!window.confirm("로그아웃하시겠어요?\n\n다시 들어오시려면 자녀분의 이름과 전화번호가 필요합니다.")) return;
    await clearTokens();
    nav("/", { replace: true });
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <span className="icon-btn-space" />
        <h1>더보기</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <Notice tone="error">{error}</Notice>
        {!me && !error && <Spinner />}

        {guardians.length > 0 && (
          <section className="call-card">
            <h2>자녀에게 전화하기</h2>
            {guardians.map((g) => (
              <a className="call-row" href={`tel:${g.phone}`} key={g.user_id}>
                <span className="lead-ic" aria-hidden="true">
                  <Glyph name="phone" size={22} />
                </span>
                <span className="body">
                  <span className="t">{g.name}</span>
                  <span className="d">{prettyPhone(g.phone)}</span>
                </span>
                <span className="call-tag">전화</span>
              </a>
            ))}
          </section>
        )}

        {me && (
          <Card title="내 정보">
            <div className="info-row">
              <span className="k">이름</span>
              <span className="v">{me.user.name}</span>
            </div>
            <div className="info-row">
              <span className="k">전화번호</span>
              <span className="v">{prettyPhone(me.user.phone)}</span>
            </div>
            {me.family_name && (
              <div className="info-row">
                <span className="k">가족</span>
                <span className="v">{me.family_name}</span>
              </div>
            )}
            <p className="sub">글자가 작으면 휴대폰 설정의 글자 크기를 키워 주세요. 앱이 따라갑니다.</p>
          </Card>
        )}

        <div style={{ marginTop: "auto" }}>
          <button className="big-btn plain" onClick={signOut}>
            <Glyph name="logout" size={22} />
            로그아웃
          </button>
          <div className="withdraw-link">
            <button className="text-btn" onClick={() => nav("/privacy")}>
              개인정보처리방침
            </button>
          </div>
          {/* 어르신이 잘못 누르지 않도록 작게. 눌러도 확인 화면이 두 번 더 있다 */}
          <div className="withdraw-link">
            <button className="text-btn danger" onClick={() => nav("/withdraw")}>
              회원 탈퇴
            </button>
          </div>
        </div>
      </main>

      <SeniorTabs current="more" />
    </div>
  );
}
