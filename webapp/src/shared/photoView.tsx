/** 식사 사진 크게 보기 (2026-09-11).
 *
 *  목록의 사진은 작아서 무엇을 드셨는지 알아볼 수 없었다. 눌러서 화면 가득 본다.
 *  자녀 리포트 · 부모 건강기록 · 부모 식사 체크가 같은 것을 쓴다.
 *
 *  닫는 길을 넉넉히 둔다 — 사진 아무 데나 누르기 · ✕ · Esc · 안드로이드 뒤로가기.
 *  부모님이 "빠져나오지 못하는" 화면이 되면 안 된다.
 */

import { useEffect } from "react";

import { Glyph } from "./glyphs";
import { useOverlayBack } from "./overlay";

export interface Photo {
  src: string;
  alt: string;
  /** 사진 아래 한 줄 — "아침 · 9월 11일 (금)" 같은 것 */
  caption?: string;
}

export function PhotoView({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  const open = photo !== null;

  /* 안드로이드 뒤로가기가 앱을 끄지 않고 이것부터 닫게 한다 */
  useOverlayBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!photo) return null;

  return (
    <div
      className="photo-view"
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      onClick={onClose}
    >
      <button className="photo-close" onClick={onClose} aria-label="닫기">
        <Glyph name="close" size={28} />
      </button>
      <img src={photo.src} alt={photo.alt} />
      {photo.caption && <p className="photo-cap">{photo.caption}</p>}
    </div>
  );
}

/** 목록 안의 작은 사진. 누르면 크게 본다. */
export function PhotoThumb({ photo, onOpen }: { photo: Photo; onOpen: (p: Photo) => void }) {
  return (
    <button
      type="button"
      className="thumb-btn"
      onClick={(e) => {
        // 사진이 줄 전체를 누르는 카드 안에 있을 수 있다. 줄이 같이 반응하면 안 된다
        e.stopPropagation();
        onOpen(photo);
      }}
      aria-label={`${photo.alt} 크게 보기`}
    >
      {/* 목록에서는 늦게 불러온다. 화면 밖 사진까지 한꺼번에 받으면
          리포트를 열자마자 LTE 로 수백 KB 가 나간다 (2026-09-11) */}
      <img className="thumb" src={photo.src} alt="" loading="lazy" decoding="async" />
      <span className="zoom" aria-hidden="true">
        <Glyph name="plus" size={16} />
      </span>
    </button>
  );
}
