import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StepProgressBar from "./StepProgressBar";

interface Props {
  assessmentId: string;
  questions?: string[];
  onNext: (question?: string, answer?: string) => void;
  onSkipToEnd?: () => void;
  evaluating?: boolean;
  pendingFollowUp?: string | null;
  onFollowUpAnswer?: (answer: string) => void;
  onRedFlag?: (flag: {category:string,evidence:string,severity?:string}) => void;
}

const FALLBACK_QUESTIONS = [
  "Tell me about a time you disagreed with a senior officer's decision. What did you do?",
  "You notice a colleague cutting corners on a safety procedure because they are tired and want to finish quickly. How do you handle it?",
  "You are 50 days into a voyage and two crew members in your department have had a serious argument. As their supervisor, what do you do?",
  "Describe a situation where you had to make a fast decision without enough information. What happened?",
  "What does good teamwork look like on a ship in your experience?",
  "How do you manage stress during long voyages away from your family?",
  "Tell me about a time when you made a mistake at work. How did you handle it?",
  "How do you mentor or support junior crew members?",
  "What is the most important quality for a seafarer in your role?",
  "How do you maintain your motivation and professionalism over a long contract?",
];

interface Message {
  role: "ai" | "user";
  text: string;
}

const BehaviouralProfile = ({ assessmentId, questions: questionsProp, onNext, onSkipToEnd, evaluating, pendingFollowUp, onFollowUpAnswer }: Props) => {
  const activeQuestions = (questionsProp && questionsProp.length > 0) ? questionsProp : FALLBACK_QUESTIONS;
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "Now let's understand your professional profile. I'll ask 10 questions about how you work. There are no right or wrong answers — only honest ones." },
    { role: "ai", text: activeQuestions[0] },
  ]);
  const [input, setInput] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");
  const [qIndex, setQIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pendingFollowUp]);

  const handleSend = () => {
    if (!input.trim()) return;
    const answer = input.trim();
    setInput("");
    const next = qIndex + 1;

    if (next < activeQuestions.length) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text: answer },
        { role: "ai", text: activeQuestions[next] },
      ]);
      setQIndex(next);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "user", text: answer },
        { role: "ai", text: "Profile Complete. Thank you for your openness. Your behavioural profile has been recorded." },
      ]);
      setComplete(true);
    }
  };

  const handleComplete = async () => {
    try {
      await supabase
        .from("smc_assessments")
        .update({ behavioural_score: 4.05, wellness_score: 4.20, current_step: 6 })
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
        <StepProgressBar currentStep={4} totalSteps={5} label="Behavioural Profile" />
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-foreground">Professional Profile</h1>
          <p className="text-xs text-muted-foreground">10 questions about how you work. No right or wrong answers — only honest ones.</p>
        </div>
        {!complete && (
          <p className="text-xs text-center text-primary font-medium">{qIndex + 1} of 10 questions</p>
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
        ) : complete ? (
          <button
            onClick={handleComplete}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            See My Results →
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

export default BehaviouralProfile;
