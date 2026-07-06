import { useState } from "react";
import { api, ApiError } from "../api";
import { Banner } from "./ui";
import BottomSheet from "./BottomSheet";
import type { CallType } from "../types";

// Каждое действие: тип вызова, подпись, иконка и фраза-подтверждение для гостя.
interface Action {
  type: CallType;
  label: string;
  done: string;
  icon: JSX.Element;
}

const ACTIONS: Action[] = [
  { type: "master", label: "Позвать мастера", done: "Мастер уже идёт", icon: <MasterIcon /> },
  { type: "coals", label: "Сменить угли", done: "Сейчас поменяем угли", icon: <CoalsIcon /> },
  { type: "waiter", label: "Позвать официанта", done: "Официант уже идёт", icon: <WaiterIcon /> },
  { type: "bill", label: "Попросить счёт", done: "Готовим счёт", icon: <BillIcon /> },
];

/**
 * Лист вызова персонала (BottomSheet). Четыре крупных действия 2×2 → api.createCall.
 * По успеху: сообщает фразу-подтверждение через onSent и закрывается.
 */
export default function CallSheet({
  open,
  onClose,
  restaurantId,
  tableId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  tableId: string;
  onSent: (message: string) => void;
}) {
  const [sending, setSending] = useState<CallType | null>(null);
  const [error, setError] = useState("");

  async function call(action: Action) {
    if (sending) return;
    setSending(action.type);
    setError("");
    try {
      await api.createCall({ restaurantId, tableId, type: action.type });
      onSent(action.done);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSending(null);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="display" style={{ fontSize: 22 }}>Позвать</div>
      <p className="muted small">Стол {tableId} · нажмите нужное действие</p>

      {error && <Banner kind="error">{error}</Banner>}

      <div className="call-sheet-grid" style={{ marginTop: 12 }}>
        {ACTIONS.map((a) => (
          <button
            key={a.type}
            className="call-action"
            disabled={sending !== null}
            onClick={() => call(a)}
          >
            <span className="ca-ico">{a.icon}</span>
            <span className="ca-lbl">{sending === a.type ? "Отправляем…" : a.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/* --------------------------------------------------- инлайн-иконки (zero-dep) */

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

// Мастер — язык пламени (кальянный дым/огонь).
function MasterIcon() {
  return (
    <Svg>
      <path d="M12 3c1.6 3 4.5 4.3 4.5 8a4.5 4.5 0 0 1-9 0c0-1.8.8-3.1 1.7-4.1.3 1 .9 1.6 1.7 1.9C10.4 6.6 10.7 4.8 12 3z" />
    </Svg>
  );
}

// Угли — два тлеющих брикета с волнами жара.
function CoalsIcon() {
  return (
    <Svg>
      <rect x="4.5" y="11" width="6" height="6" rx="1.3" />
      <rect x="13" y="11" width="6" height="6" rx="1.3" />
      <path d="M7 8.5c0-1.4 1-1.9 1-3.2M12 8.5c0-1.4 1-1.9 1-3.2M16.5 8.5c0-1.4 1-1.9 1-3.2" />
    </Svg>
  );
}

// Официант — силуэт человека.
function WaiterIcon() {
  return (
    <Svg>
      <circle cx="12" cy="7" r="3.2" />
      <path d="M5.8 20a6.2 6.2 0 0 1 12.4 0" />
    </Svg>
  );
}

// Счёт — чек с зубчатым низом.
function BillIcon() {
  return (
    <Svg>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h5" />
    </Svg>
  );
}
