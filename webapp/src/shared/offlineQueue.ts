/** 오프라인 큐.
 *
 *  어르신 단말은 통신이 끊긴 상태에서도 체크를 입력할 수 있어야 한다 (계획서 3장).
 *  전송 실패한 요청을 쌓아 두었다가 온라인 복귀 시 순서대로 재전송한다.
 *  서버는 (user, date, slot) 유니크 + Idempotency-Key 로 중복을 흡수한다.
 */

import { request, type RequestOptions } from "./api";

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

/** 전송을 시도하고, 실패하면 큐에 넣는다. 호출부는 항상 성공한 것처럼 화면을 갱신한다. */
export async function send<T>(path: string, options: RequestOptions): Promise<T | null> {
  const id = crypto.randomUUID();
  const withKey: RequestOptions = { ...options, idempotencyKey: options.idempotencyKey ?? id };

  try {
    return await request<T>(path, withKey);
  } catch {
    save([...load(), { id, path, options: withKey }]);
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
    } catch {
      remaining.push(item);
    }
  }

  save(remaining);
  return sent;
}

export function pendingCount(): number {
  return load().length;
}
