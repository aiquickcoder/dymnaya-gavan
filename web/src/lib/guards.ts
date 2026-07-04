import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { KEYS, useStored, type GuestSession, type TableContext } from "../store";

/** Ensure a table context exists (guest scanned a QR); otherwise send to check-in. */
export function useRequireTable(): TableContext | null {
  const [table] = useStored<TableContext>(KEYS.table);
  const navigate = useNavigate();
  useEffect(() => {
    if (!table) navigate("/guest", { replace: true });
  }, [table, navigate]);
  return table;
}

export function useGuest(): GuestSession | null {
  const [guest] = useStored<GuestSession>(KEYS.guest);
  return guest;
}
