export type AppState = "loading" | "landing" | "name-entry" | "welcome" | "main" | "voyage-report";
export type Screen = "chat" | "dashboard" | "opportunities" | "news" | "academy" | "bridge" | "community" | "smc" | "resume" | "certs" | "resthours" | "vesselrating";

export interface NavItem {
  icon: string;
  label: string;
  screen: Screen;
  gated?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { icon: "💬", label: "Chat", screen: "chat", gated: true },
  { icon: "❤️", label: "Welfare", screen: "dashboard", gated: true },
  { icon: "⏱", label: "Rest Hours", screen: "resthours", gated: true },
  { icon: "💼", label: "Jobs", screen: "opportunities" },
  { icon: "📄", label: "CV", screen: "resume" },
  { icon: "📰", label: "News", screen: "news" },
  { icon: "🎓", label: "Academy", screen: "academy" },
  { icon: "🔧", label: "PMS", screen: "bridge" },
  { icon: "👥", label: "Community", screen: "community", gated: true },
  { icon: "🏆", label: "SMC", screen: "smc" },
  { icon: "📜", label: "Certs", screen: "certs" },
];

export const NATIONALITY_FLAGS: Record<string, string> = {
  Filipino: "🇵🇭", Indian: "🇮🇳", Indonesian: "🇮🇩", Ukrainian: "🇺🇦", Russian: "🇷🇺",
  Chinese: "🇨🇳", Greek: "🇬🇷", British: "🇬🇧", Myanmar: "🇲🇲", Thai: "🇹🇭",
  Vietnamese: "🇻🇳", Pakistani: "🇵🇰", Bangladeshi: "🇧🇩", "Sri Lankan": "🇱🇰",
  Croatian: "🇭🇷", Polish: "🇵🇱", Turkish: "🇹🇷", Kiribati: "🇰🇮", Tuvalu: "🇹🇻",
  Fijian: "🇫🇯", Maldivian: "🇲🇻", Ghanaian: "🇬🇭", Nigerian: "🇳🇬",
};

export const DRAWER_WIDTH = 176; // w-44
