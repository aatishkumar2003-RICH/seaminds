import { useCallback, useEffect, useState } from "react";
import { Coins, Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CREDIT_USES } from "@/lib/marketplaceSpecs";
import { TopUpPlans } from "@/components/CreditWallet";

export type MarketWallet = { balance: number; ship: number; spare: number; service: number; welcome: number; pending: boolean };
// Must stay bound to the client: a detached supabase.rpc throws "reading 'rest'" and hides the wallet.
const rpc = ((f: string, a?: unknown) => (supabase.rpc as any).call(supabase, f, a)) as (f: string, a?: unknown) => Promise<{ data: any; error: any }>;

export function useMarketWallet() {
  const [w, setW] = useState<MarketWallet | null>(null);
  const reload = useCallback(async () => { const { data } = await rpc("get_my_market_wallet"); if (data) setW(data); }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { wallet: w, reload };
}

const SupplierWallet = ({ wallet, reload }: { wallet: MarketWallet | null; reload: () => void }) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("250");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!wallet) return null;
  const send = async () => {
    setBusy(true);
    const { data, error } = await rpc("request_market_credits", { p_amount: Number(amount), p_reason: reason });
    setBusy(false);
    if (error || !data?.ok) {
      const e = data?.error;
      return toast.error(e === "pending_exists" ? "You already have a request under review." : e === "reason" ? "Tell us briefly what you plan to list." : e === "bad_amount" ? "Request between 1 and 5,000 credits." : "Could not send request.");
    }
    toast.success("Request sent. The SeaMinds team will review it soon.");
    setOpen(false); setReason(""); reload();
  };
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Supplier wallet</p>
          <p className="flex items-center gap-1.5 text-2xl font-bold text-foreground"><Coins size={20} className="text-primary" />{wallet.balance} credits</p>
          <p className="text-[11px] text-muted-foreground">Includes {wallet.welcome} free welcome credits. No payment needed during launch.</p>
        </div>
        <button disabled={wallet.pending} onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-xl border border-primary px-3 py-2 text-xs font-bold text-primary disabled:opacity-60">
          <Gift size={14} />{wallet.pending ? "Request pending" : "Request free credits"}
        </button>
      </div>
      <div className="mt-3 space-y-1 border-t border-primary/20 pt-3">
        <p className="text-xs font-bold text-foreground">What credits are used for</p>
        {CREDIT_USES.map((u) => (
          <div key={u.key} className="flex justify-between gap-2 text-[11px] text-muted-foreground"><span>{u.label}</span><b className="shrink-0 text-primary">{wallet[u.key]} cr</b></div>
        ))}
        <p className="text-[10px] text-muted-foreground">Credits are taken once when a listing is published. Editing or withdrawing your listing is free.</p>
      </div>
      <div className="mt-3 border-t border-primary/20 pt-3"><TopUpPlans audience="manager" /></div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-primary/20 pt-3">
          <label className="block space-y-1 text-[11px] text-muted-foreground">Credits needed
            <select value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-primary/30 bg-background px-3 py-2 text-sm text-foreground">
              {["100", "250", "500", "1000", "2500"].map((a) => <option key={a}>{a}</option>)}
            </select></label>
          <textarea rows={2} maxLength={600} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What will you list? e.g. 40 MAN B&W spares in Mumbai stock, 2 vessels for sale"
            className="w-full rounded-xl border border-primary/30 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
          <button disabled={busy} onClick={send} className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? "Sending…" : "Send request"}</button>
        </div>
      )}
    </div>
  );
};
export default SupplierWallet;
