/** 화면 G1 — 부모님 리포트 (시안 "① 부모님 리포트 (한눈에 확인)").
 *
 *  우리 부모님 전환 → 오늘의 건강 요약(링 + 4칸) → 최근 7일 추이 → 탭바 4개.
 *  탭은 홈 · 리포트 · 메시지 · 더보기 다.
 *
 *  숫자는 전부 서버 리포트(/reports/family)가 준다. 화면은 계산하지 않는다.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { Art } from "../shared/art";
import { Glyph } from "../shared/glyphs";
import { GuardianTabs } from "../shared/tabs";
import type { ActivityLevel, FamilyReport, Me, MoodValue, Senior } from "../shared/types";
import {
  BigButton,
  Card,
  Notice,
  ScoreRing,
  Screen,
  Spinner,
  Tile,
  TileGrid,
} from "../shared/ui";

const MOOD_LABEL: Record<MoodValue, string> = { good: "좋음", normal: "보통", bad: "힘듦" };
const ACTIVITY_LABEL: Record<ActivityLevel, string> = { high: "활발", normal: "정상", low: "적음" };

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
  const [report, setReport] = useState<FamilyReport | null>(null);

  const [error, setError] = useState("");

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

  /* 부모님을 빠르게 전환하면 먼저 보낸 요청이 나중에 도착해, 화면 위쪽 이름과
     아래 숫자가 서로 다른 사람 것이 될 수 있었다. 갈아탄 요청의 응답은 버린다
     (2026-09-11 점검). stale 은 이 효과가 끝났는지를 가리킨다. */
  // 알림을 꺼 둔 부모님. 복약 알림이 안 울리는데 아무도 모르던 것 (계획서 8.5.8)
  const notifyOff = seniors.filter((s) => s.notifications_granted === false);

  const loadReport = useCallback(
    async (state?: { stale: boolean }) => {
      if (!seniorId) return;
      try {
        const next = await request<FamilyReport>(`/reports/family/${seniorId}`);
        if (state?.stale) return;
        setReport(next);
        setError("");
      } catch {
        if (state?.stale) return;
        setError("정보를 불러오지 못했습니다.");
      }
    },
    [seniorId],
  );

  useEffect(() => {
    const state = { stale: false };
    setReport(null);
    setError("");
    void loadReport(state);
    return () => {
      state.stale = true;
    };
  }, [loadReport]);

  async function signOut() {
    await clearTokens();
    nav("/", { replace: true });
  }

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

  const current = seniors.find((s) => s.id === seniorId);
  const r = report;
  const score = r?.score ?? 0;
  const latestMood = r && r.moods.length > 0 ? MOOD_LABEL[r.moods[r.moods.length - 1].mood] : null;

  const yesterday = r && r.trend.length >= 2 ? r.trend[r.trend.length - 2].score : null;
  const scoreNote =
    !r
      ? "오늘 기록을 확인하세요."
      : yesterday === null
        ? "오늘 기록을 확인하세요."
        : score > yesterday
          ? "어제보다 조금 더 건강하세요!"
          : score === yesterday
            ? "어제와 비슷하게 지내고 계세요."
            : "어제보다 기록이 적어요.";

  const trend = r?.trend ?? [];
  const trendAvg = trend.length
    ? Math.round(trend.reduce((a, b) => a + b.score, 0) / trend.length)
    : 0;
  const trendLabel = trendAvg >= 70 ? "좋음" : trendAvg >= 40 ? "보통" : "주의";
  const unread = r?.unread_alerts ?? 0;

  return (
    <div className="screen">
      <main className="screen-body">
        {notifyOff.length > 0 && (
          <Notice tone="error">
            {notifyOff.map((s) => s.name).join(" · ")} 님의 폰에서 알림이 꺼져 있어요. 약 드실
            시간을 알려드릴 수 없으니 대신 챙겨 주세요.
          </Notice>
        )}

        {/* 우리 부모님 ⌄ + 날짜 + 알림 */}
        <div className="whose">
          <div className="whose-text">
            <button
              className="whose-pick"
              onClick={() => seniors.length > 1 && setPicking((v) => !v)}
              aria-expanded={picking}
            >
              우리 부모님
              {seniors.length > 1 && <Glyph name="chevron" size={20} style={{ transform: "rotate(90deg)" }} />}
            </button>
            <span className="whose-date">
              {current ? `${current.name} ${current.relation ?? ""} · ` : ""}
              {todayLabel()}
            </span>
          </div>
          <div className="right">
            <Art name="avatarPair" className="pair" />
            <button
              className="bell-btn"
              onClick={() => nav("/g/alerts")}
              aria-label={unread > 0 ? `알림 ${unread}건 미확인` : "알림"}
            >
              <Glyph name="bell" size={26} />
              {unread > 0 && <span className="dot" aria-hidden="true" />}
            </button>
          </div>
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
                  <Art name="bowlSm" blend />
                  <span className="k">식사</span>
                  <span className="v">{r ? `${r.meal_done}/${r.meal_total}` : "—"}</span>
                  <span className={`s ${r && r.meal_done === r.meal_total ? "ok" : "mid"}`}>
                    {r && r.meal_done === r.meal_total ? "완료" : "진행"}
                  </span>
                </span>

                <span className="summary-cell">
                  <Art name="capsuleSm" blend />
                  <span className="k">약 복용</span>
                  <span className="v">{r && r.med_total > 0 ? `${r.med_taken}/${r.med_total}` : "—"}</span>
                  <span
                    className={`s ${r && r.med_total > 0 && r.med_taken === r.med_total ? "ok" : "none"}`}
                  >
                    {!r
                      ? "확인 중"
                      : r.med_total === 0
                        ? "등록 안 됨"
                        : r.med_taken === r.med_total
                          ? "완료"
                          : "진행"}
                  </span>
                </span>

                <span className="summary-cell">
                  <Art name="runnerSm" blend />
                  <span className="k">활동</span>
                  <span className="v">{r?.activity_level ? ACTIVITY_LABEL[r.activity_level] : "—"}</span>
                  <span className={`s ${r?.activity_level ? "ok" : "none"}`}>
                    {r?.activity_level ? "기록됨" : "기록 없음"}
                  </span>
                </span>

                <span className="summary-cell">
                  <Art name="smileySm" blend />
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
              <Tile variant="guardian" art="calendarTile" label="일정 관리" description="병원 일정 등록" tone="plan" onClick={() => nav("/g/schedules")} />
              <Tile variant="guardian" art="capsuleTile" label="복약 시간" description="복용 시간 설정" tone="med" onClick={() => nav("/g/medications")} />
              <Tile
                variant="guardian"
                art="bellRed"
                label="이상 징후"
                description={unread > 0 ? `${unread}건 확인하기` : "알림 확인하기"}
                tone="mood"
                onClick={() => nav("/g/alerts")}
              />
              <Tile variant="guardian" art="personBlue" label="부모님" description="등록 · 수정" tone="contact" onClick={() => nav("/g/seniors")} />
            </TileGrid>
          </>
        )}
      </main>

      <GuardianTabs current="home" />
    </div>
  );
}
