import { useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface LineDatum {
  label: string;
  value: number;
}

/**
 * Линейный график (inline SVG, адаптив). area=true — заливка под линией.
 * Hover: ближайшая точка подсвечивается, всплывает плашка .chart-tip (label + value).
 */
export default function LineChart({
  data,
  height = 200,
  area = false,
  color = "var(--accent)",
  formatValue,
}: {
  data: LineDatum[];
  height?: number;
  area?: boolean;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const gid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ i: number; left: number; top: number } | null>(null);

  if (!data || data.length === 0) return <div className="chart chart-empty">нет данных</div>;

  const W = 480;
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;
  const innerH = height - padTop - padBottom;
  const innerW = W - padX * 2;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const n = data.length;
  const x = (i: number) => (n === 1 ? W / 2 : padX + (i / (n - 1)) * innerW);
  const y = (v: number) => padTop + innerH - ((v - min) / span) * innerH;

  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`);
  const linePath = "M" + pts.join(" L");
  const areaPath = `M${x(0).toFixed(1)},${(padTop + innerH).toFixed(1)} L${pts.join(" L")} L${x(n - 1).toFixed(1)},${(
    padTop + innerH
  ).toFixed(1)} Z`;

  // разреженные подписи оси X: 3–5 равномерных меток без наезда
  const maxTicks = Math.min(n, 5);
  const tickSet = new Set<number>();
  if (n === 1) tickSet.add(0);
  else for (let t = 0; t < maxTicks; t++) tickSet.add(Math.round((t / (maxTicks - 1)) * (n - 1)));
  const ticks = [...tickSet].sort((a, b) => a - b);

  const fmt = formatValue ?? ((v: number) => v.toLocaleString("ru-RU"));

  function handleMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const scale = rect.width / W; // равномерный (viewBox meet + height:auto)
    const svgX = (e.clientX - rect.left) / scale;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - svgX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const half = Math.min(46, rect.width / 2);
    const left = Math.min(Math.max(x(best) * scale, half), rect.width - half);
    const top = y(data[best].value) * scale;
    setTip({ i: best, left, top });
  }

  return (
    <div
      className="chart-wrap"
      ref={wrapRef}
      onPointerMove={handleMove}
      onPointerLeave={() => setTip(null)}
    >
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="xMidYMid meet" role="img">
          <defs>
            <linearGradient id={`la-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.28 }} />
              <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <line x1={padX} y1={padTop + innerH} x2={W - padX} y2={padTop + innerH} stroke="var(--border)" strokeWidth="1" />
          {area && <path d={areaPath} fill={`url(#la-${gid})`} />}
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {n <= 24 &&
            data.map((d, i) => (
              <circle key={i} cx={x(i)} cy={y(d.value)} r={n > 14 ? 2 : 2.8} fill="var(--surface)" stroke={color} strokeWidth="1.6" />
            ))}
          {ticks.map((i) => (
            <text
              key={i}
              className="axis-x"
              x={x(i)}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            >
              {data[i].label}
            </text>
          ))}
          {tip && (
            <>
              <line
                x1={x(tip.i)}
                y1={padTop}
                x2={x(tip.i)}
                y2={padTop + innerH}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={x(tip.i)} cy={y(data[tip.i].value)} r={4.5} fill={color} stroke="var(--surface)" strokeWidth="1.6" />
            </>
          )}
        </svg>
      </div>
      {tip && (
        <div className="chart-tip" style={{ left: tip.left, top: tip.top }}>
          <span className="ct-label">{data[tip.i].label}</span>
          <span className="ct-val">{fmt(data[tip.i].value)}</span>
        </div>
      )}
    </div>
  );
}
