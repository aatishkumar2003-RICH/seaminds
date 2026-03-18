import { useState, useRef } from "react";
import { Camera, Check, Loader2, Info, FileText, Anchor, GraduationCap, Stethoscope, Ship, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import StepProgressBar from "./StepProgressBar";

interface DocumentUploadProps {
  assessmentId: string;
  profileId: string;
  onNext: () => void;
  onSkipToEnd?: () => void;
}

interface ParsedCvData {
  certificates: Array<{ name: string; number: string; issue_date: string; expiry_date: string; issuing_authority: string; place?: string }>;
  sea_service: Array<{ vessel_name: string; vessel_type: string; flag: string; grt: string; rank: string; company: string; sign_on: string; sign_off: string }>;
  medical: Array<{ cert_type: string; issue_date: string; expiry_date: string; issuing_authority: string }>;
  education: Array<{ institution: string; qualification: string; year_from: string; year_to: string }>;
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

const PROCESSING_STEPS = [
  "Reading document structure...",
  "Extracting certificates...",
  "Identifying sea service records...",
  "Checking medical certificates...",
  "Verifying education details...",
  "Building your profile summary...",
];

const DocumentUpload = ({ assessmentId, profileId, onNext, onSkipToEnd }: DocumentUploadProps) => {
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [analysing, setAnalysing] = useState(false);

  // CV parsing states
  const [cvStatus, setCvStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [cvParsedData, setCvParsedData] = useState<ParsedCvData | null>(null);
  const [cvError, setCvError] = useState("");
  const [processingStep, setProcessingStep] = useState(0);
  const [showManualUpload, setShowManualUpload] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("certificates");
  const cvFileRef = useRef<HTMLInputElement>(null);

  const canProceed = cvParsedData || (!!uploads["cdc"] && !!uploads["coc"]);

  // Animate processing steps
  const startProcessingAnimation = () => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= PROCESSING_STEPS.length) {
        clearInterval(interval);
      } else {
        setProcessingStep(step);
      }
    }, 3000);
    return interval;
  };

  const handleCvUpload = async (file: File) => {
    console.log("SMC CV Upload: file selected", file.name, file.type, file.size);
    setCvStatus("processing");
    setCvError("");
    setProcessingStep(0);
    const animInterval = startProcessingAnimation();

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log("SMC CV Upload: calling parse-cv-documents");
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("parse-cv-documents", {
        body: { file_base64: base64, mime_type: file.type },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      console.log("SMC CV Upload: response", data, error);

      clearInterval(animInterval);

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Could not read CV. Try a clearer photo or text-based PDF.");
      }

      const parsed = data.data as ParsedCvData;
      setCvParsedData(parsed);
      setCvStatus("success");

      // Also store in crew_cv_data
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.user?.id) {
          await supabase.from("crew_cv_data").upsert({
            user_id: s.user.id,
            certificates: parsed.certificates as any,
            sea_service: parsed.sea_service as any,
            medical: parsed.medical as any,
            education: parsed.education as any,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        }
      } catch (e) { console.log("CV data save (non-blocking):", e); }

      // Upload original file to storage
      try {
        const path = `${profileId}/${assessmentId}/cv-original-${Date.now()}.${file.name.split(".").pop()}`;
        await supabase.storage.from("smc-documents").upload(path, file);
      } catch (e) { console.log("CV file save (non-blocking):", e); }

    } catch (e) {
      clearInterval(animInterval);
      console.error("SMC CV parse error:", e);
      setCvError(e instanceof Error ? e.message : "Could not read CV.");
      setCvStatus("error");
    }
  };

  const handleDocUpload = async (key: string, file: File) => {
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
    await new Promise((r) => setTimeout(r, 1500));
    onNext();
  };

  const handleCvClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    cvFileRef.current?.click();
  };

  const sectionIcons: Record<string, React.ReactNode> = {
    certificates: <GraduationCap size={14} />,
    sea_service: <Ship size={14} />,
    medical: <Stethoscope size={14} />,
    education: <FileText size={14} />,
  };

  const sectionLabels: Record<string, string> = {
    certificates: "Certificates",
    sea_service: "Sea Service",
    medical: "Medical",
    education: "Education",
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <StepProgressBar currentStep={1} totalSteps={5} label="Document Verification" />

        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-foreground">Upload Your Documents</h1>
          <p className="text-sm text-muted-foreground">Upload your CV and our AI reads it instantly. Or upload documents one by one.</p>
        </div>

        {/* ── CV UPLOAD SECTION ── */}
        <input
          ref={cvFileRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCvUpload(f);
            if (cvFileRef.current) cvFileRef.current.value = "";
          }}
        />

        <AnimatePresence mode="wait">
          {cvStatus === "idle" && (
            <motion.button
              key="cv-idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              type="button"
              onClick={handleCvClick}
              className="w-full rounded-2xl p-6 text-center transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                border: "2px dashed hsl(var(--primary))",
                background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.02))",
              }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.15)" }}>
                  <Sparkles size={24} className="text-primary" />
                </div>
                <div>
                  <p className="font-bold text-base text-primary">Upload Your CV</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PDF or photo — AI extracts all your details in seconds
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-full bg-secondary">PDF</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary">JPG</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary">PNG</span>
                </div>
              </div>
            </motion.button>
          )}

          {cvStatus === "processing" && (
            <motion.div
              key="cv-processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl p-6 space-y-5"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--secondary)))",
                border: "1px solid hsl(var(--primary) / 0.2)",
              }}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-[3px] border-muted animate-spin" style={{ borderTopColor: "hsl(var(--primary))" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText size={20} className="text-primary" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-bold text-primary text-base">AI is reading your CV...</p>
                  <p className="text-xs text-muted-foreground mt-1">This takes 15–20 seconds</p>
                </div>
              </div>

              {/* Animated processing steps */}
              <div className="space-y-2">
                {PROCESSING_STEPS.map((step, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: i <= processingStep ? 1 : 0.3, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-2 text-xs"
                  >
                    {i < processingStep ? (
                      <Check size={12} className="text-primary shrink-0" />
                    ) : i === processingStep ? (
                      <Loader2 size={12} className="text-primary animate-spin shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-muted shrink-0" />
                    )}
                    <span className={i <= processingStep ? "text-foreground" : "text-muted-foreground"}>
                      {step}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {cvStatus === "error" && (
            <motion.div
              key="cv-error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 space-y-3"
              style={{ background: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.3)" }}
            >
              <p className="text-sm font-medium text-destructive">❌ {cvError}</p>
              <button
                type="button"
                onClick={handleCvClick}
                className="text-xs font-medium text-primary underline"
              >
                Try again with a different file
              </button>
            </motion.div>
          )}

          {cvStatus === "success" && cvParsedData && (
            <motion.div
              key="cv-success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid hsl(var(--primary) / 0.3)" }}
            >
              {/* Summary header */}
              <div className="p-4 flex items-center gap-3" style={{ background: "hsl(var(--primary) / 0.1)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.2)" }}>
                  <Check size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-primary">✓ CV Parsed Successfully</p>
                  <p className="text-xs text-muted-foreground">
                    Found {cvParsedData.certificates.length} certificates, {cvParsedData.sea_service.length} service records
                  </p>
                </div>
              </div>

              {/* Expandable sections */}
              <div className="divide-y divide-border">
                {(["certificates", "sea_service", "medical", "education"] as const).map((section) => {
                  const items = cvParsedData[section] || [];
                  if (items.length === 0) return null;
                  const isExpanded = expandedSection === section;

                  return (
                    <div key={section}>
                      <button
                        onClick={() => setExpandedSection(isExpanded ? null : section)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                      >
                        <span className="text-primary">{sectionIcons[section]}</span>
                        <span className="flex-1 text-xs font-semibold text-foreground">
                          {sectionLabels[section]}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {items.length}
                        </span>
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-2">
                              {section === "certificates" && (cvParsedData.certificates).map((cert, i) => (
                                <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                                  <p className="text-xs font-semibold text-foreground">{cert.name || "Unnamed Certificate"}</p>
                                  {cert.number && <p className="text-[10px] text-muted-foreground">No: {cert.number}</p>}
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                    {cert.issuing_authority && <p className="text-[10px] text-muted-foreground">Authority: {cert.issuing_authority}</p>}
                                    {cert.issue_date && <p className="text-[10px] text-muted-foreground">Issued: {cert.issue_date}</p>}
                                    {cert.expiry_date && <p className="text-[10px] text-muted-foreground">Expires: {cert.expiry_date}</p>}
                                  </div>
                                </div>
                              ))}

                              {section === "sea_service" && (cvParsedData.sea_service).map((svc, i) => (
                                <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Anchor size={10} className="text-primary shrink-0" />
                                    <p className="text-xs font-semibold text-foreground">{svc.vessel_name || "Unknown Vessel"}</p>
                                    {svc.rank && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{svc.rank}</span>}
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                    {svc.vessel_type && <p className="text-[10px] text-muted-foreground">Type: {svc.vessel_type}</p>}
                                    {svc.company && <p className="text-[10px] text-muted-foreground">{svc.company}</p>}
                                    {svc.flag && <p className="text-[10px] text-muted-foreground">Flag: {svc.flag}</p>}
                                    {(svc.sign_on || svc.sign_off) && (
                                      <p className="text-[10px] text-muted-foreground">{svc.sign_on} → {svc.sign_off}</p>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {section === "medical" && (cvParsedData.medical).map((med, i) => (
                                <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                                  <p className="text-xs font-semibold text-foreground">{med.cert_type || "Medical Certificate"}</p>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                    {med.issuing_authority && <p className="text-[10px] text-muted-foreground">{med.issuing_authority}</p>}
                                    {med.issue_date && <p className="text-[10px] text-muted-foreground">Issued: {med.issue_date}</p>}
                                    {med.expiry_date && <p className="text-[10px] text-muted-foreground">Expires: {med.expiry_date}</p>}
                                  </div>
                                </div>
                              ))}

                              {section === "education" && (cvParsedData.education).map((edu, i) => (
                                <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                                  <p className="text-xs font-semibold text-foreground">{edu.qualification || "Qualification"}</p>
                                  {edu.institution && <p className="text-[10px] text-muted-foreground">{edu.institution}</p>}
                                  {(edu.year_from || edu.year_to) && (
                                    <p className="text-[10px] text-muted-foreground">{edu.year_from} – {edu.year_to}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Re-upload option */}
              <div className="px-4 py-2 border-t border-border">
                <button onClick={handleCvClick} className="text-xs text-primary underline">
                  Upload a different CV
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── OR: MANUAL DOCUMENT UPLOAD ── */}
        {cvStatus !== "processing" && (
          <div>
            <button
              onClick={() => setShowManualUpload(!showManualUpload)}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              {showManualUpload ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showManualUpload ? "Hide manual upload" : "Or upload documents individually"}
            </button>

            <AnimatePresence>
              {showManualUpload && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-3"
                >
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
                            if (f) handleDocUpload(doc.key, f);
                          }}
                        />
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${uploaded ? "bg-primary/20" : "bg-muted"}`}>
                            {uploaded ? <Check size={18} className="text-primary" /> : <Camera size={18} className="text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{doc.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{doc.subtitle}</p>
                            {uploaded && <p className="text-xs text-primary mt-1 font-medium">✓ Uploaded</p>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Privacy note */}
        <div className="rounded-xl p-4 flex items-start gap-3 bg-secondary/50 border border-border">
          <Info size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Your documents are stored in your private SeaMinds vault. Never shared without your permission.
          </p>
        </div>

        {/* Continue button */}
        <button
          onClick={handleAnalyse}
          disabled={!canProceed || analysing}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {analysing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Processing...
            </>
          ) : cvParsedData ? (
            "Confirm & Continue →"
          ) : (
            "Analyse My Documents →"
          )}
        </button>

        {/* Skip option */}
        {!canProceed && (
          <button
            onClick={onSkipToEnd}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
          >
            Skip documents for now
          </button>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;
