import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import { KEYS, useStored, type GuestSession, type TableContext } from "../../store";
import { VENUE } from "../../lib/mocks";

// QR entry screen — a guest scans the code on their table (?r=<restaurantId>&t=<tableId>).
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
      <div className="center fade-in" style={{ paddingTop: 24 }}>
        <div className="display" style={{ fontSize: 15, color: "var(--muted)", letterSpacing: ".08em" }}>
          КАЛЬЯННОЕ МЕНЮ
        </div>
        <h1 className="display" style={{ fontSize: 34, margin: "6px 0 20px" }}>
          {VENUE.name}
        </h1>

        <div className="card glow" style={{ display: "inline-block", padding: 22 }}>
          <QrGlyph />
        </div>

        <p className="muted small" style={{ marginTop: 14 }}>
          Отсканируйте QR-код на столе. Для демо введите данные вручную.
        </p>

        {error && <Banner kind="error">{error}</Banner>}

        <div className="card" style={{ textAlign: "left", marginTop: 14 }}>
          <label>ID заведения</label>
          <input value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} placeholder="uuid ресторана" />
          <label>Номер стола</label>
          <input value={tableId} onChange={(e) => setTableId(e.target.value)} placeholder="например, 7" />
          <div className="spacer" />
          <button className="primary block lg" disabled={busy || !ready} onClick={open}>
            {busy ? "Открываем…" : "Открыть меню"}
          </button>
        </div>

        <div className="muted small" style={{ marginTop: 10 }}>
          Заведение {VENUE.name}
          {tableId ? ` · Стол ${tableId}` : ""}
        </div>
      </div>
    </Shell>
  );
}

function QrGlyph() {
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" fill="none">
      <rect x="1" y="1" width="130" height="130" rx="10" stroke="var(--border)" />
      {[
        [12, 12], [12, 92], [92, 12],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="28" height="28" rx="4" stroke="var(--accent)" strokeWidth="3" />
          <rect x={x + 9} y={y + 9} width="10" height="10" rx="2" fill="var(--accent)" />
        </g>
      ))}
      {Array.from({ length: 26 }).map((_, i) => (
        <rect
          key={i}
          x={54 + (i % 6) * 12}
          y={54 + Math.floor(i / 6) * 12}
          width="8"
          height="8"
          rx="1.5"
          fill={i % 3 === 0 ? "var(--accent-2)" : "var(--muted)"}
          opacity={i % 2 ? 0.5 : 0.85}
        />
      ))}
    </svg>
  );
}
