import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import { useRequireStaff } from "../../lib/guards";
import DataTable, { type Column } from "../../components/admin/DataTable";
import MenuEditor from "../../components/admin/MenuEditor";
import { applyFilters, DEFAULT_FILTERS } from "../../components/MenuFilters";
import { mixImageUrl } from "../../lib/mixImages";
import { asset } from "../../lib/asset";
import type { EmployeeFull, MenuRecipeView } from "../../types";

function thumbUrl(m: MenuRecipeView): string | null {
  if (m.imageSlug) return asset(`mixes/${m.imageSlug}.jpg`);
  return mixImageUrl(m.name, m.tags ?? []);
}

type KindFilter = "all" | "hookah" | "kitchen";
const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "hookah", label: "Кальян" },
  { key: "kitchen", label: "Кухня" },
];

export default function Menu() {
  const session = useRequireStaff();
  const rid = session?.restaurantId ?? "";

  const [rows, setRows] = useState<MenuRecipeView[]>([]);
  const [employees, setEmployees] = useState<EmployeeFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MenuRecipeView | null>(null);

  const load = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    setError("");
    try {
      const [menu, emps] = await Promise.all([api.adminMenu(rid), api.adminEmployees(rid)]);
      setRows(menu);
      setEmployees(emps);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [menu, emps] = await Promise.all([api.adminMenu(rid), api.adminEmployees(rid)]);
        if (!alive) return;
        setRows(menu);
        setEmployees(emps);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session, rid]);

  const authorName = useCallback(
    (id: string) => {
      const e = employees.find((x) => x.id === id);
      return e ? e.shortName || `${e.lastName} ${e.firstName}`.trim() : "—";
    },
    [employees],
  );

  const q = search.trim();
  const byKind =
    kindFilter === "all" ? rows : rows.filter((m) => (m.kind ?? "hookah") === kindFilter);
  const visible = q ? applyFilters(byKind, { ...DEFAULT_FILTERS, q }) : byKind;
  // Reordering writes positions across the FULL list, so only allow it on the
  // unfiltered view (no search, no type filter) to avoid confusing index jumps.
  const reorderable = q === "" && kindFilter === "all";

  async function toggleAvailable(m: MenuRecipeView) {
    const next = !(m.available ?? true);
    setRows((prev) => prev.map((x) => (x.id === m.id ? { ...x, available: next } : x)));
    try {
      await api.adminUpsertMenu({ id: m.id, restaurantId: rid, available: next });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      void load();
    }
  }

  async function move(m: MenuRecipeView, dir: "up" | "down") {
    const idx = rows.findIndex((x) => x.id === m.id);
    if (idx < 0) return;
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next);
    try {
      await api.adminReorderMenu(next.map((x) => x.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      void load();
    }
  }

  async function remove(m: MenuRecipeView) {
    if (!window.confirm(`Удалить позицию «${m.name}»?`)) return;
    try {
      await api.adminDeleteMenu(m.id);
      setRows((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(m: MenuRecipeView) {
    setEditing(m);
    setEditorOpen(true);
  }
  function onSaved() {
    setEditorOpen(false);
    void load();
  }

  const columns: Column<MenuRecipeView>[] = [
    {
      key: "img",
      title: "",
      render: (m) => {
        const url = thumbUrl(m);
        return (
          <div
            className="menu-thumb"
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: url ? `url('${url}') center/cover no-repeat` : "var(--surface-2)",
            }}
            aria-hidden="true"
          />
        );
      },
    },
    {
      key: "name",
      title: "Название",
      render: (m) => (
        <div>
          <div style={{ fontWeight: 600 }}>{m.name}</div>
          {m.tags && m.tags.length > 0 && (
            <div className="muted small">{m.tags.filter(Boolean).join(" · ")}</div>
          )}
        </div>
      ),
    },
    {
      key: "kind",
      title: "Тип",
      render: (m) =>
        m.kind === "kitchen" ? (
          <span className="tag">Кухня</span>
        ) : (
          <span className="tag accent">Кальян</span>
        ),
    },
    {
      key: "category",
      title: "Категория",
      render: (m) => <span className="tag">{m.category ?? "—"}</span>,
    },
    {
      key: "strength",
      title: "Крепость",
      align: "right",
      render: (m) =>
        m.kind === "kitchen" ? <span className="muted">—</span> : <span>{m.strength}/10</span>,
    },
    {
      key: "price",
      title: "Цена",
      align: "right",
      render: (m) => <span className="nowrap">{m.price.toLocaleString("ru")} ₽</span>,
    },
    {
      key: "badge",
      title: "Бейдж",
      render: (m) => (m.badge ? <span className="tag accent">{m.badge}</span> : <span className="muted">—</span>),
    },
    {
      key: "rating",
      title: "★",
      align: "right",
      render: (m) => (m.rating != null ? <span>{m.rating.toFixed(1)}</span> : <span className="muted">—</span>),
    },
    {
      key: "available",
      title: "В меню",
      render: (m) => {
        const on = m.available ?? true;
        return (
          <button
            type="button"
            className={"switch" + (on ? " on" : "")}
            role="switch"
            aria-checked={on}
            aria-label="Доступна в меню"
            onClick={(e) => {
              e.stopPropagation();
              void toggleAvailable(m);
            }}
          >
            <span className="knob" />
          </button>
        );
      },
    },
    {
      key: "author",
      title: "Автор",
      render: (m) => <span>{authorName(m.authorEmployeeId)}</span>,
    },
    {
      key: "actions",
      title: "",
      align: "right",
      headerClassName: "th-actions",
      render: (m) => {
        const idx = rows.findIndex((x) => x.id === m.id);
        return (
          <div className="rowact" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ghost"
              aria-label="Выше"
              disabled={!reorderable || idx <= 0}
              onClick={() => void move(m, "up")}
            >
              ↑
            </button>
            <button
              type="button"
              className="ghost"
              aria-label="Ниже"
              disabled={!reorderable || idx < 0 || idx >= rows.length - 1}
              onClick={() => void move(m, "down")}
            >
              ↓
            </button>
            <button type="button" onClick={() => openEdit(m)}>
              Изм.
            </button>
            <button type="button" className="danger" onClick={() => void remove(m)}>
              Удал.
            </button>
          </div>
        );
      },
    },
  ];

  if (!session) return null;

  return (
    <>
      <h1 className="page-title">Меню</h1>
      <p className="admin-sub">
        Позиции заведения — {rows.length}
        {!reorderable && " · сортировка недоступна при поиске"}
      </p>

      {error && <div className="banner error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Тип позиций">
          {KIND_FILTERS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={kindFilter === k.key ? "on" : ""}
              aria-pressed={kindFilter === k.key}
              onClick={() => setKindFilter(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="search icon grow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={search}
            placeholder="Поиск по названию или вкусу…"
            aria-label="Поиск позиций меню"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="primary" onClick={openCreate}>
          + Добавить
        </button>
      </div>

      {loading ? (
        <div className="panel">
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)" }}>Загрузка…</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(m) => m.id}
          onRowClick={openEdit}
          empty={q ? "Ничего не найдено" : "Меню пусто — добавьте первую позицию"}
        />
      )}

      <MenuEditor
        open={editorOpen}
        item={editing}
        employees={employees}
        restaurantId={rid}
        defaultKind={kindFilter === "kitchen" ? "kitchen" : "hookah"}
        onClose={() => setEditorOpen(false)}
        onSaved={onSaved}
      />
    </>
  );
}
