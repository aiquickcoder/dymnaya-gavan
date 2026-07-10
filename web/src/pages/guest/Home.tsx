import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import { badgeClass } from "../../components/MixCard";
import MasterCard from "../../components/MasterCard";
import ActionCard, { SparkleIcon, MenuIcon, SecretIcon, CalendarIcon } from "../../components/ActionCard";
import BannerCarousel from "../../components/BannerCarousel";
import BestMixesCarousel from "../../components/BestMixesCarousel";
import SkeletonCard from "../../components/SkeletonCard";
import { useRequireTable, useGuest } from "../../lib/guards";
import { useTheme } from "../../theme";
import { flavourColor } from "../../lib/flavours";
import { asset } from "../../lib/asset";
import { VENUE, TOBACCOS } from "../../lib/mocks";
import type { HomeConfig, MenuRecipeView, Order, ShiftMaster } from "../../types";

// Fallback home layout when the config endpoint is unavailable (real backend).
const DEFAULT_BLOCKS = ["masters", "banners", "quickActions", "session", "bestMixes", "tobaccos"];

export default function Home() {
  const table = useRequireTable();
  const guest = useGuest();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();

  const [menu, setMenu] = useState<MenuRecipeView[]>([]);
  const [masters, setMasters] = useState<ShiftMaster[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [home, setHome] = useState<HomeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const userId = guest?.userId;
        const [menuList, shift, ord, cfg] = await Promise.all([
          api.menuList(table.restaurantId),
          api.shift(table.restaurantId).catch(() => [] as ShiftMaster[]),
          // Only anonymous guests skip the session lookup; keep it non-blocking.
          userId
            ? api.openTable({ restaurantId: table.restaurantId, tableId: table.tableId, userId }).catch(() => null)
            : Promise.resolve<Order | null>(null),
          api.homeConfig(table.restaurantId).catch(() => null),
        ]);
        if (!alive) return;
        setMenu(menuList);
        setMasters(shift);
        setOrder(ord);
        setHome(cfg);

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

  // Карусель на главной — «Авторские миксы». Полное кальянное меню — в разделе «Меню».
  const best = menu.filter((m) => m.category === "Авторские миксы");
  const collab = menu.find((m) => badgeClass(m.badge) === "limited") ?? best[0] ?? menu[0];

  const recognised = !!guest && !guest.anon;

  function openSecret() {
    if (secret) navigate(`/guest/mix/${secret.id}`);
    else navigate("/guest/quiz");
  }

  if (!table) return null;

  // Layout is driven by the admin home-builder config; fall back to a fixed order.
  const layout = home?.blocks ?? DEFAULT_BLOCKS.map((k) => ({ key: k, label: k, visible: true }));

  const blocks: Record<string, ReactNode> = {
    masters: loading ? (
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
              online
              onClick={() =>
                navigate(`/guest/master/${m.id}?name=${encodeURIComponent(m.firstName)}&role=${encodeURIComponent(m.position ?? "")}`)
              }
            />
          ))}
        </div>
      </>
    ) : null,

    banners: (
      <BannerCarousel
        customImage={home?.bannerImage ?? undefined}
        customTag={home?.bannerTag}
        onOpen={() => collab && navigate(`/guest/mix/${collab.id}`)}
      />
    ),

    quickActions: (
      <>
        <div className="section-title">Быстрый выбор</div>
        <div className="actions" role="group" aria-label="Быстрый выбор">
          <ActionCard icon={<SparkleIcon />} label="AI-микс" onClick={() => navigate("/guest/quiz")} />
          <ActionCard icon={<MenuIcon />} label="Меню" onClick={() => navigate("/guest/kitchen")} />
          <ActionCard icon={<CalendarIcon />} label="Бронь" onClick={() => navigate("/guest/book")} />
          <ActionCard icon={<SecretIcon />} label="Секрет" onClick={openSecret} />
        </div>
      </>
    ),

    session: activeMix ? (
      <div className="card clickable glow" style={{ marginTop: 16 }} onClick={() => navigate("/guest/session")}>
        <div className="row between">
          <div className="muted small">Сейчас вы курите</div>
          <span className="openbtn">Открыть <span className="ob-arrow">→</span></span>
        </div>
        <div className="display" style={{ fontSize: 20, marginTop: 4 }}>
          {activeMix.recipeName || "Ваш микс"}
        </div>
        <div className="muted small" style={{ marginTop: 2 }}>
          Мастер {activeMix.authorShortName} · Стол {table.tableId}
        </div>
        {activeMix.components.length > 0 && (
          <div className="comp" style={{ marginTop: 12 }}>
            {activeMix.components.map((c, i) => (
              <div className="row between" key={i}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="dot" style={{ width: 10, height: 10, borderRadius: "50%", background: flavourColor(c.flavour) }} />
                  <span style={{ fontSize: 14 }}>{c.brand} {c.flavour}</span>
                </span>
                <span className="comp-pct">{c.percent}%</span>
              </div>
            ))}
          </div>
        )}
        {activeMix.tags && activeMix.tags.length > 0 && (
          <div className="chips" style={{ marginTop: 12 }}>
            {activeMix.tags.map((t, i) => {
              const cc = flavourColor(t);
              return (
                <span className="chip" key={i} style={{ borderColor: cc + "66", background: cc + "16" }}>
                  <span className="dot" style={{ background: cc }} />
                  {t}
                </span>
              );
            })}
          </div>
        )}
      </div>
    ) : null,

    bestMixes: !loading && best.length > 0 ? (
      <>
        <div className="section-title">Авторские миксы</div>
        <BestMixesCarousel
          items={best}
          masterName={(id) => names[id] ?? ""}
          onOpen={(id) => navigate(`/guest/mix/${id}`)}
        />
      </>
    ) : null,

    tobaccos: (
      <>
        <div className="section-title">Табаки в наличии</div>
        <div className="chips" role="list" aria-label="Табаки в наличии" style={{ marginBottom: 12 }}>
          {TOBACCOS.map((t) => (
            <span className="chip" role="listitem" key={t.brand}>
              {t.brand}
              {t.note ? <span className="muted"> · {t.note}</span> : null}
            </span>
          ))}
        </div>
      </>
    ),
  };

  return (
    <Shell nav>
      <div className="gh fade-in">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={asset("brand/logo.png")}
            alt=""
            style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", background: "#fff", border: "1px solid var(--border)", flex: "none" }}
          />
          <div>
            <div className="venue display">{VENUE.name}</div>
            <div className="sub">
              {VENUE.address} · Стол {table.tableId}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          {recognised && <span className="pill accent">С возвращением</span>}
        </div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {layout
        .filter((b) => b.visible)
        .map((b) => (
          <Fragment key={b.key}>{blocks[b.key]}</Fragment>
        ))}
    </Shell>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
