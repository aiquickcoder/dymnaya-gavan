import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import Modal from "../../components/admin/Modal";
import { IconGuest, IconReservations, IconTables } from "../../components/admin/icons";
import { useRequireStaff } from "../../lib/guards";
import type { Reservation, ReservationStatus, TableView, Zone } from "../../types";

// Default filter = "today". Mirrors demoStore's TODAY_YMD (UTC slice) so the
// seeded сегодня-брони reliably match the initial filter.
const todayYMD = () => new Date().toISOString().slice(0, 10);

const STATUS_LABEL: Record<ReservationStatus, string> = {
  new: "Новая",
  confirmed: "Подтверждена",
  seated: "За столом",
  cancelled: "Отменена",
};

// Allowed status transitions offered as buttons on each card.
const STATUS_FLOW: Record<
  ReservationStatus,
  { to: ReservationStatus; label: string; cls: string }[]
> = {
  new: [
    { to: "confirmed", label: "Подтвердить", cls: "sm primary" },
    { to: "cancelled", label: "Отменить", cls: "sm danger" },
  ],
  confirmed: [
    { to: "seated", label: "Посадить", cls: "sm primary" },
    { to: "cancelled", label: "Отменить", cls: "sm danger" },
  ],
  seated: [{ to: "confirmed", label: "Вернуть к брони", cls: "sm ghost" }],
  cancelled: [{ to: "new", label: "Вернуть", cls: "sm ghost" }],
};

function pluralGuests(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} гость`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} гостя`;
  return `${n} гостей`;
}

function fmtDate(ymd: string): string {
  // Parse at noon to dodge any tz/DST day-shift, then render "4 июля".
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export default function Reservations() {
  const session = useRequireStaff();
  const rid = session?.restaurantId ?? "";

  const [rows, setRows] = useState<Reservation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<TableView[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState<string>(todayYMD);
  const [activeZone, setActiveZone] = useState<string>("all");

  const [editing, setEditing] = useState<Partial<Reservation> | null>(null);

  const zoneName = useCallback(
    (id?: string | null) => (id ? zones.find((z) => z.id === id)?.name ?? id : ""),
    [zones],
  );

  // ---------- static context (zones + tables) ----------
  useEffect(() => {
    if (!rid) return;
    let alive = true;
    (async () => {
      try {
        const [zs, ts] = await Promise.all([api.adminZones(rid), api.adminTables(rid)]);
        if (!alive) return;
        setZones(zs);
        setTables(ts);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [rid]);

  // ---------- reservations for the selected day ----------
  const load = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    setError("");
    try {
      const list = await api.adminReservations(rid, date);
      setRows(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [rid, date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<void>) {
    if (!rid) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function setStatus(id: string, status: ReservationStatus) {
    void run(async () => {
      await api.adminSetReservationStatus(id, status);
      await load();
    });
  }

  function remove(id: string) {
    void run(async () => {
      await api.adminDeleteReservation(id);
      await load();
    });
  }

  function openCreate() {
    setEditing({
      guestName: "",
      phone: "",
      date,
      time: "20:00",
      tableId: null,
      guests: 2,
      zone: activeZone !== "all" ? activeZone : zones[0]?.id ?? null,
      note: "",
      status: "new",
    });
  }

  function openEdit(r: Reservation) {
    setEditing({ ...r });
  }

  function save() {
    if (!editing || !rid) return;
    void run(async () => {
      await api.adminUpsertReservation({ ...editing, restaurantId: rid });
      await load();
      setEditing(null);
    });
  }

  const shown = useMemo(
    () => (activeZone === "all" ? rows : rows.filter((r) => r.zone === activeZone)),
    [rows, activeZone],
  );

  const active = useMemo(
    () => shown.filter((r) => r.status !== "cancelled").length,
    [shown],
  );

  if (!session) return null;

  return (
    <div>
      <h1 className="page-title">Брони</h1>
      <p className="admin-sub">
        {loading
          ? "Загрузка броней…"
          : `${fmtDate(date)} · всего ${shown.length} · активных ${active}`}
      </p>

      {error && (
        <div style={{ marginTop: 14 }}>
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      {/* ---------- filters ---------- */}
      <div className="resv-filters" style={{ marginTop: 16 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || todayYMD())}
          aria-label="Дата броней"
        />
        <div className="seg">
          <button
            type="button"
            className={activeZone === "all" ? "on" : undefined}
            onClick={() => setActiveZone("all")}
          >
            Все зоны
          </button>
          {zones.map((z) => (
            <button
              type="button"
              key={z.id}
              className={activeZone === z.id ? "on" : undefined}
              onClick={() => setActiveZone(z.id)}
            >
              {z.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="primary"
          onClick={openCreate}
          style={{ marginLeft: "auto" }}
        >
          + Бронь
        </button>
      </div>

      {/* ---------- list ---------- */}
      {loading ? (
        <div className="resv-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="resv-card" key={i} aria-hidden>
              <div className="skeleton" style={{ height: 20, width: "60%", borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 52, width: "100%", borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 36, width: "80%", borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="order-panel" style={{ marginTop: 4 }}>
          <div className="op-empty">
            {activeZone === "all"
              ? "На эту дату броней нет — добавьте первую кнопкой «+ Бронь»."
              : "В этой зоне на выбранную дату броней нет."}
          </div>
        </div>
      ) : (
        <div className="resv-grid">
          {shown.map((r) => (
            <div className="resv-card" key={r.id}>
              <div className="resv-head">
                <div>
                  <div className="rh-name">{r.guestName}</div>
                  {r.phone && <div className="rh-phone">{r.phone}</div>}
                </div>
                <span className={`resv-status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
              </div>

              <div className="resv-meta">
                <div className="rm-row">
                  <IconReservations />
                  <span>
                    <b>{fmtDate(r.date)}</b> · <b>{r.time}</b>
                  </span>
                </div>
                <div className="rm-row">
                  <IconTables />
                  <span>
                    {r.tableLabel
                      ? `Стол ${r.tableLabel}${r.zone ? ` · ${zoneName(r.zone)}` : ""}`
                      : "Стол не назначен"}
                  </span>
                </div>
                <div className="rm-row">
                  <IconGuest />
                  <span>{pluralGuests(r.guests)}</span>
                </div>
                {r.note && (
                  <div className="rm-row" style={{ color: "var(--muted)", fontStyle: "italic" }}>
                    <span>«{r.note}»</span>
                  </div>
                )}
              </div>

              <div className="resv-actions">
                {STATUS_FLOW[r.status].map((a) => (
                  <button
                    key={a.to}
                    type="button"
                    className={a.cls}
                    onClick={() => setStatus(r.id, a.to)}
                    disabled={busy}
                  >
                    {a.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="sm ghost"
                  onClick={() => openEdit(r)}
                  disabled={busy}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="sm danger"
                  onClick={() => remove(r.id)}
                  disabled={busy}
                  style={{ marginLeft: "auto" }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- create / edit modal ---------- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Изменить бронь" : "Новая бронь"}
        footer={
          <>
            {editing?.id && (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  const id = editing.id;
                  if (id) {
                    remove(id);
                    setEditing(null);
                  }
                }}
                disabled={busy}
                style={{ marginRight: "auto" }}
              >
                Удалить
              </button>
            )}
            <button type="button" className="ghost" onClick={() => setEditing(null)}>
              Отмена
            </button>
            <button
              type="button"
              className="primary"
              onClick={save}
              disabled={busy || !editing?.guestName?.trim() || !editing?.date || !editing?.time}
            >
              Сохранить
            </button>
          </>
        }
      >
        {editing && (
          <div className="form-grid">
            <div className="field">
              <label>Гость</label>
              <input
                value={editing.guestName ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, guestName: e.target.value }))}
                placeholder="Имя гостя"
              />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input
                value={editing.phone ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+7 900 000-00-00"
              />
            </div>
            <div className="field">
              <label>Дата</label>
              <input
                type="date"
                value={editing.date ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, date: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Время</label>
              <input
                type="time"
                value={editing.time ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, time: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Стол</label>
              <select
                value={editing.tableId ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, tableId: e.target.value ? e.target.value : null }))
                }
              >
                <option value="">— без стола —</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Стол {t.label} · {zoneName(t.zone)} · {t.seats} мест
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Гостей</label>
              <input
                type="number"
                min={1}
                max={30}
                value={editing.guests ?? 2}
                onChange={(e) =>
                  setEditing((s) => ({
                    ...s,
                    guests: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
              />
            </div>
            <div className="field">
              <label>Зона</label>
              <select
                value={editing.zone ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, zone: e.target.value ? e.target.value : null }))
                }
                disabled={!!editing.tableId}
              >
                <option value="">— не указана —</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label>Заметка</label>
              <textarea
                rows={2}
                value={editing.note ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, note: e.target.value }))}
                placeholder="Например: стол у окна, день рождения"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
