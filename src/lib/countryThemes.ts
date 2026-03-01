export interface CountryTheme {
  accent: string;
  pattern?: string;
}

const COUNTRY_THEMES: Record<string, CountryTheme> = {
  PH: { accent: "#0038A8", pattern: "radial-gradient(circle at 70% 30%, rgba(255,205,0,0.06) 0%, transparent 50%)" },
  ID: { accent: "#CE1126" },
  VN: { accent: "#DA251D", pattern: "radial-gradient(circle at 50% 50%, rgba(255,218,0,0.05) 0%, transparent 40%)" },
  IN: { accent: "#FF9933" },
  UA: { accent: "#005BBB" },
  CN: { accent: "#DE2910", pattern: "radial-gradient(circle at 20% 20%, rgba(255,222,0,0.05) 0%, transparent 35%)" },
  GR: { accent: "#0D5EAF" },
  NG: { accent: "#008751" },
  MM: { accent: "#FECB00" },
  RU: { accent: "#D52B1E" },
};

const DEFAULT_THEME: CountryTheme = { accent: "#0D1B2A" };

export function getCountryTheme(countryCode: string | undefined): CountryTheme {
  if (!countryCode) return DEFAULT_THEME;
  return COUNTRY_THEMES[countryCode.toUpperCase()] || DEFAULT_THEME;
}

export function countryToFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}
