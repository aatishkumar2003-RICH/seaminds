import React from "react";

interface SwipeHintProps {
  visible: boolean;
  drawerOpen: boolean;
  isEdgeSwiping: boolean;
  onAnimationEnd: () => void;
}

const SwipeHint: React.FC<SwipeHintProps> = ({ visible, drawerOpen, isEdgeSwiping, onAnimationEnd }) => {
  if (!visible || drawerOpen || isEdgeSwiping) return null;

  return (
    <div
      className="fixed left-0 top-1/2 z-30 -translate-y-1/2 pointer-events-none lg:hidden"
      style={{ animation: "swipeHintPulse 2s ease-in-out 3" }}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="flex items-center gap-1 rounded-r-full bg-gradient-to-r from-secondary/60 to-transparent pl-1 pr-3 py-3">
        <div className="h-10 w-1 rounded-full bg-foreground/40" />
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-foreground/50">
          <path d="M8 4L14 10L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};

export default SwipeHint;
