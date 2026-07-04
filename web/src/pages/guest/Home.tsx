import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import MixCard, { badgeClass } from "../../components/MixCard";
import MasterCard from "../../components/MasterCard";
import ActionCard, { SparkleIcon, PlusIcon, SecretIcon } from "../../components/ActionCard";
import EditorialSection from "../../components/EditorialSection";
import SkeletonCard from "../../components/SkeletonCard";
import MenuFilters, { DEFAULT_FILTERS, applyFilters, type MenuFilterState } from "../../components/MenuFilters";
import { useRequireTable, useGuest } from "../../lib/guards";
import { VENUE, TOBACCOS } from "../../lib/mocks";
import type { MenuRecipeView, Order, ShiftMaster } from "../../types";

/** Keep only the last 4 digits of a phone number for a subtle "welcome back". */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `··· ${digits.slice(-4)}` : "";
}

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
  const [filters, setFilters] = useState<MenuFilterState>(DEFAULT_FILTERS);
  const [favHint, setFavHint] = useState(false);

  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const userId = guest?.userId;
        const [menuList, shift, ord] = await Promise.all([
          api.menuList(table.restaurantId),
          api.shift(table.restaurantId).catch(() => [] as ShiftMaster[]),
          // Only anonymous guests skip the session lookup; keep it non-blocking.
          userId
            ? api.openTable({ restaurantId: table.restaurantId, tableId: table.tableId, userId }).catch(() => null)
            : Promise.resolve<Order | null>(null),
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

  // Feature the first Limited mix as a collab and the first Star mix as a promo;
  // everything else falls into the filterable "Миксы заведения" list.
  const collab = menu.find((m) => badgeClass(m.badge) === "limited");
  const promo = menu.find((m) => badgeClass(m.badge) === "star");
  const rest = menu.filter((m) => {
    const c = badgeClass(m.badge);
    return c !== "limited" && c !== "star";
  });
  const filtered = applyFilters(rest, filters);

  const recognised = !!guest && !guest.anon;
  const masked = guest && !guest.anon ? maskPhone(guest.phoneNumber) : "";

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
        {recognised && (
          <div style={{ textAlign: "right" }}>
            <span className="pill accent">С возвращением</span>
            {masked && (
              <div className="muted small" style={{ marginTop: 4 }}>
                {masked}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {/* masters on shift */}
      {loading ? (
        <>
          <div className="section-title">Мастера на смене</div>
          <div className="masters" role="group" aria-label="Мастера на смене">
            <SkeletonCard variant="master" />
            <SkeletonCard variant="master" />
            <SkeletonCard variant="master" />
          </div>
        </>
      ) : masters.length > 0 ? (
        <>
          <div className="section-title">Мастера на смене</div>
          <div className="masters" role="group" aria-label="Мастера на смене">
            {masters.map((m) => (
              <MasterCard
                key={m.id}
                name={m.firstName}
                role={m.position}
                rating={m.rating}
                online
                onClick={() =>
                  navigate(
                    `/guest/master/${m.id}?name=${encodeURIComponent(m.firstName)}&role=${encodeURIComponent(m.position ?? "")}`,
                  )
                }
              />
            ))}
          </div>
        </>
      ) : null}

      {/* quick actions */}
      <div className="section-title">Быстрый выбор</div>
      <div className="actions" role="group" aria-label="Быстрый выбор">
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

      {/* editorial features */}
      {!loading && collab && (
        <EditorialSection
          title="Коллаборация месяца"
          item={collab}
          masterName={names[collab.authorEmployeeId]}
          onOpen={() => navigate(`/guest/mix/${collab.id}`)}
        />
      )}
      {!loading && promo && (
        <EditorialSection
          title="Промо"
          item={promo}
          masterName={names[promo.authorEmployeeId]}
          onOpen={() => navigate(`/guest/mix/${promo.id}`)}
        />
      )}

      {/* menu */}
      <div className="section-title">Миксы заведения</div>
      {favHint && <Banner kind="info">Избранное доступно после заказа в вашей сессии</Banner>}
      {loading ? (
        <>
          <SkeletonCard variant="mix" />
          <SkeletonCard variant="mix" />
          <SkeletonCard variant="mix" />
        </>
      ) : menu.length === 0 ? (
        <div className="empty">
          <div className="em-ico">○</div>
          <div>Меню пока пусто</div>
        </div>
      ) : (
        <>
          <MenuFilters value={filters} onChange={setFilters} count={filtered.length} />
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="em-ico">○</div>
              <div>Ничего не найдено</div>
            </div>
          ) : (
            filtered.map((m) => (
              <MixCard
                key={m.id}
                item={m}
                masterName={names[m.authorEmployeeId]}
                onClick={() => navigate(`/guest/mix/${m.id}`)}
                onOrder={() => navigate(`/guest/mix/${m.id}`)}
                onFav={() => setFavHint(true)}
              />
            ))
          )}
        </>
      )}

      {/* tobaccos in stock — TODO(api): no stock endpoint */}
      <div className="section-title">Табаки в наличии</div>
      <div className="chips" role="list" aria-label="Табаки в наличии" style={{ marginBottom: 12 }}>
        {TOBACCOS.map((t) => (
          <span className="chip" role="listitem" key={t.brand}>
            {t.brand}
            {t.note ? <span className="muted"> · {t.note}</span> : null}
          </span>
        ))}
      </div>
    </Shell>
  );
}
