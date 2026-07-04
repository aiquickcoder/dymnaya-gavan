import { useLocation, useNavigate } from "react-router-dom";

const TABS = [
  { to: "/guest/home", label: "Меню", icon: HomeIcon },
  { to: "/guest/session", label: "Мой кальян", icon: FlameIcon },
  { to: "/guest/profile", label: "Профиль", icon: PersonIcon },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <nav className="bottomnav">
      {TABS.map((t) => {
        const active = pathname === t.to;
        const Icon = t.icon;
        return (
          <button
            key={t.to}
            className={"tab" + (active ? " active" : "")}
            onClick={() => navigate(t.to)}
          >
            <Icon />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}
function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3c1 3-1.5 4-1.5 6.5A2.5 2.5 0 0 0 12 12c1.5-1 2-3 1.5-4.5C16 9 17 11 17 13.5A5 5 0 0 1 7 13.5C7 10.5 10 8.5 12 3Z" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
    </svg>
  );
}
