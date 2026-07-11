/* HookahMania service worker — Web Push + click handling. */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "HookahMania", body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  const title = data.title || "HookahMania";
  const options = {
    body: data.body || "",
    icon: new URL("icons/icon-192.png", scope).href,
    badge: new URL("icons/icon-192.png", scope).href,
    tag: data.tag || "hookahmania",
    renotify: true,
    vibrate: [90, 40, 90],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rel = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(rel, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});
