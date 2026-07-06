import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface BarDatum {
  label: string;
  value: number;
  /** Опциональная иконка/миниатюра слева от строки (только horizontal). */
  icon?: ReactNode;
}

/**
 * Столбчатая диаграмма.
 * horizontal=true — горизонтальные HTML-ряды (полные названия до 2 строк + опц. иконка).
 * horizontal=false — вертикальные SVG-бары (короткие подписи, byDow и т.п.).
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
    return (
      <div className="bar-rows">
        {data.map((d, i) => {
          const pct = Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0);
          const fillStyle: CSSProperties = { width: `${pct}%` };
          if (d.value <= 0) fillStyle.minWidth = 0;
          if (color !== "var(--accent)") fillStyle.background = color;
          return (
            <div className="bar-row" key={i}>
              {d.icon != null && <span className="bar-ico">{d.icon}</span>}
              <span className="bar-label" title={d.label}>
                {d.label}
              </span>
              <span className="bar-track">
                <span className="bar-fill" style={fillStyle} />
              </span>
              <span className="bar-val">{fmt(d.value)}</span>
            </div>
          );
        })}
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
              <text className="axis-x" x={cx} y={height - 8} textAnchor="middle">
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
