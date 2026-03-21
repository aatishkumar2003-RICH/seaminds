import React from "react";
import { LogOut, HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import SOSButton from "@/components/SOSButton";
import { NAV_ITEMS, type NavItem, type Screen } from "./types";
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
  screen, streakCount, jobBadgeCount, firstName, shipName, tourActiveScreen,
  onNavClick, onReplayTour, onSignOut,
}) => {
  return (
    <aside className="hidden h-screen w-48 flex-shrink-0 flex-col items-center border-r border-border/60 bg-background/95 px-[2px] py-3 backdrop-blur-sm lg:flex">
      <div className="mb-3">
        <img src={seamindsLogo} alt="SeaMinds" className="h-7 w-7 rounded object-contain" />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = screen === item.screen;
          return (
            <Tooltip key={item.screen}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onNavClick(item)}
                  className={`relative flex w-full items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-accent text-primary"
                      : "border-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  }`}
                >
                  <span className={tourActiveScreen === item.screen ? "animate-pulse" : ""}>{item.icon}</span>
                  <span className="text-xs font-medium">{item.label}</span>
                  {tourActiveScreen === item.screen && (
                    <span className="absolute inset-0 rounded-md bg-primary animate-ping opacity-15" />
                  )}
                  {item.screen === "opportunities" && jobBadgeCount > 0 && (
                    <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[7px] font-bold text-primary-foreground">
                      {jobBadgeCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-start gap-1 w-full px-2">
        <div className="text-xs font-semibold text-foreground truncate w-full">{firstName || "Seafarer"}</div>
        <div className="text-[11px] text-muted-foreground">🔥 {streakCount} day streak</div>
        <button onClick={onReplayTour} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground">
          <HelpCircle size={14} />
          <span>Replay Tour</span>
        </button>
        <button onClick={onSignOut} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground">
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
        <div className="w-full">
          <SOSButton onOpenChat={() => onNavClick({ icon: "💬", label: "Chat", screen: "chat", gated: true })} firstName={firstName} shipName={shipName} inline />
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
