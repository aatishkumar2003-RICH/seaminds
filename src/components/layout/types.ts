export type AppState = "loading" | "landing" | "name-entry" | "welcome" | "main" | "voyage-report";
export type Screen = "chat" | "dashboard" | "opportunities" | "news" | "academy" | "bridge" | "community" | "smc" | "resume" | "certs" | "resthours" | "vesselrating";

export interface NavItem {
  icon: string;
  label: string;
  screen: Screen;
  gated?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { icon: "💬", label: "Wellness Chat", screen: "chat", gated: true },
  { icon: "💼", label: "Jobs", screen: "opportunities" },
  { icon: "⏱", label: "Rest Hours", screen: "resthours", gated: true },
  { icon: "📄", label: "CV / Certificate", screen: "resume" },

  { icon: "🏆", label: "My Score", screen: "smc" },
  { icon: "📚", label: "Learn", screen: "academy" },

  { icon: "👥", label: "Community", screen: "community", gated: true },
  { icon: "📰", label: "News", screen: "news" },
];

export const NATIONALITY_FLAGS: Record<string, string> = {
  Filipino: "🇵🇭", Indian: "🇮🇳", Indonesian: "🇮🇩", Ukrainian: "🇺🇦", Russian: "🇷🇺",
  Chinese: "🇨🇳", Greek: "🇬🇷", British: "🇬🇧", Myanmar: "🇲🇲", Thai: "🇹🇭",
  Vietnamese: "🇻🇳", Pakistani: "🇵🇰", Bangladeshi: "🇧🇩", "Sri Lankan": "🇱🇰",
  Croatian: "🇭🇷", Polish: "🇵🇱", Turkish: "🇹🇷", Kiribati: "🇰🇮", Tuvalu: "🇹🇻",
  Fijian: "🇫🇯", Maldivian: "🇲🇻", Ghanaian: "🇬🇭", Nigerian: "🇳🇬",
};

export const DRAWER_WIDTH = 176; // w-44
