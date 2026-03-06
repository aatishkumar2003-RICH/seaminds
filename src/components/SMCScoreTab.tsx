import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      <div className="pt-2">
        <MyDocumentsSection profileId={profileId} />
      </div>
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
