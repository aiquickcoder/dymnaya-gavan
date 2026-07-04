// Grey shimmer placeholder shown while menu / masters load.
// Styling (.skeleton + shimmer, .skel-card, .skel-master) lives in styles.css.
export default function SkeletonCard({ variant = "mix" }: { variant?: "mix" | "master" }) {
  return <div className={`skeleton ${variant === "master" ? "skel-master" : "skel-card"}`} aria-hidden />;
}
