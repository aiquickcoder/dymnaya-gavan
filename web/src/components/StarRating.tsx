export default function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
}) {
  const readonly = !onChange;
  return (
    <div className={`stars ${size === "sm" ? "sm" : ""} ${readonly ? "readonly" : ""}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={"star" + (n <= value ? " on" : "")}
          onClick={readonly ? undefined : () => onChange!(n)}
          role={readonly ? undefined : "button"}
          aria-label={readonly ? undefined : `${n}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}
