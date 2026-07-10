import { useState } from "react";
import BottomSheet from "./BottomSheet";
import { Banner } from "./ui";
import { useCart } from "../lib/cart";
import { KEYS, useStored, type TableContext } from "../store";

/**
 * Floating cart button + sheet, shared across every guest screen (rendered in the
 * Shell). Visible only when the cart has items. `hasNav` lifts it above the tab bar
 * and the "Позвать" button.
 */
export default function CartButton({ hasNav }: { hasNav?: boolean }) {
  const { lines, count, total, inc, dec, clear } = useCart();
  const [table] = useStored<TableContext>(KEYS.table);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (count === 0) return null;

  return (
    <>
      <button className={"cart-bar" + (hasNav ? " with-nav" : "")} onClick={() => setOpen(true)}>
        <span className="cart-badge">{count}</span>
        <span>Корзина</span>
        <span className="cart-total">{Math.round(total)} ₽</span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="display" style={{ fontSize: 22, marginBottom: 4 }}>
          Корзина
        </div>
        <div className="muted small" style={{ marginBottom: 14 }}>
          {table ? `Стол ${table.tableId} · официант принесёт на стол` : "Официант принесёт на стол"}
        </div>

        {done && <Banner kind="ok">Заказ передан на кухню — официант принесёт на стол.</Banner>}

        <div className="cart-lines">
          {lines.map((l) => (
            <div className="cart-line" key={l.id}>
              <div className="cl-body">
                <div className="cl-name">{l.name}</div>
                <div className="muted small">{Math.round(l.price)} ₽</div>
              </div>
              <div className="stepper">
                <button onClick={() => dec(l.id)} aria-label="Убрать">−</button>
                <span className="val">{l.qty}</span>
                <button onClick={() => inc(l.id)} aria-label="Добавить">+</button>
              </div>
              <div className="cl-sum">{Math.round(l.qty * l.price)} ₽</div>
            </div>
          ))}
        </div>

        <div className="row between" style={{ marginTop: 16 }}>
          <span className="muted">Итого</span>
          <span className="price" style={{ fontSize: 22 }}>
            {Math.round(total)} ₽
          </span>
        </div>
        <button
          className="primary block lg"
          style={{ marginTop: 14 }}
          onClick={() => {
            setDone(true);
            setTimeout(() => {
              clear();
              setOpen(false);
              setDone(false);
            }, 1200);
          }}
        >
          Заказать · {Math.round(total)} ₽
        </button>
      </BottomSheet>
    </>
  );
}
