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

      <div className="mt-auto flex flex-col items-center gap-1.5">
        <div className="text-[10px] font-medium text-foreground/80 truncate w-full text-center">{firstName || "Seafarer"}</div>
        <div className="text-[9px] text-muted-foreground">🔥{streakCount}</div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onReplayTour} className="p-0.5 text-muted-foreground transition-colors hover:text-foreground">
              <HelpCircle size={12} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Replay Tour</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onSignOut} className="p-0.5 text-muted-foreground transition-colors hover:text-foreground">
              <LogOut size={12} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Sign Out</TooltipContent>
        </Tooltip>
        <div className="w-full">
          <SOSButton onOpenChat={() => onNavClick({ icon: "💬", label: "Chat", screen: "chat", gated: true })} firstName={firstName} shipName={shipName} inline />
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
