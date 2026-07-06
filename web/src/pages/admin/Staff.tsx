import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, ApiError } from "../../api";
import { useRequireStaff } from "../../lib/guards";
import { Banner } from "../../components/ui";
import StarRating from "../../components/StarRating";
import Modal from "../../components/admin/Modal";
import { masterImageUrl } from "../../lib/masterImages";
import { asset } from "../../lib/asset";
import type { EmployeeFull, RecipeFeedbackItem } from "../../types";

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
