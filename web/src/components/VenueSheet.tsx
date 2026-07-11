import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomSheet from "./BottomSheet";
import PhotoLightbox from "./PhotoLightbox";
import { VENUE } from "../lib/mocks";
import { asset } from "../lib/asset";

// Открыто ли сейчас — грубая проверка по окну VENUE.openFrom..openTo (с переходом через полночь).
function isOpenNow(): boolean {
  const h = new Date().getHours();
  const { openFrom, openTo } = VENUE;
  return openFrom <= openTo ? h >= openFrom && h < openTo : h >= openFrom || h < openTo;
}

export default function VenueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const openNow = isOpenNow();
  // Яндекс-виджет: центр на заведении + один чистый красный пин (pm2rdm), без лишних маркеров.
  const mapSrc = `https://yandex.ru/map-widget/v1/?ll=${VENUE.mapLon},${VENUE.mapLat}&z=16&pt=${VENUE.mapLon},${VENUE.mapLat},pm2rdm`;
  const openMapLink = `https://yandex.ru/maps/?ll=${VENUE.mapLon},${VENUE.mapLat}&z=17&pt=${VENUE.mapLon},${VENUE.mapLat},pm2rdm&text=${encodeURIComponent(VENUE.name + ", " + VENUE.address)}`;

  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* шапка */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <img
          src={asset("brand/logo.png")}
          alt=""
          style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", background: "#fff", border: "1px solid var(--border)", flex: "none" }}
        />
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontSize: 21, lineHeight: 1.1 }}>{VENUE.name}</div>
          <div className="muted small" style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>★ {VENUE.rating}</span>
            <span>·</span>
            <span>{VENUE.reviews} оценок</span>
            <span>·</span>
            <span>{VENUE.category}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <span
          className="pill"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: openNow ? "var(--success)" : "var(--muted)",
            background: openNow ? "rgba(43,182,115,0.12)" : "var(--surface2, rgba(0,0,0,0.05))",
            borderColor: "transparent",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: openNow ? "var(--success)" : "var(--muted)" }} />
          {openNow ? "Открыто · до 02:00" : "Сейчас закрыто"}
        </span>
      </div>

      {/* бронирование */}
      <button
        type="button"
        onClick={() => { onClose(); navigate("/guest/book"); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", marginTop: 14,
          padding: "13px 16px", borderRadius: 13, border: "none", background: "var(--accent)", color: "#fff",
          fontWeight: 700, fontSize: 15, cursor: "pointer",
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>
        Забронировать стол
      </button>

      {/* карусель интерьера */}
      <div
        style={{
          display: "flex", gap: 10, marginTop: 16, overflowX: "auto",
          scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
          marginLeft: -2, paddingBottom: 2,
        }}
      >
        {VENUE.interior.map((src, i) => (
          <img
            key={i}
            src={asset(src)}
            alt={`Интерьер ${i + 1}`}
            loading="lazy"
            onClick={() => setLightbox(i)}
            style={{
              width: 232, height: 156, flex: "none", objectFit: "cover", cursor: "pointer",
              borderRadius: 14, border: "1px solid var(--border)", scrollSnapAlign: "start", background: "var(--surface2, #eee)",
            }}
          />
        ))}
      </div>

      {/* описание */}
      <p style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.5, color: "var(--text)" }}>{VENUE.description}</p>

      {/* часы */}
      <div className="section-title" style={{ marginTop: 18 }}>Часы работы</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {VENUE.hours.map((h) => (
          <div key={h.d} className="row between" style={{ fontSize: 14 }}>
            <span className="muted">{h.d}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{h.t}</span>
          </div>
        ))}
      </div>

      {/* карта */}
      <div className="section-title" style={{ marginTop: 18 }}>На карте</div>
      <div style={{ marginTop: 8, borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
        <iframe
          title="Карта"
          src={mapSrc}
          style={{ width: "100%", height: 220, border: 0, display: "block" }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>{VENUE.addressFull}</div>
      <a
        href={openMapLink}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10,
          textDecoration: "none", padding: "11px 14px", borderRadius: 12,
          border: "1px solid var(--border)", color: "var(--text)", fontWeight: 600, fontSize: 14,
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        Построить маршрут
      </a>

      {/* контакты */}
      <div className="section-title" style={{ marginTop: 18 }}>Контакты</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        <a
          href={VENUE.instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="row between"
          style={{ fontSize: 14, textDecoration: "none", color: "var(--text)" }}
        >
          <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5.5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
            </svg>
            Instagram
          </span>
          <span style={{ color: "var(--accent)" }}>@{VENUE.instagram}</span>
        </a>
        <a href={`tel:${VENUE.phone.replace(/[^\d+]/g, "")}`} className="row between" style={{ fontSize: 14, textDecoration: "none", color: "var(--text)" }}>
          <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
            </svg>
            Телефон
          </span>
          <span>{VENUE.phone}</span>
        </a>
        <div className="row between" style={{ fontSize: 14, alignItems: "flex-start" }}>
          <span className="muted">Адрес</span>
          <span style={{ textAlign: "right", maxWidth: "70%" }}>{VENUE.address}, {VENUE.city}</span>
        </div>
      </div>

      <PhotoLightbox photos={VENUE.interior} index={lightbox} onClose={() => setLightbox(null)} />
    </BottomSheet>
  );
}
