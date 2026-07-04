import type { ReactNode } from "react";
import type { Component } from "../types";

export function Banner({ kind, children }: { kind: "error" | "ok" | "info"; children: ReactNode }) {
  return <div className={`banner ${kind}`}>{children}</div>;
}

export function Components({ items }: { items: Component[] }) {
  return (
    <div className="components">
      {items.map((c, i) => (
        <span className="pill" key={i}>
          {c.brand} · {c.flavour} {c.percent}%
        </span>
      ))}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
