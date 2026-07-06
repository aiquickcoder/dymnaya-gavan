import { useEffect, useState } from "react";
import CallSheet from "./CallSheet";
import { KEYS, useStored, type TableContext } from "../store";

/**
 * Плавающая кнопка «Позвать» (.call-fab) над таб-баром. Видна только при наличии
 * table-контекста (гость отсканировал QR). Открывает CallSheet с 4 действиями и
 * показывает краткое подтверждение после отправки вызова.
 */
export default function CallButton() {
  const [table] = useStored<TableContext>(KEYS.table);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(""), 2600);
    return () => clearTimeout(t);
  }, [confirm]);

  if (!table) return null;

  return (
    <>
      <button className="call-fab" onClick={() => setOpen(true)} aria-label="Позвать персонал">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 4.2 1.2 6 2 6.8H4c.8-.8 2-2.6 2-6.8z" />
          <path d="M10.2 19a2 2 0 0 0 3.6 0" />
        </svg>
        <span>Позвать</span>
      </button>

      {confirm && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "calc(136px + env(safe-area-inset-bottom))",
            zIndex: 45,
            width: "min(92%, 420px)",
            pointerEvents: "none",
          }}
        >
          <div className="banner ok" style={{ margin: 0, textAlign: "center", boxShadow: "0 12px 30px rgba(0,0,0,.45)" }}>
            {confirm}
          </div>
        </div>
      )}

      <CallSheet
        open={open}
        onClose={() => setOpen(false)}
        restaurantId={table.restaurantId}
        tableId={table.tableId}
        onSent={(message) => setConfirm(message)}
      />
    </>
  );
}
