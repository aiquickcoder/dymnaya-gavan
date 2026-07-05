import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { DEMO } from "../../lib/demo";
import { Banner } from "../../components/ui";
import { KEYS, useStored, type AdminSession } from "../../store";
import type { Employee, RestaurantBrief } from "../../types";

const DEMO_CODE = "DEMO0000";

/** Admin CRM sign-in: restaurant code → pick employee → write AdminSession → /admin. */
export default function AdminLogin() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useStored<AdminSession>(KEYS.admin);
  const [code, setCode] = useState(DEMO ? DEMO_CODE : "");
  const [restaurant, setRestaurant] = useState<RestaurantBrief | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function lookup() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.staffLogin(code.trim());
      setRestaurant(res.restaurant);
      setEmployees(res.employees);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setRestaurant(null);
      setEmployees([]);
    } finally {
      setBusy(false);
    }
  }

  function pick(emp: Employee) {
    if (!restaurant) return;
    const employeeName =
      [emp.lastName, emp.firstName].filter(Boolean).join(" ").trim() ||
      emp.shortName ||
      "Сотрудник";
    setAdmin({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      employeeId: emp.id,
      employeeName,
      code: code.trim(),
    });
    navigate("/admin");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div className="fade-in" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            className="display"
            style={{ fontSize: 30, lineHeight: 1.05 }}
          >
            <span style={{ color: "var(--accent)" }}>Дымная</span> Гавань
          </div>
          <div className="muted small" style={{ letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 6 }}>
            Панель управления · CRM
          </div>
        </div>

        {error && <Banner kind="error">{error}</Banner>}

        {admin && !restaurant ? (
          <div className="card">
            <div className="display" style={{ fontSize: 18 }}>{admin.restaurantName}</div>
            <div className="muted small" style={{ marginTop: 4 }}>Вы уже вошли как {admin.employeeName}</div>
            <div className="spacer lg" />
            <button className="primary block lg" onClick={() => navigate("/admin")}>
              Открыть панель
            </button>
            <div className="spacer" />
            <button className="ghost block" onClick={() => setAdmin(null)}>
              Сменить пользователя
            </button>
          </div>
        ) : !restaurant ? (
          <>
            {DEMO && (
              <Banner kind="info">
                Демо-режим: код доступа <b>{DEMO_CODE}</b> уже подставлен — просто нажмите «Войти».
              </Banner>
            )}
            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                lookup();
              }}
            >
              <label>Код ресторана</label>
              <input
                autoFocus
                value={code}
                placeholder="например, DEMO0000"
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value)}
              />
              <div className="spacer lg" />
              <button className="primary block lg" type="submit" disabled={busy || !code.trim()}>
                {busy ? "Проверяем…" : "Войти"}
              </button>
            </form>
            <p className="muted small center">
              Введите код заведения, затем выберите себя из списка сотрудников.
            </p>
          </>
        ) : (
          <>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <div className="display" style={{ fontSize: 18 }}>{restaurant.name}</div>
                <div className="muted small">Кто вы?</div>
              </div>
              <button
                className="ghost sm"
                onClick={() => {
                  setRestaurant(null);
                  setEmployees([]);
                }}
              >
                Назад
              </button>
            </div>

            {employees.length === 0 ? (
              <div className="empty">В этом заведении ещё нет сотрудников.</div>
            ) : (
              employees.map((e) => (
                <div className="card clickable" key={e.id} onClick={() => pick(e)}>
                  <div className="display" style={{ fontSize: 16 }}>
                    {[e.lastName, e.firstName, e.middleName].filter(Boolean).join(" ")}
                  </div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {[e.shortName, e.position].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
