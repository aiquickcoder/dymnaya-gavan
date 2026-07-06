// /admin/calls — «Обращения». Живая лента вызовов со столов: гость нажал «Позвать»,
// вызов падает сюда с типом/иконкой/столом/временем/статусом. Персонал жмёт
// «Принять» → «Выполнено». Список автообновляется каждые ~4с (useCalls). Звук и
// всплывашка о новых вызовах работают глобально (ToastHost в AdminLayout) — здесь
// же просто актуальная лента.
import { useState } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { useRequireStaff } from "../../lib/guards";
import { useCalls, CALL_LABEL, CALL_STATUS_LABEL } from "../../lib/useCalls";
import { CallIcon } from "../../components/admin/ToastHost";
import type { Call } from "../../types";

/* «N мин назад» из ISO-времени создания. */
function timeAgo(iso: string): string {
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

export default function Calls() {
  const session = useRequireStaff();
  const rid = session?.restaurantId ?? null;

  const { calls, loading, error, refresh } = useCalls(rid);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actErr, setActErr] = useState("");

  async function act(id: string, fn: () => Promise<void>) {
    if (busyId) return;
    setBusyId(id);
    setActErr("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setActErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const active = calls.filter((c) => c.status !== "done").length;

  return (
    <>
      <h1 className="page-title">Обращения</h1>
      <p className="admin-sub" style={{ marginBottom: 14 }}>
        Гости зовут мастера или официанта, просят сменить угли или счёт прямо со стола.
        Новые вызовы подсвечены и сопровождаются звуком на любом экране CRM.
      </p>

      <div className="toolbar">
        <div className="admin-sub grow">
          {loading ? "Загрузка…" : `${active} активн. · ${calls.length} всего`}
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
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 68, borderRadius: 14 }} aria-hidden />
          ))}
        </div>
      ) : error ? (
        <Banner kind="error">{error}</Banner>
      ) : calls.length === 0 ? (
        <div
          className="panel"
          style={{ textAlign: "center", color: "var(--muted)", padding: "44px 20px", margin: 0 }}
        >
          Пока нет обращений — здесь появятся вызовы гостей со столов.
        </div>
      ) : (
        <div className="calls-list">
          {calls.map((call) => (
            <CallRow
              key={call.id}
              call={call}
              busy={busyId === call.id}
              disabled={busyId !== null && busyId !== call.id}
              onAck={() => act(call.id, () => api.adminAckCall(call.id))}
              onDone={() => act(call.id, () => api.adminDoneCall(call.id))}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- строка вызова ---------- */
function CallRow({
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
  const table = call.tableLabel ?? call.tableId;
  const blocked = busy || disabled;
  return (
    <div className={"call-row" + (call.status === "new" ? " is-new" : "")}>
      <div className="call-ico">
        <CallIcon type={call.type} />
      </div>
      <div className="call-body">
        <div className="call-type">{CALL_LABEL[call.type]}</div>
        <div className="call-table">Стол {table}</div>
      </div>
      <div className="call-time" title={new Date(call.createdAt).toLocaleString("ru-RU")}>
        {timeAgo(call.createdAt)}
      </div>
      <span className={"call-status " + call.status}>{CALL_STATUS_LABEL[call.status]}</span>
      {call.status !== "done" && (
        <div className="call-actions">
          {call.status === "new" && (
            <button type="button" onClick={onAck} disabled={blocked}>
              Принять
            </button>
          )}
          <button type="button" className="primary" onClick={onDone} disabled={blocked}>
            Выполнено
          </button>
        </div>
      )}
    </div>
  );
}
