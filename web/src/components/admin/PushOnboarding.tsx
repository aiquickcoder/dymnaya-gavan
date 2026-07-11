import { useEffect, useState } from "react";
import { Banner } from "../ui";
import { currentPushState, enablePush, type PushState } from "../../lib/webpush";

const DISMISS_KEY = "mm.push.onboard.dismissed";

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && "ontouchend" in document);
}
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// Онбординг-карточка: объясняет персоналу, как получать пуши о вызовах.
// На iOS даёт инструкцию «добавить на экран Домой» (там пуши только из PWA).
export default function PushOnboarding() {
  const [state, setState] = useState<PushState>("default");
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    currentPushState().then(setState).catch(() => {});
  }, []);

  if (dismissed || state === "subscribed") return null;

  const ios = isIOS();
  const standalone = isStandalone();
  const needsInstall = ios && !standalone; // на iOS пуши работают только из установленного PWA

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function enable() {
    setBusy(true);
    setErr("");
    try {
      await enablePush();
      setState("subscribed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        position: "relative",
        marginBottom: 16,
        border: "1px solid var(--accent)",
        background: "linear-gradient(180deg, rgba(242,103,34,0.06), transparent)",
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть"
        style={{
          position: "absolute", top: 10, right: 12, width: 28, height: 28, border: "none",
          background: "none", color: "var(--muted)", fontSize: 20, lineHeight: 1, cursor: "pointer",
        }}
      >
        ×
      </button>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span
          style={{
            flex: "none", width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center",
            background: "rgba(242,103,34,0.14)", color: "var(--accent)",
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="display" style={{ fontSize: 17 }}>Уведомления о вызовах</div>

          {needsInstall ? (
            <>
              <p className="admin-sub" style={{ marginTop: 4 }}>
                Чтобы получать пуши на этом iPhone, добавьте CRM на экран «Домой» — в Safari уведомления
                приходят только из установленного приложения:
              </p>
              <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
                <li>Нажмите «Поделиться» <b>⎙</b> внизу Safari</li>
                <li>Выберите <b>«На экран „Домой“»</b> и подтвердите</li>
                <li>Откройте <b>HookahMania</b> с экрана «Домой»</li>
                <li>Вернитесь сюда и нажмите <b>«Включить уведомления»</b></li>
              </ol>
            </>
          ) : state === "denied" ? (
            <p className="admin-sub" style={{ marginTop: 4 }}>
              Уведомления заблокированы в настройках браузера/системы. Разрешите их для этого сайта и обновите страницу.
            </p>
          ) : (
            <>
              <p className="admin-sub" style={{ marginTop: 4 }}>
                Включите пуши, чтобы получать вызовы столов (мастер / угли / счёт) даже когда вкладка свёрнута или телефон в кармане.
              </p>
              <button
                type="button"
                className="sm primary"
                onClick={enable}
                disabled={busy}
                style={{ marginTop: 10 }}
              >
                {busy ? "Включаем…" : "Включить уведомления"}
              </button>
              {!standalone && (
                <p className="muted small" style={{ marginTop: 8 }}>
                  Совет: добавьте CRM на экран «Домой» — уведомления будут приходить надёжнее.
                </p>
              )}
            </>
          )}

          {err && (
            <div style={{ marginTop: 10 }}>
              <Banner kind="error">{err}</Banner>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
