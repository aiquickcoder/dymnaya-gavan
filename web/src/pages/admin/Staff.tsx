import { useEffect, useMemo, useState, Fragment, type CSSProperties } from "react";
import { api, ApiError } from "../../api";
import { useRequireStaff } from "../../lib/guards";
import { Banner } from "../../components/ui";
import StarRating from "../../components/StarRating";
import Modal from "../../components/admin/Modal";
import { masterImageUrl } from "../../lib/masterImages";
import { asset } from "../../lib/asset";
import type { EmployeeFull, RecipeFeedbackItem, ScheduleRow } from "../../types";

/** Доступные фото сотрудников (public/masters/<slug>.jpg). */
const PHOTO_SLUGS: { slug: string; label: string }[] = [
  { slug: "timur", label: "Тимур" },
  { slug: "alina", label: "Алина" },
  { slug: "din", label: "Дин" },
];
const photoUrl = (slug: string) => asset(`masters/${slug}.jpg`);

/** ФИО одной строкой; запасной вариант — короткое имя. */
function fullName(e: EmployeeFull): string {
  const parts = [e.lastName, e.firstName, e.middleName].map((s) => (s ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" ") : e.shortName || "Без имени";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

// ---- График смен: даты считаем в UTC, чтобы совпадать с ключами adminSchedule ----
const DOW_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const ymdUTC = (d: Date): string => d.toISOString().slice(0, 10);
const atUTCMidnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function startOfWeekUTC(d: Date): Date {
  const x = atUTCMidnight(d);
  const back = (x.getUTCDay() + 6) % 7; // неделя с понедельника
  return addDaysUTC(x, -back);
}
const isWeekendUTC = (d: Date): boolean => {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
};

/** Портрет сотрудника: photoSlug (если задан) → иначе masterImageUrl по имени → иначе инициал. */
function Avatar({ name, photoSlug, size = 52 }: { name: string; photoSlug?: string | null; size?: number }) {
  const url = photoSlug ? photoUrl(photoSlug) : masterImageUrl(name);
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    border: "1px solid var(--border)",
  };
  if (url) return <img src={url} alt="" style={{ ...base, objectFit: "cover" }} />;
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      style={{
        ...base,
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle at 30% 30%, var(--surface-2), var(--surface))",
        color: "var(--accent-2)",
        fontFamily: "var(--display)",
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initial}
    </div>
  );
}

type FormState = {
  lastName: string;
  firstName: string;
  middleName: string;
  shortName: string;
  position: string;
  phone: string;
  photoSlug: string;
};
const BLANK: FormState = { lastName: "", firstName: "", middleName: "", shortName: "", position: "", phone: "", photoSlug: "" };

export default function Staff() {
  const session = useRequireStaff();
  const rid = session?.restaurantId ?? "";

  const [employees, setEmployees] = useState<EmployeeFull[]>([]);
  const [shiftIds, setShiftIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingShift, setSavingShift] = useState(false);

  // редактор (add/edit)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeFull | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // график смен (сотрудники × дни)
  const [schedMode, setSchedMode] = useState<"week" | "month">("week");
  const [schedCursor, setSchedCursor] = useState<Date>(() => atUTCMidnight(new Date()));
  const [schedRows, setSchedRows] = useState<ScheduleRow[]>([]);
  const [schedLoading, setSchedLoading] = useState(true);
  const [schedError, setSchedError] = useState("");
  const [schedSaving, setSchedSaving] = useState<Set<string>>(new Set());

  // карточка мастера (drawer) + его отзывы
  const [cardEmp, setCardEmp] = useState<EmployeeFull | null>(null);
  const [reviews, setReviews] = useState<RecipeFeedbackItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");

  function applyList(list: EmployeeFull[]) {
    setEmployees(list);
    setShiftIds(new Set(list.filter((e) => e.onShift).map((e) => e.id)));
  }

  // первичная загрузка (паттерн Home: alive-guard + skeleton/empty/error)
  useEffect(() => {
    if (!rid) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await api.adminEmployees(rid);
        if (!alive) return;
        applyList(list);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [rid]);

  async function refresh() {
    try {
      applyList(await api.adminEmployees(rid));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  // отзывы гостей о выбранном мастере
  useEffect(() => {
    if (!cardEmp) return;
    let alive = true;
    setReviews([]);
    setReviewsError("");
    setReviewsLoading(true);
    api
      .employeeRecipeFeedback(cardEmp.id)
      .then((r) => {
        if (alive) setReviews(r);
      })
      .catch((e) => {
        if (alive) setReviewsError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setReviewsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [cardEmp]);

  const dirty = useMemo(() => employees.some((e) => shiftIds.has(e.id) !== e.onShift), [employees, shiftIds]);

  // диапазон дат графика (неделя ⇒ 7 дней с Пн; месяц ⇒ все дни месяца)
  const schedDays = useMemo<Date[]>(() => {
    const base = atUTCMidnight(schedCursor);
    if (schedMode === "week") {
      const start = startOfWeekUTC(base);
      return Array.from({ length: 7 }, (_, i) => addDaysUTC(start, i));
    }
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    const count = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    return Array.from({ length: count }, (_, i) => addDaysUTC(first, i));
  }, [schedMode, schedCursor]);

  const fromISO = schedDays.length ? ymdUTC(schedDays[0]) : "";
  const toISO = schedDays.length ? ymdUTC(schedDays[schedDays.length - 1]) : "";
  const todayKey = ymdUTC(new Date());

  const schedRangeLabel = useMemo(() => {
    if (!schedDays.length) return "";
    if (schedMode === "month") {
      return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(schedDays[0]);
    }
    const f = (d: Date) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
    return `${f(schedDays[0])} – ${f(schedDays[schedDays.length - 1])}`;
  }, [schedDays, schedMode]);

  // загрузка графика при смене ресторана / диапазона
  useEffect(() => {
    if (!rid || !fromISO || !toISO) return;
    let alive = true;
    setSchedLoading(true);
    setSchedError("");
    api
      .adminSchedule(rid, fromISO, toISO)
      .then((r) => {
        if (alive) setSchedRows(r);
      })
      .catch((e) => {
        if (alive) setSchedError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setSchedLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [rid, fromISO, toISO]);

  function shiftCursor(dir: number) {
    setSchedCursor((c) => {
      const base = atUTCMidnight(c);
      return schedMode === "week"
        ? addDaysUTC(base, dir * 7)
        : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + dir, 1));
    });
  }

  // клик по ячейке: оптимистичный флип + persist, откат при ошибке
  async function toggleSchedDay(empId: string, dateKey: string, cur: boolean) {
    const cellKey = empId + "|" + dateKey;
    if (schedSaving.has(cellKey)) return;
    const next = !cur;
    const flip = (val: boolean) =>
      setSchedRows((rows) =>
        rows.map((r) => (r.employeeId === empId ? { ...r, days: { ...r.days, [dateKey]: val } } : r)),
      );
    flip(next);
    setSchedSaving((s) => new Set(s).add(cellKey));
    try {
      await api.adminSetScheduleDay(empId, dateKey, next);
    } catch (e) {
      flip(cur);
      setSchedError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSchedSaving((s) => {
        const n = new Set(s);
        n.delete(cellKey);
        return n;
      });
    }
  }

  const schedGridStyle: CSSProperties = {
    gridTemplateColumns: `minmax(130px, 1.3fr) repeat(${schedDays.length}, minmax(44px, 1fr))`,
  };

  function toggleShift(e: EmployeeFull) {
    if (e.status !== "active") return;
    setShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(e.id)) next.delete(e.id);
      else next.add(e.id);
      return next;
    });
  }

  async function saveShift() {
    setSavingShift(true);
    setError("");
    try {
      await api.adminSetShift(rid, [...shiftIds]);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSavingShift(false);
    }
  }

  function openEditor(emp?: EmployeeFull) {
    setEditing(emp ?? null);
    setForm(
      emp
        ? {
            lastName: emp.lastName,
            firstName: emp.firstName,
            middleName: emp.middleName,
            shortName: emp.shortName,
            position: emp.position,
            phone: emp.phone ?? "",
            photoSlug: emp.photoSlug ?? "",
          }
        : BLANK,
    );
    setSaveError("");
    setEditorOpen(true);
  }

  const canSave = form.firstName.trim() !== "" && form.lastName.trim() !== "";

  async function saveEmployee() {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.adminUpsertEmployee({
        restaurantId: rid,
        id: editing?.id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim(),
        shortName: form.shortName.trim() || form.firstName.trim(),
        position: form.position.trim() || "Сотрудник",
        phone: form.phone.trim() || null,
        photoSlug: form.photoSlug || null,
      });
      setEditorOpen(false);
      await refresh();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  if (!session) return null;

  const onShiftCount = shiftIds.size;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Сотрудники</h1>
        <div className="admin-sub">Команда «{session.restaurantName}» · смена и профили мастеров</div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      <div className="toolbar">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="tag ok">
            <span className="dot on" /> На смене: {onShiftCount}
          </span>
          <span className="tag">Всего: {employees.length}</span>
        </div>
        <div className="grow" />
        <button className="ghost" disabled={!dirty || savingShift} onClick={saveShift}>
          {savingShift ? "Сохранение…" : "Сохранить смену"}
        </button>
        <button className="primary" onClick={() => openEditor()}>
          + Сотрудник
        </button>
      </div>

      {loading ? (
        <div className="panel-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 156 }} aria-hidden />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="empty">
          <div className="em-ico">○</div>
          <div>Сотрудников пока нет</div>
        </div>
      ) : (
        <div className="panel-grid">
          {employees.map((e) => {
            const on = shiftIds.has(e.id);
            const inactive = e.status !== "active";
            return (
              <div
                key={e.id}
                className="panel"
                style={{ marginBottom: 0, cursor: "pointer" }}
                onClick={() => setCardEmp(e)}
                role="button"
                tabIndex={0}
              >
                <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                  <Avatar name={e.shortName} photoSlug={e.photoSlug} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <span className="display" style={{ fontSize: 17, lineHeight: 1.15 }}>
                        {fullName(e)}
                      </span>
                      {inactive && <span className="tag danger">Неактивен</span>}
                    </div>
                    <div className="muted small" style={{ marginTop: 2 }}>
                      {e.position}
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <StarRating value={Math.round(e.rating)} size="sm" />
                      <span className="small muted">
                        {e.rating.toFixed(1)} · {e.ratingCount} оц.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="row between" style={{ marginTop: 14 }}>
                  <div
                    className="row"
                    style={{ gap: 9 }}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <span className="small" style={{ color: on ? "var(--accent)" : "var(--muted)" }}>
                      На смене
                    </span>
                    <div
                      className={"switch" + (on ? " on" : "")}
                      style={inactive ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                      onClick={() => toggleShift(e)}
                      role="switch"
                      aria-checked={on}
                      aria-disabled={inactive || undefined}
                      title={inactive ? "Неактивного сотрудника нельзя ставить на смену" : undefined}
                    >
                      <span className="knob" />
                    </div>
                  </div>
                  <button
                    className="ghost sm"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openEditor(e);
                    }}
                  >
                    Изменить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- график смен ---- */}
      <div style={{ marginTop: 30 }}>
        <div className="sched-toolbar">
          <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h2 className="display" style={{ fontSize: 18, margin: 0 }}>
              График смен
            </h2>
            <div className="seg" role="group" aria-label="Диапазон графика">
              <button
                type="button"
                className={schedMode === "week" ? "on" : ""}
                aria-pressed={schedMode === "week"}
                onClick={() => setSchedMode("week")}
              >
                Неделя
              </button>
              <button
                type="button"
                className={schedMode === "month" ? "on" : ""}
                aria-pressed={schedMode === "month"}
                onClick={() => setSchedMode("month")}
              >
                Месяц
              </button>
            </div>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button className="ghost sm" aria-label="Предыдущий период" onClick={() => shiftCursor(-1)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <span
              className="small"
              style={{ minWidth: 128, textAlign: "center", color: "var(--text)", textTransform: "capitalize" }}
            >
              {schedRangeLabel}
            </span>
            <button className="ghost sm" aria-label="Следующий период" onClick={() => shiftCursor(1)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <button className="ghost sm" onClick={() => setSchedCursor(atUTCMidnight(new Date()))}>
              Сегодня
            </button>
          </div>
        </div>

        {schedError && <Banner kind="error">{schedError}</Banner>}

        {schedLoading ? (
          <div className="skeleton" style={{ height: 260 }} aria-hidden />
        ) : schedRows.length === 0 ? (
          <div className="empty">
            <div className="em-ico">○</div>
            <div>Нет сотрудников для графика</div>
          </div>
        ) : (
          <div className="sched-scroll">
            <div className="sched-grid" style={schedGridStyle}>
              <div className="sched-corner">Сотрудник</div>
              {schedDays.map((d) => {
                const key = ymdUTC(d);
                const weekend = isWeekendUTC(d);
                return (
                  <div
                    key={key}
                    className={"sched-daycol" + (key === todayKey ? " today" : "") + (weekend ? " sched-weekend" : "")}
                  >
                    <span className="sd-dow">{DOW_SHORT[d.getUTCDay()]}</span>
                    <span className="sd-date">{d.getUTCDate()}</span>
                  </div>
                );
              })}

              {schedRows.map((r) => (
                <Fragment key={r.employeeId}>
                  <div className="sched-emp">
                    <span className="se-name">{r.shortName}</span>
                    <span className="se-pos">{r.position}</span>
                  </div>
                  {schedDays.map((d) => {
                    const key = ymdUTC(d);
                    const on = !!r.days[key];
                    const weekend = isWeekendUTC(d);
                    const busy = schedSaving.has(r.employeeId + "|" + key);
                    return (
                      <div
                        key={key}
                        className={"sched-cell " + (on ? "on" : "off") + (weekend ? " sched-weekend" : "")}
                        style={busy ? { opacity: 0.5 } : undefined}
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        aria-busy={busy || undefined}
                        aria-label={`${r.shortName}, ${key}: ${on ? "на смене" : "выходной"}`}
                        title={on ? "На смене — снять" : "Выходной — поставить"}
                        onClick={() => toggleSchedDay(r.employeeId, key, on)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            toggleSchedDay(r.employeeId, key, on);
                          }
                        }}
                      >
                        <span className="sc-dot" />
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- add / edit ---- */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? "Профиль сотрудника" : "Новый сотрудник"}
        footer={
          <>
            <button className="ghost" onClick={() => setEditorOpen(false)}>
              Отмена
            </button>
            <button className="primary" disabled={!canSave || saving} onClick={saveEmployee}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </>
        }
      >
        {saveError && <Banner kind="error">{saveError}</Banner>}
        <div className="form-grid">
          <div className="field">
            <label>Фамилия</label>
            <input value={form.lastName} onChange={(e) => upd({ lastName: e.target.value })} placeholder="Азизов" />
          </div>
          <div className="field">
            <label>Имя</label>
            <input value={form.firstName} onChange={(e) => upd({ firstName: e.target.value })} placeholder="Тимур" />
          </div>
          <div className="field">
            <label>Отчество</label>
            <input
              value={form.middleName}
              onChange={(e) => upd({ middleName: e.target.value })}
              placeholder="Русланович"
            />
          </div>
          <div className="field">
            <label>Короткое имя</label>
            <input
              value={form.shortName}
              onChange={(e) => upd({ shortName: e.target.value })}
              placeholder="Тимур"
            />
          </div>
          <div className="field">
            <label>Должность / грейд</label>
            <input
              value={form.position}
              onChange={(e) => upd({ position: e.target.value })}
              placeholder="Старший мастер"
            />
          </div>
          <div className="field">
            <label>Телефон</label>
            <input value={form.phone} onChange={(e) => upd({ phone: e.target.value })} placeholder="+7 903 555-10-00" />
          </div>
        </div>

        <label style={{ marginTop: 14 }}>Фото</label>
        <div className="img-gallery" role="radiogroup" aria-label="Фото сотрудника">
          <div
            role="radio"
            aria-checked={form.photoSlug === ""}
            className={"img-thumb none" + (form.photoSlug === "" ? " selected" : "")}
            onClick={() => upd({ photoSlug: "" })}
          >
            <span className="it-cap">без фото</span>
          </div>
          {PHOTO_SLUGS.map((p) => (
            <div
              key={p.slug}
              role="radio"
              aria-checked={form.photoSlug === p.slug}
              className={"img-thumb" + (form.photoSlug === p.slug ? " selected" : "")}
              style={{ backgroundImage: `url('${photoUrl(p.slug)}')` }}
              onClick={() => upd({ photoSlug: p.slug })}
            >
              <span className="it-cap">{p.label}</span>
            </div>
          ))}
          <div className="img-thumb upload" onClick={() => upd({ photoSlug: PHOTO_SLUGS[0].slug })}>
            <span className="it-cap">Загрузить</span>
          </div>
        </div>
      </Modal>

      {/* ---- карточка мастера + отзывы ---- */}
      <Modal
        open={!!cardEmp}
        onClose={() => setCardEmp(null)}
        variant="drawer"
        title={cardEmp ? fullName(cardEmp) : undefined}
      >
        {cardEmp && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
              <Avatar name={cardEmp.shortName} photoSlug={cardEmp.photoSlug} size={64} />
              <div style={{ minWidth: 0 }}>
                <div className="muted small">{cardEmp.position}</div>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <StarRating value={Math.round(cardEmp.rating)} size="sm" />
                  <span className="small">{cardEmp.rating.toFixed(1)}</span>
                  <span className="small muted">· {cardEmp.ratingCount} оценок</span>
                </div>
                {cardEmp.phone && (
                  <div className="muted small" style={{ marginTop: 6 }}>
                    {cardEmp.phone}
                  </div>
                )}
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className={"tag " + (shiftIds.has(cardEmp.id) ? "ok" : "")}>
                <span className={"dot " + (shiftIds.has(cardEmp.id) ? "on" : "off")} />
                {shiftIds.has(cardEmp.id) ? "На смене" : "Не на смене"}
              </span>
              <span className={"tag " + (cardEmp.status === "active" ? "" : "danger")}>
                {cardEmp.status === "active" ? "Активен" : "Неактивен"}
              </span>
              <button
                className="ghost sm"
                style={{ marginLeft: "auto" }}
                onClick={() => {
                  const e = cardEmp;
                  setCardEmp(null);
                  openEditor(e);
                }}
              >
                Изменить
              </button>
            </div>

            <div>
              <div
                className="display"
                style={{ fontSize: 15, marginBottom: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}
              >
                Отзывы гостей
              </div>

              {reviewsLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[0, 1].map((i) => (
                    <div key={i} className="skeleton" style={{ height: 76 }} aria-hidden />
                  ))}
                </div>
              ) : reviewsError ? (
                <Banner kind="error">{reviewsError}</Banner>
              ) : reviews.length === 0 ? (
                <div className="muted small" style={{ padding: "10px 0" }}>
                  Пока нет отзывов
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reviews.map((r) => (
                    <div key={r.orderRecipeId} className="panel" style={{ marginBottom: 0, padding: 14 }}>
                      <div className="row between" style={{ gap: 8 }}>
                        <span className="small" style={{ fontWeight: 600, color: "var(--text)" }}>
                          {r.recipeName || "Микс"}
                        </span>
                        {typeof r.score === "number" && <StarRating value={r.score} size="sm" />}
                      </div>
                      {r.review && (
                        <div className="small" style={{ marginTop: 6, color: "var(--text)", lineHeight: 1.5 }}>
                          {r.review}
                        </div>
                      )}
                      <div className="muted small" style={{ marginTop: 6 }}>
                        {fmtDate(r.updatedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
