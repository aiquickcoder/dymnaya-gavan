import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import DataTable, { type Column } from "../../components/admin/DataTable";
import Modal from "../../components/admin/Modal";
import StatCard from "../../components/admin/StatCard";
import { useRequireStaff } from "../../lib/guards";
import type { GuestSummary, Visit } from "../../types";

/* ---------- helpers ---------- */

const nf = new Intl.NumberFormat("ru-RU");
const money = (v: number | null | undefined): string =>
  v == null ? "—" : `${nf.format(Math.round(v))} ₽`;

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

const guestTitle = (g: GuestSummary): string => g.name?.trim() || "Без имени";

function ScoreCell({ score }: { score?: number | null }) {
  if (score == null) return <span className="admin-sub">—</span>;
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      <b>{score.toFixed(1)}</b> <span style={{ color: "var(--accent)" }}>★</span>
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "9px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className="admin-sub">{label}</span>
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

/* ---------- page ---------- */

export default function Clients() {
  const session = useRequireStaff();
  const restaurantId = session?.restaurantId ?? "";

  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // drawer / guest card
  const [selected, setSelected] = useState<GuestSummary | null>(null);
  const [detail, setDetail] = useState<{ summary: GuestSummary; visits: Visit[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;
    setLoading(true);
    setError("");
    api
      .adminGuests(restaurantId)
      .then((rows) => {
        if (alive) setGuests(rows);
      })
      .catch((e) => {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    let alive = true;
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    api
      .adminGuest(id)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e) => {
        if (alive) setDetailError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        (g.name ?? "").toLowerCase().includes(q) ||
        g.phoneNumber.toLowerCase().includes(q) ||
        (g.favouriteMix ?? "").toLowerCase().includes(q),
    );
  }, [guests, query]);

  const columns: Column<GuestSummary>[] = [
    {
      key: "name",
      title: "Гость",
      sortable: true,
      render: (g) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600 }}>{guestTitle(g)}</span>
          <span className="admin-sub" style={{ fontSize: 12.5 }}>
            {g.phoneNumber}
          </span>
        </div>
      ),
    },
    {
      key: "visits",
      title: "Визитов",
      sortable: true,
      align: "right",
      render: (g) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{g.visits}</span>,
    },
    {
      key: "lastVisit",
      title: "Последний визит",
      sortable: true,
      align: "right",
      render: (g) => <span className={g.lastVisit ? undefined : "admin-sub"}>{fmtDate(g.lastVisit)}</span>,
    },
    {
      key: "favouriteMix",
      title: "Любимый микс",
      sortable: true,
      render: (g) =>
        g.favouriteMix ? (
          <span className="tag accent">{g.favouriteMix}</span>
        ) : (
          <span className="admin-sub">—</span>
        ),
    },
    {
      key: "avgScore",
      title: "Ср. оценка",
      sortable: true,
      align: "right",
      render: (g) => <ScoreCell score={g.avgScore} />,
    },
    {
      key: "ltv",
      title: "LTV",
      sortable: true,
      align: "right",
      render: (g) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(g.ltv)}</span>,
    },
  ];

  const visitColumns: Column<Visit>[] = [
    { key: "date", title: "Дата", sortable: true, render: (v) => fmtDate(v.date) },
    {
      key: "tableLabel",
      title: "Стол",
      render: (v) => (v.tableLabel ? <span className="tag">№ {v.tableLabel}</span> : <span className="admin-sub">—</span>),
    },
    {
      key: "mixes",
      title: "Миксы",
      render: (v) => (v.mixes.length ? v.mixes.join(", ") : <span className="admin-sub">—</span>),
    },
    { key: "master", title: "Мастер", render: (v) => v.master || <span className="admin-sub">—</span> },
    {
      key: "total",
      title: "Сумма",
      sortable: true,
      align: "right",
      render: (v) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(v.total)}</span>,
    },
    { key: "score", title: "Оценка", align: "right", render: (v) => <ScoreCell score={v.score} /> },
  ];

  const card = detail?.summary ?? selected;

  return (
    <>
      <h1 className="page-title">Гости</h1>
      <p className="admin-sub" style={{ marginBottom: 18 }}>
        База гостей заведения — визиты, любимые миксы и пожизненная ценность (LTV).
      </p>

      <div className="toolbar">
        <div className="search icon grow">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, телефону или миксу"
            aria-label="Поиск гостей"
          />
        </div>
        <div className="admin-sub">
          {loading ? "Загрузка…" : `${filtered.length} из ${guests.length}`}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} aria-hidden />
          ))}
        </div>
      ) : error ? (
        <Banner kind="error">{error}</Banner>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(g) => g.id}
          onRowClick={(g) => setSelected(g)}
          empty={query ? "Гостей не найдено" : "Гостей пока нет"}
        />
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        variant="drawer"
        title={card ? guestTitle(card) : "Гость"}
      >
        {card && (
          <div className="admin-sub" style={{ marginTop: -6, marginBottom: 16 }}>
            {card.phoneNumber}
          </div>
        )}

        {detailLoading ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="skeleton" style={{ height: 84, borderRadius: 12 }} aria-hidden />
            <div className="skeleton" style={{ height: 180, borderRadius: 12 }} aria-hidden />
          </div>
        ) : detailError ? (
          <Banner kind="error">{detailError}</Banner>
        ) : detail ? (
          <>
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
              <StatCard label="Визитов" value={detail.summary.visits} />
              <StatCard label="LTV" value={money(detail.summary.ltv)} />
              <StatCard
                label="Ср. оценка"
                value={detail.summary.avgScore != null ? `${detail.summary.avgScore.toFixed(1)} ★` : "—"}
              />
            </div>

            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="ph">
                <span className="pt">Профиль</span>
              </div>
              <div style={{ padding: "4px 4px 2px" }}>
                <InfoRow label="Телефон" value={detail.summary.phoneNumber} />
                <InfoRow
                  label="Любимый микс"
                  value={
                    detail.summary.favouriteMix ? (
                      <span className="tag accent">{detail.summary.favouriteMix}</span>
                    ) : (
                      "—"
                    )
                  }
                />
                <InfoRow label="Первый визит" value={fmtDate(detail.summary.createdAt)} />
                <InfoRow label="Последний визит" value={fmtDate(detail.summary.lastVisit)} />
              </div>
            </div>

            <div className="panel">
              <div className="ph">
                <span className="pt">История визитов</span>
                <span className="admin-sub">{detail.visits.length}</span>
              </div>
              <DataTable
                columns={visitColumns}
                rows={detail.visits}
                rowKey={(v) => v.orderId}
                empty="Визитов пока нет"
              />
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
