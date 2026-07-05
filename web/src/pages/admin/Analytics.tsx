import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { useRequireStaff } from "../../lib/guards";
import StatCard from "../../components/admin/StatCard";
import LineChart from "../../components/admin/charts/LineChart";
import BarChart from "../../components/admin/charts/BarChart";
import DonutChart from "../../components/admin/charts/DonutChart";
import Heatmap from "../../components/admin/charts/Heatmap";
import type { AnalyticsSummary } from "../../types";

/** Доступные периоды фильтра .seg (в днях). */
const PERIODS: { days: number; label: string }[] = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
];

/** «12 400 ₽» — целые рубли с разделителями разрядов. */
function money(n: number): string {
  return Math.round(n || 0).toLocaleString("ru-RU") + " ₽";
}

/** Час дня → «14:00». */
function hourLabel(h: number): string {
  return String(h).padStart(2, "0") + ":00";
}

export default function Analytics() {
  const session = useRequireStaff();
  const rid = session?.restaurantId;

  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rid) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const a = await api.adminAnalytics(rid, days);
        if (!alive) return;
        setData(a);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [rid, days]);

  if (!session) return null;

  const k = data?.kpis;
  // Пиковый час загрузки (для сводки оборачиваемости).
  const peak =
    data && data.hourLoad.length
      ? data.hourLoad.reduce((a, b) => (b.value > a.value ? b : a), data.hourLoad[0])
      : null;
  const ordersPerDay = data ? Math.round((data.kpis.orders / Math.max(days, 1)) * 10) / 10 : 0;

  return (
    <div className="fade-in">
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="grow">
          <h1 className="page-title">Аналитика</h1>
          <p className="admin-sub">
            Показатели за период
            {session.restaurantName ? ` · ${session.restaurantName}` : ""}
          </p>
        </div>
        <div className="seg" role="group" aria-label="Период">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={days === p.days ? "on" : ""}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <AnalyticsSkeleton />
      ) : k && data ? (
        <>
          {/* KPI-ряд */}
          <div className="kpi-grid">
            <StatCard label="Выручка" value={money(k.revenue)} delta={k.revenueDelta} />
            <StatCard label="Заказы" value={k.orders} delta={k.ordersDelta} />
            <StatCard label="Средний чек" value={money(k.avgCheck)} />
            <StatCard label="Гости" value={k.guests} />
            <StatCard label="Загрузка" value={k.occupancy} hint="занятость столов" />
            <StatCard label="Рейтинг" value={k.avgRating.toFixed(1)} hint="средний ★" />
          </div>

          {/* Выручка + продажи по дням недели */}
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="ph">
              <span className="pt">Выручка и средний чек</span>
              <span className="admin-sub">за {days} дн.</span>
            </div>
            <LineChart data={data.revenue} area height={240} />
          </div>

          <div className="panel-grid">
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Заказы по дням недели</span>
              </div>
              <BarChart data={data.byDow} height={200} />
            </div>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Заказы по дням</span>
              </div>
              <LineChart data={data.orders} height={200} color="var(--accent-2)" />
            </div>
          </div>

          {/* Топ миксов + вкусы */}
          <div className="panel-grid" style={{ marginTop: 16 }}>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Топ миксов</span>
              </div>
              <BarChart
                data={data.topMixes.slice(0, 7).map((t) => ({ label: t.name, value: t.value }))}
                horizontal
              />
            </div>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Популярные вкусы</span>
              </div>
              <DonutChart
                data={data.flavours.slice(0, 6)}
                size={176}
                centerSub="упоминаний"
              />
            </div>
          </div>

          {/* Столы / загрузка по часам */}
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="ph">
              <span className="pt">Загрузка по часам</span>
              <span className="admin-sub">
                {peak ? `пик · ${hourLabel(peak.hour)}` : ""}
              </span>
            </div>
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
              <StatCard label="Занятость" value={k.occupancy} hint="средняя за период" />
              <StatCard
                label="Пиковый час"
                value={peak ? hourLabel(peak.hour) : "—"}
                hint="макс. загрузка"
              />
              <StatCard label="Заказов в день" value={ordersPerDay} hint="в среднем" />
            </div>
            <Heatmap
              data={[data.hourLoad.map((h) => h.value)]}
              xLabels={data.hourLoad.map((h) => (h.hour % 3 === 0 ? String(h.hour) : ""))}
            />
          </div>

          {/* Мастера + клиенты */}
          <div className="panel-grid" style={{ marginTop: 16 }}>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Мастера · миксы</span>
              </div>
              <BarChart
                data={data.masters.map((m) => ({ label: m.name, value: m.mixes }))}
                horizontal
              />
              <div className="ph" style={{ marginTop: 16 }}>
                <span className="pt">Мастера · рейтинг</span>
              </div>
              <BarChart
                data={data.masters.map((m) => ({ label: m.name, value: m.rating }))}
                horizontal
                color="var(--accent-2)"
                formatValue={(v) => v.toFixed(1)}
              />
            </div>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Клиенты</span>
              </div>
              <div className="kpi-grid">
                <StatCard label="Новые" value={data.clients.newC} hint="за период" />
                <StatCard label="Вернулись" value={data.clients.returning} hint="повторные" />
                <StatCard label="Retention" value={`${Math.round(data.clients.retention)}%`} />
                <StatCard label="Средний LTV" value={money(data.clients.avgLtv)} />
              </div>
            </div>
          </div>
        </>
      ) : (
        !error && <Banner kind="info">Нет данных для отображения</Banner>
      )}
    </div>
  );
}

/* ---- skeleton (shimmer-заглушки на время загрузки) ---- */
function AnalyticsSkeleton() {
  return (
    <>
      <div className="kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 98 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 288, marginTop: 16 }} />
      <div className="panel-grid" style={{ marginTop: 16 }}>
        <div className="skeleton" style={{ height: 240 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
      <div className="panel-grid" style={{ marginTop: 16 }}>
        <div className="skeleton" style={{ height: 240 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    </>
  );
}
