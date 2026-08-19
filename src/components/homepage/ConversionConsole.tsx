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
          .limit(10),
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
        @media (prefers-reduced-motion: reduce) { .sm-cta-pulse, .sm-dot { animation: none !important; } }
      `}</style>

      {/* 1. HEADER */}
      <header className="sticky top-0 z-40 border-b" style={{ height: 86, borderColor: "rgba(255,255,255,0.06)", background: NAVY }}>
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2">
            <img src={seamindsLogo} alt="SeaMinds" className="w-9 h-9" />
            <span className="text-lg font-bold text-foreground">SeaMinds</span>
          </button>

          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

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
        <p className="text-[11px] tracking-widest text-muted-foreground mb-2">{t("heroKicker")}</p>
        <h1 className="sm-hero-gradient text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-3">
          {t("heroTitle")}
        </h1>

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
        <div className="mt-3">
          <button type="button" onClick={() => navigate("/app?tab=jobs")} className="text-xs font-semibold" style={{ color: GOLD }}>
            {t("alreadyRegistered")}
          </button>
        </div>
      </div>

      {/* 5. MATCHING NOW */}
      {topRanks.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <p className="text-[11px] font-bold tracking-wider text-foreground mb-2">{t("matchingNow")}</p>
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
          </div>
        </div>
      )}

      {/* 7. LIVE JOBS */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        <div className="rounded-2xl overflow-hidden" style={{ background: `${PANEL}CC`, border: `1px solid ${BORDER}` }}>
          {vacancies.slice(0, 3).map((v) => (
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
          {vacancies.length === 0 && (
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
