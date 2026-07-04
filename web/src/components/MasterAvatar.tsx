import { masterImageUrl } from "../lib/masterImages";

export default function MasterAvatar({
  name,
  role,
  rating,
  online,
  size = "md",
  onClick,
}: {
  name: string;
  role?: string | null;
  rating?: number;
  online?: boolean;
  size?: "md" | "lg";
  onClick?: () => void;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const img = masterImageUrl(name);
  return (
    <div className="master" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div
        className={"avatar" + (size === "lg" ? " lg" : "")}
        style={img ? { backgroundImage: `url('${img}')`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {!img && initial}
        {online && <span className="online-dot" />}
      </div>
      <div className="mname">{name}</div>
      {rating != null && rating > 0 && (
        <div className="mrole">
          <span style={{ color: "var(--accent-2)" }}>★</span> {rating.toFixed(1)}
        </div>
      )}
      {role && <div className="mrole">{role}</div>}
    </div>
  );
}
