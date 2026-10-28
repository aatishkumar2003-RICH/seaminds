import { useCallback, useEffect, useState } from "react";
import { Coins, Copy, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CreditAudience, DEFAULT_REWARDS, RewardSettings, creditReasonLabel } from "@/lib/creditProgram";
import CompanyProfileEditor from "@/components/CompanyProfileEditor";
import CrewCreditUses from "@/components/CrewCreditUses";

type Wallet = { ok: boolean; user_id: string; balance: number; welcome_claimed: boolean; code: string; link: string; referrals: number; verified_referrals?: number; referral_credits?: number; profile_rewarded?: boolean; score_rewarded?: boolean; settings?: RewardSettings; recent?: { delta: number; reason: string; created_at: string }[] };

/** Gold wallet pill + Founder Launch dialog. Credits are complimentary; nothing is charged today. */
const CreditWallet = ({ audience, className = "" }: { audience: CreditAudience; className?: string }) => {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [open, setOpen] = useState(false);
  const [justGranted, setJustGranted] = useState(0);
  const [editingProfile, setEditingProfile] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_wallet");
    if (error) return null;
    return data as unknown as Wallet;
  }, []);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || !active) return;
      refreshing = true;
      try {
        let w = await load();
        if (!active || !w?.ok) return;
        if (!w.welcome_claimed) {
          const { data } = await supabase.rpc("claim_welcome_credits");
          const result = data as { granted?: boolean; amount?: number } | null;
          if (result?.granted) { if (active) setJustGranted(result.amount ?? 0); w = await load(); }
        }
        if (!active || !w?.ok) return;
        setWallet(w);
        // The wallet dialog opens only when the user taps the credits pill — never automatically.
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = window.setInterval(focus, 60000);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [load, audience]);

  if (!wallet) return null;

  const settings = wallet.settings ?? DEFAULT_REWARDS;
  const invite = audience !== "crew"
    ? `Colleagues at sea — SeaMinds is a free maritime platform with live vacancies worldwide, a professional CV builder and career tools. Join with my code ${wallet.code}: ${wallet.link}`
    : `Shipmates, take a look at SeaMinds — free vacancies worldwide, a professional CV builder and a private companion at sea. Join with my code ${wallet.code}: ${wallet.link}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(invite); toast.success("Invite copied"); } catch { toast.error("Could not copy — long-press the link instead"); }
  };

  return (
    <>
      <Button variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={`Credit wallet: ${wallet.balance} credits`}
        className={`inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 min-h-[36px] text-xs font-bold text-primary ${className}`}
      >
        <Coins size={14} /> {wallet.balance} credits
      </Button>

      <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { setJustGranted(0); try { localStorage.setItem(`sm_credit_reminder_${wallet.user_id}_${audience}`, String(Date.now())); } catch { /* optional storage */ } } }}>
        <DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto rounded-2xl border-primary/30 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary"><Gift size={18} /> {justGranted ? `Welcome aboard — ${justGranted} credits added` : "Your SeaMinds credits"}</DialogTitle>
            <DialogDescription className="text-left">
              Founder Launch Program: complimentary credits, never charged. SeaMinds remains free today. Credits are reserved for future {audience !== "crew" ? "vacancy ranking and urgent boosts" : "priority profile visibility"}; they never unlock crew search or contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-primary/30 bg-background/50 p-4 text-center">
            <p className="text-3xl font-bold text-primary">{wallet.balance}</p>
            <p className="text-xs text-muted-foreground">credits available</p>
          </div>

          <div className="rounded-xl border border-primary/20 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Welcome bonus</span><span className="font-bold text-foreground">{wallet.welcome_claimed ? "Received" : "Not claimed"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rewarded referrals ({wallet.verified_referrals ?? 0})</span><span className="font-bold text-foreground">{wallet.referral_credits ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Joined, profile pending</span><span className="font-bold text-foreground">{Math.max(0, wallet.referrals - (wallet.verified_referrals ?? 0))}</span></div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Earn more credits</p>
            <p className="text-xs text-muted-foreground">Milestone rewards are earned once, not for repeat edits or repeat scores.</p>
            {settings.profile_credits > 0 && <div className="flex items-center justify-between gap-2 text-xs border-b border-border py-2"><span>{audience === "crew" ? "Complete your CV & profile" : "Complete your company profile"} · +{settings.profile_credits}</span>{wallet.profile_rewarded ? <span className="text-primary">Earned</span> : <Button size="sm" variant="outline" onClick={() => { if (audience === "crew") { setOpen(false); navigate("/app?tab=cv"); } else setEditingProfile(!editingProfile); }}>Complete</Button>}</div>}
            {editingProfile && audience !== "crew" && <CompanyProfileEditor userId={wallet.user_id} onSaved={async () => { const updated = await load(); if (updated?.ok) setWallet(updated); setEditingProfile(false); }} />}
            {audience === "crew" && settings.score_credits > 0 && <div className="flex items-center justify-between gap-2 text-xs border-b border-border py-2"><span>Complete your first score · +{settings.score_credits}</span>{wallet.score_rewarded ? <span className="text-primary">Earned</span> : <Button size="sm" variant="outline" onClick={() => { setOpen(false); navigate("/app?tab=smc"); }}>My Score</Button>}</div>}
          </div>
          {audience === "crew" && <CrewCreditUses balance={wallet.balance} onSpent={async () => { const u = await load(); if (u?.ok) setWallet(u); }} />}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Invite shipmates, earn credits</p>
            <p className="text-xs text-muted-foreground">{settings.referral_credits > 0 ? `Earn ${settings.referral_credits} credit${settings.referral_credits === 1 ? "" : "s"} for every seafarer who joins` : "Invite a seafarer to join"} with your code <span className="font-mono font-bold text-primary">{wallet.code}</span> and completes their profile. Joining alone earns nothing.</p>
            <div className="flex gap-2">
              <Button asChild className="flex-1 rounded-xl font-bold"><a
                href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
                target="_blank" rel="noopener noreferrer"
              ><MessageCircle size={16} /> WhatsApp</a></Button>
              <Button variant="outline" onClick={copy} className="flex-1 rounded-xl border-primary text-primary font-bold"><Copy size={16} /> Copy link</Button>
            </div>
          </div>
          {!!wallet.recent?.length && <details className="text-xs"><summary className="cursor-pointer text-primary font-semibold">Recent credit activity</summary><ul className="space-y-2 mt-3">{wallet.recent.map((entry, index) => <li key={`${entry.created_at}-${index}`} className="flex justify-between gap-3"><span className="text-muted-foreground">{creditReasonLabel(entry.reason)}<br />{new Date(entry.created_at).toLocaleDateString()}</span><span>{entry.delta > 0 ? "+" : ""}{entry.delta}</span></li>)}</ul></details>}
          <p className="text-[10px] text-muted-foreground">Credits are complimentary and have no cash value. Self-referrals, disposable emails and duplicate accounts never earn credits.</p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreditWallet;
