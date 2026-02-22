import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import DocumentUpload from "./steps/DocumentUpload";
import DocumentVerification from "./steps/DocumentVerification";
import TechnicalAssessment from "./steps/TechnicalAssessment";
import CommunicationAssessment from "./steps/CommunicationAssessment";
import BehaviouralProfile from "./steps/BehaviouralProfile";
import ScoreReveal from "./steps/ScoreReveal";

interface AssessmentFlowProps {
  profileId: string;
  firstName: string;
  rank: string;
  shipName: string;
  assessmentId: string;
  onComplete: () => void;
}

const TOTAL_STEPS = 6;

const AssessmentFlow = ({ profileId, firstName, rank, shipName, assessmentId, onComplete }: AssessmentFlowProps) => {
  const [step, setStep] = useState(1);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));
  const skipToEnd = () => setStep(TOTAL_STEPS);

  return (
    <div className="flex flex-col h-full">
      {/* Back button — hidden on final step */}
      {step < TOTAL_STEPS && (
        <div className="p-4 pb-0">
          <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {step === 1 && (
          <DocumentUpload
            assessmentId={assessmentId}
            profileId={profileId}
            onNext={goNext}
            onSkipToEnd={skipToEnd}
          />
        )}
        {step === 2 && (
          <DocumentVerification
            firstName={firstName}
            rank={rank}
            profileId={profileId}
            assessmentId={assessmentId}
            onNext={goNext}
            onSkipToEnd={skipToEnd}
          />
        )}
        {step === 3 && (
          <TechnicalAssessment
            firstName={firstName}
            rank={rank}
            shipName={shipName}
            assessmentId={assessmentId}
            onNext={goNext}
            onSkipToEnd={skipToEnd}
          />
        )}
        {step === 4 && (
          <CommunicationAssessment
            assessmentId={assessmentId}
            onNext={goNext}
            onSkipToEnd={skipToEnd}
          />
        )}
        {step === 5 && (
          <BehaviouralProfile
            assessmentId={assessmentId}
            onNext={goNext}
            onSkipToEnd={skipToEnd}
          />
        )}
        {step === 6 && (
          <ScoreReveal
            assessmentId={assessmentId}
            firstName={firstName}
            rank={rank}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
};

export default AssessmentFlow;
