import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import SmokeBg from "./SmokeBg";
import BottomNav from "./BottomNav";

/** Guest app shell: phone-width column, ambient smoke, scroll area + optional tab bar. */
export function Shell({ children, nav }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className="app">
      <SmokeBg />
      <div className={"screen" + (nav ? " has-nav" : "")}>{children}</div>
      {nav && <BottomNav />}
    </div>
  );
}

/** Back header used on drill-in screens (mix / quiz / build / tip). */
export function BackHeader({ title, to }: { title: string; to?: string | number }) {
  const navigate = useNavigate();
  const goBack = () => (typeof to === "string" ? navigate(to) : navigate((to as number) ?? -1));
  return (
    <div className="back-header">
      <button className="back" onClick={goBack} aria-label="Назад">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span>Назад</span>
      </button>
      <div className="bt display">{title}</div>
    </div>
  );
}
