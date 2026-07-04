import type { Component } from "../types";
import { flavourColor } from "../lib/flavours";

/**
 * Component breakdown with coloured % bars. When `masked` (secret mix not yet
 * revealed) flavours are hidden behind ???.
 */
export default function CompositionBars({
  items,
  masked = false,
}: {
  items: Component[];
  masked?: boolean;
}) {
  return (
    <div className="comp">
      {items.map((c, i) => {
        const color = flavourColor(c.flavour);
        return (
          <div className="comp-row" key={i}>
            <div className="comp-head">
              <span className="chip-dot" style={{ width: 9, height: 9, borderRadius: "50%", background: masked ? "var(--border)" : color, display: "inline-block" }} />
              <span>{masked ? "?????" : c.flavour}</span>
              {!masked && c.brand ? <span className="muted small">· {c.brand}</span> : null}
            </div>
            <span className="comp-pct">{c.percent}%</span>
            <div className="comp-track">
              <div
                className="comp-fill"
                style={{ width: `${c.percent}%`, background: masked ? "var(--surface-2)" : color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
