// Поллинг ленты вызовов (adminCalls) для CRM. Каждые ~4с тянет свежий список,
// детектит НОВЫЕ вызовы по id (которых не было в прошлых снимках) и дёргает
// колбэк onNew — на нём ToastHost строит звук + всплывашку. Используется и на
// странице /admin/calls (без колбэка — просто как источник актуального списка),
// и в глобальном ToastHost (с колбэком).
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { Call, CallStatus, CallType } from "../types";

/* Человекочитаемые подписи типов/статусов — единый источник для Calls и ToastHost. */
export const CALL_LABEL: Record<CallType, string> = {
  master: "Мастер",
  coals: "Угли",
  waiter: "Официант",
  bill: "Счёт",
};

export const CALL_TOAST_TITLE: Record<CallType, string> = {
  master: "Зовут мастера",
  coals: "Просят сменить угли",
  waiter: "Зовут официанта",
  bill: "Просят счёт",
};

export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  new: "Новый",
  ack: "Принят",
  done: "Выполнен",
};

export interface UseCallsResult {
  calls: Call[];
  loading: boolean;
  error: string;
  refresh: () => void;
}

const INTERVAL_MS = 4000;

export function useCalls(
  rid: string | null,
  onNew?: (call: Call) => void,
  intervalMs: number = INTERVAL_MS,
): UseCallsResult {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Идентификаторы уже виденных вызовов (растёт монотонно) + флаг первичной
  // засидки: на самом первом снимке колбэк НЕ дёргаем, иначе бипало бы на все
  // существующие вызовы при каждом заходе в админку.
  const seenRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  // Свежий колбэк без переподписки интервала.
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    if (!rid) return;
    try {
      const rows = await api.adminCalls(rid);
      if (!aliveRef.current) return;
      setCalls(rows);
      setError("");
      const firstRun = !seededRef.current;
      for (const c of rows) {
        if (!seenRef.current.has(c.id)) {
          seenRef.current.add(c.id);
          if (!firstRun && c.status === "new") onNewRef.current?.(c);
        }
      }
      seededRef.current = true;
    } catch (e) {
      if (aliveRef.current) setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    aliveRef.current = true;
    // Смена ресторана — начинаем детект заново.
    seenRef.current = new Set();
    seededRef.current = false;
    if (!rid) {
      setCalls([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), intervalMs);
    return () => {
      aliveRef.current = false;
      window.clearInterval(timer);
    };
  }, [rid, intervalMs, load]);

  return { calls, loading, error, refresh: load };
}
