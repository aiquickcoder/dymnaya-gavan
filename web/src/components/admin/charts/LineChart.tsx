import { useId } from "react";

export interface LineDatum {
  label: string;
  value: number;
}

/**
 * Линейный график (inline SVG, адаптив). area=true — заливка под линией.
 */
export default function LineChart({
  data,
  height = 200,
  area = false,
  color = "var(--accent)",
}: {
  data: LineDatum[];
  height?: number;
  area?: boolean;
  color?: string;
}) {
  const gid = useId().replace(/:/g, "");
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

  // разреженные подписи по оси X: первая / середина / последняя
  const ticks = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  return (
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
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize="11"
            fill="var(--muted)"
          >
            {data[i].label}
          </text>
        ))}
      </svg>
    </div>
  );
}
