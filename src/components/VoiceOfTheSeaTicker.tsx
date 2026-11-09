import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Item = { id: string; title: string; author_rank: string | null; author_vessel_type: string | null };

/** Read-only strip of the latest published crew dispatches (rank + vessel type only, no names). */
export default function VoiceOfTheSeaTicker() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    supabase
      .from("crew_dispatches")
      .select("id,title,author_rank,author_vessel_type")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setItems((data as Item[]) ?? []));
  }, []);
  if (!items.length) return null;
  const line = items
    .map((i) => `${[i.author_rank, i.author_vessel_type].filter(Boolean).join(" · ") || "Seafarer"}: ${i.title}`)
    .join("   ⚓   ");
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 overflow-hidden"
      style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)" }}
      aria-label="Voice of the Sea latest crew dispatches"
    >
      <Radio className="w-4 h-4 shrink-0" style={{ color: "#D4AF37" }} />
      <span className="text-[11px] font-bold shrink-0" style={{ color: "#D4AF37" }}>VOICE OF THE SEA</span>
      <div className="overflow-hidden flex-1">
        <div className="whitespace-nowrap text-xs animate-[votsMarquee_30s_linear_infinite]" style={{ color: "#E0E6ED" }}>
          {line}   ⚓   {line}
        </div>
      </div>
      <style>{`@keyframes votsMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}
