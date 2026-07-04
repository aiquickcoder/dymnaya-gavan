// Ember (default) / Smoke theme switch. Applies `data-theme` on <html> so the
// CSS variable overrides in styles.css take effect app-wide.
import { useEffect } from "react";
import { KEYS, useStored, type ThemeName } from "./store";

export function useTheme(): [ThemeName, (t: ThemeName) => void] {
  const [stored, setStored] = useStored<ThemeName>(KEYS.theme);
  const theme: ThemeName = stored ?? "ember";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return [theme, setStored];
}
