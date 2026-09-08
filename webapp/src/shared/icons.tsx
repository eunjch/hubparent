/** 아이콘 — MEDIC Warm Care 세트.
 *
 *  src/assets/icons 의 SVG 를 그대로 쓴다. 색이 파일 안에 박혀 있어
 *  CSS 로 물들이지 않고 이미지로 얹는다.
 *
 *  모두 장식이다. 의미는 항상 옆의 글자가 전달한다 (계획서 9장).
 *  그래서 alt 는 비우고 크기만 지정한다.
 */

import home from "../assets/icons/01_home.svg";
import meal from "../assets/icons/02_meal.svg";
import pill from "../assets/icons/03_pill.svg";
import mood from "../assets/icons/04_mood.svg";
import calendar from "../assets/icons/05_calendar.svg";
import report from "../assets/icons/06_report.svg";
import phone from "../assets/icons/07_phone.svg";
import heart from "../assets/icons/08_heart.svg";
import alert from "../assets/icons/09_alert.svg";
import sun from "../assets/icons/10_sun.svg";
import family from "../assets/icons/11_family.svg";
import check from "../assets/icons/12_check.svg";
import leaf from "../assets/icons/13_leaf.svg";
import bell from "../assets/icons/14_bell.svg";
import caregiver from "../assets/icons/15_caregiver.svg";
import camera from "../assets/icons/16_camera.svg";

export const ICON = {
  home,
  meal,
  pill,
  mood,
  calendar,
  report,
  phone,
  heart,
  alert,
  sun,
  family,
  check,
  leaf,
  bell,
  caregiver,
  camera,
} as const;

export type IconName = keyof typeof ICON;

/** 크기는 대부분 CSS 가 정한다. size 는 예외적으로 필요할 때만 준다. */
export function Icon({
  name,
  size,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={ICON[name]}
      alt=""
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      style={size ? { width: size, height: size } : undefined}
    />
  );
}
