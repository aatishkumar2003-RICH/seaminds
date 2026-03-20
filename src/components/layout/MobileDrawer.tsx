import React from "react";
import { LogOut, HelpCircle } from "lucide-react";
import SOSButton from "@/components/SOSButton";
import { NAV_ITEMS, NATIONALITY_FLAGS, type NavItem, type Screen, type AppState } from "./types";

interface MobileDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  isSwiping: boolean;
  isEdgeSwiping: boolean;
  touchDelta: number;
  edgeSwipeDelta: number;
  touchStart: number | null;
  setTouchStart: (v: number | null) => void;
  setTouchDelta: (v: number) => void;
  setIsSwiping: (v: boolean) => void;
  screen: Screen;
  appState: AppState;
  firstName: string;
  lastName: string;
  nationality: string;
  role: string;
  streakCount: number;
  jobBadgeCount: number;
  onNavClick: (item: NavItem) => void;
  onReplayTour: () => void;
  onSignOut: () => void;
  onOpenChat: () => void;
  shipName: string;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({
  drawerOpen, setDrawerOpen, isSwiping, isEdgeSwiping,
  touchDelta, edgeSwipeDelta, touchStart, setTouchStart, setTouchDelta, setIsSwiping,
  screen, appState, firstName, lastName, nationality, role,
  streakCount, jobBadgeCount, onNavClick, onReplayTour, onSignOut, onOpenChat, shipName,
}) => {
  return (
    <div
      className={`fixed top-0 left-0 z-50 h-full w-44 border-r border-border/40 bg-background/95 px-2.5 py-5 backdrop-blur-sm lg:hidden ${!isSwiping && !isEdgeSwiping ? "transition-transform duration-300 ease-in-out" : ""}`}
      style={{
        transform: drawerOpen
          ? `translateX(${Math.min(0, touchDelta)}px)`
          : isEdgeSwiping && edgeSwipeDelta > 0
            ? `translateX(${-176 + edgeSwipeDelta}px)`
            : "translateX(-100%)",
      }}
      onTouchStart={(e) => {
        setTouchStart(e.touches[0].clientX);
        setIsSwiping(true);
      }}
      onTouchMove={(e) => {
        if (touchStart === null) return;
        const delta = e.touches[0].clientX - touchStart;
        if (delta < 0) setTouchDelta(delta);
      }}
      onTouchEnd={() => {
        if (touchDelta < -80) setDrawerOpen(false);
        setTouchStart(null);
        setTouchDelta(0);
        setIsSwiping(false);
      }}
    >
      <button onClick={() => setDrawerOpen(false)} className="absolute right-4 top-4 text-lg text-muted-foreground transition-colors hover:text-foreground">✕</button>
      <div className="mb-4 flex items-center gap-1">
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-bold text-foreground/80">SM</span>
        <span className="text-sm font-bold text-foreground/80">SeaMinds</span>
      </div>
      <div className="mb-6 flex items-center gap-2 px-1">
        <span className="text-lg">{NATIONALITY_FLAGS[nationality] || "🌊"}</span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{firstName || "Seafarer"} {lastName}</span>
          {role && <span className="text-xs text-muted-foreground">{role}</span>}
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = screen === item.screen && appState === "main";
          return (
            <button
              key={item.screen}
              onClick={() => onNavClick(item)}
              className={`flex w-full items-center gap-2 rounded-lg border-l-2 px-2 py-2 text-left text-xs font-medium transition-colors ${active ? "border-primary bg-secondary text-foreground" : "border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
            >
              <span className="text-sm">{item.icon}</span>
              <span>{item.label}</span>
              {item.screen === "opportunities" && jobBadgeCount > 0 && (
                <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{jobBadgeCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2 rounded-full bg-secondary/70 py-1.5 text-xs font-medium text-muted-foreground">
          🔥 {streakCount} day streak
        </div>
        <button onClick={onReplayTour} className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <HelpCircle size={14} /> Replay Tour
        </button>
        <button onClick={onSignOut} className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <LogOut size={14} /> Sign Out
        </button>
        <div className="w-full">
          <SOSButton onOpenChat={onOpenChat} firstName={firstName} shipName={shipName} inline />
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
