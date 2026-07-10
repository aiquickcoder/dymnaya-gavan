import { useEffect, useRef, useState } from "react";

/**
 * Промо-баннеры главной — карусель со свайпом и точками (перенос из v2).
 * Три дизайнерских баннера (Xperience / Счастливые часы / Darkside × MOON),
 * полностью на SVG+CSS, самодостаточны и вписаны в текущую тему.
 */
export default function BannerCarousel({
  onOpen,
  customImage,
  customTag,
}: {
  onOpen?: () => void;
  customImage?: string;
  customTag?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = customImage ? 4 : 3;

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  };
  const goTo = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // Автопрокрутка баннеров: каждые 5с к следующему по кругу; пауза при наведении/тапе.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || total <= 1) return;
    const id = window.setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      const next = (cur + 1) % total;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => window.clearInterval(id);
  }, [paused, total]);

  return (
    <div className="banners-wrap">
      <div
        className="banners"
        ref={ref}
        onScroll={onScroll}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        aria-label="Акции и новинки"
      >
        {/* 0 — своя картинка из конструктора (если задана) */}
        {customImage && (
          <div className="custom-banner" role="button" tabIndex={0} onClick={onOpen} style={{ backgroundImage: `url('${customImage}')` }}>
            <div className="cb-scrim" />
            <span className="xp-tag">{customTag || "Уже можно попробовать"}</span>
          </div>
        )}

        {/* 1 — Xperience by Darkside */}
        <div className="xp-banner" role="button" tabIndex={0} onClick={onOpen} aria-label="Xperience by Darkside — уже можно попробовать">
          <div className="xp-left">
            <div className="xp-brand">
              Xperience <span className="l2">by Darkside</span>
            </div>
            <div className="xp-desc">Ароматы средней крепости, вдохновлённые общением с близкими по духу.</div>
          </div>
          <div className="xp-right" aria-hidden="true">
            <svg className="xp-skull" viewBox="0 0 120 120">
              <g stroke="#1E1E23" strokeWidth="3" fill="none">
                <path d="M60 16c22 0 35 14 35 33 0 12-6 21-14 26v13H39V75c-8-5-14-14-14-26 0-19 13-33 35-33z" />
                <path d="M48 90v10M60 90v12M72 90v10" />
              </g>
              <ellipse cx="47" cy="56" rx="8" ry="10" fill="#1E1E23" />
              <ellipse cx="73" cy="56" rx="8" ry="10" fill="#1E1E23" />
              <path d="M60 64l6 12H54z" fill="#1E1E23" />
            </svg>
            <span className="xp-vertical">Darkside</span>
            <svg className="xp-boom" viewBox="0 0 200 200">
              <polygon fill="#FF6A00" points="100,8 116,62 168,34 132,84 192,100 132,116 168,166 116,138 100,192 84,138 32,166 68,116 8,100 68,84 32,34 84,62" />
              <polygon fill="#FFB566" transform="translate(100,100) scale(.5) translate(-100,-100)" points="100,8 116,62 168,34 132,84 192,100 132,116 168,166 116,138 100,192 84,138 32,166 68,116 8,100 68,84 32,34 84,62" />
            </svg>
            <div className="xp-pack">
              <div className="xp-pack-logo">Xperience</div>
              <div className="xp-pack-art">
                <span className="xp-pack-x">X</span>
                <svg className="xp-pack-cherries" viewBox="0 0 40 40">
                  <path d="M14 20c2-7 7-10 13-11M27 25c1-6 3-9 0-16" stroke="#2A1005" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                  <circle cx="14" cy="27" r="7" fill="#3A0E0E" />
                  <circle cx="28" cy="30" r="6" fill="#541111" />
                  <circle cx="12" cy="25" r="2" fill="rgba(255,255,255,.25)" />
                </svg>
              </div>
              <span className="xp-pack-weight">30г</span>
              <div className="xp-pack-band">
                <b>Maraschini!</b>
                <span>аромат #вишни #мартини</span>
              </div>
            </div>
          </div>
          <span className="xp-tag">Уже можно попробовать</span>
        </div>

        {/* 2 — счастливые часы */}
        <div className="hh-banner" role="button" tabIndex={0} onClick={onOpen} aria-label="Счастливые часы: минус 20% на все миксы">
          <svg className="hh-clock" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#fff" strokeWidth="6" />
            <path d="M50 26v24l16 10" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
          </svg>
          <div className="hh-big">−20%</div>
          <div className="hh-title">Счастливые часы</div>
          <div className="hh-desc">На все миксы по будням с 14:00 до 18:00. Скидка применяется сама.</div>
          <span className="xp-tag light">Сегодня до 18:00</span>
        </div>

        {/* 3 — Darkside × MOON */}
        <div className="moon-banner" role="button" tabIndex={0} onClick={onOpen} aria-label="Darkside × MOON — лимитная коллаборация">
          <svg className="moon-art" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="55" cy="50" r="30" fill="#CDC9F0" />
            <circle cx="46" cy="42" r="6" fill="#B0ABDD" />
            <circle cx="63" cy="58" r="8" fill="#B0ABDD" />
            <circle cx="58" cy="36" r="3.5" fill="#B0ABDD" />
            <circle cx="14" cy="22" r="1.8" fill="#8F88C9" />
            <circle cx="24" cy="78" r="1.4" fill="#8F88C9" />
            <circle cx="88" cy="16" r="1.5" fill="#8F88C9" />
          </svg>
          <div className="mb-title">
            Darkside × MOON <small>лимитная серия</small>
          </div>
          <div className="mb-desc">Виноград, черника и дыня. Партия ограничена — успейте попробовать.</div>
          <span className="xp-tag violet">Осталось мало</span>
        </div>
      </div>

      <div className="banner-dots" role="tablist" aria-label="Переключение баннеров">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            className={"bdot" + (active === i ? " on" : "")}
            aria-label={`Баннер ${i + 1}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
