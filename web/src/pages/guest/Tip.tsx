import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { Shell, BackHeader } from "../../components/Shell";
import { Banner } from "../../components/ui";
import { useRequireTable } from "../../lib/guards";
import { masterImageUrl } from "../../lib/masterImages";

// Чаевые через Нетмонет: у сотрудника своя уникальная ссылка. Оплату/сумму
// обрабатывает сам Нетмонет — мы лишь открываем его страницу.
export default function Tip() {
  const table = useRequireTable();
  const { employeeId } = useParams();
  const [params] = useSearchParams();
  const name = params.get("name") || "мастеру";

  const [tipUrl, setTipUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;
    let alive = true;
    api
      .employeeTipUrl(employeeId)
      .then((u) => {
        if (alive) setTipUrl(u);
      })
      .catch(() => {
        if (alive) setTipUrl(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [employeeId]);

  if (!table) return null;

  const avatar = masterImageUrl(name);

  return (
    <Shell>
      <BackHeader title="Чаевые" to="/guest/session" />
      <div className="fade-in">
        <div className="card center">
          <div
            className="avatar lg"
            style={{
              margin: "0 auto 8px",
              ...(avatar ? { backgroundImage: `url('${avatar}')`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
            }}
          >
            {!avatar && name.charAt(0).toUpperCase()}
          </div>
          <div className="display" style={{ fontSize: 19 }}>{name}</div>
          <div className="muted small">Поблагодарите за вечер</div>
        </div>

        {loading ? (
          <div className="empty">Загружаем…</div>
        ) : tipUrl ? (
          <>
            <p className="muted small center" style={{ marginTop: 4 }}>
              Оплата пройдёт на защищённой странице Нетмонет — картой или СБП.
              Сумму выберете там.
            </p>
            <a href={tipUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <button className="primary block lg" style={{ marginTop: 14 }}>
                Оставить чай ↗
              </button>
            </a>
            <div className="muted small center" style={{ marginTop: 10, wordBreak: "break-all" }}>
              {tipUrl.replace(/^https?:\/\//, "")}
            </div>
          </>
        ) : (
          <Banner kind="info">У сотрудника пока не настроены чаевые.</Banner>
        )}
      </div>
    </Shell>
  );
}
