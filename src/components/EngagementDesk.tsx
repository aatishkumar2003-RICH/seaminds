import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Item { id: string; company_name: string | null; rank: string | null; vessel_type: string | null; outcome: string; viewed: boolean }

const STAGE: Record<string, string> = {
  awaiting: "Applied", shortlisted: "⭐ Shortlisted", offered: "📩 Offer received", accepted: "⏳ Processing",
};
const REASONS: [string, string][] = [
  ["berth_accepted", "I accepted another berth"],
  ["wage_mismatch", "Wage does not match"],
  ["joining_date", "Joining date does not suit me"],
  ["personal_leave", "Taking personal / shore leave"],
  ["other", "Other reason"],
];

/** Crew sees every company processing them and can politely step back from any of them. */
export default function EngagementDesk() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_engagements" as any);
    if (error) { setItems([]); return; }
    const d = data as any;
    setItems(d?.items || []); setPaused(!!d?.paused);
  }, []);
  useEffect(() => { load(); }, [load]);

  const disengage = async (id: string, reason: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("crew_disengage" as any, { p_application_id: id, p_reason: reason });
    setBusy(false); setPicking(null);
    if (error || !(data as any)?.ok) { toast.error((data as any)?.error || error?.message || "Could not update"); return; }
    toast.success("You have stepped back. The company can see this update.");
    load();
  };

  const togglePause = async () => {
    const next = !paused;
    const { error } = await supabase.rpc("set_inquiries_paused" as any, { p_paused: next });
    if (error) { toast.error(error.message); return; }
    setPaused(next);
    toast.success(next ? "New inquiries paused. Managers see you as paused." : "You are open to new inquiries again.");
  };

  if (!items) return null;

  return (
    <section className="mx-4 mb-4 space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-primary">🤝 Companies processing you</h2>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-foreground">{items.length}</span>
      </div>
      <button onClick={togglePause}
        className={`w-full rounded-xl py-2 text-sm font-bold ${paused ? "bg-primary text-primary-foreground" : "border border-primary text-primary"}`}>
        {paused ? "▶️ Resume new inquiries" : "⏸️ Pause new inquiries"}
      </button>
      {items.length === 0 && <p className="text-xs text-muted-foreground">No company is processing you right now.</p>}
      {items.map((i) => (
        <div key={i.id} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{i.company_name || "Company"}</p>
              <p className="text-xs text-muted-foreground">{[i.rank, i.vessel_type].filter(Boolean).join(" · ")}</p>
            </div>
            <span className="shrink-0 text-xs font-bold text-primary">{STAGE[i.outcome] || i.outcome}</span>
          </div>
          {picking === i.id ? (
            <div className="space-y-1">
              {REASONS.map(([k, l]) => (
                <button key={k} disabled={busy} onClick={() => disengage(i.id, k)}
                  className="w-full rounded-lg border border-border px-3 py-1.5 text-left text-xs text-foreground hover:bg-primary/10">{l}</button>
              ))}
              <button onClick={() => setPicking(null)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setPicking(i.id)} className="text-xs font-bold text-primary underline">✋ Step back from this company</button>
          )}
        </div>
      ))}
    </section>
  );
}
