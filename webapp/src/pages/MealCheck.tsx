/** 화면 S2 — 식사 체크 (리디자인 11_s_meal).
 *
 *  아침·점심·저녁 각각 "먹었어요 / 안 먹었어요" 두 버튼. 1탭으로 끝난다.
 *  이미 누른 것도 다시 누르면 바뀐다 — 잘못 눌렀을 때 되돌릴 수 있어야 한다 (계획서 9장).
 *
 *  사진은 선택이다. 안 올려도 체크는 끝난다 (계획서 8.5.8).
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { pickMealPhoto } from "../native/bridge";
import { ApiError, request, upload } from "../shared/api";
import { fileUrl } from "../shared/base";
import { Art } from "../shared/art";
import { Glyph } from "../shared/glyphs";
import { send } from "../shared/offlineQueue";
import { localDate } from "../shared/tabs";
import type { CheckSlot, MealCheck as Meal, MealStatus } from "../shared/types";
import { Notice, Screen, Spinner } from "../shared/ui";

const SLOTS: { key: CheckSlot; label: string; icon: "sun" | "moon" }[] = [
  { key: "breakfast", label: "아침", icon: "sun" },
  { key: "lunch", label: "점심", icon: "sun" },
  { key: "dinner", label: "저녁", icon: "moon" },
];

/* 날짜는 기기 로컬(한국) 기준이다. toISOString() 은 UTC 라 오전 9시 이전에 전날이 나온다 —
 * 아침 기록이 통째로 어제로 들어가던 원인 (2026-09-11 점검). 서버도 읽을 때 KST 를 쓴다. */
const today = localDate;

export default function MealCheck() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Meal[] | null>(null);
  const [busy, setBusy] = useState<CheckSlot | null>(null);
  const [error, setError] = useState("");
  // 오프라인 큐에 들어간 상태. 화면만 바뀌고 서버에는 없는 것을 숨기지 않는다
  const [pending, setPending] = useState(false);
  // 같은 틱의 연타를 막는 잠금. 상태로는 늦는다
  const sending = useRef(false);
  const [photoNote, setPhotoNote] = useState("");

  useEffect(() => {
    request<Meal[]>(`/checks/meals?check_date=${today()}`)
      .then(setRows)
      .catch(() => setError("기록을 불러오지 못했습니다."));
  }, []);

  async function answer(slot: CheckSlot, status: MealStatus) {
    // 연타를 막는다. busy 는 상태라 같은 틱의 두 번째 클릭을 못 막는다 — ref 로 즉시 잠근다
    // (2026-09-11 점검)
    if (sending.current) return;
    sending.current = true;
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
    if (saved === null) {
      // 오프라인 큐에 들어갔다. 화면만 바뀌고 서버에는 없는 상태를 숨기지 않는다
      setPending(true);
    } else {
      setPending(false);
    }
    sending.current = false;
    setBusy(null);
  }

  async function addPhoto(row: Meal, source: "camera" | "gallery" = "camera") {
    const file = await pickMealPhoto(source);
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
  const eaten = SLOTS.filter((s) => find(s.key)?.status === "ate" && find(s.key)?.id);
  const withPhoto = SLOTS.filter((s) => find(s.key)?.photo_path);

  return (
    <Screen title="식사 체크" onBack={() => nav("/s/home")}>
      {!rows && <Spinner />}
      <Notice tone="error">{error}</Notice>
        {pending && (
          <Notice tone="error">
            아직 서버에 보내지 못했어요. 인터넷이 연결되면 저절로 올라갑니다.
          </Notice>
        )}

      {rows && (
        <>
          {/* 질문은 카드 밖에, 그림은 오른쪽 (시안) */}
          <div className="ask-head">
            <div>
              <p className="ask">식사하셨나요?</p>
              <p className="ask-sub">맛있게 드셨어요?</p>
            </div>
            <Art name="bowl" className="ask-art" />
          </div>

          <section className="ask-card">
            {SLOTS.map((s) => {
              const row = find(s.key);
              return (
                <div className="answer-row" key={s.key}>
                  <span className={`slot-ic ${s.icon}`} aria-hidden="true">
                    <Glyph name={s.icon} size={20} />
                  </span>
                  <span className="body">
                    <span className="t">{s.label}</span>
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
          </section>

          {/* 사진은 이미 체크한 끼니에만 붙일 수 있다 */}
          {eaten.length > 0 && (
            <section className="card photo-card">
              <p className="q">사진을 추가하고 싶으신가요?</p>
              <div className="photo-row">
                {withPhoto.length > 0 && (
                  <div className="thumbs">
                    {withPhoto.map((s) => (
                      <span className="thumb-item" key={s.key}>
                        <img className="thumb" src={fileUrl(find(s.key)!.photo_path!)} alt={`${s.label} 식사 사진`} />
                        <span className="cap">{s.label}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="btns">
                  {eaten.map((s) => {
                    const has = Boolean(find(s.key)?.photo_path);
                    return (
                      <button
                        key={s.key}
                        className={`photo-btn${has ? "" : " soft"}`}
                        onClick={() => addPhoto(find(s.key)!)}
                      >
                        <Glyph name={has ? "camera" : "plus"} size={20} />
                        {s.label} 사진 {has ? "바꾸기" : "추가"}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="field-hint" style={{ marginTop: 10 }}>
                찍기 대신 앨범에서 고르려면:{" "}
                {eaten.map((s) => (
                  <button key={s.key} className="inline-link" onClick={() => addPhoto(find(s.key)!, "gallery")}>
                    {s.label}
                  </button>
                ))}
              </p>
              {photoNote && <p className="field-hint">{photoNote}</p>}
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
