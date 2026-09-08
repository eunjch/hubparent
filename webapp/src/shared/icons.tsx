/** 아이콘 · 배경 — MEDIC Soft Wellness 에셋 팩.
 *
 *  src/assets 의 SVG 를 그대로 쓴다. 색이 파일 안에 박혀 있어
 *  CSS 로 물들이지 않고 이미지로 얹는다.
 *
 *  모두 장식이다. 의미는 항상 옆의 글자가 전달한다 (계획서 9장).
 *  그래서 alt 를 비우고 aria-hidden 을 준다.
 */

import alertTriangle from "../assets/icons/09_alert_triangle.svg";
import activityWalk from "../assets/icons/07_activity_walk.svg";
import avatarCaregiver from "../assets/icons/21_avatar_caregiver.svg";
import avatarSenior from "../assets/icons/22_avatar_senior.svg";
import bell from "../assets/icons/10_bell.svg";
import calendar from "../assets/icons/11_calendar.svg";
import careHeart from "../assets/icons/30_care_heart.svg";
import checkNo from "../assets/icons/16_check_no.svg";
import checkYes from "../assets/icons/15_check_yes.svg";
import graphBar from "../assets/icons/28_graph_bar.svg";
import healthRing from "../assets/icons/12_health_score_ring.svg";
import home from "../assets/icons/01_home.svg";
import hospital from "../assets/icons/17_hospital.svg";
import leafBranch from "../assets/icons/29_leaf_branch.svg";
import leafSingle from "../assets/icons/20_leaf_single.svg";
import mealBowl from "../assets/icons/05_meal_bowl.svg";
import medicationTime from "../assets/icons/27_medication_time.svg";
import message from "../assets/icons/03_message.svg";
import moodSet from "../assets/icons/25_mood_set.svg";
import moodSmile from "../assets/icons/08_mood_smile.svg";
import moon from "../assets/icons/14_moon.svg";
import moreMenu from "../assets/icons/04_more_menu.svg";
import phoneCall from "../assets/icons/23_phone_call.svg";
import pills from "../assets/icons/06_pills.svg";
import plusAdd from "../assets/icons/24_plus_add.svg";
import report from "../assets/icons/02_report.svg";
import scheduleList from "../assets/icons/26_schedule_list.svg";
import stethoscope from "../assets/icons/19_stethoscope.svg";
import sun from "../assets/icons/13_sun.svg";
import tooth from "../assets/icons/18_tooth.svg";

import logoPetals from "../assets/logo/logo_medic_petals.svg";
import logoSymbol from "../assets/logo/logo_medic_symbol.svg";

import bgBottomWave from "../assets/bg/04_bottom_wave.svg";
import bgHeroBlobs from "../assets/bg/01_soft_hero_blobs.svg";
import bgLeafLeft from "../assets/bg/02_soft_leaf_left.svg";
import bgLeafRight from "../assets/bg/03_soft_leaf_right.svg";

export const ICON = {
  home,
  report,
  message,
  more: moreMenu,
  meal: mealBowl,
  pills,
  activity: activityWalk,
  mood: moodSmile,
  moodSet,
  alert: alertTriangle,
  bell,
  calendar,
  healthRing,
  sun,
  moon,
  yes: checkYes,
  no: checkNo,
  hospital,
  tooth,
  stethoscope,
  leaf: leafSingle,
  leafBranch,
  caregiver: avatarCaregiver,
  senior: avatarSenior,
  phone: phoneCall,
  plus: plusAdd,
  scheduleList,
  medicationTime,
  graph: graphBar,
  heart: careHeart,
  logo: logoSymbol,
} as const;

/** 워드마크 옆 심볼. 첫 화면은 잎 두 장(petals), 나머지는 기존 symbol 을 쓴다. */
export const LOGO = {
  petals: logoPetals,
  symbol: logoSymbol,
} as const;

export const BG = {
  heroBlobs: bgHeroBlobs,
  leafLeft: bgLeafLeft,
  leafRight: bgLeafRight,
  bottomWave: bgBottomWave,
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
      style={size ? { width: size, height: size } : undefined}
    />
  );
}

/** 화면 위쪽에 깔리는 장식. 글자 대비를 해치지 않도록 연하게 둔다. */
export function Backdrop({ variant = "hero" }: { variant?: "hero" | "leaf" }) {
  return (
    <div className="backdrop" aria-hidden="true">
      <img className="blobs" src={BG.heroBlobs} alt="" />
      {variant === "leaf" && (
        <>
          <img className="leaf-l" src={BG.leafLeft} alt="" />
          <img className="leaf-r" src={BG.leafRight} alt="" />
        </>
      )}
    </div>
  );
}
