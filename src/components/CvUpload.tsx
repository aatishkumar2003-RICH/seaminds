import { useState, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, FileText, Ship, GraduationCap, Stethoscope, Upload } from "lucide-react";

interface CvUploadProps {
  onParsed: (data: {
    firstName?: string;
    lastName?: string;
    nationality?: string;
    role?: string;
    yearsAtSea?: string;
    vesselImo?: string;
    shipName?: string;
    whatsappNumber?: string;
  }) => void;
  onFileReady?: (file: File) => void;
}

const RANK_MAP: Record<string, string> = {
  "Captain": "Captain",
  "Chief Officer": "Officer",
  "2nd Officer": "Officer",
  "3rd Officer": "Officer",
  "Chief Engineer": "Engineer",
  "2nd Engineer": "Engineer",
  "3rd Engineer": "Engineer",
  "4th Engineer": "Engineer",
  "ETO": "Engineer",
  "Bosun": "Rating",
  "AB Seaman": "Rating",
  "OS": "Rating",
  "Oiler": "Rating",
  "Cook": "Rating",
  "Steward": "Rating",
};

const YEARS_MAP: Record<string, string> = {
  "Less than 1 year": "Less than 1 year",
  "1-2 years": "1-3 years",
  "1-3 years": "1-3 years",
  "3-5 years": "3-7 years",
  "3-7 years": "3-7 years",
  "6-10 years": "7-15 years",
  "7-15 years": "7-15 years",
  "11-15 years": "7-15 years",
  "15+ years": "15+ years",
};

const CvUpload = ({ onParsed, onFileReady }: CvUploadProps) => {
  const [status, setStatus] = useState<"idle" | "reading" | "success" | "error">("idle");
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState({ certs: 0, service: 0, medical: 0, education: 0, name: "", rank: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fileRef.current?.click();
  };

  const handleFile = async (file: File) => {
    console.log('CV Upload: file selected', file?.name, file?.type, file?.size);
    setFileName(file.name);
    setStatus("reading");
    setErrorMsg("");

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

      setIsProcessing(true);
      let data: any, error: any;
      try {
        console.log('CV Upload: calling parse-cv-documents');
        const { data: { session } } = await supabase.auth.getSession();
        const result = await supabase.functions.invoke("parse-cv-documents", {
          body: { file_base64: base64, mime_type: file.type },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        data = result.data;
        error = result.error;
        console.log('CV Upload: response', data, error);
      } finally {
        setIsProcessing(false);
      }

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Could not read CV");
      }

      const cv = data.data?.personal || data.data || {};
      const mapped: Parameters<CvUploadProps["onParsed"]>[0] = {};

      if (cv.firstName) mapped.firstName = cv.firstName;
      if (cv.lastName) mapped.lastName = cv.lastName;
      if (cv.nationality) mapped.nationality = cv.nationality;
      if (cv.rank && RANK_MAP[cv.rank]) mapped.role = RANK_MAP[cv.rank];
      else if (cv.rank) mapped.role = cv.rank;
      if (cv.yearsAtSea) mapped.yearsAtSea = YEARS_MAP[cv.yearsAtSea] || cv.yearsAtSea;
      if (cv.imoNumber) mapped.vesselImo = cv.imoNumber;
      if (cv.currentVessel) mapped.shipName = cv.currentVessel;
      if (cv.phone) mapped.whatsappNumber = cv.phone;

      // Build summary for display
      const docData = data.data || {};
      setSummary({
        certs: (docData.certificates || []).length,
        service: (docData.sea_service || []).length,
        medical: (docData.medical || []).length,
        education: (docData.education || []).length,
        name: [cv.firstName, cv.lastName].filter(Boolean).join(" "),
        rank: cv.rank || "",
      });

      console.log('CV Upload: mapped personal data', mapped);
      onParsed(mapped);
      onFileReady?.(file);
      setStatus("success");
      trackEvent("cv_upload_success");

      // Also save structured document data to crew_cv_data
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.user?.id && data.data) {
          await supabase.from("crew_cv_data").upsert({
            user_id: s.user.id,
            certificates: (docData.certificates || []) as any,
            sea_service: (docData.sea_service || []) as any,
            medical: (docData.medical || []) as any,
            education: (docData.education || []) as any,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          console.log('CV Upload: document data saved to crew_cv_data');
        }
      } catch (saveErr) { console.log("CV data save (non-blocking):", saveErr); }
    } catch (e) {
      console.error("CV parse error:", e);
      setErrorMsg(e instanceof Error ? e.message : "Could not read CV. Please fill manually.");
      setStatus("error");
    }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />

      {/* Processing state */}
      {isProcessing && (
        <div className="rounded-xl p-5 text-center space-y-3" style={{ border: "1px solid hsl(var(--primary) / 0.3)", background: "hsl(var(--primary) / 0.05)" }}>
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-[3px] border-muted animate-spin" style={{ borderTopColor: "hsl(var(--primary))" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText size={16} className="text-primary" />
              </div>
            </div>
          </div>
          <p className="font-bold text-sm text-primary">🤖 AI is reading your CV...</p>
          <p className="text-xs text-muted-foreground">This may take 15–20 seconds</p>
          <div className="space-y-1.5 text-left max-w-xs mx-auto">
            {["Extracting personal details...", "Reading certificates...", "Identifying sea service..."].map((step, i) => (
              <div key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={10} className="animate-spin text-primary shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Idle state */}
      {!isProcessing && status === "idle" && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full rounded-xl p-5 text-center transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{
            border: "1px dashed hsl(var(--primary))",
            background: "hsl(var(--primary) / 0.05)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(var(--primary) / 0.15)" }}>
              <Upload size={20} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-primary">Upload Your CV</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF or photo — AI extracts certificates & sea service</p>
            </div>
          </div>
        </button>
      )}

      {/* Reading but not yet processing (file being read to base64) */}
      {!isProcessing && status === "reading" && (
        <div className="rounded-xl p-5 text-center" style={{ border: "1px solid hsl(var(--primary) / 0.3)", background: "hsl(var(--primary) / 0.05)" }}>
          <Loader2 size={20} className="animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Preparing {fileName}...</p>
        </div>
      )}

      {/* Success state with summary */}
      {!isProcessing && status === "success" && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(var(--primary) / 0.3)" }}>
          <div className="p-4 flex items-center gap-3" style={{ background: "hsl(var(--primary) / 0.1)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.2)" }}>
              <Check size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">✓ CV Parsed Successfully</p>
              {summary.name && (
                <p className="text-xs text-muted-foreground truncate">
                  {summary.name}{summary.rank ? ` · ${summary.rank}` : ""}
                </p>
              )}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-4 divide-x divide-border border-t border-border">
            {[
              { icon: <GraduationCap size={12} />, count: summary.certs, label: "Certs" },
              { icon: <Ship size={12} />, count: summary.service, label: "Service" },
              { icon: <Stethoscope size={12} />, count: summary.medical, label: "Medical" },
              { icon: <FileText size={12} />, count: summary.education, label: "Education" },
            ].map((item) => (
              <div key={item.label} className="py-2.5 px-2 text-center">
                <div className="flex justify-center text-primary mb-1">{item.icon}</div>
                <p className="text-sm font-bold text-foreground">{item.count}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Review your details below</p>
            <button onClick={handleClick} className="text-xs text-primary underline">Re-upload</button>
          </div>
        </div>
      )}

      {/* Error state */}
      {!isProcessing && status === "error" && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full rounded-xl p-5 text-center transition-all hover:opacity-90"
          style={{ border: "1px solid hsl(var(--destructive) / 0.3)", background: "hsl(var(--destructive) / 0.05)" }}
        >
          <p className="text-sm font-medium text-destructive">❌ {errorMsg}</p>
          <p className="text-xs text-muted-foreground mt-1">Tap to try again or fill manually</p>
        </button>
      )}
    </div>
  );
};

export default CvUpload;
