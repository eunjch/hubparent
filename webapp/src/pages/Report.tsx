/** 화면 G1-리포트 탭 — 하루를 자세히 본다 (계획서 7.1 G1 의 기분 변화).
 *
 *  날짜 이동 ‹ › → 요약 3칸 → 기분 변화(아침·점심·저녁) → 식사 → 약 복용.
 *  홈은 "오늘 한눈에", 여기는 "그날 전부" 다.
 *
 *  생활 패턴(시간대별 활동량)은 2026-09-11 에 뺐다 — 걸음 수를 보내는 쪽이 없다.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { request } from "../shared/api";
import { Glyph } from "../shared/glyphs";
import { fileUrl } from "../shared/base";
import { Art, type ArtName, capsuleFor } from "../shared/art";
import { GuardianTabs, dateLabel, localDate, shiftDate } from "../shared/tabs";
import type { CheckSlot, Dose, FamilyReport, MealCheck, MoodValue, Senior } from "../shared/types";
import { PhotoThumb, PhotoView, type Photo } from "../shared/photoView";
import { Card, Notice, ScoreRing, SeniorChips, Spinner, StatusPill } from "../shared/ui";

const SLOTS: { key: CheckSlot; label: string; icon: "sun" | "moon" }[] = [
  { key: "breakfast", label: "아침", icon: "sun" },
  { key: "lunch", label: "점심", icon: "sun" },
  { key: "dinner", label: "저녁", icon: "moon" },
];

const FACE: Record<MoodValue, ArtName> = { good: "emojiGood", normal: "emojiNormal", bad: "emojiBad" };
const MOOD_LABEL: Record<MoodValue, string> = { good: "좋아요", normal: "괜찮아요", bad: "슬퍼요" };

export default function Report() {
  const [params, setParams] = useSearchParams();
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [seniorId, setSeniorId] = useState<string | null>(params.get("user_id"));
  const [day, setDay] = useState(params.get("date") ?? localDate());

  const [report, setReport] = useState<FamilyReport | null>(null);
  const [meals, setMeals] = useState<MealCheck[] | null>(null);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  // 식사 사진 크게 보기 (2026-09-11)
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Senior[]>("/family/seniors")
      .then((rows) => {
        setSeniors(rows);
        if (!seniorId && rows.length > 0) setSeniorId(rows[0].id);
      })
      .catch(() => setError("부모님 정보를 불러오지 못했습니다."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!seniorId) return;
    // 날짜나 부모님이 갈리면 늦게 온 응답은 버린다 (2026-09-11 점검)
    const state = { stale: false };
    setReport(null);
    setMeals(null);
    setDoses(null);
    setError("");
    setParams({ user_id: seniorId, date: day }, { replace: true });

    // 하나가 실패해도 나머지는 보여 준다. 예전에는 한 건이 실패하면
    // 식사·약·기분까지 통째로 감춰졌다.
    const settle = <T,>(p: Promise<T>) => p.then((v) => v).catch(() => null);

    void Promise.all([
      settle(request<FamilyReport>(`/reports/family/${seniorId}?report_date=${day}`)),
      settle(request<MealCheck[]>(`/checks/meals?check_date=${day}&user_id=${seniorId}`)),
      settle(request<Dose[]>(`/medications/today?user_id=${seniorId}&day=${day}`)),
    ]).then(([r, m, d]) => {
      if (state.stale) return;
      setReport(r);
      setMeals(m);
      setDoses(d);
      // 하나라도 못 받았으면 말한다. 식사만 실패했는데 조용히 두면 세 끼가 "미기록" 으로
      // 보여, 자녀는 부모님이 굶은 것으로 읽는다 (2026-09-11 재점검).
      if ([r, m, d].some((x) => x === null)) {
        setError("일부 기록을 불러오지 못했습니다. 화면의 숫자가 실제와 다를 수 있어요.");
      }
    });

    return () => {
      state.stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seniorId, day]);

  const isToday = day === localDate();
  const current = seniors.find((s) => s.id === seniorId);
  const r = report;
  const moodOf = (slot: CheckSlot) => r?.moods.find((m) => m.slot === slot)?.mood;
  const mealOf = (slot: CheckSlot) => meals?.find((m) => m.slot === slot);

  return (
    <div className="screen">
      <header className="screen-head">
        <span className="icon-btn-space" />
        <h1>리포트</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <SeniorChips seniors={seniors} current={seniorId} onChange={setSeniorId} />

        {/* 날짜 이동. 오늘 이후로는 못 간다 */}
        <div className="date-nav">
          <button className="icon-btn" onClick={() => setDay(shiftDate(day, -1))} aria-label="하루 전"><Glyph name="back" size={26} /></button>
          <span className="date-nav-label">
            {dateLabel(day)}
            {isToday && <span className="today-tag">오늘</span>}
          </span>
          <button
            className="icon-btn"
            onClick={() => setDay(shiftDate(day, 1))}
            disabled={isToday}
            aria-label="하루 뒤"
          >
            ›
          </button>
        </div>

        <Notice tone="error">{error}</Notice>
        {seniors.length === 0 && !error && <Notice>먼저 부모님을 등록해 주세요.</Notice>}
        {seniorId && !r && !error && <Spinner />}

        {r && current && (
          <>
            <Card title={`${current.name} ${current.relation ?? ""} 요약`}>
              <div className="summary-head">
                <ScoreRing score={r.score} />
                <span className="msg">
                  <span className="t">{r.summary_text}</span>
                  <span className="d">식사 · 기분 · 약 복용을 채운 비율이에요.</span>
                </span>
              </div>
              <div className="summary-grid">
                <span className="summary-cell">
                  <Art name="bowlSm" blend />
                  <span className="k">식사</span>
                  <span className="v">
                    {r.meal_done}/{r.meal_total}
                  </span>
                </span>
                <span className="summary-cell">
                  <Art name="capsuleSm" blend />
                  <span className="k">약 복용</span>
                  <span className="v">{r.med_total ? `${r.med_taken}/${r.med_total}` : "—"}</span>
                </span>
                <span className="summary-cell">
                  <Art name="smileySm" blend />
                  <span className="k">기분</span>
                  <span className="v">{r.moods.length}/3</span>
                </span>
              </div>
            </Card>

            {/* 기분 변화 — 시안 G1 */}
            <Card title="기분 변화">
              <div className="mood-trio">
                {SLOTS.map((s) => {
                  const m = moodOf(s.key);
                  return (
                    <span className={`mood-slot${m ? ` ${m}` : ""}`} key={s.key}>
                      <span className="face" aria-hidden="true">
                        {m ? <Art name={FACE[m]} /> : "·"}
                      </span>
                      <span className="k">{s.label}</span>
                      <span className="v">{m ? MOOD_LABEL[m] : "미기록"}</span>
                    </span>
                  );
                })}
              </div>
            </Card>

            <Card title="식사">
              {SLOTS.map((s) => {
                const m = mealOf(s.key);
                return (
                  <div className="detail-row" key={s.key}>
                    <span className={`slot-ic ${s.icon}`} aria-hidden="true">
                      <Glyph name={s.icon} size={20} />
                    </span>
                    <span className="t">{s.label}</span>
                    {m?.photo_path && (
                      <PhotoThumb
                        photo={{
                          src: fileUrl(m.photo_path),
                          alt: `${s.label} 식사 사진`,
                          caption: `${current.name} · ${s.label} · ${dateLabel(day)}`,
                        }}
                        onOpen={setPhoto}
                      />
                    )}
                    <StatusPill tone={m?.status === "ate" ? "done" : m ? "mid" : "none"}>
                      {m?.status === "ate" ? "먹었어요" : m ? "안 먹었어요" : "미기록"}
                    </StatusPill>
                  </div>
                );
              })}
            </Card>

            <Card title="약 복용">
              {doses && doses.length === 0 && <p className="sub">등록된 약이 없어요.</p>}
              {doses?.map((d, i) => (
                <div className="detail-row" key={d.medication_id + d.scheduled_at}>
                  <Art name={capsuleFor(i)} blend />
                  <span className="t">
                    <span className="time">{d.time}</span> {d.name}
                  </span>
                  <StatusPill tone={d.status === "taken" ? "done" : d.status === "missed" ? "mid" : "none"}>
                    {d.status === "taken" ? "먹었어요" : d.status === "missed" ? "안 먹었어요" : "응답 없음"}
                  </StatusPill>
                </div>
              ))}
            </Card>

            {/* 생활 패턴(시간대별 활동량) 카드는 뺐다 (2026-09-11).
                걸음 수를 보내는 쪽이 아직 없어 24개 막대가 늘 바닥에 붙어 있었고,
                "기록 없음" 배지만 매일 떴다. 서버의 /reports/activity 는 살아 있다. */}
          </>
        )}
      </main>

      <PhotoView photo={photo} onClose={() => setPhoto(null)} />

      <GuardianTabs current="report" />
    </div>
  );
}
