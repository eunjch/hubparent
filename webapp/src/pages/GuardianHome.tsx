/** 화면 7 — 자녀 홈.
 *
 *  시안(Warm Care 5번 "오늘 리포트")의 구조를 자녀용으로 쓴다.
 *  인사 → 부모님 전환 → 오늘 상태 행 4개 → 기능 타일 → 응원 문구 → 탭 4개.
 *
 *  식사·기분은 이미 API 가 있어 실제 값을 보여준다.
 *  약 복용·일정은 M3 에 API 가 붙으므로 그때까지 "기록 없음" 으로 둔다 —
 *  "완료 0" 으로 표시하면 "오늘 한 번도 안 드셨다"는 뜻이 되어 자녀가 놀란다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import type { Me, Senior } from "../shared/types";
import {
  Banner,
  BigButton,
  BrandBar,
  Cheer,
  Greeting,
  Notice,
  RowCard,
  Screen,
  Spinner,
  StatusPill,
  TabBar,
  Tile,
  TileGrid,
  type PillTone,
} from "../shared/ui";

interface MealCheck {
  slot: string;
  status: "ate" | "skipped";
}

interface MoodCheck {
  slot: string;
  mood: "good" | "normal" | "bad";
}

const MOOD: Record<string, { label: string; tone: PillTone }> = {
  good: { label: "좋음", tone: "good" },
  normal: { label: "보통", tone: "mid" },
  bad: { label: "힘들어요", tone: "mid" },
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayLabel(): string {
  const d = new Date();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`;
}

export default function GuardianHome() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealCheck[] | null>(null);
  const [moods, setMoods] = useState<MoodCheck[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");

  useEffect(() => {
    (async () => {
      try {
        const info = await request<Me>("/me");
        setMe(info);

        const rows = await request<Senior[]>("/family/seniors");
        setSeniors(rows);
        if (rows.length > 0) setSeniorId(rows[0].id);
      } catch {
        setError("정보를 불러오지 못했습니다.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!seniorId) return;
    setMeals(null);
    setMoods(null);
    const day = today();
    Promise.all([
      request<MealCheck[]>(`/checks/meals?check_date=${day}&user_id=${seniorId}`),
      request<MoodCheck[]>(`/checks/moods?check_date=${day}&user_id=${seniorId}`),
    ])
      .then(([m, o]) => {
        setMeals(m);
        setMoods(o);
      })
      .catch(() => setError("정보를 불러오지 못했습니다."));
  }, [seniorId]);

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
        { key: "family", icon: "family", label: "가족", onClick: () => nav("/g/seniors") },
        { key: "more", icon: "caregiver", label: "더보기", onClick: () => setTab("more") },
      ]}
    />
  );

  if (error) {
    return (
      <Screen title="부모님">
        <Notice tone="error">{error}</Notice>
        <BigButton onClick={signOut}>처음으로</BigButton>
      </Screen>
    );
  }

  if (!me) {
    return (
      <Screen title="부모님">
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
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-tight)" }}>
              <BigButton tone="primary" icon="family" onClick={() => nav("/g/seniors")}>
                부모님 관리
              </BigButton>
              <BigButton onClick={signOut}>로그아웃</BigButton>
            </div>
          )}
        </main>
        {tabs}
      </div>
    );
  }

  const mealDone = meals?.filter((m) => m.status === "ate").length;
  const latestMood = moods?.length ? MOOD[moods[moods.length - 1].mood] : null;
  const current = seniors.find((s) => s.id === seniorId);

  return (
    <div className="screen">
      <BrandBar onBell={() => setTab("alerts")} />

      <main className="screen-body">
        <Greeting
          name={me.user.name}
          headline="좋은 하루 보내세요!"
          trailingIcon="sun"
          message={todayLabel()}
        />

        {seniors.length === 0 && (
          <>
            <Notice>아직 등록된 부모님이 없습니다.</Notice>
            <BigButton tone="primary" icon="family" onClick={() => nav("/g/seniors/new")}>
              부모님 등록하기
            </BigButton>
          </>
        )}

        {seniors.length > 1 && (
          <div className="senior-tabs">
            {seniors.map((s) => (
              <button
                key={s.id}
                className="senior-chip"
                aria-pressed={s.id === seniorId}
                onClick={() => setSeniorId(s.id)}
              >
                {s.name}
                {s.relation ? ` (${s.relation})` : ""}
              </button>
            ))}
          </div>
        )}

        {current && (
          <>
            <Banner
              icon="caregiver"
              title={`${current.name} ${current.relation ?? "님"}`}
              description={current.joined ? "오늘도 잘 지내고 계세요." : "아직 앱에 들어오지 않으셨어요."}
              tone="meal"
              trailingIcon="heart"
            />

            <RowCard
              icon="meal"
              title="식사"
              right={
                mealDone === undefined ? (
                  <StatusPill tone="none">기록 없음</StatusPill>
                ) : (
                  <StatusPill tone={mealDone >= 3 ? "done" : "mid"} withCheck={mealDone >= 3}>
                    {mealDone}/3
                  </StatusPill>
                )
              }
            />
            <RowCard
              icon="pill"
              title="약 복용"
              right={<StatusPill tone="none">기록 없음</StatusPill>}
            />
            <RowCard
              icon="mood"
              title="기분"
              right={
                latestMood ? (
                  <StatusPill tone={latestMood.tone}>{latestMood.label}</StatusPill>
                ) : (
                  <StatusPill tone="none">기록 없음</StatusPill>
                )
              }
            />
            <RowCard
              icon="calendar"
              title="일정"
              right={<StatusPill tone="none">기록 없음</StatusPill>}
            />

            <TileGrid>
              <Tile icon="report" label="오늘 리포트" tone="plan" onClick={() => setTab("report")} />
              <Tile icon="calendar" label="일정 등록" tone="mood" onClick={() => setTab("plan")} />
              <Tile icon="alert" label="알림" tone="meal" onClick={() => setTab("alerts")} />
              <Tile icon="family" label="부모님 관리" tone="contact" onClick={() => nav("/g/seniors")} />
            </TileGrid>

            <Cheer>건강한 오늘이 더 행복한 내일이 됩니다. 늘 응원합니다!</Cheer>
          </>
        )}
      </main>

      {tabs}
    </div>
  );
}
