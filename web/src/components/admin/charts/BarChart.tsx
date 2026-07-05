import { useId } from "react";

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Столбчатая диаграмма (inline SVG, адаптив width:100%).
 * horizontal=true — горизонтальные бары (удобно для топов с длинными названиями).
 */
export default function BarChart({
  data,
  height = 180,
  color = "var(--accent)",
  horizontal = false,
  formatValue,
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
  horizontal?: boolean;
  formatValue?: (v: number) => string;
}) {
  const gid = useId().replace(/:/g, "");
  if (!data || data.length === 0) return <div className="chart chart-empty">нет данных</div>;

  const fmt = formatValue ?? ((v: number) => String(v));
  const max = Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    const rowH = 30;
    const gap = 8;
    const labelW = 96;
    const valW = 46;
    const H = data.length * rowH + (data.length - 1) * gap;
    const W = 360;
    const trackX = labelW;
    const trackW = W - labelW - valW;
    return (
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img">
          <defs>
            <linearGradient id={`bh-${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: "var(--accent)" }} />
              <stop offset="1" style={{ stopColor: "var(--accent-2)" }} />
            </linearGradient>
          </defs>
          {data.map((d, i) => {
            const y = i * (rowH + gap);
            const w = Math.max((d.value / max) * trackW, d.value > 0 ? 3 : 0);
            return (
              <g key={i}>
                <text x={0} y={y + rowH / 2} dominantBaseline="central" fontSize="12" fill="var(--text)">
                  {clip(d.label, 13)}
                </text>
                <rect x={trackX} y={y + 5} width={trackW} height={rowH - 10} rx="5" fill="var(--surface-2)" />
                <rect
                  x={trackX}
                  y={y + 5}
                  width={w}
                  height={rowH - 10}
                  rx="5"
                  fill={color === "var(--accent)" ? `url(#bh-${gid})` : color}
                />
                <text x={W} y={y + rowH / 2} dominantBaseline="central" textAnchor="end" fontSize="12" fill="var(--muted)">
                  {fmt(d.value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const padTop = 16;
  const padBottom = 24;
  const innerH = height - padTop - padBottom;
  const n = data.length;
  const W = Math.max(n * 44, 160);
  const slot = W / n;
  const barW = Math.min(slot * 0.56, 46);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="xMidYMid meet" role="img">
        <defs>
          <linearGradient id={`bv-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent-2)" }} />
            <stop offset="1" style={{ stopColor: "var(--accent)" }} />
          </linearGradient>
        </defs>
        <line x1="0" y1={padTop + innerH} x2={W} y2={padTop + innerH} stroke="var(--border)" strokeWidth="1" />
        {data.map((d, i) => {
          const cx = i * slot + slot / 2;
          const barH = Math.max((d.value / max) * innerH, d.value > 0 ? 2 : 0);
          const y = padTop + (innerH - barH);
          return (
            <g key={i}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={barH}
                rx="4"
                fill={color === "var(--accent)" ? `url(#bv-${gid})` : color}
              />
              <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {clip(d.label, 6)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
