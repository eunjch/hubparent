/** 홈 화면 상단의 하늘·언덕 배경.
 *
 *  시안의 수채 일러스트 배경을 SVG 로 옮긴 것이다.
 *  장식이므로 aria-hidden 이고, 그 위에 얹히는 글자의 대비를 해치지 않도록
 *  하늘은 밝게, 언덕은 아래쪽에만 둔다.
 */

export function Scene({ variant = "guardian" }: { variant?: "guardian" | "senior" }) {
  return (
    <svg className="scene" viewBox="0 0 390 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BFE4FA" />
          <stop offset="70%" stopColor="#DCF0FB" />
          <stop offset="100%" stopColor="#EDF7EE" />
        </linearGradient>
      </defs>

      <rect width="390" height="200" fill="url(#sky)" />

      {/* 구름 */}
      <g fill="#FFFFFF" opacity=".92">
        <ellipse cx="72" cy="42" rx="30" ry="14" />
        <ellipse cx="94" cy="36" rx="20" ry="12" />
        <ellipse cx="300" cy="30" rx="26" ry="12" />
        <ellipse cx="322" cy="36" rx="18" ry="10" />
      </g>

      {/* 뒤쪽 언덕 */}
      <path d="M0 150c60-22 120-22 190 4s130 20 200-6v52H0z" fill="#CDE9C4" />

      {variant === "senior" && (
        <>
          {/* 나무 */}
          <g transform="translate(44 118)">
            <rect x="7" y="24" width="6" height="22" rx="3" fill="#9A7B54" />
            <circle cx="10" cy="18" r="18" fill="#8CC97C" />
            <circle cx="24" cy="26" r="12" fill="#7CBB6B" />
          </g>
          {/* 집 */}
          <g transform="translate(286 126)">
            <rect x="6" y="18" width="42" height="28" rx="4" fill="#FFF6E6" stroke="#D9C7A6" strokeWidth="1.5" />
            <path d="M0 20 27 2l27 18z" fill="#EE8E7B" />
            <rect x="21" y="30" width="14" height="16" rx="2" fill="#C9A57A" />
          </g>
        </>
      )}

      {/* 앞쪽 언덕 */}
      <path d="M0 172c70-16 130-8 200 6s130 10 190-8v30H0z" fill="#AEDCA0" />

      {/* 꽃 */}
      <g fill="#FFFFFF" opacity=".85">
        <circle cx="30" cy="184" r="3" />
        <circle cx="118" cy="190" r="2.6" />
        <circle cx="252" cy="188" r="3" />
        <circle cx="348" cy="182" r="2.6" />
      </g>
    </svg>
  );
}
