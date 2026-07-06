// Глобальный хост тостов о новых вызовах. Монтируется ОДИН раз в AdminLayout, поэтому
// живёт на любом /admin-экране и не перемонтируется при навигации между разделами.
// Поллит adminCalls через useCalls; на КАЖДЫЙ новый вызов проигрывает звук (playBeep)
// и показывает всплывашку сверху-справа, которая сама исчезает через ~5с. Тосты
// складываются в стек (последние сверху, не более четырёх).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRequireStaff } from "../../lib/guards";
import { useCalls, CALL_TOAST_TITLE } from "../../lib/useCalls";
import { playBeep } from "../../lib/sound";
import type { Call, CallType } from "../../types";

/* ------------------------------------------------------------ иконки типов вызова */
// Inline-SVG в стиле admin/icons (viewBox 24, stroke currentColor). Экспортируется,
// чтобы страница Calls рисовала те же глифы, что и тост — единый визуальный язык.
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const CALL_GLYPHS: Record<CallType, ReactNode> = {
  // Мастер — силуэт кальяна (чаша, шахта, колба, шланг).
  master: (
    <>
      <path d="M10 3h4M12 3v3" />
      <path d="M9.2 6h5.6l-1 3H10.2z" />
      <path d="M12 9v6" />
      <path d="M8 21a4 4 0 0 1 8 0z" />
      <path d="M12 12h4.5a2 2 0 0 1 2 2v1.5" />
    </>
  ),
  // Угли — язычок пламени.
  coals: (
    <>
      <path d="M12 3s4.5 3.6 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.8.8-3 1.7-3.9C10 8.4 12 6.5 12 3z" />
      <path d="M12 20.5a2.2 2.2 0 0 0 2.2-2.2c0-1.4-1.1-2.1-1.6-3-0.6.9-.8 1.3-1.3 1.8-.9.9-1.5 1.3-1.5 2.4A2.2 2.2 0 0 0 12 20.5z" />
    </>
  ),
  // Официант — сервировочный клош (крышка-купол).
  waiter: (
    <>
      <path d="M3.5 18h17" />
      <path d="M5 18a7 7 0 0 1 14 0" />
      <path d="M12 8.2V11" />
      <circle cx="12" cy="7.2" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Счёт — чек с зубчатым низом.
  bill: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h5" />
    </>
  ),
};

export function CallIcon({ type }: { type: CallType }) {
  return <Svg>{CALL_GLYPHS[type]}</Svg>;
}

/* ---------------------------------------------------------------------- сам хост */
interface ToastItem {
  key: number;
  call: Call;
}

const MAX_TOASTS = 4;
const AUTO_HIDE_MS = 5000;

export default function ToastHost() {
  const session = useRequireStaff();
  const rid = session?.restaurantId ?? null;

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const keyRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const handleNew = useCallback((call: Call) => {
    playBeep();
    const key = (keyRef.current += 1);
    setToasts((prev) => [...prev, { key, call }].slice(-MAX_TOASTS));
    const timer = window.setTimeout(() => {
      setToasts((cur) => cur.filter((x) => x.key !== key));
    }, AUTO_HIDE_MS);
    timersRef.current.push(timer);
  }, []);

  // Поллинг + детект новых. Колбэк стабилен (пустые deps), звук/тост не дублируются.
  useCalls(rid, handleNew);

  // Чистим висящие таймеры при размонтировании.
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  if (!rid || toasts.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite" role="status">
      {toasts.map(({ key, call }) => (
        <div key={key} className="toast enter">
          <div className="toast-ico">
            <CallIcon type={call.type} />
          </div>
          <div className="toast-body">
            <div className="toast-title">{CALL_TOAST_TITLE[call.type]}</div>
            <div className="toast-sub">Стол {call.tableLabel ?? call.tableId}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
