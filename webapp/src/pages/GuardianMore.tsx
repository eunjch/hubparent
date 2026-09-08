/** 화면 G1-더보기 탭 — 자녀. 관리 화면으로 가는 입구와 내 정보. */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { Backdrop } from "../shared/icons";
import { GuardianTabs } from "../shared/tabs";
import type { Me } from "../shared/types";
import { BigButton, Card, Notice, RowCard, Spinner } from "../shared/ui";
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
    await clearTokens();
    nav("/", { replace: true });
  }

  return (
    <div className="screen decorated">
      <Backdrop />
      <header className="screen-head">
        <span className="icon-btn-space" />
        <h1>더보기</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <Notice tone="error">{error}</Notice>
        {!me && !error && <Spinner />}

        <div className="more-list">
          <RowCard icon="caregiver" title="부모님 관리" description="등록 · 수정 · 로그인 안내" chevron onClick={() => nav("/g/seniors")} />
          <RowCard icon="pills" title="약 복용 시간 설정" description="약 추가 · 알림 켜고 끄기" chevron onClick={() => nav("/g/medications")} />
          <RowCard icon="calendar" title="일정 관리" description="병원 일정 등록 · 알림 전송" chevron onClick={() => nav("/g/schedules")} />
          <RowCard icon="bell" title="알림" description="이상 징후 · 일반 알림" chevron onClick={() => nav("/g/alerts")} />
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
          <BigButton onClick={signOut}>로그아웃</BigButton>
        </div>
      </main>

      <GuardianTabs current="more" />
    </div>
  );
}
