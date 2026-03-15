import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DocumentUpload from "./steps/DocumentUpload";
import DocumentVerification from "./steps/DocumentVerification";
import TechnicalAssessment from "./steps/TechnicalAssessment";
import CommunicationAssessment from "./steps/CommunicationAssessment";
import BehaviouralProfile from "./steps/BehaviouralProfile";
import ScoreReveal from "./steps/ScoreReveal";

interface AssessmentFlowProps {
  profileId: string;
  firstName: string;
  lastName: string;
  rank: string;
  shipName: string;
  assessmentId: string;
  vesselType?: string;
  yearsExperience?: number;
  onComplete: () => void;
}

const TOTAL_STEPS = 6;

const AssessmentFlow = ({ profileId, firstName, lastName, rank, shipName, assessmentId, vesselType, yearsExperience, onComplete }: AssessmentFlowProps) => {
  const [step, setStep] = useState(1);
  const [aiQuestions, setAiQuestions] = useState<{ technical: string[]; communication: string[]; behavioural: string[] } | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [transcript, setTranscript] = useState<Array<{question:string,answer:string,score:number,redFlag:boolean,redFlagCategory:string|null,followUp:string|null}>>([]);
  const [redFlags, setRedFlags] = useState<Array<{category:string,evidence:string,question:string,answer:string}>>([]);
  const [pendingFollowUp, setPendingFollowUp] = useState<string|null>(null);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const { data } = await supabase.functions.invoke('generate-smc-questions', {
          body: { rank, vesselType: vesselType || 'General Cargo', yearsExperience: yearsExperience || 5, department: 'Deck' }
        });
        if (data?.technical) setAiQuestions(data);
      } catch (e) { console.error(e); }
      finally { setLoadingQuestions(false); }
    };
    fetchQuestions();
  }, [rank]);

  const goNext = async (question?: string, answer?: string) => {
    if (question && answer) {
      setEvaluating(true);
      try {
        const { data } = await supabase.functions.invoke('evaluate-answer', {
          body: {
            question, answer,
            rank,
            experience_tier: (aiQuestions as any)?.candidate_context?.experience_tier || 'MID',
            ship_specialisation: (aiQuestions as any)?.candidate_context?.ship_specialisation || 'GENERAL',
            department: (aiQuestions as any)?.candidate_context?.department || 'DECK',
          }
        });
        const entry = {
          question, answer,
          score: data?.score || 5,
          redFlag: data?.red_flag || false,
          redFlagCategory: data?.red_flag_category || null,
          followUp: data?.follow_up_question || null,
        };
        setTranscript(prev => [...prev, entry]);
        if (data?.red_flag && data?.red_flag_evidence) {
          setRedFlags(prev => [...prev, { category: data.red_flag_category, evidence: data.red_flag_evidence, question, answer }]);
        }
        if (data?.follow_up_question) {
          setPendingFollowUp(data.follow_up_question);
          setEvaluating(false);
          return;
        }
      } catch { /* silent fail — continue to next step */ }
      finally { setEvaluating(false); }
    }
    setPendingFollowUp(null);
    setStep(prev => prev + 1);
  };

  const handleFollowUpAnswer = (followUpAnswer: string) => {
    setPendingFollowUp(null);
    setStep(prev => prev + 1);
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));
  const skipToEnd = () => setStep(TOTAL_STEPS);

  return (
    <div className="flex flex-col h-full">
      {step < TOTAL_STEPS && (
        <div className="p-4 pb-0">
          <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {step === 1 && loadingQuestions && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm font-semibold animate-pulse" style={{ color: "#D4AF37" }}>
              Preparing your personalised assessment...
            </p>
          </div>
        )}
        {step === 1 && !loadingQuestions && (
          <DocumentUpload
            assessmentId={assessmentId}
            profileId={profileId}
            onNext={() => goNext()}
            onSkipToEnd={skipToEnd}
          />
        )}
        {step === 2 && (
          <DocumentVerification
            firstName={firstName}
            rank={rank}
            profileId={profileId}
            assessmentId={assessmentId}
            onNext={() => goNext()}
            onSkipToEnd={skipToEnd}
          />
        )}
        {step === 3 && (
          <TechnicalAssessment
            firstName={firstName}
            rank={rank}
            shipName={shipName}
            assessmentId={assessmentId}
            questions={aiQuestions?.technical}
            onNext={goNext}
            onSkipToEnd={skipToEnd}
            evaluating={evaluating}
            pendingFollowUp={pendingFollowUp}
            onFollowUpAnswer={handleFollowUpAnswer}
          />
        )}
        {step === 4 && (
          <CommunicationAssessment
            assessmentId={assessmentId}
            questions={aiQuestions?.communication}
            onNext={goNext}
            onSkipToEnd={skipToEnd}
            evaluating={evaluating}
            pendingFollowUp={pendingFollowUp}
            onFollowUpAnswer={handleFollowUpAnswer}
          />
        )}
        {step === 5 && (
          <BehaviouralProfile
            assessmentId={assessmentId}
            questions={aiQuestions?.behavioural}
            onNext={goNext}
            onSkipToEnd={skipToEnd}
            evaluating={evaluating}
            pendingFollowUp={pendingFollowUp}
            onFollowUpAnswer={handleFollowUpAnswer}
          />
        )}
        {step === 6 && (
          <ScoreReveal
            assessmentId={assessmentId}
            firstName={firstName}
            lastName={lastName}
            rank={rank}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
};

export default AssessmentFlow;
