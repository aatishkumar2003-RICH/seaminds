import { useCallback, useEffect, useState } from "react";
import { Coins, Copy, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Wallet = { balance: number; welcome_claimed: boolean; code: string; link: string; referrals: number; verified_referrals?: number; referral_credits?: number };
type Audience = "crew" | "manager";

const LABEL: Record<string, string> = { welcome_launch: "Founder launch welcome", referral_joined: "Joined via invite", monthly_free: "Monthly free credits" };
const SEEN_KEY = "sm_welcome_credits_seen";

/** Gold wallet pill + Founder Launch dialog. Credits are complimentary; nothing is charged today. */
const CreditWallet = ({ audience, className = "" }: { audience: Audience; className?: string }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [open, setOpen] = useState(false);
  const [justGranted, setJustGranted] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_wallet" as any);
    const w = data as any;
    if (w?.ok) setWallet(w);
    return w;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const w = await load();
      if (!active || !w?.ok || w.welcome_claimed) return;
      const { data } = await supabase.rpc("claim_welcome_credits" as any);
      if (!active) return;
      if ((data as any)?.granted) {
        setJustGranted(true);
        await load();
        if (!localStorage.getItem(SEEN_KEY)) { setOpen(true); localStorage.setItem(SEEN_KEY, "1"); }
      }
    })();
    return () => { active = false; };
  }, [load]);

  if (!wallet) return null;

  const invite = audience === "manager"
    ? `Colleagues at sea — SeaMinds is a free maritime platform with live vacancies worldwide, a professional CV builder and career tools. Join with my code ${wallet.code}: ${wallet.link}`
    : `Shipmates, take a look at SeaMinds — free vacancies worldwide, a professional CV builder and a private companion at sea. Join with my code ${wallet.code}: ${wallet.link}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(invite); toast.success("Invite copied"); } catch { toast.error("Could not copy — long-press the link instead"); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Credit wallet: ${wallet.balance} credits`}
        className={`inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 min-h-[36px] text-xs font-bold text-primary ${className}`}
      >
        <Coins size={14} /> {wallet.balance} credits
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-primary/30 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary"><Gift size={18} /> {justGranted ? "Welcome aboard — 50 credits added" : "Your SeaMinds credits"}</DialogTitle>
            <DialogDescription className="text-left">
              Founder Launch Program: complimentary credits, never charged. Everything you use on SeaMinds today stays free — credits are reserved for {audience === "manager" ? "premium boosts like featured vacancies" : "premium boosts like priority job visibility"} as they launch.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-primary/30 bg-background/50 p-4 text-center">
            <p className="text-3xl font-bold text-primary">{wallet.balance}</p>
            <p className="text-xs text-muted-foreground">credits available</p>
          </div>

          <div className="rounded-xl border border-primary/20 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Welcome bonus</span><span className="font-bold text-foreground">{wallet.welcome_claimed ? 50 : 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Verified referrals ({wallet.verified_referrals ?? 0} × +1)</span><span className="font-bold text-foreground">{wallet.referral_credits ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Joined, profile pending</span><span className="font-bold text-foreground">{Math.max(0, wallet.referrals - (wallet.verified_referrals ?? 0))}</span></div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Invite shipmates, earn credits</p>
            <p className="text-xs text-muted-foreground">Earn 1 credit for every seafarer who joins with your code <span className="font-mono font-bold text-primary">{wallet.code}</span> and completes their profile.</p>
            <div className="flex gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold min-h-[44px] text-sm"
              ><MessageCircle size={16} /> WhatsApp</a>
              <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary text-primary font-bold min-h-[44px] text-sm"><Copy size={16} /> Copy link</button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Credits are complimentary and have no cash value. Self-referrals, disposable emails and duplicate accounts never earn credits.</p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreditWallet;
