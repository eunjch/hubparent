/** 화면 S4 — 기분 체크.
 *
 *  아침·점심·저녁 각각 이모지 세 개 중 하나를 고른다. 고르는 즉시 저장된다 —
 *  "저장하기" 를 따로 누르게 하지 않는다 (계획서 9장: 체크는 1탭 완료).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Icon } from "../shared/icons";
import { send } from "../shared/offlineQueue";
import type { CheckSlot, MoodCheck as Mood, MoodValue } from "../shared/types";
import { Banner, Cheer, Notice, Screen, Spinner } from "../shared/ui";

const SLOTS: { key: CheckSlot; label: string }[] = [
  { key: "breakfast", label: "아침" },
  { key: "lunch", label: "점심" },
  { key: "dinner", label: "저녁" },
];

/** 색만으로 구분하지 않는다. 글자를 항상 함께 쓴다 (계획서 9장). */
const MOODS: { key: MoodValue; label: string; face: string }[] = [
  { key: "good", label: "좋아요", face: "☺" },
  { key: "normal", label: "보통이에요", face: "•" },
  { key: "bad", label: "힘들어요", face: "☹" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MoodCheck() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Mood[] | null>(null);
  const [busy, setBusy] = useState<CheckSlot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Mood[]>(`/checks/moods?check_date=${today()}`)
      .then(setRows)
      .catch(() => setError("기록을 불러오지 못했습니다."));
  }, []);

  async function choose(slot: CheckSlot, mood: MoodValue) {
    setBusy(slot);
    setError("");

    setRows((prev) => {
      const others = (prev ?? []).filter((r) => r.slot !== slot);
      const mine = (prev ?? []).find((r) => r.slot === slot);
      return [...others, { ...(mine ?? { id: "", check_date: today() }), slot, mood } as Mood];
    });

    const saved = await send<Mood>("/checks/moods", {
      method: "POST",
      body: { check_date: today(), slot, mood },
    });
    if (saved) {
      setRows((prev) => [...(prev ?? []).filter((r) => r.slot !== slot), saved]);
    }
    setBusy(null);
  }

  const find = (slot: CheckSlot) => rows?.find((r) => r.slot === slot)?.mood;

  return (
    <Screen title="기분 체크" onBack={() => nav("/s/home")}>
      <Banner
        icon="mood"
        title="오늘 기분은 어떠세요?"
        description="당신의 마음도 소중해요."
        tone="mood"
        trailingIcon="heart"
      />

      {!rows && <Spinner />}
      <Notice tone="error">{error}</Notice>

      {rows && (
        <>
          <p className="ask">지금 기분은 어떠신가요?</p>
          <p className="ask-sub">해당하는 그림을 눌러주세요.</p>

          {SLOTS.map((s) => (
            <div className="mood-row" key={s.key}>
              <span className="when">{s.label}</span>
              <span className="faces">
                {MOODS.map((m) => (
                  <button
                    key={m.key}
                    className={`face-btn ${m.key}${find(s.key) === m.key ? " on" : ""}`}
                    onClick={() => choose(s.key, m.key)}
                    disabled={busy === s.key}
                    aria-pressed={find(s.key) === m.key}
                    aria-label={`${s.label} ${m.label}`}
                  >
                    <span className="face" aria-hidden="true">
                      {m.face}
                    </span>
                    <span className="cap">{m.label}</span>
                  </button>
                ))}
              </span>
            </div>
          ))}

          <Cheer>
            어떤 날이든, 당신의 마음은 소중합니다. 항상 응원할게요.
            <Icon name="heart" size={16} />
          </Cheer>
        </>
      )}
    </Screen>
  );
}
