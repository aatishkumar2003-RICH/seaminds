import React from "react";
import MobileDrawer from "./MobileDrawer";
import MobileHeader from "./MobileHeader";
import SwipeHint from "./SwipeHint";
import { type NavItem, type Screen, type AppState } from "./types";

interface MobileChromeProps {
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
  showSwipeHint: boolean;
  onSwipeHintEnd: () => void;
  screen: Screen;
  appState: AppState;
  firstName: string;
  lastName: string;
  nationality: string;
  role: string;
  streakCount: number;
  jobBadgeCount: number;
  shipName: string;
  showBackToNews?: boolean;
  tourActiveScreen?: Screen | null;
  onNavClick: (item: NavItem) => void;
  onNavigateToNews: () => void;
  onReplayTour: () => void;
  onSignOut: () => void;
  onOpenChat: () => void;
}

const MobileChrome: React.FC<MobileChromeProps> = (props) => {
  const {
    drawerOpen, setDrawerOpen, isEdgeSwiping, edgeSwipeDelta,
    showSwipeHint, onSwipeHintEnd, showBackToNews = false,
    screen, onNavigateToNews, firstName,
  } = props;

  return (
    <>
      {/* Backdrop overlay */}
      {(drawerOpen || isEdgeSwiping) && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          style={{
            background: `rgba(0,0,0,${drawerOpen ? 0.5 : Math.min(0.5, edgeSwipeDelta / 288 * 0.5)})`,
            transition: !isEdgeSwiping ? "background 0.3s" : "none",
          }}
        />
      )}

      <SwipeHint
        visible={showSwipeHint}
        drawerOpen={drawerOpen}
        isEdgeSwiping={isEdgeSwiping}
        onAnimationEnd={onSwipeHintEnd}
      />

      <MobileDrawer {...props} />

      <MobileHeader
        onMenuOpen={() => setDrawerOpen(true)}
        showBackToNews={showBackToNews}
        screen={screen}
        onNavigateToNews={onNavigateToNews}
        firstName={firstName}
      />
    </>
  );
};

export default MobileChrome;
