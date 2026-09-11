/** 화면 S5 — 일정 확인 (부모). 시안 "⑤ 일정 확인".
 *
 *  세그먼트 탭 `다가오는 일정 / 전체 일정` + 목록.
 *  계획서 7.3: 읽기 전용이다. 등록은 자녀가 한다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Glyph } from "../shared/glyphs";
import { Art, scheduleArt } from "../shared/art";
import { SeniorTabs } from "../shared/tabs";
import type { Schedule } from "../shared/types";
import { Notice, Screen, SegTabs, Spinner } from "../shared/ui";

import { formatWhen } from "./ScheduleManage";

type Scope = "upcoming" | "all";

export default function ScheduleView() {
  const nav = useNavigate();
  const [scope, setScope] = useState<Scope>("upcoming");
  const [rows, setRows] = useState<Schedule[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // 날짜를 연달아 넘기면 늦게 온 응답이 화면을 덮을 수 있다. 갈아탄 것은 버린다 (2026-09-11 점검)
    const state = { stale: false };
    setRows(null);
    setError("");
    request<Schedule[]>(`/schedules?scope=${scope}`)
      .then((list) => {
        if (state.stale) return;
        setRows(list);
      })
      .catch(() => {
        if (state.stale) return;
        setError("일정을 불러오지 못했습니다.");
      });
    return () => {
      state.stale = true;
    };
  }, [scope]);

  return (
    // 하단 탭 `일정` 이 여기로 온다. 탭바가 없으면 돌아갈 길이 좌상단 화살표뿐이다
    <Screen title="일정 확인" onBack={() => nav("/s/home")} tabs={<SeniorTabs current="schedule" />}>
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
            <Art name={scheduleArt(r.kind)} blend />
            <div className="body">
              <span className="t">{w.date}</span>
              <span className="d">{w.time}</span>
              <span className="d">{r.place ? `${r.place} / ${r.title}` : r.title}</span>
            </div>
            <span className="chev" aria-hidden="true"><Glyph name="chevron" size={20} /></span>
          </div>
        );
      })}
    </Screen>
  );
}
