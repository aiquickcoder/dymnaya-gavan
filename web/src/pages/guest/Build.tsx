import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell, BackHeader } from "../../components/Shell";
import { strengthLabel } from "../../components/StrengthScale";
import { Banner } from "../../components/ui";
import { useRequireTable } from "../../lib/guards";
import { PALETTE, flavourColor } from "../../lib/flavours";
import type { Component } from "../../types";

interface Pick {
  flavour: string;
  parts: number;
}
const MAX = 4;

function toComponents(picks: Pick[]): Component[] {
  const total = picks.reduce((n, p) => n + p.parts, 0) || 1;
  const raw = picks.map((p) => ({ flavour: p.flavour, pct: (p.parts / total) * 100 }));
  const floored = raw.map((r) => ({ ...r, f: Math.floor(r.pct) }));
  const rem = 100 - floored.reduce((n, r) => n + r.f, 0);
  const order = [...floored].sort((a, b) => b.pct - b.f - (a.pct - a.f));
  const bonus = new Set(order.slice(0, rem).map((r) => r.flavour));
  return floored.map((r) => ({ brand: "", flavour: r.flavour, percent: r.f + (bonus.has(r.flavour) ? 1 : 0) }));
}

export default function Build() {
  const table = useRequireTable();
  const navigate = useNavigate();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [strength, setStrength] = useState(5);
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);

  function toggle(flavour: string) {
    setPicks((p) => {
      if (p.some((x) => x.flavour === flavour)) return p.filter((x) => x.flavour !== flavour);
      if (p.length >= MAX) return p;
      return [...p, { flavour, parts: 1 }];
    });
  }
  function bump(flavour: string, d: number) {
    setPicks((p) => p.map((x) => (x.flavour === flavour ? { ...x, parts: Math.max(1, x.parts + d) } : x)));
  }
  const equalize = () => setPicks((p) => p.map((x) => ({ ...x, parts: 1 })));

  const components = toComponents(picks);
  const full = picks.length >= MAX;

  if (!table) return null;

  if (done) {
    return (
      <Shell>
        <BackHeader title="Готово" to="/guest/build" />
        <div className="fade-in center">
          <div className="display" style={{ fontSize: 40, color: "var(--accent-2)" }}>✓</div>
          <h1 className="display" style={{ fontSize: 24 }}>{name.trim() || "Ваш микс"}</h1>
          <p className="muted small">Покажите этот экран мастеру — он соберёт ваш кальян.</p>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <div className="stackbar" style={{ marginBottom: 14 }}>
            {components.map((c) => (
              <span key={c.flavour} style={{ width: `${c.percent}%`, background: flavourColor(c.flavour) }} />
            ))}
          </div>
          {components.map((c) => (
            <div className="row between" key={c.flavour} style={{ padding: "6px 0" }}>
              <span className="pick-name">
                <span className="dot" style={{ background: flavourColor(c.flavour) }} />
                {c.flavour}
              </span>
              <span className="pick-pct">{c.percent}%</span>
            </div>
          ))}
          <div className="strength-label" style={{ marginTop: 10 }}>
            Крепость {strength}/10 · {strengthLabel(strength)}
          </div>
        </div>
        {/* TODO(api): нет флоу «заявка гостя мастеру» — пока это экран для показа. */}
        <button className="primary block lg" onClick={() => navigate("/guest/home")}>В меню</button>
      </Shell>
    );
  }

  return (
    <Shell>
      <BackHeader title="Конструктор" to="/guest/home" />
      <div className="fade-in">
        <h1 className="display" style={{ fontSize: 24, marginBottom: 2 }}>Соберите свой кальян</h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          Выбрано {picks.length}/{MAX} — нажмите вкус, чтобы добавить
        </p>

        <div className="palette" style={{ marginTop: 12 }}>
          {PALETTE.slice(0, 12).map((f) => {
            const on = picks.some((p) => p.flavour === f.name);
            const disabled = !on && full;
            return (
              <div
                key={f.name}
                className={"ptile" + (on ? " on" : disabled ? " off" : "")}
                onClick={() => !disabled && toggle(f.name)}
              >
                <span className="dot" style={{ background: f.hex }} />
                {f.name}
              </div>
            );
          })}
        </div>

        {picks.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="section-title display" style={{ margin: 0 }}>Пропорции</div>
              <button className="sm" onClick={equalize}>Поровну</button>
            </div>
            <div className="stackbar" style={{ marginBottom: 8 }}>
              {components.map((c) => (
                <span key={c.flavour} style={{ width: `${c.percent}%`, background: flavourColor(c.flavour) }} />
              ))}
            </div>
            {picks.map((p) => {
              const pct = components.find((c) => c.flavour === p.flavour)?.percent ?? 0;
              return (
                <div className="pick-row" key={p.flavour}>
                  <span className="pick-name">
                    <span className="dot" style={{ background: flavourColor(p.flavour) }} />
                    {p.flavour}
                  </span>
                  <div className="stepper">
                    <button onClick={() => bump(p.flavour, -1)} aria-label="меньше">−</button>
                    <span className="val">{p.parts}</span>
                    <button onClick={() => bump(p.flavour, +1)} aria-label="больше">+</button>
                  </div>
                  <span className="pick-pct">{pct}%</span>
                  <button className="pick-x" onClick={() => toggle(p.flavour)} aria-label="убрать">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <label>Крепость: {strength}/10 · {strengthLabel(strength)}</label>
        <input type="range" min={1} max={10} value={strength} onChange={(e) => setStrength(+e.target.value)} />

        <label>Название микса</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="например, Мой вечер" />

        {picks.length === 0 && <Banner kind="info">Выберите вкусы из палитры выше — можно до {MAX}.</Banner>}

        <div className="spacer" />
        <button className="primary block lg" disabled={picks.length === 0} onClick={() => setDone(true)}>
          Готово — показать мастеру
        </button>
      </div>
    </Shell>
  );
}
