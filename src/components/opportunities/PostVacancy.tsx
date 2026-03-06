import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

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

const PostVacancy = () => {
  const [rankRequired, setRankRequired] = useState("");
  const [vesselType, setVesselType] = useState("");
  const [contractDuration, setContractDuration] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [joiningPort, setJoiningPort] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [posting, setPosting] = useState(false);

  const wordCount = additionalNotes.trim().split(/\s+/).filter(Boolean).length;

  const handlePost = async () => {
    if (!rankRequired || !vesselType || !contractDuration || !joiningPort || !contactWhatsapp || !companyName) {
      toast({ title: "Missing Fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }

    if (wordCount > 100) {
      toast({ title: "Too Long", description: "Additional notes must be 100 words or less.", variant: "destructive" });
      return;
    }

    setPosting(true);

    const { error } = await supabase.from("job_postings" as any).insert({
      rank_required: rankRequired,
      vessel_type: vesselType,
      contract_duration: contractDuration,
      monthly_salary: monthlySalary || null,
      joining_port: joiningPort,
      contact_whatsapp: contactWhatsapp,
      company_name: companyName,
      additional_notes: additionalNotes || null,
    } as any);

    setPosting(false);

    if (error) {
      toast({ title: "Error", description: "Failed to post vacancy.", variant: "destructive" });
      return;
    }

    toast({ title: "✅ Vacancy Posted", description: "Vacancy posted successfully. Crew will see it in Available Positions." });
    setRankRequired("");
    setVesselType("");
    setContractDuration("");
    setMonthlySalary("");
    setJoiningPort("");
    setContactWhatsapp("");
    setCompanyName("");
    setAdditionalNotes("");
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="rounded-xl bg-card border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Post a Vacancy</h3>

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
          <label className="text-xs text-muted-foreground">Monthly Salary USD <span className="text-muted-foreground/60">(optional)</span></label>
          <Input value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} placeholder="e.g. 3500" className="text-sm" />
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

        <Button className="w-full" onClick={handlePost} disabled={posting}>
          {posting ? "Posting..." : "Post Vacancy"}
        </Button>
      </div>
    </div>
  );
};

export default PostVacancy;
