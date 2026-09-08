/** 화면 S2 — 식사 체크.
 *
 *  아침·점심·저녁 각각 "먹었어요 / 안 먹었어요" 두 버튼. 1탭으로 끝난다.
 *  이미 누른 것도 다시 누르면 바뀐다 — 잘못 눌렀을 때 되돌릴 수 있어야 한다 (계획서 9장).
 *
 *  사진은 선택이다. 안 올려도 체크는 끝난다 (계획서 8.5.8).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { pickMealPhoto } from "../native/bridge";
import { ApiError, request, upload } from "../shared/api";
import { Icon } from "../shared/icons";
import { send } from "../shared/offlineQueue";
import type { CheckSlot, MealCheck as Meal, MealStatus } from "../shared/types";
import { Banner, BigButton, Cheer, Notice, Screen, Spinner } from "../shared/ui";

const SLOTS: { key: CheckSlot; label: string; icon: "sun" | "leaf"; hint: string }[] = [
  { key: "breakfast", label: "아침", icon: "sun", hint: "든든한 하루의 시작" },
  { key: "lunch", label: "점심", icon: "sun", hint: "맛있는 점심 드셨어요?" },
  { key: "dinner", label: "저녁", icon: "leaf", hint: "편안한 저녁 되세요" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MealCheck() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Meal[] | null>(null);
  const [busy, setBusy] = useState<CheckSlot | null>(null);
  const [error, setError] = useState("");
  const [photoNote, setPhotoNote] = useState("");

  useEffect(() => {
    request<Meal[]>(`/checks/meals?check_date=${today()}`)
      .then(setRows)
      .catch(() => setError("기록을 불러오지 못했습니다."));
  }, []);

  async function answer(slot: CheckSlot, status: MealStatus) {
    setBusy(slot);
    setError("");

    // 화면을 먼저 바꾼다. 통신이 느려도 어르신은 눌린 것을 바로 봐야 한다.
    setRows((prev) => {
      const others = (prev ?? []).filter((r) => r.slot !== slot);
      const mine = (prev ?? []).find((r) => r.slot === slot);
      return [...others, { ...(mine ?? { id: "", check_date: today(), photo_path: null }), slot, status } as Meal];
    });

    const saved = await send<Meal>("/checks/meals", {
      method: "POST",
      body: { check_date: today(), slot, status },
    });

    if (saved) {
      setRows((prev) => [...(prev ?? []).filter((r) => r.slot !== slot), saved]);
    }
    setBusy(null);
  }

  async function addPhoto(row: Meal) {
    const file = await pickMealPhoto();
    if (!file) return;

    setPhotoNote("");
    try {
      const saved = await upload<Meal>(`/checks/meals/${row.id}/photo`, file);
      setRows((prev) => [...(prev ?? []).filter((r) => r.slot !== row.slot), saved]);
      setPhotoNote("사진을 올렸어요.");
    } catch (e) {
      // 사진은 선택이다. 실패해도 체크는 이미 끝나 있다.
      setPhotoNote(e instanceof ApiError ? e.message : "사진을 올리지 못했어요.");
    }
  }

  const find = (slot: CheckSlot) => rows?.find((r) => r.slot === slot);
  const done = rows?.filter((r) => r.status === "ate").length ?? 0;

  return (
    <Screen title="식사 체크" onBack={() => nav("/s/home")}>
      <Banner
        icon="meal"
        title="오늘도 맛있게 드셨어요?"
        description="건강한 식사가 힘이 됩니다."
        tone="meal"
      />

      {!rows && <Spinner />}
      <Notice tone="error">{error}</Notice>

      {rows && (
        <>
          <p className="ask">식사하셨나요?</p>
          <p className="ask-sub">해당하는 버튼을 눌러주세요.</p>

          {SLOTS.map((s) => {
            const row = find(s.key);
            return (
              <div className="answer-row" key={s.key}>
                <Icon name={s.icon} className="lead" />
                <span className="body">
                  <span className="t">{s.label}</span>
                  <span className="d">{s.hint}</span>
                </span>
                <span className="answers">
                  <button
                    className={`ans yes${row?.status === "ate" ? " on" : ""}`}
                    onClick={() => answer(s.key, "ate")}
                    disabled={busy === s.key}
                    aria-pressed={row?.status === "ate"}
                  >
                    먹었어요
                  </button>
                  <button
                    className={`ans no${row?.status === "skipped" ? " on" : ""}`}
                    onClick={() => answer(s.key, "skipped")}
                    disabled={busy === s.key}
                    aria-pressed={row?.status === "skipped"}
                  >
                    안 먹었어요
                  </button>
                </span>
              </div>
            );
          })}

          {/* 사진은 이미 체크한 끼니에만 붙일 수 있다 */}
          {rows.some((r) => r.status === "ate" && r.id) && (
            <div className="card" style={{ textAlign: "center" }}>
              <p className="sub" style={{ marginBottom: "var(--gap-tight)" }}>
                사진을 추가하고 싶으신가요?
              </p>
              {SLOTS.filter((s) => find(s.key)?.status === "ate" && find(s.key)?.id).map((s) => (
                <BigButton key={s.key} icon="plus" onClick={() => addPhoto(find(s.key)!)}>
                  {s.label} 사진 {find(s.key)?.photo_path ? "바꾸기" : "추가"}
                </BigButton>
              ))}
              {photoNote && <p className="field-hint" style={{ marginTop: 8 }}>{photoNote}</p>}
            </div>
          )}

          <Cheer icon="meal">
            맛있는 식사가 건강한 오늘을 만듭니다. 오늘 {done}끼 드셨어요. 좋은 식습관, 늘 응원해요!
          </Cheer>
        </>
      )}
    </Screen>
  );
}
