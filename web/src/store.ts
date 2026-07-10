// Persisted session state (no real auth yet — R4.1 MVP).
import { useCallback, useState } from "react";

export interface GuestSession {
  userId: string;
  phoneNumber: string;
  anon?: boolean; // "продолжить как гость" — no favourites/history
}

export interface StaffSession {
  employeeId: string;
  employeeName: string;
  restaurantId: string;
  restaurantName: string;
  code: string;
}

export interface TableContext {
  restaurantId: string;
  tableId: string;
}

// Admin CRM session (kept separate from StaffSession so the legacy staff console
// and the new /admin area don't clobber each other).
export interface AdminSession {
  restaurantId: string;
  restaurantName: string;
  employeeId: string;
  employeeName: string;
  code: string;
}

export type ThemeName = "light" | "dark";

function read<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function useStored<T>(key: string): [T | null, (v: T | null) => void] {
  const [value, setValue] = useState<T | null>(() => read<T>(key));
  const set = useCallback(
    (v: T | null) => {
      if (v === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(v));
      setValue(v);
    },
    [key],
  );
  return [value, set];
}

export const KEYS = {
  guest: "mm.guest",
  staff: "mm.staff",
  admin: "mm.admin",
  table: "mm.table",
  theme: "mm.theme",
  cart: "mm.cart",
} as const;
