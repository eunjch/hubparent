/** 화면 G1 — 부모님 리포트 (시안 "① 부모님 리포트 (한눈에 확인)").
 *
 *  로고 + 부모님 전환 → 오늘의 건강 요약(링 + 3칸) → 최근 7일 추이 → 탭바 4개.
 *  탭은 홈 · 리포트 · 알림 · 더보기 다.
 *
 *  숫자는 전부 서버 리포트(/reports/family)가 준다. 화면은 계산하지 않는다.
 *  추이 막대를 누르면 그날 하루를 다시 불러 팝업으로 보여 준다.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Art } from "../shared/art";
import { Glyph } from "../shared/glyphs";
import { useOverlayBack } from "../shared/overlay";
import { dateLabel, GuardianTabs } from "../shared/tabs";
import type { CheckSlot, FamilyReport, Me, MoodValue, Senior } from "../shared/types";
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

const MOOD_LABEL: Record<MoodValue, string> = { good: "좋음", normal: "보통", bad: "슬픔" };
const SLOT_LABEL: Record<CheckSlot, string> = { breakfast: "아침", lunch: "점심", dinner: "저녁" };
const SLOT_ORDER: CheckSlot[] = ["breakfast", "lunch", "dinner"];

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 팝업 네 줄. 값이 없는 줄은 흐리게 둬서 "안 한 것"과 "한 것"이 눈에 갈린다. */
function dayRows(r: FamilyReport) {
  const moods = SLOT_ORDER.filter((s) => r.moods.some((m) => m.slot === s));
  return [
    {
      key: "meal",
      art: "bowlSm" as const,
      label: "식사",
      value: `${r.meal_done}/${r.meal_total}끼`,
      state: r.meal_done === 0 ? "empty" : r.meal_done >= r.meal_total ? "full" : "some",
    },
    {
      key: "med",
      art: "capsuleSm" as const,
      label: "약 복용",
      value: r.med_total === 0 ? "등록된 약 없음" : `${r.med_taken}/${r.med_total}회`,
      state:
        r.med_total === 0 || r.med_taken === 0
          ? "empty"
          : r.med_taken >= r.med_total
            ? "full"
            : "some",
    },
    {
      key: "mood",
      art: "smileySm" as const,
      label: "기분",
      // 기분만은 "다 채웠으니 초록"이 아니다. 세 번 다 적었어도 내용이 "슬픔"이면
      // 잘한 날처럼 보이면 안 된다 — 값마다 제 색을 준다 (2026-09-11).
      value:
        moods.length === 0 ? (
          "기록 없음"
        ) : (
          <span className="mood-list">
            {moods.map((s) => {
              const mood = r.moods.find((m) => m.slot === s)!.mood;
              return (
                <span className={`mood-bit ${mood}`} key={s}>
                  <em>{SLOT_LABEL[s]}</em>
                  {MOOD_LABEL[mood]}
                </span>
              );
            })}
          </span>
        ),
      state: moods.length === 0 ? "empty" : "some",
    },
    /* 활동(걸음 수)은 뺐다 (2026-09-11). 걸음 수를 보내는 쪽이 아직 없어서
       언제나 "기록 없음" 이었고, 자녀가 부모님이 안 움직인 것으로 오해할 자리였다.
       서버의 ActivitySignal · /signals 는 그대로 살아 있다 — 붙이면 되살린다. */
  ];
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
  // 다시 시도 버튼이 값을 바꾸면 아래 effect 들이 다시 돈다
  const [attempt, setAttempt] = useState(0);
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [report, setReport] = useState<FamilyReport | null>(null);

  /* 추이 막대를 누르면 그날 하루를 따로 불러 온다 (2026-09-11).
     막대만 보고는 "32점" 이 무엇 때문인지 알 수 없어서, 숫자를 만든 재료를 보여 준다. */
  const [dayPick, setDayPick] = useState<string | null>(null);
  const [dayReport, setDayReport] = useState<FamilyReport | null>(null);
  const [dayError, setDayError] = useState("");

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
  }, [attempt]);

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
  }, [loadReport, attempt]);

  /* 부모님을 바꾸면 열려 있던 날짜 팝업은 다른 사람 기록이 된다. 닫는다. */
  useEffect(() => {
    setDayPick(null);
  }, [seniorId]);

  useEffect(() => {
    if (!dayPick || !seniorId) return;
    const state = { stale: false };
    setDayReport(null);
    setDayError("");
    (async () => {
      try {
        const next = await request<FamilyReport>(
          `/reports/family/${seniorId}?report_date=${dayPick}`,
        );
        if (!state.stale) setDayReport(next);
      } catch {
        if (!state.stale) setDayError("그날 기록을 불러오지 못했습니다.");
      }
    })();
    return () => {
      state.stale = true;
    };
  }, [dayPick, seniorId]);

  /* Esc 로도 닫힌다. 열려 있는 동안 뒤가 스크롤되면 닫았을 때 다른 자리에 가 있다 */
  useEffect(() => {
    if (!dayPick) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDayPick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [dayPick]);

  /* 안드로이드 뒤로가기도 덮개부터 닫는다 (앱이 꺼지면 안 된다) */
  useOverlayBack(dayPick !== null, () => setDayPick(null));
  useOverlayBack(picking, () => setPicking(false));

  if (error) {
    // 통신이 한 번 끊긴 것뿐일 수 있다. 유일한 버튼이 로그아웃이면 안 된다 (2026-09-11 재점검)
    return (
      <Screen title="부모님">
        <Notice tone="error">{error}</Notice>
        <BigButton tone="primary" onClick={() => setAttempt((n) => n + 1)}>
          다시 시도
        </BigButton>
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
    <div className="screen g-home">
      <main className="screen-body">
        {notifyOff.length > 0 && (
          <Notice tone="error">
            {notifyOff.map((s) => s.name).join(" · ")} 님의 폰에서 알림이 꺼져 있어요. 약 드실
            시간을 알려드릴 수 없으니 대신 챙겨 주세요.
          </Notice>
        )}

        {/* 로고 → 보고 있는 부모님 → 날짜 + 알림.
            "우리 부모님" 이라는 제목은 뺐다 (2026-09-11). 자리만 차지하고 알려 주는 게 없었다.
            지금 누구를 보고 있는지가 제목 자리로 올라오고, 눌러서 다른 분으로 바꾼다. */}
        <div className="whose">
          <div className="whose-text">
            <div className="whose-top">
              <Art name="logo" className="whose-logo" />
              <button
                className="whose-pick"
                onClick={() => seniors.length > 1 && setPicking((v) => !v)}
                aria-expanded={picking}
                aria-label={
                  seniors.length > 1 && current
                    ? `${current.name} ${current.relation ?? ""} — 다른 부모님 고르기`
                    : undefined
                }
              >
                {current ? `${current.name} ${current.relation ?? ""}`.trim() : "부모님"}
                {seniors.length > 1 && (
                  <Glyph
                    name="chevron"
                    size={20}
                    style={{ transform: picking ? "rotate(270deg)" : "rotate(90deg)" }}
                  />
                )}
              </button>
            </div>

            {/* 이름 바로 밑에 붙는 드롭다운. 예전에는 본문 사이에 끼어들어 화면을
                통째로 아래로 밀었다 — 한 화면에 맞춰 둔 것이 무너졌다 (2026-09-11). */}
            {picking && seniors.length > 1 && (
              <div className="whose-list" role="listbox" aria-label="부모님 고르기">
                {seniors.map((s) => (
                  <button
                    key={s.id}
                    role="option"
                    aria-selected={s.id === seniorId}
                    className={`whose-item${s.id === seniorId ? " on" : ""}`}
                    onClick={() => {
                      setSeniorId(s.id);
                      setPicking(false);
                    }}
                  >
                    <span className="nm">
                      {s.name} {s.relation ?? ""}
                    </span>
                    {s.id === seniorId && <Glyph name="check" size={20} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="right">
            <Art name="avatarPair" className="pair" />
            {/* 종의 숫자는 지금 보고 있는 부모님 것만 센다. 그냥 넘기면 알림 화면이
                온 가족 것을 보여 줘 숫자와 목록이 어긋났다 (2026-09-11). 보던 분을 넘긴다. */}
            <button
              className="bell-btn"
              onClick={() => nav(seniorId ? `/g/alerts?user_id=${seniorId}` : "/g/alerts")}
              aria-label={unread > 0 ? `알림 ${unread}건 미확인` : "알림"}
            >
              <Glyph name="bell" size={26} />
              {unread > 0 && <span className="dot" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* 목록 밖을 눌러도 닫힌다. 예전에는 한 번 열면 이름을 다시 눌러야만 닫혔다 */}
        {picking && seniors.length > 1 && (
          <button className="pick-veil" onClick={() => setPicking(false)} aria-label="목록 닫기" />
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
            {/* 오늘의 건강 요약 — 링 + 4칸 (시안).
                날짜는 머리글에서 이 제목 옆으로 옮겼다 (2026-09-11). 어느 날 기록인지는
                숫자 바로 옆에 있어야 읽히고, 머리글은 로고와 이름만 남아 가벼워진다. */}
            <Card title="오늘의 건강 요약" action={<span className="card-date">{todayLabel()}</span>}>
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
                  <button
                    type="button"
                    className={`trend-col${dayPick === t.date ? " on" : ""}`}
                    key={t.date}
                    onClick={() => setDayPick(t.date)}
                    aria-label={`${dateLabel(t.date)} ${t.score}점 — 그날 기록 보기`}
                  >
                    <span className="bar-wrap">
                      <span className="bar" style={{ height: `${Math.max(6, t.score)}%` }} />
                    </span>
                    <span className="lab">{shortDate(t.date)}</span>
                  </button>
                ))}
                {trend.length === 0 && <span className="sub">기록을 모으는 중이에요.</span>}
              </div>
              <p className="trend-hint">막대를 누르면 그날 기록을 볼 수 있어요.</p>
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
                onClick={() => nav(seniorId ? `/g/alerts?user_id=${seniorId}` : "/g/alerts")}
              />
              <Tile variant="guardian" art="personBlue" label="부모님" description="등록 · 수정" tone="contact" onClick={() => nav("/g/seniors")} />
            </TileGrid>
          </>
        )}
      </main>

      {dayPick && (
        <div
          className="day-pop"
          role="dialog"
          aria-modal="true"
          aria-label={`${dateLabel(dayPick)} 기록`}
          onClick={() => setDayPick(null)}
        >
          {/* 카드 안을 눌렀을 때는 닫히면 안 된다 */}
          <div className="day-card" onClick={(e) => e.stopPropagation()}>
            <div className="day-head">
              <h2>{dateLabel(dayPick)}</h2>
              <button className="icon-btn" onClick={() => setDayPick(null)} aria-label="닫기">
                <Glyph name="close" size={22} />
              </button>
            </div>

            {dayError ? (
              <Notice tone="error">{dayError}</Notice>
            ) : !dayReport ? (
              <Spinner />
            ) : (
              <>
                <div className="day-score">
                  <ScoreRing score={dayReport.score} size="sm" />
                  <span className="lab">
                    건강 지수 {dayReport.score}점
                    <em>{dayReport.summary_text}</em>
                  </span>
                </div>

                <dl className="day-rows">
                  {dayRows(dayReport).map((row) => (
                    <div key={row.key} className={row.state}>
                      <dt>
                        <Art name={row.art} blend />
                        {row.label}
                      </dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        </div>
      )}

      <GuardianTabs current="home" />
    </div>
  );
}
