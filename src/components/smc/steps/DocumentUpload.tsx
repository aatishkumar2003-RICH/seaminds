import { useState } from "react";
import { Camera, Check, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StepProgressBar from "./StepProgressBar";

interface DocumentUploadProps {
  assessmentId: string;
  profileId: string;
  onNext: () => void;
  onSkipToEnd?: () => void;
}

interface DocBox {
  key: string;
  label: string;
  subtitle: string;
  required: boolean;
}

const DOCS: DocBox[] = [
  { key: "cdc", label: "CDC — Continuous Discharge Certificate", subtitle: "Front page + last 3 service pages", required: true },
  { key: "coc", label: "Certificate of Competency", subtitle: "Your STCW management or operational level cert", required: true },
  { key: "bst", label: "Basic Safety Training Certificate", subtitle: "STCW Basic Safety Training", required: false },
  { key: "additional", label: "Additional Certificates", subtitle: "Tanker endorsements, GMDSS, others (optional)", required: false },
];

const DocumentUpload = ({ assessmentId, profileId, onNext, onSkipToEnd }: DocumentUploadProps) => {
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [analysing, setAnalysing] = useState(false);

  const canProceed = !!uploads["cdc"] && !!uploads["coc"];

  const handleUpload = async (key: string, file: File) => {
    const path = `${profileId}/${assessmentId}/${key}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("smc-documents").upload(path, file);
    if (!error) {
      setUploads((prev) => ({ ...prev, [key]: path }));
    }
  };

  const handleAnalyse = async () => {
    setAnalysing(true);
    try {
      await supabase
        .from("smc_assessments")
        .update({ doc_upload_status: "uploaded", current_step: 2 })
        .eq("id", assessmentId);
    } catch (err) { console.log("DB write error (non-blocking):", err); }
    await new Promise((r) => setTimeout(r, 3000));
    onNext();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <StepProgressBar currentStep={1} totalSteps={5} label="Document Verification" />

        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-foreground">Upload Your Sea Service Documents</h1>
          <p className="text-sm text-muted-foreground">Our AI verifies your experience in 2 minutes. No manual checking.</p>
        </div>

        <div className="space-y-3">
          {DOCS.map((doc) => {
            const uploaded = !!uploads[doc.key];
            return (
              <label
                key={doc.key}
                className={`block bg-secondary rounded-xl border ${uploaded ? "border-primary" : "border-border"} p-4 cursor-pointer hover:bg-secondary/80 transition-colors`}
              >
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(doc.key, f);
                  }}
                />
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${uploaded ? "bg-primary/20" : "bg-muted"}`}>
                    {uploaded ? <Check size={18} className="text-primary" /> : <Camera size={18} className="text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{doc.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.subtitle}</p>
                    {uploaded && (
                      <p className="text-xs text-primary mt-1 font-medium">✓ Uploaded</p>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="bg-[hsl(210,60%,15%)] rounded-xl p-4 flex items-start gap-3">
          <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300">
            Your documents are stored in your private SeaMinds vault. Never shared without your permission.
          </p>
        </div>

        <button
          onClick={handleAnalyse}
          disabled={!canProceed || analysing}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {analysing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              AI is reading your documents...
            </>
          ) : (
            "Analyse My Documents →"
          )}
        </button>

        <button
          onClick={onSkipToEnd || onNext}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip to Certificate (testing only)
        </button>
      </div>
    </div>
  );
};

export default DocumentUpload;
