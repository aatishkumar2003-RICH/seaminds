export type AppState = "loading" | "landing" | "name-entry" | "welcome" | "main" | "voyage-report";
export type Screen = "home" | "chat" | "dashboard" | "opportunities" | "news" | "academy" | "bridge" | "community" | "smc" | "resume" | "certs" | "resthours" | "vesselrating" | "support";

export type NavSection = "main" | "cockpit" | "career" | "market" | "help";

export interface NavItem {
  icon: string;
  label: string;
  screen: Screen;
  gated?: boolean;
  /** Standalone page route — when set, the item navigates here instead of switching screens. */
  href?: string;
  section?: NavSection;
}

export const NAV_SECTIONS: { id: NavSection; title: string }[] = [
  { id: "main", title: "" },
  { id: "cockpit", title: "Sailor's Cockpit" },
  { id: "career", title: "Career" },
  { id: "market", title: "Marketplace & News" },
  { id: "help", title: "Help" },
];

export const NAV_ITEMS: NavItem[] = [
  { icon: "🏠", label: "Home", screen: "home", section: "main" },
  { icon: "🧭", label: "Cockpit Overview", screen: "home", href: "/cockpit", section: "cockpit" },
  { icon: "⏱", label: "Rest Hours", screen: "resthours", gated: true, section: "cockpit" },
  { icon: "💬", label: "Wellness Chat", screen: "chat", gated: true, section: "cockpit" },
  { icon: "🛡️", label: "Safety & Crew Tools", screen: "community", gated: true, section: "cockpit" },
  { icon: "💼", label: "Jobs", screen: "opportunities", section: "career" },
  { icon: "📄", label: "CV / Certificate", screen: "resume", section: "career" },
  { icon: "🏆", label: "My Score", screen: "smc", section: "career" },
  { icon: "🎓", label: "Training & Research", screen: "academy", section: "career" },
  { icon: "🚢", label: "Ship Marketplace", screen: "home", href: "/marketplace", section: "market" },
  { icon: "📰", label: "News", screen: "news", section: "market" },
  { icon: "🛟", label: "Help & Support", screen: "support", section: "help" },
];

export const NATIONALITY_FLAGS: Record<string, string> = {
  Filipino: "🇵🇭", Indian: "🇮🇳", Indonesian: "🇮🇩", Ukrainian: "🇺🇦", Russian: "🇷🇺",
  Chinese: "🇨🇳", Greek: "🇬🇷", British: "🇬🇧", Myanmar: "🇲🇲", Thai: "🇹🇭",
  Vietnamese: "🇻🇳", Pakistani: "🇵🇰", Bangladeshi: "🇧🇩", "Sri Lankan": "🇱🇰",
  Croatian: "🇭🇷", Polish: "🇵🇱", Turkish: "🇹🇷", Kiribati: "🇰🇮", Tuvalu: "🇹🇻",
  Fijian: "🇫🇯", Maldivian: "🇲🇻", Ghanaian: "🇬🇭", Nigerian: "🇳🇬",
};

export const DRAWER_WIDTH = 192; // w-48
