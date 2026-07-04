// Recraft-generated hero images (consistent dark-lounge style, see public/mixes/).
// Mapped by mix name, with a flavour-tag fallback so any mix gets a fitting photo.
import { haze } from "./haze";
import { asset } from "./asset";

const BY_NAME: Record<string, string> = {
  "северное сияние": "severnoe-siyanie",
  "гранатовый дым": "granatovyy-dym",
  "тропик лайт": "tropik-layt",
  "цитрус стронг": "tsitrus-strong",
  "тёмная сторона x moon": "temnaya-storona",
  "темная сторона x moon": "temnaya-storona",
  "секретный вкус": "sekret",
};

// flavour keyword → image slug (fallback when the name is unknown)
const BY_TAG: [string[], string][] = [
  [["секрет"], "sekret"],
  [["гранат", "барбарис"], "granatovyy-dym"],
  [["лимон", "грейпфрут", "цитрус"], "tsitrus-strong"],
  [["кокос", "личи"], "tropik-layt"],
  [["виноград", "черника", "дыня"], "temnaya-storona"],
  [["манго", "маракуйя", "лёд", "лед"], "severnoe-siyanie"],
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/×/g, "x");

function slugFor(name: string, flavours: string[]): string | null {
  const exact = BY_NAME[norm(name)];
  if (exact) return exact;
  const tags = flavours.map((f) => f.toLowerCase());
  for (const [keys, slug] of BY_TAG) {
    if (keys.some((k) => tags.some((t) => t.includes(k)))) return slug;
  }
  return null;
}

/** Image URL for a mix, or null if none matches. */
export function mixImageUrl(name: string, flavours: string[] = []): string | null {
  const slug = slugFor(name, flavours);
  return slug ? asset(`mixes/${slug}.jpg`) : null;
}

/** CSS `background` for a hero: real image if we have one, else procedural haze. */
export function heroBackground(name: string, flavours: string[] = []): string {
  const url = mixImageUrl(name, flavours);
  return url ? `url('${url}') center / cover no-repeat` : haze(flavours);
}
