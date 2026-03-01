import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { countryToFlag } from "@/lib/countryThemes";

interface PulseData {
  totalOnline: number;
  countryCount: number;
  topCountries: { code: string; count: number }[];
}

const CommunityPulse = () => {
  const [data, setData] = useState<PulseData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: profiles } = await supabase
          .from("crew_profiles")
          .select("home_country_code, last_seen" as any)
          .gte("last_seen" as any, cutoff);

        if (!profiles || profiles.length === 0) {
          setData({ totalOnline: 0, countryCount: 0, topCountries: [] });
          return;
        }

        const countryCounts: Record<string, number> = {};
        (profiles as any[]).forEach((p) => {
          const cc = p.home_country_code;
          if (cc) countryCounts[cc] = (countryCounts[cc] || 0) + 1;
        });

        const sorted = Object.entries(countryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([code, count]) => ({ code, count }));

        setData({
          totalOnline: profiles.length,
          countryCount: Object.keys(countryCounts).length,
          topCountries: sorted,
        });
      } catch (e) {
        console.warn("Community pulse error:", e);
      }
    };
    load();
  }, []);

  if (!data || data.totalOnline === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Globe size={16} className="text-primary" />
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          SeaMinds Community Right Now
        </p>
      </div>

      <p className="text-sm text-foreground mb-2">
        <span className="font-semibold">{data.totalOnline}</span> seafarer{data.totalOnline !== 1 ? "s" : ""} from{" "}
        <span className="font-semibold">{data.countryCount}</span> countr{data.countryCount !== 1 ? "ies" : "y"} online today
      </p>

      {data.topCountries.length > 0 && (
        <div className="flex items-center gap-3">
          {data.topCountries.map((c) => (
            <span key={c.code} className="text-sm">
              {countryToFlag(c.code)} <span className="text-muted-foreground text-xs">{c.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityPulse;
