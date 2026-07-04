import type { MenuRecipeView } from "../types";
import { heroBackground } from "../lib/mixImages";
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
          <div className="ed-foot">
            <div>
              <div className="mix-price">{Math.round(item.price)} ₽</div>
              {masterName && <div className="muted small">Мастер {masterName}</div>}
            </div>
            <span className="pill accent">Открыть →</span>
          </div>
        </div>
      </div>
    </section>
  );
}
