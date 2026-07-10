import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import Modal from "./Modal";
import StrengthScale from "../StrengthScale";
import CompositionBars from "../CompositionBars";
import { PALETTE } from "../../lib/flavours";
import { asset } from "../../lib/asset";
import type { Component, EmployeeFull, MenuRecipeView } from "../../types";

// Known hero slugs shipped in public/mixes/ — the picture picker (no uploader in demo).
const IMAGE_SLUGS: { slug: string; label: string }[] = [
  { slug: "severnoe-siyanie", label: "Северное сияние" },
  { slug: "granatovyy-dym", label: "Гранатовый дым" },
  { slug: "tropik-layt", label: "Тропик Лайт" },
  { slug: "tsitrus-strong", label: "Цитрус Стронг" },
  { slug: "temnaya-storona", label: "Тёмная сторона" },
  { slug: "sekret", label: "Секрет" },
];

const CATEGORIES = ["Хиты", "Классика", "Лёгкие", "Крепкие", "Лимитки", "Секретные", "Промо", "Прочее"];

// Kitchen-bar categories (fixed set — guest groups foodMenu by these).
const FOOD_CATEGORIES = ["Закуски", "Горячее", "Десерты", "Лимонады", "Чай и кофе", "Коктейли"];

// Пресеты бейджа — value сохраняется в menu.badge, каждый чип рисует настоящий .badge-превью.
const BADGE_PRESETS: { value: string; label: string }[] = [
  { value: "", label: "нет" },
  { value: "Хит", label: "Хит" },
  { value: "Limited", label: "Limited" },
  { value: "Звезда", label: "Звезда" },
  { value: "Секрет", label: "Секрет" },
  { value: "MustHave", label: "MustHave" },
];

// Демо-«Загрузить»: бэкенда нет — просто подставляем готовый плейсхолдер-слаг.
const UPLOAD_PLACEHOLDER = "severnoe-siyanie";

interface CompRow {
  brand: string;
  flavour: string;
  percent: string;
}

function toRows(components: Component[] | undefined): CompRow[] {
  if (!components || components.length === 0) return [{ brand: "", flavour: "", percent: "" }];
  return components.map((c) => ({ brand: c.brand, flavour: c.flavour, percent: String(c.percent) }));
}

// Иконки (zero-dep inline SVG).
const XIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const WarnIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l9 16H3z" />
    <path d="M12 10v4M12 17.5v.5" />
  </svg>
);

/**
 * Редактор позиции меню в модалке. item=null → создание.
 * Сохраняет через api.adminUpsertMenu (общий demoStore → видно в госте).
 */
export default function MenuEditor({
  open,
  item,
  employees,
  restaurantId,
  defaultKind = "hookah",
  onClose,
  onSaved,
}: {
  open: boolean;
  item: MenuRecipeView | null;
  employees: EmployeeFull[];
  restaurantId: string;
  defaultKind?: "hookah" | "kitchen";
  onClose: () => void;
  onSaved: (m: MenuRecipeView) => void;
}) {
  const [kind, setKind] = useState<"hookah" | "kitchen">("hookah");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [strength, setStrength] = useState(5);
  const [price, setPrice] = useState("1200");
  const [badge, setBadge] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [category, setCategory] = useState("Прочее");
  const [available, setAvailable] = useState(true);
  const [author, setAuthor] = useState("");
  const [imageSlug, setImageSlug] = useState("");
  const [rows, setRows] = useState<CompRow[]>([{ brand: "", flavour: "", percent: "" }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Reset the form whenever the modal opens for a (different) item.
  useEffect(() => {
    if (!open) return;
    setErr("");
    setSaving(false);
    if (item) {
      const k = item.kind ?? "hookah";
      setKind(k);
      setName(item.name);
      setDescription(item.description ?? "");
      setStrength(item.strength ?? 5);
      setPrice(String(item.price ?? 1200));
      setBadge(item.badge ?? "");
      setTags(item.tags ?? []);
      setTagDraft("");
      setCategory(item.category ?? (k === "kitchen" ? "Закуски" : "Прочее"));
      setAvailable(item.available ?? true);
      setAuthor(item.authorEmployeeId || employees[0]?.id || "");
      setImageSlug(item.imageSlug ?? "");
      setRows(toRows(item.components));
    } else {
      setKind(defaultKind);
      setName("");
      setDescription("");
      setStrength(5);
      setPrice(defaultKind === "kitchen" ? "650" : "1200");
      setBadge("");
      setTags([]);
      setTagDraft("");
      setCategory(defaultKind === "kitchen" ? "Закуски" : "Прочее");
      setAvailable(true);
      setAuthor(employees[0]?.id ?? "");
      setImageSlug("");
      setRows([{ brand: "", flavour: "", percent: "" }]);
    }
  }, [open, item, employees, defaultKind]);

  const isKitchen = kind === "kitchen";
  const sum = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const filled = rows
    .map((r) => ({ brand: r.brand.trim(), flavour: r.flavour.trim(), percent: r.percent.trim() }))
    .filter((r) => r.brand || r.flavour || r.percent);
  const compComplete = filled.every((r) => r.brand && r.flavour && Number(r.percent) > 0);
  const compValid = isKitchen || filled.length === 0 || (compComplete && sum === 100);
  // Видимые состояния состава (не тихая блокировка — ошибку всегда показываем).
  const compOver = !isKitchen && filled.length > 0 && sum > 100;
  const compOff = !isKitchen && filled.length > 0 && sum !== 100;
  const compIncomplete = !isKitchen && filled.length > 0 && !compComplete;
  const preview: Component[] = filled
    .filter((r) => r.flavour && Number(r.percent) > 0)
    .map((r) => ({ brand: r.brand, flavour: r.flavour, percent: Number(r.percent) }));
  const valid = name.trim().length > 0 && Number(price) > 0 && compValid;

  // Switching type resets the category to a sensible default for that type so the
  // hookah free-text category never leaks into the kitchen select (and vice-versa).
  function changeKind(next: "hookah" | "kitchen") {
    if (next === kind) return;
    setKind(next);
    if (next === "kitchen") {
      if (!FOOD_CATEGORIES.includes(category)) setCategory("Закуски");
    } else if (!CATEGORIES.includes(category)) {
      setCategory("Прочее");
    }
  }

  function editRow(i: number, key: keyof CompRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  // Вкусы: произвольное число тегов. Enter/кнопка добавляет, × удаляет.
  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    setTags((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setTagDraft("");
  }
  function removeTag(i: number) {
    setTags((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Бейдж = свободная строка. Пресет-чип активен при точном совпадении со значением;
  // «нет» активен при пустом бейдже. Свой текст в поле снимает выделение с пресетов.
  const isBadgeSelected = (value: string) => badge.trim() === value;

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const components: Component[] = filled.map((r) => ({
        brand: r.brand,
        flavour: r.flavour,
        percent: Number(r.percent),
      }));
      const payload: Partial<MenuRecipeView> & { restaurantId: string } = {
        restaurantId,
        kind,
        name: name.trim(),
        description: description.trim(),
        // Kitchen positions carry no strength / flavour tags / component breakdown.
        strength: isKitchen ? 0 : strength,
        price: Number(price) || 0,
        badge: badge.trim() || null,
        tags: isKitchen ? [] : tags.map((t) => t.trim()).filter(Boolean),
        category: category.trim() || (isKitchen ? "Закуски" : "Прочее"),
        available,
        components: isKitchen ? [] : components,
        imageSlug: imageSlug || null,
      };
      if (author) payload.authorEmployeeId = author;
      if (item) payload.id = item.id;
      const saved = await api.adminUpsertMenu(payload);
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose} disabled={saving}>
        Отмена
      </button>
      <button type="button" className="primary" onClick={() => void save()} disabled={!valid || saving}>
        {saving ? "Сохраняю…" : item ? "Сохранить" : "Создать"}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={item ? "Редактировать позицию" : "Новая позиция"} footer={footer}>
      {err && <div className="banner error" style={{ marginBottom: 14 }}>{err}</div>}

      <div className="kind-toggle">
        <div className="seg" role="group" aria-label="Тип позиции">
          <button
            type="button"
            className={!isKitchen ? "on" : ""}
            aria-pressed={!isKitchen}
            onClick={() => changeKind("hookah")}
          >
            Кальян
          </button>
          <button
            type="button"
            className={isKitchen ? "on" : ""}
            aria-pressed={isKitchen}
            onClick={() => changeKind("kitchen")}
          >
            Кухня-бар
          </button>
        </div>
      </div>

      <div className="form-grid">
        <div className="field full">
          <label>Название</label>
          <input value={name} placeholder="Например, Северное сияние" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field full">
          <label>Описание</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {!isKitchen && (
          <div className="field full">
            <label>Крепость</label>
            <input type="range" min={1} max={10} value={strength} onChange={(e) => setStrength(+e.target.value)} />
            <StrengthScale value={strength} />
          </div>
        )}

        <div className="field">
          <label>Цена, ₽</label>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>

        <div className="field">
          <label>Категория</label>
          {isKitchen ? (
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {FOOD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input list="menu-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="menu-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </div>

        <div className="field">
          <label>Автор</label>
          <select value={author} onChange={(e) => setAuthor(e.target.value)}>
            {employees.length === 0 && <option value="">—</option>}
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.shortName || `${e.lastName} ${e.firstName}`.trim()}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Доступность</label>
          <button
            type="button"
            className={"switch" + (available ? " on" : "")}
            role="switch"
            aria-checked={available}
            aria-label="Доступна в меню"
            onClick={() => setAvailable((v) => !v)}
          >
            <span className="knob" />
          </button>
        </div>

        <div className="field full">
          <label>Бейдж</label>
          <div className="badge-editor">
            <div className="be-presets" role="radiogroup" aria-label="Пресеты бейджа">
              {BADGE_PRESETS.map((p) => {
                const selected = isBadgeSelected(p.value);
                return (
                  <button
                    key={p.label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={"be-preset" + (selected ? " on" : "")}
                    onClick={() => setBadge(p.value)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <input
              className="be-input"
              value={badge}
              maxLength={24}
              placeholder="…или свой текст бейджа"
              onChange={(e) => setBadge(e.target.value)}
            />
          </div>
        </div>

        <div className="field full">
          <label>Картинка</label>
          <div className="img-gallery" role="radiogroup" aria-label="Фото позиции">
            <button
              type="button"
              role="radio"
              aria-checked={imageSlug === ""}
              className={"img-thumb none" + (imageSlug === "" ? " selected" : "")}
              onClick={() => setImageSlug("")}
            >
              без фото
            </button>
            {IMAGE_SLUGS.map((s) => (
              <button
                key={s.slug}
                type="button"
                role="radio"
                aria-checked={imageSlug === s.slug}
                title={s.label}
                className={"img-thumb" + (imageSlug === s.slug ? " selected" : "")}
                style={{ backgroundImage: `url('${asset(`mixes/${s.slug}.jpg`)}')` }}
                onClick={() => setImageSlug(s.slug)}
              >
                <span className="it-cap">{s.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="img-thumb upload"
              title="Демо: подставить плейсхолдер"
              onClick={() => setImageSlug(UPLOAD_PLACEHOLDER)}
            >
              ↑ Загрузить
            </button>
          </div>
        </div>

        {!isKitchen && (
          <div className="field full">
            <label>Вкусы (теги)</label>
            <div className="tags-editor">
              {tags.map((t, i) => (
                <span className="tag-chip" key={`${t}-${i}`}>
                  {t}
                  <button type="button" aria-label={`Удалить вкус ${t}`} onClick={() => removeTag(i)}>
                    {XIcon}
                  </button>
                </span>
              ))}
              <input
                className="tag-add"
                list="menu-flavours"
                value={tagDraft}
                placeholder="+ добавить вкус"
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagDraft);
                  }
                }}
              />
              <button type="button" className="ghost sm" onClick={() => addTag(tagDraft)}>
                Добавить
              </button>
            </div>
            <datalist id="menu-flavours">
              {PALETTE.map((f) => (
                <option key={f.name} value={f.name} />
              ))}
            </datalist>
          </div>
        )}

        {!isKitchen && (
        <div className="field full">
          <label>Состав (сумма процентов = 100)</label>
          {rows.map((r, i) => (
            <div className="row" key={i} style={{ marginBottom: 8 }}>
              <input placeholder="бренд" value={r.brand} onChange={(e) => editRow(i, "brand", e.target.value)} />
              <select value={r.flavour} onChange={(e) => editRow(i, "flavour", e.target.value)}>
                <option value="">вкус…</option>
                {PALETTE.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="%"
                value={r.percent}
                inputMode="numeric"
                style={{ maxWidth: 72 }}
                onChange={(e) => editRow(i, "percent", e.target.value)}
              />
              <button
                type="button"
                className="danger sm"
                disabled={rows.length === 1}
                aria-label="Удалить компонент"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <div className="row between">
            <button
              type="button"
              className="ghost sm"
              onClick={() => setRows((prev) => [...prev, { brand: "", flavour: "", percent: "" }])}
            >
              + компонент
            </button>
            <span className={"comp-sum" + (sum === 100 ? " ok" : compOver ? " over" : "")}>
              сумма: <b>{sum}%</b>
            </span>
          </div>
          {compOver && (
            <div className="comp-error" style={{ marginTop: 8 }}>
              {WarnIcon}
              <span>Сумма больше 100% — уменьшите проценты компонентов.</span>
            </div>
          )}
          {!compOver && compOff && (
            <div className="comp-hint" style={{ marginTop: 6 }}>
              Сумма процентов должна быть 100% (сейчас {sum}%).
            </div>
          )}
          {compIncomplete && (
            <div className="comp-hint" style={{ marginTop: 6 }}>
              У каждого компонента укажите бренд, вкус и процент.
            </div>
          )}
          {preview.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <CompositionBars items={preview} />
            </div>
          )}
        </div>
        )}
      </div>
    </Modal>
  );
}
