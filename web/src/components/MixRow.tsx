import { useState } from "react";
import type { MenuRecipeView } from "../types";
import { mixImageUrl } from "../lib/mixImages";
import { haze } from "../lib/haze";
import { asset } from "../lib/asset";
import { flavourColor } from "../lib/flavours";
import { badgeClass } from "./MixCard";

// Game "rarity" derived from the mix's badge + rating (menu positions have no
// rarity field). Drives the coloured left border + pill, matching the reference.
function rarity(item: MenuRecipeView): { key: string; label: string; color: string; xp: number } {
  const b = badgeClass(item.badge);
  if (b === "star") return { key: "legend", label: "LEGENDARY", color: "var(--legend)", xp: 90 };
  if (b === "limited") return { key: "epic", label: "EPIC", color: "var(--epic)", xp: 60 };
  if ((item.rating ?? 0) >= 4.8) return { key: "rare", label: "RARE", color: "var(--rare)", xp: 40 };
  return { key: "common", label: "COMMON", color: "var(--common)", xp: 30 };
}

function strengthLabel(s: number): string {
  if (s <= 3) return "Лёгкий";
  if (s <= 6) return "Средний";
  if (s <= 8) return "Крепкий";
  return "Очень крепкий";
}

// Horizontal catalog row (reference "Каталог миксов"): image tile with a
// rarity-coloured left border, name + orange price, rarity pill, strength/XP
// meta, flavour dots and rating. The whole row opens the mix detail.
export default function MixRow({ item, onClick }: { item: MenuRecipeView; onClick?: () => void }) {
  const url = mixImageUrl(item.name, item.tags);
  // Prefer the curated Recraft still-life (best/top-N.jpg); fall back to the
  // name-based image, then to the flavour-tinted haze gradient.
  const [src, setSrc] = useState(asset(`best/${item.id}.jpg`));
  const [imgFailed, setImgFailed] = useState(false);
  const r = rarity(item);
  const rating = item.rating;
  return (
    <div
      className="mix-row"
      role="button"
      tabIndex={0}
      style={{ borderLeftColor: r.color }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="mr-tile" style={{ background: haze(item.tags) }}>
        {!imgFailed && (
          <img
            className="mr-img"
            src={src}
            loading="lazy"
            alt={item.name}
            onError={() => {
              if (url && src !== url) setSrc(url);
              else setImgFailed(true);
            }}
          />
        )}
      </div>
      <div className="mr-body">
        <div className="mr-top">
          <div className="mr-name">{item.name}</div>
          <div className="price mr-price">{Math.round(item.price)} ₽</div>
        </div>
        <div className="mr-meta">
          <span className={`rarity ${r.key}`}>{r.label}</span>
          <span className="muted small">{strengthLabel(item.strength)}</span>
        </div>
        <div className="mr-bottom">
          <div className="mr-dots">
            {item.tags.slice(0, 3).map((t, i) => (
              <span key={i} style={{ background: flavourColor(t) }} />
            ))}
          </div>
          {rating != null && rating > 0 && <span className="mr-rating muted">★ {rating.toFixed(1)}</span>}
        </div>
      </div>
    </div>
  );
}
