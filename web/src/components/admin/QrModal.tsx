import { useMemo, useState } from "react";
import Modal from "./Modal";
import { asset } from "../../lib/asset";
import type { TableView } from "../../types";

/**
 * Модалка с гостевым deep-link стола: BASE + guest?r=<rid>&t=<label>.
 * Крупная ссылка + копирование + ДЕКОРАТИВНЫЙ QR-грид (реального энкодера нет —
 * помечено как демо). Скан не гарантируется, ссылку нужно копировать вручную.
 */
const N = 25; // размер декоративной матрицы

function buildMatrix(seed: string): boolean[][] {
  // Детерминированный псевдо-QR: хэш seed → тёмные/светлые ячейки + finder-паттерны.
  let h = 2166136261 >>> 0;
  const grid: boolean[][] = [];
  for (let r = 0; r < N; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < N; c++) {
      const finder = finderCell(r, c);
      if (finder !== null) {
        row.push(finder);
        continue;
      }
      const code = seed.charCodeAt((r * N + c) % Math.max(1, seed.length)) || 1;
      h ^= r * 131 + c * 17 + code;
      h = Math.imul(h, 16777619) >>> 0;
      row.push((h & 7) < 3);
    }
    grid.push(row);
  }
  return grid;
}

// Возвращает значение ячейки для трёх угловых finder-паттернов (и их отступа),
// либо null, если ячейка относится к области данных.
function finderCell(r: number, c: number): boolean | null {
  const boxes: [number, number][] = [
    [0, 0],
    [0, N - 7],
    [N - 7, 0],
  ];
  for (const [br, bc] of boxes) {
    if (r >= br && r < br + 7 && c >= bc && c < bc + 7) {
      const rr = r - br;
      const cc = c - bc;
      const ring = rr === 0 || rr === 6 || cc === 0 || cc === 6;
      const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
      return ring || core;
    }
    // однослойная «тихая зона» вокруг finder — светлая
    if (r >= br - 1 && r <= br + 7 && c >= bc - 1 && c <= bc + 7) return false;
  }
  return null;
}

export default function QrModal({
  open,
  onClose,
  restaurantId,
  table,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  table: TableView | null;
}) {
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    if (!table) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${asset("guest")}?r=${encodeURIComponent(restaurantId)}&t=${encodeURIComponent(table.label)}`;
  }, [restaurantId, table]);

  const matrix = useMemo(() => buildMatrix(link || "demo"), [link]);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement("textarea");
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard недоступен — ссылку можно выделить и скопировать вручную */
    }
  }

  return (
    <Modal
      open={open && !!table}
      onClose={onClose}
      title={table ? `QR стола ${table.label}` : "QR стола"}
      footer={
        <>
          <button type="button" className="ghost" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="primary" onClick={copy}>
            {copied ? "Скопировано ✓" : "Копировать ссылку"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${N}, 1fr)`,
            gap: 0,
            width: 220,
            height: 220,
            padding: 12,
            background: "#f4f1ea",
            borderRadius: 14,
            border: "1px solid var(--border)",
            boxShadow: "var(--glow)",
          }}
        >
          {matrix.flatMap((row, r) =>
            row.map((on, c) => (
              <span
                key={`${r}-${c}`}
                style={{ background: on ? "#141210" : "transparent", width: "100%", height: "100%" }}
              />
            )),
          )}
        </div>

        <span className="tag">Демо-QR · не сканируется</span>

        <div style={{ width: "100%", textAlign: "center" }}>
          <div className="admin-sub" style={{ marginBottom: 6 }}>
            Гостевая ссылка стола
          </div>
          <div
            style={{
              width: "100%",
              wordBreak: "break-all",
              fontSize: 13.5,
              lineHeight: 1.5,
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {link}
          </div>
        </div>
      </div>
    </Modal>
  );
}
