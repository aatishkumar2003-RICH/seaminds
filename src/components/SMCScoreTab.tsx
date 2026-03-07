import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, RefreshCw, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import CrewPaymentGate from "@/components/smc/CrewPaymentGate";
import SMCScoreCertificate from "@/components/smc/SMCScoreCertificate";
import AssessmentFlow from "@/components/smc/AssessmentFlow";
import MyDocumentsSection from "@/components/smc/MyDocumentsSection";

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
  const [view, setView] = useState<View>("loading");
  const [assessmentId, setAssessmentId] = useState("");

  // CV parse state
  const [cvStatus, setCvStatus] = useState<CvStatus>("idle");
  const [cvError, setCvError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkStatus();
    checkExistingCvData();
  }, [profileId]);

  const checkExistingCvData = async () => {
    const { data } = await supabase
      .from("crew_cv_data")
      .select("id")
      .eq("user_id", profileId)
      .maybeSingle();
    if (data) setCvStatus("done");
  };

  const handleCvParse = async (file: File) => {
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

      const response = await supabase.functions.invoke("parse-cv-documents", {
        body: { file_base64: base64, mime_type: file.type },
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
    const { data: assessment } = await supabase
      .from("smc_assessments")
      .select("*")
      .eq("crew_profile_id", profileId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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

    const { data: payment } = await supabase
      .from("smc_payments")
      .select("*")
      .eq("crew_profile_id", profileId)
      .eq("assessment_unlocked", true)
      .maybeSingle();

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
          onClick={() => fileRef.current?.click()}
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
          onClick={() => fileRef.current?.click()}
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
      <CvCard />
      {view === "certificate" && (
        <div className="pt-1">
          <MyDocumentsSection profileId={profileId} />
        </div>
      )}
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
          />
        ) : (
          <SMCScoreCertificate />
        )}
      </div>
    </div>
  );
};

export default SMCScoreTab;
