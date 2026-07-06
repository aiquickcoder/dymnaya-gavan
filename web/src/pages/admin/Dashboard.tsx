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
  IconStaff,
  IconGuests,
  IconBell,
} from "../../components/admin/icons";
import PeriodPicker, { DEFAULT_PERIOD, periodLabel, type PeriodRange } from "../../components/admin/PeriodPicker";
import Modal from "../../components/admin/Modal";
import { CALL_LABEL, CALL_STATUS_LABEL } from "../../lib/useCalls";
import { mixImageUrl } from "../../lib/mixImages";
import type { AnalyticsSummary, TableState, TableView, Zone } from "../../types";

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

/** ISO-время → «19:40» (локальное HH:MM). */
function timeLabel(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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

  const [period, setPeriod] = useState<PeriodRange>(DEFAULT_PERIOD);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [tables, setTables] = useState<TableView[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [states, setStates] = useState<TableState[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rid) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [a, t, z, s] = await Promise.all([
          api.adminAnalyticsRange(rid, period.from, period.to),
          api.adminTables(rid),
          api.adminZones(rid).catch(() => [] as Zone[]),
          api.adminTableStates(rid).catch(() => [] as TableState[]),
        ]);
        if (!alive) return;
        setAnalytics(a);
        setTables(t);
        setZones(z);
        setStates(s);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [rid, period.from, period.to]);

  if (!session) return null;

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;
  const occupied = tables
    .filter((t) => t.status === "occupied")
    .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));

  // Карточка выбранного стола: живой снимок из adminTableStates; если его нет
  // (напр. запрос состояний не удался) — синтезируем минимум из строки таблицы,
  // чтобы дровер всё равно открылся с временем/гостями/суммой.
  const detail: TableState | null = (() => {
    if (!detailId) return null;
    const s = states.find((x) => x.tableId === detailId);
    if (s) return s;
    const row = occupied.find((t) => t.id === detailId);
    if (!row) return null;
    return {
      tableId: row.id,
      label: row.label,
      zone: row.zone,
      occupied: true,
      sinceISO: row.openedAt ?? null,
      minutes: row.minutes ?? null,
      guests: row.guests ?? null,
      masterName: null,
      waiterName: null,
      mixes: [],
      calls: [],
      total: row.total ?? null,
    };
  })();

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
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="grow">
          <h1 className="page-title">Дашборд</h1>
          <p className="admin-sub">
            Ключевые показатели · {periodLabel(period)}
            {session.restaurantName ? ` · ${session.restaurantName}` : ""}
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
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
              <span className="admin-sub">{periodLabel(period)}</span>
            </div>
            <LineChart data={analytics.revenue} area height={240} formatValue={money} />
          </div>

          {/* Топ миксов + загрузка по часам */}
          <div className="panel-grid">
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Топ миксов</span>
              </div>
              <BarChart
                data={analytics.topMixes.slice(0, 6).map((t) => {
                  const src = mixImageUrl(t.name);
                  return {
                    label: t.name,
                    value: t.value,
                    icon: src ? <img className="bar-thumb" src={src} alt="" loading="lazy" /> : undefined,
                  };
                })}
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
              onRowClick={(r) => setDetailId(r.id)}
              empty="Сейчас нет открытых столов"
            />
          </div>
        </>
      ) : (
        !error && <Banner kind="info">Нет данных для отображения</Banner>
      )}

      <Modal
        open={detail !== null}
        onClose={() => setDetailId(null)}
        title={detail ? `Стол №${detail.label}` : undefined}
        variant="drawer"
      >
        {detail && <TableDetail s={detail} zoneName={zoneName} />}
      </Modal>
    </div>
  );
}

/* ---- карточка стола (дровер из «Активных столов») ---- */
function TableDetail({
  s,
  zoneName,
}: {
  s: TableState;
  zoneName: (id: string) => string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* сводка: посадка · время за столом · гости · счёт */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <DetailStat label="Сели" value={timeLabel(s.sinceISO)} />
        <DetailStat label="За столом" value={minutesLabel(s.minutes)} />
        <DetailStat label="Гостей" value={s.guests != null ? num(s.guests) : "—"} />
        <DetailStat label="Счёт" value={money(s.total ?? 0)} accent />
      </div>

      {s.zone && <div className="ts-zone">Зона: {zoneName(s.zone)}</div>}

      {/* персонал */}
      {(s.masterName || s.waiterName) && (
        <div>
          <div className="ts-label">Персонал</div>
          <div className="ts-people" style={{ marginTop: 8 }}>
            {s.masterName && (
              <span className="ts-chip master">
                <IconStaff /> Мастер <b>{s.masterName}</b>
              </span>
            )}
            {s.waiterName && (
              <span className="ts-chip waiter">
                <IconGuests /> Официант <b>{s.waiterName}</b>
              </span>
            )}
          </div>
        </div>
      )}

      {/* миксы за столом */}
      <div>
        <div className="ts-label">Курят</div>
        {s.mixes.length ? (
          <div className="ts-mixes" style={{ marginTop: 8 }}>
            {s.mixes.map((m, i) => (
              <div className="ts-mix" key={i}>
                <span className="tm-name">{m.name}</span>
                {m.master && <span className="tm-master">{m.master}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="ts-empty">Пока нет миксов</div>
        )}
      </div>

      {/* активные вызовы */}
      <div>
        <div className="ts-label">Активные вызовы</div>
        {s.calls.length ? (
          <div className="ts-calls" style={{ marginTop: 8 }}>
            {s.calls.map((c) => (
              <div className={"ts-call" + (c.status === "new" ? " new" : "")} key={c.id}>
                <div className="ts-call-ico">
                  <IconBell />
                </div>
                <div className="ts-call-body">
                  <div className="ts-call-type">{CALL_LABEL[c.type]}</div>
                  <div className="ts-call-time">{timeLabel(c.createdAt)}</div>
                </div>
                <span className={"ts-call-status " + c.status}>{CALL_STATUS_LABEL[c.status]}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="ts-empty">Нет активных вызовов</div>
        )}
      </div>
    </div>
  );
}

/** Мини-плитка «label + value» для сводки в карточке стола. */
function DetailStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <div className="ts-label">{label}</div>
      <div
        className={accent ? "ts-total" : undefined}
        style={{
          fontSize: 17,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: accent ? undefined : "var(--text)",
        }}
      >
        {value}
      </div>
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
