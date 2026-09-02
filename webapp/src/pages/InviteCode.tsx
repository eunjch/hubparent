/** G2 초대코드 안내.
 *
 *  자녀가 이 번호를 부모님께 전해 준다. 전화로 불러주는 경우가 많으므로
 *  화면에서 가장 크게 보이도록 두고, 문자로 바로 보낼 수 있게 한다.
 */

import { useLocation, useNavigate } from "react-router-dom";

import type { FamilyCreated } from "../shared/types";
import { BigButton, Notice, Screen } from "../shared/ui";

export default function InviteCode() {
  const nav = useNavigate();
  const created = useLocation().state as FamilyCreated | null;

  if (!created) {
    // 새로고침 등으로 상태가 날아간 경우. 가족 설정에서 다시 발급받게 한다.
    return (
      <Screen title="등록 완료">
        <Notice>번호를 다시 보시려면 가족 설정에서 재발급할 수 있습니다.</Notice>
        <BigButton tone="primary" onClick={() => nav("/g/home", { replace: true })}>
          확인
        </BigButton>
      </Screen>
    );
  }

  const code = created.invitation_code;
  const smsBody = `HUB FAMILY 앱에서 이 번호를 넣어주세요: ${code}`;

  return (
    <Screen title="등록 완료">
      <p className="lede">부모님께 이 번호를 알려주세요</p>
      <p className="sub">부모님이 앱에서 이 번호를 넣으시면 연결됩니다. 7일 안에 사용해야 합니다.</p>

      <p className="code-display">{code}</p>

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
        }}
      >
        번호 복사
      </BigButton>

      <BigButton tone="primary" onClick={() => nav("/g/home", { replace: true })}>
        완료
      </BigButton>
    </Screen>
  );
}
