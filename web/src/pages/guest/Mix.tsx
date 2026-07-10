import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell, BackHeader } from "../../components/Shell";
import { badgeClass } from "../../components/MixCard";
import StrengthScale from "../../components/StrengthScale";
import StarRating from "../../components/StarRating";
import { useRequireTable, useGuest } from "../../lib/guards";
import { heroBackground } from "../../lib/mixImages";
import { flavourColor } from "../../lib/flavours";
import { asset } from "../../lib/asset";
import type { MenuRecipeView } from "../../types";

function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

export default function Mix() {
  const { id } = useParams();
  const table = useRequireTable();
  const guest = useGuest();
  const navigate = useNavigate();
  const loggedIn = !!guest && !guest.anon && !!guest.userId;

  const [item, setItem] = useState<MenuRecipeView | null>(null);
  const [master, setMaster] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [faved, setFaved] = useState(false);

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
            <img
              className="bm-img"
              src={asset(`best/${item.id}.jpg`)}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            {item.badge && <span className={`badge ${badgeClass(item.badge)}`}>{item.badge}</span>}
            {item.rating != null && item.rating > 0 && <span className="rating">★ {item.rating.toFixed(1)}</span>}
          </div>

          <h1 className="display" style={{ fontSize: 28, margin: "14px 0 2px" }}>
            {item.name}
          </h1>
          {master && (
            <div className="bm-master" style={{ marginTop: 4 }}>
              <span className="bm-master-ico">
                <PersonGlyph />
              </span>
              Мастер {master}
            </div>
          )}

          <div className="chips" style={{ margin: "14px 0" }}>
            {item.tags.map((t, i) => {
              const c = flavourColor(t);
              return (
                <span className="chip" key={i} style={{ borderColor: c + "66", background: c + "16", color: "var(--text)" }}>
                  <span className="dot" style={{ background: c }} />
                  {t}
                </span>
              );
            })}
          </div>

          <div className="section-title">Крепость</div>
          <StrengthScale value={item.strength} />

          {item.components && item.components.length > 0 ? (
            <>
              <div className="section-title">Состав</div>
              <div className="stackbar" style={{ marginBottom: 12 }}>
                {item.components.map((c, i) => (
                  <span key={i} style={{ width: `${c.percent}%`, background: flavourColor(c.flavour) }} />
                ))}
              </div>
              <div className="comp" style={{ marginBottom: 8 }}>
                {item.components.map((c, i) => (
                  <div className="row between" key={i}>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="dot" style={{ width: 11, height: 11, borderRadius: "50%", background: flavourColor(c.flavour) }} />
                      <span style={{ fontSize: 14 }}>{c.brand} {c.flavour}</span>
                    </span>
                    <span className="comp-pct">{c.percent}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : item.tags.length > 0 ? (
            <>
              <div className="section-title">Вкусовой профиль</div>
              <div className="chips" style={{ marginBottom: 8 }}>
                {item.tags.map((t, i) => {
                  const c = flavourColor(t);
                  return (
                    <span className="chip" key={i} style={{ borderColor: c + "66", background: c + "16", color: "var(--text)" }}>
                      <span className="dot" style={{ background: c }} />
                      {t}
                    </span>
                  );
                })}
              </div>
              <p className="muted small" style={{ marginTop: 2 }}>
                Точные пропорции мастер подберёт при приготовлении.
              </p>
            </>
          ) : null}

          {item.description && (
            <>
              <div className="section-title">Описание</div>
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

          {/* Неавторизованный гость → на вход; авторизованный сохраняет микс в избранное. */}
          {loggedIn ? (
            <button
              className="ghost block"
              disabled={faved}
              onClick={async () => {
                if (!guest?.userId || !item) return;
                try {
                  await api.addFavourite(guest.userId, item.id);
                  setFaved(true);
                  setNote(`«${item.name}» в избранном — смотрите в профиле.`);
                } catch (e) {
                  setError(e instanceof ApiError ? e.message : String(e));
                }
              }}
            >
              {faved ? "♥ В избранном" : "♡ В избранное"}
            </button>
          ) : (
            <button className="ghost block" onClick={() => navigate("/guest/auth")}>
              ♡ В избранное — войдите, чтобы сохранять
            </button>
          )}
          <div style={{ height: 8 }} />
          <StarRating value={Math.round(item.rating ?? 0)} size="sm" />
        </div>
      )}
    </Shell>
  );
}
