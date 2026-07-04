import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import MixCard, { badgeClass } from "../../components/MixCard";
import MasterCard from "../../components/MasterCard";
import ActionCard, { SparkleIcon, PlusIcon, SecretIcon } from "../../components/ActionCard";
import { useRequireTable, useGuest } from "../../lib/guards";
import { VENUE, TOBACCOS } from "../../lib/mocks";
import type { MenuRecipeView, Order, ShiftMaster } from "../../types";

export default function Home() {
  const table = useRequireTable();
  const guest = useGuest();
  const navigate = useNavigate();

  const [menu, setMenu] = useState<MenuRecipeView[]>([]);
  const [masters, setMasters] = useState<ShiftMaster[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [menuList, shift, ord] = await Promise.all([
          api.menuList(table.restaurantId),
          api.shift(table.restaurantId).catch(() => [] as ShiftMaster[]),
          api
            .openTable({ restaurantId: table.restaurantId, tableId: table.tableId, userId: guest?.userId || undefined })
            .catch(() => null),
        ]);
        if (!alive) return;
        setMenu(menuList);
        setMasters(shift);
        setOrder(ord);

        const ids = [...new Set(menuList.map((m) => m.authorEmployeeId).filter(Boolean))];
        if (ids.length) {
          const emps = await api.employeesBatch(ids).catch(() => []);
          if (!alive) return;
          const map: Record<string, string> = {};
          emps.forEach((e) => (map[e.id] = e.shortName || e.firstName));
          setNames(map);
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
  }, [table, guest?.userId]);

  const secret = menu.find((m) => badgeClass(m.badge) === "secret");
  const activeMix = order?.recipes?.[0];

  function openSecret() {
    if (secret) navigate(`/guest/mix/${secret.id}`);
    else navigate("/guest/quiz");
  }

  if (!table) return null;

  return (
    <Shell nav>
      <div className="gh fade-in">
        <div>
          <div className="venue display">{VENUE.name}</div>
          <div className="sub">
            {VENUE.address} · Стол {table.tableId}
          </div>
        </div>
        {menu.length > 0 && <span className="pill accent">Новинки</span>}
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {/* masters on shift */}
      {masters.length > 0 && (
        <>
          <div className="section-title">Мастера на смене</div>
          <div className="masters">
            {masters.map((m) => (
              <MasterCard key={m.id} name={m.firstName} role={m.position} rating={m.rating} online />
            ))}
          </div>
        </>
      )}

      {/* quick actions */}
      <div className="section-title">Быстрый выбор</div>
      <div className="actions">
        <ActionCard icon={<SparkleIcon />} label="AI-микс" onClick={() => navigate("/guest/quiz")} />
        <ActionCard icon={<PlusIcon />} label="Конструктор" onClick={() => navigate("/guest/build")} />
        <ActionCard icon={<SecretIcon />} label="Секрет" onClick={openSecret} />
      </div>

      {/* active session */}
      {activeMix && (
        <div className="card clickable glow" style={{ marginTop: 16 }} onClick={() => navigate("/guest/session")}>
          <div className="muted small">Сейчас вы курите</div>
          <div className="row between" style={{ marginTop: 4 }}>
            <div className="display" style={{ fontSize: 18 }}>
              {activeMix.recipeName || "Ваш микс"}
            </div>
            <span className="pill accent">Открыть →</span>
          </div>
        </div>
      )}

      {/* menu */}
      <div className="section-title">Миксы заведения</div>
      {loading ? (
        <div className="empty">Загружаем меню…</div>
      ) : menu.length === 0 ? (
        <div className="empty">
          <div className="em-ico">○</div>
          <div>Меню пока пусто</div>
        </div>
      ) : (
        menu.map((m) => (
          <MixCard
            key={m.id}
            item={m}
            masterName={names[m.authorEmployeeId]}
            onClick={() => navigate(`/guest/mix/${m.id}`)}
          />
        ))
      )}

      {/* tobaccos in stock — TODO(api): no stock endpoint */}
      <div className="section-title">Табаки в наличии</div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {TOBACCOS.map((t) => (
          <span className="chip" key={t.brand}>
            {t.brand}
            {t.note ? <span className="muted"> · {t.note}</span> : null}
          </span>
        ))}
      </div>
    </Shell>
  );
}
