/** 부모님 관리 — 자녀 1 : 부모 N.
 *
 *  아직 앱에 들어오지 않은 부모님은 그렇게 표시한다. 자녀가 "알려드렸는데
 *  아직 안 들어오셨네" 를 알 수 있어야 한다.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Icon } from "../shared/icons";
import type { Me, Senior } from "../shared/types";
import { BigButton, Notice, Spinner } from "../shared/ui";

export default function SeniorList() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [seniors, setSeniors] = useState<Senior[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [info, rows] = await Promise.all([
        request<Me>("/me"),
        request<Senior[]>("/family/seniors"),
      ]);
      setMe(info);
      setSeniors(rows);
    } catch {
      setError("정보를 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(senior: Senior) {
    if (!window.confirm(`${senior.name} 님을 가족에서 빼시겠어요?`)) return;
    try {
      await request(`/family/seniors/${senior.id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <div className="screen">

      <header className="screen-head">
        <button className="icon-btn" onClick={() => nav("/g/home")} aria-label="뒤로 가기">
          ‹
        </button>
        <h1>부모님 관리</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        {error && <Notice tone="error">{error}</Notice>}
        {!seniors && !error && <Spinner />}

        {seniors?.length === 0 && (
          <Notice>아직 등록된 부모님이 없습니다. 아래에서 추가해 주세요.</Notice>
        )}

        {me && seniors && seniors.length > 0 && (
          <Notice>
            부모님께 <b>{me.user.name}</b> · <b>{me.user.phone}</b> 을(를) 알려주세요. 앱에서 이
            이름과 번호를 넣으시면 들어오실 수 있습니다.
          </Notice>
        )}

        <div className="senior-list">
          {seniors?.map((s) => (
            <div key={s.id} className="senior-row">
              <span className="face">
                <Icon name="heart" size={36} />
              </span>
              <div className="body">
                <span className="t">
                  {s.name}
                  {s.relation && <span className="rel">{s.relation}</span>}
                </span>
                <span className="d">{s.phone}</span>
                <span className={`state ${s.joined ? "in" : "out"}`}>
                  {s.joined ? "앱 사용 중" : "아직 안 들어오셨어요"}
                </span>
              </div>
              <button className="row-del" onClick={() => remove(s)} aria-label={`${s.name} 빼기`}>
                빼기
              </button>
            </div>
          ))}
        </div>
      </main>

      <div className="sticky-cta">
        <BigButton tone="primary" onClick={() => nav("/g/seniors/new")}>
          부모님 추가
        </BigButton>
      </div>
    </div>
  );
}
