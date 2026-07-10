import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { Shell, BackHeader } from "../../components/Shell";
import FavCardBody from "../../components/FavCardBody";
import { useRequireTable, useGuest } from "../../lib/guards";
import type { Favourite } from "../../types";

/** Полный список избранных миксов (переход из Профиля по «Все»). */
export default function Favourites() {
  const table = useRequireTable();
  const guest = useGuest();
  const navigate = useNavigate();
  const loggedIn = !!guest && !guest.anon && !!guest.userId;

  const [favs, setFavs] = useState<Favourite[]>([]);

  useEffect(() => {
    if (!loggedIn) return;
    api.listFavourites(guest!.userId).then(setFavs).catch(() => {});
  }, [loggedIn, guest?.userId]);

  async function unfav(id: string) {
    if (!guest?.userId) return;
    setFavs((p) => p.filter((f) => f.orderRecipeId !== id));
    await api.removeFavourite(guest.userId, id).catch(() => {});
  }

  if (!table) return null;

  return (
    <Shell>
      <BackHeader title="Избранные миксы" to="/guest/profile" />
      {!loggedIn ? (
        <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
          <p className="muted" style={{ marginBottom: 16 }}>Войдите, чтобы сохранять миксы в избранное.</p>
          <button className="primary block" onClick={() => navigate("/guest/auth")}>Войти</button>
        </div>
      ) : favs.length === 0 ? (
        <div className="empty">
          <div className="em-ico">♡</div>
          <div>Пока пусто — сохраняйте миксы из меню</div>
        </div>
      ) : (
        <div className="fade-in">
          {favs.map((f) => (
            <div className="card clickable" key={f.orderRecipeId} onClick={() => navigate(`/guest/mix/${f.recipeId}`)}>
              <FavCardBody fav={f} onRemove={() => unfav(f.orderRecipeId)} />
            </div>
          ))}
          <div style={{ height: 12 }} />
        </div>
      )}
    </Shell>
  );
}
