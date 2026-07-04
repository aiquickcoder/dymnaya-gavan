import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shell, BackHeader } from "../../components/Shell";
import { useRequireTable } from "../../lib/guards";
import { masterImageUrl } from "../../lib/masterImages";
import { TIP_PRESETS } from "../../lib/mocks";

// TODO(api): чаевых/платежей в бэкенде нет — экран визуальный, без реальной оплаты.
export default function Tip() {
  const table = useRequireTable();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const masterName = params.get("name") || "мастеру";

  const [amount, setAmount] = useState(TIP_PRESETS[1]);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [anon, setAnon] = useState(false);
  const [sent, setSent] = useState(false);

  const finalAmount = custom ? Math.max(0, parseInt(custom, 10) || 0) : amount;

  if (!table) return null;

  if (sent) {
    return (
      <Shell>
        <BackHeader title="Чаевые" to="/guest/session" />
        <div className="fade-in center" style={{ paddingTop: 40 }}>
          <div className="display" style={{ fontSize: 46, color: "var(--accent-2)" }}>✓</div>
          <h1 className="display" style={{ fontSize: 24 }}>Чаевые отправлены</h1>
          <p className="muted">
            {finalAmount} ₽ {masterName !== "мастеру" ? masterName : "мастеру"}
            {anon ? " · анонимно" : ""}
          </p>
          <div className="spacer lg" />
          <button className="primary" onClick={() => navigate("/guest/session")}>Готово</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <BackHeader title="Чаевые" to="/guest/session" />
      <div className="fade-in">
        <div className="card center">
          <div
            className="avatar lg"
            style={{
              margin: "0 auto 8px",
              ...(masterImageUrl(masterName)
                ? { backgroundImage: `url('${masterImageUrl(masterName)}')`, backgroundSize: "cover", backgroundPosition: "center" }
                : {}),
            }}
          >
            {!masterImageUrl(masterName) && masterName.charAt(0).toUpperCase()}
          </div>
          <div className="display" style={{ fontSize: 19 }}>{masterName}</div>
        </div>

        <div className="section-title display">Сумма</div>
        <div className="grid2" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {TIP_PRESETS.map((p) => (
            <button
              key={p}
              className={!custom && amount === p ? "primary" : ""}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
            >
              {p} ₽
            </button>
          ))}
        </div>
        <label>Своя сумма</label>
        <input type="number" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="₽" />

        <label>Сообщение (необязательно)</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Спасибо за вечер!" />

        <div className="card row between" style={{ marginTop: 14 }}>
          <span>Анонимно</span>
          <div className={"switch" + (anon ? " on" : "")} onClick={() => setAnon((a) => !a)}>
            <span className="knob" />
          </div>
        </div>

        <button className="primary block lg" disabled={finalAmount <= 0} onClick={() => setSent(true)}>
          Оставить {finalAmount} ₽
        </button>
      </div>
    </Shell>
  );
}
