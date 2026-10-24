import { useState } from "react";
import { Anchor, Ship, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { OperatingModel } from "@/lib/fleetCockpit";

const OPTIONS: { id: OperatingModel; icon: typeof Ship; title: string; who: string; points: string[] }[] = [
  {
    id: "crewing_agency", icon: Anchor, title: "Crewing Agency / Manning Office",
    who: "You supply seafarers to ships run by other managers or owners — one crew here, two crew there.",
    points: ["Overview by vessel and principal", "Lineup, relievers, contracts and wages", "Safe manning off — switch it on only for ships where you supply the full crew"],
  },
  {
    id: "ship_manager", icon: Ship, title: "Ship Owner / Full Ship Manager",
    who: "You own or fully manage the vessels and are responsible for the whole crew onboard.",
    points: ["Everything in Crewing Agency", "Safe manning check on every vessel", "Warnings when Master, Chief Engineer, Chief Officer or 2nd Engineer is missing"],
  },
];

export default function OperatingModelPicker({ current, onSaved, onCancel }: { current: OperatingModel | null; onSaved: (m: OperatingModel) => void; onCancel?: () => void }) {
  const [pick, setPick] = useState<OperatingModel | null>(current);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!pick) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("crew_workspace_settings").upsert({ manager_id: u.user?.id, operating_model: pick, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error("Could not save your choice. Please retry."); return; }
    toast.success("Workspace set up");
    onSaved(pick);
  };
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-5 lg:p-8 space-y-5">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-primary">How does your company work?</h2>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-primary text-primary">Pro suite</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">We set up your crew desk to match. You can change this any time. Complimentary during the SeaMinds launch.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {OPTIONS.map(o => (
          <button key={o.id} onClick={() => setPick(o.id)} className={`text-left rounded-xl border p-5 space-y-3 transition-colors ${pick === o.id ? "border-primary ring-2 ring-primary bg-secondary" : "border-border hover:border-primary/50"}`}>
            <div className="flex items-center gap-2"><o.icon className="text-primary" size={20} /><span className="font-bold text-foreground">{o.title}</span>{pick === o.id && <Check size={18} className="ml-auto text-primary" />}</div>
            <p className="text-sm text-muted-foreground">{o.who}</p>
            <ul className="space-y-1">{o.points.map(p => <li key={p} className="text-xs text-foreground flex gap-1.5"><Check size={13} className="text-primary shrink-0 mt-0.5" />{p}</li>)}</ul>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Agency that crews some ships fully? Choose Crewing Agency and turn on safe manning just for those ships.</p>
      <div className="flex gap-2 justify-end">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button disabled={!pick || busy} onClick={save} className="font-bold rounded-xl">{busy ? "Saving…" : "Continue"}</Button>
      </div>
    </div>
  );
}
