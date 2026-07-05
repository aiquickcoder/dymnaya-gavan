import { Outlet, useNavigate } from "react-router-dom";
import { useRequireStaff } from "../../lib/guards";
import Sidebar from "../../components/admin/Sidebar";
import "../../admin.css";

/**
 * Каркас админской CRM: сайдбар + топбар + <Outlet/>.
 * Гвард useRequireStaff() (владелец — data-infra) сам редиректит на
 * /admin/login при отсутствии сессии; до редиректа рендерим null.
 */
export default function AdminLayout() {
  const session = useRequireStaff();
  const navigate = useNavigate();

  if (!session) return null;

  function logout() {
    // Ключ сессии решает data-infra (KEYS.admin | KEYS.staff) — чистим оба
    // известных, чтобы не зависеть от выбора и не сломать компиляцию.
    try {
      localStorage.removeItem("mm.admin");
      localStorage.removeItem("mm.staff");
    } catch {
      /* ignore */
    }
    navigate("/admin/login", { replace: true });
  }

  const today = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const initial = (session.employeeName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="admin">
      <Sidebar restaurantName={session.restaurantName} onLogout={logout} />
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-sub atb-date" style={{ textTransform: "capitalize" }}>
            {today}
          </div>
          <div className="atb-user">
            <div className="admin-sub" style={{ textAlign: "right" }}>{session.employeeName}</div>
            <div className="atb-avatar">{initial}</div>
          </div>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
