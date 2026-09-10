/** 화면 — 회원 탈퇴 (개인정보처리방침 3·5절).
 *
 *  방침에 "탈퇴 즉시 파기" 로 공개했으므로 유예 기간이 없다. 되돌릴 수 없다.
 *  그래서 두 단계다: 무엇이 지워지는지 읽는 화면 → 마지막으로 한 번 더 묻는 화면.
 *
 *  자녀는 비밀번호를 다시 넣는다. 부모님은 비밀번호가 없어 확인만 받는다 —
 *  대신 어르신 화면에서는 버튼을 맨 아래 작게 두어 잘못 누를 일을 줄인다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { Glyph } from "../shared/glyphs";
import type { Me, Member } from "../shared/types";
import { BigButton, Field, Notice, Spinner } from "../shared/ui";

type Result = { scope: "user" | "family"; deleted_users: number };

export default function Withdraw() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [password, setPassword] = useState("");
  const [asking, setAsking] = useState(false); // 마지막 확인 단계인가
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([request<Me>("/me"), request<Member[]>("/family/members").catch(() => [])])
      .then(([info, list]) => {
        setMe(info);
        setMembers(list);
      })
      .catch(() => setLoadError("정보를 불러오지 못했습니다."));
  }, []);

  const isGuardian = me?.user.role === "guardian";
  const back = () => nav(isGuardian ? "/g/more" : "/s/more");

  const otherGuardians = members.filter(
    (m) => m.role === "guardian" && m.user_id !== me?.user.id,
  );
  const seniors = members.filter((m) => m.role === "senior");
  // 마지막 자녀가 나가면 부모님은 자녀 이름·번호로 로그인할 길이 없어 가족째 지워진다
  const takesFamily = isGuardian && otherGuardians.length === 0 && seniors.length > 0;

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const result = await request<Result>("/me", {
        method: "DELETE",
        body: { confirm: true, ...(isGuardian ? { password } : {}) },
      });
      await clearTokens();
      nav("/", { replace: true, state: { withdrew: result.scope } });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setAsking(false);
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={back} aria-label="뒤로">
          <Glyph name="back" size={24} />
        </button>
        <h1>회원 탈퇴</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <Notice tone="error">{loadError || error}</Notice>
        {!me && !loadError && <Spinner />}

        {me && !asking && (
          <>
            <section className="warn-card">
              <h2>탈퇴하면 아래 기록이 모두 지워집니다</h2>
              <ul>
                {isGuardian ? (
                  <>
                    <li>내 계정 정보와 로그인</li>
                    <li>등록한 약, 병원 일정, 알림 기록</li>
                    {takesFamily ? (
                      <li className="strong">
                        부모님 {seniors.map((s) => s.name).join(" · ")} 님의 계정과 식사 · 약 · 기분
                        기록까지 함께 지워집니다
                      </li>
                    ) : seniors.length > 0 ? (
                      <li>
                        부모님 기록은 남습니다. 다른 자녀({otherGuardians.map((g) => g.name).join(" · ")})가
                        이어서 돌보게 됩니다
                      </li>
                    ) : null}
                  </>
                ) : (
                  <>
                    <li>내 계정 정보</li>
                    <li>지금까지 기록한 식사 · 약 · 기분</li>
                    <li>등록된 약과 병원 일정, 사진</li>
                  </>
                )}
              </ul>
              <p className="sub">
                한 번 지우면 되돌릴 수 없습니다. 자녀분과 상의하신 뒤 진행해 주세요.
              </p>
            </section>

            {takesFamily && (
              <Notice tone="error">
                부모님은 자녀 이름과 전화번호로 앱에 들어오십니다. 자녀 계정이 없어지면 부모님도 더
                이상 들어오실 수 없어 기록을 함께 지웁니다.
              </Notice>
            )}

            {isGuardian && (
              <Field
                label="비밀번호"
                icon="lock"
                labelNote="본인 확인을 위해 한 번 더 입력해 주세요"
                type="password"
                value={password}
                onChange={(v) => setPassword(v)}
              />
            )}

            <div className="withdraw-actions">
              <BigButton onClick={back}>그만두기</BigButton>
              <BigButton
                tone="danger"
                disabled={isGuardian && password.length === 0}
                onClick={() => {
                  setError("");
                  setAsking(true);
                }}
              >
                탈퇴하기
              </BigButton>
            </div>
          </>
        )}

        {me && asking && (
          <>
            <section className="warn-card final">
              <h2>정말 탈퇴하시겠어요?</h2>
              <p>
                {takesFamily
                  ? "가족의 기록이 모두 사라집니다. 되돌릴 수 없습니다."
                  : "지금까지의 기록이 모두 사라집니다. 되돌릴 수 없습니다."}
              </p>
            </section>

            <div className="withdraw-actions">
              <BigButton onClick={() => setAsking(false)}>아니요, 돌아갈래요</BigButton>
              <BigButton tone="danger" disabled={busy} onClick={submit}>
                {busy ? "지우는 중…" : "네, 탈퇴합니다"}
              </BigButton>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
