import { useEffect, type ReactNode } from "react";

/**
 * Модалка (.modal, центр) или правый дровер (.modal.drawer).
 * Esc и клик по бэкдропу закрывают; тело останавливает всплытие.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "center",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "drawer";
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      data-variant={variant}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={variant === "drawer" ? "modal drawer" : "modal"}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title !== undefined && (
          <div className="mh">
            <div className="mtitle">{title}</div>
            <button type="button" className="mclose" onClick={onClose} aria-label="Закрыть">
              ✕
            </button>
          </div>
        )}
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}
