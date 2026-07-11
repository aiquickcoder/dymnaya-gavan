import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { asset } from "../lib/asset";

// Полноэкранный просмотр фото: пинч-зум (2 пальца), даблтап-зум, панорама пальцем,
// свайп между фото, закрытие по фону / крестику / Esc.
export default function PhotoLightbox({
  photos,
  index,
  onClose,
}: {
  photos: string[];
  index: number | null;
  onClose: () => void;
}) {
  const [cur, setCur] = useState(index ?? 0);
  const imgRef = useRef<HTMLImageElement>(null);
  const t = useRef({ scale: 1, tx: 0, ty: 0 });
  const pts = useRef<Map<number, { x: number; y: number }>>(new Map());
  const g = useRef({ startDist: 0, startScale: 1, startTx: 0, startTy: 0, downX: 0, downY: 0, lastTap: 0, moved: false });

  useEffect(() => {
    if (index !== null) setCur(index);
  }, [index]);

  useEffect(() => {
    reset(true);
  }, [cur]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (index === null) return null;

  function apply(anim = false) {
    const el = imgRef.current;
    if (!el) return;
    el.style.transition = anim ? "transform .2s ease-out" : "none";
    el.style.transform = `translate(${t.current.tx}px, ${t.current.ty}px) scale(${t.current.scale})`;
  }
  function reset(anim = false) {
    t.current = { scale: 1, tx: 0, ty: 0 };
    apply(anim);
  }
  function go(d: number) {
    setCur((c) => (c + d + photos.length) % photos.length);
  }
  const dist = () => {
    const v = [...pts.current.values()];
    return Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
  };

  function onDown(e: ReactPointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    g.current.moved = false;
    if (pts.current.size === 2) {
      g.current.startDist = dist();
      g.current.startScale = t.current.scale;
    } else {
      g.current.downX = e.clientX;
      g.current.downY = e.clientY;
      g.current.startTx = t.current.tx;
      g.current.startTy = t.current.ty;
    }
  }
  function onMove(e: ReactPointerEvent) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size >= 2) {
      t.current.scale = Math.min(4, Math.max(1, g.current.startScale * (dist() / g.current.startDist)));
      g.current.moved = true;
      apply();
    } else {
      const dx = e.clientX - g.current.downX;
      const dy = e.clientY - g.current.downY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) g.current.moved = true;
      if (t.current.scale > 1) {
        t.current.tx = g.current.startTx + dx;
        t.current.ty = g.current.startTy + dy;
      } else {
        t.current.tx = dx; // свайп-обратная связь
      }
      apply();
    }
  }
  function onUp(e: ReactPointerEvent) {
    pts.current.delete(e.pointerId);
    if (pts.current.size > 0) return;
    if (t.current.scale > 1) {
      // остаёмся в зуме; если чуть уехали — округлим панораму (оставляем как есть)
      return;
    }
    if (!g.current.moved) {
      const now = Date.now();
      if (now - g.current.lastTap < 300) {
        t.current = { scale: 2.5, tx: 0, ty: 0 };
        apply(true);
        g.current.lastTap = 0;
      } else {
        g.current.lastTap = now;
      }
      return;
    }
    if (Math.abs(t.current.tx) > 60) go(t.current.tx < 0 ? 1 : -1);
    else reset(true);
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none",
      }}
    >
      {/* счётчик */}
      <div style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top))", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600, pointerEvents: "none" }}>
        {cur + 1} / {photos.length}
      </div>

      {/* крестик */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Закрыть"
        style={{
          position: "absolute", top: "calc(10px + env(safe-area-inset-top))", right: 14, zIndex: 2,
          width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.14)",
          color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        ✕
      </button>

      {/* картинка (жесты) */}
      <img
        ref={imgRef}
        src={asset(photos[cur])}
        alt={`Фото ${cur + 1}`}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          maxWidth: "100vw", maxHeight: "88vh", objectFit: "contain",
          userSelect: "none", WebkitUserSelect: "none", touchAction: "none", willChange: "transform", cursor: "grab",
        }}
      />

      {/* стрелки (десктоп) */}
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Назад" onClick={(e) => { e.stopPropagation(); go(-1); }} style={arrowStyle("left")}>‹</button>
          <button type="button" aria-label="Вперёд" onClick={(e) => { e.stopPropagation(); go(1); }} style={arrowStyle("right")}>›</button>
        </>
      )}

      {/* подсказка */}
      <div style={{ position: "absolute", bottom: "calc(16px + env(safe-area-inset-bottom))", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 12, pointerEvents: "none" }}>
        Двойной тап или щипок — приблизить
      </div>
    </div>,
    document.body,
  );
}

function arrowStyle(side: "left" | "right"): CSSProperties {
  return {
    position: "absolute", top: "50%", transform: "translateY(-50%)", [side]: 8,
    width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.12)",
    color: "#fff", fontSize: 26, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  };
}
