import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import CompositionBars from "../../components/CompositionBars";
import StrengthScale from "../../components/StrengthScale";
import StarRating from "../../components/StarRating";
import { useRequireTable, useGuest } from "../../lib/guards";
import { heroBackground } from "../../lib/mixImages";
import { asset } from "../../lib/asset";
import { FEEDBACK_CHIPS } from "../../lib/mocks";
import type { Order, OrderRecipeView, ShiftMaster } from "../../types";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** OrderRecipeView has author names but no employeeId — match against the shift. */
function resolveMasterId(r: OrderRecipeView, masters: ShiftMaster[]): string | null {
  for (const m of masters) {
    if (r.authorShortName && norm(m.shortName) === norm(r.authorShortName)) return m.id;
  }
  for (const m of masters) {
    const full = norm(`${m.lastName} ${m.firstName} ${m.middleName}`);
    if (full === norm(r.authorFullName)) return m.id;
  }
  return null;
}

export default function Session() {
  const table = useRequireTable();
  const guest = useGuest();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [masters, setMasters] = useState<ShiftMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [ord, shift] = await Promise.all([
          api.openTable({ restaurantId: table.restaurantId, tableId: table.tableId, userId: guest?.userId || undefined }),
          api.shift(table.restaurantId).catch(() => [] as ShiftMaster[]),
        ]);
        if (!alive) return;
        setOrder(ord);
        setMasters(shift);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [table, guest?.userId]);

  if (!table) return null;

  const recipes = order?.recipes ?? [];

  return (
    <Shell nav>
      <h1 className="display" style={{ fontSize: 27 }}>Мой кальян</h1>
      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <div className="empty">Загружаем сессию…</div>
      ) : recipes.length === 0 ? (
        <div className="empty">
          <div className="em-ico">○</div>
          <div>Пока вы ничего не курите</div>
          <div style={{ height: 14 }} />
          <button className="primary" onClick={() => navigate("/guest/home")}>В меню</button>
        </div>
      ) : (
        recipes.map((r) => (
          <RecipeBlock
            key={r.orderRecipeId}
            recipe={r}
            userId={guest?.anon ? "" : guest?.userId || ""}
            masterId={resolveMasterId(r, masters)}
            onTip={(mid, name) => navigate(`/guest/tip/${mid ?? "x"}?name=${encodeURIComponent(name)}`)}
          />
        ))
      )}
    </Shell>
  );
}

function RecipeBlock({
  recipe,
  userId,
  masterId,
  onTip,
}: {
  recipe: OrderRecipeView;
  userId: string;
  masterId: string | null;
  onTip: (masterId: string | null, name: string) => void;
}) {
  const [revealed, setRevealed] = useState(!recipe.isSecret);
  const [mixScore, setMixScore] = useState(0);
  const [masterScore, setMasterScore] = useState(0);
  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [faved, setFaved] = useState(false);

  const canRate = !!userId;
  const masterName = recipe.authorShortName || recipe.authorFullName;

  function toggleChip(c: string) {
    setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  async function submit() {
    if (!canRate) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (mixScore > 0) await api.rateRecipe(recipe.orderRecipeId, { userId, score: mixScore });
      if (masterScore > 0 && masterId) await api.rateEmployee(masterId, { userId, score: masterScore });
      const review = [...chips, text.trim()].filter(Boolean).join(". ");
      if (review) await api.reviewRecipe(recipe.orderRecipeId, { userId, review });
      setMsg("Спасибо! Оценка и отзыв отправлены.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function fav() {
    if (!canRate) return;
    try {
      await api.addFavourite(userId, recipe.orderRecipeId);
      setFaved(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <div className="fade-in">
      <div
        className="hero"
        style={{
          background: revealed
            ? heroBackground(recipe.recipeName ?? "", recipe.components.map((c) => c.flavour))
            : `url('${asset("mixes/sekret.jpg")}') center / cover no-repeat`,
        }}
      >
        {recipe.isSecret && <span className="badge secret">? Секрет</span>}
      </div>
      <h2 className="display" style={{ fontSize: 22, margin: "12px 0 2px" }}>
        {recipe.recipeName || "Ваш микс"}
      </h2>
      <div className="muted small">Мастер {masterName}</div>

      {recipe.strength != null && (
        <div style={{ margin: "12px 0" }}>
          <StrengthScale value={recipe.strength} />
        </div>
      )}

      <div className="section-title display">Состав</div>
      <CompositionBars items={recipe.components} masked={recipe.isSecret && !revealed} />
      {recipe.isSecret && !revealed && (
        <button className="ghost block" style={{ marginTop: 10 }} onClick={() => setRevealed(true)}>
          Раскрыть секретный вкус
        </button>
      )}

      {!canRate && <Banner kind="info">Войдите, чтобы оценивать, сохранять и оставлять чаевые.</Banner>}

      {canRate && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row between">
            <span>Оцените микс</span>
            <StarRating value={mixScore} onChange={setMixScore} />
          </div>
          <div className="row between" style={{ marginTop: 12 }}>
            <span>Оцените мастера</span>
            <StarRating value={masterScore} onChange={setMasterScore} />
          </div>
          {masterScore > 0 && !masterId && (
            <p className="muted small">Мастера нет в текущей смене — оценка мастера не будет отправлена.</p>
          )}

          <div className="section-title display" style={{ marginBottom: 8 }}>Быстрый отзыв</div>
          <div className="chips">
            {FEEDBACK_CHIPS.map((c) => (
              <span key={c} className={"chip" + (chips.includes(c) ? " on" : "")} onClick={() => toggleChip(c)}>
                {c}
              </span>
            ))}
          </div>
          <div style={{ height: 10 }} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Свой отзыв…" />

          {err && <Banner kind="error">{err}</Banner>}
          {msg && <Banner kind="ok">{msg}</Banner>}

          <div className="spacer" />
          <button className="primary block lg" disabled={busy} onClick={submit}>
            {busy ? "Отправляем…" : "Отправить оценку и отзыв"}
          </button>
          <div className="grid2" style={{ marginTop: 10 }}>
            <button disabled={faved} onClick={fav}>{faved ? "♥ В избранном" : "♡ В избранное"}</button>
            <button onClick={() => onTip(masterId, masterName)}>Чаевые ↗</button>
          </div>
        </div>
      )}
      <div className="spacer lg" />
    </div>
  );
}
