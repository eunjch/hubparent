import { useEffect, useState } from "react";

import { platform } from "./native/bridge";
import { pendingCount } from "./shared/offlineQueue";

type Role = "senior" | "guardian" | null;

/** 어르신 앱과 보호자 앱은 같은 번들을 쓰고 로그인 후 role 로 갈린다 — 계획서 3장. */
export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    setQueued(pendingCount());
  }, []);

  return (
    <main style={{ padding: "var(--gap-loose)", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--text-title)", margin: 0 }}>HUB FAMILY</h1>
      <p style={{ color: "var(--ink-2)", marginTop: "var(--gap-tight)" }}>
        스캐폴딩 화면입니다. 실제 화면은 M1부터 붙습니다.
      </p>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "var(--gap-tight) var(--gap)",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: "var(--gap)",
        }}
      >
        <dt style={{ color: "var(--ink-2)" }}>플랫폼</dt>
        <dd style={{ margin: 0 }}>{platform()}</dd>
        <dt style={{ color: "var(--ink-2)" }}>대기 중인 전송</dt>
        <dd style={{ margin: 0 }}>{queued}건</dd>
        <dt style={{ color: "var(--ink-2)" }}>역할</dt>
        <dd style={{ margin: 0 }}>{role ?? "미선택"}</dd>
      </dl>

      <div style={{ display: "grid", gap: "var(--gap-tight)", marginTop: "var(--gap-loose)" }}>
        <button onClick={() => setRole("senior")}>어르신으로 보기</button>
        <button onClick={() => setRole("guardian")}>보호자로 보기</button>
      </div>
    </main>
  );
}
