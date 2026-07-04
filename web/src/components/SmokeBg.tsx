// Ambient drifting-smoke background (pure CSS, see styles.css .smokebg).
export default function SmokeBg() {
  return (
    <div className="smokebg" aria-hidden>
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="cloud c3" />
    </div>
  );
}
