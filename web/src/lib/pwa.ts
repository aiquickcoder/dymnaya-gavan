// Регистрация service worker и подключение манифеста с учётом base-пути
// (apex "/" и gh-pages "/dymnaya-gavan/"). Вызывается один раз из main.

const BASE = import.meta.env.BASE_URL || "/";

export function initPWA(): void {
  // манифест + iOS-мета (пути относительно base, чтобы работало на обоих деплоях)
  if (!document.querySelector('link[rel="manifest"]')) {
    const m = document.createElement("link");
    m.rel = "manifest";
    m.href = BASE + "manifest.webmanifest";
    document.head.appendChild(m);
  }
  addMeta("theme-color", "#f26722");
  addMeta("apple-mobile-web-app-capable", "yes");
  addMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  addMeta("apple-mobile-web-app-title", "HookahMania");
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const l = document.createElement("link");
    l.rel = "apple-touch-icon";
    l.href = BASE + "icons/icon-192.png";
    document.head.appendChild(l);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(BASE + "sw.js", { scope: BASE }).catch(() => {});
    });
  }
}

function addMeta(name: string, content: string): void {
  if (document.querySelector(`meta[name="${name}"]`)) return;
  const el = document.createElement("meta");
  el.name = name;
  el.content = content;
  document.head.appendChild(el);
}
