// Recraft-generated kitchen-bar photos (dark premium food style, see public/food/).
// Mapped by dish name so demo food positions get a fitting photo without a slug.
import { asset } from "./asset";

const BY_NAME: Record<string, string> = {
  "хумус с питой": "hummus",
  "сырная тарелка": "cheese-plate",
  "стейк рибай": "ribeye",
  "паста карбонара": "carbonara",
  "домашний лимонад": "lemonade",
  "чай масала": "masala",
};

/** Photo URL for a kitchen-bar dish, or null if none matches. */
export function foodImageUrl(name: string): string | null {
  const slug = BY_NAME[name.trim().toLowerCase()];
  return slug ? asset(`food/${slug}.jpg`) : null;
}
