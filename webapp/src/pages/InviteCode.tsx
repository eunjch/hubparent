/** G2 초대코드 안내.
 *
 *  자녀가 이 번호를 부모님께 전해 준다. 전화로 불러주는 경우가 많으므로
 *  화면에서 가장 크게 두고, 문자로 바로 보낼 수 있게 한다.
 */

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AvatarSenior } from "../shared/icons";
import { Scene } from "../shared/Scene";
import type { FamilyCreated } from "../shared/types";
import { BigButton, Notice } from "../shared/ui";

function expireText(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일까지 사용할 수 있어요`;
}

export default function InviteCode() {
  const nav = useNavigate();
  const created = useLocation().state as FamilyCreated | null;
  const [copied, setCopied] = useState(false);

  if (!created) {
    // 새로고침 등으로 상태가 날아간 경우. 가족 설정에서 다시 발급받게 한다.
    return (
      <div className="screen onboard">
        <Scene />
        <main className="screen-body">
          <Notice>번호를 다시 보시려면 가족 설정에서 재발급할 수 있습니다.</Notice>
        </main>
        <div className="sticky-cta">
          <BigButton tone="primary" onClick={() => nav("/g/home", { replace: true })}>
            확인
          </BigButton>
        </div>
      </div>
    );
  }

  const code = created.invitation_code;
  const smsBody = `HUB FAMILY 앱에서 이 번호를 넣어주세요: ${code}`;

  return (
    <div className="screen onboard">
      <Scene variant="senior" />

      <main className="screen-body">
        <div className="hero" style={{ paddingBottom: "var(--gap-tight)" }}>
          <span className="hero-badge">
            <AvatarSenior size={92} />
          </span>
          <h1 style={{ fontSize: "var(--text-action)" }}>
            등록이 끝났어요!
            <br />
            부모님께 이 번호를 알려주세요
          </h1>
        </div>

        <div className="code-hero">
          <p className="cap">부모님이 앱에 넣으실 번호</p>
          <p className="code">{code}</p>
          <p className="expire">{expireText(created.invitation_expires_at)}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <BigButton
            onClick={() => {
              window.location.href = `sms:?body=${encodeURIComponent(smsBody)}`;
            }}
          >
            문자로 보내기
          </BigButton>
          <BigButton
            onClick={() => {
              void navigator.clipboard?.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "복사했어요" : "번호 복사"}
          </BigButton>
        </div>
      </main>

      <div className="sticky-cta">
        <BigButton tone="primary" onClick={() => nav("/g/home", { replace: true })}>
          완료
        </BigButton>
      </div>
    </div>
  );
}
