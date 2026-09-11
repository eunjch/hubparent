/** API 클라이언트.
 *
 *  에러 포맷은 서버와 동일하다 (계획서 6장):
 *    { "code": "MEAL_ALREADY_CHECKED", "message": "..." }
 */

import { getAccessToken, refreshSession } from "./auth";
import { BASE_URL } from "./base";

/** 응답이 이만큼 안 오면 포기한다. 지하 주차장처럼 연결은 되고 응답만 없는 곳에서
 *  몇 분씩 매달리면 화면이 멈춘 것처럼 보인다 (2026-09-11 점검). */
const TIMEOUT_MS = 15_000;

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError("TIMEOUT", "응답이 없습니다. 잠시 후 다시 시도해 주세요.", 0);
    }
    throw new ApiError("NETWORK_ERROR", "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.", 0);
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** 오프라인 큐 재전송 시 중복 등록을 막는다 — 계획서 6장 공통 규약 */
  idempotencyKey?: string;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

    return withTimeout(`${BASE_URL}/api/v1${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  };

  let res = await send();

  // 접속 토큰은 30분이다. 만료되면 조용히 갱신하고 한 번만 다시 보낸다.
  // 예전에는 첫 화면에서만 갱신해서, 앱을 켜 둔 채 30분이 지나면 모든 화면이
  // "불러오지 못했습니다" 로 굳었다 (2026-09-11 점검).
  if (res.status === 401 && path !== "/auth/refresh" && (await refreshSession())) {
    res = await send();
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(
      payload?.code ?? "NETWORK_ERROR",
      payload?.message ?? "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      res.status,
    );
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}


/** 파일 업로드. JSON 이 아니라 multipart 라 Content-Type 을 브라우저가 정하게 둔다. */
export async function upload<T>(path: string, file: File): Promise<T> {
  const headers: Record<string, string> = {};
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const form = new FormData();
  form.append("file", file);

  let res = await withTimeout(`${BASE_URL}/api/v1${path}`, { method: "POST", headers, body: form });
  if (res.status === 401 && (await refreshSession())) {
    const retry: Record<string, string> = {};
    const fresh = await getAccessToken();
    if (fresh) retry.Authorization = `Bearer ${fresh}`;
    res = await withTimeout(`${BASE_URL}/api/v1${path}`, {
      method: "POST",
      headers: retry,
      body: form,
    });
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(
      payload?.code ?? "NETWORK_ERROR",
      payload?.message ?? "사진을 올리지 못했어요.",
      res.status,
    );
  }
  return (await res.json()) as T;
}
