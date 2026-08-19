import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en, { type Dict } from "./en";
import id from "./id";
import tl from "./tl";
import hi from "./hi";
import vi from "./vi";

export const LANGS = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "tl", label: "Filipino" },
  { code: "hi", label: "हिन्दी" },
  { code: "vi", label: "Tiếng Việt" },
] as const;

export type LangCode = (typeof LANGS)[number]["code"];

const DICTS: Record<LangCode, Dict> = { en, id, tl, hi, vi };

const STORE_KEY = "sm_lang";

/** Device language, only if it maps to a supported code. Filipino ships as tl/fil. */
const deviceLang = (): LangCode => {
  const raw = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  const base = raw.split("-")[0];
  if (base === "fil" || base === "tl") return "tl";
  return (LANGS.some((l) => l.code === base) ? base : "en") as LangCode;
};

const readStored = (): LangCode | null => {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v === "fil") return "tl";
    return v && LANGS.some((l) => l.code === v) ? (v as LangCode) : null;
  } catch {
    return null;
  }
};

type Ctx = { lang: LangCode; setLang: (c: LangCode) => void; t: (k: keyof Dict) => string };

const I18nContext = createContext<Ctx | null>(null);

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  // Stored choice wins; otherwise suggest the device language but do NOT persist it
  // until the user confirms by picking a language.
  const [lang, setLangState] = useState<LangCode>(() => readStored() ?? deviceLang());

  const setLang = useCallback((c: LangCode) => {
    setLangState(c);
    try { localStorage.setItem(STORE_KEY, c); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[lang] || en;
    return { lang, setLang, t: (k: keyof Dict) => dict[k] ?? en[k] };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useT = (): Ctx => {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Safe fallback when used outside the provider (e.g. isolated tests).
  return { lang: "en", setLang: () => {}, t: (k: keyof Dict) => en[k] };
};
