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

  const tiles = ORIGINS
    .map((o) => ({ ...o, n: c?.by?.[o.code] ?? 0 }))
    .filter((o) => !c || o.n > 0)
    .sort((a, b) => b.n - a.n);

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <section aria-label="Browse jobs by recruiter country" className="relative mb-5">
      <div className="flex items-end justify-between mb-2 gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>Jobs by recruiter country</p>
          <p className="text-[11px] text-muted-foreground">Tap your country — apply direct by WhatsApp or email</p>
        </div>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x" style={{ scrollbarWidth: "none" }}>
        {tiles.map((o) => (
          <Link
            key={o.code}
            to={`/feed?country=${o.code}`}
            className="snap-start shrink-0 rounded-2xl p-3 flex flex-col justify-between no-underline transition-transform hover:-translate-y-0.5"
            style={{ width: 112, height: 112, background: `${PANEL}E6`, border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl leading-none">{o.flag}</span>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
            </div>
            <div>
              <p className="font-mono text-lg font-bold leading-none" style={{ color: GOLD }}>{c ? fmt(o.n) : "…"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">live jobs</p>
              <p className="text-xs font-bold text-foreground truncate">{o.name}</p>
            </div>
          </Link>
        ))}
        <Link
          to="/feed"
          className="snap-start shrink-0 rounded-2xl p-3 flex flex-col justify-between no-underline transition-transform hover:-translate-y-0.5"
          style={{ width: 112, height: 112, background: "rgba(212,175,55,0.10)", border: `1px solid ${GOLD}` }}
        >
          <span className="text-2xl leading-none">🌍</span>
          <div>
            <p className="font-mono text-lg font-bold leading-none" style={{ color: GOLD }}>{c ? fmt(c.total) : "…"}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">all jobs</p>
            <p className="text-xs font-bold text-foreground">Worldwide</p>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default CountryGateway;
