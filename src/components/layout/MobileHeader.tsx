import React from "react";
import { type Screen, type AppState } from "./types";
import seamindsLogo from "@/assets/seaminds-logo.png";

interface MobileHeaderProps {
  onMenuOpen: () => void;
  showBackToNews: boolean;
  screen: Screen;
  onNavigateToNews: () => void;
  firstName: string;
  appState?: AppState;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  onMenuOpen, showBackToNews, screen, onNavigateToNews, firstName, appState,
}) => {
  if (appState === "landing") return null;

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-background px-4 py-2 lg:hidden">
      <div className="flex items-center gap-2">
        <button onClick={onMenuOpen} className="p-1 text-xl font-bold text-foreground">☰</button>
        {showBackToNews && screen !== "news" && (
          <button onClick={onNavigateToNews} className="p-1 text-lg text-muted-foreground">←</button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <img src={seamindsLogo} alt="SeaMinds" className="h-6 w-6 rounded-full object-contain" />
        <span className="text-sm font-bold text-foreground">SeaMinds</span>
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
        <span className="text-xs font-bold text-primary">{firstName?.[0] || "C"}</span>
      </div>
    </div>
  );
};

export default MobileHeader;
