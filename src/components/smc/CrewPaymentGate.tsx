import { useState } from "react";
import { Shield, Check, CreditCard, Loader2 } from "lucide-react";
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

const CrewPaymentGate = ({ profileId, onPaymentSuccess }: CrewPaymentGateProps) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Payment confirmed</h2>
        <p className="text-sm text-muted-foreground mb-6">Your assessment is now unlocked</p>
        <button
          onClick={onPaymentSuccess}
          className="bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl"
        >
          Start My Assessment
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Shield icon & heading */}
        <div className="flex flex-col items-center text-center pt-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
            <Shield size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Get Your SeaMinds Certified Score</h1>
        </div>

        {/* Benefit cards */}
        <div className="space-y-3">
          {BENEFITS.map((b, i) => (
            <div key={i} className="bg-secondary rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-lg shrink-0">{b.emoji}</span>
              <p className="text-sm text-foreground font-medium">{b.text}</p>
            </div>
          ))}
        </div>

        {/* Price */}
        <div className="text-center py-4">
          <p className="text-4xl font-bold text-primary gold-glow">$29</p>
          <p className="text-xs text-muted-foreground mt-1">one-time payment · valid 2 years</p>
        </div>

        {/* Inclusions */}
        <div className="bg-secondary/50 rounded-xl border border-border p-4 space-y-3">
          {INCLUSIONS.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <Check size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{item}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CreditCard size={18} />
          )}
          {loading ? "Processing..." : "Pay $29 — Start My Assessment"}
        </button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Secure payment via Stripe · Visa · Mastercard · Apple Pay
        </p>
      </div>
    </div>
  );
};

export default CrewPaymentGate;
