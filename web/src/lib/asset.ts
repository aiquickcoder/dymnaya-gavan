// Resolve a public asset against the deploy base (/ in dev, /<repo>/ on Pages).
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
