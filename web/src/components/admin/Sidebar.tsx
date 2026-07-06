import { NavLink } from "react-router-dom";
import { useTheme } from "../../theme";
import {
  IconDashboard,
  IconTables,
  IconMenu,
  IconStaff,
  IconGuests,
  IconAnalytics,
  IconReservations,
  IconBell,
  type IconProps,
} from "./icons";

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

const NAV: { to: string; label: string; end?: boolean; icon: (p: IconProps) => JSX.Element }[] = [
  { to: "/admin", label: "Сводка", end: true, icon: IconDashboard },
  { to: "/admin/tables", label: "Столы", icon: IconTables },
  { to: "/admin/reservations", label: "Брони", icon: IconReservations },
  { to: "/admin/menu", label: "Меню", icon: IconMenu },
  { to: "/admin/staff", label: "Команда", icon: IconStaff },
  { to: "/admin/clients", label: "Гости", icon: IconGuests },
  { to: "/admin/calls", label: "Обращения", icon: IconBell },
  { to: "/admin/analytics", label: "Аналитика", icon: IconAnalytics },
];
