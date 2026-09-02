/** API 클라이언트.
 *
 *  에러 포맷은 서버와 동일하다 (계획서 6장):
 *    { "code": "MEAL_ALREADY_CHECKED", "message": "..." }
 */

import { getAccessToken } from "./auth";

/** 기본값은 빈 문자열 = 같은 오리진.
 *  브라우저에서 hubfamily.mangotree.co.kr 로 열면 아파치가 /api/ 를 컨테이너로 넘긴다.
 *  Capacitor 앱은 오리진이 https://localhost 라 같은 오리진이 성립하지 않으므로,
 *  앱 빌드 시에만 VITE_API_BASE_URL 로 절대 주소를 준다. */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

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
