/** 화면 — 개인정보처리방침 (더보기에서 연다).
 *
 *  가입 화면은 이 라우트가 아니라 덮개(PolicySheet)를 쓴다. 이동하면 입력하던 내용이
 *  날아가기 때문이다. 본문은 둘 다 shared/policy 의 PolicyBody 하나를 쓴다.
 */

import { useNavigate } from "react-router-dom";

import { PolicyBody } from "../shared/policy";
import { Screen } from "../shared/ui";

export default function PolicyDoc() {
  const nav = useNavigate();
  return (
    <Screen title="개인정보처리방침" onBack={() => nav(-1)}>
      <PolicyBody />
    </Screen>
  );
}
