import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Building2 } from "lucide-react";

interface ViewRow {
  id: string;
  company_name: string | null;
  created_at: string;
}

const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const CvViewsCard = () => {
  const [views, setViews] = useState<ViewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data } = await supabase
          .from("cv_access_log")
          .select("id, company_name, created_at")
          .eq("crew_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);
        setViews(data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;

  const last30 = views.filter(
    (v) => new Date(v.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: "#112240", border: "1px solid #1e3a5f" }}
    >
      <div className="flex items-center gap-2">
        <Eye size={16} style={{ color: "#D4AF37" }} />
        <h3 className="text-sm font-bold" style={{ color: "#D4AF37" }}>
          Who viewed your CV
        </h3>
      </div>

      {views.length === 0 ? (
        <div className="space-y-1">
          <p className="text-sm text-white/90 font-medium">No company views yet</p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            Complete your CV and mark yourself available — manning companies search
            SeaMinds every day for crew like you.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-white/90">
            <span className="font-bold" style={{ color: "#D4AF37" }}>{last30}</span>{" "}
            {last30 === 1 ? "company" : "companies"} viewed your CV in the last 30 days
          </p>
          <div className="space-y-2">
            {views.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <Building2 size={14} style={{ color: "#94a3b8" }} className="shrink-0" />
                <span className="text-xs text-white/90 truncate flex-1">
                  {v.company_name || "A manning company"}
                </span>
                <span className="text-[11px] shrink-0" style={{ color: "#94a3b8" }}>
                  {timeAgo(v.created_at)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CvViewsCard;
