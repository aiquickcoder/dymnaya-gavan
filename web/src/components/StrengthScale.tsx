export function strengthLabel(v: number): string {
  if (v <= 2) return "Лёгкий";
  if (v <= 4) return "Мягкий";
  if (v <= 6) return "Средний";
  if (v <= 8) return "Крепкий";
  return "Очень крепкий";
}

export default function StrengthScale({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const v = Math.max(0, Math.min(10, value));
  return (
    <div>
      <div className="strength">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={"cell" + (i < v ? " on" : "")} />
        ))}
      </div>
      {showLabel && (
        <div className="strength-label">
          Крепость {v}/10 · {strengthLabel(v)}
        </div>
      )}
    </div>
  );
}
