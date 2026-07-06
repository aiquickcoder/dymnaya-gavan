import { useEffect, useRef, useState } from "react";
import type { TableView } from "../../types";
import { IconBell } from "./icons";

/**
 * Карта зала. Столы рисуются как `.table-node` по координатам x/y (в % холста);
 * классы — по shape + status; выбранный — `.selected`, перетаскиваемый — `.dragging`.
 *
 * Оператив-режим (config=false): клик по узлу выбирает стол (onSelect), drag выключен.
 *
 * Режим «Конфиг» (config=true): узел можно перетаскивать указателем —
 * onPointerDown на узле → слушаем pointermove на документе → пересчитываем
 * %-координаты относительно rect холста → clamp 0..100 с полями под размер узла →
 * живое (локальное) обновление позиции, а persist (onMove → api.adminMoveTable)
 * происходит один раз на pointerup. Клик, следующий за реальным перетаскиванием,
 * не выбирает стол.
 */
export default function FloorMap({
  tables,
  selectedId,
  onSelect,
  config = false,
  onMove,
  calledIds,
}: {
  tables: TableView[];
  selectedId: string | null;
  onSelect: (t: TableView) => void;
  config?: boolean;
  onMove?: (id: string, x: number, y: number) => void;
  /** id столов с активным вызовом — подсвечиваются на карте. */
  calledIds?: Set<string>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  // Размер перетаскиваемого узла (в px, без учёта transform) — для полей clamp.
  const nodeSizeRef = useRef<{ w: number; h: number }>({ w: 64, h: 64 });
  // Было ли реальное перемещение — чтобы отличить drag от клика.
  const movedRef = useRef(false);
  // Подавить клик, идущий сразу после перетаскивания.
  const suppressClickRef = useRef(false);

  // Пересчёт координат указателя → проценты холста с полями под размер узла.
  function pctFromPointer(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const marginX = (nodeSizeRef.current.w / 2 / rect.width) * 100;
    const marginY = (nodeSizeRef.current.h / 2 / rect.height) * 100;
    return {
      x: clampPct(((clientX - rect.left) / rect.width) * 100, marginX),
      y: clampPct(((clientY - rect.top) / rect.height) * 100, marginY),
    };
  }

  function clampPct(v: number, margin: number): number {
    const lo = Math.max(0, margin);
    const hi = Math.min(100, 100 - margin);
    return Math.max(lo, Math.min(hi, Math.round(v * 10) / 10));
  }

  useEffect(() => {
    if (!dragId) return;
    const id = dragId;

    function handleMove(e: PointerEvent) {
      const p = pctFromPointer(e.clientX, e.clientY);
      if (!p) return;
      movedRef.current = true;
      setDragPos(p); // живое обновление позиции (локально, без persist)
    }
    function handleUp(e: PointerEvent) {
      const p = pctFromPointer(e.clientX, e.clientY);
      if (p && movedRef.current && onMove) {
        onMove(id, p.x, p.y); // persist один раз на отпускании
        suppressClickRef.current = true; // не выбирать стол этим кликом
        // Страховка: click приходит синхронно за pointerup (и сам сбросит флаг).
        // Если click не придёт (отпустили вне узла) — снимем флаг сами, чтобы
        // не подавить следующий настоящий клик.
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      setDragId(null);
      setDragPos(null);
    }

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, onMove]);

  function startDrag(e: React.PointerEvent, t: TableView) {
    if (!config) return;
    // Только основная кнопка / касание / перо.
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    nodeSizeRef.current = { w: el.offsetWidth || 64, h: el.offsetHeight || 64 };
    movedRef.current = false;
    setDragId(t.id);
    setDragPos({ x: t.x, y: t.y });
  }

  return (
    <>
      <div ref={canvasRef} className={config ? "floor-canvas config" : "floor-canvas"}>
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
          const called = calledIds?.has(t.id) ?? false;
          const cls = [
            "table-node",
            t.shape,
            t.status,
            called ? "called" : "",
            selectedId === t.id ? "selected" : "",
            dragId === t.id ? "dragging" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={t.id}
              className={cls}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              role="button"
              tabIndex={0}
              aria-pressed={selectedId === t.id}
              aria-label={`Стол ${t.label}, ${t.status === "occupied" ? "занят" : "свободен"}, ${t.seats} мест`}
              title={`Стол ${t.label} · ${t.seats} мест · ${t.status === "occupied" ? "занят" : "свободен"}`}
              onPointerDown={config ? (e) => startDrag(e, t) : undefined}
              onClick={() => {
                // Клик, вызванный завершением перетаскивания, не выбирает стол.
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                onSelect(t);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(t);
                }
              }}
            >
              {called && (
                <span className="tn-bell" aria-label="Активный вызов">
                  <IconBell size={13} />
                </span>
              )}
              <span className="tn-num">{t.label}</span>
              <span className="tn-seats">{t.seats} мест</span>
            </div>
          );
        })}
      </div>

      <div className="map-legend" aria-hidden="true">
        <span className="lg-item">
          <span className="legend-dot free" />
          Свободен
        </span>
        <span className="lg-item">
          <span className="legend-dot occupied" />
          Занят
        </span>
        {config && (
          <span className="lg-item" style={{ color: "var(--muted)" }}>
            Перетаскивайте столы, чтобы изменить их расположение
          </span>
        )}
      </div>
    </>
  );
}
