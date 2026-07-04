// Procedural "smoke photo" — there are no real mix images, so hero visuals are
// synthesized as a layered gradient from the mix's flavour colours.
import { flavourColor, mute } from "./flavours";

/**
 * Build a CSS `background` value: a few radial haze blooms tinted by the mix's
 * flavours, over a warm-dark base, with an inset shadow baked into the string
 * only where supported. Deterministic — same flavours → same image.
 */
export function haze(flavours: string[]): string {
  const cols = (flavours.length ? flavours : ["Дым"]).map((f) => mute(flavourColor(f)));
  const spots = [
    { c: cols[0], x: 22, y: 30, r: 60 },
    { c: cols[1] ?? cols[0], x: 78, y: 24, r: 52 },
    { c: cols[2] ?? cols[0], x: 60, y: 78, r: 66 },
    { c: cols[0], x: 12, y: 82, r: 44 },
  ];
  const radials = spots
    .map((s) => `radial-gradient(120% 90% at ${s.x}% ${s.y}%, ${alpha(s.c, 0.55)} 0%, transparent ${s.r}%)`)
    .join(", ");
  const base = "linear-gradient(160deg, #1c150d 0%, #0e0b08 70%)";
  return `${radials}, ${base}`;
}

function alpha(rgb: string, a: number): string {
  // rgb(...) → rgba(..., a)
  return rgb.replace(/^rgb\(/, "rgba(").replace(/\)$/, `, ${a})`);
}
