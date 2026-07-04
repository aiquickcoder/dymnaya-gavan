import type { MenuRecipeView } from "../types";

// Filter/sort state for the venue menu list. Kept as plain data so the parent
// owns it (useState) and can feed the result count back into <MenuFilters/>.
export type MenuFilterState = {
  q: string;
  strength: "all" | "light" | "medium" | "strong";
  sort: "popular" | "price-asc" | "price-desc" | "strength";
};

export const DEFAULT_FILTERS: MenuFilterState = { q: "", strength: "all", sort: "popular" };

// strength buckets: light <= 4, medium 5..7, strong >= 8.
function matchesStrength(s: number, band: MenuFilterState["strength"]): boolean {
  switch (band) {
    case "light":
      return s <= 4;
    case "medium":
      return s >= 5 && s <= 7;
    case "strong":
      return s >= 8;
    default:
      return true;
  }
}

/** Pure filter+sort over menu positions; safe to call on every render. */
export function applyFilters(items: MenuRecipeView[], f: MenuFilterState): MenuRecipeView[] {
  const q = f.q.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (!matchesStrength(it.strength, f.strength)) return false;
    if (q) {
      const hay = `${it.name} ${it.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorted = [...filtered];
  switch (f.sort) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "strength":
      sorted.sort((a, b) => b.strength - a.strength);
      break;
    case "popular":
    default:
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
  }
  return sorted;
}

function mixWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "микс";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "микса";
  return "миксов";
}

const STRENGTHS: { key: MenuFilterState["strength"]; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "light", label: "Лёгкие" },
  { key: "medium", label: "Средние" },
  { key: "strong", label: "Крепкие" },
];

export default function MenuFilters({
  value,
  onChange,
  count,
}: {
  value: MenuFilterState;
  onChange: (v: MenuFilterState) => void;
  count: number;
}) {
  return (
    <div className="filters">
      <div className="search">
        <input
          type="search"
          value={value.q}
          placeholder="Поиск по названию или вкусу…"
          aria-label="Поиск по миксам"
          onChange={(e) => onChange({ ...value, q: e.target.value })}
        />
      </div>
      <div className="filter-row">
        <div className="seg" role="group" aria-label="Крепость">
          {STRENGTHS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={value.strength === s.key ? "on" : ""}
              aria-pressed={value.strength === s.key}
              onClick={() => onChange({ ...value, strength: s.key })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          className="filter-select"
          value={value.sort}
          aria-label="Сортировка"
          onChange={(e) => onChange({ ...value, sort: e.target.value as MenuFilterState["sort"] })}
        >
          <option value="popular">Популярные</option>
          <option value="price-asc">Дешевле</option>
          <option value="price-desc">Дороже</option>
          <option value="strength">Крепче</option>
        </select>
        <span className="muted small" aria-live="polite" style={{ marginLeft: "auto" }}>
          {count} {mixWord(count)}
        </span>
      </div>
    </div>
  );
}
