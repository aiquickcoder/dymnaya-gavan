import { useEffect, useState } from "react";
import { currentPushState, enablePush, disablePush, sendTestPush, type PushState } from "../../lib/webpush";

// Кнопка управления браузерными пуш-уведомлениями о вызовах (для персонала).
export default function PushToggle() {
  const [state, setState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    currentPushState().then(setState).catch(() => {});
  }, []);

  if (state === "unsupported") return null;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const bell = (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
  const btn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
    fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {state === "denied" ? (
        <span className="admin-sub" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          {bell} Уведомления заблокированы в браузере
        </span>
      ) : state === "subscribed" ? (
        <>
          <span style={{ ...btn, color: "var(--success)", borderColor: "transparent", background: "rgba(43,182,115,0.12)", cursor: "default" }}>
            {bell} Уведомления включены
          </span>
          <button type="button" style={btn} disabled={busy} onClick={() => run(sendTest)}>
            Тест
          </button>
          <button
            type="button"
            className="admin-sub"
            style={{ background: "none", border: "none", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}
            disabled={busy}
            onClick={() => run(() => disablePush().then(() => setState("default")))}
          >
            выключить
          </button>
        </>
      ) : (
        <button type="button" style={{ ...btn, borderColor: "var(--accent)", color: "var(--accent)" }} disabled={busy} onClick={() => run(() => enablePush().then(() => setState("subscribed")))}>
          {bell} Включить уведомления
        </button>
      )}
      {msg && (
        <span className="admin-sub" style={{ fontSize: 12 }}>
          {msg}
        </span>
      )}
    </div>
  );

  async function sendTest() {
    const n = await sendTestPush();
    setMsg(n > 0 ? `Отправлено на ${n} устр.` : "Нет активных подписок");
  }
}
