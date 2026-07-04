// Recraft-generated master portraits (consistent ring-light lounge style,
// see public/masters/). Mapped by first name; falls back to the initial letter.
import { asset } from "./asset";

const BY_NAME: Record<string, string> = {
  тимур: "timur",
  алина: "alina",
  дин: "din",
};

export function masterImageUrl(name: string): string | null {
  const key = (name || "").trim().toLowerCase();
  const slug = BY_NAME[key];
  return slug ? asset(`masters/${slug}.jpg`) : null;
}
