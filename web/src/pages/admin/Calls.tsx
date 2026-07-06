// /admin/calls — «Обращения» как «Состояние столов». Карточки столов из
// adminTableStates: занят/свободен, время посадки (HH:MM) + длительность, счёт,
// мастер и официант чипами, миксы, которые курят, и лента активных вызовов
// (тип/статус) с действиями Принять → Выполнено прямо на карточке стола. Вкладки
// «Активные / Архив» (архив = adminCallsArchive — выполненные вызовы). Данные
// автообновляются каждые ~4с. Звук и всплывашка о новых вызовах — глобально
// (ToastHost в AdminLayout), здесь только актуальная картина зала.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { useRequireStaff } from "../../lib/guards";
import { CALL_LABEL, CALL_STATUS_LABEL } from "../../lib/useCalls";
import { CallIcon } from "../../components/admin/ToastHost";
import type { Call, TableState, Zone } from "../../types";

const REFRESH_MS = 4000;

/* «N мин назад» из ISO-времени. */
function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 45) return "только что";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  return `${Math.floor(hr / 24)} дн назад`;
}

/* ISO → «HH:MM» (локальное время посадки). */
function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/* Минуты → «2 ч 15 мин». */
function fmtDur(min?: number | null): string {
  if (min == null || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

type Tab = "active" | "archive";

export default function Calls() {
  const session = useRequireStaff();
  const rid = session?.restaurantId ?? null;

  const [tab, setTab] = useState<Tab>("active");
  const [states, setStates] = useState<TableState[]>([]);
  const [archive, setArchive] = useState<Call[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actErr, setActErr] = useState("");
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    if (!rid) return;
    try {
      const [st, ar] = await Promise.all([
        api.adminTableStates(rid),
        api.adminCallsArchive(rid),
      ]);
      if (!aliveRef.current) return;
      setStates(st);
      setArchive(ar);
      setError("");
    } catch (e) {
      if (aliveRef.current) setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [rid]);

  // Автообновление каждые ~4с.
  useEffect(() => {
    aliveRef.current = true;
    if (!rid) {
      setStates([]);
      setArchive([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      aliveRef.current = false;
      window.clearInterval(timer);
    };
  }, [rid, load]);

  // Зоны грузим один раз — их имена статичны, в поллинг не тянем.
  useEffect(() => {
    if (!rid) {
      setZones([]);
      return;
    }
    let alive = true;
    api
      .adminZones(rid)
      .then((z) => alive && setZones(z))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rid]);

  async function act(id: string, fn: () => Promise<void>) {
    if (busyId) return;
    setBusyId(id);
    setActErr("");
    try {
      await fn();
      await load();
    } catch (e) {
      setActErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const zoneName = (id?: string | null) =>
    (id && zones.find((z) => z.id === id)?.name) || "";

  const occupied = states.filter((s) => s.occupied).length;
  const activeCalls = states.reduce((n, s) => n + s.calls.length, 0);

  return (
    <>
      <h1 className="page-title">Обращения</h1>
      <p className="admin-sub" style={{ marginBottom: 14 }}>
        Состояние зала в реальном времени: кто за столом, что курят, кто зовёт мастера,
        просит угли или счёт. Новые вызовы подсвечены и сопровождаются звуком на любом экране CRM.
      </p>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Активные / Архив">
          <button
            type="button"
            className={tab === "active" ? "on" : ""}
            aria-pressed={tab === "active"}
            onClick={() => setTab("active")}
          >
            Активные{activeCalls > 0 ? ` · ${activeCalls}` : ""}
          </button>
          <button
            type="button"
            className={tab === "archive" ? "on" : ""}
            aria-pressed={tab === "archive"}
            onClick={() => setTab("archive")}
          >
            Архив
          </button>
        </div>
        <div className="admin-sub grow">
          {loading ? "Загрузка…" : `${occupied} занято · ${activeCalls} активн. вызовов`}
        </div>
        <div className="admin-sub" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--success)",
              boxShadow: "0 0 0 3px rgba(123, 185, 138, 0.18)",
              flexShrink: 0,
            }}
          />
          обновляется автоматически
        </div>
      </div>

      {actErr && <Banner kind="error">{actErr}</Banner>}

      {loading ? (
        <div className="tstate-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 14 }} aria-hidden />
          ))}
        </div>
      ) : error ? (
        <Banner kind="error">{error}</Banner>
      ) : tab === "active" ? (
        states.length === 0 ? (
          <EmptyPanel>Пока нет столов — добавьте их в разделе «Столы».</EmptyPanel>
        ) : (
          <div className="tstate-grid">
            {states.map((t) => (
              <TableCard
                key={t.tableId}
                state={t}
                zoneName={zoneName(t.zone)}
                busyId={busyId}
                onAck={(id) => act(id, () => api.adminAckCall(id))}
                onDone={(id) => act(id, () => api.adminDoneCall(id))}
              />
            ))}
          </div>
        )
      ) : archive.length === 0 ? (
        <EmptyPanel>Архив пуст — выполненные вызовы будут собираться здесь.</EmptyPanel>
      ) : (
        <div className="panel" style={{ margin: 0 }}>
          <div className="ts-calls">
            {archive.map((c) => (
              <div key={c.id} className="ts-call">
                <div className="ts-call-ico">
                  <CallIcon type={c.type} />
                </div>
                <div className="ts-call-body">
                  <div className="ts-call-type">{CALL_LABEL[c.type]}</div>
                  <div className="ts-call-time">
                    Стол {c.tableLabel ?? c.tableId} · {timeAgo(c.doneAt ?? c.createdAt)}
                  </div>
                </div>
                <span className="ts-call-status done">{CALL_STATUS_LABEL.done}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- карточка стола ---------- */
function TableCard({
  state,
  zoneName,
  busyId,
  onAck,
  onDone,
}: {
  state: TableState;
  zoneName: string;
  busyId: string | null;
  onAck: (id: string) => void;
  onDone: (id: string) => void;
}) {
  const { occupied } = state;
  return (
    <div className={"tstate-card " + (occupied ? "occupied" : "free")}>
      <div className="ts-head">
        <div>
          <div className="ts-num">Стол {state.label}</div>
          {zoneName && <div className="ts-zone">{zoneName}</div>}
        </div>
        {occupied && state.sinceISO && <div className="ts-time">с {fmtTime(state.sinceISO)}</div>}
      </div>

      {occupied ? (
        <>
          {(fmtDur(state.minutes) || state.total != null || state.guests != null) && (
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span className="ts-since">
                {[fmtDur(state.minutes), state.guests != null ? `${state.guests} гост.` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {state.total != null && <span className="ts-total">{state.total.toLocaleString("ru-RU")} ₽</span>}
            </div>
          )}

          {(state.masterName || state.waiterName) && (
            <div className="ts-people">
              {state.masterName && (
                <span className="ts-chip master">
                  <CallIcon type="master" />
                  Мастер <b>{state.masterName}</b>
                </span>
              )}
              {state.waiterName && (
                <span className="ts-chip waiter">
                  <CallIcon type="waiter" />
                  Официант <b>{state.waiterName}</b>
                </span>
              )}
            </div>
          )}

          {state.mixes.length > 0 && (
            <div>
              <div className="ts-label">Курят</div>
              <div className="ts-mixes">
                {state.mixes.map((m, i) => (
                  <div key={i} className="ts-mix">
                    <span className="tm-name">{m.name}</span>
                    {m.master && <span className="tm-master">{m.master}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="ts-empty">Свободен</div>
      )}

      {state.calls.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="ts-label">Вызовы</div>
          <div className="ts-calls">
            {state.calls.map((c) => (
              <CallLine
                key={c.id}
                call={c}
                busy={busyId === c.id}
                disabled={busyId !== null && busyId !== c.id}
                onAck={() => onAck(c.id)}
                onDone={() => onDone(c.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        occupied && <div className="ts-empty">Нет активных вызовов</div>
      )}
    </div>
  );
}

/* ---------- одна строка вызова в карточке стола ---------- */
function CallLine({
  call,
  busy,
  disabled,
  onAck,
  onDone,
}: {
  call: Call;
  busy: boolean;
  disabled: boolean;
  onAck: () => void;
  onDone: () => void;
}) {
  const blocked = busy || disabled;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className={"ts-call" + (call.status === "new" ? " new" : "")}>
        <div className="ts-call-ico">
          <CallIcon type={call.type} />
        </div>
        <div className="ts-call-body">
          <div className="ts-call-type">{CALL_LABEL[call.type]}</div>
          <div className="ts-call-time" title={new Date(call.createdAt).toLocaleString("ru-RU")}>
            {timeAgo(call.createdAt)}
          </div>
        </div>
        <span className={"ts-call-status " + call.status}>{CALL_STATUS_LABEL[call.status]}</span>
      </div>
      <div className="ts-actions">
        {call.status === "new" && (
          <button type="button" onClick={onAck} disabled={blocked}>
            Принять
          </button>
        )}
        <button type="button" className="primary" onClick={onDone} disabled={blocked}>
          Выполнено
        </button>
      </div>
    </div>
  );
}

/* ---------- пустое состояние ---------- */
function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="panel"
      style={{ textAlign: "center", color: "var(--muted)", padding: "44px 20px", margin: 0 }}
    >
      {children}
    </div>
  );
}
