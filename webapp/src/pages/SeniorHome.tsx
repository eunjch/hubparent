/** 화면 1 — 어르신 홈 (대시보드).
 *
 *  시안(Warm Care 1번): 로고 → 인사 → 응원 배너 → 2×2 타일 → 날씨 카드 → 탭 4개.
 *  한 화면에서 할 일이 네 개로 끝나고, 스크롤 없이 다 보이는 것이 목적이다 (계획서 9장).
 *
 *  체크 3종 화면은 붙었다(S2·S3·S4). 일정과 리포트는 M3·M4 에서 붙는다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { Backdrop, ICON, Icon } from "../shared/icons";
import type { Me } from "../shared/types";
import {
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
  const [checked, setChecked] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    request<Me>("/me")
      .then(setMe)
      .catch(() => setError("정보를 불러오지 못했습니다. 잠시 후 다시 열어주세요."));
  }, []);

  // 오늘 얼마나 체크했는지 — 건강 지수의 근거
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    Promise.all([
      request<{ status: string }[]>(`/checks/meals?check_date=${day}`),
      request<unknown[]>(`/checks/moods?check_date=${day}`),
      request<{ status: string }[]>("/medications/today"),
    ])
      .then(([meals, moods, doses]) => {
        const done =
          meals.filter((m) => m.status === "ate").length +
          moods.length +
          doses.filter((d) => d.status === "taken").length;
        setChecked({ done, total: 3 + 3 + doses.length });
      })
      .catch(() => setChecked({ done: 0, total: 6 }));
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
        { key: "family", icon: "caregiver", label: "가족", onClick: () => setTab("family") },
        { key: "more", icon: "more", label: "더보기", onClick: () => setTab("more") },
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

  // 오늘 체크한 항목 비율로 만든다. 서버 리포트(M4)가 붙으면 그 값으로 바꾼다.
  const score = checked === null ? 0 : Math.round((checked.done / Math.max(checked.total, 1)) * 100);
  const scoreMessage =
    checked === null
      ? "불러오는 중이에요."
      : checked.done === checked.total
        ? "좋은 컨디션이에요!"
        : `${checked.total - checked.done}가지만 더 확인해 주세요.`;

  return (
    <div className="screen decorated">
      <Backdrop variant="leaf" />
      <BrandBar onBell={() => setTab("alerts")} />

      <main className="screen-body">
        <Greeting
          name={me.user.name}
          headline={headline}
          trailingIcon={icon}
          message="오늘도 건강한 하루 되세요."
        />

        {/* 오늘의 건강 지수 — 체크한 만큼 올라간다. 숫자를 항상 함께 쓴다 (계획서 9장) */}
        <section className="card">
          <div className="score">
            <span className="score-ring" style={{ backgroundImage: `url(${ICON.healthRing})` }}>
              <span className="value">{score}</span>
            </span>
            <span className="score-text">
              <span className="t">오늘의 건강 지수</span>
              <span className="d">{scoreMessage}</span>
            </span>
          </div>
        </section>

        <TileGrid>
          <Tile icon="meal" label="식사 체크" tone="meal" onClick={() => nav("/s/meal")} />
          <Tile icon="pills" label="약 복용" tone="med" onClick={() => nav("/s/med")} />
          <Tile icon="mood" label="기분 체크" tone="mood" onClick={() => nav("/s/mood")} />
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
