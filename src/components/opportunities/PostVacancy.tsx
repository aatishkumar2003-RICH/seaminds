import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { UploadCloud, CheckCircle, Loader2, Star, X } from "lucide-react";

const RANKS = [
  "Captain", "Chief Officer", "2nd Officer", "3rd Officer",
  "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer",
  "ETO", "Bosun", "AB Seaman", "OS", "Oiler", "Cook", "Steward", "Any Rank",
];

const VESSEL_TYPES = [
  "Bulk Carrier", "Container", "Tanker (Oil)", "Tanker (Chemical)",
  "LNG/LPG", "RORO", "General Cargo", "Offshore", "Cruise", "Tug", "Any Type",
];

const DURATIONS = [
  "1-2 months", "3-4 months", "5-6 months", "7-8 months", "9-12 months", "Permanent",
];

type PricingPlan = "single" | "monthly" | "annual";

const PLANS: { id: PricingPlan; name: string; price: string; desc: string; popular?: boolean }[] = [
  { id: "single", name: "Single Post", price: "$19", desc: "1 vacancy, visible 30 days" },
  { id: "monthly", name: "Monthly", price: "$99/month", desc: "Unlimited posts for 30 days", popular: true },
  { id: "annual", name: "Annual", price: "$799/year", desc: "Unlimited posts, 12 months" },
];

const PostVacancy = () => {
  const [rankRequired, setRankRequired] = useState("");
  const [vesselType, setVesselType] = useState("");
  const [contractDuration, setContractDuration] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryNegotiable, setSalaryNegotiable] = useState(false);
  const [joiningPort, setJoiningPort] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [posting, setPosting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>("single");
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [uploadedFileName, setUploadedFileName] = useState("");
  const [aiReading, setAiReading] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = additionalNotes.trim().split(/\s+/).filter(Boolean).length;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setAiReading(true);
    setAiSuccess(false);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-flier", {
        body: { imageBase64: base64, mimeType: file.type },
      });

      if (error || !data?.result) {
        throw new Error("Failed");
      }

      const r = data.result;

      const RANK_ALIASES: Record<string, string> = {
        "c/e": "Chief Engineer", "ce": "Chief Engineer", "chief eng": "Chief Engineer",
        "c/o": "Chief Officer", "co": "Chief Officer", "chief off": "Chief Officer", "chief mate": "Chief Officer",
        "2/o": "2nd Officer", "2o": "2nd Officer", "second officer": "2nd Officer", "2nd mate": "2nd Officer",
        "3/o": "3rd Officer", "3o": "3rd Officer", "third officer": "3rd Officer", "3rd mate": "3rd Officer",
        "2/e": "2nd Engineer", "2e": "2nd Engineer", "second engineer": "2nd Engineer",
        "3/e": "3rd Engineer", "3e": "3rd Engineer", "third engineer": "3rd Engineer",
        "4/e": "4th Engineer", "4e": "4th Engineer", "fourth engineer": "4th Engineer",
        "master": "Captain", "capt": "Captain",
        "ab": "AB Seaman", "able seaman": "AB Seaman", "able bodied": "AB Seaman",
        "os": "OS", "ordinary seaman": "OS",
        "eto": "ETO", "electro technical officer": "ETO",
        "bsn": "Bosun", "boatswain": "Bosun",
      };

      const VESSEL_ALIASES: Record<string, string> = {
        "bulker": "Bulk Carrier", "bulk": "Bulk Carrier",
        "container ship": "Container", "containership": "Container",
        "oil tanker": "Tanker (Oil)", "crude tanker": "Tanker (Oil)", "product tanker": "Tanker (Oil)",
        "chemical tanker": "Tanker (Chemical)", "chem tanker": "Tanker (Chemical)",
        "lng": "LNG/LPG", "lpg": "LNG/LPG", "gas carrier": "LNG/LPG", "lng carrier": "LNG/LPG",
        "ro-ro": "RORO", "ro ro": "RORO", "roll on": "RORO",
        "general cargo ship": "General Cargo", "gencargo": "General Cargo",
        "offshore vessel": "Offshore", "osv": "Offshore", "ahts": "Offshore", "psv": "Offshore",
        "cruise ship": "Cruise", "passenger": "Cruise",
        "tugboat": "Tug", "tug boat": "Tug",
      };

      const DURATION_ALIASES: Record<string, string> = {
        "1 month": "1-2 months", "2 months": "1-2 months",
        "3 months": "3-4 months", "4 months": "3-4 months",
        "5 months": "5-6 months", "6 months": "5-6 months",
        "7 months": "7-8 months", "8 months": "7-8 months",
        "9 months": "9-12 months", "10 months": "9-12 months", "11 months": "9-12 months", "12 months": "9-12 months",
        "1 year": "9-12 months", "permanent contract": "Permanent", "full time": "Permanent",
      };

      const fuzzyMatch = (input: string, options: string[], aliases?: Record<string, string>): string | null => {
        const lower = input.toLowerCase().trim();
        if (aliases && aliases[lower]) return aliases[lower];
        const exact = options.find((o) => o.toLowerCase() === lower);
        if (exact) return exact;
        const contains = options.find(
          (o) => o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase())
        );
        if (contains) return contains;
        if (aliases) {
          for (const [alias, mapped] of Object.entries(aliases)) {
            if (lower.includes(alias) || alias.includes(lower)) return mapped;
          }
        }
        const inputWords = lower.split(/[\s\-\/()]+/).filter(Boolean);
        let bestScore = 0;
        let bestMatch: string | null = null;
        for (const option of options) {
          const optWords = option.toLowerCase().split(/[\s\-\/()]+/).filter(Boolean);
          const overlap = inputWords.filter((w) => optWords.some((ow) => ow.includes(w) || w.includes(ow))).length;
          const score = overlap / Math.max(inputWords.length, optWords.length);
          if (score > bestScore && score >= 0.4) {
            bestScore = score;
            bestMatch = option;
          }
        }
        return bestMatch;
      };

      if (r.rankRequired) {
        const match = fuzzyMatch(r.rankRequired, RANKS, RANK_ALIASES);
        if (match) setRankRequired(match);
      }
      if (r.vesselType) {
        const match = fuzzyMatch(r.vesselType, VESSEL_TYPES, VESSEL_ALIASES);
        if (match) setVesselType(match);
      }
      if (r.contractDuration) {
        const match = fuzzyMatch(r.contractDuration, DURATIONS, DURATION_ALIASES);
        if (match) setContractDuration(match);
      }
      if (r.monthlySalary) { const nums = r.monthlySalary.replace(/[^0-9\-]/g, "").split("-"); if (nums[0]) setSalaryMin(nums[0]); if (nums[1]) setSalaryMax(nums[1]); }
      if (r.joiningPort) setJoiningPort(r.joiningPort);
      if (r.companyName) setCompanyName(r.companyName);
      if (r.contactWhatsapp) setContactWhatsapp(r.contactWhatsapp);
      if (r.additionalNotes) setAdditionalNotes(r.additionalNotes);

      setAiSuccess(true);
      toast({ title: "✓ Flier read successfully", description: "Please review and edit the fields below." });
    } catch {
      toast({ title: "Could not read flier", description: "Please fill fields manually.", variant: "destructive" });
    } finally {
      setAiReading(false);
    }
  };

  const handlePostClick = () => {
    if (!rankRequired || !vesselType || !contractDuration || !joiningPort || !contactWhatsapp || !companyName) {
      toast({ title: "Missing Fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    if (wordCount > 100) {
      toast({ title: "Too Long", description: "Additional notes must be 100 words or less.", variant: "destructive" });
      return;
    }
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
    setPosting(true);

    const { error } = await supabase.from("job_postings" as any).insert({
      rank_required: rankRequired,
      vessel_type: vesselType,
      contract_duration: contractDuration,
      monthly_salary: salaryNegotiable ? "Negotiable" : (salaryMin && salaryMax ? `$${salaryMin}–$${salaryMax}/mo` : salaryMin ? `From $${salaryMin}/mo` : null),
      joining_port: joiningPort,
      contact_whatsapp: contactWhatsapp,
      company_name: companyName,
      additional_notes: additionalNotes || null,
      status: "pending_payment",
      plan: selectedPlan,
    } as any);

    setPosting(false);

    if (error) {
      toast({ title: "Error", description: "Failed to submit vacancy.", variant: "destructive" });
      return;
    }

    setShowPaymentModal(false);
    toast({ title: "✅ Received!", description: "Your vacancy goes live within 2 hours after payment confirmation." });
    setRankRequired("");
    setVesselType("");
    setContractDuration("");
    setSalaryMin(""); setSalaryMax(""); setSalaryNegotiable(false);
    setJoiningPort("");
    setContactWhatsapp("");
    setCompanyName("");
    setAdditionalNotes("");
    setUploadedFileName("");
    setAiSuccess(false);
    setSelectedPlan("single");
  };

  const currentPlan = PLANS.find((p) => p.id === selectedPlan)!;

  return (
    <div className="space-y-4 pt-3">
      <div className="rounded-xl bg-card border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Post a Vacancy</h3>

        {/* Flier Upload */}
        <div
          onClick={() => !aiReading && fileInputRef.current?.click()}
          className="rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-5 px-4 gap-2 transition-colors"
          style={{ borderColor: "#1a3a5c", background: "rgba(26, 58, 92, 0.15)" }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          {aiReading ? (
            <>
              <Loader2 size={28} className="text-green-400 animate-spin" />
              <p className="text-green-400 text-sm font-medium">AI Reading Flier...</p>
              <p className="text-muted-foreground text-[11px]">{uploadedFileName}</p>
            </>
          ) : aiSuccess ? (
            <>
              <CheckCircle size={28} className="text-green-400" />
              <p className="text-green-400 text-sm font-medium">✓ Flier read successfully</p>
              <p className="text-muted-foreground text-[11px]">{uploadedFileName}</p>
            </>
          ) : (
            <>
              <UploadCloud size={28} className="text-muted-foreground" />
              <p className="text-foreground text-sm font-medium">Upload Job Flier (PDF or Image)</p>
              <p className="text-muted-foreground text-[11px]">AI will read your flier and fill the form automatically</p>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Rank Required *</label>
          <Select value={rankRequired} onValueChange={setRankRequired}>
            <SelectTrigger><SelectValue placeholder="Select rank" /></SelectTrigger>
            <SelectContent>
              {RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Vessel Type *</label>
          <Select value={vesselType} onValueChange={setVesselType}>
            <SelectTrigger><SelectValue placeholder="Select vessel type" /></SelectTrigger>
            <SelectContent>
              {VESSEL_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Contract Duration *</label>
          <Select value={contractDuration} onValueChange={setContractDuration}>
            <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Monthly Salary Range USD <span className="text-muted-foreground/60">(optional)</span></label>
          <div className="flex items-center gap-2">
            <Input
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Min e.g. 3000"
              className="text-sm"
              disabled={salaryNegotiable}
            />
            <span className="text-muted-foreground text-sm font-medium">—</span>
            <Input
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Max e.g. 5000"
              className="text-sm"
              disabled={salaryNegotiable}
            />
          </div>
          <button
            type="button"
            onClick={() => { setSalaryNegotiable(!salaryNegotiable); setSalaryMin(""); setSalaryMax(""); }}
            className="flex items-center gap-2 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
              style={{ borderColor: salaryNegotiable ? '#D4AF37' : 'var(--border)', background: salaryNegotiable ? '#D4AF37' : 'transparent' }}>
              {salaryNegotiable && <span style={{ color: '#0D1B2A', fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>✓</span>}
            </div>
            Negotiable / Undisclosed
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Joining Port *</label>
          <Input value={joiningPort} onChange={(e) => setJoiningPort(e.target.value)} placeholder="e.g. Singapore, Manila, Mumbai" className="text-sm" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">WhatsApp for Applications *</label>
          <Input value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} placeholder="e.g. +6512345678" className="text-sm" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Company Name *</label>
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Pacific Shipping Co." className="text-sm" />
          <p className="text-[10px] text-muted-foreground">After payment verification, your company receives a ✓ Verified badge on all listings. Crew trust verified companies.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Additional Notes <span className="text-muted-foreground/60">(optional, max 100 words)</span></label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Any specific requirements..."
            rows={3}
            className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <p className={`text-[10px] ${wordCount > 100 ? "text-destructive" : "text-muted-foreground"}`}>{wordCount}/100 words</p>
        </div>

        {/* Pricing Cards */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Select Plan</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className="relative rounded-xl p-4 text-left transition-all"
                style={{
                  border: selectedPlan === plan.id
                    ? "2px solid #D4AF37"
                    : plan.popular
                    ? "1px solid rgba(212, 175, 55, 0.4)"
                    : "1px solid hsl(var(--border))",
                  background: selectedPlan === plan.id
                    ? "rgba(212, 175, 55, 0.08)"
                    : "hsl(var(--secondary))",
                }}
              >
                {plan.popular && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#D4AF37", color: "#0a1929" }}
                  >
                    <Star size={10} fill="currentColor" /> POPULAR
                  </span>
                )}
                <div className="text-lg font-bold text-foreground">{plan.price}</div>
                <div className="text-sm font-medium text-foreground mt-0.5">{plan.name}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{plan.desc}</div>
                <div
                  className="mt-3 text-center text-xs font-semibold py-1.5 rounded-lg transition-colors"
                  style={{
                    background: selectedPlan === plan.id ? "#D4AF37" : "hsl(var(--muted))",
                    color: selectedPlan === plan.id ? "#0a1929" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {selectedPlan === plan.id ? "✓ Selected" : "Select"}
                </div>
              </button>
            ))}
          </div>
        </div>

        <Button className="w-full" onClick={handlePostClick} disabled={posting}>
          {posting ? "Submitting..." : "Post Vacancy →"}
        </Button>
      </div>

      {/* Payment Instruction Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="relative w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-3 right-3"
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} className="text-muted-foreground" />
            </button>

            <h3 className="text-base font-bold text-foreground">Your vacancy is ready to publish.</h3>

            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(212, 175, 55, 0.1)", border: "1px solid rgba(212, 175, 55, 0.3)" }}
            >
              <p className="text-sm text-foreground font-medium">
                Selected Plan: {currentPlan.name} — {currentPlan.price}
              </p>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Pay via PayPal to: <strong className="text-foreground">info@indossol.com</strong>
              </p>
              <p>
                Reference: <strong className="text-foreground">{companyName || "Company"} - {rankRequired || "Rank"}</strong>
              </p>
              <p>After payment, your vacancy goes live within 2 hours.</p>
              <p>
                Send payment proof via WhatsApp:<br />
                <strong className="text-foreground">+62-85219878989</strong>
              </p>
              <p>
                Questions: <strong className="text-foreground">info@indossol.com</strong>
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleConfirmPayment}
                disabled={posting}
                className="w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                style={{ background: "#D4AF37", color: "#0a1929" }}
              >
                {posting ? "Submitting..." : "I Have Paid — Submit for Review"}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-muted-foreground"
                style={{ background: "hsl(var(--muted))" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostVacancy;
