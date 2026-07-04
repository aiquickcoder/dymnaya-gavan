import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import CompositionBars from "../../components/CompositionBars";
import StarRating from "../../components/StarRating";
import BottomSheet from "../../components/BottomSheet";
import { KEYS, useStored, type GuestSession } from "../../store";
import { useTheme } from "../../theme";
import { ACHIEVEMENTS, HISTORY } from "../../lib/mocks";
import type { Favourite } from "../../types";

export default function Profile() {
  const navigate = useNavigate();
  const [guest, setGuest] = useStored<GuestSession>(KEYS.guest);
  const [theme, setTheme] = useTheme();
  const [favs, setFavs] = useState<Favourite[]>([]);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState(false);

  const loggedIn = !!guest && !guest.anon && !!guest.userId;

  useEffect(() => {
    if (!loggedIn) return;
    api
      .listFavourites(guest!.userId)
      .then(setFavs)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [loggedIn, guest?.userId]);

  async function unfav(orderRecipeId: string) {
    if (!guest?.userId) return;
    setFavs((f) => f.filter((x) => x.orderRecipeId !== orderRecipeId));
    await api.removeFavourite(guest.userId, orderRecipeId).catch(() => {});
  }

  function logout() {
    setGuest(null);
    navigate("/guest/auth");
  }

  return (
    <Shell nav>
      <div className="row between">
        <h1 className="display" style={{ fontSize: 27 }}>Профиль</h1>
        <div className="seg">
          <button className={theme === "ember" ? "on" : ""} onClick={() => setTheme("ember")}>Уголь</button>
          <button className={theme === "smoke" ? "on" : ""} onClick={() => setTheme("smoke")}>Ночь</button>
        </div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {!loggedIn ? (
        <div className="card center" style={{ marginTop: 12 }}>
          <div className="avatar lg" style={{ margin: "0 auto 10px" }}>Г</div>
          <div className="display" style={{ fontSize: 18 }}>Вы вошли как гость</div>
          <p className="muted small">Войдите, чтобы копить избранное, историю и достижения.</p>
          <button className="primary block lg" onClick={() => navigate("/guest/auth")}>
            Войти / Зарегистрироваться
          </button>
        </div>
      ) : (
        <>
          {favs[0] && (
            <>
              <div className="section-title display">Последний микс</div>
              <div className="card">
                <div className="row between">
                  <div className="display" style={{ fontSize: 18 }}>{favs[0].recipeName || "Микс"}</div>
                  {favs[0].myScore != null && <StarRating value={favs[0].myScore} size="sm" />}
                </div>
                <div className="muted small">
                  {favs[0].restaurantName} · Мастер {favs[0].authorShortName || favs[0].authorFullName}
                </div>
              </div>
            </>
          )}

          {/* TODO(api): нет эндпоинта достижений — моковые данные */}
          <div className="section-title display">Достижения и коллекция</div>
          <div className="card">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.name} style={{ marginBottom: 12 }}>
                <div className="row between small">
                  <span style={{ opacity: a.locked ? 0.5 : 1 }}>
                    {a.locked ? "🔒 " : ""}
                    {a.name}
                  </span>
                  <span className="muted">
                    {a.have}/{a.total}
                  </span>
                </div>
                <div className="progress">
                  <div className="fill" style={{ width: `${Math.min(100, (a.have / a.total) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="section-title display">Избранные миксы</div>
          {favs.length === 0 ? (
            <div className="empty">
              <div className="em-ico">♡</div>
              <div>Пока пусто — сохраняйте миксы из сессии</div>
            </div>
          ) : (
            favs.map((f) => (
              <div className="card" key={f.orderRecipeId}>
                <div className="row between">
                  <div className="display" style={{ fontSize: 17 }}>{f.recipeName || "Микс"}</div>
                  <button className="danger sm" onClick={() => unfav(f.orderRecipeId)}>Убрать</button>
                </div>
                <div className="muted small" style={{ marginBottom: 8 }}>
                  {f.restaurantName} · Мастер {f.authorShortName || f.authorFullName}
                </div>
                <CompositionBars items={f.components} masked={f.isSecret} />
                {f.myScore != null && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <span className="muted small">Моя оценка:</span>
                    <StarRating value={f.myScore} size="sm" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* TODO(api): нет эндпоинта истории визитов — моковые данные */}
          <div className="section-title display">История</div>
          {HISTORY.map((h, i) => (
            <div className="card row between" key={i}>
              <div>
                <div>{h.mix}</div>
                <div className="muted small">
                  {h.place} · {h.date} · Мастер {h.master}
                </div>
              </div>
              <StarRating value={h.score} size="sm" />
            </div>
          ))}

          <div className="spacer" />
          <button className="ghost block" onClick={logout}>Выйти</button>
        </>
      )}

      <div className="card clickable glow" style={{ marginTop: 16 }} onClick={() => setSheet(true)}>
        <div className="row between">
          <span>↓ Скачать приложение</span>
          <span className="pill accent">iOS · Android</span>
        </div>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)}>
        <div className="display" style={{ fontSize: 22 }}>Дымная Гавань в кармане</div>
        <p className="muted small">Избранное, история и заказы — всегда с собой.</p>
        <button className="primary block lg" style={{ marginTop: 12 }} onClick={() => setSheet(false)}>App Store</button>
        <div style={{ height: 10 }} />
        <button className="block" onClick={() => setSheet(false)}>Google Play</button>
        <div style={{ height: 10 }} />
        <button className="ghost block" onClick={() => setSheet(false)}>Позже</button>
        <p className="muted small center" style={{ marginTop: 10 }}>
          Это кликабельный прототип — ссылки на сторы пока не активны.
        </p>
      </BottomSheet>
    </Shell>
  );
}
