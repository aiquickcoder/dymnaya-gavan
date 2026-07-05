export interface HeatPoint {
  x: number;
  y: number;
  value: number;
}

type HeatData = HeatPoint[] | number[][];

/**
 * Тепловая карта на CSS-grid (.heat / .heat-cell). Принимает либо матрицу
 * number[][], либо разреженные точки {x,y,value}. Интенсивность цвета —
 * от var(--surface-2) к var(--accent). Пустые данные — не падает.
 */
export default function Heatmap({
  data,
  xLabels,
  yLabels,
}: {
  data: HeatData;
  xLabels?: string[];
  yLabels?: string[];
}) {
  const grid = toGrid(data);
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

  if (rows === 0 || cols === 0) return <div className="chart chart-empty">нет данных</div>;

  let max = 0;
  for (const r of grid) for (const v of r) if (v > max) max = v;
  max = max || 1;

  return (
    <div className="chart">
      <div style={{ display: "grid", gridTemplateColumns: yLabels ? "auto 1fr" : "1fr", gap: 6, alignItems: "center" }}>
        {rows > 1 &&
          yLabels?.map((yl, r) => (
            <span key={`yl-${r}`} style={{ gridColumn: 1, gridRow: r + 1, fontSize: 11, color: "var(--muted)", textAlign: "right", paddingRight: 6 }}>
              {yl}
            </span>
          ))}
        <div
          className="heat"
          style={{ gridColumn: yLabels ? 2 : 1, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {grid.flatMap((row, r) =>
            row.map((v, cIdx) => (
              <div
                key={`${r}-${cIdx}`}
                className="heat-cell"
                title={`${v}`}
                style={{ background: `color-mix(in srgb, var(--accent) ${Math.round((v / max) * 100)}%, var(--surface-2))` }}
              />
            )),
          )}
        </div>
      </div>
      {xLabels && xLabels.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${xLabels.length}, minmax(0, 1fr))`,
            gap: 3,
            marginTop: 6,
            marginLeft: yLabels ? "auto" : 0,
          }}
        >
          {xLabels.map((xl, i) => (
            <span key={i} style={{ fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
              {xl}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function toGrid(data: HeatData): number[][] {
  if (!Array.isArray(data) || data.length === 0) return [];
  if (Array.isArray(data[0])) {
    return (data as number[][]).map((row) => row.slice());
  }
  const pts = data as HeatPoint[];
  let maxX = 0;
  let maxY = 0;
  for (const p of pts) {
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const grid: number[][] = Array.from({ length: maxY + 1 }, () => new Array<number>(maxX + 1).fill(0));
  for (const p of pts) grid[p.y][p.x] = p.value;
  return grid;
}
