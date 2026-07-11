import { NavLink } from "react-router-dom";
import {
  IconDashboard,
  IconHome,
  IconTables,
  IconMenu,
  IconStaff,
  IconGuests,
  IconAnalytics,
  IconReservations,
  IconBell,
  IconClipboard,
  type IconProps,
} from "./icons";
import { asset } from "../../lib/asset";

/**
 * Навигация админской CRM. Generic — принимает только имя ресторана и
 * колбэк выхода, не зависит от admin-доменных типов.
 */
export default function Sidebar({
  restaurantName,
  onLogout,
  open,
  onClose,
}: {
  restaurantName?: string;
  onLogout?: () => void;
  open?: boolean;
  onClose?: () => void;
}) {
  return (
    <aside className={"admin-sidebar" + (open ? " open" : "")}>
      <div className="admin-brand">
        <div className="abr-mark" style={{ background: "#fff", padding: 0, overflow: "hidden", borderRadius: "50%" }}>
          <img src={asset("brand/logo.png")} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="abr-name">Example lounge</div>
          <div className="abr-sub">CRM</div>
        </div>
        <button type="button" className="admin-drawer-close" onClick={onClose} aria-label="Закрыть меню">
          ✕
        </button>
      </div>

      <nav className="admin-nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} title={item.label} onClick={onClose}>
              <Icon />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="admin-sidebar-foot">
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
  { to: "/admin/home", label: "Главная", icon: IconHome },
  { to: "/admin/tables", label: "Столы", icon: IconTables },
  { to: "/admin/reservations", label: "Брони", icon: IconReservations },
  { to: "/admin/menu", label: "Меню", icon: IconMenu },
  { to: "/admin/staff", label: "Команда", icon: IconStaff },
  { to: "/admin/clients", label: "Гости", icon: IconGuests },
  { to: "/admin/calls", label: "Обращения", icon: IconBell },
  { to: "/admin/analytics", label: "Аналитика", icon: IconAnalytics },
  { to: "/admin/onboarding", label: "Онбординг", icon: IconClipboard },
];
