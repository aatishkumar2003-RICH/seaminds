import { useState, useEffect, useRef, useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, RefreshCw, Check, FileText, Anchor, Award, HeartPulse, X } from "lucide-react";
import { toast } from "sonner";
import CrewPaymentGate from "@/components/smc/CrewPaymentGate";
import SMCScoreCertificate from "@/components/smc/SMCScoreCertificate";
import AssessmentFlow from "@/components/smc/AssessmentFlow";
import MyDocumentsSection from "@/components/smc/MyDocumentsSection";
import SalaryBenchmark from "@/components/SalaryBenchmark";
import CvUpload from "@/components/CvUpload";

interface SMCScoreTabProps {
  profileId: string;
  firstName: string;
  lastName: string;
  rank: string;
  shipName: string;
}

type View = "loading" | "payment" | "assessment" | "certificate";
type CvStatus = "idle" | "reading" | "done" | "error";

const SMCScoreTab = ({ profileId, firstName, lastName, rank, shipName }: SMCScoreTabProps) => {
  const { accessToken } = useAuth();
  const [view, setView] = useState<View>("loading");
  const [assessmentId, setAssessmentId] = useState("");
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [crewUniqueId, setCrewUniqueId] = useState<string | null>(null);
  const [showCvUpload, setShowCvUpload] = useState(false);
  const [selfPrice, setSelfPrice] = useState(0);

  // CV parse state
  const [cvStatus, setCvStatus] = useState<CvStatus>("idle");
  const [cvError, setCvError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await checkStatus();
        await checkExistingCvData();
        const { data } = await supabase.from("crew_profiles").select("crew_unique_id").eq("id", profileId).maybeSingle();
        if (data?.crew_unique_id) setCrewUniqueId(data.crew_unique_id);
      } catch (e) {
        console.error('SMCScoreTab init error:', e);
        setView("payment");
      }
    };
    init();
  }, [profileId]);

  useEffect(() => {
    supabase.from('admin_settings').select('value').eq('key', 'price_self_assessment').single()
      .then(({ data }) => { if (data?.value) setSelfPrice(Number(data.value)); });
  }, []);

  const checkExistingCvData = async () => {
    const { data } = await supabase
      .from("crew_cv_data")
      .select("id")
      .eq("user_id", profileId)
      .maybeSingle();
    if (data) setCvStatus("done");
  };

  const handleCvParse = async (file: File) => {
    console.log("SMCScoreTab CV parse: file selected", file.name, file.type, file.size);
    setCvStatus("reading");
    setCvError("");

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

      console.log("SMCScoreTab CV parse: calling parse-cv-documents, base64 length:", base64.length);
      const response = await supabase.functions.invoke("parse-cv-documents", {
        body: { file_base64: base64, mime_type: file.type },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      console.log("CV parse response:", JSON.stringify(response));

      // supabase.functions.invoke returns { data, error }
      // data is the parsed JSON body from the edge function
      const payload = response.data;
      
      // Handle case where payload might be a string (double-encoded)
      const resolved = typeof payload === "string" ? JSON.parse(payload) : payload;

      if (response.error || !resolved?.success) {
        throw new Error(resolved?.error || response.error?.message || "Could not read CV");
      }

      const parsed = resolved.data;

      // Upsert into crew_cv_data
      const { error: dbError } = await supabase
        .from("crew_cv_data")
        .upsert(
          {
            user_id: profileId,
            certificates: parsed.certificates || [],
            sea_service: parsed.sea_service || [],
            medical: parsed.medical || [],
            education: parsed.education || [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (dbError) throw dbError;

      setCvStatus("done");
      toast.success("CV parsed — certificates & sea service extracted");
    } catch (e) {
      console.error("CV parse error:", e);
      setCvError(e instanceof Error ? e.message : "Could not read CV");
      setCvStatus("error");
      toast.error("Failed to parse CV");
    }
  };

  const checkStatus = async () => {
    try {
      if (!profileId) { setView("payment"); return; }
      const { data: assessment, error: assessErr } = await supabase
        .from("smc_assessments")
        .select("*")
        .eq("crew_profile_id", profileId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assessErr) { console.error('SMC assessment query error:', assessErr); setView("payment"); return; }

      if (assessment?.status === "completed") {
        setAssessmentId(assessment.id);
        setView("certificate");
        return;
      }

      if (assessment?.status === "in_progress") {
        setAssessmentId(assessment.id);
        setView("assessment");
        return;
      }

      const { data: payment, error: payErr } = await supabase
        .from("smc_payments")
        .select("*")
        .eq("crew_profile_id", profileId)
        .eq("assessment_unlocked", true)
        .maybeSingle();

      if (payErr) { console.error('SMC payment query error:', payErr); setView("payment"); return; }

      if (payment) {
        const { data: newAssessment } = await supabase
          .from("smc_assessments")
          .insert({ crew_profile_id: profileId, status: "in_progress", current_step: 1 })
          .select("id")
          .single();
        if (newAssessment) {
          setAssessmentId(newAssessment.id);
          setView("assessment");
        }
        return;
      }

      setView("payment");
    } catch (e) {
      console.error('SMC checkStatus crash:', e);
      setView("payment");
    }
  };

  const handlePaymentSuccess = async () => {
    const { data } = await supabase
      .from("smc_assessments")
      .insert({ crew_profile_id: profileId, status: "in_progress", current_step: 1 })
      .select("id")
      .single();
    if (data) {
      setAssessmentId(data.id);
      setView("assessment");
    } else {
      setAssessmentId("temp-" + Date.now());
      setView("assessment");
    }
    trackEvent("smc_assessment_start", { rank });
  };

  if (view === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  const CvCard = () => (
    <div className="mx-4 mt-2 mb-2">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleCvParse(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />

      {cvStatus === "reading" ? (
        <div className="bg-card rounded-2xl border border-border p-5 flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-[3px] border-muted"
            style={{ borderTopColor: "hsl(var(--primary))", animation: "spin 0.8s linear infinite" }}
          />
          <p className="text-sm font-semibold text-primary">🤖 AI is reading your document...</p>
          <p className="text-[10px] text-muted-foreground">Extracting certificates, sea service & more</p>
        </div>
      ) : cvStatus === "done" ? (
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Check size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">CV Parsed</p>
            <p className="text-[10px] text-muted-foreground">Certificates & sea service extracted</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            title="Re-scan CV"
          >
            <RefreshCw size={14} className="text-muted-foreground" />
          </button>
        </div>
      ) : cvStatus === "error" ? (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); fileRef.current?.click(); }}
          className="w-full bg-card rounded-2xl border border-dashed border-destructive/50 p-4 flex items-center gap-3 hover:border-destructive transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-destructive" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-destructive">{cvError || "Failed to read CV"}</p>
            <p className="text-[10px] text-muted-foreground">Tap to try again</p>
          </div>
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowCvUpload(true);
          }}
          className="w-full bg-card rounded-2xl border border-dashed border-border p-4 flex items-center gap-3 hover:border-primary/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <Upload size={16} className="text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Upload Your CV</p>
            <p className="text-[10px] text-muted-foreground">PDF or photo — AI extracts certificates & sea service</p>
          </div>
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <button onClick={() => window.history.back()}
        style={{ background:'transparent', border:'none', color:'#D4AF37', fontSize:'13px', cursor:'pointer', marginBottom:'8px', marginLeft:'16px', marginTop:'8px', display:'flex', alignItems:'center', gap:'4px' }}>
        ← Back
      </button>
      {/* CV Upload Modal */}
      {showCvUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowCvUpload(false)}>
          <div className="relative w-[90%] max-w-md rounded-2xl p-6" style={{ background: "#0D1B2A", border: "1px solid rgba(212,175,55,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowCvUpload(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80">
              <X size={16} className="text-muted-foreground" />
            </button>
            <h3 className="text-base font-bold text-foreground mb-4">Upload Your CV</h3>
            <CvUpload
              onParsed={(data) => {
                setCvStatus("done");
                setShowCvUpload(false);
                toast.success("CV parsed — certificates & sea service extracted");
              }}
            />
          </div>
        </div>
      )}
      {crewUniqueId && (
        <div className="mx-4 mt-3 mb-1 rounded-xl border px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(212,175,55,0.08)', borderColor: '#D4AF37' }}>
          <span className="text-xs font-semibold" style={{ color: '#D4AF37' }}>Your SeaMinds ID</span>
          <span className="text-sm font-bold tracking-wide" style={{ color: '#D4AF37' }}>{crewUniqueId}</span>
        </div>
      )}
      <CvCard />
      {/* Salary Check Button */}
      <div className="px-4 py-2">
        <button
          onClick={() => setSalaryOpen(true)}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all"
          style={{
            background: "rgba(212,175,55,0.1)",
            border: "1.5px solid #D4AF37",
            color: "#D4AF37",
          }}
        >
          💰 Salary Check
        </button>
      </div>
      <SalaryBenchmark open={salaryOpen} onClose={() => setSalaryOpen(false)} />
      {view === "certificate" && (
        <div className="pt-1">
          <MyDocumentsSection profileId={profileId} />
        </div>
      )}
      <DigitalCvSummary profileId={profileId} cvStatus={cvStatus} />
      <div className="flex-1 overflow-hidden">
        {view === "payment" ? (
          <CrewPaymentGate profileId={profileId} onPaymentSuccess={handlePaymentSuccess} />
        ) : view === "assessment" ? (
          <AssessmentFlow
            profileId={profileId}
            firstName={firstName}
            lastName={lastName}
            rank={rank}
            shipName={shipName}
            assessmentId={assessmentId}
            onComplete={() => setView("certificate")}
            onExit={() => setView("payment")}
          />
        ) : (
          <SMCScoreCertificate />
        )}
      </div>
    </div>
  );
};

interface CvData {
  certificates?: { id?: string; name?: string; expiryDate?: string; expiry_date?: string; issueDate?: string; issue_date?: string; certNumber?: string; number?: string; [key: string]: any }[];
  sea_service?: { vessel_name?: string; vesselName?: string; rank?: string; rankOnBoard?: string; duration?: string; from?: string; to?: string; fromDate?: string; toDate?: string; [key: string]: any }[];
  medical?: { name?: string; status?: string; expiryDate?: string; [key: string]: any }[];
}

const ensureArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const DigitalCvSummary = ({ profileId, cvStatus }: { profileId: string; cvStatus: CvStatus }) => {
  const [cvData, setCvData] = useState<CvData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from("crew_cv_data")
      .select("certificates, sea_service, medical")
      .eq("user_id", profileId)
      .maybeSingle();
    if (data) setCvData(data as unknown as CvData);
    else setCvData(null);
    setLoading(false);
  }, [profileId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-fetch when CV parse completes
  useEffect(() => {
    if (cvStatus === "done") { setLoading(true); fetchData(); }
  }, [cvStatus, fetchData]);

  if (loading) return null;

  const hasCerts = cvData?.certificates && cvData.certificates.length > 0;
  const hasService = cvData?.sea_service && cvData.sea_service.length > 0;
  const hasMedical = cvData?.medical && cvData.medical.length > 0;
  const hasData = hasCerts || hasService || hasMedical;

  return (
    <div className="mx-4 my-3 rounded-2xl p-4" style={{ background: "#0D1B2A", border: "1px solid rgba(212,175,55,0.2)" }}>
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#D4AF37" }}>
        <FileText size={15} /> Digital CV Summary
      </h3>

      {!hasData ? (
        <p className="text-xs text-center py-4" style={{ color: "#64748B" }}>
          Upload your CV above to see your Digital CV summary here.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Certificates */}
          {hasCerts && (
            <div>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#D4AF37" }}>
                <Award size={13} /> Certificates
              </h4>
              <div className="space-y-1.5">
                {cvData!.certificates!.map((c, i) => (
                  <div key={c.id || i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-xs text-foreground truncate mr-2">{c.name || "Unnamed"}</span>
                    {c.expiryDate && (
                      <span className="text-[10px] shrink-0" style={{ color: "#94A3B8" }}>
                        Exp: {new Date(c.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sea Service */}
          {hasService && (
            <div>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#D4AF37" }}>
                <Anchor size={13} /> Sea Service
              </h4>
              <div className="space-y-1.5">
                {cvData!.sea_service!.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="min-w-0 mr-2">
                      <span className="text-xs text-foreground truncate block">{s.vessel_name || s.vesselName || "Unknown vessel"}</span>
                      {s.rank && <span className="text-[10px]" style={{ color: "#94A3B8" }}>{s.rank}</span>}
                    </div>
                    {(s.duration || (s.from && s.to)) && (
                      <span className="text-[10px] shrink-0" style={{ color: "#94A3B8" }}>
                        {s.duration || `${s.from} – ${s.to}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical */}
          {hasMedical && (
            <div>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#D4AF37" }}>
                <HeartPulse size={13} /> Medical
              </h4>
              <div className="space-y-1.5">
                {cvData!.medical!.map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-xs text-foreground truncate mr-2">{m.name || "Medical Certificate"}</span>
                    <span className="text-[10px] shrink-0" style={{ color: m.status === "Expired" ? "#ef4444" : "#22c55e" }}>
                      {m.status || (m.expiryDate ? `Exp: ${new Date(m.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "Valid")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SMCScoreTab;
