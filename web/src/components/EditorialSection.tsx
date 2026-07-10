import type { MenuRecipeView } from "../types";
import { heroBackground } from "../lib/mixImages";
import { flavourColor } from "../lib/flavours";
import { badgeClass } from "./MixCard";

// Large "magazine" feature card used for the month collab / promo highlights.
// The whole card is clickable (keyboard-accessible) and opens the mix detail.
export default function EditorialSection({
  title,
  item,
  masterName,
  onOpen,
}: {
  title: string;
  item: MenuRecipeView;
  masterName?: string;
  onOpen: () => void;
}) {
  const rating = item.rating;
  return (
    <section>
      <div className="section-title">{title}</div>
      <div
        className="editorial"
        role="button"
        tabIndex={0}
        aria-label={`${title}: ${item.name}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <div className="ed-hero" style={{ background: heroBackground(item.name, item.tags) }}>
          {item.badge && <span className={`badge ${badgeClass(item.badge)}`}>{item.badge}</span>}
          {rating != null && rating > 0 && <div className="rating">★ {rating.toFixed(1)}</div>}
          <div className="ed-title">{item.name}</div>
        </div>
        <div className="ed-body">
          {item.description && <p className="ed-desc">{item.description}</p>}
          {item.components && item.components.length > 0 && (
            <div className="comp" style={{ marginBottom: 14 }}>
              {item.components.map((c, i) => (
                <div className="row between" key={i}>
                  <span className="row" style={{ gap: 8 }}>
                    <span className="dot" style={{ width: 10, height: 10, borderRadius: "50%", background: flavourColor(c.flavour) }} />
                    <span style={{ fontSize: 14 }}>
                      {c.brand} {c.flavour}
                    </span>
                  </span>
                  <span className="comp-pct">{c.percent}%</span>
                </div>
              ))}
            </div>
          )}
          {item.tags.length > 0 && (
            <div className="chips" style={{ marginBottom: 14 }}>
              {item.tags.map((t, i) => {
                const cc = flavourColor(t);
                return (
                  <span className="chip" key={i} style={{ borderColor: cc + "66", background: cc + "16" }}>
                    <span className="dot" style={{ background: cc }} />
                    {t}
                  </span>
                );
              })}
            </div>
          )}
          <div className="ed-foot">
            <div>
              <div className="price" style={{ fontSize: 24 }}>{Math.round(item.price)} ₽</div>
              {masterName && <div className="muted small">Мастер {masterName}</div>}
            </div>
            <span className="openbtn">Открыть <span className="ob-arrow">→</span></span>
          </div>
        </div>
      </div>
    </section>
  );
}
