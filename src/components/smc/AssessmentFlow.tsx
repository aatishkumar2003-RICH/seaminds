import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DocumentUpload from "./steps/DocumentUpload";
import DocumentVerification from "./steps/DocumentVerification";
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
  onExit?: () => void;
}

interface FlatQuestion {
  type: 'mcq' | 'scenario' | 'behavioural';
  id: string;
  domain?: string;
  question: string;
  // MCQ fields
  options?: string[];
  correct_index?: number;
  correct_letter?: string;
  regulation?: string;
  explanation?: string;
  // Scenario fields
  situation?: string;
  key_steps?: string[];
  critical_step?: string;
  time_seconds?: number;
  // Behavioural fields
  category?: string;
  wellness_indicator?: boolean;
  confidential?: boolean;
  prompt_text?: string;
}

const AssessmentFlow = ({ profileId, firstName, lastName, rank, shipName, assessmentId, vesselType, yearsExperience, onComplete, onExit }: AssessmentFlowProps) => {
  const { accessToken } = useAuth();
  // Core flow state
  const [flowStep, setFlowStep] = useState<'preform' | 'docUpload' | 'docVerify' | 'questions' | 'score'>('preform');
  const [aiQuestions, setAiQuestions] = useState<any>(null);
  const [flatQuestions, setFlatQuestions] = useState<FlatQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [qIndex, setQIndex] = useState(0);

  // MCQ state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [mcqCorrect, setMcqCorrect] = useState<boolean | null>(null);

  // Evaluation state
  const [transcript, setTranscript] = useState<Array<{question:string,answer:string,score:number,redFlag:boolean,redFlagCategory:string|null,followUp:string|null}>>([]);
  const [redFlags, setRedFlags] = useState<Array<{category:string,evidence:string,question?:string,answer?:string,severity?:string}>>([]);
  const [pendingFollowUp, setPendingFollowUp] = useState<string|null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [sectionCard, setSectionCard] = useState<{ type: string; label: string; num: string; icon: string } | null>(null);
  const prevSectionType = useRef<string | null>(null);
  const introShown = useRef(false);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);

  // Input state
  const [textAnswer, setTextAnswer] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pre-form state
  const [preForm, setPreForm] = useState<{reasonForLeaving:string,expectedSalary:string,availabilityDate:string,medicalFit:boolean,accidentHistory:string,pscDetention:boolean,nearMiss:boolean,safetyViolation:boolean}>({ reasonForLeaving:'', expectedSalary:'', availabilityDate:'', medicalFit:true, accidentHistory:'', pscDetention:false, nearMiss:false, safetyViolation:false });

  // Reset MCQ state on question change
  useEffect(() => {
    setSelectedOption(null);
    setMcqSubmitted(false);
    setMcqCorrect(null);
    setTextAnswer("");
    setPendingFollowUp(null);
    setFollowUpInput("");
    // Set timer based on question type
    const currentQ = flatQuestions[qIndex];
    if (currentQ?.type === 'mcq') {
      setTimeLeft(60);
      setTimerActive(true);
    } else if (currentQ?.type === 'scenario') {
      setTimeLeft(currentQ.time_seconds || 180);
      setTimerActive(true);
    } else if (currentQ?.type === 'behavioural') {
      setTimerActive(false);
    }
  }, [qIndex, flatQuestions]);

  // Show intro section card when questions flow starts
  useEffect(() => {
    if (flowStep === 'questions' && flatQuestions.length > 0 && !introShown.current) {
      introShown.current = true;
      setSectionCard({ type: 'mcq', label: '📋 Knowledge Assessment', num: 'Section 1', icon: '📋' });
      setTimeout(() => setSectionCard(null), 60000);
    }
  }, [flowStep, flatQuestions]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setTabSwitches(prev => {
          const count = prev + 1;
          setRedFlags(f => [...f, { category: 'INTEGRITY', evidence: `Tab switched ${count} time(s) during assessment`, severity: count >= 3 ? 'HIGH' : 'MEDIUM' }]);
          return count;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!timerActive || flowStep !== 'questions') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [qIndex, timerActive, flowStep]);

  // Paste detection
  const handlePaste = () => {
    setRedFlags(f => [...f, { category: 'INTEGRITY', evidence: `Copy-paste detected on question ${qIndex + 1}`, severity: 'LOW' }]);
  };

  // Flatten questions when AI questions arrive
  useEffect(() => {
    if (!aiQuestions) return;
    const flat: FlatQuestion[] = [];
    (aiQuestions.mcq || []).forEach((q: any) => flat.push({ type: 'mcq', id: q.id, domain: q.domain, question: q.question, options: q.options, correct_index: q.correct_index, correct_letter: q.correct_letter, regulation: q.regulation, explanation: q.explanation }));
    (aiQuestions.scenario || []).forEach((q: any) => flat.push({ type: 'scenario', id: q.id, domain: q.domain, question: q.question, situation: q.situation, key_steps: q.key_steps, critical_step: q.critical_step, time_seconds: q.time_seconds || 180 }));
    (aiQuestions.behavioural || []).forEach((q: any) => flat.push({ type: 'behavioural', id: q.id, category: q.category, question: q.question, wellness_indicator: q.wellness_indicator, confidential: q.confidential, prompt_text: q.prompt_text }));
    setFlatQuestions(flat);
  }, [aiQuestions]);

  // Fetch questions
  useEffect(() => {
    const fetchQuestions = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      setLoadingQuestions(true);
      try {
        const token = accessToken;
        const invokePromise = supabase.functions.invoke('generate-smc-questions', {
          body: { rank, vesselType: vesselType || 'General Cargo', yearsExperience: yearsExperience || 5, department: 'Deck' },
          headers: { Authorization: `Bearer ${token}` },
        });
        const abortPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
        const { data } = await Promise.race([invokePromise, abortPromise]);
        clearTimeout(timeoutId);
        if (data?.mcq || data?.scenario || data?.behavioural) {
          setAiQuestions(data);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('Failed to generate questions:', error);
        if (error.name === 'AbortError') {
          alert('Assessment is taking too long. Please check your internet connection and try again.');
        } else {
          alert('Could not load assessment questions. Please try again.');
        }
      } finally {
        setLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, [rank]);

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
    } catch { /* silent */ }
    setFlowStep('docUpload');
  };

  const handleAutoSubmit = () => {
    const currentQ = flatQuestions[qIndex];
    if (!currentQ) return;
    if (currentQ.type === 'mcq') {
      handleMcqConfirm(true);
    } else {
      const answer = textAnswer.trim() || '[No answer — time expired]';
      submitAnswer(currentQ.question, answer, currentQ);
    }
  };

  const handleMcqConfirm = async (autoSubmit = false) => {
    const currentQ = flatQuestions[qIndex];
    if (!currentQ) return;
    const selected = autoSubmit && selectedOption === null ? -1 : selectedOption;
    if (selected === null) return;

    const isCorrect = selected === currentQ.correct_index;
    setMcqCorrect(isCorrect);
    setMcqSubmitted(true);
    setTimerActive(false);

    // Evaluate MCQ
    setEvaluating(true);
    try {
      const token = accessToken;
      const { data } = await supabase.functions.invoke('evaluate-answer', {
        body: {
          question: currentQ.question,
          answer: selected.toString(),
          question_type: 'mcq',
          correct_index: currentQ.correct_index,
          correct_letter: currentQ.correct_letter,
          explanation: currentQ.explanation,
          rank,
          experience_tier: aiQuestions?.candidate_context?.experience_tier || 'MID',
          department: aiQuestions?.candidate_context?.department || 'DECK',
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const entry = { question: currentQ.question, answer: selected.toString(), score: data?.score || 0, redFlag: data?.red_flag || false, redFlagCategory: data?.red_flag_category || null, followUp: data?.follow_up_question || null };
      setTranscript(prev => [...prev, entry]);
      if (data?.red_flag && data?.red_flag_evidence) {
        setRedFlags(prev => [...prev, { category: data.red_flag_category, evidence: data.red_flag_evidence, question: currentQ.question, answer: selected.toString() }]);
      }
      if (data?.follow_up_question) {
        setPendingFollowUp(data.follow_up_question);
      }
    } catch { /* silent */ }
    finally { setEvaluating(false); }
  };

  const submitAnswer = async (question: string, answer: string, currentQ: FlatQuestion) => {
    setEvaluating(true);
    setTimerActive(false);
    try {
      const token = accessToken;
      const { data } = await supabase.functions.invoke('evaluate-answer', {
        body: {
          question,
          answer,
          question_type: currentQ.type,
          key_steps: currentQ.key_steps,
          critical_step: currentQ.critical_step,
          rank,
          experience_tier: aiQuestions?.candidate_context?.experience_tier || 'MID',
          department: aiQuestions?.candidate_context?.department || 'DECK',
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const entry = { question, answer, score: data?.score || 0, redFlag: data?.red_flag || false, redFlagCategory: data?.red_flag_category || null, followUp: data?.follow_up_question || null };
      setTranscript(prev => [...prev, entry]);
      if (data?.red_flag && data?.red_flag_evidence) {
        setRedFlags(prev => [...prev, { category: data.red_flag_category, evidence: data.red_flag_evidence, question, answer }]);
      }
      if (data?.follow_up_question) {
        setPendingFollowUp(data.follow_up_question);
        setEvaluating(false);
        return;
      }
    } catch { /* silent */ }
    finally { setEvaluating(false); }
    advanceQuestion();
  };

  const advanceQuestion = () => {
    if (qIndex + 1 < flatQuestions.length) {
      const nextQ = flatQuestions[qIndex + 1];
      const currQ = flatQuestions[qIndex];
      // Show section title card when switching sections
      if (nextQ && currQ && nextQ.type !== currQ.type) {
        const label = nextQ.type === 'scenario' ? '🚨 Situational Judgment' : '💬 Personal Wellbeing';
        const num = nextQ.type === 'scenario' ? 'Section 2' : 'Section 3';
        const icon = nextQ.type === 'scenario' ? '🚨' : '💬';
        setSectionCard({ type: nextQ.type, label, num, icon });
        setTimeout(() => {
          setSectionCard(null);
          setQIndex(prev => prev + 1);
        }, 60000);
      } else {
        setQIndex(prev => prev + 1);
      }
    } else {
      setFlowStep('score');
    }
  };

  const handleTextSubmit = () => {
    if (!textAnswer.trim()) return;
    const currentQ = flatQuestions[qIndex];
    if (!currentQ) return;
    submitAnswer(currentQ.question, textAnswer.trim(), currentQ);
  };

  const handleMcqNext = () => {
    setPendingFollowUp(null);
    advanceQuestion();
  };

  const handleFollowUpSubmit = () => {
    if (!followUpInput.trim()) return;
    setPendingFollowUp(null);
    setFollowUpInput("");
    advanceQuestion();
  };

  const currentQ = flatQuestions[qIndex];
  const totalQuestions = flatQuestions.length;
  const sectionLabel = currentQ?.type === 'mcq' ? '📋 Knowledge Assessment' : currentQ?.type === 'scenario' ? '🚨 Situational Judgment' : '💬 Personal Wellbeing';
  const sectionNum = currentQ?.type === 'mcq' ? 'Section 1' : currentQ?.type === 'scenario' ? 'Section 2' : 'Section 3';

  // Timer max for progress bar
  const timerMax = currentQ?.type === 'mcq' ? 60 : currentQ?.type === 'scenario' ? (currentQ.time_seconds || 180) : 90;

  // ── PRE-FORM ──
  if (flowStep === 'preform') {
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
              <input type="text" value={preForm.reasonForLeaving} onChange={e => setPreForm(p => ({ ...p, reasonForLeaving: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]" style={{ background: '#132238' }} placeholder="e.g. Contract ended, better opportunity..." />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Expected salary (USD/month)</span>
              <input type="text" value={preForm.expectedSalary} onChange={e => setPreForm(p => ({ ...p, expectedSalary: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]" style={{ background: '#132238' }} placeholder="e.g. 3500" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Available from</span>
              <input type="date" value={preForm.availabilityDate} onChange={e => setPreForm(p => ({ ...p, availabilityDate: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]" style={{ background: '#132238', colorScheme: 'dark' }} />
            </label>
            <label className="flex items-center gap-3 py-2">
              <input type="checkbox" checked={preForm.medicalFit} onChange={e => setPreForm(p => ({ ...p, medicalFit: e.target.checked }))} className="w-4 h-4 rounded accent-[#D4AF37]" />
              <span className="text-sm text-foreground">I am medically fit for sea duty</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Any accident or incident history? (leave blank if none)</span>
              <textarea value={preForm.accidentHistory} onChange={e => setPreForm(p => ({ ...p, accidentHistory: e.target.value }))} className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37] resize-none" style={{ background: '#132238' }} rows={2} placeholder="Describe any incidents..." />
            </label>
            <label className="flex items-center gap-3 py-1">
              <input type="checkbox" checked={preForm.pscDetention} onChange={e => setPreForm(p => ({ ...p, pscDetention: e.target.checked }))} className="w-4 h-4 rounded accent-[#D4AF37]" />
              <span className="text-sm text-foreground">I have been involved in a PSC detention</span>
            </label>
            <label className="flex items-center gap-3 py-1">
              <input type="checkbox" checked={preForm.nearMiss} onChange={e => setPreForm(p => ({ ...p, nearMiss: e.target.checked }))} className="w-4 h-4 rounded accent-[#D4AF37]" />
              <span className="text-sm text-foreground">I have been involved in a near miss onboard</span>
            </label>
            <label className="flex items-center gap-3 py-1">
              <input type="checkbox" checked={preForm.safetyViolation} onChange={e => setPreForm(p => ({ ...p, safetyViolation: e.target.checked }))} className="w-4 h-4 rounded accent-[#D4AF37]" />
              <span className="text-sm text-foreground">I have received a safety violation</span>
            </label>
          </div>
          <button onClick={handlePreFormSubmit} className="w-full py-3 rounded-xl font-bold text-sm transition-all mt-2" style={{ background: '#D4AF37', color: '#0b1929' }}>Begin Assessment</button>
          <button onClick={() => setFlowStep('docUpload')} className="text-xs text-center py-1 transition-colors" style={{ color: '#888' }}>Skip</button>
        </div>
      </div>
    );
  }

  // ── DOC UPLOAD ──
  if (flowStep === 'docUpload') {
    return (
      <div className="flex flex-col h-full">
        {loadingQuestions && (
          <div className="px-4 py-2 text-xs text-center animate-pulse" style={{ color: '#D4AF37' }}>
            Generating your personalised assessment...
          </div>
        )}
        <DocumentUpload assessmentId={assessmentId} profileId={profileId} onNext={() => setFlowStep('docVerify')} onSkipToEnd={() => setFlowStep('questions')} />
      </div>
    );
  }

  // ── DOC VERIFY ──
  if (flowStep === 'docVerify') {
    return (
      <div className="flex flex-col h-full">
        <DocumentVerification firstName={firstName} rank={rank} profileId={profileId} assessmentId={assessmentId} onNext={() => setFlowStep('questions')} onSkipToEnd={() => setFlowStep('questions')} />
      </div>
    );
  }

  // ── SCORE REVEAL ──
  if (flowStep === 'score') {
    return (
      <ScoreReveal
        assessmentId={assessmentId}
        firstName={firstName}
        lastName={lastName}
        rank={rank}
        onComplete={onComplete}
        onBack={onExit}
        transcript={transcript}
        redFlags={redFlags}
        candidateContext={aiQuestions?.candidate_context}
      />
    );
  }

  // ── QUESTION FLOW ──
  if (flowStep === 'questions') {
    if (!flatQuestions.length || loadingQuestions) {
      return (
        <div className="flex items-center justify-center h-full" style={{ background: '#0b1929' }}>
          <div className="text-center space-y-3">
            <Loader2 size={28} className="animate-spin mx-auto" style={{ color: '#D4AF37' }} />
            <p className="text-sm font-semibold animate-pulse" style={{ color: '#D4AF37' }}>Preparing your personalised assessment...</p>
          </div>
        </div>
      );
    }

    // Section transition card overlay
    if (sectionCard) {
      return (
        <div className="flex flex-col h-full items-center justify-center" style={{ background: '#0b1929' }}>
          <AnimatePresence>
            <motion.div
              key={`section-card-${sectionCard.type}`}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-center space-y-4 px-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                style={{ fontSize: '56px', lineHeight: 1 }}
              >
                {sectionCard.icon}
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="text-xs uppercase tracking-[0.25em] font-semibold"
                style={{ color: '#D4AF37' }}
              >
                {sectionCard.num}
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="text-xl font-bold text-foreground"
              >
                {sectionCard.label.replace(/^[^\s]+\s/, '')}
              </motion.h2>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '60px' }}
                transition={{ delay: 0.7, duration: 0.6 }}
                style={{ height: '2px', background: '#D4AF37', margin: '0 auto' }}
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.4 }}
                className="text-xs text-muted-foreground"
              >
                {sectionCard.type === 'scenario' ? 'Describe your actions in order of priority' : 'Your responses are confidential'}
              </motion.p>
            </motion.div>
          </AnimatePresence>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full" style={{ background: '#0b1929' }}>
        {/* Tab switch warning */}
        {tabSwitches >= 3 && (
          <div className="px-4 py-2 text-xs text-center font-medium bg-destructive/20 text-destructive border-b border-destructive/30">
            ⚠️ Multiple tab switches detected. This is noted in your assessment record.
          </div>
        )}

        {/* Header with section & progress */}
        <div className="p-4 pb-2 space-y-2">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <div style={{ color: '#D4AF37', fontSize: '12px' }}>
              {sectionNum}: {sectionLabel} — Question {qIndex + 1} of {totalQuestions}
            </div>
            {onExit && (
              <button onClick={() => {
                if (window.confirm('Exit assessment? Your progress will be lost.')) onExit();
              }} style={{ background:'transparent', border:'1px solid #444', color:'#888', padding:'4px 12px', borderRadius:'6px', fontSize:'11px', cursor:'pointer' }}>
                ✕ Exit
              </button>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ height: '3px', background: '#1a2e47', borderRadius: '2px' }}>
            <div style={{ height: '100%', borderRadius: '2px', transition: 'width 0.3s', width: `${((qIndex + 1) / totalQuestions) * 100}%`, background: '#D4AF37' }} />
          </div>

          {/* Timer bar — not shown for behavioural */}
          {timerActive && currentQ?.type !== 'behavioural' && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px', color: timeLeft <= 10 ? '#e74c3c' : timeLeft <= 30 ? '#f39c12' : '#D4AF37' }}>
                <span>Time remaining</span>
                <span style={{ fontWeight: 'bold' }}>{timeLeft}s</span>
              </div>
              <div style={{ height: '3px', background: '#1a2e47', borderRadius: '2px' }}>
                <div style={{ height: '100%', borderRadius: '2px', transition: 'width 1s linear', width: `${(timeLeft / timerMax) * 100}%`, background: timeLeft <= 10 ? '#e74c3c' : timeLeft <= 30 ? '#f39c12' : '#D4AF37' }} />
              </div>
            </div>
          )}
        </div>

        {/* Question content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
          <AnimatePresence mode="wait">
          <motion.div
            key={`q-${qIndex}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
          {/* ── MCQ ── */}
          {currentQ?.type === 'mcq' && (
            <div className="space-y-4">
              <p className="text-sm text-foreground font-medium leading-relaxed">{currentQ.question}</p>
              {currentQ.regulation && (
                <p style={{ fontSize: '10px', color: '#888' }}>Ref: {currentQ.regulation}</p>
              )}
              <div className="space-y-2">
                {(currentQ.options || []).map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isSelected = selectedOption === i;
                  const isCorrectOpt = mcqSubmitted && i === currentQ.correct_index;
                  const isWrongSelected = mcqSubmitted && isSelected && !mcqCorrect;
                  return (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.25 }}
                      onClick={() => { if (!mcqSubmitted) setSelectedOption(i); }}
                      disabled={mcqSubmitted}
                      className="w-full text-left rounded-xl px-4 py-3 text-sm transition-all"
                      style={{
                        background: isCorrectOpt ? 'rgba(34,197,94,0.15)' : isWrongSelected ? 'rgba(239,68,68,0.15)' : isSelected ? 'rgba(212,175,55,0.1)' : '#132238',
                        border: `2px solid ${isCorrectOpt ? '#22c55e' : isWrongSelected ? '#ef4444' : isSelected ? '#D4AF37' : '#1a2e47'}`,
                        color: '#e2e8f0',
                        cursor: mcqSubmitted ? 'default' : 'pointer',
                      }}
                    >
                      <span style={{ fontWeight: 'bold', color: isSelected && !mcqSubmitted ? '#D4AF37' : '#888', marginRight: '8px' }}>{letter}.</span>
                      {opt.replace(/^[A-D]\.\s*/, '')}
                    </motion.button>
                  );
                })}
              </div>

              {/* MCQ result banner */}
              {mcqSubmitted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-xl px-4 py-3 space-y-1"
                  style={{ background: mcqCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${mcqCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}
                >
                  <div className="flex items-center gap-2">
                    {mcqCorrect ? <CheckCircle size={16} style={{ color: '#22c55e' }} /> : <XCircle size={16} style={{ color: '#ef4444' }} />}
                    <span className="text-sm font-bold" style={{ color: mcqCorrect ? '#22c55e' : '#ef4444' }}>
                      {mcqCorrect ? '✓ Correct!' : `✗ Incorrect — Correct answer: ${currentQ.correct_letter}`}
                    </span>
                  </div>
                  {!mcqCorrect && currentQ.explanation && (
                    <p style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>{currentQ.explanation}</p>
                  )}
                </motion.div>
              )}

              {/* Follow-up question after MCQ */}
              {pendingFollowUp && mcqSubmitted && (
                <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#D4AF37' }}>Follow-up Question</p>
                  <p className="text-sm text-foreground">{pendingFollowUp}</p>
                  <div className="flex gap-2">
                    <input value={followUpInput} onChange={e => setFollowUpInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFollowUpSubmit()} placeholder="Type your answer..." className="flex-1 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]" style={{ background: '#132238' }} />
                    <button onClick={handleFollowUpSubmit} disabled={!followUpInput.trim()} className="rounded-lg px-3 py-2 text-sm font-bold transition-all disabled:opacity-40" style={{ background: '#D4AF37', color: '#0b1929' }}>Send</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SCENARIO ── */}
          {currentQ?.type === 'scenario' && (
            <div className="space-y-4">
              {currentQ.situation && (
                <div style={{ borderLeft: '3px solid #D4AF37', paddingLeft: '12px', marginBottom: '16px', color: '#ccc', fontSize: '13px' }}>
                  {currentQ.situation}
                </div>
              )}
              <p className="text-sm text-foreground font-medium">{currentQ.question}</p>
              <textarea
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                onPaste={handlePaste}
                placeholder="Describe your actions in order of priority..."
                className="w-full rounded-xl px-4 py-3 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37] resize-none"
                style={{ background: '#132238', minHeight: '120px' }}
                disabled={evaluating}
              />
              {evaluating && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" style={{ color: '#D4AF37' }} />
                  Evaluating your answer...
                </div>
              )}
              {pendingFollowUp && (
                <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#D4AF37' }}>Follow-up Question</p>
                  <p className="text-sm text-foreground">{pendingFollowUp}</p>
                  <div className="flex gap-2">
                    <input value={followUpInput} onChange={e => setFollowUpInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFollowUpSubmit()} placeholder="Answer the follow-up..." className="flex-1 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]" style={{ background: '#132238' }} />
                    <button onClick={handleFollowUpSubmit} disabled={!followUpInput.trim()} className="rounded-lg px-3 py-2 text-sm font-bold transition-all disabled:opacity-40" style={{ background: '#D4AF37', color: '#0b1929' }}>Send</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BEHAVIOURAL ── */}
          {currentQ?.type === 'behavioural' && (
            <div className="space-y-4">
              <p style={{ color: '#888', fontSize: '11px', marginBottom: '8px' }}>💙 Your response is confidential — never shared with your employer.</p>
              <p className="text-sm text-foreground font-medium">{currentQ.question}</p>
              <textarea
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                onPaste={handlePaste}
                placeholder="Share your thoughts openly..."
                className="w-full rounded-xl px-4 py-3 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37] resize-none"
                style={{ background: '#132238', minHeight: '100px' }}
                disabled={evaluating}
              />
              {evaluating && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" style={{ color: '#D4AF37' }} />
                  Evaluating your answer...
                </div>
              )}
              {pendingFollowUp && (
                <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#D4AF37' }}>Follow-up Question</p>
                  <p className="text-sm text-foreground">{pendingFollowUp}</p>
                  <div className="flex gap-2">
                    <input value={followUpInput} onChange={e => setFollowUpInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFollowUpSubmit()} placeholder="Share your thoughts..." className="flex-1 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-[#D4AF37]" style={{ background: '#132238' }} />
                    <button onClick={handleFollowUpSubmit} disabled={!followUpInput.trim()} className="rounded-lg px-3 py-2 text-sm font-bold transition-all disabled:opacity-40" style={{ background: '#D4AF37', color: '#0b1929' }}>Send</button>
                  </div>
                </div>
              )}
            </div>
          )}
          </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom action bar */}
        <div className="p-4 border-t" style={{ borderColor: '#1a2e47' }}>
          {currentQ?.type === 'mcq' && !mcqSubmitted && (
            <button
              onClick={() => handleMcqConfirm()}
              disabled={selectedOption === null || evaluating}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
              style={{ background: '#D4AF37', color: '#0b1929' }}
            >
              {evaluating ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirm Answer'}
            </button>
          )}
          {currentQ?.type === 'mcq' && mcqSubmitted && !pendingFollowUp && (
            <button
              onClick={handleMcqNext}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: '#D4AF37', color: '#0b1929' }}
            >
              {qIndex + 1 < totalQuestions ? 'Next Question →' : 'See My Results →'}
            </button>
          )}
          {(currentQ?.type === 'scenario' || currentQ?.type === 'behavioural') && !pendingFollowUp && (
            <div style={{ display:'flex', alignItems:'center' }}>
              {currentQ?.type === 'behavioural' && qIndex > 0 && (
                <button onClick={() => setQIndex(s => s - 1)}
                  style={{ background:'transparent', border:'1px solid #2a4060', color:'#888', padding:'6px 12px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', marginRight:'8px' }}>
                  ← Previous
                </button>
              )}
              <button
                onClick={handleTextSubmit}
                disabled={!textAnswer.trim() || evaluating}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                style={{ background: '#D4AF37', color: '#0b1929' }}
              >
                {evaluating ? <Loader2 size={16} className="animate-spin mx-auto" /> : qIndex + 1 < totalQuestions ? 'Submit & Continue' : 'Submit & See Results'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default AssessmentFlow;
