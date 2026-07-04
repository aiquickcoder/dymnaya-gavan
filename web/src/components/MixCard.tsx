import type { MouseEvent } from "react";
import type { MenuRecipeView } from "../types";
import { mixImageUrl } from "../lib/mixImages";
import { haze } from "../lib/haze";

export function badgeClass(badge?: string | null): string {
  const b = (badge ?? "").toLowerCase();
  if (b.includes("хит") || b.includes("hit")) return "hit";
  if (b.includes("limit") || b.includes("лимит")) return "limited";
  if (b.includes("звезд") || b.includes("star")) return "star";
  if (b.includes("?") || b.includes("секрет")) return "secret";
  return "";
}

export default function MixCard({
  item,
  masterName,
  onClick,
  onFav,
  onOrder,
  faved,
}: {
  item: MenuRecipeView;
  masterName?: string;
  onClick?: () => void;
  onFav?: () => void;
  onOrder?: () => void;
  faved?: boolean;
}) {
  const url = mixImageUrl(item.name, item.tags);
  const rating = item.rating;

  const stop = (fn?: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn?.();
  };

  return (
    <div className="mix-card">
      <div className="mix-hero clickable" onClick={onClick}>
        {url ? (
          <img className="mix-img" src={url} loading="lazy" alt={item.name} />
        ) : (
          <div className="mix-fallback" style={{ background: haze(item.tags) }} aria-hidden />
        )}
        <div className="mix-scrim" aria-hidden />
        {item.badge && <span className={`badge ${badgeClass(item.badge)}`}>{item.badge}</span>}
        {rating != null && rating > 0 && <div className="rating">★ {rating.toFixed(1)}</div>}
        <div className="mix-overlay">
          <div>
            <div className="mix-title display">{item.name}</div>
            {masterName && <div className="muted small">Мастер {masterName}</div>}
          </div>
          <div className="mix-price">{Math.round(item.price)} ₽</div>
        </div>
      </div>
      <div className="chips">
        {item.tags.map((t, i) => (
          <span className="chip" key={i}>
            {t}
          </span>
        ))}
      </div>
      {(onFav || onOrder) && (
        <div className="mix-quick">
          <button
            className="sm"
            onClick={stop(onFav ?? onClick)}
            disabled={faved}
            aria-label={faved ? "В избранном" : "Добавить в избранное"}
          >
            {faved ? "♥ В избранном" : "♡ В избранное"}
          </button>
          <button className="sm primary" onClick={stop(onOrder ?? onClick)} aria-label="Заказать микс">
            Заказать
          </button>
        </div>
      )}
    </div>
  );
}
