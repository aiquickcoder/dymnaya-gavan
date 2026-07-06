import { ANALYTICS_ANCHOR } from "../../lib/demo";

export interface PeriodRange {
  from: string; // YYYY-MM-DD (inclusive)
  to: string; // YYYY-MM-DD (inclusive)
}

/** Shift a YYYY-MM-DD date by n days (UTC-safe). */
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Presets are anchored to the demo "today" so they always hit seeded data.
const A = ANALYTICS_ANCHOR;
export const ANALYTICS_MIN = addDays(A, -89); // earliest day with data

const PRESETS: { key: string; label: string; range: PeriodRange }[] = [
  { key: "today", label: "Сегодня", range: { from: A, to: A } },
  { key: "yday", label: "Вчера", range: { from: addDays(A, -1), to: addDays(A, -1) } },
  { key: "7", label: "7 дней", range: { from: addDays(A, -6), to: A } },
  { key: "30", label: "30 дней", range: { from: addDays(A, -29), to: A } },
  { key: "90", label: "90 дней", range: { from: addDays(A, -89), to: A } },
];

export const DEFAULT_PERIOD: PeriodRange = PRESETS[2].range; // 7 дней

const fmt = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
};

/** Human label for a range, e.g. "Сегодня" or "01.07 – 07.07". */
export function periodLabel(r: PeriodRange): string {
  const p = PRESETS.find((x) => x.range.from === r.from && x.range.to === r.to);
  if (p) return p.label;
  return r.from === r.to ? fmt(r.from) : `${fmt(r.from)} – ${fmt(r.to)}`;
}

export default function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodRange;
  onChange: (r: PeriodRange) => void;
}) {
  const active = PRESETS.find((p) => p.range.from === value.from && p.range.to === value.to)?.key ?? "";
  return (
    <div className="period-picker">
      <div className="seg" role="group" aria-label="Период">
        {PRESETS.map((p) => (
          <button key={p.key} className={active === p.key ? "on" : ""} onClick={() => onChange(p.range)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="period-range" aria-label="Произвольный период">
        <input
          type="date"
          value={value.from}
          min={ANALYTICS_MIN}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to })}
        />
        <span className="muted">–</span>
        <input
          type="date"
          value={value.to}
          min={value.from}
          max={A}
          onChange={(e) => e.target.value && onChange({ from: value.from, to: e.target.value })}
        />
      </div>
    </div>
  );
}
