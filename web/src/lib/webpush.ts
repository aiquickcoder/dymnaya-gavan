// Web Push подписка. Всегда обращается к прод-бэкенду (демо-режим не мешает —
// подписка и отправка идут через реальный API).
const API = "https://api.hookahmania.ru";

export type PushState = "unsupported" | "denied" | "subscribed" | "default";

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "subscribed" : "default";
}

export async function enablePush(restaurantId?: string): Promise<void> {
  if (!pushSupported()) throw new Error("Браузер не поддерживает уведомления");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Разрешение на уведомления не выдано");

  const vapid = await fetch(`${API}/webpush/vapid`).then((r) => r.json());
  const { publicKey, enabled } = vapid.data ?? {};
  if (!enabled || !publicKey) throw new Error("Уведомления не настроены на сервере");

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const res = await fetch(`${API}/webpush/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId: restaurantId ?? null, endpoint: json.endpoint, keys: json.keys }),
  });
  if (!res.ok) throw new Error("Не удалось сохранить подписку");
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch(`${API}/webpush/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<number> {
  const r = await fetch(`${API}/webpush/test`, { method: "POST" }).then((x) => x.json());
  return r.data?.sent ?? 0;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
