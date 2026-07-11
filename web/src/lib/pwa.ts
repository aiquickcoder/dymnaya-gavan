// Регистрация service worker + манифест/метатеги PWA с учётом base-пути и
// текущего раздела: гость → «Example lounge», админка → «HookahMania Admin»
// (чтобы при «Добавить на экран Домой» подставлялось правильное имя).

const BASE = import.meta.env.BASE_URL || "/";

// Переключить контекст PWA (заголовок/имя установки/манифест) под раздел.
export function setPWATarget(isAdmin: boolean): void {
  const appTitle = isAdmin ? "HookahMania Admin" : "Example lounge";
  const manifestFile = isAdmin ? "manifest-admin.webmanifest" : "manifest.webmanifest";
  document.title = appTitle;
  setMeta("apple-mobile-web-app-title", appTitle);
  let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = BASE + manifestFile;
}

export function initPWA(): void {
  const isAdmin = /\/admin(\/|$)/.test(location.pathname);
  setPWATarget(isAdmin);

  setMeta("theme-color", "#f26722");
  setMeta("apple-mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
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

// create-or-update мета-тег
function setMeta(name: string, content: string): void {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}
