import React from "react";
import { LogOut, HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import SOSButton from "@/components/SOSButton";
import { NAV_ITEMS, type NavItem, type Screen } from "./types";

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
    <aside className="hidden h-screen w-[2.75rem] flex-shrink-0 flex-col items-center border-r border-white/5 bg-background/95 px-[2px] py-3 backdrop-blur-sm lg:flex">
      <div className="mb-3">
        <span className="rounded bg-secondary px-1 py-0.5 text-[10px] font-bold text-foreground/80">SM</span>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = screen === item.screen;
          return (
            <Tooltip key={item.screen}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onNavClick(item)}
                  className="relative flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors"
                  style={{
                    background: active ? "rgba(255,255,255,0.1)" : "transparent",
                    borderLeft: active ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span className={tourActiveScreen === item.screen ? "animate-pulse" : ""}>{item.icon}</span>
                  {tourActiveScreen === item.screen && (
                    <span className="absolute inset-0 rounded-md animate-ping opacity-15 bg-primary" />
                  )}
                  {item.screen === "opportunities" && jobBadgeCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground">
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
