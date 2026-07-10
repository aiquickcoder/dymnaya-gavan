import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner, Field } from "../../components/ui";
import { Shell, BackHeader } from "../../components/Shell";
import { useRequireTable, useGuest } from "../../lib/guards";
import type { Zone } from "../../types";

// Слоты времени 16:00–23:30 с шагом 30 минут.
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const m = 16 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const humanDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

/**
 * Гость бронирует стол: отправляет заявку (статус «Новая»), которую управляющий
 * подтверждает в CRM. Только для авторизованного гостя — аноним видит вход.
 */
export default function Book() {
  const table = useRequireTable();
  const guest = useGuest();
  const navigate = useNavigate();
  const loggedIn = !!guest && !guest.anon && !!guest.userId;

  const today = useMemo(() => ymd(new Date()), []);
  const tomorrow = useMemo(() => ymd(new Date(Date.now() + 864e5)), []);

  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("20:00");
  const [guests, setGuests] = useState(2);
  const [zone, setZone] = useState<string | null>(null); // Zone.id | null (любая)
  const [note, setNote] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!table) return;
    api.adminZones(table.restaurantId).then(setZones).catch(() => setZones([]));
  }, [table]);

  if (!table) return null;

  async function submit() {
    if (!table || !guest) return;
    if (!name.trim()) {
      setError("Укажите имя для брони");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.createReservation({
        restaurantId: table.restaurantId,
        userId: guest.userId,
        guestName: name.trim(),
        phone: guest.phoneNumber || "",
        date,
        time,
        guests,
        zone,
        note: note.trim() || null,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell nav hideCall>
      <BackHeader title="Бронь стола" to="/guest/home" />

      {!loggedIn ? (
        <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
          <div className="display" style={{ fontSize: 20, marginBottom: 6 }}>Войдите, чтобы забронировать</div>
          <p className="muted" style={{ marginBottom: 18 }}>
            Бронь привязывается к вашему профилю, чтобы вы видели её статус и историю.
          </p>
          <button className="primary block" onClick={() => navigate("/guest/auth")}>Войти</button>
        </div>
      ) : done ? (
        <div className="card fade-in" style={{ textAlign: "center", padding: "30px 20px" }}>
          <div className="ok-ring" aria-hidden="true">✓</div>
          <div className="display" style={{ fontSize: 22, margin: "12px 0 6px" }}>Заявка отправлена</div>
          <p className="muted" style={{ marginBottom: 4 }}>
            {humanDate(date)} · {time} · {guests} {guests === 1 ? "гость" : "гостя"}
          </p>
          <p className="muted small" style={{ marginBottom: 20 }}>Подтвердим бронь в ближайшее время.</p>
          <button className="primary block" onClick={() => navigate("/guest/profile")}>Мои брони</button>
          <div style={{ height: 8 }} />
          <button className="ghost block" onClick={() => navigate("/guest/home")}>На главную</button>
        </div>
      ) : (
        <div className="fade-in">
          {error && <Banner kind="error">{error}</Banner>}

          <div className="section-title">Когда</div>
          <div className="bk-seg" role="group" aria-label="Дата">
            <button className={date === today ? "on" : ""} onClick={() => setDate(today)}>Сегодня</button>
            <button className={date === tomorrow ? "on" : ""} onClick={() => setDate(tomorrow)}>Завтра</button>
            <label className={date !== today && date !== tomorrow ? "on date-pick" : "date-pick"}>
              {date !== today && date !== tomorrow ? humanDate(date) : "Другая дата"}
              <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          <div className="section-title">Время</div>
          <div className="bk-slots">
            {TIME_SLOTS.map((t) => (
              <button key={t} className={time === t ? "bk-slot on" : "bk-slot"} onClick={() => setTime(t)}>{t}</button>
            ))}
          </div>

          <div className="section-title">Гостей</div>
          <div className="bk-guests">
            <div className="stepper">
              <button onClick={() => setGuests((g) => Math.max(1, g - 1))} aria-label="меньше">−</button>
              <span className="val">{guests}</span>
              <button onClick={() => setGuests((g) => Math.min(12, g + 1))} aria-label="больше">+</button>
            </div>
            <span className="muted small">до 12 гостей</span>
          </div>

          <div className="section-title">Зона</div>
          <div className="bk-seg" role="group" aria-label="Зона">
            <button className={zone === null ? "on" : ""} onClick={() => setZone(null)}>Любая</button>
            {zones.map((z) => (
              <button key={z.id} className={zone === z.id ? "on" : ""} onClick={() => setZone(z.id)}>{z.name}</button>
            ))}
          </div>

          <div className="spacer" />
          <Field label="Ваше имя" value={name} onChange={setName} placeholder="Как к вам обращаться" />
          {guest?.phoneNumber && (
            <div className="muted small" style={{ margin: "8px 0 16px" }}>Телефон для связи: {guest.phoneNumber}</div>
          )}
          <Field label="Комментарий (необязательно)" value={note} onChange={setNote} placeholder="Повод, пожелания по столу…" />

          <div className="spacer lg" />
          <button className="primary block lg" disabled={busy} onClick={submit}>
            {busy ? "Отправляем…" : "Забронировать стол"}
          </button>
          <p className="muted small center" style={{ marginTop: 10 }}>
            Это заявка — заведение подтвердит бронь и назначит стол.
          </p>
        </div>
      )}
    </Shell>
  );
}
