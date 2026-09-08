/** 화면 S5 — 일정 확인 (부모). 시안 "⑤ 일정 확인".
 *
 *  세그먼트 탭 `다가오는 일정 / 전체 일정` + 목록.
 *  계획서 7.3: 읽기 전용이다. 등록은 자녀가 한다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Icon } from "../shared/icons";
import type { Schedule } from "../shared/types";
import { Notice, Screen, SegTabs, Spinner } from "../shared/ui";

import { formatWhen, kindIcon } from "./ScheduleManage";

type Scope = "upcoming" | "all";

export default function ScheduleView() {
  const nav = useNavigate();
  const [scope, setScope] = useState<Scope>("upcoming");
  const [rows, setRows] = useState<Schedule[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(null);
    request<Schedule[]>(`/schedules?scope=${scope}`)
      .then(setRows)
      .catch(() => setError("일정을 불러오지 못했습니다."));
  }, [scope]);

  return (
    <Screen title="일정 확인" onBack={() => nav("/s/home")}>
      <SegTabs<Scope>
        className="blue"
        current={scope}
        onChange={setScope}
        items={[
          { key: "upcoming", label: "다가오는 일정" },
          { key: "all", label: "전체 일정" },
        ]}
      />

      <Notice tone="error">{error}</Notice>
      {!rows && !error && <Spinner />}

      {rows?.length === 0 && (
        <Notice>
          {scope === "upcoming" ? "다가오는 일정이 없습니다." : "등록된 일정이 없습니다."}
        </Notice>
      )}

      {rows?.map((r) => {
        const w = formatWhen(r.start_at);
        return (
          <div className="sched-row big" key={r.id}>
            <Icon name={kindIcon(r.kind)} className="lead" />
            <div className="body">
              <span className="t">{w.date}</span>
              <span className="d">{w.time}</span>
              <span className="d">{r.place ? `${r.place} / ${r.title}` : r.title}</span>
            </div>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </div>
        );
      })}
    </Screen>
  );
}
