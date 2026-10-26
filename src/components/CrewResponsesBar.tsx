import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Single compact home bar; details live on /my-responses so the feed stays light. */
export default function CrewResponsesBar({ profileId }: { profileId?: string }) {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<{ offers: number; total: number } | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    supabase.from("job_applications").select("outcome").eq("crew_id", profileId)
      .in("outcome", ["offered", "shortlisted", "placed"]).limit(50)
      .then(({ data }) => {
        if (!alive || !data) return;
        setCounts({ offers: data.filter((r: any) => r.outcome === "offered").length, total: data.length });
      });
    return () => { alive = false; };
  }, [profileId]);

  if (!counts || counts.total === 0) return null;
  return (
    <button
      onClick={() => navigate("/my-responses")}
      className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-card px-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-primary">📬 {counts.total} Manager Response{counts.total > 1 ? "s" : ""} & Actions</span>
        <span className="block text-xs text-muted-foreground">
          {counts.offers > 0 ? `🎉 ${counts.offers} job offer${counts.offers > 1 ? "s" : ""} waiting · ` : ""}Tap to review and respond
        </span>
      </span>
      <span className="text-primary font-bold">→</span>
    </button>
  );
}
