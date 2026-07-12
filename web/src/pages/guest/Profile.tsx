import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import StarRating from "../../components/StarRating";
import FavCardBody from "../../components/FavCardBody";
import { KEYS, useStored, type GuestSession } from "../../store";
import { ACHIEVEMENTS, HISTORY, VENUE } from "../../lib/mocks";
import type { Favourite, Reservation, ReservationStatus } from "../../types";

const RES_LABEL: Record<ReservationStatus, string> = {
  new: "Новая",
  confirmed: "Подтверждена",
  seated: "За столом",
  cancelled: "Отменена",
};
const bookDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
const guestsWord = (n: number) => (n === 1 ? "гость" : n >= 2 && n <= 4 ? "гостя" : "гостей");

export default function Profile() {
  const navigate = useNavigate();
  const [guest, setGuest] = useStored<GuestSession>(KEYS.guest);
  const [favs, setFavs] = useState<Favourite[]>([]);
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [error, setError] = useState("");

  const loggedIn = !!guest && !guest.anon && !!guest.userId;

  useEffect(() => {
    if (!loggedIn) return;
    api
      .listFavourites(guest!.userId)
      .then(setFavs)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    api.myReservations(guest!.userId).then(setBookings).catch(() => {});
  }, [loggedIn, guest?.userId]);

  async function cancelBooking(id: string) {
    setBookings((b) => b.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
    await api.adminSetReservationStatus(id, "cancelled").catch(() => {});
  }

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
      <h1 className="display" style={{ fontSize: 27 }}>Профиль</h1>

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
          <div className="section-title display">Мои брони</div>
          {bookings.length === 0 ? (
            <div className="card center" style={{ padding: "20px" }}>
              <p className="muted small" style={{ marginBottom: 12 }}>Пока нет броней.</p>
              <button className="primary block" onClick={() => navigate("/guest/book")}>Забронировать стол</button>
            </div>
          ) : (
            <>
              {bookings.map((b) => (
                <div className="card" key={b.id}>
                  <div className="row between">
                    <div className="display" style={{ fontSize: 17 }}>{bookDate(b.date)} · {b.time}</div>
                    <span className={`pill res-${b.status}`}>{RES_LABEL[b.status]}</span>
                  </div>
                  <div style={{ marginTop: 3, fontWeight: 600, fontSize: 14 }}>{VENUE.name}</div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {b.guests} {guestsWord(b.guests)}{b.tableLabel ? ` · стол ${b.tableLabel}` : ""}
                  </div>
                  {b.note && <div className="muted small" style={{ marginTop: 4 }}>{b.note}</div>}
                  {(b.status === "new" || b.status === "confirmed") && (
                    <button className="danger sm" style={{ marginTop: 10 }} onClick={() => cancelBooking(b.id)}>Отменить</button>
                  )}
                </div>
              ))}
              <button className="ghost block" style={{ marginTop: 2 }} onClick={() => navigate("/guest/book")}>＋ Новая бронь</button>
            </>
          )}

          {favs[0] && (
            <>
              <div className="section-title display">Последний микс</div>
              <div className="card clickable" onClick={() => navigate(`/guest/mix/${favs[0].recipeId}`)}>
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

          <div className="row between" style={{ alignItems: "baseline", marginTop: 24 }}>
            <div className="section-title display" style={{ margin: 0 }}>Избранные миксы</div>
            {favs.length > 3 && (
              <button className="link-btn" onClick={() => navigate("/guest/favourites")}>Все ({favs.length}) →</button>
            )}
          </div>
          {favs.length === 0 ? (
            <div className="empty">
              <div className="em-ico">♡</div>
              <div>Пока пусто — сохраняйте миксы из меню</div>
            </div>
          ) : (
            <div className="fav-scroll" role="list">
              {favs.slice(0, 3).map((f) => (
                <div className="fav-card" role="listitem" key={f.orderRecipeId} onClick={() => navigate(`/guest/mix/${f.recipeId}`)}>
                  <FavCardBody fav={f} onRemove={() => unfav(f.orderRecipeId)} />
                </div>
              ))}
              {favs.length > 3 && (
                <button className="fav-card fav-more" onClick={() => navigate("/guest/favourites")}>
                  <span className="fm-plus">+{favs.length - 3}</span>
                  <span>Все избранные</span>
                </button>
              )}
            </div>
          )}

          {/* TODO(api): нет эндпоинта истории визитов — моковые данные */}
          <div className="section-title display">История</div>
          {HISTORY.map((h, i) => (
            <div className="card row between clickable" key={i} onClick={() => navigate(`/guest/mix/${h.recipeId}`)}>
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

    </Shell>
  );
}
