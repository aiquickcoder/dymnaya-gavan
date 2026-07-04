import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner, Field } from "../../components/ui";
import { KEYS, useStored, type StaffSession } from "../../store";
import type { Employee, RestaurantBrief } from "../../types";

export default function StaffLogin() {
  const navigate = useNavigate();
  const [staff, setStaff] = useStored<StaffSession>(KEYS.staff);
  const [code, setCode] = useState("");
  const [restaurant, setRestaurant] = useState<RestaurantBrief | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function lookup() {
    setBusy(true);
    setError("");
    try {
      const res = await api.staffLogin(code.trim());
      setRestaurant(res.restaurant);
      setEmployees(res.employees);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function pick(emp: Employee) {
    if (!restaurant) return;
    setStaff({
      employeeId: emp.id,
      employeeName: `${emp.lastName} ${emp.firstName} (${emp.shortName})`,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      code: code.trim(),
    });
    navigate("/staff/console");
  }

  if (staff) {
    return (
      <>
        <h1>Вы вошли</h1>
        <div className="card">
          <div className="recipe-name">{staff.restaurantName}</div>
          <div className="author">{staff.employeeName}</div>
          <div className="spacer" />
          <div className="row">
            <button className="primary" onClick={() => navigate("/staff/console")}>В консоль</button>
            <button className="danger" onClick={() => setStaff(null)}>Выйти</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Вход сотрудника</h1>
      <p className="muted small">Введите код ресторана, затем выберите себя из списка.</p>

      {error && <Banner kind="error">{error}</Banner>}

      <div className="card">
        <Field label="Код ресторана" value={code} onChange={setCode} placeholder="например, E9SUJQ5B" />
        <div className="spacer" />
        <button className="primary block" disabled={busy || !code.trim()} onClick={lookup}>
          {busy ? "Ищем…" : "Войти"}
        </button>
      </div>

      {restaurant && (
        <>
          <h2>{restaurant.name} — выберите себя</h2>
          {employees.length === 0 && <div className="empty">В этом ресторане ещё нет сотрудников.</div>}
          {employees.map((e) => (
            <div className="card clickable" key={e.id} onClick={() => pick(e)}>
              <div className="recipe-name">{e.lastName} {e.firstName} {e.middleName}</div>
              <div className="author">{e.shortName}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
