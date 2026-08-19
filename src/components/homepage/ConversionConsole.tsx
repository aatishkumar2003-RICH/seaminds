import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Globe, ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import seamindsLogo from "@/assets/seaminds-logo.png";

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

const LANGS = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "fil", label: "Filipino" },
  { code: "hi", label: "हिन्दी" },
  { code: "vi", label: "Tiếng Việt" },
];

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

const ConversionConsole = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [profileActive, setProfileActive] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("sm_lang") || "en");
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

  const pickLang = (code: string, label: string) => {
    setLang(code);
    localStorage.setItem("sm_lang", code);
    setLangOpen(false);
    if (code !== "en") toast(`${label}: coming soon in your language — translations arriving this week`);
  };

  const topRanks = useMemo(() => {
    const counted = market?.top_ranks_counted || [];
    return counted.slice(0, 4);
  }, [market]);

  const langLabel = LANGS.find((l) => l.code === lang)?.code.toUpperCase() || "EN";
  const total = market?.total ?? null;

  const dock = [
    { key: "jobs", label: "JOBS", value: total === null ? "…" : String(total), to: "/app?tab=jobs" },
    { key: "profile", label: "SEA PROFILE", value: profileActive ? "✓" : "START", to: "/quick-profile" },
    { key: "ai", label: "AI", value: "TRY", to: "/app?tab=smc" },
    { key: "feed", label: "FEED", value: "OPEN", to: "/app?tab=home" },
    { key: "market", label: "MARKET", value: "LIVE", to: "/app?tab=news" },
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
                      onClick={() => pickLang(l.code, l.label)}
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
                🌍 Worldwide <ChevronDown className="w-3 h-3" />
              </button>
              {marketOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl p-2 z-50" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
                  <p className="px-2 py-1.5 text-xs font-semibold" style={{ color: GOLD }}>Worldwide ✓</p>
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Indonesia · Philippines · India · Vietnam — opening soon</p>
                  <p className="px-2 pb-1 text-[10px] text-muted-foreground/70">Counts arrive as we verify each market</p>
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
            SMX LIVE
          </span>
          <span className="font-mono text-[11px]" style={{ color: GOLD }}>
            {market ? `${market.total} JOBS · +${market.new_24h} TODAY` : "LOADING…"}
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
        <p className="text-[11px] tracking-widest text-muted-foreground mb-2">LOOKING FOR YOUR NEXT SHIP?</p>
        <h1 className="sm-hero-gradient text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-3">
          CREATE ONE SEA PROFILE. GET MATCHED.
        </h1>

        <div className="inline-flex items-center rounded-xl overflow-hidden mb-1" style={{ border: `1px solid ${BORDER}` }}>
          {["PROFILE", "MATCH", "APPLY", "INTERVIEW"].map((s, i) => (
            <span
              key={s}
              className="px-2.5 py-1.5 text-[10px] font-bold tracking-wide"
              style={{ color: "#E2E8F0", borderLeft: i ? "1px solid rgba(212,175,55,0.25)" : undefined }}
            >
              {s}
            </span>
          ))}
        </div>
        <p className="text-[10px] mb-4" style={{ color: GOLD }}>↘ recruiters find you</p>

        <button
          type="button"
          onClick={() => navigate("/profile-start")}
          className="sm-cta-pulse w-full sm:w-auto rounded-xl px-7 h-12 font-bold"
          style={{ background: GOLD, color: NAVY }}
        >
          START FREE — ACTIVATE SEA PROFILE
        </button>
        <div className="mt-3">
          <button type="button" onClick={() => navigate("/app?tab=jobs")} className="text-xs font-semibold" style={{ color: GOLD }}>
            Already registered? SEE MY JOBS →
          </button>
        </div>
      </div>

      {/* 5. MATCHING NOW */}
      {topRanks.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <p className="text-[11px] font-bold tracking-wider text-foreground mb-2">🔥 MATCHING NOW</p>
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
              <span className="font-bold text-foreground text-sm truncate">{v.rank_required || v.title || "Seafarer"}</span>
              <span className="text-xs truncate" style={{ color: GOLD }}>{v.vessel_type || "Various"}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground truncate shrink-0">
                {(v.joining_port || "Worldwide").slice(0, 14)} · {relTime(v.first_seen_at || v.fetched_at)}
              </span>
            </button>
          ))}
          {vacancies.length === 0 && (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading live vacancies…</p>
          )}
          <button
            type="button"
            onClick={() => navigate("/app?tab=jobs")}
            className="w-full py-2.5 text-[11px] font-bold"
            style={{ color: GOLD }}
          >
            ALL {market?.total ?? 0} →
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
              <p className="font-bold text-foreground">{sheet.title || sheet.rank_required || "Vacancy"}</p>
              <button type="button" aria-label="Close" onClick={() => setSheet(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <p className="text-xs mb-1" style={{ color: GOLD }}>{sheet.rank_required || "—"} · {sheet.vessel_type || "Various vessels"}</p>
            <p className="font-mono text-[11px] text-muted-foreground mb-1">
              Joining: {sheet.joining_port || "Worldwide"} · {relTime(sheet.first_seen_at || sheet.fetched_at)}
            </p>
            {(sheet.salary_min || sheet.salary_text) && (
              <p className="font-mono text-[11px] mb-1" style={{ color: GREEN }}>
                {sheet.salary_text || `from $${Number(sheet.salary_min).toLocaleString()}`}
              </p>
            )}
            <p className="text-[9px] font-mono tracking-wider text-muted-foreground mb-3">{sheet.source ? "EXTERNAL SOURCE" : "DIRECT"}</p>

            <p className="text-xs font-semibold mb-3" style={{ color: profileActive ? GREEN : "#94A3B8" }}>
              YOUR SEA PROFILE: {profileActive ? "✓ Active" : "Not active yet"}
            </p>

            <button
              type="button"
              onClick={() => navigate(user ? "/app?tab=jobs" : "/join?next=%2Fquick-profile")}
              className="w-full rounded-xl h-12 font-bold mb-3"
              style={{ background: GOLD, color: NAVY }}
            >
              {user ? "APPLY WITH SEA PROFILE →" : "ACTIVATE PROFILE & APPLY"}
            </button>

            <ul className="space-y-1 text-[11px] text-muted-foreground">
              <li>✓ Reuse for future applications</li>
              <li>✓ Get matched with relevant jobs</li>
              <li>✓ Control professional visibility</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversionConsole;
