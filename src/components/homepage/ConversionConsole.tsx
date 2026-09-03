import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Globe, ChevronDown, X, Menu, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import seamindsLogo from "@/assets/seaminds-logo.png";
import { useT, LANGS, type LangCode } from "@/i18n";
import { fetchCrewCardInfo, waApplyLink, getCachedCrewCardInfo, recordApplication, openHandoffTab, completeHandoff, fetchQuickProfileDone, type CrewCardInfo } from "@/lib/applyMessage";
import ApplyGateSheet from "@/components/ApplyGateSheet";
import { jobPath } from "@/lib/jobSlug";
import JobCard from "@/components/JobCard";
import { loadVacancies, loadMyApplicationTargets, type UnifiedVacancy } from "@/lib/vacancyFeed";


const GOLD = "#D4AF37";
const GREEN = "#22c55e";
const NAVY = "#0D1B2A";
const PANEL = "#112240";
const BORDER = "rgba(212,175,55,0.3)";
const WIRE_ICON: Record<string, string> = { application: "⚓", join: "👤", score: "★" };


type Index = { name: string; total: number; new_24h: number; direction: string; status: string };
type Market = {
  total: number;
  new_24h: number;
  countries: number;
  indices: Index[];
  top_ranks: string[];
  top_ranks_counted?: { rank: string; count: number }[];
};
type Vacancy = UnifiedVacancy;

const isNew = (v: Vacancy) => v.isNew;
const isUrgent = (v: Vacancy) => /urgent|immediate/i.test(`${v.rank || ""} ${v.notes || ""}`);
const relTime = (d?: string | null) => {
  if (!d) return "";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};
const idxOf = (m: Market | null, name: string) => (m?.indices || []).find((i) => i.name === name);

/** Count-up for real numbers (first load only, disabled under reduced motion) */
function useCountUp(target: number | null, enabled: boolean) {
  const [val, setVal] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (target === null) return;
    if (!enabled || done.current || target <= 0) { setVal(target); done.current = true; return; }
    done.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1200, 1);
      setVal(Math.floor(target * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return val;
}

const MARKETS = ["DECK", "ENGINE", "ETO", "RATINGS", "OFFSHORE"] as const;
const MARKET_KEYWORDS: Record<string, RegExp> = {
  DECK: /master|captain|chief officer|c\/o|2\/o|3\/o|second officer|third officer|deck/i,
  ENGINE: /engineer|c\/e|2\/e|3\/e|4\/e|motorman|oiler|engine/i,
  ETO: /eto|electr/i,
  RATINGS: /bosun|able seaman|\bab\b|\bos\b|ordinary seaman|cook|steward|fitter|wiper|rating/i,
  OFFSHORE: /offshore|osv|ahts|psv|dp|rig|platform/i,
};
const inMarket = (v: Vacancy, m: string) => {
  const hay = `${v.rank || ""} ${v.vessel || ""}`;
  return MARKET_KEYWORDS[m]?.test(hay) ?? true;
};

const MENU_LINKS: { label: string; to: string; external?: boolean }[] = [
  { label: "For Seafarers", to: "/join" },
  { label: "Find Crew — For Companies", to: "/for-companies" },
  { label: "Post Vacancy", to: "/post-vacancy" },
  { label: "Create AI Interview", to: "/manager/interviews" },
  { label: "Manager Login", to: "/manager" },
  { label: "SeaMinds Score", to: "/app?tab=smc" },
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
  const [applied, setApplied] = useState<Record<string, "ok" | "dup">>({});
  const [applyBusy, setApplyBusy] = useState(false);
  const [cardInfo, setCardInfo] = useState<CrewCardInfo | null>(null);
  const [newCrew, setNewCrew] = useState(0);

  const [needsQuickProfile, setNeedsQuickProfile] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) { setCardInfo(null); setNeedsQuickProfile(false); return; }
    fetchCrewCardInfo(user.id).then(setCardInfo);
    fetchQuickProfileDone(user.id).then((done) => setNeedsQuickProfile(!done));
  }, [user?.id]);

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
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { count } = await supabase
        .from("crew_profiles")
        .select("id", { count: "exact", head: true })
        .gt("created_at", since);
      if (alive) setNewCrew(count || 0);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: m }, vacs] = await Promise.all([
        supabase.rpc("get_market_indices" as never),
        loadVacancies({ limitDirect: 10, limitExternal: 25 }),
      ]);
      if (!alive) return;
      if (m) setMarket(m as unknown as Market);
      setVacancies(vacs);
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
      return `${v.rank || ""} ${v.vessel || ""} ${v.port || ""}`.toLowerCase().includes(q);
    });
  }, [vacancies, query, myMarket]);

  const suggestion = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    if (/cv|resume|profile/.test(q)) return { label: "Build my Sea Profile →", to: "/quick-profile" };
    if (/interview|ai|smc|score/.test(q)) return { label: "AI Interview & SeaMinds Score →", to: "/app?tab=smc" };
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

  const animate = !reducedMotion;
  const totalUp = useCountUp(total, animate);
  const new24Up = useCountUp(market?.new_24h ?? null, animate);

  /** Sector tape built from the real indices */
  const sectorTape = useMemo(() => {
    const list = (market?.indices || []).filter((i) => i && i.name);
    return list.map((i) => (i.new_24h > 0 ? `${i.name} ▲+${i.new_24h}` : `${i.name} ${i.total}`));
  }, [market]);

  /** JobPosting structured data from the real rows only */
  const jobsLd = useMemo(() => {
    const rows = vacancies.slice(0, 10).filter((v) => v.rank);
    if (rows.length === 0) return null;
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: rows.map((v, i) => {
        const posting: Record<string, unknown> = {
          "@type": "JobPosting",
          title: v.rank,
          employmentType: "CONTRACTOR",
          url: "https://seaminds.life/feed",
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: v.port || "Worldwide" },
          },
        };
        const org = v.company || v.source;
        if (org) posting.hiringOrganization = { "@type": "Organization", name: org };
        const posted = v.postedAt;
        if (posted) posting.datePosted = posted;
        if (v.expiresAt) posting.validThrough = v.expiresAt;
        if (v.notes) posting.description = v.notes;
        return { "@type": "ListItem", position: i + 1, item: posting };
      }),
    });
  }, [vacancies]);

  const applyNow = useCallback(async (v: Vacancy) => {
    if (!user) { navigate("/join?next=%2Fquick-profile"); return; }
    if (needsQuickProfile) { setGateOpen(true); return; }
    setApplyBusy(true);
    try {
      const wa = v.kind === "direct"
        ? null
        : v.applyUrl
          || waApplyLink(v.whatsapp, cardInfo || getCachedCrewCardInfo(), { rank: v.rank, vessel: v.vessel, port: v.port });
      const win = wa ? openHandoffTab() : null;
      const r = await recordApplication({
        vacancyId: v.kind === "direct" ? null : v.id,
        jobPostingId: v.kind === "direct" ? v.id : null,
        company: v.company || v.source || null,
        rank: v.rank || null,
        vessel: v.vessel || null,
        externalUrl: wa,
      });
      setApplyBusy(false);
      if (!r.ok) { completeHandoff(win, wa); toast.error("Sent on WhatsApp — could not record on SeaMinds"); return; }
      setApplied((s) => ({ ...s, [v.id]: r.duplicate ? "dup" : "ok" }));
      if (r.duplicate) toast.success("Already applied ✓ — the company already has your application");
      else if (r.emailSent === false) toast.warning("Applied ✓ — saved on SeaMinds, but the email notification failed");
      else toast.success("Applied ✓ — recorded on SeaMinds");
      completeHandoff(win, wa);
    } catch {
      toast.error("Could not send application");
      setApplyBusy(false);
    }
  }, [user, navigate, cardInfo, needsQuickProfile]);



  // Signed-out visitors must reach jobs without a login wall.
  const jobsTo = user ? "/app?tab=jobs" : "/feed";

  const dock = [
    { key: "jobs", label: t("dockJobs"), value: total === null ? "…" : String(totalUp), to: jobsTo },
    { key: "profile", label: t("dockProfile"), value: profileActive ? "✓" : t("dockStart"), to: "/quick-profile" },
    { key: "ai", label: t("dockAi"), value: t("dockTry"), to: "/app?tab=smc" },
    { key: "feed", label: t("dockFeed"), value: t("dockOpen"), to: "/app?tab=home" },
    { key: "market", label: t("dockMarket"), value: t("dockLive"), to: "/app?tab=home" },
  ];


  return (
    <div className="relative" style={{ background: NAVY }}>
      <ApplyGateSheet open={gateOpen} onClose={() => setGateOpen(false)} next="/feed" />
      <style>{`
        @keyframes sm-pulse-cta { 0%,100% { box-shadow: 0 0 0 0 rgba(212,175,55,.45) } 50% { box-shadow: 0 0 0 12px rgba(212,175,55,0) } }
        .sm-cta-pulse { animation: sm-pulse-cta 2.4s ease-out infinite; }
        @keyframes sm-tape { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .sm-tape-track { animation: sm-tape 40s linear infinite; }
        .sm-tape:hover .sm-tape-track { animation-play-state: paused; }
        @keyframes sm-aurora { 0%,100% { opacity: .28; transform: scale(1) } 50% { opacity: .5; transform: scale(1.08) } }
        .sm-aurora { animation: sm-aurora 8s ease-in-out infinite; }
        @keyframes sm-shimmer { 0% { background-position: -160% 0, 0 0 } 55%,100% { background-position: 160% 0, 0 0 } }
        .sm-shimmer {
          background-image:
            linear-gradient(100deg, transparent 40%, rgba(255,255,255,.9) 50%, transparent 60%),
            linear-gradient(100deg, #ffffff 0%, #f5e7bd 45%, #D4AF37 100%);
          background-size: 220% 100%, 100% 100%;
          background-repeat: no-repeat;
          animation: sm-shimmer 6s ease-in-out infinite;
          -webkit-background-clip: text; background-clip: text;
          color: transparent;
        }
        @keyframes sm-sector { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .sm-sector-track { animation: sm-sector 28s linear infinite; }
        .sm-sector:hover .sm-sector-track { animation-play-state: paused; }
        @keyframes sm-newchip { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
        .sm-newchip { animation: sm-newchip 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sm-cta-pulse, .sm-dot, .sm-tape-track, .sm-aurora, .sm-shimmer, .sm-sector-track, .sm-newchip { animation: none !important; }
        }
      `}</style>

      {jobsLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobsLd }} />
      )}


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
              <Link to="/for-companies" className="text-muted-foreground hover:text-foreground no-underline">Find Crew</Link>
              <span className="text-muted-foreground/40">·</span>
              <Link to="/manager" className="text-muted-foreground hover:text-foreground no-underline">Manager Login</Link>
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
                  {l.external ? (
                    <a href={l.to} className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-white/5 no-underline">
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      to={l.to}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-white/5 no-underline"
                    >
                      {l.label}
                    </Link>
                  )}
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
            <Link
              key={d.key}
              to={d.to}
              className="flex flex-col items-center justify-center gap-0.5 border-r last:border-r-0 no-underline"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <span className="font-mono text-sm font-bold" style={{ color: GOLD }}>{d.value}</span>
              <span className="text-[9px] tracking-wider text-muted-foreground">{d.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 3. LIVE PROOF BAR */}
      <Link
        to={jobsTo}
        className="block w-full border-b text-left no-underline"
        style={{ borderColor: "rgba(212,175,55,0.15)", background: "rgba(6,15,29,0.9)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ minHeight: 60 }}>
          <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider" style={{ color: GREEN }}>
            <span className="sm-dot w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
            SMX {t("live")}
          </span>
          <span className="font-mono text-[11px]" style={{ color: GOLD }}>
            {market ? `${totalUp} ${t("jobsWord")} · +${new24Up} ${t("today")}` : t("loading")}
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
      </Link>


      {/* Sector tape (real indices) */}
      {sectorTape.length > 0 && (
        <div className="sm-sector w-full overflow-hidden border-b" style={{ height: 26, borderColor: "rgba(212,175,55,0.12)", background: "rgba(6,15,29,0.7)" }}>
          <div className="sm-sector-track flex w-max items-center gap-6 px-3" style={{ height: 26 }}>
            {[...sectorTape, ...sectorTape].map((s, i) => (
              <span key={i} className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                <span style={{ color: GOLD }} className="mr-1.5">◆</span>{s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. SPLIT HERO — crew + companies */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-4 relative">
        <div
          aria-hidden
          className="sm-aurora pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            top: 20, width: 520, height: 220, maxWidth: "110%",
            background: "radial-gradient(closest-side, rgba(212,175,55,0.22), rgba(212,175,55,0) 70%)",
            filter: "blur(8px)",
          }}
        />
        <h1 className="relative text-center text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
          Seafarer Jobs &amp; Maritime Vacancies — Crew Recruitment &amp; AI Competency Platform
        </h1>

        <div className="relative grid gap-4 md:grid-cols-2 md:items-stretch">
          {/* LEFT — seafarers */}
          <div
            className="rounded-2xl p-4 sm:p-5 flex flex-col"
            style={{ background: `${PANEL}CC`, border: `1px solid ${BORDER}` }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: GOLD }}>
              For Seafarers
            </p>
            <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold leading-tight text-foreground mb-3">
              Find your next ship. Build one Sea Profile. Get matched.
            </h2>

            <div className="inline-flex w-fit items-center rounded-xl overflow-hidden mb-2" style={{ border: `1px solid ${BORDER}` }}>
              {["PROFILE", "MATCH", "APPLY", "INTERVIEW"].map((s, i) => (
                <span
                  key={s}
                  className="px-2 sm:px-2.5 py-1.5 text-[9px] sm:text-[10px] font-bold tracking-wide"
                  style={{ color: "#E2E8F0", borderLeft: i ? "1px solid rgba(212,175,55,0.25)" : undefined }}
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="text-[10px] mb-4" style={{ color: GOLD }}>{t("recruitersFindYou")}</p>

            <div className="mt-auto flex flex-col items-start gap-2">
              <Link
                to="/profile-start"
                className="sm-cta-pulse w-full sm:w-auto rounded-xl px-7 h-12 font-bold no-underline inline-flex items-center justify-center"
                style={{ background: GOLD, color: NAVY }}
              >
                Create my free Sea Profile
              </Link>
              <Link to="/feed" className="text-xs font-semibold no-underline" style={{ color: GOLD }}>
                Browse maritime jobs →
              </Link>
            </div>
          </div>

          {/* RIGHT — shipping & manning companies */}
          <div
            className="rounded-2xl p-4 sm:p-5 flex flex-col"
            style={{ background: `${PANEL}CC`, border: `1px solid ${BORDER}` }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: GOLD }}>
              For Shipping &amp; Manning Companies
            </p>
            <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold leading-tight text-foreground mb-3">
              Find your next crew. Post once. Hire with evidence.
            </h2>
            <ul className="space-y-1.5 text-[11px] leading-snug text-muted-foreground mb-4">
              <li>✓ Upload the flier your crewing team already uses — SeaMinds turns it into searchable vacancies</li>
              <li>✓ Receive applications with verified Sea Profiles</li>
              <li>✓ Run AI competency interviews and shortlist on evidence</li>
            </ul>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Link
                to="/for-companies"
                className="rounded-xl px-6 h-12 font-bold no-underline inline-flex items-center justify-center"
                style={{ background: GOLD, color: NAVY }}
              >
                Search &amp; Hire Seafarers
              </Link>
              <Link
                to="/manager"
                className="rounded-xl px-5 h-12 font-semibold text-sm no-underline inline-flex items-center justify-center"
                style={{ border: `1px solid ${GOLD}`, color: GOLD }}
              >
                Manager Login
              </Link>
            </div>
          </div>
        </div>

        <p className="relative mt-3 text-center text-[11px] font-semibold text-muted-foreground">
          Free for crew · No agent fees · Companies join free during the founding period
        </p>


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
            <Link
              to={suggestion.to}
              className="mt-2 inline-block rounded-full px-3 py-1.5 text-[11px] font-semibold no-underline"
              style={{ border: `1px solid ${BORDER}`, background: "rgba(212,175,55,0.08)", color: GOLD }}
            >
              {suggestion.label}
            </Link>
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
            <Link
              key={r.rank}
              to={`/profile-start?rank=${encodeURIComponent(r.rank)}`}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold no-underline"
              style={{ border: `1px solid ${BORDER}`, background: "rgba(212,175,55,0.08)", color: GOLD }}
            >
              {r.rank} <span className="font-mono">{r.count}</span>
            </Link>
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
        {newCrew > 0 && (
          <p className="mt-2 text-[11px] font-semibold" style={{ color: GREEN }}>
            ✓ {newCrew} seafarers joined SeaMinds this week
          </p>
        )}
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
                  <span className="font-bold text-foreground">{v.rank || t("seafarer")}</span>
                  {" · "}
                  <span style={{ color: GOLD }}>{v.vessel || t("various")}</span>
                  {" · "}
                  {v.port || t("worldwide")}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-2xl overflow-hidden" style={{ background: `${PANEL}CC`, border: `1px solid ${BORDER}` }}>
          {filtered.slice(0, 3).map((v) => (
            <div
              key={v.id}
              className="w-full text-left px-3 border-b last:border-b-0 flex items-center gap-2"
              style={{
                minHeight: 54,
                borderColor: "rgba(212,175,55,0.12)",
                borderLeft: isUrgent(v) ? "2px solid rgba(239,68,68,0.45)" : undefined,
              }}
            >
              {isNew(v) && <span className="sm-newchip rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0" style={{ background: GOLD, color: NAVY }}>NEW</span>}
              {v.kind === "direct" && (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0" style={{ border: `1px solid ${GOLD}`, color: GOLD }}>DIRECT</span>
              )}
              {isUrgent(v) && <span className="shrink-0 text-[11px]">🔥</span>}
              <a
                href={jobPath({ id: v.id, rank: v.rank, vessel: v.vessel, port: v.port })}
                onClick={(e) => { e.preventDefault(); setSheet(v); }}
                className="font-bold text-foreground text-sm truncate no-underline"
              >
                {v.rank || t("seafarer")}
              </a>
              <span className="text-xs truncate" style={{ color: GOLD }}>{v.vessel || t("various")}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground truncate shrink-0">
                {(v.port || t("worldwide")).slice(0, 14)} · {relTime(v.postedAt)}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground py-6 text-center">{t("loadingVacancies")}</p>
          )}
          <Link
            to={jobsTo}
            className="block w-full py-2.5 text-center text-[11px] font-bold no-underline"
            style={{ color: GOLD }}
          >
            {t("allJobs")} {market?.total ?? 0} →
          </Link>
        </div>



        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          SeaMinds connects seafarers with live maritime jobs worldwide and gives shipping and manning companies structured Sea Profiles, AI competency interviews and crew-matching tools. Crew can explore deck, engine, ETO, tanker, LNG, bulk, container, offshore and catering vacancies, create a reusable professional profile and apply directly.
        </p>
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
              <p className="font-bold text-foreground">{sheet.rank || t("vacancy")}</p>
              <button type="button" aria-label={t("close")} onClick={() => setSheet(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <JobCard
              vacancy={sheet}
              variant="card"
              applied={applied[sheet.id]}
              busy={applyBusy}
              onApply={() => applyNow(sheet)}
            />

            <p className="text-xs font-semibold my-3" style={{ color: profileActive ? GREEN : "#94A3B8" }}>
              {t("yourSeaProfile")}: {profileActive ? t("profileActive") : t("profileNotActive")}
            </p>

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
