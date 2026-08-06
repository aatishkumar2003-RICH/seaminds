import React from "react";
import { type Screen, type NavItem } from "./types";

interface Props {
  screen: Screen;
  jobBadgeCount: number;
  onNavClick: (item: NavItem) => void;
  onMore: () => void;
}

const TABS: { icon: string; label: string; screen: Screen; gated?: boolean }[] = [
  { icon: "🏠", label: "Home", screen: "home" },
  { icon: "💼", label: "Jobs", screen: "opportunities" },
  { icon: "💬", label: "Chat", screen: "chat", gated: true },
  { icon: "📄", label: "CV / Cert", screen: "resume" },
];

const BottomNav: React.FC<Props> = ({ screen, jobBadgeCount, onNavClick, onMore }) => (
  <nav
    className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
    style={{
      background: "#0D1B2A",
      borderTop: "1px solid #1e3a5f",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}
  >
    {TABS.map((t) => {
      const active = screen === t.screen;
      return (
        <button
          key={t.screen}
          onClick={() => onNavClick(t as NavItem)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <span style={{ fontSize: 19, lineHeight: 1, opacity: active ? 1 : 0.55 }}>{t.icon}</span>
          <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, color: active ? "#D4AF37" : "#94a3b8" }}>
            {t.label}
          </span>
          {t.screen === "opportunities" && jobBadgeCount > 0 && (
            <span style={{
              position: "absolute", top: 4, right: "50%", marginRight: -18,
              background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800,
              minWidth: 15, height: 15, borderRadius: 999, display: "flex",
              alignItems: "center", justifyContent: "center", padding: "0 3px",
            }}>{jobBadgeCount}</span>
          )}
        </button>
      );
    })}
    <button
      onClick={onMore}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
      style={{ background: "transparent", border: "none", cursor: "pointer" }}
    >
      <span style={{ fontSize: 19, lineHeight: 1, opacity: 0.55 }}>☰</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>More</span>
    </button>
  </nav>
);

export default BottomNav;
