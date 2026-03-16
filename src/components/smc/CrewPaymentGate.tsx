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
  const [basePrice, setBasePrice] = useState(29);
  const [earlyAccessUsed, setEarlyAccessUsed] = useState<number | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState<{type:string,value:number,label:string} | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [checkingCode, setCheckingCode] = useState(false);

  useEffect(() => {
    supabase
      .from("smc_payments")
      .select("id", { count: "exact", head: true })
      .eq("payment_type", "early_access_free")
      .then(({ count }) => {
        setEarlyAccessUsed(count ?? 0);
      });
  }, []);

  useEffect(() => {
    const fetchPrice = async () => {
      const { data: profile } = await supabase.from('crew_profiles').select('nationality').eq('id', profileId).single();
      const nationality = (profile?.nationality || '').toUpperCase().trim();
      const countryMap: Record<string,string> = {
        'PHILIPPINES':'PH','FILIPINO':'PH','INDONESIA':'ID','INDONESIAN':'ID',
        'INDIA':'IN','INDIAN':'IN','MYANMAR':'MM','BURMESE':'MM',
        'VIETNAM':'VN','VIETNAMESE':'VN','UKRAINE':'UA','UKRAINIAN':'UA',
        'RUSSIA':'RU','RUSSIAN':'RU','CHINA':'CN','CHINESE':'CN',
        'GREECE':'GR','GREEK':'GR','CROATIA':'HR','CROATIAN':'HR',
        'NIGERIA':'NG','NIGERIAN':'NG','BANGLADESH':'BD','BANGLADESHI':'BD',
      };
      const code = countryMap[nationality] || 'DEFAULT';
      const { data: cp } = await supabase.from('country_pricing').select('price_self_assessment').eq('country_code', code).eq('active', true).maybeSingle();
      if (cp?.price_self_assessment) { setBasePrice(Number(cp.price_self_assessment)); return; }
      const { data: def } = await supabase.from('country_pricing').select('price_self_assessment').eq('country_code', 'DEFAULT').single();
      if (def?.price_self_assessment) setBasePrice(Number(def.price_self_assessment));
    };
    if (profileId) fetchPrice();
  }, [profileId]);

  const remaining = earlyAccessUsed !== null ? EARLY_ACCESS_TOTAL - earlyAccessUsed : null;
  const isEarlyAccess = remaining !== null && remaining > 0;
  const finalPrice = discountApplied
    ? discountApplied.type === 'percent'
      ? Math.max(0, basePrice - (basePrice * discountApplied.value / 100))
      : Math.max(0, basePrice - discountApplied.value)
    : basePrice;

  const applyDiscountCode = async () => {
    if (!discountCode.trim()) return;
    setCheckingCode(true);
    setDiscountError('');
    const { data } = await supabase.from('discount_codes')
      .select('*')
      .eq('code', discountCode.trim().toUpperCase())
      .eq('active', true)
      .maybeSingle();
    if (!data) { setDiscountError('Invalid or expired code.'); setCheckingCode(false); return; }
    if (data.valid_until && new Date(data.valid_until) < new Date()) { setDiscountError('This code has expired.'); setCheckingCode(false); return; }
    if (data.max_uses !== null && (data.uses_count ?? 0) >= data.max_uses) { setDiscountError('This code has reached its maximum uses.'); setCheckingCode(false); return; }
    if (data.applies_to !== 'all' && data.applies_to !== 'self_assessment') { setDiscountError('This code does not apply to this product.'); setCheckingCode(false); return; }
    const label = data.discount_type === 'percent' ? `${data.discount_value}% off` : `$${data.discount_value} off`;
    setDiscountApplied({ type: data.discount_type, value: Number(data.discount_value), label });
    setCheckingCode(false);
  };

  const handleClaim = async () => {
    setLoading(true);
    if (isEarlyAccess) {
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
          body: { product_key: "crew_assessment", crew_profile_id: profileId, amount: finalPrice },
        });
        if (error) throw error;
        if (data?.url) {
          window.open(data.url, "_blank");
        }
        // Increment discount code uses on successful payment initiation
        if (discountApplied && discountCode) {
          const codeUpper = discountCode.trim().toUpperCase();
          const { data: codeRow } = await supabase.from('discount_codes')
            .select('uses_count')
            .eq('code', codeUpper)
            .maybeSingle();
          if (codeRow) {
            await supabase.from('discount_codes')
              .update({ uses_count: (codeRow.uses_count ?? 0) + 1 })
              .eq('code', codeUpper);
          }
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
              <p className="text-lg text-muted-foreground line-through">${basePrice}</p>
              <p className="text-5xl font-bold text-primary gold-glow">FREE</p>
              <p className="text-xs text-muted-foreground mt-2">Early Access · Limited to first 1,000 crew · No credit card needed</p>
            </>
          ) : (
            <>
              {discountApplied && finalPrice < basePrice ? (
                <>
                  <p className="text-lg text-muted-foreground line-through">${basePrice}</p>
                  <p className="text-4xl font-bold text-primary gold-glow">${finalPrice.toFixed(2)}</p>
                  <p className="text-xs mt-1" style={{ color: '#2ecc71' }}>{discountApplied.label}</p>
                </>
              ) : (
                <p className="text-4xl font-bold text-primary gold-glow">${basePrice}</p>
              )}
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

        {/* Discount code input — only show when not early access */}
        {!isEarlyAccess && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <input
                value={discountCode}
                onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountApplied(null); setDiscountError(''); }}
                placeholder="Discount code (optional)"
                style={{ flex:1, background:'#1a2e47', border:'1px solid #D4AF37', color:'white', padding:'8px 12px', borderRadius:'6px', fontSize:'13px' }}
              />
              <button onClick={applyDiscountCode} disabled={checkingCode}
                style={{ background:'#D4AF37', color:'#0D1B2A', border:'none', padding:'8px 16px', borderRadius:'6px', fontWeight:'bold', cursor:'pointer', fontSize:'13px' }}>
                {checkingCode ? '...' : 'Apply'}
              </button>
            </div>
            {discountError && <div style={{ color:'#e74c3c', fontSize:'12px' }}>{discountError}</div>}
            {discountApplied && <div style={{ color:'#2ecc71', fontSize:'12px' }}>✓ {discountApplied.label} applied!</div>}
          </div>
        )}

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
          {loading ? "Processing..." : isEarlyAccess ? "Claim My Free Assessment" : `Pay $${finalPrice.toFixed(2)} — Start My Assessment`}
        </button>

        {isEarlyAccess ? (
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            After 1,000 crew — standard price ${basePrice}. Lock in your free assessment now.
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
