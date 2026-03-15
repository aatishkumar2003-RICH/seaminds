import { useState } from "react";
import { AlertTriangle, User, Package, ArrowLeft, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ManagerAssessmentRequestProps {
  crewProfileId: string;
  crewName: string;
}

const BULK_PACKS = [
  { key: "pack_10", count: 10, price: 399, perUnit: 39.9, savings: "18%" },
  { key: "pack_25", count: 25, price: 849, perUnit: 33.96, savings: "31%" },
  { key: "pack_50", count: 50, price: 1499, perUnit: 29.98, savings: "39%" },
];

const ManagerAssessmentRequest = ({ crewProfileId, crewName }: ManagerAssessmentRequestProps) => {
  const [view, setView] = useState<"options" | "bulk">("options");
  const [loading, setLoading] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState<{type:string,value:number,label:string} | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [checkingCode, setCheckingCode] = useState(false);

  const basePrice = 49;
  const applyDiscount = (price: number) => discountApplied
    ? discountApplied.type === 'percent'
      ? Math.max(0, price - (price * discountApplied.value / 100))
      : Math.max(0, price - discountApplied.value)
    : price;
  const finalPrice = applyDiscount(basePrice);

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
    if (data.applies_to !== 'all' && data.applies_to !== 'manager_assessment') { setDiscountError('This code does not apply to this product.'); setCheckingCode(false); return; }
    const label = data.discount_type === 'percent' ? `${data.discount_value}% off` : `$${data.discount_value} off`;
    setDiscountApplied({ type: data.discount_type, value: Number(data.discount_value), label });
    setCheckingCode(false);
  };

  const incrementDiscountUses = async () => {
    if (!discountApplied || !discountCode) return;
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
  };

  const handlePayment = async (productKey: string, amount?: number) => {
    setLoading(productKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-smc-payment", {
        body: { product_key: productKey, crew_profile_id: crewProfileId, ...(amount !== undefined ? { amount } : {}) },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
      if (productKey === "manager_assessment") {
        await incrementDiscountUses();
      }
    } catch (err) {
      console.error("Payment error:", err);
    } finally {
      setLoading(null);
    }
  };

  const DiscountCodeInput = () => (
    <div style={{ marginBottom: '16px', marginTop: '8px' }}>
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
  );

  if (view === "bulk") {
    return (
      <div className="space-y-4">
        <button onClick={() => setView("options")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <h2 className="text-lg font-bold text-foreground">Assessment Pack Pricing</h2>
        <p className="text-sm text-muted-foreground">Best for manning agencies and fleet operators.</p>

        <div className="space-y-3">
          {BULK_PACKS.map((pack) => (
            <div key={pack.key} className="bg-secondary rounded-xl border border-border p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-lg font-bold text-foreground">{pack.count} Assessments</p>
                  <p className="text-xs text-muted-foreground">${pack.perUnit.toFixed(2)} per assessment</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">${pack.price}</p>
                  <span className="inline-block bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                    Save {pack.savings}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handlePayment(pack.key)}
                disabled={loading === pack.key}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {loading === pack.key ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {loading === pack.key ? "Processing..." : `Buy Now — $${pack.price}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Amber info box */}
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200">
          <span className="font-semibold">{crewName}</span> has not yet completed their SMC Assessment.
        </p>
      </div>

      {/* Discount code input */}
      <DiscountCodeInput />

      {/* Two option cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A */}
        <div className="bg-secondary rounded-xl border border-border p-5 space-y-3 flex flex-col">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <User size={20} className="text-primary" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            Request Assessment — {discountApplied && finalPrice < basePrice ? (
              <><span className="line-through text-muted-foreground">${basePrice}</span> <span className="text-primary">${finalPrice.toFixed(2)}</span></>
            ) : (
              `$${basePrice}`
            )}
          </h3>
          <p className="text-sm text-muted-foreground flex-1">
            We notify this crew member immediately. They complete assessment within 48 hours. You receive full 5-component score report and hire/hold recommendation.
          </p>
          <button
            onClick={() => handlePayment("manager_assessment", finalPrice)}
            disabled={loading === "manager_assessment"}
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading === "manager_assessment" ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            {loading === "manager_assessment" ? "Processing..." : `Pay $${finalPrice.toFixed(2)} — Request Assessment`}
          </button>
        </div>

        {/* Card B */}
        <div className="bg-secondary rounded-xl border border-primary/30 p-5 space-y-3 flex flex-col">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Package size={20} className="text-primary" />
          </div>
          <h3 className="text-base font-bold text-foreground">Buy Assessment Pack — Better Value</h3>
          <p className="text-sm text-muted-foreground flex-1">
            Purchase 10, 25, or 50 assessments for your crew pool. Best for manning agencies and fleet operators.
          </p>
          <button
            onClick={() => setView("bulk")}
            className="w-full bg-secondary border border-primary text-primary font-semibold py-3 rounded-xl hover:bg-primary/10 transition-colors"
          >
            View Bulk Pricing
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerAssessmentRequest;
