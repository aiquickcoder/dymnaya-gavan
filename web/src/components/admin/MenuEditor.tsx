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
const BADGES = ["Хит", "MustHave", "Limited", "Звезда", "?"];

interface CompRow {
  brand: string;
  flavour: string;
  percent: string;
}

function toRows(components: Component[] | undefined): CompRow[] {
  if (!components || components.length === 0) return [{ brand: "", flavour: "", percent: "" }];
  return components.map((c) => ({ brand: c.brand, flavour: c.flavour, percent: String(c.percent) }));
}

function padTags(tags: string[]): [string, string, string] {
  return [tags[0] ?? "", tags[1] ?? "", tags[2] ?? ""];
}

/**
 * Редактор позиции меню в модалке. item=null → создание.
 * Сохраняет через api.adminUpsertMenu (общий demoStore → видно в госте).
 */
export default function MenuEditor({
  open,
  item,
  employees,
  restaurantId,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: MenuRecipeView | null;
  employees: EmployeeFull[];
  restaurantId: string;
  onClose: () => void;
  onSaved: (m: MenuRecipeView) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [strength, setStrength] = useState(5);
  const [price, setPrice] = useState("1200");
  const [badge, setBadge] = useState("");
  const [tags, setTags] = useState<[string, string, string]>(["", "", ""]);
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
      setName(item.name);
      setDescription(item.description ?? "");
      setStrength(item.strength ?? 5);
      setPrice(String(item.price ?? 1200));
      setBadge(item.badge ?? "");
      setTags(padTags(item.tags ?? []));
      setCategory(item.category ?? "Прочее");
      setAvailable(item.available ?? true);
      setAuthor(item.authorEmployeeId || employees[0]?.id || "");
      setImageSlug(item.imageSlug ?? "");
      setRows(toRows(item.components));
    } else {
      setName("");
      setDescription("");
      setStrength(5);
      setPrice("1200");
      setBadge("");
      setTags(["", "", ""]);
      setCategory("Прочее");
      setAvailable(true);
      setAuthor(employees[0]?.id ?? "");
      setImageSlug("");
      setRows([{ brand: "", flavour: "", percent: "" }]);
    }
  }, [open, item, employees]);

  const sum = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const filled = rows
    .map((r) => ({ brand: r.brand.trim(), flavour: r.flavour.trim(), percent: r.percent.trim() }))
    .filter((r) => r.brand || r.flavour || r.percent);
  const compValid =
    filled.length === 0 ||
    (filled.every((r) => r.brand && r.flavour && Number(r.percent) > 0) && sum === 100);
  const preview: Component[] = filled
    .filter((r) => r.flavour && Number(r.percent) > 0)
    .map((r) => ({ brand: r.brand, flavour: r.flavour, percent: Number(r.percent) }));
  const valid = name.trim().length > 0 && Number(price) > 0 && compValid;

  function editRow(i: number, key: keyof CompRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function setTag(i: number, value: string) {
    setTags((prev) => {
      const next = [...prev] as [string, string, string];
      next[i] = value;
      return next;
    });
  }

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
        name: name.trim(),
        description: description.trim(),
        strength,
        price: Number(price) || 0,
        badge: badge.trim() || null,
        tags: tags.map((t) => t.trim()).filter(Boolean),
        category: category.trim() || "Прочее",
        available,
        components,
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

      <div className="form-grid">
        <div className="field full">
          <label>Название</label>
          <input value={name} placeholder="Например, Северное сияние" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field full">
          <label>Описание</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="field full">
          <label>Крепость</label>
          <input type="range" min={1} max={10} value={strength} onChange={(e) => setStrength(+e.target.value)} />
          <StrengthScale value={strength} />
        </div>

        <div className="field">
          <label>Цена, ₽</label>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>

        <div className="field">
          <label>Бейдж</label>
          <input list="menu-badges" value={badge} placeholder="—" onChange={(e) => setBadge(e.target.value)} />
          <datalist id="menu-badges">
            {BADGES.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label>Категория</label>
          <input list="menu-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="menu-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
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

        <div className="field full">
          <label>Вкусы (теги)</label>
          <div className="row">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                list="menu-flavours"
                value={tags[i]}
                placeholder={`тег ${i + 1}`}
                onChange={(e) => setTag(i, e.target.value)}
              />
            ))}
          </div>
          <datalist id="menu-flavours">
            {PALETTE.map((f) => (
              <option key={f.name} value={f.name} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label>Картинка</label>
          <select value={imageSlug} onChange={(e) => setImageSlug(e.target.value)}>
            <option value="">— без фото —</option>
            {IMAGE_SLUGS.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
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

        {imageSlug && (
          <div className="field full">
            <img
              src={asset(`mixes/${imageSlug}.jpg`)}
              alt=""
              style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: "var(--radius)" }}
            />
          </div>
        )}

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
            <span className={sum === 100 ? "pill accent" : "pill"}>сумма: {sum}%</span>
          </div>
          {preview.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <CompositionBars items={preview} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
