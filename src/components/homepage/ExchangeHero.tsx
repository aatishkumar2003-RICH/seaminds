import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const GOLD = "#D4AF37";
const GREEN = "#22c55e";
const PANEL = "#112240";

type Index = { name: string; total: number; new_24h: number; direction: string; status: string };
type Market = { total: number; new_24h: number; countries: number; indices: Index[]; top_ranks: string[] };
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

const MARKETS = ["DECK", "ENGINE", "ETO", "RATINGS", "OFFSHORE"] as const;

const deptOf = (v: Vacancy) => {
  const r = (v.rank_required || "").toLowerCase();
  const t = (v.vessel_type || "").toLowerCase();
  if (/eto|electro/.test(r)) return "ETO";
  if (/offshore|ahts|psv|rig|drill|jack/.test(t)) return "OFFSHORE";
  if (/engineer|engine/.test(r)) return "ENGINE";
  if (/motorman|oiler|fitter|wiper|able seaman|\bab\b|\bos\b|bosun|cook|steward|messman|rating|fitter/.test(r)) return "RATINGS";
  if (/master|captain|officer|deck|cadet|mate/.test(r)) return "DECK";
  return "OTHER";
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

const ExchangeHero = () => {
  const navigate = useNavigate();
  const [market, setMarket] = useState<Market | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [query, setQuery] = useState("");
  const [myMarket, setMyMarket] = useState<string | null>(() => localStorage.getItem("sm_my_market"));

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
      setLoadedAt(new Date());
    })();
    return () => { alive = false; };
  }, []);

  const setMarketChip = (m: string) => {
    const next = myMarket === m ? null : m;
    setMyMarket(next);
    if (next) localStorage.setItem("sm_my_market", next);
    else localStorage.removeItem("sm_my_market");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vacancies.filter((v) => {
      if (myMarket && deptOf(v) !== myMarket) return false;
      if (!q) return true;
      return `${v.rank_required || ""} ${v.vessel_type || ""} ${v.joining_port || ""} ${v.title || ""}`.toLowerCase().includes(q);
    });
  }, [vacancies, query, myMarket]);

  const chips = market?.top_ranks?.length ? market.top_ranks.slice(0, 5) : ["ETO", "LNG", "Chief Engineer", "2/E", "Offshore"];
  const tapeItems = filtered.length ? filtered : vacancies;

  return (
    <section className="relative">
      <style>{`
        @keyframes sm-tape { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .sm-tape { display:inline-flex; white-space:nowrap; animation: sm-tape 45s linear infinite; }
        .sm-tape-fast { animation-duration: 30s; }
        .sm-tape-wrap:hover .sm-tape, .sm-tape-wrap:active .sm-tape { animation-play-state: paused; }
        @keyframes sm-pulse-cta { 0%,100% { box-shadow: 0 0 0 0 rgba(212,175,55,.45) } 50% { box-shadow: 0 0 0 10px rgba(212,175,55,0) } }
        .sm-cta-pulse { animation: sm-pulse-cta 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sm-tape, .sm-cta-pulse { animation: none !important; }
        }
      `}</style>

      {/* 1. MARKET STATUS BAR */}
      <div className="border-y" style={{ borderColor: "rgba(212,175,55,0.2)", background: "rgba(13,27,42,0.9)" }}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-[10px] sm:text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0 animate-pulse motion-reduce:animate-none" style={{ background: GREEN }} />
            <span className="font-bold tracking-widest" style={{ color: GREEN }}>MARITIME MARKET LIVE</span>
            <span className="font-mono truncate" style={{ color: GOLD }}>
              {market ? `${market.total} OPENINGS · +${market.new_24h} TODAY · ${market.countries} COUNTRIES` : "LOADING…"}
            </span>
          </div>
          <span className="font-mono text-muted-foreground shrink-0 hidden sm:inline">
            {loadedAt ? `Updated ${loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "…"}
          </span>
        </div>
      </div>

      {/* 2. SECTOR TAPE */}
      <div className="sm-tape-wrap overflow-hidden border-b" style={{ borderColor: "rgba(212,175,55,0.12)", background: "rgba(6,15,29,0.9)" }}>
        <div className="sm-tape py-1.5">
          {[0, 1].map((dupe) => (
            <span key={dupe} className="inline-flex">
              {(market?.indices || []).map((ix) => (
                <span key={`${dupe}-${ix.name}`} className="mx-4 text-[11px] font-mono">
                  <span className="text-foreground/80">{ix.name} </span>
                  <span style={{ color: ix.direction === "up" ? GREEN : "#94A3B8" }}>
                    {ix.direction === "up" ? `▲ ${ix.status} +${ix.new_24h}` : `→ ${ix.status}`}
                  </span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* 3. HERO */}
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-6 text-center">
        <h1 className="sm-hero-gradient text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3">
          THE GLOBAL MARITIME OPPORTUNITY EXCHANGE
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mb-6">
          Find your next vessel. Understand the market. Move faster.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <button
            type="button"
            onClick={() => navigate("/app?tab=jobs")}
            className="sm-cta-pulse rounded-xl px-7 h-12 font-bold"
            style={{ background: GOLD, color: "#0D1B2A" }}
          >
            FIND MY NEXT JOB
          </button>
          <button
            type="button"
            onClick={() => navigate("/for-companies")}
            className="rounded-xl px-7 h-12 font-bold"
            style={{ border: `1px solid ${GOLD}`, color: GOLD, background: "transparent" }}
          >
            FIND CREW
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rank, vessel type or location…"
          aria-label="Search live vacancies"
          className="w-full max-w-2xl mx-auto block rounded-xl h-13 px-4 py-3.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:ring-2"
          style={{ border: "1px solid rgba(212,175,55,0.35)", background: "rgba(212,175,55,0.06)" }}
        />

        <div className="flex flex-wrap gap-2 justify-center mt-3">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setQuery(c)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ border: "1px solid rgba(212,175,55,0.5)", background: "rgba(212,175,55,0.08)", color: GOLD }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 4. MY MARKET */}
        <div className="flex flex-wrap gap-2 justify-center items-center mt-5">
          {MARKETS.map((m) => {
            const active = myMarket === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMarketChip(m)}
                aria-pressed={active}
                className="rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide transition-colors"
                style={{
                  border: `1px solid ${active ? GOLD : "rgba(255,255,255,0.12)"}`,
                  background: active ? GOLD : "transparent",
                  color: active ? "#0D1B2A" : "#94A3B8",
                }}
              >
                {m}
              </button>
            );
          })}
          {myMarket && <span className="text-[11px] font-semibold" style={{ color: GOLD }}>Your market ⚓</span>}
        </div>
      </div>

      {/* 5. LIVE EXCHANGE BOARD */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="rounded-2xl overflow-hidden backdrop-blur-md" style={{ background: `${PANEL}CC`, border: "1px solid rgba(212,175,55,0.3)" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(212,175,55,0.2)" }}>
            <span className="text-xs font-bold tracking-widest text-foreground">🔴 LIVE EXCHANGE</span>
            <span className="text-[11px] font-mono text-muted-foreground">{filtered.length} shown</span>
          </div>

          {/* vacancy tape */}
          <div className="sm-tape-wrap overflow-hidden border-b py-2" style={{ borderColor: "rgba(212,175,55,0.12)" }}>
            <div className="sm-tape sm-tape-fast">
              {[0, 1].map((dupe) => (
                <span key={dupe} className="inline-flex">
                  {tapeItems.map((v) => (
                    <span key={`${dupe}-${v.id}`} className="mx-4 text-[11px] font-mono text-muted-foreground">
                      <span className="text-foreground">{v.rank_required || "Officer"}</span>
                      {" · "}{v.vessel_type || "Various"}{" · "}{v.joining_port || "Worldwide"}
                      {isNew(v) && <span className="ml-1.5 font-bold" style={{ color: GOLD }}>NEW</span>}
                      {isUrgent(v) && <span className="ml-1.5 font-bold text-red-500">URGENT</span>}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>

          {/* cards */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.slice(0, 6).map((v) => (
              <div key={v.id} className="rounded-xl p-3.5" style={{ border: "1px solid rgba(212,175,55,0.18)", background: "rgba(13,27,42,0.6)" }}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-bold text-foreground text-sm">{v.rank_required || v.title || "Seafarer"}</p>
                  <div className="flex gap-1 shrink-0">
                    {isNew(v) && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: GOLD, color: "#0D1B2A" }}>NEW</span>}
                    {isUrgent(v) && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white">URGENT</span>}
                  </div>
                </div>
                <p className="text-xs font-semibold mb-1" style={{ color: GOLD }}>{v.vessel_type || "Various vessels"}</p>
                <p className="text-[11px] font-mono text-muted-foreground mb-1">
                  {v.joining_port || "Worldwide"} · {relTime(v.first_seen_at || v.fetched_at)}
                </p>
                {(v.salary_min || v.salary_text) && (
                  <p className="text-[11px] font-mono mb-2" style={{ color: GREEN }}>
                    {v.salary_text || `from $${Number(v.salary_min).toLocaleString()}`}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] font-mono tracking-wider text-muted-foreground">
                    {v.source ? "EXTERNAL SOURCE" : "DIRECT"}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/app?tab=jobs")}
                    className="rounded-lg px-3 py-1 text-[11px] font-bold"
                    style={{ background: GOLD, color: "#0D1B2A" }}
                  >
                    APPLY →
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full py-6 text-center">
                No live vacancies match this filter right now.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate("/app?tab=jobs")}
            className="w-full px-4 py-3 text-xs font-semibold border-t"
            style={{ borderColor: "rgba(212,175,55,0.2)", color: GOLD }}
          >
            See all {market?.total ?? 0} live vacancies →
          </button>
        </div>
      </div>
    </section>
  );
};

export default ExchangeHero;
