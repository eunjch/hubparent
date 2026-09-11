/** 화면 G1-더보기 탭 — 자녀. 관리 화면으로 가는 입구와 내 정보. */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { Glyph } from "../shared/glyphs";
import { GuardianTabs } from "../shared/tabs";
import type { Me } from "../shared/types";
import { Card, Notice, RowCard, Spinner } from "../shared/ui";
import { prettyPhone } from "../shared/format";

export default function GuardianMore() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Me>("/me")
      .then(setMe)
      .catch(() => setError("정보를 불러오지 못했습니다."));
  }, []);

  async function signOut() {
    // 화면에서 가장 큰 버튼이라 스크롤하다 닿기 쉽다. 한 번 묻는다 (2026-09-11 점검).
    if (!window.confirm("로그아웃하시겠어요?\n\n다시 들어오시려면 이메일과 비밀번호가 필요합니다.")) return;
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

        <div className="more-list">
          <RowCard lead={<span className="lead-ic blue"><Glyph name="users" size={24} /></span>} title="부모님 관리" description="등록 · 수정 · 로그인 안내" chevron onClick={() => nav("/g/seniors")} />
          <RowCard lead={<span className="lead-ic pink"><Glyph name="heart" size={24} /></span>} title="약 복용 시간 설정" description="약 추가 · 알림 켜고 끄기" chevron onClick={() => nav("/g/medications")} />
          <RowCard lead={<span className="lead-ic blue"><Glyph name="calendar" size={24} /></span>} title="일정 관리" description="병원 일정 등록 · 알림 전송" chevron onClick={() => nav("/g/schedules")} />
          <RowCard lead={<span className="lead-ic violet"><Glyph name="bell" size={24} /></span>} title="알림" description="이상 징후 · 일반 알림" chevron onClick={() => nav("/g/alerts")} />
        </div>

        {me && (
          <Card title="내 정보">
            <div className="info-row">
              <span className="k">이름</span>
              <span className="v">{me.user.name}</span>
            </div>
            <div className="info-row">
              <span className="k">이메일</span>
              <span className="v">{me.user.email ?? "—"}</span>
            </div>
            <div className="info-row">
              <span className="k">전화번호</span>
              <span className="v">{prettyPhone(me.user.phone)}</span>
            </div>
            <p className="sub">부모님은 이 이름과 전화번호로 앱에 들어오십니다.</p>
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
          {/* 탈퇴는 되돌릴 수 없다. 로그아웃과 헷갈리지 않게 작게 둔다 */}
          <div className="withdraw-link">
            <button className="text-btn danger" onClick={() => nav("/withdraw")}>
              회원 탈퇴
            </button>
          </div>
        </div>
      </main>

      <GuardianTabs current="more" />
    </div>
  );
}
