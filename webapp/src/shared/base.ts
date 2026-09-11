/** API 기본 주소. api.ts 와 auth.ts 가 함께 쓴다 (서로를 import 하지 않도록 여기 둔다).
 *
 *  기본값은 빈 문자열 = 같은 오리진. 브라우저로 열면 아파치가 /api/ 를 컨테이너로 넘긴다.
 *  Capacitor 앱은 오리진이 https://localhost 라 같은 오리진이 성립하지 않으므로,
 *  앱 빌드 시에만 VITE_API_BASE_URL 로 절대 주소를 준다 (vite.config.ts).
 */
export const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

/** 서버가 내주는 정적 파일(식사 사진) 주소. 상대 경로로 두면 앱에서 번들 안을 가리켜 깨진다. */
export function fileUrl(path: string): string {
  return `${BASE_URL}/uploads/${path}`;
}

/** 앱 번들에 함께 들어가는 정적 문서(개인정보처리방침 등).
 *  앱 오리진은 https://localhost 이고 그 안에 파일이 있으므로 상대 경로가 맞다.
 *  브라우저에서도 같은 경로로 열린다. */
export function docUrl(name: string): string {
  return `/${name}`;
}
