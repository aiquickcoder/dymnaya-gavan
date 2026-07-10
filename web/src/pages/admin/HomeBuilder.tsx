// /admin/home — конструктор гостевой главной: показывай/скрывай/переставляй
// блоки экрана и задай промо-баннер (своя картинка + подпись). Демо-режим:
// правки сразу видны на гостевом /guest/home (общий demoStore).
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../../api";
import { Banner } from "../../components/ui";
import { useRequireStaff } from "../../lib/guards";
import type { HomeConfig } from "../../types";

export default function HomeBuilder() {
  const session = useRequireStaff();
  const rid = session?.restaurantId ?? null;

  const [cfg, setCfg] = useState<HomeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rid) return;
    let alive = true;
    api
      .homeConfig(rid)
      .then((c) => {
        if (alive) setCfg(c);
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
  }, [rid]);

  if (!session) return null;

  const update = (next: HomeConfig) => {
    setCfg(next);
    setSaved(false);
  };
  const toggle = (i: number) => {
    if (!cfg) return;
    update({ ...cfg, blocks: cfg.blocks.map((b, j) => (j === i ? { ...b, visible: !b.visible } : b)) });
  };
  const move = (i: number, d: number) => {
    if (!cfg) return;
    const j = i + d;
    if (j < 0 || j >= cfg.blocks.length) return;
    const blocks = [...cfg.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    update({ ...cfg, blocks });
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !cfg) return;
    const reader = new FileReader();
    reader.onload = () => update({ ...cfg, bannerImage: String(reader.result) });
    reader.readAsDataURL(f);
  };
  const save = async () => {
    if (!rid || !cfg) return;
    try {
      const c = await api.adminSetHomeConfig(rid, cfg);
      setCfg(c);
      setSaved(true);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  return (
    <div>
      <h1 className="page-title">Главная</h1>
      <p className="admin-sub">Собери гостевой экран: показывай, скрывай и переставляй блоки, задай промо-баннер.</p>
      {error && (
        <div style={{ marginTop: 12 }}>
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      {loading || !cfg ? (
        <div className="empty">Загрузка…</div>
      ) : (
        <>
          <div className="panel" style={{ marginTop: 14 }}>
            <div className="section-sub">Блоки экрана</div>
            <div className="hb-list">
              {cfg.blocks.map((b, i) => (
                <div className="hb-row" key={b.key}>
                  <div className="hb-ord">
                    <button className="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Выше">↑</button>
                    <button className="sm" disabled={i === cfg.blocks.length - 1} onClick={() => move(i, 1)} aria-label="Ниже">↓</button>
                  </div>
                  <div className="hb-label" style={{ opacity: b.visible ? 1 : 0.5 }}>{b.label}</div>
                  <div
                    className={"switch" + (b.visible ? " on" : "")}
                    role="switch"
                    aria-checked={b.visible}
                    onClick={() => toggle(i)}
                  >
                    <span className="knob" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="section-sub">Промо-баннер</div>
            <label>Подпись на баннере</label>
            <input
              value={cfg.bannerTag ?? ""}
              onChange={(e) => update({ ...cfg, bannerTag: e.target.value })}
              placeholder="Уже можно попробовать"
            />
            <label>Картинка баннера</label>
            {cfg.bannerImage ? (
              <div className="hb-banner-prev" style={{ backgroundImage: `url('${cfg.bannerImage}')` }}>
                <span className="hb-prev-tag">{cfg.bannerTag || "Уже можно попробовать"}</span>
              </div>
            ) : (
              <div className="muted small" style={{ marginTop: 2 }}>
                Без своей картинки — показывается стандартная карусель баннеров.
              </div>
            )}
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
              <button onClick={() => fileRef.current?.click()}>Загрузить картинку</button>
              {cfg.bannerImage && (
                <button className="danger" onClick={() => update({ ...cfg, bannerImage: null })}>
                  Убрать
                </button>
              )}
            </div>
          </div>

          <div className="row" style={{ marginTop: 18, gap: 12 }}>
            <button className="primary" onClick={save}>
              Сохранить
            </button>
            {saved && <span className="muted small">Сохранено ✓ — открой /guest/home</span>}
          </div>
        </>
      )}
    </div>
  );
}
