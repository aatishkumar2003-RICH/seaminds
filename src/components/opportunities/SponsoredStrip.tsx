import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { jobPath, type RankHub } from "@/lib/jobSlug";
import { pickSponsored, type SponsoredRow } from "@/lib/vacancyPromotion";

/** Rank-targeted promoted vacancies, max one per recruiter, fair rotation every 3 hours (server ordered). */
const SponsoredStrip = ({ hub, preview }: { hub: RankHub | null; preview?: boolean }) => {
  const [rows, setRows] = useState<SponsoredRow[]>([]);
  useEffect(() => {
    let alive = true;
    supabase.rpc("sponsored_vacancies" as any).then(({ data }) => { if (alive) setRows(((data as any) || []) as SponsoredRow[]); });
    return () => { alive = false; };
  }, []);
  const picks = pickSponsored(rows, hub);
  if (!picks.length) return preview ? <p className="text-xs text-muted-foreground">No promoted vacancy for this rank right now — your organic vacancies show by date.</p> : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
      {picks.map((r) => (
        <Link key={r.posting_id} to={jobPath({ id: r.posting_id, rank: r.rank_required, vessel: r.vessel_type, port: r.joining_port })}
          style={{ display: "block", textDecoration: "none", background: "#112240", border: "1px solid rgba(212,175,55,0.6)", borderRadius: 12, padding: "9px 12px" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: r.campaign === "urgent" ? "#f59e0b" : "#D4AF37" }}>
            {r.campaign === "urgent" ? "🚨 URGENT · SPONSORED" : "⭐ FEATURED · SPONSORED"}
          </span>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{r.rank_required || "Seafarer"}{r.vessel_type ? ` · ${r.vessel_type}` : ""}</div>
          <div style={{ color: "#94A3B8", fontSize: 12 }}>{r.recruiter_name || r.company_name}{r.monthly_salary ? ` · ${r.monthly_salary}` : ""}</div>
        </Link>
      ))}
    </div>
  );
};

export default SponsoredStrip;
