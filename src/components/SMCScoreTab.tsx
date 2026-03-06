import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, RefreshCw, Eye, Check } from "lucide-react";
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

const SMCScoreTab = ({ profileId, firstName, lastName, rank, shipName }: SMCScoreTabProps) => {
  const [view, setView] = useState<View>("loading");
  const [assessmentId, setAssessmentId] = useState("");

  // CV state
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkStatus();
    loadCv();
  }, [profileId]);

  const loadCv = async () => {
    const { data: files } = await supabase.storage
      .from("crew-cvs")
      .list(profileId, { limit: 1 });
    if (files && files.length > 0) {
      setCvFileName(files[0].name);
      const { data } = await supabase.storage
        .from("crew-cvs")
        .createSignedUrl(`${profileId}/${files[0].name}`, 3600);
      setCvUrl(data?.signedUrl || null);
    } else {
      setCvFileName(null);
      setCvUrl(null);
    }
  };

  const handleCvUpload = async (file: File) => {
    setUploading(true);
    try {
      if (cvFileName) {
        await supabase.storage.from("crew-cvs").remove([`${profileId}/${cvFileName}`]);
      }
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${profileId}/cv.${ext}`;
      const { error } = await supabase.storage.from("crew-cvs").upload(path, file, { upsert: true });
      if (error) throw error;
      toast.success("CV uploaded successfully");
      await loadCv();
    } catch {
      toast.error("Failed to upload CV");
    } finally {
      setUploading(false);
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
        accept=".pdf,.doc,.docx,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleCvUpload(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      {cvFileName ? (
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Check size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">My CV</p>
            <p className="text-[10px] text-muted-foreground truncate">{cvFileName}</p>
          </div>
          <div className="flex gap-1.5">
            {cvUrl && (
              <a
                href={cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                title="View CV"
              >
                <Eye size={14} className="text-primary" />
              </a>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-50"
              title="Replace CV"
            >
              {uploading ? (
                <RefreshCw size={14} className="text-muted-foreground animate-spin" />
              ) : (
                <RefreshCw size={14} className="text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full bg-card rounded-2xl border border-dashed border-border p-4 flex items-center gap-3 hover:border-primary/50 transition-colors disabled:opacity-50"
        >
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            {uploading ? (
              <RefreshCw size={16} className="text-muted-foreground animate-spin" />
            ) : (
              <Upload size={16} className="text-primary" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Upload Your CV</p>
            <p className="text-[10px] text-muted-foreground">PDF, DOC, or image — required for SMC assessment</p>
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
