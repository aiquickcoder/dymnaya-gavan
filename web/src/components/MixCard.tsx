import type { MenuRecipeView } from "../types";
import { heroBackground } from "../lib/mixImages";

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
}: {
  item: MenuRecipeView;
  masterName?: string;
  onClick?: () => void;
}) {
  return (
    <div className="mix-card">
      <div className="hero clickable" style={{ background: heroBackground(item.name, item.tags) }} onClick={onClick}>
        {item.badge && <span className={`badge ${badgeClass(item.badge)}`}>{item.badge}</span>}
        {item.rating != null && item.rating > 0 && (
          <span className="rating">★ {item.rating.toFixed(1)}</span>
        )}
      </div>
      <div className="body">
        <div className="row between">
          <div className="name display">{item.name}</div>
        </div>
        <div className="meta">
          {masterName ? `Мастер ${masterName}` : item.description}
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {item.tags.map((t, i) => (
            <span className="chip" key={i}>
              {t}
            </span>
          ))}
        </div>
        <div className="foot">
          <span className="price">{Math.round(item.price)} ₽</span>
          <button className="sm" onClick={onClick}>
            Открыть →
          </button>
        </div>
      </div>
    </div>
  );
}
