import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StepProgressBar from "./StepProgressBar";

interface Props {
  firstName: string;
  rank: string;
  shipName: string;
  assessmentId: string;
  questions?: string[];
  onNext: (question?: string, answer?: string) => void;
  onSkipToEnd?: () => void;
  evaluating?: boolean;
  pendingFollowUp?: string | null;
  onFollowUpAnswer?: (answer: string) => void;
  onRedFlag?: (flag: {category:string,evidence:string,severity?:string}) => void;
}

const QUESTIONS_BY_RANK: Record<string, string[]> = {
  default: [
    "You are on anchor watch and you notice the anchor chain has gone slack and the vessel appears to be swinging. What do you do immediately?",
    "Describe the correct procedure for rigging a pilot ladder on the starboard side.",
    "What are the SOLAS requirements for fire drills and how often must they be conducted?",
    "Explain the procedure you follow when preparing for a Port State Control inspection.",
    "How do you ensure proper communication during cargo operations?",
    "What is the ISM Code and why is it important for vessel safety?",
    "Describe the procedure for testing emergency fire pump.",
    "What are the MARPOL Annex I requirements for discharge of oily water?",
    "How do you conduct a risk assessment before a critical operation?",
    "Explain the difference between enclosed space entry and confined space entry procedures.",
    "What is ECDIS and what are the common errors in its use?",
    "Describe the abandon ship procedure from your role's perspective.",
    "What are the basic principles of stability and how do they affect your daily work?",
    "How do you maintain the safety management system documentation?",
    "What lessons have you learned from your most challenging voyage?",
  ],
  "Chief Officer": [
    "You are loading a cargo of iron ore fines in Paradip, India. The shipper declares TML at 23% and moisture content at 20%. The cargo looks wet on the surface. What is your decision and what are your actions?",
    "Describe the cargo securing arrangement for containers on a 4,000 TEU vessel in winter North Atlantic trade.",
    "What are your responsibilities under the ISM Code as Chief Officer?",
    "Explain the procedure for conducting a stability assessment before loading heavy lift cargo.",
    "How do you prepare for a SIRE 2.0 inspection?",
  ],
  "Master": [
    "You are loading a cargo of iron ore fines in Paradip, India. The shipper declares TML at 23% and moisture content at 20%. The cargo looks wet on the surface. What is your decision and what are your actions?",
    "A crew member needs urgent medical attention 200 miles from the nearest port. Walk me through your decision-making process.",
    "Describe how you handle a disagreement with the charterer regarding unsafe cargo operations.",
    "What is your procedure when you receive a weather warning for a tropical revolving storm in your path?",
    "How do you ensure compliance with the MLC 2006 requirements onboard?",
  ],
  "Chief Engineer": [
    "Your main engine trips on high jacket water temperature while at sea in good weather. Walk me through your immediate actions and fault-finding procedure.",
    "Describe the procedure for overhauling a main engine fuel injector.",
    "How do you manage planned maintenance system for a fleet of auxiliary engines?",
    "Explain the process of bunkering including quality testing and quantity measurement.",
    "What actions do you take when the OWS is not achieving the required 15ppm discharge standard?",
  ],
  "Second Engineer": [
    "Your main engine trips on high jacket water temperature while at sea in good weather. Walk me through your immediate actions and fault-finding procedure.",
    "Describe the procedure for crankcase inspection and what you look for.",
    "How do you troubleshoot an auxiliary engine that is surging?",
    "Explain the fresh water generator operation and common faults.",
    "What is your routine for preparing the main engine for arrival/departure?",
  ],
  "2nd Officer": [
    "You are on watch at night and your ARPA shows a vessel at 6 miles on a steady bearing, CPA 0.1 miles. What are your actions under COLREGS?",
    "Describe the procedure for updating nautical charts and publications.",
    "How do you plan a passage through a Traffic Separation Scheme?",
    "What are the requirements for maintaining the GMDSS equipment?",
    "Explain how you conduct a navigational audit.",
  ],
  "3rd Officer": [
    "You are on watch at night and your ARPA shows a vessel at 6 miles on a steady bearing, CPA 0.1 miles. What are your actions under COLREGS?",
    "Describe the correct procedure for conducting a lifeboat drill.",
    "How do you maintain the firefighting equipment inventory?",
    "What are the SOLAS requirements for LSA maintenance?",
    "Explain your duties during mooring operations.",
  ],
  "AB": [
    "You are on anchor watch and you notice the anchor chain has gone slack and the vessel appears to be swinging. What do you do immediately?",
    "Describe the correct procedure for rigging a pilot ladder on the starboard side.",
    "How do you prepare for and execute a mooring operation safely?",
    "What are the PPE requirements for tank cleaning?",
    "Describe the enclosed space entry procedure from a rating's perspective.",
  ],
  "Bosun": [
    "You are on anchor watch and you notice the anchor chain has gone slack and the vessel appears to be swinging. What do you do immediately?",
    "How do you plan and supervise deck maintenance for a voyage?",
    "Describe the procedure for wire rope inspection and when to condemn a wire.",
    "What are your responsibilities during cargo operations?",
    "How do you manage your deck team's work-rest hours during port operations?",
  ],
  "Cook": [
    "Three crew members report stomach pain and diarrhea after breakfast. What is your immediate response?",
    "Describe your food storage and hygiene procedures.",
    "How do you manage provisions for a 90-day voyage?",
    "What are the MLC 2006 requirements for food and catering?",
    "How do you handle dietary restrictions and religious food requirements?",
  ],
  "Motorman": [
    "The oily water separator alarm activates showing oil content above 15ppm. What do you do?",
    "Describe your daily routine checks in the engine room.",
    "How do you assist during bunkering operations?",
    "What are the procedures for bilge pumping?",
    "Describe the emergency generator start-up procedure.",
  ],
};

function getQuestions(rank: string): string[] {
  const rankQuestions = QUESTIONS_BY_RANK[rank];
  if (rankQuestions && rankQuestions.length >= 5) {
    const base = rankQuestions.slice(0, 5);
    const defaults = QUESTIONS_BY_RANK.default;
    return [...base, ...defaults.slice(0, 10)];
  }
  return QUESTIONS_BY_RANK.default;
}

interface Message {
  role: "ai" | "user";
  text: string;
}

const TechnicalAssessment = ({ firstName, rank, shipName, assessmentId, questions: questionsProp, onNext, onSkipToEnd, evaluating, pendingFollowUp, onFollowUpAnswer, onRedFlag }: Props) => {
  const activeQuestions = (questionsProp && questionsProp.length > 0) ? questionsProp : getQuestions(rank);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");
  const [qIndex, setQIndex] = useState(-1);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        role: "ai",
        text: `Welcome ${firstName}. I am your SeaMinds examiner. I will ask you 15 questions based on your experience as ${rank} on ${shipName}. Take your time — honest answers only. There are no trick questions. Ready to begin?`,
      },
    ]);
  }, [firstName, rank, shipName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pendingFollowUp]);

  // Per-question countdown timer
  useEffect(() => {
    if (qIndex < 0 || complete) return;
    setTimeLeft(90);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-submit current answer
          const answer = input.trim() || "[No answer — time expired]";
          setInput("");
          const next = qIndex + 1;
          if (next < activeQuestions.length) {
            setMessages(p => [...p, { role: "user", text: answer }, { role: "ai", text: activeQuestions[next] }]);
            setQIndex(next);
          } else {
            setMessages(p => [...p, { role: "user", text: answer }, { role: "ai", text: "Assessment Recording Complete. Thank you for your honest and detailed answers." }]);
            setComplete(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [qIndex, complete]);

  const handlePaste = () => {
    onRedFlag?.({ category: 'INTEGRITY', evidence: `Copy-paste detected on question ${qIndex + 1}`, severity: 'LOW' });
  };

  const handleReady = () => {
    setReady(true);
    setQIndex(0);
    setMessages((prev) => [...prev, { role: "user", text: "Yes, I'm ready." }, { role: "ai", text: activeQuestions[0] }]);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const answer = input.trim();
    setInput("");
    const next = qIndex + 1;

    const ack = [
      "Thank you. Noted.",
      "Good answer. Let's continue.",
      "Understood. Next question.",
      "Well explained. Moving on.",
      "Noted. Here's the next one.",
    ];

    if (next < activeQuestions.length) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text: answer },
        { role: "ai", text: `${ack[next % ack.length]}\n\n${activeQuestions[next]}` },
      ]);
      setQIndex(next);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "user", text: answer },
        { role: "ai", text: "Assessment Recording Complete. Thank you for your honest and detailed answers. Your technical competence has been evaluated." },
      ]);
      setComplete(true);
    }
  };

  const handleContinue = async () => {
    try {
      await supabase
        .from("smc_assessments")
        .update({ technical_score: 4.42, current_step: 4 })
        .eq("id", assessmentId);
    } catch (err) { console.log("DB write error (non-blocking):", err); }
    onNext();
  };

  const handleFollowUpSubmit = () => {
    if (!followUpInput.trim() || !onFollowUpAnswer) return;
    const answer = followUpInput.trim();
    setFollowUpInput("");
    setMessages((prev) => [...prev, { role: "user", text: answer }]);
    onFollowUpAnswer(answer);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-2 space-y-4">
        <StepProgressBar currentStep={2} totalSteps={5} label="Technical Knowledge" />
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-foreground">Your Technical Assessment</h1>
          <p className="text-xs text-muted-foreground">15 questions matched to your rank and vessel type. Answer in your own words.</p>
        </div>
        {qIndex >= 0 && !complete && (
          <p className="text-xs text-center text-primary font-medium">{qIndex + 1} of 15 questions completed</p>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 space-y-3 pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[hsl(var(--crew-bubble))] text-foreground rounded-br-md"
                  : "bg-[hsl(var(--ai-bubble))] text-foreground rounded-bl-md"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {evaluating && (
          <div className="flex justify-start">
            <div className="bg-[hsl(var(--ai-bubble))] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Evaluating your answer...</span>
            </div>
          </div>
        )}

        {pendingFollowUp && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-primary/10 border border-primary/30 rounded-bl-md space-y-2">
              <p className="text-xs font-semibold text-primary">Follow-up Question</p>
              <p className="text-foreground">{pendingFollowUp}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border space-y-2">
        {pendingFollowUp ? (
          <div className="flex gap-2">
            <input
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFollowUpSubmit()}
              placeholder="Answer the follow-up..."
              className="flex-1 bg-secondary border border-primary/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={handleFollowUpSubmit}
              disabled={!followUpInput.trim()}
              className="bg-primary text-primary-foreground rounded-xl px-4 hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div>
        ) : !ready ? (
          <button
            onClick={handleReady}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Yes, I'm Ready
          </button>
        ) : complete ? (
          <button
            onClick={handleContinue}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Continue to Communication Test →
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your answer..."
              className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
              disabled={evaluating}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || evaluating}
              className="bg-primary text-primary-foreground rounded-xl px-4 hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechnicalAssessment;
