/** 화면 위에 덮는 것들(팝업 · 방침 시트 · 고르기 목록)의 공용 스택.
 *
 *  안드로이드 뒤로가기는 라우터만 보고 있었다. 그래서 자녀 홈에서 팝업을 열고
 *  뒤로가기를 누르면 팝업이 닫히는 대신 앱이 그대로 꺼졌다 (홈은 "더 갈 뒤가 없는"
 *  화면이라 exitApp 으로 간다). 가입 화면에서는 방침 시트를 열고 뒤로가기를 누르면
 *  시트만 닫히는 게 아니라 화면을 떠나 입력한 것이 날아갔다.
 *
 *  덮개를 여는 쪽이 여기에 닫는 방법을 올려 두면, 뒤로가기가 가장 위의 것부터 닫는다.
 *  네이티브가 아니어도 등록은 되지만(비용이 없다) 실제로 꺼내 쓰는 건 앱뿐이다.
 */

import { useEffect } from "react";

const stack: (() => void)[] = [];

/** 덮개를 열 때 부른다. 돌려받은 함수를 부르면 등록이 취소된다. */
export function pushOverlay(close: () => void): () => void {
  stack.push(close);
  return () => {
    const i = stack.lastIndexOf(close);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** 가장 위의 덮개를 닫는다. 닫을 것이 있었으면 true. */
export function closeTopOverlay(): boolean {
  const close = stack.pop();
  if (!close) return false;
  close();
  return true;
}

/** 열려 있는 동안만 뒤로가기가 close 를 부르게 한다. */
export function useOverlayBack(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    return pushOverlay(close);
    // close 가 매 렌더 새로 만들어져도 등록이 흔들리지 않게 open 만 본다.
    // 덮개는 열려 있는 동안 닫는 방법이 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
