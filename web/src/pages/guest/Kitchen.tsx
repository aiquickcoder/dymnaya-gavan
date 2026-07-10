import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell, BackHeader } from "../../components/Shell";
import MixRow from "../../components/MixRow";
import { useRequireTable } from "../../lib/guards";
import { asset } from "../../lib/asset";
import { foodImageUrl } from "../../lib/foodImages";
import { useCart } from "../../lib/cart";
import type { MenuRecipeView } from "../../types";

type Tab = "kitchen" | "hookah" | "bar";

// Разделы меню. Кальяны — из menuList; Кухня и Бар — из foodMenu, разнесены по категориям.
const HOOKAH_SECTIONS = ["Стандартный кальян", "Авторские миксы", "Кальян на фрукте"];
const KITCHEN_CATS = ["Закуски", "Горячее", "Десерты"];
const BAR_CATS = ["Лимонады", "Чай и кофе", "Коктейли"];

interface Group { category: string; items: MenuRecipeView[] }

/** Собрать группы по заданному порядку категорий (пустые пропускаются). */
function grouped(items: MenuRecipeView[], order: string[]): Group[] {
  return order
    .map((category) => ({ category, items: items.filter((it) => (it.category || "") === category) }))
    .filter((g) => g.items.length > 0);
}

const photoFor = (it: MenuRecipeView): string | null =>
  foodImageUrl(it.name) ?? (it.imageSlug ? asset(`mixes/${it.imageSlug}.jpg`) : null);

/** Гостевой раздел «Меню»: свитч Кухня / Кальяны / Бар. */
export default function Kitchen() {
  const table = useRequireTable();
  const navigate = useNavigate();
  const { qty, add, inc, dec } = useCart();

  const [tab, setTab] = useState<Tab>("hookah");
  const [hookah, setHookah] = useState<MenuRecipeView[]>([]);
  const [food, setFood] = useState<MenuRecipeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [h, f] = await Promise.all([
          api.menuList(table.restaurantId),
          api.foodMenu(table.restaurantId),
        ]);
        if (!alive) return;
        setHookah(h);
        setFood(f);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [table]);

  if (!table) return null;

  const foodGroups = grouped(food, tab === "bar" ? BAR_CATS : KITCHEN_CATS);

  function renderFood(groups: Group[]) {
    if (groups.length === 0) {
      return (
        <div className="empty">
          <div className="em-ico">○</div>
          <div>Раздел пока пуст</div>
        </div>
      );
    }
    return groups.map((g) => (
      <Fragment key={g.category}>
        <div className="food-cat-title">{g.category}</div>
        <div className="kitchen-list">
          {g.items.map((it) => {
            const photo = photoFor(it);
            const n = qty(it.id);
            return (
              <div className="food-card" key={it.id}>
                {photo && <img className="fc-photo" src={photo} alt="" loading="lazy" />}
                <div className="fc-body">
                  <div className="fc-name">{it.name}</div>
                  {it.description && <div className="fc-desc">{it.description}</div>}
                  <div className="fc-foot">
                    <span className="fc-price">{Math.round(it.price)} ₽</span>
                    {n > 0 ? (
                      <div className="stepper">
                        <button onClick={() => dec(it.id)} aria-label="Убрать">−</button>
                        <span className="val">{n}</span>
                        <button onClick={() => inc(it.id)} aria-label="Добавить">+</button>
                      </div>
                    ) : (
                      <button className="fc-add" onClick={() => add(it.id, { name: it.name, price: it.price })}>
                        + В корзину
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Fragment>
    ));
  }

  return (
    <Shell>
      <BackHeader title="Меню" to="/guest/home" />
      {error && <Banner kind="error">{error}</Banner>}

      <div className="menu-switch bk-seg" role="group" aria-label="Раздел меню">
        <button className={tab === "kitchen" ? "on" : ""} onClick={() => setTab("kitchen")}>Кухня</button>
        <button className={tab === "hookah" ? "on" : ""} onClick={() => setTab("hookah")}>Кальяны</button>
        <button className={tab === "bar" ? "on" : ""} onClick={() => setTab("bar")}>Бар</button>
      </div>

      {loading ? (
        <div className="empty">Загружаем…</div>
      ) : tab === "hookah" ? (
        <div className="fade-in">
          {HOOKAH_SECTIONS.map((cat) => {
            const list = hookah.filter((m) => m.category === cat);
            if (!list.length) return null;
            return (
              <Fragment key={cat}>
                <div className="section-title" style={{ marginTop: 18 }}>{cat}</div>
                {list.map((m) => (
                  <MixRow key={m.id} item={m} onClick={() => navigate(`/guest/mix/${m.id}`)} />
                ))}
              </Fragment>
            );
          })}
        </div>
      ) : (
        <div className="fade-in">{renderFood(foodGroups)}</div>
      )}
    </Shell>
  );
}
