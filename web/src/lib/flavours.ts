// Flavour → colour map, used both by the constructor palette and to synthesize
// the smoky "photo" gradients (there are no real mix photos — see haze.ts).

export interface Flavour {
  name: string;
  hex: string;
}

// The 12 palette flavours from the design, plus a few common extras.
export const PALETTE: Flavour[] = [
  { name: "Манго", hex: "#f2a83d" },
  { name: "Маракуйя", hex: "#e6b93e" },
  { name: "Лимон", hex: "#e9d24e" },
  { name: "Грейпфрут", hex: "#e8734d" },
  { name: "Гранат", hex: "#c0392b" },
  { name: "Виноград", hex: "#7d5ba6" },
  { name: "Черника", hex: "#4a5aa8" },
  { name: "Мята", hex: "#3fae86" },
  { name: "Лёд", hex: "#6fb7d8" },
  { name: "Кокос", hex: "#e8e2d0" },
  { name: "Дыня", hex: "#c7d66a" },
  { name: "Личи", hex: "#e08aa8" },
  { name: "Барбарис", hex: "#d14545" },
  { name: "Апельсин", hex: "#ef8b39" },
  { name: "Ваниль", hex: "#e6cf9a" },
  { name: "Кола", hex: "#8a5a3c" },
];

const BY_NAME = new Map(PALETTE.map((f) => [f.name.toLowerCase(), f.hex]));

const FALLBACK = "#b89552"; // warm ember tone for unknown flavours

/** Colour for a flavour name; deterministic fallback for anything unmapped. */
export function flavourColor(name: string): string {
  const key = name.trim().toLowerCase();
  const exact = BY_NAME.get(key);
  if (exact) return exact;
  // partial match (e.g. "манго-лёд")
  for (const [n, hex] of BY_NAME) if (key.includes(n) || n.includes(key)) return hex;
  return FALLBACK;
}

/** Dim a hex colour toward the dark background so it reads on the ember theme. */
export function mute(hex: string, amount = 0.62): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const mix = (v: number) => Math.round(v * (1 - amount) + 24 * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
