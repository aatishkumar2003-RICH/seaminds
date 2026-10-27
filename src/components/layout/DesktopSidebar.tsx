import React, { useState } from "react";
import AboutSeaMinds from "@/components/AboutSeaMinds";
import { LogOut, HelpCircle, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import SOSButton from "@/components/SOSButton";
import { type NavItem, type Screen } from "./types";
import GroupedNav from "./GroupedNav";
import seamindsLogo from "@/assets/seaminds-logo.png";

interface DesktopSidebarProps {
  screen: Screen;
  streakCount: number;
  jobBadgeCount: number;
  firstName: string;
  shipName: string;
  tourActiveScreen?: Screen | null;
  onNavClick: (item: NavItem) => void;
  onReplayTour: () => void;
  onSignOut: () => void;
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  screen, jobBadgeCount, firstName, shipName, tourActiveScreen,
  onNavClick, onReplayTour, onSignOut,
}) => {
  const [aboutOpen, setAboutOpen] = useState(false);
  return (
    <aside className="hidden h-screen w-48 flex-shrink-0 flex-col items-center border-r border-border/60 bg-background/95 px-[2px] py-3 backdrop-blur-sm lg:flex">
      <div className="mb-3 flex w-full items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-1.5">
        <img src={seamindsLogo} alt="SeaMinds" className="h-7 w-7 rounded object-contain" />
        <span className="text-sm font-bold text-foreground">SeaMinds</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={onSignOut} aria-label="Sign Out" title="Sign Out" className="h-11 w-11 shrink-0 rounded-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
              <LogOut aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign Out</TooltipContent>
        </Tooltip>
      </div>

      <Link to="/profile" aria-label="Open My Sea Profile" className="mb-2 flex w-full flex-col gap-1 rounded-xl border border-primary/30 bg-card/60 px-2 py-2 hover:border-primary/60">
        <span className="truncate text-sm font-semibold text-foreground">{firstName || "Seafarer"}</span>
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-semibold text-primary">👤 My Sea Profile</span>
      </Link>

      <GroupedNav screen={screen} active jobBadgeCount={jobBadgeCount} tourActiveScreen={tourActiveScreen} onNavClick={onNavClick} />

      <div className="mt-auto flex flex-col items-start gap-1 w-full px-2">
        <Button asChild variant="ghost" size="sm" className="w-full justify-start px-2 text-xs text-primary"><Link to="/guide?role=crew"><BookOpen />User Guide</Link></Button>
        <button onClick={onReplayTour} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground">
          <HelpCircle size={14} />
          <span>Replay Tour</span>
        </button>
        <button onClick={() => setAboutOpen(true)} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground">
          <span>ⓘ</span><span>About SeaMinds</span>
        </button>
        {aboutOpen && <AboutSeaMinds onClose={() => setAboutOpen(false)} />}
        <div className="w-full">
          <SOSButton onOpenChat={() => onNavClick({ icon: "💬", label: "Chat", screen: "chat", gated: true })} firstName={firstName} shipName={shipName} inline />
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
