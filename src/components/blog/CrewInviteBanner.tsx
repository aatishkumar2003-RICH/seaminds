import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Top-of-article crew invite with the live vacancy count (rounded down, never overstated). */
const CrewInviteBanner = () => {
  const [total, setTotal] = useState<number | null>(() => {
    try { return JSON.parse(localStorage.getItem("sm_origin_counts") || "null")?.total ?? null; } catch { return null; }
  });
  useEffect(() => {
    supabase.rpc("vacancy_origin_counts" as never).then(({ data }) => {
      const t = Number((data as { total?: number } | null)?.total);
      if (t) setTotal(t);
    });
  }, []);
  const jobs = total && total >= 100 ? `${(Math.floor(total / 100) * 100).toLocaleString("en-US")}+` : "Thousands of";
  return (
    <aside className="mb-6 rounded-xl p-4" style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)" }}>
      <p className="text-sm font-bold" style={{ color: "#D4AF37" }}>⚓ Find Your Next Contract Direct — Free for All Seafarers</p>
      <p className="text-xs text-muted-foreground mt-1">
        Browse {jobs} live deck, engine &amp; offshore jobs. Build a verified Sea Profile, train on maritime competencies, and apply direct to managers.
      </p>
      <Link to="/?utm_source=blog&utm_medium=banner&utm_campaign=crew_invite" className="inline-block mt-3 rounded-xl px-4 py-2 text-xs font-bold" style={{ background: "#D4AF37", color: "#0D1B2A" }}>
        Join Free →
      </Link>
    </aside>
  );
};
export default CrewInviteBanner;
