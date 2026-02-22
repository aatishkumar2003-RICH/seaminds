import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import CrewPaymentGate from "@/components/smc/CrewPaymentGate";
import SMCScoreCertificate from "@/components/smc/SMCScoreCertificate";
import AssessmentFlow from "@/components/smc/AssessmentFlow";

interface SMCScoreTabProps {
  profileId: string;
  firstName: string;
  rank: string;
  shipName: string;
}

type View = "loading" | "payment" | "assessment" | "certificate";

const SMCScoreTab = ({ profileId, firstName, rank, shipName }: SMCScoreTabProps) => {
  const [view, setView] = useState<View>("loading");
  const [assessmentId, setAssessmentId] = useState("");

  useEffect(() => {
    checkStatus();
  }, [profileId]);

  const checkStatus = async () => {
    // Check for completed assessment first
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

    // Check for payment
    const { data: payment } = await supabase
      .from("smc_payments")
      .select("*")
      .eq("crew_profile_id", profileId)
      .eq("assessment_unlocked", true)
      .maybeSingle();

    if (payment) {
      // Payment exists but no assessment — create one
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
    // Create assessment record
    const { data } = await supabase
      .from("smc_assessments")
      .insert({ crew_profile_id: profileId, status: "in_progress", current_step: 1 })
      .select("id")
      .single();
    if (data) {
      setAssessmentId(data.id);
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

  if (view === "payment") {
    return <CrewPaymentGate profileId={profileId} onPaymentSuccess={handlePaymentSuccess} />;
  }

  if (view === "assessment") {
    return (
      <AssessmentFlow
        profileId={profileId}
        firstName={firstName}
        rank={rank}
        shipName={shipName}
        assessmentId={assessmentId}
        onComplete={() => setView("certificate")}
      />
    );
  }

  // certificate view
  return <SMCScoreCertificate />;
};

export default SMCScoreTab;
