import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useTheme } from "./theme";
import { DEMO } from "./lib/demo";
// guest — точка входа (eager, чтобы лендинг открывался без задержки)
import CheckIn from "./pages/guest/CheckIn";
import Auth from "./pages/guest/Auth";
import Home from "./pages/guest/Home";
// guest — второстепенные экраны (lazy, грузятся по переходу)
const Mix = lazy(() => import("./pages/guest/Mix"));
const Quiz = lazy(() => import("./pages/guest/Quiz"));
const Build = lazy(() => import("./pages/guest/Build"));
const Session = lazy(() => import("./pages/guest/Session"));
const Tip = lazy(() => import("./pages/guest/Tip"));
const Profile = lazy(() => import("./pages/guest/Profile"));
const Master = lazy(() => import("./pages/guest/Master"));
const Book = lazy(() => import("./pages/guest/Book"));
const Kitchen = lazy(() => import("./pages/guest/Kitchen"));
const Favourites = lazy(() => import("./pages/guest/Favourites"));
// staff — legacy (lazy)
const StaffLogin = lazy(() => import("./pages/staff/Login"));
const StaffConsole = lazy(() => import("./pages/staff/Console"));
// admin CRM (lazy — гость не грузит код админки и графиков)
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const HomeBuilder = lazy(() => import("./pages/admin/HomeBuilder"));
const Tables = lazy(() => import("./pages/admin/Tables"));
const Menu = lazy(() => import("./pages/admin/Menu"));
const Staff = lazy(() => import("./pages/admin/Staff"));
const Clients = lazy(() => import("./pages/admin/Clients"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const Reservations = lazy(() => import("./pages/admin/Reservations"));
const Calls = lazy(() => import("./pages/admin/Calls"));
const Onboarding = lazy(() => import("./pages/admin/Onboarding"));
const AdminLogin = lazy(() => import("./pages/admin/Login"));

function StaffLayout() {
  const navigate = useNavigate();
  return (
    <>
      <div className="topbar">
        <span className="brand" onClick={() => navigate("/staff")} style={{ cursor: "pointer" }}>
          <span className="mix">Hookah</span>Mania · staff
        </span>
        <a className="pill" onClick={() => navigate("/guest")} style={{ cursor: "pointer" }}>
          Гостевой веб
        </a>
      </div>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}

export default function App() {
  useTheme(); // apply stored ember/smoke theme on startup

  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--bg)" }} />}>
      <Routes>
        <Route path="/" element={<Navigate to={DEMO ? "/guest/home" : "/guest"} replace />} />

        {/* guest — each screen renders its own full-height Shell */}
        <Route path="/guest" element={<CheckIn />} />
        <Route path="/guest/auth" element={<Auth />} />
        <Route path="/guest/home" element={<Home />} />
        <Route path="/guest/mix/:id" element={<Mix />} />
        <Route path="/guest/master/:id" element={<Master />} />
        <Route path="/guest/quiz" element={<Quiz />} />
        <Route path="/guest/build" element={<Build />} />
        <Route path="/guest/session" element={<Session />} />
        <Route path="/guest/tip/:employeeId" element={<Tip />} />
        <Route path="/guest/profile" element={<Profile />} />
        <Route path="/guest/favourites" element={<Favourites />} />
        <Route path="/guest/kitchen" element={<Kitchen />} />
        <Route path="/guest/book" element={<Book />} />

        {/* staff — legacy console under the top-bar layout */}
        <Route element={<StaffLayout />}>
          <Route path="/staff" element={<StaffLogin />} />
          <Route path="/staff/console" element={<StaffConsole />} />
        </Route>

        {/* admin CRM */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/home" element={<HomeBuilder />} />
          <Route path="/admin/tables" element={<Tables />} />
          <Route path="/admin/reservations" element={<Reservations />} />
          <Route path="/admin/menu" element={<Menu />} />
          <Route path="/admin/staff" element={<Staff />} />
          <Route path="/admin/clients" element={<Clients />} />
          <Route path="/admin/calls" element={<Calls />} />
          <Route path="/admin/onboarding" element={<Onboarding />} />
          <Route path="/admin/analytics" element={<Analytics />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="*" element={<Navigate to="/guest" replace />} />
      </Routes>
    </Suspense>
  );
}
