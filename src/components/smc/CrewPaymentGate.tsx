import { useState, useEffect } from "react";
import { Shield, Check, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CrewPaymentGateProps {
  profileId: string;
  onPaymentSuccess: () => void;
}

const BENEFITS = [
  { emoji: "✅", text: "Verified by AI — not self-reported" },
  { emoji: "✅", text: "Portable — yours forever, not owned by any company" },
  { emoji: "✅", text: "Commands higher salary — proven competence" },
];

const INCLUSIONS = [
  "45-minute AI assessment on WhatsApp",
  "Score on 5 competency dimensions — to 2 decimal places",
  "Digital certificate with verification URL",
  "Access to salary bidding marketplace",
];

const EARLY_ACCESS_TOTAL = 1000;

const CrewPaymentGate = ({ profileId, onPaymentSuccess }: CrewPaymentGateProps) => {
  const [loading, setLoading] = useState(false);
  const [earlyAccessUsed, setEarlyAccessUsed] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("smc_payments")
      .select("id", { count: "exact", head: true })
      .eq("payment_type", "early_access_free")
      .then(({ count }) => {
        setEarlyAccessUsed(count ?? 0);
      });
  }, []);

  const remaining = earlyAccessUsed !== null ? EARLY_ACCESS_TOTAL - earlyAccessUsed : null;
  const isEarlyAccess = remaining !== null && remaining > 0;

  const handleClaim = async () => {
    setLoading(true);
    if (isEarlyAccess) {
      // Navigate FIRST, database write in background
      onPaymentSuccess();
      try {
        await supabase.from("smc_payments").insert({
          crew_profile_id: profileId,
          amount_paid: 0,
          payment_type: "early_access_free",
          status: "completed",
          assessment_unlocked: true,
        });
      } catch (err) {
        console.log("Payment record error (non-blocking):", err);
      }
    } else {
      try {
        const { data, error } = await supabase.functions.invoke("create-smc-payment", {
          body: { product_key: "crew_assessment", crew_profile_id: profileId },
        });
        if (error) throw error;
        if (data?.url) {
          window.open(data.url, "_blank");
        }
      } catch (err) {
        console.error("Payment error:", err);
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center text-center pt-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
            <Shield size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Get Your SeaMinds Certified Score</h1>
        </div>

        {isEarlyAccess && (
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">🎯 Early Access — Free for First 1,000 Crew</p>
            <p className="text-lg font-bold text-primary gold-glow">{remaining} spots remaining</p>
          </div>
        )}

        <div className="space-y-3">
          {BENEFITS.map((b, i) => (
            <div key={i} className="bg-secondary rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-lg shrink-0">{b.emoji}</span>
              <p className="text-sm text-foreground font-medium">{b.text}</p>
            </div>
          ))}
        </div>

        <div className="text-center py-4">
          {isEarlyAccess ? (
            <>
              <p className="text-lg text-muted-foreground line-through">$29</p>
              <p className="text-5xl font-bold text-primary gold-glow">FREE</p>
              <p className="text-xs text-muted-foreground mt-2">Early Access · Limited to first 1,000 crew · No credit card needed</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold text-primary gold-glow">$29</p>
              <p className="text-xs text-muted-foreground mt-1">one-time payment · valid 2 years</p>
            </>
          )}
        </div>

        <div className="bg-secondary/50 rounded-xl border border-border p-4 space-y-3">
          {INCLUSIONS.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <Check size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{item}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleClaim}
          disabled={loading || remaining === null}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
          {loading ? "Processing..." : isEarlyAccess ? "Claim My Free Assessment" : "Pay $29 — Start My Assessment"}
        </button>

        {isEarlyAccess ? (
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            After 1,000 crew — standard price $29. Lock in your free assessment now.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Secure payment via Stripe · Visa · Mastercard · Apple Pay
          </p>
        )}
      </div>
    </div>
  );
};

export default CrewPaymentGate;
