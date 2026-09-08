/** 화면 G1 — 부모님 리포트 (시안 "① 부모님 리포트 (한눈에 확인)").
 *
 *  우리 부모님 전환 → 오늘의 건강 요약(링 + 4칸) → 최근 7일 추이 → 탭바 4개.
 *  탭은 홈 · 리포트 · 메시지 · 더보기 다.
 *
 *  건강 지수와 7일 추이는 지금 클라이언트가 계산한다.
 *  서버 리포트(M4)가 붙으면 그 값으로 바꾼다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { Backdrop, Icon } from "../shared/icons";
import type { Dose, Me, Senior } from "../shared/types";
import {
  BigButton,
  Card,
  Notice,
  ScoreRing,
  Screen,
  Spinner,
  TabBar,
  Tile,
  TileGrid,
} from "../shared/ui";

interface MealCheck {
  slot: string;
  status: "ate" | "skipped";
}

interface MoodCheck {
  slot: string;
  mood: "good" | "normal" | "bad";
}

const MOOD_LABEL: Record<string, string> = { good: "좋음", normal: "보통", bad: "힘듦" };

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
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
  const [picking, setPicking] = useState(false);

  const [meals, setMeals] = useState<MealCheck[] | null>(null);
  const [moods, setMoods] = useState<MoodCheck[] | null>(null);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [trend, setTrend] = useState<{ date: string; score: number }[]>([]);

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
    setDoses(null);

    const day = isoDate();
    Promise.all([
      request<MealCheck[]>(`/checks/meals?check_date=${day}&user_id=${seniorId}`),
      request<MoodCheck[]>(`/checks/moods?check_date=${day}&user_id=${seniorId}`),
      request<Dose[]>(`/medications/today?user_id=${seniorId}`),
    ])
      .then(([m, o, d]) => {
        setMeals(m);
        setMoods(o);
        setDoses(d);
      })
      .catch(() => setError("정보를 불러오지 못했습니다."));
  }, [seniorId]);

  // 최근 7일 추이. 하루치씩 모아 점수로 만든다.
  useEffect(() => {
    if (!seniorId) return;
    const days = [6, 5, 4, 3, 2, 1, 0].map((n) => isoDate(-n));

    Promise.all(
      days.map(async (day) => {
        const [m, o] = await Promise.all([
          request<MealCheck[]>(`/checks/meals?check_date=${day}&user_id=${seniorId}`),
          request<MoodCheck[]>(`/checks/moods?check_date=${day}&user_id=${seniorId}`),
        ]);
        const done = m.filter((x) => x.status === "ate").length + o.length;
        return { date: day, score: Math.round((done / 6) * 100) };
      }),
    )
      .then(setTrend)
      .catch(() => setTrend([]));
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
        { key: "message", icon: "message", label: "메시지", onClick: () => setTab("message") },
        { key: "more", icon: "more", label: "더보기", onClick: () => setTab("more") },
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
      <div className="screen decorated">
        <Backdrop />
        <main className="screen-body">
          <Notice>이 화면은 다음 단계에서 준비됩니다.</Notice>
          {tab === "more" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-tight)" }}>
              <BigButton tone="primary" icon="caregiver" onClick={() => nav("/g/seniors")}>
                부모님 관리
              </BigButton>
              <BigButton icon="pills" onClick={() => nav("/g/medications")}>
                약 복용 시간 설정
              </BigButton>
              <BigButton icon="calendar" onClick={() => nav("/g/schedules")}>
                일정 관리
              </BigButton>
              <BigButton onClick={signOut}>로그아웃</BigButton>
            </div>
          )}
        </main>
        {tabs}
      </div>
    );
  }

  const current = seniors.find((s) => s.id === seniorId);
  const mealDone = meals?.filter((m) => m.status === "ate").length;
  const medTaken = doses?.filter((d) => d.status === "taken").length;
  const latestMood = moods?.length ? MOOD_LABEL[moods[moods.length - 1].mood] : null;

  const doneToday = (mealDone ?? 0) + (moods?.length ?? 0) + (medTaken ?? 0);
  const totalToday = 3 + 3 + (doses?.length ?? 0);
  const score = meals === null ? 0 : Math.round((doneToday / Math.max(totalToday, 1)) * 100);

  const yesterday = trend.length >= 2 ? trend[trend.length - 2].score : null;
  const scoreNote =
    yesterday === null
      ? "오늘 기록을 확인하세요."
      : score > yesterday
        ? "어제보다 조금 더 건강하세요!"
        : score === yesterday
          ? "어제와 비슷하게 지내고 계세요."
          : "어제보다 기록이 적어요.";

  const trendAvg = trend.length
    ? Math.round(trend.reduce((a, b) => a + b.score, 0) / trend.length)
    : 0;
  const trendLabel = trendAvg >= 70 ? "좋음" : trendAvg >= 40 ? "보통" : "주의";

  return (
    <div className="screen decorated">
      <Backdrop />

      <main className="screen-body">
        {/* 우리 부모님 ⌄ + 날짜 + 알림 */}
        <div className="whose">
          <button
            className="whose-pick"
            onClick={() => seniors.length > 1 && setPicking((v) => !v)}
            aria-expanded={picking}
          >
            {current ? `${current.name} ${current.relation ?? "님"}` : "우리 부모님"}
            {seniors.length > 1 && <span aria-hidden="true"> ⌄</span>}
          </button>
          <span className="whose-date">{todayLabel()}</span>
          <button className="bell-btn" onClick={() => setTab("message")} aria-label="알림">
            <Icon name="bell" />
          </button>
        </div>

        {picking && seniors.length > 1 && (
          <div className="whose-list">
            {seniors.map((s) => (
              <button
                key={s.id}
                className={`whose-item${s.id === seniorId ? " on" : ""}`}
                onClick={() => {
                  setSeniorId(s.id);
                  setPicking(false);
                }}
              >
                {s.name} {s.relation ?? ""}
              </button>
            ))}
          </div>
        )}

        {seniors.length === 0 && (
          <>
            <Notice>아직 등록된 부모님이 없습니다.</Notice>
            <BigButton tone="primary" icon="caregiver" onClick={() => nav("/g/seniors/new")}>
              부모님 등록하기
            </BigButton>
          </>
        )}

        {current && (
          <>
            {/* 오늘의 건강 요약 — 링 + 4칸 (시안) */}
            <Card title="오늘의 건강 요약">
              <div className="summary-head">
                <ScoreRing score={score} />
                <span className="msg">
                  <span className="t">{scoreNote}</span>
                  <span className="d">
                    {current.joined ? "오늘도 잘 지내고 계세요." : "아직 앱에 들어오지 않으셨어요."}
                  </span>
                </span>
              </div>

              <div className="summary-grid">
                <span className="summary-cell">
                  <Icon name="meal" />
                  <span className="k">식사</span>
                  <span className="v">{mealDone === undefined ? "—" : `${mealDone}/3`}</span>
                  <span className={`s ${mealDone === 3 ? "ok" : "mid"}`}>
                    {mealDone === 3 ? "완료" : "진행"}
                  </span>
                </span>

                <span className="summary-cell">
                  <Icon name="pills" />
                  <span className="k">약 복용</span>
                  <span className="v">
                    {doses === null || doses.length === 0 ? "—" : `${medTaken}/${doses.length}`}
                  </span>
                  <span
                    className={`s ${
                      doses && doses.length > 0 && medTaken === doses.length ? "ok" : "none"
                    }`}
                  >
                    {doses === null
                      ? "확인 중"
                      : doses.length === 0
                        ? "등록 안 됨"
                        : medTaken === doses.length
                          ? "완료"
                          : "진행"}
                  </span>
                </span>

                <span className="summary-cell">
                  <Icon name="activity" />
                  <span className="k">활동</span>
                  <span className="v">—</span>
                  <span className="s none">기록 없음</span>
                </span>

                <span className="summary-cell">
                  <Icon name="mood" />
                  <span className="k">기분</span>
                  <span className="v">{latestMood ?? "—"}</span>
                  <span className={`s ${latestMood ? "ok" : "none"}`}>
                    {latestMood ? "기록됨" : "미기록"}
                  </span>
                </span>
              </div>
            </Card>

            {/* 최근 7일 건강 추이 */}
            <Card
              title="최근 7일 건강 추이"
              action={
                <span className={`trend-badge ${trendAvg >= 70 ? "ok" : "mid"}`}>{trendLabel}</span>
              }
            >
              <div className="trend">
                {trend.map((t) => (
                  <span className="trend-col" key={t.date}>
                    <span className="bar-wrap">
                      <span className="bar" style={{ height: `${Math.max(6, t.score)}%` }} />
                    </span>
                    <span className="lab">{shortDate(t.date)}</span>
                  </span>
                ))}
                {trend.length === 0 && <span className="sub">기록을 모으는 중이에요.</span>}
              </div>
            </Card>

            <TileGrid>
              <Tile
                icon="calendar"
                label="일정 관리"
                description="병원 일정 등록"
                tone="plan"
                onClick={() => nav("/g/schedules")}
              />
              <Tile
                icon="pills"
                label="약 복용 시간"
                description="복용 시간 설정"
                tone="med"
                onClick={() => nav("/g/medications")}
              />
              <Tile
                icon="alert"
                label="이상 징후"
                description="알림 확인하기"
                tone="mood"
                onClick={() => setTab("message")}
              />
              <Tile
                icon="caregiver"
                label="부모님 관리"
                description="등록 · 수정"
                tone="contact"
                onClick={() => nav("/g/seniors")}
              />
            </TileGrid>
          </>
        )}
      </main>

      {tabs}
    </div>
  );
}
