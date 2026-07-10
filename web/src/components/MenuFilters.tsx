import type { MenuRecipeView } from "../types";

// Filter/sort state for the venue menu list. Kept as plain data so the parent
// owns it (useState) and can feed the result count back into <MenuFilters/>.
export type MenuCat = "all" | "fresh" | "sweet" | "strong" | "unusual";
export type MenuFilterState = {
  q: string;
  cat: MenuCat;
  sort: "popular" | "price-asc" | "price-desc" | "strength";
};

export const DEFAULT_FILTERS: MenuFilterState = { q: "", cat: "all", sort: "popular" };

// Category buckets by flavour vibe (tags + strength), case-insensitive.
function matchesCat(it: MenuRecipeView, cat: MenuCat): boolean {
  if (cat === "all") return true;
  const hay = `${it.name} ${it.tags.join(" ")}`.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => hay.includes(w));
  switch (cat) {
    case "fresh":
      return has("свеж", "освеж", "лёд", "лед", "ледян", "мят", "цитрус", "кисл", "газир", "хруст", "сочн");
    case "sweet":
      return has("сладк", "десерт", "медов", "сливочн", "ягодн", "шокол", "ванил", "дынн", "троп", "фрукт");
    case "strong":
      return it.strength >= 8 || has("крепк");
    case "unusual":
      return has("восточн", "секрет", "авторск", "терпк", "горчин", "травян", "необычн", "лимит", "прян");
    default:
      return true;
  }
}

/** Pure filter+sort over menu positions; safe to call on every render. */
export function applyFilters(items: MenuRecipeView[], f: MenuFilterState): MenuRecipeView[] {
  const q = f.q.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (!matchesCat(it, f.cat)) return false;
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

const CATS: { key: MenuCat; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "fresh", label: "Свежий" },
  { key: "sweet", label: "Сладкий" },
  { key: "strong", label: "Крепкий" },
  { key: "unusual", label: "Необычный" },
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
        <div className="seg seg-scroll" role="group" aria-label="Категория">
          {CATS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={value.cat === s.key ? "on" : ""}
              aria-pressed={value.cat === s.key}
              onClick={() => onChange({ ...value, cat: s.key })}
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
