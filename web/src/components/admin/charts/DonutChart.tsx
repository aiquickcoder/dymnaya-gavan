export interface DonutDatum {
  name: string;
  value: number;
}

const PALETTE = ["var(--accent-2)", "var(--accent)", "#7bb98a", "#d9a0e0", "#f0b64e", "#8ab6d6", "var(--muted)"];

/**
 * Кольцевая диаграмма (inline SVG). Центр — .donut-center (total либо переданное).
 * Легенда снизу (.chart-legend). Пустые данные — рисуем пустое кольцо.
 */
export default function DonutChart({
  data,
  size = 168,
  thickness = 22,
  colors = PALETTE,
  centerLabel,
  centerSub,
  legend = true,
}: {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  colors?: string[];
  centerLabel?: string;
  centerSub?: string;
  legend?: boolean;
}) {
  const items = (data ?? []).filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);
  const c = size / 2;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;

  let acc = 0;

  return (
    <div className="chart">
      <div className="donut-wrap" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${c} ${c})`}>
            {total > 0 &&
              items.map((d, i) => {
                const frac = d.value / total;
                const dash = frac * C;
                const seg = (
                  <circle
                    key={i}
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke={colors[i % colors.length]}
                    strokeWidth={thickness}
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-acc}
                    strokeLinecap="butt"
                  />
                );
                acc += dash;
                return seg;
              })}
          </g>
        </svg>
        <div className="donut-center">
          <b>{centerLabel ?? total}</b>
          {centerSub && <span>{centerSub}</span>}
        </div>
      </div>
      {legend && items.length > 0 && (
        <div className="chart-legend">
          {items.map((d, i) => (
            <span className="legend-item" key={i}>
              <span className="sw" style={{ background: colors[i % colors.length] }} />
              {d.name} <b>{d.value}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
