import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useRequireStaff } from "../../lib/guards";
import Sidebar from "../../components/admin/Sidebar";
import ToastHost from "../../components/admin/ToastHost";
import PushOnboarding from "../../components/admin/PushOnboarding";
import { setPWATarget } from "../../lib/pwa";
import "../../admin.css";

/**
 * Каркас админской CRM: сайдбар + топбар + <Outlet/>.
 * Гвард useRequireStaff() (владелец — data-infra) сам редиректит на
 * /admin/login при отсутствии сессии; до редиректа рендерим null.
 */
export default function AdminLayout() {
  const session = useRequireStaff();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Пока открыта админка — контекст PWA «HookahMania Admin» (для установки на «Домой»).
  useEffect(() => {
    setPWATarget(true);
    return () => setPWATarget(false);
  }, []);

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
      <Sidebar
        restaurantName={session.restaurantName}
        onLogout={logout}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      {drawerOpen && <div className="admin-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-hamburger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Меню"
          >
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <path d="M2.5 6h19M2.5 12h19M2.5 18h19" />
            </svg>
          </button>
          <div className="admin-sub atb-date" style={{ textTransform: "capitalize" }}>
            {today}
          </div>
          <div className="atb-user">
            <div className="admin-sub" style={{ textAlign: "right" }}>{session.employeeName}</div>
            <div className="atb-avatar">{initial}</div>
          </div>
        </header>
        <div className="admin-content">
          <PushOnboarding />
          <Outlet />
        </div>
      </div>
      {/* Глобальный хост тостов о новых вызовах: поллит adminCalls на ЛЮБОМ
          /admin-экране, проигрывает звук и показывает всплывашку (агент calls). */}
      <ToastHost />
    </div>
  );
}
