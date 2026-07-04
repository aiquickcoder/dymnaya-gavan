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
// staff (unchanged)
import StaffLogin from "./pages/staff/Login";
import StaffConsole from "./pages/staff/Console";

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

      {/* staff — legacy console under the top-bar layout */}
      <Route element={<StaffLayout />}>
        <Route path="/staff" element={<StaffLogin />} />
        <Route path="/staff/console" element={<StaffConsole />} />
      </Route>

      <Route path="*" element={<Navigate to="/guest" replace />} />
    </Routes>
  );
}
