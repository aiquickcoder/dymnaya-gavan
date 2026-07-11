import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export default function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  // Портал в body — чтобы шит был поверх всего (таб-бар, корзина) и не зависел
  // от трансформированных предков.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
