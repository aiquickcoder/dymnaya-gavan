import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner, Components } from "../../components/ui";
import { KEYS, useStored, type StaffSession } from "../../store";
import type { Order, Recipe } from "../../types";

interface Row {
  brand: string;
  flavour: string;
  percent: string;
}

export default function StaffConsole() {
  const navigate = useNavigate();
  const [staff] = useStored<StaffSession>(KEYS.staff);

  const [tableId, setTableId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [recipeName, setRecipeName] = useState("");
  const [strength, setStrength] = useState(5);
  const [isSecret, setIsSecret] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ brand: "", flavour: "", percent: "" }]);
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);

  if (!staff) {
    navigate("/staff");
    return null;
  }

  const percentSum = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);

  function wrap(fn: () => Promise<void>) {
    return async () => {
      setError("");
      setNote("");
      try {
        await fn();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e));
      }
    };
  }

  const openTable = wrap(async () => {
    const o = await api.openTable({ restaurantId: staff.restaurantId, tableId: tableId.trim() });
    setOrder(o);
    setNote(`Стол ${o.tableId} открыт`);
  });

  const reload = async () => {
    if (!order) return;
    setOrder(await api.openTable({ restaurantId: staff.restaurantId, tableId: order.tableId }));
  };

  const createRecipe = wrap(async () => {
    const components = rows.map((r) => ({
      brand: r.brand.trim(),
      flavour: r.flavour.trim(),
      percent: Number(r.percent),
    }));
    const rec = await api.createRecipe({ name: recipeName.trim() || undefined, strength, isSecret, components });
    setMyRecipes((prev) => [rec, ...prev]);
    setRecipeName("");
    setStrength(5);
    setIsSecret(false);
    setRows([{ brand: "", flavour: "", percent: "" }]);
    setNote("Рецепт создан");
  });

  const attach = (recipeId: string) =>
    wrap(async () => {
      if (!order) throw new ApiError("no_order", "Сначала откройте стол");
      await api.attachRecipe(order.id, { recipeId, employeeId: staff.employeeId });
      await reload();
      setNote("Рецепт повешен на стол");
    })();

  const resetTable = wrap(async () => {
    if (!order) return;
    await api.closeOrder(order.id);
    setOrder(null);
    setNote("Стол обнулён");
  });

  return (
    <>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Консоль</h1>
        <span className="pill accent">{staff.restaurantName}</span>
      </div>
      <p className="author" style={{ marginTop: 4 }}>{staff.employeeName}</p>

      {error && <Banner kind="error">{error}</Banner>}
      {note && <Banner kind="ok">{note}</Banner>}

      <h2>Стол</h2>
      <div className="card">
        <div className="row">
          <input placeholder="номер стола" value={tableId} onChange={(e) => setTableId(e.target.value)} />
          <button className="primary" disabled={!tableId.trim()} onClick={openTable}>Открыть</button>
        </div>

        {order && (
          <>
            <div className="spacer" />
            <div className="row between">
              <span className="pill">заказ {order.id.slice(0, 8)}…</span>
              <div className="row">
                <button className="sm" onClick={() => void reload()}>Обновить</button>
                <button className="danger sm" onClick={resetTable}>Обнулить стол</button>
              </div>
            </div>
            {order.recipes.length === 0 ? (
              <p className="muted small" style={{ marginTop: 10 }}>На столе пока нет рецептов.</p>
            ) : (
              order.recipes.map((r) => (
                <div className="card" key={r.orderRecipeId} style={{ marginTop: 10 }}>
                  <div className="recipe-name">{r.recipeName ?? "Без названия"}</div>
                  <div className="author">Готовил: {r.authorShortName}</div>
                  <Components items={r.components} />
                </div>
              ))
            )}
          </>
        )}
      </div>

      <h2>Создать рецепт</h2>
      <div className="card">
        <label>Название (необязательно)</label>
        <input value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="например, Apple Mix" />

        <div className="row" style={{ marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ marginTop: 0 }}>Крепость: {strength}/10</label>
            <input type="range" min={1} max={10} value={strength} onChange={(e) => setStrength(+e.target.value)} />
          </div>
          <button className={isSecret ? "primary sm" : "sm"} onClick={() => setIsSecret((s) => !s)}>
            {isSecret ? "Секретный ✓" : "Секретный"}
          </button>
        </div>

        <label>Компоненты (сумма процентов должна быть 100)</label>
        {rows.map((r, i) => (
          <div className="row" key={i} style={{ marginBottom: 8 }}>
            <input placeholder="бренд" value={r.brand} onChange={(e) => editRow(i, "brand", e.target.value)} />
            <input placeholder="вкус" value={r.flavour} onChange={(e) => editRow(i, "flavour", e.target.value)} />
            <input
              placeholder="%"
              value={r.percent}
              onChange={(e) => editRow(i, "percent", e.target.value)}
              style={{ maxWidth: 80 }}
            />
            <button className="danger sm" disabled={rows.length === 1} onClick={() => removeRow(i)}>×</button>
          </div>
        ))}
        <div className="row between">
          <button className="ghost sm" onClick={() => setRows((p) => [...p, { brand: "", flavour: "", percent: "" }])}>
            + компонент
          </button>
          <span className={percentSum === 100 ? "pill accent" : "pill"}>сумма: {percentSum}%</span>
        </div>
        <div className="spacer" />
        <button className="primary block" disabled={percentSum !== 100 || !allFilled(rows)} onClick={createRecipe}>
          Создать рецепт
        </button>
      </div>

      {myRecipes.length > 0 && (
        <>
          <h2>Мои рецепты — повесить на стол</h2>
          {!order && <Banner kind="info">Откройте стол выше, чтобы вешать рецепты.</Banner>}
          {myRecipes.map((rec) => (
            <div className="card" key={rec.id}>
              <div className="recipe-head">
                <span className="recipe-name">{rec.name ?? "Без названия"}</span>
                <button className="sm" disabled={!order} onClick={() => attach(rec.id)}>На стол →</button>
              </div>
              <Components items={rec.components} />
            </div>
          ))}
        </>
      )}
    </>
  );

  function editRow(i: number, key: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
}

function allFilled(rows: Row[]) {
  return rows.every((r) => r.brand.trim() && r.flavour.trim() && Number(r.percent) > 0);
}
