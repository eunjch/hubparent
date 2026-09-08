/** 화면 1 — 어르신 홈 (대시보드).
 *
 *  시안(Warm Care 1번): 로고 → 인사 → 응원 배너 → 2×2 타일 → 날씨 카드 → 탭 4개.
 *  한 화면에서 할 일이 네 개로 끝나고, 스크롤 없이 다 보이는 것이 목적이다 (계획서 9장).
 *
 *  체크 3종 화면은 M2, 일정은 M3 에서 붙는다. 지금은 진입 타일까지다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { Icon } from "../shared/icons";
import type { Me } from "../shared/types";
import {
  Banner,
  BigButton,
  BrandBar,
  Greeting,
  Notice,
  Screen,
  Spinner,
  TabBar,
  Tile,
  TileGrid,
} from "../shared/ui";

/** 시간대에 맞는 인사. 어르신 화면은 하루 중 언제 열어도 자연스러워야 한다. */
function greetingByHour(): { headline: string; icon: "sun" | "leaf" } {
  const h = new Date().getHours();
  if (h < 11) return { headline: "좋은 아침이에요!", icon: "sun" };
  if (h < 18) return { headline: "좋은 오후예요!", icon: "sun" };
  return { headline: "편안한 저녁 되세요!", icon: "leaf" };
}

function todayLabel(): string {
  const d = new Date();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`;
}

export default function SeniorHome() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");

  useEffect(() => {
    request<Me>("/me")
      .then(setMe)
      .catch(() => setError("정보를 불러오지 못했습니다. 잠시 후 다시 열어주세요."));
  }, []);

  async function signOut() {
    await clearTokens();
    nav("/", { replace: true });
  }

  const tabs = (
    <TabBar
      current={tab}
      items={[
        { key: "home", icon: "home", label: "홈", onClick: () => setTab("home") },
        { key: "report", icon: "report", label: "리포트", onClick: () => setTab("report") },
        { key: "family", icon: "family", label: "가족", onClick: () => setTab("family") },
        { key: "more", icon: "caregiver", label: "더보기", onClick: () => setTab("more") },
      ]}
    />
  );

  if (error) {
    return (
      <Screen title="오늘">
        <Notice tone="error">{error}</Notice>
        <BigButton onClick={signOut}>처음으로</BigButton>
      </Screen>
    );
  }

  if (!me) {
    return (
      <Screen title="오늘">
        <Spinner />
      </Screen>
    );
  }

  if (tab !== "home") {
    return (
      <div className="screen">
        <BrandBar onBell={() => setTab("alerts")} />
        <main className="screen-body">
          <Notice>이 화면은 다음 단계에서 준비됩니다.</Notice>
          {tab === "more" && (
            <div style={{ marginTop: "auto" }}>
              <BigButton onClick={signOut}>로그아웃</BigButton>
            </div>
          )}
        </main>
        {tabs}
      </div>
    );
  }

  const { headline, icon } = greetingByHour();

  return (
    <div className="screen">
      <BrandBar onBell={() => setTab("alerts")} />

      <main className="screen-body">
        <Greeting
          name={me.user.name}
          headline={headline}
          trailingIcon={icon}
          message="오늘도 건강한 하루 되세요."
        />

        <Banner
          icon="leaf"
          title="오늘도"
          description="좋은 하루가 될 거예요."
          tone="med"
          trailingIcon="heart"
        />

        <TileGrid>
          <Tile icon="meal" label="식사 체크" tone="meal" onClick={() => setTab("meal")} />
          <Tile icon="pill" label="약 복용" tone="med" onClick={() => setTab("med")} />
          <Tile icon="mood" label="기분 체크" tone="mood" onClick={() => setTab("mood")} />
          <Tile icon="report" label="오늘 리포트" tone="plan" onClick={() => setTab("report")} />
        </TileGrid>

        <div className="banner warm" style={{ marginTop: 2 }}>
          <Icon name="sun" className="lead" />
          <span className="body">
            <span className="t">{todayLabel()}</span>
            <span className="d">오늘도 함께해요.</span>
          </span>
        </div>
      </main>

      {tabs}
    </div>
  );
}
