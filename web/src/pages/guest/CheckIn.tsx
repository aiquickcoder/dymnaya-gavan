import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import { KEYS, useStored, type GuestSession, type TableContext } from "../../store";
import { VENUE } from "../../lib/mocks";

// QR entry screen — a guest scans the code on their table (?r=<restaurantId>&t=<tableId>).
// ASH CLUB welcome / splash (screen "qr" in the reference).
export default function CheckIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [guest] = useStored<GuestSession>(KEYS.guest);
  const [, setTable] = useStored<TableContext>(KEYS.table);

  const [restaurantId, setRestaurantId] = useState(params.get("r") ?? "");
  const [tableId, setTableId] = useState(params.get("t") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const r = params.get("r");
    const t = params.get("t");
    if (r) setRestaurantId(r);
    if (t) setTableId(t);
  }, [params]);

  async function open() {
    setBusy(true);
    setError("");
    try {
      const order = await api.openTable({
        restaurantId: restaurantId.trim(),
        tableId: tableId.trim(),
        userId: guest?.userId || undefined,
      });
      setTable({ restaurantId: order.restaurantId, tableId: order.tableId });
      navigate(guest ? "/guest/home" : "/guest/auth");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const ready = restaurantId.trim() && tableId.trim();

  return (
    <Shell>
      <div className="center fade-in" style={{ paddingTop: 20 }}>
        <HookahLogo />

        <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: "var(--accent)" }}>
          // scan accepted
        </div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 44, lineHeight: 0.98, letterSpacing: "-.02em", marginTop: 14 }}>
          ASH<br />CLUB
        </div>
        <div className="muted" style={{ margin: "16px auto 0", fontSize: 13.5, maxWidth: 250, lineHeight: 1.6 }}>
          Клуб коллекционеров вкуса. Собирай миксы, качай уровень, кури как мастер.
        </div>

        <div
          style={{
            marginTop: 22,
            display: "inline-flex",
            gap: 8,
            alignItems: "center",
            fontFamily: "var(--mono)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            padding: "9px 16px",
            borderRadius: 11,
            fontSize: 11,
            letterSpacing: ".1em",
            textTransform: "uppercase",
          }}
        >
          <span className="muted">{VENUE.name}</span>
          <span style={{ color: "var(--faint)" }}>/</span>
          <span style={{ color: "var(--accent)" }}>table {tableId || "—"}</span>
        </div>

        {error && (
          <div style={{ marginTop: 16, textAlign: "left" }}>
            <Banner kind="error">{error}</Banner>
          </div>
        )}

        <div className="card" style={{ textAlign: "left", marginTop: 22 }}>
          <label>ID заведения</label>
          <input value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} placeholder="uuid ресторана" />
          <label>Номер стола</label>
          <input value={tableId} onChange={(e) => setTableId(e.target.value)} placeholder="например, 7" />
          <div className="spacer" />
          <button className="primary block lg" disabled={busy || !ready} onClick={open}>
            {busy ? "Открываем…" : "Войти в клуб"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// Line-art hookah with a glowing ember + rising smoke — the ASH CLUB mark.
function HookahLogo() {
  const rise = (dur: number, delay: number, opacity: number, sw: number, d: string) => (
    <path
      d={d}
      stroke="var(--accent)"
      strokeWidth={sw}
      strokeLinecap="round"
      opacity={opacity}
      style={{ transformBox: "fill-box", transformOrigin: "center bottom", animation: `rise ${dur}s ease-in infinite ${delay}s` }}
    />
  );
  return (
    <svg width="150" height="252" viewBox="0 -24 200 340" fill="none" style={{ marginBottom: 18, overflow: "visible" }}>
      {/* smoke */}
      {rise(3.8, 0, 0.5, 2, "M99 26 C91 14 107 6 98 -10")}
      {rise(4.6, 0.9, 0.35, 2, "M108 30 C115 17 102 9 110 -6")}
      {rise(5.2, 1.8, 0.25, 1.6, "M92 32 C86 22 96 14 90 2")}
      {/* coal */}
      <circle cx="100" cy="40" r="15" stroke="var(--accent)" strokeWidth="1.5" opacity=".4" style={{ animation: "emberPulse 3s ease-in-out infinite" }} />
      <circle cx="100" cy="40" r="9.5" fill="var(--accent)" style={{ filter: "drop-shadow(0 0 10px var(--accent))", animation: "emberPulse 3s ease-in-out infinite" }} />
      <circle cx="96.5" cy="37" r="2.6" fill="#fff" opacity=".65" />
      {/* bowl */}
      <ellipse cx="100" cy="58" rx="28" ry="7.5" stroke="var(--text)" strokeWidth="2.4" opacity=".9" />
      <ellipse cx="100" cy="59" rx="21" ry="5" stroke="var(--accent)" strokeWidth="2" strokeDasharray="1.5 5" opacity=".5" />
      <path d="M74 60 L84 100 Q100 109 116 100 L126 60" stroke="var(--text)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
      <path d="M86 92 Q100 98 114 92" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" opacity=".7" />
      <ellipse cx="100" cy="107" rx="7.5" ry="3" stroke="var(--muted)" strokeWidth="2" />
      {/* stem + collars */}
      <path d="M95 110 L95 212 M105 110 L105 212" stroke="var(--text)" strokeWidth="2.6" strokeLinecap="round" opacity=".9" />
      <ellipse cx="100" cy="120" rx="9" ry="3.4" stroke="var(--muted)" strokeWidth="2" />
      <ellipse cx="100" cy="138" rx="7" ry="2.6" stroke="var(--muted)" strokeWidth="1.8" opacity=".8" />
      {/* plate */}
      <ellipse cx="100" cy="153" rx="34" ry="9" stroke="var(--text)" strokeWidth="2.4" opacity=".9" />
      <ellipse cx="100" cy="153" rx="28" ry="6.5" stroke="var(--muted)" strokeWidth="1.6" opacity=".6" />
      {/* hose */}
      <ellipse cx="107" cy="123" rx="4" ry="5.2" stroke="var(--muted)" strokeWidth="2" />
      <path d="M110 122 C156 111 186 152 174 198 C169 226 153 234 150 248" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <path d="M110 122 C156 111 186 152 174 198 C169 226 153 234 150 248" stroke="var(--muted)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1.5 7" opacity=".55" />
      <rect x="141" y="246" width="18" height="11" rx="5.5" stroke="var(--accent)" strokeWidth="2.4" fill="var(--bg)" />
      {/* vase */}
      <path d="M95 212 C72 219 58 240 58 262 C58 287 77 304 100 304 C123 304 142 287 142 262 C142 240 128 219 105 212" stroke="var(--text)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" opacity=".92" />
      <path d="M67 236 Q60 262 74 288" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" opacity=".2" />
      <ellipse cx="100" cy="304" rx="15" ry="3.5" stroke="var(--muted)" strokeWidth="2" opacity=".75" />
      {/* downstem + water + bubbles */}
      <path d="M97 213 L97 276 M103 213 L103 276" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" opacity=".4" />
      <path d="M68 266 Q100 277 132 266" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
      <circle cx="90" cy="256" r="2.4" fill="var(--accent)" opacity=".6" />
      <circle cx="110" cy="250" r="1.9" fill="var(--accent)" opacity=".5" />
      <circle cx="100" cy="242" r="1.5" fill="var(--accent)" opacity=".4" />
    </svg>
  );
}
