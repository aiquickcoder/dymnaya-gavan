// /admin/onboarding — входящие онбординг-брифы (заполненные формы настройки
// заведений). Список карточек: заведение, город, контакт, дата + разворот с
// полным ответом (payload). Данные из api.onboardingBriefs (GET /onboarding).
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { useRequireStaff } from "../../lib/guards";
import type { OnboardingBrief } from "../../types";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

const isImg = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:image");

function renderValue(v: unknown): ReactNode {
  if (isImg(v)) {
    return (
      <a href={v} target="_blank" rel="noreferrer">
        <img className="ob-img" src={v} alt="" />
      </a>
    );
  }
  if (Array.isArray(v)) {
    if (v.length > 0 && isImg(v[0])) {
      return (
        <div className="ob-imgs">
          {(v as string[]).map((s, i) => (
            <a key={i} href={s} target="_blank" rel="noreferrer">
              <img className="ob-img" src={s} alt="" />
            </a>
          ))}
        </div>
      );
    }
    if (v.length > 0 && typeof v[0] === "object" && v[0] !== null) {
      return (
        <div className="ob-list">
          {(v as Record<string, unknown>[]).map((o, i) => (
            <div className="ob-sub" key={i}>
              {Object.entries(o)
                .filter(([, val]) => String(val ?? "").trim() !== "")
                .map(([k, val]) => `${k}: ${val}`)
                .join(" · ")}
            </div>
          ))}
        </div>
      );
    }
    return (v as unknown[]).join(", ");
  }
  return String(v ?? "");
}

export default function Onboarding() {
  useRequireStaff();

  const [briefs, setBriefs] = useState<OnboardingBrief[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .onboardingBriefs()
      .then((b) => {
        if (alive) setBriefs(b);
      })
      .catch((e) => {
        if (alive) setError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="ob-page">
      <div className="ob-head">
        <div>
          <h1 className="page-title">Онбординг</h1>
          <div className="admin-sub">Заполненные брифы заведений · всего {briefs.length}</div>
        </div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <div className="ob-empty">Загружаем…</div>
      ) : briefs.length === 0 ? (
        <div className="ob-empty">Пока нет заполненных брифов.</div>
      ) : (
        <div className="ob-grid">
          {briefs.map((b) => {
            const isOpen = open === b.id;
            const entries = Object.entries(b.payload ?? {});
            return (
              <div className={"ob-card" + (isOpen ? " open" : "")} key={b.id}>
                <button className="ob-top" onClick={() => setOpen(isOpen ? null : b.id)}>
                  <div>
                    <div className="ob-venue">{b.venue || "Без названия"}</div>
                    <div className="ob-meta">
                      {[b.city, b.contact, b.phone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="ob-right">
                    <span className={"ob-status ob-" + b.status}>
                      {b.status === "new" ? "Новый" : b.status}
                    </span>
                    <span className="ob-date">{fmtDate(b.createdAt)}</span>
                    <span className="ob-chev">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="ob-body">
                    {entries.length === 0 ? (
                      <div className="admin-sub">Пустой бриф.</div>
                    ) : (
                      entries.map(([k, v]) => (
                        <div className="ob-row" key={k}>
                          <div className="ob-k">{k}</div>
                          <div className="ob-v">{renderValue(v)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
