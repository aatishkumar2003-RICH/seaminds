import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ORIGINS } from "@/lib/vacancyOrigin";

const GOLD = "#D4AF37";
const PANEL = "#112240";
const BORDER = "rgba(212,175,55,0.3)";

type Counts = { total: number; by: Record<string, number> };

/** Hero tiles: live vacancies grouped by the recruiter's country (WhatsApp dial code). */
const CountryGateway = () => {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc("vacancy_origin_counts" as never).then(({ data }) => {
      if (alive && data) setC(data as unknown as Counts);
    });
    return () => { alive = false; };
  }, []);

  const tiles = c
    ? ORIGINS.map((o) => ({ ...o, n: c.by?.[o.code] ?? 0 })).filter((o) => o.n > 0).sort((a, b) => b.n - a.n)
    : [];

  const fmt = (n: number) => n.toLocaleString("en-US");
  const tileCls = "shrink-0 rounded-2xl p-3 flex flex-col justify-between no-underline transition-transform hover:-translate-y-0.5";
  const tileSize = { width: 112, height: 112 };
  const duration = Math.max(20, tiles.length * 3.5);

  const tile = (o: (typeof tiles)[number], k: string, hidden = false) => (
    <Link
      key={k}
      to={`/feed?country=${o.code}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={tileCls}
      style={{ ...tileSize, marginRight: 10, background: `${PANEL}E6`, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl leading-none">{o.flag}</span>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
      </div>
      <div>
        <p className="font-mono text-lg font-bold leading-none" style={{ color: GOLD }}>{fmt(o.n)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">live jobs</p>
        <p className="text-xs font-bold text-foreground truncate">{o.name}</p>
      </div>
    </Link>
  );

  return (
    <section aria-label="Browse jobs by recruiter country" className="relative mb-5">
      <style>{`
        @keyframes cg-marquee { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
        @keyframes cg-shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        .cg-track { animation: cg-marquee var(--cg-dur) linear infinite; will-change: transform; }
        .cg-viewport:hover .cg-track, .cg-viewport:active .cg-track, .cg-viewport:focus-within .cg-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .cg-track { animation: none; } }
      `}</style>
      <div className="flex items-end justify-between mb-2 gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>Jobs by recruiter country</p>
          <p className="text-[11px] text-muted-foreground">Tap your country — apply direct by WhatsApp or email</p>
        </div>
      </div>
      <div className="flex gap-2.5 items-stretch">
        {/* Worldwide — pinned first */}
        <Link
          to="/feed"
          className={`${tileCls} relative z-10`}
          style={{ ...tileSize, background: "rgba(212,175,55,0.14)", border: `1.5px solid ${GOLD}`, boxShadow: "0 0 18px rgba(212,175,55,0.25)" }}
        >
          <span className="text-2xl leading-none">🌍</span>
          <div>
            <p className="font-mono text-lg font-bold leading-none" style={{ color: GOLD }}>{c ? fmt(c.total) : "…"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">all jobs</p>
            <p className="text-xs font-bold text-foreground">Worldwide</p>
          </div>
        </Link>

        {/* Moving country track */}
        <div
          className="cg-viewport relative flex-1 min-w-0 overflow-hidden"
          style={{
            WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)",
            maskImage: "linear-gradient(90deg, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)",
          }}
        >
          {!c ? (
            <div className="flex gap-2.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="shrink-0 rounded-2xl" style={{
                  ...tileSize, border: `1px solid ${BORDER}`,
                  background: `linear-gradient(90deg, ${PANEL} 0%, #1a2f55 50%, ${PANEL} 100%)`,
                  backgroundSize: "400px 100%", animation: "cg-shimmer 1.2s linear infinite",
                }} />
              ))}
            </div>
          ) : (
            <div className="cg-track flex w-max" style={{ ["--cg-dur" as string]: `${duration}s` }}>
              {tiles.map((o) => tile(o, o.code))}
              {tiles.map((o) => tile(o, `dup-${o.code}`, true))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CountryGateway;
