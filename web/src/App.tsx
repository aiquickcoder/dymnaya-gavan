import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useTheme } from "./theme";
import { DEMO } from "./lib/demo";
// guest
import CheckIn from "./pages/guest/CheckIn";
import Auth from "./pages/guest/Auth";
import Home from "./pages/guest/Home";
import Mix from "./pages/guest/Mix";
import Quiz from "./pages/guest/Quiz";
import Build from "./pages/guest/Build";
import Session from "./pages/guest/Session";
import Tip from "./pages/guest/Tip";
import Profile from "./pages/guest/Profile";
import Master from "./pages/guest/Master";
import Book from "./pages/guest/Book";
import Kitchen from "./pages/guest/Kitchen";
import Favourites from "./pages/guest/Favourites";
// staff (unchanged)
import StaffLogin from "./pages/staff/Login";
import StaffConsole from "./pages/staff/Console";
// admin CRM
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import HomeBuilder from "./pages/admin/HomeBuilder";
import Tables from "./pages/admin/Tables";
import Menu from "./pages/admin/Menu";
import Staff from "./pages/admin/Staff";
import Clients from "./pages/admin/Clients";
import Analytics from "./pages/admin/Analytics";
import Reservations from "./pages/admin/Reservations";
import Calls from "./pages/admin/Calls";
import AdminLogin from "./pages/admin/Login";

function StaffLayout() {
  const navigate = useNavigate();
  return (
    <>
      <div className="topbar">
        <span className="brand" onClick={() => navigate("/staff")} style={{ cursor: "pointer" }}>
          <span className="mix">Дымная</span> Гавань · staff
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

      {/* admin CRM — "Дымная Гавань" */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/home" element={<HomeBuilder />} />
        <Route path="/admin/tables" element={<Tables />} />
        <Route path="/admin/reservations" element={<Reservations />} />
        <Route path="/admin/menu" element={<Menu />} />
        <Route path="/admin/staff" element={<Staff />} />
        <Route path="/admin/clients" element={<Clients />} />
        <Route path="/admin/calls" element={<Calls />} />
        <Route path="/admin/analytics" element={<Analytics />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route path="*" element={<Navigate to="/guest" replace />} />
    </Routes>
  );
}
