/** 화면 S3 — 약 복용 체크.
 *
 *  자녀가 등록한 약이 시각·이름과 함께 나온다 (계획서 7.3).
 *  어르신은 "복용함 / 안 먹었어요" 만 누른다. 등록·수정은 하지 않는다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Icon } from "../shared/icons";
import { send } from "../shared/offlineQueue";
import type { Dose, MedicationStatus } from "../shared/types";
import { Banner, Cheer, Notice, Screen, Spinner } from "../shared/ui";

export default function MedCheck() {
  const nav = useNavigate();
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Dose[]>("/medications/today")
      .then(setDoses)
      .catch(() => setError("약 정보를 불러오지 못했습니다."));
  }, []);

  async function answer(dose: Dose, status: MedicationStatus) {
    const key = dose.medication_id + dose.scheduled_at;
    setBusy(key);
    setError("");

    // 눌린 것을 바로 보여준다. 통신은 뒤에서 따라온다.
    setDoses((prev) =>
      (prev ?? []).map((d) =>
        d.medication_id === dose.medication_id && d.scheduled_at === dose.scheduled_at
          ? { ...d, status }
          : d,
      ),
    );

    await send<Dose>(`/medications/${dose.medication_id}/logs`, {
      method: "POST",
      body: { scheduled_at: dose.scheduled_at, status },
    });

    setBusy(null);
  }

  const pending = doses?.filter((d) => d.status === "pending").length ?? 0;

  return (
    <Screen title="약 복용" onBack={() => nav("/s/home")}>
      <Banner
        icon="pills"
        title="제시간에 드시는 약이"
        description="더 건강한 내일을 만듭니다."
        tone="med"
      />

      {!doses && <Spinner />}
      <Notice tone="error">{error}</Notice>

      {doses?.length === 0 && (
        <Notice>오늘 드실 약이 없습니다. 자녀분이 등록하면 여기에 표시됩니다.</Notice>
      )}

      {doses && doses.length > 0 && (
        <>
          <section className="ask-card">
            <div className="ask-head">
              <div>
                <p className="ask">약을 드셨나요?</p>
                <p className="ask-sub">건강한 하루를 위해 꼭 챙겨드세요.</p>
              </div>
              <Icon name="pills" className="ask-art" />
            </div>

            {doses.map((d) => {
              const key = d.medication_id + d.scheduled_at;
              return (
                <div className="answer-row" key={key}>
                <Icon name="pills" className="lead" />
                <span className="body">
                  <span className="t">
                    {d.time} {d.name}
                  </span>
                  {d.dose && <span className="d">{d.dose}</span>}
                </span>
                <span className="answers">
                  <button
                    className={`ans yes${d.status === "taken" ? " on" : ""}`}
                    onClick={() => answer(d, "taken")}
                    disabled={busy === key}
                    aria-pressed={d.status === "taken"}
                  >
                    복용함
                  </button>
                  <button
                    className={`ans no${d.status === "missed" ? " on" : ""}`}
                    onClick={() => answer(d, "missed")}
                    disabled={busy === key}
                    aria-pressed={d.status === "missed"}
                  >
                    안 먹었어요
                  </button>
                </span>
                </div>
              );
            })}
          </section>

          <Cheer icon="pills">
            {pending > 0
              ? `아직 ${pending}번 남았어요. 제때 드시면 더 건강하고 활기찬 일상을 유지할 수 있어요.`
              : "오늘 약을 다 확인하셨어요. 정말 잘하셨습니다!"}
          </Cheer>
        </>
      )}
    </Screen>
  );
}
