import React, { useState } from "react";
import AboutSeaMinds from "@/components/AboutSeaMinds";
import { LogOut, HelpCircle, X, BookOpen, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { checkPwaUpdate, forcePwaHardReset } from "@/lib/pwaUpdate";
import SOSButton from "@/components/SOSButton";
import seamindsLogo from "@/assets/seaminds-logo.png";
import { NATIONALITY_FLAGS, type NavItem, type Screen, type AppState } from "./types";
import GroupedNav from "./GroupedNav";

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
  tourActiveScreen?: Screen | null;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({
  drawerOpen, setDrawerOpen, isSwiping, isEdgeSwiping,
  touchDelta, edgeSwipeDelta, touchStart, setTouchStart, setTouchDelta, setIsSwiping,
  screen, appState, firstName, lastName, nationality, role,
   jobBadgeCount, onNavClick, onReplayTour, onSignOut, onOpenChat, shipName, tourActiveScreen,
}) => {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const { newer, remote } = await checkPwaUpdate();
      if (newer) {
        toast.success("Update available — installing…"); void remote;
        await forcePwaHardReset();
      } else {
        toast("You're on the latest version", { action: { label: "Force refresh", onClick: () => void forcePwaHardReset() } });
      }
    } catch {
      toast.error("Couldn't check for updates. Try again with internet.");
    } finally {
      setChecking(false);
    }
  };
  return (
    <div
      className={`fixed top-0 left-0 z-50 flex h-[100dvh] w-[82vw] max-w-[300px] flex-col rounded-r-2xl border-r border-primary/30 bg-background/98 px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md lg:hidden ${!isSwiping && !isEdgeSwiping ? "transition-transform duration-300 ease-in-out" : ""}`}
      style={{
        transform: drawerOpen
          ? `translateX(${Math.min(0, touchDelta)}px)`
          : isEdgeSwiping && edgeSwipeDelta > 0
            ? `translateX(calc(-100% + ${edgeSwipeDelta}px))`
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
      <div className="mb-3 flex shrink-0 items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
        <img src={seamindsLogo} alt="SeaMinds" className="h-6 w-6 rounded object-contain" />
        <span className="truncate text-sm font-bold text-foreground/80">SeaMinds</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="icon" onClick={handleCheckUpdate} disabled={checking} aria-label="Check for update" title="Check for update" className="h-9 w-9 rounded-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
            <RefreshCw aria-hidden="true" className={checking ? "animate-spin" : ""} />
          </Button>
          <Button variant="outline" size="icon" onClick={onSignOut} aria-label="Sign Out" title="Sign Out" className="h-9 w-9 rounded-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="mb-3 flex shrink-0 items-start gap-1 rounded-xl border border-primary/30 bg-card/60 p-2">
        <Link to="/profile" onClick={() => setDrawerOpen(false)} aria-label="Open My Sea Profile" className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-lg">{NATIONALITY_FLAGS[nationality] || "🌊"}</span>
            <span className="min-w-0 line-clamp-2 break-words text-sm font-semibold text-foreground" title={`${firstName} ${lastName}`}>{firstName || "Seafarer"} {lastName}</span>
          </span>
          {role && <span className="truncate text-[11px] text-muted-foreground">{role}</span>}
          <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-semibold text-primary">👤 My Sea Profile</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} aria-label="Close menu" title="Close menu" className="h-8 w-8 shrink-0 text-muted-foreground"><X aria-hidden="true" /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <GroupedNav screen={screen} active={appState === "main"} jobBadgeCount={jobBadgeCount} tourActiveScreen={tourActiveScreen} onNavClick={onNavClick} onAfterNavigate={() => setDrawerOpen(false)} />
      <div className="flex flex-col gap-1 pt-2">
        <Button asChild variant="ghost" size="sm" className="text-xs text-primary"><Link to="/guide?role=crew" onClick={() => setDrawerOpen(false)}><BookOpen />User Guide</Link></Button>
        <button onClick={onReplayTour} className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <HelpCircle size={14} /> Replay Tour
        </button>
        <button onClick={() => setAboutOpen(true)} className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          ⓘ About SeaMinds
        </button>
        <div className="w-full">
          <SOSButton onOpenChat={onOpenChat} firstName={firstName} shipName={shipName} inline />
        </div>
      </div>
      </div>
      {aboutOpen && <AboutSeaMinds onClose={() => setAboutOpen(false)} />}
    </div>
  );
};

export default MobileDrawer;
