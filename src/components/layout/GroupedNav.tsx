import React from "react";
import { useNavigate } from "react-router-dom";
import { NAV_ITEMS, NAV_SECTIONS, type NavItem, type Screen } from "./types";

interface Props {
  screen: Screen;
  active: boolean;
  jobBadgeCount: number;
  tourActiveScreen?: Screen | null;
  onNavClick: (item: NavItem) => void;
  onAfterNavigate?: () => void;
}

/** Sectioned app menu shared by the phone drawer and desktop sidebar. */
const GroupedNav: React.FC<Props> = ({ screen, active, jobBadgeCount, tourActiveScreen, onNavClick, onAfterNavigate }) => {
  const navigate = useNavigate();
  const click = (item: NavItem) => {
    if (item.href) { navigate(item.href); onAfterNavigate?.(); return; }
    onNavClick(item);
  };
  return (
    <nav className="flex w-full flex-1 flex-col gap-0.5 overflow-y-auto">
      {NAV_SECTIONS.map((sec) => {
        const items = NAV_ITEMS.filter((i) => (i.section ?? "main") === sec.id);
        if (!items.length) return null;
        return (
          <div key={sec.id} className="mb-2">
            {sec.title && (
              <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-primary/80">{sec.title}</p>
            )}
            {items.map((item) => {
              const isActive = !item.href && active && screen === item.screen;
              return (
                <button
                  key={item.label}
                  onClick={() => click(item)}
                  className={`relative flex w-full items-center gap-2 rounded-lg border-l-2 px-2 py-1.5 text-left text-xs font-medium transition-colors ${isActive ? "border-primary bg-secondary text-foreground" : "border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
                >
                  <span className={`text-sm ${tourActiveScreen === item.screen && !item.href ? "animate-pulse" : ""}`}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.screen === "opportunities" && jobBadgeCount > 0 && (
                    <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{jobBadgeCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
};

export default GroupedNav;
