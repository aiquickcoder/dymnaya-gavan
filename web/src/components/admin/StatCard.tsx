import type { ReactNode } from "react";

/**
 * KPI-плитка (.kpi). Generic — принимает готовые строки/числа.
 * delta — процент изменения (знак определяет цвет и стрелку).
 */
export default function StatCard({
  label,
  value,
  delta,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  delta?: number;
  hint?: string;
  icon?: ReactNode;
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const dir = hasDelta ? (delta! > 0 ? "up" : delta! < 0 ? "down" : "") : "";

  return (
    <div className="kpi">
      <div className="kl">
        {icon}
        <span>{label}</span>
      </div>
      <div className="kv">{value}</div>
      {hasDelta ? (
        <div className={"kd " + dir}>
          <span aria-hidden="true">{delta! > 0 ? "▲" : delta! < 0 ? "▼" : "•"}</span>
          <span>{fmtDelta(delta!)}</span>
          {hint && <span className="kh" style={{ marginLeft: 4 }}>{hint}</span>}
        </div>
      ) : (
        hint && <div className="kh">{hint}</div>
      )}
    </div>
  );
}

function fmtDelta(d: number): string {
  const sign = d > 0 ? "+" : "";
  const n = Number.isInteger(d) ? String(d) : d.toFixed(1);
  return `${sign}${n}%`;
}
