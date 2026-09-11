/** 오프라인 큐.
 *
 *  어르신 단말은 통신이 끊긴 상태에서도 체크를 입력할 수 있어야 한다 (계획서 3장).
 *  전송 실패한 요청을 쌓아 두었다가 온라인 복귀 시 순서대로 재전송한다.
 *  서버는 (user, date, slot) 유니크 + Idempotency-Key 로 중복을 흡수한다.
 */

import { ApiError, request, type RequestOptions } from "./api";

interface QueuedRequest {
  id: string;
  path: string;
  options: RequestOptions;
}

const STORAGE_KEY = "hf.queue";

function load(): QueuedRequest[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as QueuedRequest[];
  } catch {
    return [];
  }
}

function save(items: QueuedRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* 저장 공간이 없으면 큐 없이 동작한다 */
  }
}

/** 다시 보내 봐야 소용없는 실패인가.
 *
 *  400·403·422 같은 거절은 통신 문제가 아니다. 큐에 넣으면 앱을 켤 때마다 같은 실패를
 *  반복하며 영원히 남고, 화면은 "곧 올라갑니다" 라고 거짓말한다 (2026-09-11 재점검).
 *  401 은 예외다 — api.ts 가 토큰을 갱신해 다시 보내므로, 여기까지 왔다면 세션이 끝난 것이다.
 */
function permanent(e: unknown): boolean {
  return e instanceof ApiError && e.status >= 400 && e.status < 500;
}

/** 전송을 시도하고, 나중에 될 법한 실패만 큐에 넣는다.
 *
 *  돌려주는 값: 성공하면 서버 응답, **큐에 넣었으면 null, 영구 실패면 예외**.
 *  호출부는 null 을 "아직 못 보냈다" 로 표시하고, 예외는 오류로 보여 준다.
 */
export async function send<T>(path: string, options: RequestOptions): Promise<T | null> {
  const id = crypto.randomUUID();
  const withKey: RequestOptions = { ...options, idempotencyKey: options.idempotencyKey ?? id };

  try {
    return await request<T>(path, withKey);
  } catch (e) {
    if (permanent(e)) throw e;
    save([...load(), { id, path, options: withKey }]);
    announce();
    return null;
  }
}

/** 온라인 복귀 시 호출한다. 성공한 항목만 큐에서 제거한다. */
export async function flush(): Promise<number> {
  const items = load();
  const remaining: QueuedRequest[] = [];
  let sent = 0;

  for (const item of items) {
    try {
      await request(item.path, item.options);
      sent += 1;
    } catch (e) {
      // 영구 실패는 버린다. 안 버리면 매번 실패하며 영원히 쌓인다
      if (!permanent(e)) remaining.push(item);
    }
  }

  save(remaining);
  announce();
  return sent;
}

export function pendingCount(): number {
  return load().length;
}

/** 큐 길이가 바뀌면 알린다. 화면의 "아직 못 보냈어요" 배너가 이걸 보고 사라진다.
 *  예전에는 큐가 비어도 배너가 화면을 떠날 때까지 남아 있었다 (2026-09-11 재점검). */
type Listener = (count: number) => void;
const watchers: Listener[] = [];

export function onQueueChange(fn: Listener): () => void {
  watchers.push(fn);
  return () => {
    const i = watchers.indexOf(fn);
    if (i >= 0) watchers.splice(i, 1);
  };
}

function announce(): void {
  const n = load().length;
  watchers.forEach((fn) => fn(n));
}
