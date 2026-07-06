import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { useRequireStaff } from "../../lib/guards";
import StatCard from "../../components/admin/StatCard";
import LineChart from "../../components/admin/charts/LineChart";
import BarChart from "../../components/admin/charts/BarChart";
import DonutChart from "../../components/admin/charts/DonutChart";
import Heatmap from "../../components/admin/charts/Heatmap";
import {
  IconRuble,
  IconOrders,
  IconCheck,
  IconGuest,
  IconOccupancy,
  IconStar,
} from "../../components/admin/icons";
import PeriodPicker, { DEFAULT_PERIOD, type PeriodRange } from "../../components/admin/PeriodPicker";
import { mixImageUrl } from "../../lib/mixImages";
import type { AnalyticsSummary } from "../../types";

/** «385 488 ₽» — целые рубли с разделителями разрядов. */
function money(n: number): string {
  return Math.round(n || 0).toLocaleString("ru-RU") + " ₽";
}

/** «12 400» — целое число с разделителями разрядов (без валюты). */
function num(n: number): string {
  return Math.round(n || 0).toLocaleString("ru-RU");
}

/** Час дня → «14:00». */
function hourLabel(h: number): string {
  return String(h).padStart(2, "0") + ":00";
}

/** ISO-дата → «12 июн». */
function dateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

/** Обёртка KPI-иконки для StatCard icon-пропа (.ki — золотой бейдж). */
function Ki({ children }: { children: ReactNode }) {
  return <span className="ki">{children}</span>;
}

/** Компактный ряд из 5 звёзд под оценку (заполненные — акцент, пустые — контур). */
function Stars({ score }: { score: number }) {
  return (
    <span className="rv-stars" aria-label={`${score} из 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={n <= score ? undefined : { color: "var(--border)" }}>
          <IconStar size={14} />
        </span>
      ))}
    </span>
  );
}

export default function Analytics() {
  const session = useRequireStaff();
  const rid = session?.restaurantId;

  const [period, setPeriod] = useState<PeriodRange>(DEFAULT_PERIOD);
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
        const a = await api.adminAnalyticsRange(rid, period.from, period.to);
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
  }, [rid, period.from, period.to]);

  if (!session) return null;

  const k = data?.kpis;
  // Пиковый час загрузки (для сводки оборачиваемости).
  const peak =
    data && data.hourLoad.length
      ? data.hourLoad.reduce((a, b) => (b.value > a.value ? b : a), data.hourLoad[0])
      : null;
  const ordersPerDay = data ? Math.round((data.kpis.orders / Math.max(data.days, 1)) * 10) / 10 : 0;
  const ratings = data?.ratings;

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
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <AnalyticsSkeleton />
      ) : k && data ? (
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

          {/* Выручка + средний чек */}
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="ph">
              <span className="pt">Выручка и средний чек</span>
              <span className="admin-sub">за {data?.days ?? 0} дн. · {money(k.revenue)}</span>
            </div>
            <LineChart data={data.revenue} area height={240} formatValue={money} />
          </div>

          <div className="analytics-grid">
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Заказы по дням недели</span>
              </div>
              <BarChart data={data.byDow} height={200} formatValue={num} />
            </div>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Заказы по дням</span>
                <span className="admin-sub">{ordersPerDay} / день</span>
              </div>
              <LineChart data={data.orders} height={200} color="var(--accent-2)" formatValue={num} />
            </div>
          </div>

          {/* Топ миксов + вкусы */}
          <div className="analytics-grid" style={{ marginTop: 16 }}>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Топ миксов</span>
                <span className="admin-sub">заказов</span>
              </div>
              <BarChart
                data={data.topMixes.slice(0, 7).map((t) => {
                  const src = mixImageUrl(t.name);
                  return {
                    label: t.name,
                    value: t.value,
                    icon: src ? <img className="bar-thumb" src={src} alt="" loading="lazy" /> : undefined,
                  };
                })}
                horizontal
                formatValue={num}
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

          {/* ================= ОЦЕНКИ И ОТЗЫВЫ ================= */}
          {ratings && (
            <>
              <div className="analytics-grid" style={{ marginTop: 16 }}>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="ph">
                    <span className="pt">Распределение оценок</span>
                    <span className="admin-sub">средний · {k.avgRating.toFixed(1)} ★</span>
                  </div>
                  <RatingDist dist={ratings.dist} />
                </div>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="ph">
                    <span className="pt">Динамика среднего рейтинга</span>
                    <span className="admin-sub">по дням</span>
                  </div>
                  <LineChart
                    data={ratings.trend}
                    height={200}
                    color="var(--accent-2)"
                    area
                    formatValue={(v) => v.toFixed(1)}
                  />
                </div>
              </div>

              <div className="analytics-grid" style={{ marginTop: 16 }}>
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="ph">
                    <span className="pt">Последние отзывы</span>
                    <span className="admin-sub">{ratings.recent.length}</span>
                  </div>
                  {ratings.recent.length ? (
                    <div className="review-list">
                      {ratings.recent.map((rv, i) => (
                        <div className="review-row" key={i}>
                          <div className="rv-head">
                            <span className="rv-who">
                              <span className="rv-author">{rv.author ?? "Гость"}</span>
                              {rv.mix && <span className="rv-mix">{rv.mix}</span>}
                            </span>
                            <Stars score={rv.score} />
                          </div>
                          {rv.review && <div className="rv-text">«{rv.review}»</div>}
                          <div className="rv-date">{dateShort(rv.date)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-sub">Пока нет отзывов за период</p>
                  )}
                </div>

                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="ph">
                    <span className="pt">Проблемные позиции</span>
                    <span className="admin-sub">низкий средний балл</span>
                  </div>
                  {ratings.problem.length ? (
                    <div className="review-list">
                      {ratings.problem.map((p, i) => (
                        <div className="review-row" key={i}>
                          <div className="rv-head">
                            <span className="rv-who">
                              <span className="rv-mix">{p.mix}</span>
                            </span>
                            <span
                              className="rv-stars"
                              style={{ color: p.avg < 4 ? "var(--danger)" : undefined }}
                            >
                              <IconStar size={14} /> {p.avg.toFixed(1)}
                            </span>
                          </div>
                          <div className="rv-text">{num(p.count)} продаж за период</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-sub">Проблемных позиций нет</p>
                  )}
                </div>
              </div>
            </>
          )}

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
              xLabels={data.hourLoad.map((h) => (h.hour % 3 === 0 ? hourLabel(h.hour) : ""))}
            />
          </div>

          {/* Мастера + клиенты */}
          <div className="analytics-grid" style={{ marginTop: 16 }}>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="ph">
                <span className="pt">Мастера · миксы</span>
              </div>
              <BarChart
                data={data.masters.map((m) => ({ label: m.name, value: m.mixes }))}
                horizontal
                formatValue={num}
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
                <StatCard label="Новые" value={num(data.clients.newC)} hint="за период" />
                <StatCard label="Вернулись" value={num(data.clients.returning)} hint="повторные" />
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

/* ---- распределение оценок 1..5 (горизонтальные бары, порядок 5 → 1) ---- */
function RatingDist({ dist }: { dist: { score: number; count: number }[] }) {
  const max = Math.max(...dist.map((d) => d.count), 1);
  return (
    <div className="rating-dist">
      {dist.map((d) => (
        <div className="rdist-row" key={d.score}>
          <span className="rd-star">
            {d.score}
            <IconStar size={13} />
          </span>
          <div className="rdist-bar">
            <div
              className="rdist-fill"
              style={{ width: `${d.count > 0 ? Math.max((d.count / max) * 100, 4) : 0}%` }}
            />
          </div>
          <span className="rd-count">{d.count.toLocaleString("ru-RU")}</span>
        </div>
      ))}
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
      <div className="analytics-grid" style={{ marginTop: 16 }}>
        <div className="skeleton" style={{ height: 240 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
      <div className="analytics-grid" style={{ marginTop: 16 }}>
        <div className="skeleton" style={{ height: 240 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    </>
  );
}
