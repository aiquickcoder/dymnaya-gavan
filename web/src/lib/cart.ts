// Global cart shared across every guest screen. Backed by localStorage and an
// external store (useSyncExternalStore) so any component — the kitchen menu, the
// floating cart button in the Shell — sees the same state and re-renders together.
import { useSyncExternalStore } from "react";
import { KEYS } from "../store";

export interface CartLine {
  name: string;
  price: number;
  qty: number;
}
export type Cart = Record<string, CartLine>;

function read(): Cart {
  try {
    const raw = localStorage.getItem(KEYS.cart);
    const obj = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    // Keep only well-formed lines — drops legacy/incompatible entries so counts
    // never become NaN after a data-shape change.
    const out: Cart = {};
    for (const [id, v] of Object.entries(obj)) {
      if (
        v &&
        typeof v === "object" &&
        typeof (v as CartLine).name === "string" &&
        typeof (v as CartLine).price === "number" &&
        typeof (v as CartLine).qty === "number" &&
        (v as CartLine).qty > 0
      ) {
        out[id] = v as CartLine;
      }
    }
    return out;
  } catch {
    return {};
  }
}

let snapshot: Cart = read();
let listeners: Array<() => void> = [];

function write(next: Cart) {
  snapshot = next;
  try {
    localStorage.setItem(KEYS.cart, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export interface CartApi {
  cart: Cart;
  lines: Array<{ id: string } & CartLine>;
  count: number;
  total: number;
  qty: (id: string) => number;
  add: (id: string, line: Omit<CartLine, "qty">) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  clear: () => void;
}

export function useCart(): CartApi {
  const cart = useSyncExternalStore(subscribe, () => snapshot);

  const setQty = (id: string, line: Omit<CartLine, "qty">, qty: number) => {
    const next = { ...snapshot };
    if (qty <= 0) delete next[id];
    else next[id] = { ...line, qty };
    write(next);
  };

  const lines = Object.entries(cart).map(([id, l]) => ({ id, ...l }));
  return {
    cart,
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    total: lines.reduce((s, l) => s + l.qty * l.price, 0),
    qty: (id) => cart[id]?.qty ?? 0,
    add: (id, line) => setQty(id, line, (cart[id]?.qty ?? 0) + 1),
    inc: (id) => {
      const cur = cart[id];
      if (cur) setQty(id, cur, cur.qty + 1);
    },
    dec: (id) => {
      const cur = cart[id];
      if (cur) setQty(id, cur, cur.qty - 1);
    },
    clear: () => write({}),
  };
}
