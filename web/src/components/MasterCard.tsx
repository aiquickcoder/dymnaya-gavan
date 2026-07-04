import { masterImageUrl } from "../lib/masterImages";

export default function MasterCard({
  name,
  role,
  rating,
  online,
}: {
  name: string;
  role?: string | null;
  rating?: number;
  online?: boolean;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const img = masterImageUrl(name);
  return (
    <div className="master-card">
      <div className="mc-top">
        <div
          className="avatar mini"
          style={img ? { backgroundImage: `url('${img}')`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!img && initial}
          {online && <span className="online-dot" />}
        </div>
        <div>
          <div className="mc-name">{name}</div>
          {rating != null && rating > 0 && (
            <div className="mc-rating">★ {rating.toFixed(1)}</div>
          )}
        </div>
      </div>
      {role && <div className="mc-role">{role}</div>}
    </div>
  );
}
