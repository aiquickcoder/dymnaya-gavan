import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell, BackHeader } from "../../components/Shell";
import { badgeClass } from "../../components/MixCard";
import StrengthScale from "../../components/StrengthScale";
import StarRating from "../../components/StarRating";
import { useRequireTable, useGuest } from "../../lib/guards";
import { heroBackground } from "../../lib/mixImages";
import { flavourColor } from "../../lib/flavours";
import type { MenuRecipeView } from "../../types";

export default function Mix() {
  const { id } = useParams();
  const table = useRequireTable();
  const guest = useGuest();

  const [item, setItem] = useState<MenuRecipeView | null>(null);
  const [master, setMaster] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      try {
        const list = await api.menuList(table.restaurantId);
        if (!alive) return;
        const found = list.find((m) => m.id === id) ?? null;
        setItem(found);
        if (found?.authorEmployeeId) {
          const [emp] = await api.employeesBatch([found.authorEmployeeId]).catch(() => []);
          if (alive && emp) setMaster(emp.shortName || emp.firstName);
        }
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [table, id]);

  if (!table) return null;

  return (
    <Shell>
      <BackHeader title="Микс" to="/guest/home" />
      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <div className="empty">Загружаем…</div>
      ) : !item ? (
        <div className="empty">
          <div className="em-ico">○</div>
          <div>Микс не найден</div>
        </div>
      ) : (
        <div className="fade-in">
          <div className="hero tall" style={{ background: heroBackground(item.name, item.tags) }}>
            {item.badge && <span className={`badge ${badgeClass(item.badge)}`}>{item.badge}</span>}
            {item.rating != null && item.rating > 0 && <span className="rating">★ {item.rating.toFixed(1)}</span>}
          </div>

          <h1 className="display" style={{ fontSize: 28, margin: "14px 0 2px" }}>
            {item.name}
          </h1>
          {master && <div className="muted">Мастер {master}</div>}

          <div className="chips" style={{ margin: "14px 0" }}>
            {item.tags.map((t, i) => (
              <span className="chip" key={i}>
                <span className="dot" style={{ background: flavourColor(t) }} />
                {t}
              </span>
            ))}
          </div>

          <div className="section-title display">Крепость</div>
          <StrengthScale value={item.strength} />

          {/* TODO(api): menu positions have no per-component % breakdown — only tags.
              The precise recipe is composed by the master (see the session screen). */}
          <div className="section-title display">Состав</div>
          <p className="muted small" style={{ marginTop: -4 }}>
            Точные пропорции мастер подберёт при приготовлении.
          </p>

          {item.description && (
            <>
              <div className="section-title display">Описание</div>
              <p style={{ marginTop: -4 }}>{item.description}</p>
            </>
          )}

          <div className="spacer lg" />
          <div className="card">
            <div className="row between">
              <div>
                <div className="muted small">Цена</div>
                <div className="price">{Math.round(item.price)} ₽</div>
              </div>
              <button
                className="primary lg"
                onClick={() =>
                  setNote(`Скажите мастеру${master ? " " + master : ""} — он приготовит «${item.name}».`)
                }
              >
                Заказать у мастера
              </button>
            </div>
          </div>

          {note && <Banner kind="ok">{note}</Banner>}

          {/* TODO(api): favourites reference an order-recipe, not a menu position.
              Real "в избранное" lives on the session screen after the mix is served. */}
          <button className="ghost block" disabled title="Доступно после заказа в вашей сессии">
            ♡ В избранное {guest?.anon || !guest ? "(войдите, чтобы сохранять)" : "(после заказа)"}
          </button>
          <div style={{ height: 8 }} />
          <StarRating value={Math.round(item.rating ?? 0)} size="sm" />
        </div>
      )}
    </Shell>
  );
}
