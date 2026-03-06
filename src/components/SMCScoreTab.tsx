import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Eye, Download } from "lucide-react";
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

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.storage
        .from("crew-cvs")
        .list(profileId, { limit: 1 });
      if (data && data.length > 0) {
        const file = data[0];
        setCvFileName(file.name);
        const { data: urlData } = await supabase.storage
          .from("crew-cvs")
          .createSignedUrl(`${profileId}/${file.name}`, 3600);
        if (urlData?.signedUrl) setCvUrl(urlData.signedUrl);
      }
    };
    check();
  }, [profileId]);

  if (!cvFileName) return null;

  return (
    <div className="mx-4 mb-4 bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
          <FileText size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">My CV</p>
          <p className="text-xs text-muted-foreground truncate">{cvFileName}</p>
        </div>
        {cvUrl && (
          <div className="flex gap-1.5">
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
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
              title="Download"
            >
              <Download size={14} className="text-primary-foreground" />
            </a>
          </div>
        )}
      </div>
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
