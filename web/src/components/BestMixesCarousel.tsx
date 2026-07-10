import { useEffect, useRef, useState } from "react";
import type { MenuRecipeView } from "../types";
import { asset } from "../lib/asset";

// Component flavour → stable colour (hashes the name to a pleasant hue), so the
// English tobacco flavours (Supernova, Lemon Blast…) get varied dots + gradient.
function compColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 62% 56%)`;
}
function strengthLabel(s: number): string {
  if (s <= 3) return "Лёгкий";
  if (s <= 6) return "Средний";
  if (s <= 8) return "Крепкий";
  return "Очень крепкий";
}

function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

/**
 * «Лучшие миксы» — горизонтальная карусель карточек с составом, тегами,
 * крепостью и мастером. Соседние карточки чуть выглядывают по краям (видно, что
 * можно листать), пролистывание центрируется. Без зацикливания — обычный скролл,
 * при монтировании центрируем первую карточку.
 */
export default function BestMixesCarousel({
  items,
  masterName,
  onOpen,
}: {
  items: MenuRecipeView[];
  masterName: (id: string) => string;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const N = items.length;

  const centerChild = (i: number, smooth: boolean) => {
    const el = ref.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  };
  const centeredIndex = (el: HTMLElement): number => {
    const center = el.scrollLeft + el.clientWidth / 2;
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i] as HTMLElement;
      if (center >= c.offsetLeft && center < c.offsetLeft + c.offsetWidth) return i;
    }
    return 0;
  };

  // При монтировании центрируем первую карточку (соседняя выглядывает справа).
  useEffect(() => {
    centerChild(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const idx = centeredIndex(el);
    if (idx !== active) setActive(idx);
  };

  const goTo = (r: number) => centerChild(r, true);

  if (!N) return null;

  const renderCard = (m: MenuRecipeView, key: number) => {
    const comps = m.components ?? [];
    const c0 = comps[0] ? compColor(comps[0].flavour) : "#f26722";
    const c1 = comps[1] ? compColor(comps[1].flavour) : c0;
    const c2 = comps[2] ? compColor(comps[2].flavour) : c0;
    const hero =
      `radial-gradient(120% 130% at 14% 18%, ${c0} 0%, transparent 55%),` +
      `radial-gradient(120% 120% at 86% 26%, ${c1} 0%, transparent 55%),` +
      `radial-gradient(150% 150% at 52% 122%, ${c2} 0%, transparent 60%),` +
      `linear-gradient(160deg, #1c1712 0%, #0d0a07 100%)`;
    return (
      <div className="bm-card" key={key} role="button" tabIndex={0} onClick={() => onOpen(m.id)}>
        <div className="bm-hero" style={{ background: hero }}>
          <img
            className="bm-img"
            src={asset(`best/${m.id}.jpg`)}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {m.rating != null && m.rating > 0 && <span className="rating">★ {m.rating.toFixed(1)}</span>}
          <div className="bm-name">{m.name}</div>
        </div>
        <div className="bm-body">
          <div className="bm-meta">
            <span className="bm-master">
              <span className="bm-master-ico">
                <PersonGlyph />
              </span>
              {masterName(m.authorEmployeeId) || "Мастер смены"}
            </span>
            <span className="bm-strength">
              {m.strength}/10 · {strengthLabel(m.strength)}
            </span>
          </div>
          <div className="comp" style={{ marginTop: 10 }}>
            {comps.map((c, i) => (
              <div className="row between" key={i}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="dot" style={{ width: 9, height: 9, borderRadius: "50%", background: compColor(c.flavour) }} />
                  <span style={{ fontSize: 13.5 }}>
                    {c.brand} {c.flavour}
                  </span>
                </span>
                <span className="comp-pct">{c.percent}%</span>
              </div>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 10 }}>
            {m.tags.map((t, i) => (
              <span className="chip" key={i}>
                {t}
              </span>
            ))}
          </div>
          <div className="bm-foot">
            <div className="price">{Math.round(m.price)} ₽</div>
            <span className="openbtn">
              Открыть <span className="ob-arrow">→</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bm-wrap">
      <div className="bm-carousel" ref={ref} onScroll={onScroll} aria-label="Лучшие миксы">
        {items.map((m, i) => renderCard(m, i))}
      </div>
      <div className="banner-dots" role="tablist" aria-label="Переключение миксов">
        {items.map((_, i) => (
          <button key={i} className={"bdot" + (active === i ? " on" : "")} aria-label={`Микс ${i + 1}`} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  );
}
