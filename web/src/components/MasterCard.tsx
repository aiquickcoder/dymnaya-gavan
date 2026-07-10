import { masterImageUrl } from "../lib/masterImages";

export default function MasterCard({
  name,
  role,
  online,
  onClick,
}: {
  name: string;
  role?: string | null;
  rating?: number;
  online?: boolean;
  onClick?: () => void;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const img = masterImageUrl(name);
  return (
    <div
      className="master-card"
      style={onClick ? { cursor: "pointer" } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
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
        </div>
      </div>
      {role && <div className="mc-role">{role}</div>}
    </div>
  );
}
