import { NavLink } from "react-router-dom";
import { useTheme } from "../../theme";

/**
 * Навигация админской CRM. Generic — принимает только имя ресторана и
 * колбэк выхода, не зависит от admin-доменных типов.
 */
export default function Sidebar({
  restaurantName,
  onLogout,
}: {
  restaurantName?: string;
  onLogout?: () => void;
}) {
  const [theme, setTheme] = useTheme();

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <div className="abr-mark">Д</div>
        <div>
          <div className="abr-name">Дымная Гавань</div>
          <div className="abr-sub">CRM</div>
        </div>
      </div>

      <nav className="admin-nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} title={item.label}>
              <Icon />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="admin-sidebar-foot">
        <div className="seg block" role="group" aria-label="Тема">
          <button type="button" className={theme === "ember" ? "on" : ""} onClick={() => setTheme("ember")}>
            Уголь
          </button>
          <button type="button" className={theme === "smoke" ? "on" : ""} onClick={() => setTheme("smoke")}>
            Ночь
          </button>
        </div>
        {restaurantName && <div className="admin-venue">{restaurantName}</div>}
        <button type="button" className="danger" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </aside>
  );
}

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const NAV: { to: string; label: string; end?: boolean; icon: () => JSX.Element }[] = [
  { to: "/admin", label: "Сводка", end: true, icon: DashIcon },
  { to: "/admin/tables", label: "Столы", icon: TablesIcon },
  { to: "/admin/menu", label: "Меню", icon: MenuIcon },
  { to: "/admin/staff", label: "Команда", icon: StaffIcon },
  { to: "/admin/clients", label: "Гости", icon: ClientsIcon },
  { to: "/admin/analytics", label: "Аналитика", icon: AnalyticsIcon },
];

function DashIcon() {
  return (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function TablesIcon() {
  return (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="16" r="3" />
      <rect x="13" y="4" width="7" height="6" rx="1.5" />
      <rect x="4" y="14" width="7" height="6" rx="1.5" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h10" />
    </svg>
  );
}
function StaffIcon() {
  return (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.2 2.7-5 6-5s6 1.8 6 5" />
      <path d="M16 4.5a3.2 3.2 0 0 1 0 7" />
      <path d="M21 20c0-2.6-1.6-4.3-4-4.8" />
    </svg>
  );
}
function ClientsIcon() {
  return (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M4 20h16" />
    </svg>
  );
}
