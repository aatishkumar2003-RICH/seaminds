import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Eye, Download, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import CrewPaymentGate from "@/components/smc/CrewPaymentGate";
import SMCScoreCertificate from "@/components/smc/SMCScoreCertificate";
import AssessmentFlow from "@/components/smc/AssessmentFlow";

interface SMCScoreTabProps {
  profileId: string;
  firstName: string;
  lastName: string;
  rank: string;
  shipName: string;
}

type View = "loading" | "payment" | "assessment" | "certificate";

const CvDocumentCard = ({ profileId }: { profileId: string }) => {
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hasFile, setHasFile] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCv = async () => {
    const { data } = await supabase.storage
      .from("crew-cvs")
      .list(profileId, { limit: 1 });
    if (data && data.length > 0) {
      const file = data[0];
      setCvFileName(file.name);
      setHasFile(true);
      const { data: urlData } = await supabase.storage
        .from("crew-cvs")
        .createSignedUrl(`${profileId}/${file.name}`, 3600);
      if (urlData?.signedUrl) setCvUrl(urlData.signedUrl);
    } else {
      setHasFile(false);
    }
  };

  useEffect(() => {
    loadCv();
  }, [profileId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      // Remove old file if exists
      if (cvFileName) {
        await supabase.storage
          .from("crew-cvs")
          .remove([`${profileId}/${cvFileName}`]);
      }

      const ext = file.name.split(".").pop() || "pdf";
      const path = `${profileId}/cv.${ext}`;
      const { error } = await supabase.storage
        .from("crew-cvs")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      toast.success("CV uploaded successfully");
      await loadCv();
    } catch (e) {
      console.error("CV upload error:", e);
      toast.error("Failed to upload CV");
    } finally {
      setUploading(false);
    }
  };

  if (hasFile === null) return null;

  return (
    <div className="mx-4 mb-4 bg-card rounded-2xl border border-border p-4">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />

      {hasFile && cvFileName ? (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
            <FileText size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">My CV</p>
            <p className="text-xs text-muted-foreground truncate">{cvFileName}</p>
          </div>
          <div className="flex gap-1.5">
            {cvUrl && (
              <>
                <a
                  href={cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                  title="View"
                >
                  <Eye size={14} className="text-primary" />
                </a>
                <a
                  href={cvUrl}
                  download={cvFileName}
                  className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                  title="Download"
                >
                  <Download size={14} className="text-primary-foreground" />
                </a>
              </>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
              title="Replace CV"
            >
              {uploading ? (
                <RefreshCw size={14} className="text-primary-foreground animate-spin" />
              ) : (
                <RefreshCw size={14} className="text-primary-foreground" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
            <Upload size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {uploading ? "Uploading..." : "Upload Your CV"}
            </p>
            <p className="text-xs text-muted-foreground">PDF or photo — tap to upload</p>
          </div>
        </button>
      )}
    </div>
  );
};

const SMCScoreTab = ({ profileId, firstName, lastName, rank, shipName }: SMCScoreTabProps) => {
  const [view, setView] = useState<View>("loading");
  const [assessmentId, setAssessmentId] = useState("");

  useEffect(() => {
    checkStatus();
  }, [profileId]);

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

  return (
    <div className="flex flex-col h-full">
      <CvDocumentCard profileId={profileId} />
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
