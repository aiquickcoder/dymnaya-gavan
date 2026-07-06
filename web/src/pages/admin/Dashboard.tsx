import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { useRequireStaff } from "../../lib/guards";
import StatCard from "../../components/admin/StatCard";
import DataTable, { type Column } from "../../components/admin/DataTable";
import LineChart from "../../components/admin/charts/LineChart";
import BarChart from "../../components/admin/charts/BarChart";
import Heatmap from "../../components/admin/charts/Heatmap";
import {
  IconRuble,
  IconOrders,
  IconCheck,
  IconGuest,
  IconOccupancy,
  IconStar,
} from "../../components/admin/icons";
import type { AnalyticsSummary, TableView, Zone } from "../../types";

const DAYS = 7;

/** «385 488 ₽» — целые рубли с разделителями разрядов. */
function money(n: number): string {
  return Math.round(n || 0).toLocaleString("ru-RU") + " ₽";
}

/** «12 400» — целое число с разделителями разрядов (без валюты). */
function num(n: number): string {
  return Math.round(n || 0).toLocaleString("ru-RU");
}

/** Обёртка KPI-иконки для StatCard icon-пропа (.ki — золотой бейдж). */
function Ki({ children }: { children: ReactNode }) {
  return <span className="ki">{children}</span>;
}

/** Минуты → «1 ч 20 м» / «45 м». */
function minutesLabel(m?: number | null): string {
  const v = Math.max(0, Math.round(m ?? 0));
  if (v >= 60) {
    const h = Math.floor(v / 60);
    const r = v % 60;
    return r ? `${h} ч ${r} м` : `${h} ч`;
  }
  return `${v} м`;
}

export default function Dashboard() {
  const session = useRequireStaff();
  const rid = session?.restaurantId;

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [tables, setTables] = useState<TableView[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rid) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [a, t, z] = await Promise.all([
          api.adminAnalytics(rid, DAYS),
          api.adminTables(rid),
          api.adminZones(rid).catch(() => [] as Zone[]),
        ]);
        if (!alive) return;
        setAnalytics(a);
        setTables(t);
        setZones(z);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [rid]);

  if (!session) return null;

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;
  const occupied = tables
    .filter((t) => t.status === "occupied")
    .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));

  const tableColumns: Column<TableView>[] = [
    {
      key: "label",
      title: "Стол",
      render: (r) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className="dot occupied" aria-hidden="true" />
          <strong>№{r.label}</strong>
        </span>
      ),
    },
    { key: "zone", title: "Зона", render: (r) => zoneName(r.zone) },
    { key: "guests", title: "Гостей", align: "right", sortable: true, render: (r) => r.guests ?? "—" },
    {
      key: "minutes",
      title: "Время",
      align: "right",
      sortable: true,
      render: (r) => minutesLabel(r.minutes),
    },
    {
      key: "total",
      title: "Сумма",
      align: "right",
      sortable: true,
      render: (r) => money(r.total ?? 0),
    },
  ];

  const k = analytics?.kpis;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Дашборд</h1>
        <p className="admin-sub">
          Ключевые показатели за последние {DAYS} дней
          {session.restaurantName ? ` · ${session.restaurantName}` : ""}
        </p>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <DashboardSkeleton />
      ) : k && analytics ? (
        <>
          {/* KPI-ряд */}
          <div className="kpi-grid">
            <StatCard label="Выручка" value={money(k.revenue)} delta={k.revenueDelta} icon={<Ki><IconRuble /></Ki>} />
            <StatCard label="Заказы" value={num(k.orders)} delta={k.ordersDelta} icon={<Ki><IconOrders /></Ki>} />
            <StatCard label="Средний чек" value={money(k.avgCheck)} icon={<Ki><IconCheck /></Ki>} />
            <StatCard label="Гости" value={num(k.guests)} icon={<Ki><IconGuest /></Ki>} />
            <StatCard label="Загрузка" value={k.occupancy} icon={<Ki><IconOccupancy /></Ki>} hint="занятость столов" />
            <StatCard label="Рейтинг" value={k.avgRating.toFixed(1)} icon={<Ki><IconStar /></Ki>} hint="средний ★" />
          </div>

          {/* Выручка */}
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="ph">
              <span className="pt">Выручка</span>
              <span className="admin-sub">за {DAYS} дней</span>
            </div>
            <LineChart data={analytics.revenue} area height={240} />
          </div>

          {/* Топ миксов + загрузка по часам */}
          <div className="panel-grid">
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Топ миксов</span>
              </div>
              <BarChart
                data={analytics.topMixes.slice(0, 6).map((t) => ({ label: t.name, value: t.value }))}
                horizontal
              />
            </div>

            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Загрузка по часам</span>
              </div>
              <Heatmap
                data={[analytics.hourLoad.map((h) => h.value)]}
                xLabels={analytics.hourLoad.map((h) => (h.hour % 3 === 0 ? String(h.hour) : ""))}
              />
            </div>
          </div>

          {/* Активные столы */}
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="ph">
              <span className="pt">Активные столы</span>
              <span className="admin-sub">
                {occupied.length} из {tables.length}
              </span>
            </div>
            <DataTable
              columns={tableColumns}
              rows={occupied}
              rowKey={(r) => r.id}
              empty="Сейчас нет открытых столов"
            />
          </div>
        </>
      ) : (
        !error && <Banner kind="info">Нет данных для отображения</Banner>
      )}
    </div>
  );
}

/* ---- skeleton (shimmer-заглушки на время загрузки) ---- */
function DashboardSkeleton() {
  return (
    <>
      <div className="kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 98 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 288, marginTop: 16 }} />
      <div className="panel-grid" style={{ marginTop: 16 }}>
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
      <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
    </>
  );
}
