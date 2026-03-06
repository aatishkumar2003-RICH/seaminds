import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { UploadCloud, CheckCircle, Loader2 } from "lucide-react";

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

      const fuzzyMatch = (input: string, options: string[]): string | null => {
        const lower = input.toLowerCase().trim();
        // Exact match
        const exact = options.find((o) => o.toLowerCase() === lower);
        if (exact) return exact;
        // Contains match (option contains input or input contains option)
        const contains = options.find(
          (o) => o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase())
        );
        if (contains) return contains;
        // Word overlap scoring
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
        const match = fuzzyMatch(r.rankRequired, RANKS);
        if (match) setRankRequired(match);
      }
      if (r.vesselType) {
        const match = fuzzyMatch(r.vesselType, VESSEL_TYPES);
        if (match) setVesselType(match);
      }
      if (r.contractDuration) {
        const match = fuzzyMatch(r.contractDuration, DURATIONS);
        if (match) setContractDuration(match);
      }
      if (r.monthlySalary) setMonthlySalary(r.monthlySalary);
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
    setUploadedFileName("");
    setAiSuccess(false);
  };

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
