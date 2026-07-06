import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell, BackHeader } from "../../components/Shell";
import { useRequireTable } from "../../lib/guards";
import { asset } from "../../lib/asset";
import type { MenuRecipeView } from "../../types";

interface FoodGroup {
  category: string;
  items: MenuRecipeView[];
}

/** Group kitchen positions by category, preserving the order they arrive in
 *  (foodMenu is pre-sorted by sortOrder, so categories stay in menu order). */
function groupByCategory(items: MenuRecipeView[]): FoodGroup[] {
  const groups: FoodGroup[] = [];
  for (const it of items) {
    const category = it.category || "Меню";
    let g = groups.find((x) => x.category === category);
    if (!g) {
      g = { category, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

/** Guest kitchen-bar menu: food & drinks grouped by category. */
export default function Kitchen() {
  const table = useRequireTable();

  const [items, setItems] = useState<MenuRecipeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await api.foodMenu(table.restaurantId);
        if (!alive) return;
        setItems(list);
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

  const groups = groupByCategory(items);

  return (
    <Shell>
      <BackHeader title="Кухня-бар" to="/guest/home" />
      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <div className="empty">Загружаем…</div>
      ) : groups.length === 0 ? (
        <div className="empty">
          <div className="em-ico">○</div>
          <div>Меню кухни пока пусто</div>
        </div>
      ) : (
        <div className="fade-in">
          {groups.map((g) => (
            <Fragment key={g.category}>
              <div className="food-cat-title">{g.category}</div>
              <div className="kitchen-list">
                {g.items.map((it) => (
                  <div className="food-card" key={it.id}>
                    {it.imageSlug && (
                      <img
                        className="fc-photo"
                        src={asset(`mixes/${it.imageSlug}.jpg`)}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <div className="fc-body">
                      <div className="fc-name">{it.name}</div>
                      {it.description && <div className="fc-desc">{it.description}</div>}
                    </div>
                    <div className="fc-price">{Math.round(it.price)} ₽</div>
                  </div>
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </Shell>
  );
}
