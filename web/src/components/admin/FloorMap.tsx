import { useEffect, useRef, useState } from "react";
import type { TableView } from "../../types";

/**
 * Карта зала: рисует столы как .table-node по координатам x/y (в % холста),
 * класс — по shape + status, активный — .selected. Клик → onSelect.
 * В режиме config столы можно перетаскивать мышью: во время перетаскивания
 * позиция обновляется локально, persist (onMove) — троттлится и финализируется
 * на отпускании кнопки.
 */
export default function FloorMap({
  tables,
  selectedId,
  onSelect,
  config = false,
  onMove,
}: {
  tables: TableView[];
  selectedId: string | null;
  onSelect: (t: TableView) => void;
  config?: boolean;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const lastPersist = useRef(0);

  function clamp(v: number): number {
    return Math.max(2, Math.min(98, Math.round(v * 10) / 10));
  }

  function pctFromEvent(e: MouseEvent): { x: number; y: number } | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100),
    };
  }

  useEffect(() => {
    if (!dragId) return;
    const id = dragId;

    function handleMove(e: MouseEvent) {
      const p = pctFromEvent(e);
      if (!p) return;
      movedRef.current = true;
      setDragPos(p);
      const now = Date.now();
      if (onMove && now - lastPersist.current > 120) {
        lastPersist.current = now;
        onMove(id, p.x, p.y);
      }
    }
    function handleUp(e: MouseEvent) {
      const p = pctFromEvent(e);
      if (p && onMove && movedRef.current) onMove(id, p.x, p.y);
      setDragId(null);
      setDragPos(null);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragId, onMove]);

  function startDrag(e: React.MouseEvent, t: TableView) {
    if (!config) return;
    e.preventDefault();
    movedRef.current = false;
    lastPersist.current = 0;
    setDragId(t.id);
    setDragPos({ x: t.x, y: t.y });
  }

  return (
    <div ref={canvasRef} className="floor-canvas">
      {tables.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "var(--muted)",
            fontSize: 14,
            textAlign: "center",
            padding: 16,
          }}
        >
          В этой зоне пока нет столов
        </div>
      )}
      {tables.map((t) => {
        const pos = dragId === t.id && dragPos ? dragPos : { x: t.x, y: t.y };
        const cls = [
          "table-node",
          t.shape,
          t.status,
          selectedId === t.id ? "selected" : "",
          dragId === t.id ? "dragging" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={t.id}
            className={cls}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              cursor: config ? (dragId === t.id ? "grabbing" : "grab") : "pointer",
            }}
            role="button"
            tabIndex={0}
            aria-pressed={selectedId === t.id}
            aria-label={`Стол ${t.label}, ${t.status === "occupied" ? "занят" : "свободен"}`}
            title={`Стол ${t.label} · ${t.seats} мест`}
            onMouseDown={config ? (e) => startDrag(e, t) : undefined}
            onClick={() => {
              // Не выбирать стол сразу после реального перетаскивания.
              if (dragId === t.id && movedRef.current) return;
              onSelect(t);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(t);
              }
            }}
          >
            <span className="table-label">
              {t.label}
              <br />
              <small style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>
                {t.seats} мест
              </small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
