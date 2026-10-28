import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const REASONS: Record<string, string> = {
  insufficient_credits: "Not enough credits — invite shipmates or complete your profile to earn more.",
  no_profile: "Complete your Sea Profile first.",
  invalid_code: "Codes are 8 characters.",
  unknown_code: "That code was not found.",
  self_referral: "You cannot use your own code.",
  already_referred_or_not_crew: "A code is already linked to your account.",
};

/** Crew credit spending: Top-of-Desk boost + manual invite code. All checks happen on the server. */
const CrewCreditUses = ({ balance, onSpent }: { balance: number; onSpent: () => void }) => {
  const [until, setUntil] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    supabase.from("crew_boosts").select("boosted_until").maybeSingle().then(({ data }) => setUntil(data?.boosted_until ?? null));
  }, []);
  const active = until && new Date(until).getTime() > Date.now();

  const boost = async (days: 1 | 7) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("boost_my_profile", { p_days: days });
    setBusy(false);
    const r = data as { ok?: boolean; reason?: string; boosted_until?: string } | null;
    if (error || !r?.ok) return toast.error(REASONS[r?.reason ?? ""] || "Could not activate boost. Please try again.");
    setUntil(r.boosted_until ?? null);
    toast.success("⚡ Priority boost active", { description: "You now appear at the top of recruiters' crew search for your rank." });
    onSpent();
  };

  const redeem = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_referral", { p_code: code.trim() });
    setBusy(false);
    const r = data as { ok?: boolean; reason?: string } | null;
    if (error || !r?.ok) return toast.error(REASONS[r?.reason ?? ""] || "Could not apply code.");
    setCode("");
    toast.success("Code applied", { description: "Your shipmate earns a credit once you complete your profile." });
  };

  return (
    <>
      <div className="space-y-2 rounded-xl border border-primary/30 p-3">
        <p className="text-sm font-semibold text-primary">⚡ Top-of-Desk Priority</p>
        <p className="text-xs text-muted-foreground">Appear at the top of every recruiter's crew search for your rank, with a gold "Priority · Ready now" badge. Recruiters still need approval to see your contacts.</p>
        {active && <p className="text-xs font-bold text-primary">Active until {new Date(until!).toLocaleString()}</p>}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 rounded-xl font-bold" disabled={busy || balance < 1} onClick={() => boost(1)}>24h · 1 credit</Button>
          <Button size="sm" variant="outline" className="flex-1 rounded-xl border-primary text-primary font-bold" disabled={busy || balance < 5} onClick={() => boost(7)}>7 days · 5 credits</Button>
        </div>
        {active && <p className="text-[10px] text-muted-foreground">Buying again extends your current boost.</p>}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Have an invite code?</p>
        <div className="flex gap-2">
          <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="8-character code" className="font-mono" />
          <Button size="sm" variant="outline" disabled={busy || code.trim().length !== 8} onClick={redeem}>Apply</Button>
        </div>
      </div>
    </>
  );
};

export default CrewCreditUses;
