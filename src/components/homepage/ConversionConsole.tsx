import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, ChevronDown, X, Menu, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import seamindsLogo from "@/assets/seaminds-logo.png";
import { useT, LANGS, type LangCode } from "@/i18n";


const GOLD = "#D4AF37";
const GREEN = "#22c55e";
const NAVY = "#0D1B2A";
const PANEL = "#112240";
const BORDER = "rgba(212,175,55,0.3)";

type Index = { name: string; total: number; new_24h: number; direction: string; status: string };
type Market = {
  total: number;
  new_24h: number;
  countries: number;
  indices: Index[];
  top_ranks: string[];
  top_ranks_counted?: { rank: string; count: number }[];
};
type Vacancy = {
  id: string;
  title: string | null;
  rank_required: string | null;
  vessel_type: string | null;
  joining_port: string | null;
  salary_min: number | null;
  salary_text: string | null;
  description: string | null;
  source: string | null;
  fetched_at: string | null;
  first_seen_at: string | null;
};

const isNew = (v: Vacancy) => {
  const d = v.first_seen_at || v.fetched_at;
  return !!d && Date.now() - new Date(d).getTime() < 24 * 3600 * 1000;
};
const isUrgent = (v: Vacancy) => /urgent|immediate/i.test(`${v.title || ""} ${v.description || ""}`);
const relTime = (d?: string | null) => {
  if (!d) return "";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};
const idxOf = (m: Market | null, name: string) => (m?.indices || []).find((i) => i.name === name);

const MARKETS = ["DECK", "ENGINE", "ETO", "RATINGS", "OFFSHORE"] as const;
const MARKET_KEYWORDS: Record<string, RegExp> = {
  DECK: /master|captain|chief officer|c\/o|2\/o|3\/o|second officer|third officer|deck/i,
  ENGINE: /engineer|c\/e|2\/e|3\/e|4\/e|motorman|oiler|engine/i,
  ETO: /eto|electr/i,
  RATINGS: /bosun|able seaman|\bab\b|\bos\b|ordinary seaman|cook|steward|fitter|wiper|rating/i,
  OFFSHORE: /offshore|osv|ahts|psv|dp|rig|platform/i,
};
const inMarket = (v: Vacancy, m: string) => {
  const hay = `${v.rank_required || ""} ${v.title || ""} ${v.vessel_type || ""}`;
  return MARKET_KEYWORDS[m]?.test(hay) ?? true;
};

const MENU_LINKS: { label: string; to: string; external?: boolean }[] = [
  { label: "For Seafarers", to: "/join" },
  { label: "Find Crew — For Companies", to: "/for-companies" },
  { label: "Post Vacancy", to: "/manager" },
  { label: "Create AI Interview", to: "/for-companies" },
  { label: "Manager Login", to: "/manager" },
  { label: "SMC Score", to: "/app?tab=smc" },
  { label: "Jobs", to: "/app?tab=jobs" },
  { label: "Blog", to: "/blog" },
  { label: "Pricing", to: "/pricing" },
  { label: "Colleges", to: "/colleges" },
  { label: "Privacy", to: "/privacy" },
  { label: "Contact", to: "mailto:info@indossol.com", external: true },
];

const ConversionConsole = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang, setLang } = useT();
  const [market, setMarket] = useState<Market | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [profileActive, setProfileActive] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [myMarket, setMyMarket] = useState<string>(() => localStorage.getItem("sm_my_market") || "");
  const [sheet, setSheet] = useState<Vacancy | null>(null);
  const [wire, setWire] = useState<{ kind: string; text: string; ts: string }[]>([]);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_trade_log" as never, { p_limit: 14 } as never);
      if (!alive || error || !Array.isArray(data)) return;
      setWire(data as { kind: string; text: string; ts: string }[]);
    })();
    return () => { alive = false; };
  }, []);




  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: m }, { data: v }] = await Promise.all([
        supabase.rpc("get_market_indices" as never),
        supabase
          .from("external_vacancies")
          .select("id,title,rank_required,vessel_type,joining_port,salary_min,salary_text,description,source,fetched_at,first_seen_at")
          .gt("expires_at", new Date().toISOString())
          .order("fetched_at", { ascending: false })
          .limit(25),
      ]);
      if (!alive) return;
      if (m) setMarket(m as unknown as Market);
      setVacancies((v as Vacancy[]) || []);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user) { setProfileActive(false); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("crew_profiles")
        .select("quick_profile_completed_at" as never)
        .eq("id", user.id)
        .maybeSingle();
      if (alive) setProfileActive(!!(data as { quick_profile_completed_at?: string } | null)?.quick_profile_completed_at);
    })();
    return () => { alive = false; };
  }, [user]);

  const pickLang = (code: LangCode) => {
    setLang(code);
    setLangOpen(false);
  };

  const topRanks = useMemo(() => {
    const counted = market?.top_ranks_counted || [];
    return counted.slice(0, 4);
  }, [market]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vacancies.filter((v) => {
      if (myMarket && !inMarket(v, myMarket)) return false;
      if (!q) return true;
      return `${v.rank_required || ""} ${v.title || ""} ${v.vessel_type || ""} ${v.joining_port || ""}`.toLowerCase().includes(q);
    });
  }, [vacancies, query, myMarket]);

  const suggestion = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    if (/cv|resume|profile/.test(q)) return { label: "Build my Sea Profile →", to: "/quick-profile" };
    if (/interview|ai|smc|score/.test(q)) return { label: "AI Interview & SMC Score →", to: "/app?tab=smc" };
    return null;
  }, [query]);

  const toggleMarket = (m: string) => {
    const next = myMarket === m ? "" : m;
    setMyMarket(next);
    if (next) localStorage.setItem("sm_my_market", next);
    else localStorage.removeItem("sm_my_market");
  };

  const langLabel = LANGS.find((l) => l.code === lang)?.label || "English";
  const total = market?.total ?? null;

  const dock = [
    { key: "jobs", label: t("dockJobs"), value: total === null ? "…" : String(total), to: "/app?tab=jobs" },
    { key: "profile", label: t("dockProfile"), value: profileActive ? "✓" : t("dockStart"), to: "/quick-profile" },
    { key: "ai", label: t("dockAi"), value: t("dockTry"), to: "/app?tab=smc" },
    { key: "feed", label: t("dockFeed"), value: t("dockOpen"), to: "/app?tab=home" },
    { key: "market", label: t("dockMarket"), value: t("dockLive"), to: "/app?tab=news" },
  ];

  return (
    <div className="relative" style={{ background: NAVY }}>
      <style>{`
        @keyframes sm-pulse-cta { 0%,100% { box-shadow: 0 0 0 0 rgba(212,175,55,.45) } 50% { box-shadow: 0 0 0 12px rgba(212,175,55,0) } }
        .sm-cta-pulse { animation: sm-pulse-cta 2.4s ease-out infinite; }
        @keyframes sm-tape { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .sm-tape-track { animation: sm-tape 40s linear infinite; }
        .sm-tape:hover .sm-tape-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .sm-cta-pulse, .sm-dot, .sm-tape-track { animation: none !important; } }
      `}</style>

      {/* 1. HEADER */}
      <header className="sticky top-0 z-40 border-b relative" style={{ height: 86, borderColor: "rgba(255,255,255,0.06)", background: NAVY }}>
        <button
          type="button"
          aria-label="Team access"
          onClick={() => navigate("/marketing")}
          className="absolute top-1 right-1 z-50 rounded-full transition-colors"
          style={{ width: 8, height: 8, background: "rgba(255,255,255,0.12)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.6)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; }}
        />
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">

          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2">
            <img src={seamindsLogo} alt="SeaMinds" className="w-9 h-9" />
            <span className="text-lg font-bold text-foreground">SeaMinds</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 mr-1 text-[11px] font-semibold">
              <button type="button" onClick={() => navigate("/for-companies")} className="text-muted-foreground hover:text-foreground">Find Crew</button>
              <span className="text-muted-foreground/40">·</span>
              <button type="button" onClick={() => navigate("/manager")} className="text-muted-foreground hover:text-foreground">Manager Login</button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => { setLangOpen((o) => !o); setMarketOpen(false); }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8" }}
              >
                <Globe className="w-3.5 h-3.5" /> {langLabel} <ChevronDown className="w-3 h-3" />
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl p-1 z-50" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => pickLang(l.code)}
                      className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/5"
                      style={{ color: l.code === lang ? GOLD : "#E2E8F0" }}
                    >
                      {l.label}{l.code === lang ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => { setMarketOpen((o) => !o); setLangOpen(false); }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8" }}
              >
                🌍 {t("worldwide")} <ChevronDown className="w-3 h-3" />
              </button>
              {marketOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl p-2 z-50" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
                  <p className="px-2 py-1.5 text-xs font-semibold" style={{ color: GOLD }}>{t("worldwide")} ✓</p>
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("marketsSoon")}</p>
                  <p className="px-2 pb-1 text-[10px] text-muted-foreground/70">{t("marketsNote")}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label="Open menu"
              onClick={() => { setMenuOpen(true); setLangOpen(false); setMarketOpen(false); }}
              className="rounded-lg p-2"
              style={{ border: "1px solid rgba(255,255,255,0.12)", color: GOLD }}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-in menu drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70]" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setMenuOpen(false)}>
          <nav
            aria-label="Site menu"
            className="absolute right-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto p-4"
            style={{ background: PANEL, borderLeft: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-foreground">Menu</span>
              <button type="button" aria-label={t("close")} onClick={() => setMenuOpen(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <ul className="space-y-1">
              {MENU_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.to}
                    onClick={(e) => {
                      if (l.external) return;
                      e.preventDefault();
                      setMenuOpen(false);
                      navigate(l.to);
                    }}
                    className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}


      {/* 2. QUICK DOCK */}
      <div className="border-b" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-5" style={{ height: 58 }}>
          {dock.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => navigate(d.to)}
              className="flex flex-col items-center justify-center gap-0.5 border-r last:border-r-0"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <span className="font-mono text-sm font-bold" style={{ color: GOLD }}>{d.value}</span>
              <span className="text-[9px] tracking-wider text-muted-foreground">{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. LIVE PROOF BAR */}
      <button
        type="button"
        onClick={() => navigate("/app?tab=jobs")}
        className="w-full border-b text-left"
        style={{ borderColor: "rgba(212,175,55,0.15)", background: "rgba(6,15,29,0.9)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ minHeight: 60 }}>
          <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider" style={{ color: GREEN }}>
            <span className="sm-dot w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
            SMX {t("live")}
          </span>
          <span className="font-mono text-[11px]" style={{ color: GOLD }}>
            {market ? `${market.total} ${t("jobsWord")} · +${market.new_24h} ${t("today")}` : t("loading")}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {market
              ? ["ENGINE", "ETO", "DECK"].map((n) => {
                  const ix = idxOf(market, n);
                  if (!ix) return null;
                  return ix.new_24h > 0 ? `${n} +${ix.new_24h}▲` : `${n} ${ix.total}`;
                }).filter(Boolean).join(" · ")
              : ""}
          </span>
        </div>
      </button>

      {/* 4. CONVERSION HERO */}
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-4 text-center">
        <h1 className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Seafarer Jobs &amp; Maritime Vacancies — Crew Recruitment &amp; AI Competency Platform
        </h1>
        <p className="text-[11px] tracking-widest text-muted-foreground mb-2">{t("heroKicker")}</p>
        <h2 className="sm-hero-gradient text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-3">
          {t("heroTitle")}
        </h2>

        <div className="inline-flex items-center rounded-xl overflow-hidden mb-1" style={{ border: `1px solid ${BORDER}` }}>
          {[t("stepProfile"), t("stepMatch"), t("stepApply"), t("stepInterview")].map((s, i) => (
            <span
              key={s}
              className="px-2.5 py-1.5 text-[10px] font-bold tracking-wide"
              style={{ color: "#E2E8F0", borderLeft: i ? "1px solid rgba(212,175,55,0.25)" : undefined }}
            >
              {s}
            </span>
          ))}
        </div>
        <p className="text-[10px] mb-4" style={{ color: GOLD }}>{t("recruitersFindYou")}</p>

        <button
          type="button"
          onClick={() => navigate("/profile-start")}
          className="sm-cta-pulse w-full sm:w-auto rounded-xl px-7 h-12 font-bold"
          style={{ background: GOLD, color: NAVY }}
        >
          {t("heroCta")}
        </button>
        <div className="mt-3 flex flex-col items-center gap-2">
          <button type="button" onClick={() => navigate("/app?tab=jobs")} className="text-xs font-semibold" style={{ color: GOLD }}>
            {t("alreadyRegistered")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/for-companies")}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            style={{ border: `1px solid ${BORDER}`, color: GOLD }}
          >
            Companies: FIND CREW →
          </button>
        </div>

        {/* Universal search */}
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-xl px-3 h-11" style={{ background: `${PANEL}CC`, border: `1px solid ${BORDER}` }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rank, vessel type or location…"
              aria-label="Search rank, vessel type or location"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button type="button" aria-label={t("close")} onClick={() => setQuery("")}><X className="w-4 h-4 text-muted-foreground" /></button>
            )}
          </div>
          {suggestion && (
            <button
              type="button"
              onClick={() => navigate(suggestion.to)}
              className="mt-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ border: `1px solid ${BORDER}`, background: "rgba(212,175,55,0.08)", color: GOLD }}
            >
              {suggestion.label}
            </button>
          )}
        </div>
      </div>

      {/* 5. MATCHING NOW + My Market */}
      <div className="max-w-6xl mx-auto px-4 pb-4">
        <p className="text-[11px] font-bold tracking-wider text-foreground mb-2">
          {t("matchingNow")}{myMarket ? <span style={{ color: GOLD }}> · {myMarket} ⚓</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {topRanks.map((r) => (
            <button
              key={r.rank}
              type="button"
              onClick={() => navigate(`/profile-start?rank=${encodeURIComponent(r.rank)}`)}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ border: `1px solid ${BORDER}`, background: "rgba(212,175,55,0.08)", color: GOLD }}
            >
              {r.rank} <span className="font-mono">{r.count}</span>
            </button>
          ))}
          {MARKETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMarket(m)}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{
                border: `1px solid ${myMarket === m ? GOLD : "rgba(255,255,255,0.12)"}`,
                background: myMarket === m ? GOLD : "transparent",
                color: myMarket === m ? NAVY : "#94A3B8",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 6+7. VACANCY TICKER + LIVE JOBS */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {filtered.length > 0 && (
          <div
            className="sm-tape mb-2 overflow-hidden rounded-xl"
            style={{ height: 36, background: "rgba(6,15,29,0.9)", border: `1px solid ${BORDER}` }}
          >
            <div className="sm-tape-track flex w-max items-center gap-6 px-3" style={{ height: 34 }}>
              {[...filtered, ...filtered].map((v, i) => (
                <span key={`${v.id}-${i}`} className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">{v.rank_required || v.title || t("seafarer")}</span>
                  {" · "}
                  <span style={{ color: GOLD }}>{v.vessel_type || t("various")}</span>
                  {" · "}
                  {v.joining_port || t("worldwide")}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-2xl overflow-hidden" style={{ background: `${PANEL}CC`, border: `1px solid ${BORDER}` }}>
          {filtered.slice(0, 3).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSheet(v)}

              className="w-full text-left px-3 border-b last:border-b-0 flex items-center gap-2"
              style={{ minHeight: 54, borderColor: "rgba(212,175,55,0.12)" }}
            >
              {isNew(v) && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0" style={{ background: GOLD, color: NAVY }}>NEW</span>}
              {isUrgent(v) && <span className="shrink-0 text-[11px]">🔥</span>}
              <span className="font-bold text-foreground text-sm truncate">{v.rank_required || v.title || t("seafarer")}</span>
              <span className="text-xs truncate" style={{ color: GOLD }}>{v.vessel_type || t("various")}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground truncate shrink-0">
                {(v.joining_port || t("worldwide")).slice(0, 14)} · {relTime(v.first_seen_at || v.fetched_at)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground py-6 text-center">{t("loadingVacancies")}</p>
          )}
          <button
            type="button"
            onClick={() => navigate("/app?tab=jobs")}
            className="w-full py-2.5 text-[11px] font-bold"
            style={{ color: GOLD }}
          >
            {t("allJobs")} {market?.total ?? 0} →
          </button>
        </div>
      </div>

      {/* Newswire ribbon */}
      {wire.length > 0 && (
        <div
          className="w-full overflow-hidden flex items-center gap-3 px-3"
          style={{ height: 34, background: NAVY, borderTop: "1px solid rgba(212,175,55,0.2)" }}
        >
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
            <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color: GOLD }}>SEAMINDS LIVE</span>
          </span>
          {reducedMotion ? (
            <span className="text-[10px] text-muted-foreground truncate">
              {wire.slice(0, 3).map((w, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: GOLD }} className="mx-2">·</span>}
                  {WIRE_ICON[w.kind] || "◆"} {w.text} <span className="opacity-60">{relTime(w.ts)}</span>
                </span>
              ))}
            </span>
          ) : (
            <div className="flex-1 overflow-hidden whitespace-nowrap">
              <style>{`
                @keyframes sm-wire { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                .sm-wire-track { display: inline-block; white-space: nowrap; animation: sm-wire 45s linear infinite; }
                .sm-wire-track:hover, .sm-wire-track:active { animation-play-state: paused; }
              `}</style>
              <div className="sm-wire-track">
                {[...wire, ...wire].map((w, i) => (
                  <span key={i} className="inline-block text-[10px] text-muted-foreground">
                    <span style={{ color: GOLD }} className="mx-2">·</span>
                    {WIRE_ICON[w.kind] || "◆"} {w.text}{" "}
                    <span className="opacity-60">{relTime(w.ts)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}



      {/* Quick sheet */}
      {sheet && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSheet(null)}>
          <div
            className="w-full rounded-t-2xl p-4 pb-8"
            style={{ background: PANEL, border: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="font-bold text-foreground">{sheet.title || sheet.rank_required || t("vacancy")}</p>
              <button type="button" aria-label={t("close")} onClick={() => setSheet(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <p className="text-xs mb-1" style={{ color: GOLD }}>{sheet.rank_required || "—"} · {sheet.vessel_type || t("variousVessels")}</p>
            <p className="font-mono text-[11px] text-muted-foreground mb-1">
              {t("joining")}: {sheet.joining_port || t("worldwide")} · {relTime(sheet.first_seen_at || sheet.fetched_at)}
            </p>
            {(sheet.salary_min || sheet.salary_text) && (
              <p className="font-mono text-[11px] mb-1" style={{ color: GREEN }}>
                {sheet.salary_text || `${t("salaryFrom")} $${Number(sheet.salary_min).toLocaleString()}`}
              </p>
            )}
            <p className="text-[9px] font-mono tracking-wider text-muted-foreground mb-3">{sheet.source ? t("externalSource") : t("direct")}</p>

            <p className="text-xs font-semibold mb-3" style={{ color: profileActive ? GREEN : "#94A3B8" }}>
              {t("yourSeaProfile")}: {profileActive ? t("profileActive") : t("profileNotActive")}
            </p>

            <button
              type="button"
              onClick={() => navigate(user ? "/app?tab=jobs" : "/join?next=%2Fquick-profile")}
              className="w-full rounded-xl h-12 font-bold mb-3"
              style={{ background: GOLD, color: NAVY }}
            >
              {user ? t("applyWithProfile") : t("activateAndApply")}
            </button>

            <ul className="space-y-1 text-[11px] text-muted-foreground">
              <li>✓ {t("benefitReuse")}</li>
              <li>✓ {t("benefitMatched")}</li>
              <li>✓ {t("benefitVisibility")}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversionConsole;
