/** 화면 G2 — 이상 징후 알림 (자녀). 시안 "② 이상 징후 알림".
 *
 *  필터 탭 `전체 / 이상 징후 / 일반` → 이상 징후 카드(적색, `상세 확인`) →
 *  일반 알림 목록 → `모두 확인했어요`.
 *  계획서 8.2: 확인(ack)하면 같은 유형이 다시 생길 수 있다. 확인이 곧 "봤다"는 뜻이다.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Icon } from "../shared/icons";
import type { IconName } from "../shared/icons";
import type { Alert, AlertList, AlertType } from "../shared/types";
import { Notice, Screen, SegTabs, Spinner } from "../shared/ui";

type Filter = "all" | "anomaly" | "general";

const TYPE_LABEL: Record<AlertType, string> = {
  no_response: "응답 없음",
  no_checks: "체크 미완료",
  missed_med: "약 복용 미체크",
};

const TYPE_ICON: Record<AlertType, IconName> = {
  no_response: "alert",
  no_checks: "mood",
  missed_med: "pills",
};

/** "오늘 11:23" · "9/7 08:30" */
export function whenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? `오늘 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export default function Alerts() {
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<AlertList | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await request<AlertList>(`/alerts?filter=${filter}`));
    } catch {
      setError("알림을 불러오지 못했습니다.");
    }
  }, [filter]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  async function ack(row: Alert) {
    try {
      await request(`/alerts/${row.id}/ack`, { method: "POST" });
      await load();
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    }
  }

  async function ackAll() {
    try {
      await request("/alerts/ack-all", { method: "POST", body: {} });
      await load();
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    }
  }

  const items = data?.items ?? [];
  // 미확인 이상 징후는 카드로 크게, 나머지는 목록으로
  const cards = items.filter((a) => a.severity !== "low" && !a.ack_at);
  const rows = items.filter((a) => !cards.includes(a));

  return (
    <Screen title="알림" onBack={() => nav("/g/home")}>
      <SegTabs<Filter>
        current={filter}
        onChange={setFilter}
        className="alert-seg"
        items={[
          { key: "all", label: "전체" },
          { key: "anomaly", label: "이상 징후" },
          { key: "general", label: "일반" },
        ]}
      />

      <Notice tone="error">{error}</Notice>
      {!data && !error && <Spinner />}

      {data && items.length === 0 && <Notice>새로운 알림이 없어요.</Notice>}

      {cards.map((a) => (
        <section className="alert-card" key={a.id} aria-label="이상 징후">
          <div className="alert-head">
            <Icon name="alert" className="lead" />
            <div className="body">
              <div className="row">
                <span className="t">이상 징후 감지</span>
                <span className="when">{whenLabel(a.occurred_at)}</span>
              </div>
              <p className="msg">
                {a.target_name} — {a.message}
              </p>
            </div>
          </div>
          <button className="alert-detail" onClick={() => ack(a)}>
            상세 확인
          </button>
        </section>
      ))}

      {rows.map((a) => (
        <button
          className={`alert-row${a.ack_at ? " read" : ""}`}
          key={a.id}
          onClick={() => !a.ack_at && ack(a)}
          aria-label={`${TYPE_LABEL[a.type]} ${a.ack_at ? "확인함" : "확인하기"}`}
        >
          <Icon name={TYPE_ICON[a.type]} className="lead" />
          <span className="body">
            <span className="t">
              {TYPE_LABEL[a.type]}
              {a.target_name ? ` · ${a.target_name}` : ""}
            </span>
            <span className="d">{a.message}</span>
          </span>
          <span className="when">{whenLabel(a.occurred_at)}</span>
        </button>
      ))}

      {data && data.unread > 0 && (
        <button className="ack-all" onClick={ackAll}>
          모두 확인했어요
        </button>
      )}
    </Screen>
  );
}
