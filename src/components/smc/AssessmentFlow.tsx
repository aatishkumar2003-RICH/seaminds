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
  const [redFlags, setRedFlags] = useState<Array<{category:string,evidence:string,question?:string,answer?:string,severity?:string}>>([]);
  const [pendingFollowUp, setPendingFollowUp] = useState<string|null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [timerActive, setTimerActive] = useState(false);

  // Tab switch / focus loss detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setTabSwitches(prev => {
          const count = prev + 1;
          setRedFlags(f => [...f, {
            category: 'INTEGRITY',
            evidence: `Tab switched ${count} time(s) during assessment`,
            severity: count >= 3 ? 'HIGH' : 'MEDIUM'
          }]);
          return count;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Per-question countdown timer (90 seconds)
  useEffect(() => {
    if (!timerActive) return;
    setTimeLeft(90);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); goNext(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timerActive]);

  // Paste detection handler
  const handlePaste = () => {
    setRedFlags((f: any[]) => [...f, {
      category: 'INTEGRITY',
      evidence: `Copy-paste detected on step ${step}`,
      severity: 'LOW'
    }]);
  };
  const [preForm, setPreForm] = useState<{reasonForLeaving:string,expectedSalary:string,availabilityDate:string,medicalFit:boolean,accidentHistory:string,pscDetention:boolean,nearMiss:boolean,safetyViolation:boolean}>({ reasonForLeaving:'', expectedSalary:'', availabilityDate:'', medicalFit:true, accidentHistory:'', pscDetention:false, nearMiss:false, safetyViolation:false });
  const [preFormDone, setPreFormDone] = useState(false);

  const handlePreFormSubmit = async () => {
    try {
      await supabase.from('interview_pre_form' as any).insert({
        crew_profile_id: profileId,
        assessment_id: assessmentId,
        reason_for_leaving: preForm.reasonForLeaving,
        expected_salary: preForm.expectedSalary,
        availability_date: preForm.availabilityDate || null,
        medical_fit: preForm.medicalFit,
        accident_history: preForm.accidentHistory || null,
        psc_detention: preForm.pscDetention,
        near_miss: preForm.nearMiss,
        safety_violation: preForm.safetyViolation,
      } as any);
    } catch { /* silent — non-blocking */ }
    setPreFormDone(true);
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const { data } = await supabase.functions.invoke('generate-smc-questions', {
          body: { rank, vesselType: vesselType || 'General Cargo', yearsExperience: yearsExperience || 5, department: 'Deck' },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data?.technical) { setAiQuestions(data); setTimerActive(true); }
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

  if (!preFormDone) {
    return (
      <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0b1929' }}>
        <div className="p-5 flex flex-col gap-4 max-w-lg mx-auto w-full">
          <div className="text-center mb-2">
            <p className="text-xs uppercase tracking-[0.2em] font-medium" style={{ color: '#D4AF37' }}>Pre-Interview Form</p>
            <p className="text-[11px] text-muted-foreground mt-1">Help us personalise your assessment</p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Why did you leave your last company?</span>
              <input
                type="text"
                value={preForm.reasonForLeaving}
                onChange={e => setPreForm(p => ({ ...p, reasonForLeaving: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]"
                style={{ background: '#132238' }}
                placeholder="e.g. Contract ended, better opportunity..."
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Expected salary (USD/month)</span>
              <input
                type="text"
                value={preForm.expectedSalary}
                onChange={e => setPreForm(p => ({ ...p, expectedSalary: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]"
                style={{ background: '#132238' }}
                placeholder="e.g. 3500"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Available from</span>
              <input
                type="date"
                value={preForm.availabilityDate}
                onChange={e => setPreForm(p => ({ ...p, availabilityDate: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]"
                style={{ background: '#132238', colorScheme: 'dark' }}
              />
            </label>

            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={preForm.medicalFit}
                onChange={e => setPreForm(p => ({ ...p, medicalFit: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#D4AF37]"
              />
              <span className="text-sm text-foreground">I am medically fit for sea duty</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Any accident or incident history? (leave blank if none)</span>
              <textarea
                value={preForm.accidentHistory}
                onChange={e => setPreForm(p => ({ ...p, accidentHistory: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37] resize-none"
                style={{ background: '#132238' }}
                rows={2}
                placeholder="Describe any incidents..."
              />
            </label>

            <label className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={preForm.pscDetention}
                onChange={e => setPreForm(p => ({ ...p, pscDetention: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#D4AF37]"
              />
              <span className="text-sm text-foreground">I have been involved in a PSC detention</span>
            </label>

            <label className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={preForm.nearMiss}
                onChange={e => setPreForm(p => ({ ...p, nearMiss: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#D4AF37]"
              />
              <span className="text-sm text-foreground">I have been involved in a near miss onboard</span>
            </label>

            <label className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={preForm.safetyViolation}
                onChange={e => setPreForm(p => ({ ...p, safetyViolation: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#D4AF37]"
              />
              <span className="text-sm text-foreground">I have received a safety violation</span>
            </label>
          </div>

          <button
            onClick={handlePreFormSubmit}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all mt-2"
            style={{ background: '#D4AF37', color: '#0b1929' }}
          >
            Begin Assessment
          </button>
          <button
            onClick={() => setPreFormDone(true)}
            className="text-xs text-center py-1 transition-colors"
            style={{ color: '#888' }}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {tabSwitches >= 3 && (
        <div className="px-4 py-2 text-xs text-center font-medium bg-destructive/20 text-destructive border-b border-destructive/30">
          ⚠️ Multiple tab switches detected. This is noted in your assessment record.
        </div>
      )}
      {step < TOTAL_STEPS && (
        <div className="p-4 pb-0">
          <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {timerActive && step >= 3 && step < TOTAL_STEPS && (
          <div style={{ padding: '0 16px', marginTop: '8px', marginBottom: '0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px', color: timeLeft <= 10 ? '#e74c3c' : timeLeft <= 30 ? '#f39c12' : '#D4AF37' }}>
              <span>Time remaining</span>
              <span style={{ fontWeight:'bold' }}>{timeLeft}s</span>
            </div>
            <div style={{ height:'4px', background:'#1a2e47', borderRadius:'2px' }}>
              <div style={{ height:'100%', borderRadius:'2px', transition:'width 1s linear', width:`${(timeLeft/90)*100}%`, background: timeLeft <= 10 ? '#e74c3c' : timeLeft <= 30 ? '#f39c12' : '#D4AF37' }} />
            </div>
          </div>
        )}
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
            onRedFlag={(flag) => setRedFlags(f => [...f, flag])}
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
            onRedFlag={(flag) => setRedFlags(f => [...f, flag])}
          />
        )}
        {step === 6 && (
          <ScoreReveal
            assessmentId={assessmentId}
            firstName={firstName}
            lastName={lastName}
            rank={rank}
            onComplete={onComplete}
            transcript={transcript}
            redFlags={redFlags}
            candidateContext={(aiQuestions as any)?.candidate_context}
          />
        )}
      </div>
    </div>
  );
};

export default AssessmentFlow;
