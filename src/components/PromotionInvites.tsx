import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Invite = { id: string; company_name: string | null; current_rank: string; target_rank: string; note: string | null };

/** Promotion assessment requests from a company, shown at the top of the crew's next actions. */
export default function PromotionInvites() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Invite[]>([]);
  const load = async () => {
    const { data } = await (supabase as any).from("promotion_invites").select("id, company_name, current_rank, target_rank, note").eq("status", "pending").order("created_at", { ascending: false }).limit(5);
    setItems(data || []);
  };
  useEffect(() => { void load(); }, []);
  const decline = async (id: string) => {
    const { error } = await supabase.rpc("crew_decline_promotion" as any, { p_invite: id });
    if (error) { toast.error("Could not decline. Please retry."); return; }
    toast.success("Request declined."); void load();
  };
  if (!items.length) return null;
  return <>{items.map(i => (
    <div key={i.id} className="rounded-2xl border-2 border-primary bg-card p-4 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-primary">🎓 Promotion assessment</p>
      <p className="text-sm font-semibold text-foreground">{i.company_name || "Your company"} · {i.current_rank} → {i.target_rank}</p>
      {i.note && <p className="text-xs italic text-muted-foreground">“{i.note}”</p>}
      <p className="text-xs text-muted-foreground">About 12–15 minutes, up to 7 scenarios. Your result goes only to this company.</p>
      <div className="flex gap-2">
        <button onClick={() => navigate(`/maritime-interview?promo=${i.id}`)} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">🚀 Start assessment</button>
        <button onClick={() => decline(i.id)} className="rounded-xl border border-border px-3 text-xs text-muted-foreground">Not now</button>
      </div>
    </div>
  ))}</>;
}
