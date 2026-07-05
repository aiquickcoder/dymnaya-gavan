import { useId } from "react";

/**
 * Мини-график тренда (inline SVG, без осей и подписей). Адаптив width:100%.
 */
export default function Sparkline({
  data,
  height = 40,
  color = "var(--accent-2)",
  area = true,
}: {
  data: number[];
  height?: number;
  color?: string;
  area?: boolean;
}) {
  const gid = useId().replace(/:/g, "");
  if (!data || data.length === 0) return <div className="chart chart-empty" style={{ minHeight: height }} />;

  const W = 120;
  const pad = 3;
  const innerH = height - pad * 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const n = data.length;

  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => pad + innerH - ((v - min) / span) * innerH;

  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = "M" + pts.join(" L");
  const fill = `M0,${height} L${pts.join(" L")} L${W},${height} Z`;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" style={{ width: "100%", height }}>
        <defs>
          <linearGradient id={`sp-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: color, stopOpacity: 0.3 }} />
            <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {area && <path d={fill} fill={`url(#sp-${gid})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
