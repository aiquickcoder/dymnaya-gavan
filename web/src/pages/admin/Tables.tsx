import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import Modal from "../../components/admin/Modal";
import FloorMap from "../../components/admin/FloorMap";
import QrModal from "../../components/admin/QrModal";
import { useRequireStaff } from "../../lib/guards";
import type { Call, MenuRecipeView, Order, TableView } from "../../types";

const SHAPES: { value: TableView["shape"]; label: string }[] = [
  { value: "round", label: "Круглый" },
  { value: "square", label: "Квадратный" },
  { value: "rect", label: "Прямоугольный" },
];

const money = (n: number | null | undefined) => `${(n ?? 0).toLocaleString("ru-RU")} ₽`;

export default function Tables() {
  const session = useRequireStaff();
  const rid = session?.restaurantId;
  const empId = session?.employeeId; // автор миксов = текущая сессия (мастера не выбираем)

  const [tables, setTables] = useState<TableView[]>([]);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [menu, setMenu] = useState<MenuRecipeView[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [activeZone, setActiveZone] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [config, setConfig] = useState(false);

  const [order, setOrder] = useState<Order | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const [editing, setEditing] = useState<Partial<TableView> | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const [mixMenuId, setMixMenuId] = useState("");
  const [mixMode, setMixMode] = useState<"menu" | "custom">("menu");
  const [customMix, setCustomMix] = useState("");

  // Только кальянные позиции доступны для «добавить микс» (еда/бар — kind:"kitchen").
  const hookahMenu = useMemo(() => menu.filter((m) => m.kind !== "kitchen"), [menu]);

  const selected = useMemo(
    () => tables.find((t) => t.id === selectedId) ?? null,
    [tables, selectedId],
  );
  const shown = useMemo(
    () => (activeZone === "all" ? tables : tables.filter((t) => t.zone === activeZone)),
    [tables, activeZone],
  );
  const zoneName = useCallback(
    (id: string) => zones.find((z) => z.id === id)?.name ?? id,
    [zones],
  );

  // ---------- initial load ----------
  useEffect(() => {
    if (!rid) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [ts, zs, mn] = await Promise.all([
          api.adminTables(rid),
          api.adminZones(rid),
          api.adminMenu(rid),
        ]);
        if (!alive) return;
        setTables(ts);
        setZones(zs);
        setMenu(mn);
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

  // ---------- активные вызовы со столов (для подсветки на карте) ----------
  const [calls, setCalls] = useState<Call[]>([]);
  useEffect(() => {
    if (!rid) return;
    let alive = true;
    const load = () =>
      api
        .adminCalls(rid)
        .then((c) => {
          if (alive) setCalls(c);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [rid]);

  const calledIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of calls) {
      if (c.status === "done") continue;
      const t = tables.find((x) => x.id === c.tableId || x.label === c.tableId || x.label === c.tableLabel);
      if (t) ids.add(t.id);
    }
    return ids;
  }, [calls, tables]);

  // sensible default for the add-mix select once data lands
  useEffect(() => {
    if (hookahMenu.length && !hookahMenu.some((m) => m.id === mixMenuId)) {
      setMixMenuId(hookahMenu[0].id);
    }
  }, [hookahMenu, mixMenuId]);

  // ---------- keep the selected table's live order in sync ----------
  useEffect(() => {
    if (!rid) return;
    const t = tables.find((x) => x.id === selectedId) ?? null;
    if (!t || t.status !== "occupied") {
      setOrder(null);
      return;
    }
    let alive = true;
    setOrderLoading(true);
    api
      .openTable({ restaurantId: rid, tableId: t.label })
      .then((o) => {
        if (alive) setOrder(o);
      })
      .catch(() => {
        if (alive) setOrder(null);
      })
      .finally(() => {
        if (alive) setOrderLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedId, tables, rid]);

  const refresh = useCallback(async () => {
    if (!rid) return;
    const ts = await api.adminTables(rid);
    setTables(ts);
  }, [rid]);

  // ---------- mutations ----------
  const handleMove = useCallback((id: string, x: number, y: number) => {
    // optimistic — keep the node where the user dropped it, then persist
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, x, y } : t)));
    void api.adminMoveTable(id, x, y).catch(() => {});
  }, []);

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

  function nextLabel(): string {
    const max = tables.reduce((m, t) => Math.max(m, parseInt(t.label, 10) || 0), 0);
    return String(max + 1);
  }

  function openCreate() {
    const zone = activeZone !== "all" ? activeZone : zones[0]?.id ?? "zone-main";
    setEditing({ label: nextLabel(), seats: 4, shape: "round", zone, x: 50, y: 50 });
  }

  function openEdit(t: TableView) {
    setEditing({ ...t });
  }

  function saveTable() {
    if (!editing || !rid) return;
    void run(async () => {
      const saved = await api.adminUpsertTable({ ...editing, restaurantId: rid });
      await refresh();
      setSelectedId(saved.id);
      setEditing(null);
    });
  }

  function deleteTable() {
    if (!editing?.id) return;
    const id = editing.id;
    void run(async () => {
      await api.adminDeleteTable(id);
      if (selectedId === id) setSelectedId(null);
      await refresh();
      setEditing(null);
    });
  }

  function addMix() {
    if (!selected || !mixMenuId || !empId) return;
    const tableId = selected.id;
    void run(async () => {
      await api.adminTableAddMix(tableId, mixMenuId, empId);
      await refresh();
    });
  }

  function addCustomMix() {
    const name = customMix.trim();
    if (!selected || !name || !empId) return;
    const tableId = selected.id;
    void run(async () => {
      await api.adminTableAddCustomMix(tableId, name, empId);
      setCustomMix("");
      await refresh();
    });
  }

  function closeTable() {
    if (!selected) return;
    const tableId = selected.id;
    void run(async () => {
      await api.adminCloseTable(tableId);
      await refresh();
    });
  }

  const occupied = tables.filter((t) => t.status === "occupied").length;

  return (
    <div>
      <h1 className="page-title">Столы</h1>
      <p className="admin-sub">
        {loading
          ? "Загрузка карты зала…"
          : `${tables.length} столов · занято ${occupied} · свободно ${tables.length - occupied}`}
      </p>

      {error && (
        <div style={{ marginTop: 14 }}>
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      <div className="floor" style={{ marginTop: 16 }}>
        <div className="map-toolbar">
          <div className="zone-tabs">
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

          <div style={{ display: "inline-flex", gap: 8 }}>
            {config && (
              <button type="button" className="sm" onClick={openCreate} disabled={busy}>
                + Стол
              </button>
            )}
            <button
              type="button"
              className={config ? "sm primary" : "sm"}
              onClick={() => setConfig((c) => !c)}
            >
              {config ? "Готово" : "Конфиг"}
            </button>
          </div>
        </div>

        <FloorMap
          tables={shown}
          selectedId={selectedId}
          onSelect={(t) => setSelectedId(t.id)}
          config={config}
          onMove={handleMove}
          calledIds={calledIds}
        />

        {config && (
          <p className="admin-sub">
            Режим конфигурации: перетаскивайте столы для расстановки, «+ Стол» — добавить новый,
            «Изменить» — параметры выбранного стола.
          </p>
        )}
      </div>

      {/* ---------- order / detail panel for the selected table ---------- */}
      <div className="order-panel" style={{ marginTop: 16 }}>
        {!selected ? (
          <div className="op-empty">Выберите стол на карте, чтобы увидеть заказ</div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`dot ${selected.status}`} />
                  <b
                    style={{
                      fontFamily: "var(--display)",
                      fontSize: 19,
                      letterSpacing: "var(--display-ls)",
                    }}
                  >
                    Стол {selected.label}
                  </b>
                  <span className="tag">{zoneName(selected.zone)}</span>
                </div>
                <div className="admin-sub" style={{ marginTop: 5 }}>
                  {selected.seats} мест ·{" "}
                  {selected.status === "occupied"
                    ? `занят · ${selected.minutes ?? 0} мин · ${selected.guests ?? 0} гостей`
                    : "свободен"}
                </div>
              </div>

              <div style={{ display: "inline-flex", gap: 8 }}>
                <button type="button" className="sm" onClick={() => setQrOpen(true)}>
                  QR
                </button>
                {config && (
                  <button type="button" className="sm" onClick={() => openEdit(selected)}>
                    Изменить
                  </button>
                )}
              </div>
            </div>

            {selected.status === "occupied" ? (
              <>
                {orderLoading ? (
                  <div className="admin-sub">Загрузка заказа…</div>
                ) : order && order.recipes.length ? (
                  <div>
                    {order.recipes.map((r) => (
                      <div
                        key={r.orderRecipeId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "9px 0",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {r.isSecret ? "Секретный вкус" : r.recipeName ?? "Микс"}
                          </div>
                          <div className="admin-sub" style={{ fontSize: 12, marginTop: 2 }}>
                            Мастер: {r.authorShortName}
                            {r.strength != null ? ` · крепость ${r.strength}/10` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-sub">В заказе пока нет миксов</div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 4,
                  }}
                >
                  <span className="admin-sub">Итого</span>
                  <b style={{ fontSize: 17, fontVariantNumeric: "tabular-nums" }}>
                    {money(selected.total)}
                  </b>
                </div>

                <button
                  type="button"
                  className="sm danger"
                  onClick={closeTable}
                  disabled={busy}
                  style={{ alignSelf: "flex-start" }}
                >
                  Освободить стол
                </button>
              </>
            ) : (
              <div className="admin-sub">Стол свободен — добавьте микс, чтобы открыть заказ.</div>
            )}

            {/* ---- add a mix to this table's order (author = current session) ---- */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <span className="admin-sub" style={{ fontWeight: 600 }}>
                  Добавить микс
                </span>
                <div className="seg" role="group" aria-label="Способ добавления микса">
                  <button
                    type="button"
                    className={mixMode === "menu" ? "on" : ""}
                    aria-pressed={mixMode === "menu"}
                    onClick={() => setMixMode("menu")}
                  >
                    Из меню
                  </button>
                  <button
                    type="button"
                    className={mixMode === "custom" ? "on" : ""}
                    aria-pressed={mixMode === "custom"}
                    onClick={() => setMixMode("custom")}
                  >
                    Свой микс
                  </button>
                </div>
              </div>

              {mixMode === "menu" ? (
                <>
                  <div className="field">
                    <label>Позиция меню</label>
                    <select value={mixMenuId} onChange={(e) => setMixMenuId(e.target.value)}>
                      {hookahMenu.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {money(m.price)}
                          {m.available === false ? " · скрыт" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="sm primary"
                    onClick={addMix}
                    disabled={busy || !mixMenuId || !empId}
                    style={{ marginTop: 10 }}
                  >
                    Добавить микс
                  </button>
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Название микса</label>
                    <input
                      value={customMix}
                      onChange={(e) => setCustomMix(e.target.value)}
                      placeholder="Напр. Северное сияние"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomMix();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="sm primary"
                    onClick={addCustomMix}
                    disabled={busy || !customMix.trim() || !empId}
                    style={{ marginTop: 10 }}
                  >
                    Добавить свой микс
                  </button>
                </>
              )}

              <div className="admin-sub" style={{ marginTop: 8, fontSize: 12 }}>
                Автор: {session?.employeeName ?? "—"}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---------- create / edit table modal ---------- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Стол ${editing.label ?? ""}` : "Новый стол"}
        footer={
          <>
            {editing?.id && (
              <button
                type="button"
                className="danger"
                onClick={deleteTable}
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
              onClick={saveTable}
              disabled={busy || !editing?.label}
            >
              Сохранить
            </button>
          </>
        }
      >
        {editing && (
          <div className="form-grid">
            <div className="field">
              <label>Номер / метка</label>
              <input
                value={editing.label ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, label: e.target.value }))}
                placeholder="Напр. 12"
              />
            </div>
            <div className="field">
              <label>Мест</label>
              <input
                type="number"
                min={1}
                max={20}
                value={editing.seats ?? 4}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, seats: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                }
              />
            </div>
            <div className="field">
              <label>Форма</label>
              <select
                value={editing.shape ?? "round"}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, shape: e.target.value as TableView["shape"] }))
                }
              >
                {SHAPES.map((sh) => (
                  <option key={sh.value} value={sh.value}>
                    {sh.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Зона</label>
              <select
                value={editing.zone ?? zones[0]?.id ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, zone: e.target.value }))}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>

      <QrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        restaurantId={rid ?? ""}
        table={selected}
      />
    </div>
  );
}
