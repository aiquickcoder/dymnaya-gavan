import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { Shell } from "../../components/Shell";
import { KEYS, useStored, type GuestSession } from "../../store";
import { VENUE } from "../../lib/mocks";

export default function Auth() {
  const navigate = useNavigate();
  const [, setGuest] = useStored<GuestSession>(KEYS.guest);
  const [tab, setTab] = useState<"register" | "login">("register");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function register() {
    setBusy(true);
    setError("");
    try {
      const user = await api.registerUser({
        phoneNumber: phone.trim(),
        gender: gender || undefined,
      });
      setGuest({ userId: user.id, phoneNumber: user.phoneNumber });
      navigate("/guest/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function continueAsGuest() {
    setGuest({ userId: "", phoneNumber: "", anon: true });
    navigate("/guest/home");
  }

  return (
    <Shell>
      <div className="fade-in" style={{ paddingTop: 20 }}>
        <h1 className="display" style={{ fontSize: 30 }}>С возвращением</h1>
        <p className="muted small">Гость заведения «{VENUE.name}»</p>

        <div className="seg block" style={{ margin: "16px 0" }}>
          <button className={tab === "login" ? "on" : ""} onClick={() => setTab("login")}>Вход</button>
          <button className={tab === "register" ? "on" : ""} onClick={() => setTab("register")}>Регистрация</button>
        </div>

        {error && <Banner kind="error">{error}</Banner>}

        {tab === "login" && (
          <Banner kind="info">
            Вход по номеру появится позже — пока зарегистрируйтесь. Если вы уже
            заходили на этом устройстве, сессия сохранена автоматически.
          </Banner>
        )}

        <div className="card">
          <label>Номер телефона</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 999 123-45-67"
          />
          <label>Пол (необязательно)</label>
          <div className="seg block">
            {[
              { v: "male", l: "Мужской" },
              { v: "female", l: "Женский" },
              { v: "", l: "Не указывать" },
            ].map((g) => (
              <button key={g.l} className={gender === g.v ? "on" : ""} onClick={() => setGender(g.v)}>
                {g.l}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <button className="primary block lg" disabled={busy || phone.trim().length < 5} onClick={register}>
            {busy ? "Секунду…" : tab === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </div>

        <div className="row" style={{ margin: "16px 0", color: "var(--muted)" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span className="small">или</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <button className="ghost block" onClick={continueAsGuest}>
          Продолжить как гость
        </button>
        <p className="muted small center" style={{ marginTop: 8 }}>
          Без избранного и истории визитов
        </p>
      </div>
    </Shell>
  );
}
