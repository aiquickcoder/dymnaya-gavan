// Consistent line-icon set for the admin CRM (zero-dep, inline SVG only).
// Every icon: viewBox 0 0 24 24, fill none, stroke currentColor — so it inherits
// the surrounding text/accent colour and scales via the `size` prop. Each glyph
// is visually distinct so a nav item / KPI tile is never ambiguous.
import type { ReactNode } from "react";

export interface IconProps {
  size?: number;
  className?: string;
}

function Icon({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ навигация */

// Дашборд — сетка из четырёх панелей.
export function IconDashboard(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="4.5" rx="1.6" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </Icon>
  );
}

// Столы — стол-вид сверху с четырьмя посадочными местами.
export function IconTables(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="7.5" y="7.5" width="9" height="9" rx="2.2" />
      <path d="M12 3.4v4.1M12 16.5v4.1M3.4 12h4.1M16.5 12h4.1" />
    </Icon>
  );
}

// Меню — маркированный список позиций.
export function IconMenu(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
      <path d="M9 6h11M9 12h11M9 18h7" />
    </Icon>
  );
}

// Персонал — двое сотрудников.
export function IconStaff(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.6 20a5.4 5.4 0 0 1 10.8 0" />
      <path d="M16.2 5.2a3 3 0 0 1 0 5.7" />
      <path d="M17 15.4A5 5 0 0 1 20.4 20" />
    </Icon>
  );
}

// Гости — карточка гостя (профиль в бейдже).
export function IconGuests(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2.4" />
      <circle cx="9" cy="10.5" r="2.4" />
      <path d="M5.6 16.4a3.6 3.6 0 0 1 6.8 0" />
      <path d="M15 9.5h3.5M15 13h3.5" />
    </Icon>
  );
}

// Аналитика — оси координат со столбиками.
export function IconAnalytics(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 4v16h16" />
      <path d="M8 17v-4.5M13 17V8M18 17v-7" />
    </Icon>
  );
}

// Брони — календарь с отмеченным днём.
export function IconReservations(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.4" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" />
      <rect x="7" y="12.5" width="3.4" height="3.2" rx="0.8" fill="currentColor" stroke="none" />
    </Icon>
  );
}

// Обращения — колокол вызова.
export function IconBell(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4.2 1.2 6 2 6.8H4c.8-.8 2-2.6 2-6.8z" />
      <path d="M10.2 19a2 2 0 0 0 3.6 0" />
    </Icon>
  );
}

// Кухня-бар — вилка и нож.
export function IconKitchen(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 3v7a2 2 0 0 0 2 2v0M9 3v6M11 3v6M9 12v9" />
      <path d="M17 3c-1.6 0-2.5 1.6-2.5 4.5S15.4 12 17 12v9" />
    </Icon>
  );
}

/* ------------------------------------------------------------------------ KPI */

// Рубль — знак ₽.
export function IconRuble(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9 20V4h4.2a4 4 0 0 1 0 8H9" />
      <path d="M6 16h8" />
    </Icon>
  );
}

// Заказы — чек с зубчатым низом.
export function IconOrders(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h5" />
    </Icon>
  );
}

// Средний чек — галочка в круге.
export function IconCheck(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 12.4l2.5 2.5 5-5.2" />
    </Icon>
  );
}

// Рейтинг — звезда.
export function IconStar(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3.5l2.6 5.28 5.82.85-4.21 4.1.99 5.79L12 16.78l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85z" />
    </Icon>
  );
}

// Загрузка зала — спидометр/датчик заполнения.
export function IconOccupancy(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M4 15h2M18 15h2M12 5v2" />
      <path d="M12 15l3.5-3" />
      <circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

// Гость (KPI) — одиночный силуэт посетителя.
export function IconGuest(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

/* ---------------------------------------------------------------------- прочее */

// Поиск — лупа.
export function IconSearch(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </Icon>
  );
}

// Плюс — добавить.
export function IconPlus(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

// Закрыть — крестик.
export function IconClose(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

// Перетаскивание — четырёхсторонняя стрелка.
export function IconMove(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3v18M3 12h18" />
      <path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
    </Icon>
  );
}
