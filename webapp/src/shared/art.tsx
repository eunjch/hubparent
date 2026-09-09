/** 리디자인(2026-09-09) 3D 아이콘 · 아바타.
 *
 *  docs/MEDIC_redesigned_41screens 시안에서 잘라낸 PNG 다 (scratchpad crop.mjs).
 *  흰 배경에서 자른 것(_w)은 mix-blend-mode: multiply 로 얹으면 어느 바탕에서든 흰 부분이 사라진다.
 *  타일 바탕에서 자른 것은 같은 색 타일 위에만 쓴다.
 *  모두 장식이다 — 의미는 옆 글자가 전달한다 (계획서 9장).
 */

import type { CSSProperties } from "react";

import avatarFamily from "../assets/redesign/avatar_family.png";
import avatarGrandma from "../assets/redesign/avatar_grandma_w.png";
import avatarGrandmaLg from "../assets/redesign/avatar_grandma_lg.png";
import avatarGrandpa from "../assets/redesign/avatar_grandpa_w.png";
import avatarPair from "../assets/redesign/avatar_pair.png";
import emojiBad from "../assets/redesign/emoji_bad.png";
import emojiGood from "../assets/redesign/emoji_good.png";
import emojiNormal from "../assets/redesign/emoji_normal.png";
import icBellRed from "../assets/redesign/ic_bell_red.png";
import icBowl from "../assets/redesign/ic_bowl.png";
import icBowlSm from "../assets/redesign/ic_bowl_sm.png";
import icCalendar from "../assets/redesign/ic_calendar.png";
import icCalendarTile from "../assets/redesign/ic_calendar_tile.png";
import icCalendarW from "../assets/redesign/ic_calendar_w.png";
import icCapsulePurpleW from "../assets/redesign/ic_capsule_purple_w.png";
import icCapsuleRed from "../assets/redesign/ic_capsule_red.png";
import icCapsuleRedW from "../assets/redesign/ic_capsule_red_w.png";
import icCapsuleSm from "../assets/redesign/ic_capsule_sm.png";
import icCapsuleTile from "../assets/redesign/ic_capsule_tile.png";
import icCapsuleYellowW from "../assets/redesign/ic_capsule_yellow_w.png";
import icClipboard from "../assets/redesign/ic_clipboard.png";
import icHeartRed from "../assets/redesign/ic_heart_red.png";
import icPersonBlue from "../assets/redesign/ic_person_blue.png";
import icPersonBlueW from "../assets/redesign/ic_person_blue_w.png";
import icRunnerSm from "../assets/redesign/ic_runner_sm.png";
import icSmileyPurple from "../assets/redesign/ic_smiley_purple.png";
import icSmileySm from "../assets/redesign/ic_smiley_sm.png";
import icStethoscope from "../assets/redesign/ic_stethoscope.png";
import icTooth from "../assets/redesign/ic_tooth.png";
import logoHeart from "../assets/redesign/logo_heart.png";
import tileHeart from "../assets/redesign/tile_heart.png";
import tilePerson from "../assets/redesign/tile_person.png";

export const ART = {
  logo: logoHeart,
  avatarFamily,
  avatarGrandma,
  avatarGrandmaLg,
  avatarGrandpa,
  avatarPair,
  emojiGood,
  emojiNormal,
  emojiBad,
  bowl: icBowl,
  bowlSm: icBowlSm,
  capsuleRed: icCapsuleRed,
  capsuleRedW: icCapsuleRedW,
  capsuleYellowW: icCapsuleYellowW,
  capsulePurpleW: icCapsulePurpleW,
  capsuleSm: icCapsuleSm,
  capsuleTile: icCapsuleTile,
  smileyPurple: icSmileyPurple,
  smileySm: icSmileySm,
  calendar: icCalendar,
  calendarTile: icCalendarTile,
  calendarW: icCalendarW,
  bellRed: icBellRed,
  personBlue: icPersonBlue,
  personBlueW: icPersonBlueW,
  runnerSm: icRunnerSm,
  stethoscope: icStethoscope,
  tooth: icTooth,
  clipboard: icClipboard,
  heartRed: icHeartRed,
  tileHeart,
  tilePerson,
} as const;

export type ArtName = keyof typeof ART;

/** 3D 그림 한 장. blend 를 주면 흰 바탕이 사라진다 (흰 배경에서 자른 _w 계열). */
export function Art({
  name,
  size,
  className,
  blend,
  style,
}: {
  name: ArtName;
  size?: number;
  className?: string;
  blend?: boolean;
  style?: CSSProperties;
}) {
  return (
    <img
      src={ART[name]}
      alt=""
      aria-hidden="true"
      className={`art${className ? ` ${className}` : ""}`}
      style={{
        ...(size ? { width: size, height: size } : {}),
        ...(blend ? { mixBlendMode: "multiply" } : {}),
        ...style,
      }}
    />
  );
}

/** 약 캡슐은 색을 돌려가며 쓴다 — 시안이 약마다 다른 색을 준다. 흰 바탕용. */
export const CAPSULES: ArtName[] = ["capsuleRedW", "capsuleYellowW", "capsulePurpleW"];

export function capsuleFor(index: number): ArtName {
  return CAPSULES[index % CAPSULES.length];
}

/** 일정 종류별 그림 */
export function scheduleArt(kind: string): ArtName {
  switch (kind) {
    case "dental":
      return "tooth";
    case "checkup":
      return "clipboard";
    case "family":
      return "personBlueW";
    case "other":
      return "calendarW";
    default:
      return "stethoscope";
  }
}
