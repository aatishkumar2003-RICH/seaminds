import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface NPSSurveyProps {
  firstName?: string;
  onDismiss: () => void;
}

const NPSSurvey = ({ firstName, onDismiss }: NPSSurveyProps) => {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleDismiss = () => {
    localStorage.setItem("seaminds_nps_shown", "true");
    onDismiss();
  };

  const handleScore = async (s: number) => {
    setScore(s);
    localStorage.setItem("seaminds_nps_shown", "true");
    // Save score immediately (comment can follow)
    await supabase.from("nps_responses" as any).insert({ score: s } as any);
  };

  const handleSubmit = async () => {
    if (score && comment.trim()) {
      await supabase.from("nps_responses" as any).insert({ score, comment: comment.trim() } as any);
    }
    setSubmitted(true);
    setTimeout(handleDismiss, 2000);
  };

  const handleSkip = () => {
    setSubmitted(true);
    setTimeout(handleDismiss, 1500);
  };

  const name = firstName || "Captain";

  const getScoreColor = (s: number, selected: boolean) => {
    if (!selected) return { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" };
    if (s <= 6) return { background: "rgba(239,68,68,0.2)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.5)" };
    if (s <= 8) return { background: "rgba(245,158,11,0.2)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.5)" };
    return { background: "rgba(34,197,94,0.2)", color: "#86efac", border: "1px solid rgba(34,197,94,0.5)" };
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full max-w-md animate-in slide-in-from-bottom duration-300"
        style={{
          background: "#0D1B2A",
          borderTop: "2px solid #D4AF37",
          borderRadius: "16px 16px 0 0",
          padding: 20,
        }}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X size={18} className="text-muted-foreground" />
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <p className="text-lg font-bold" style={{ color: "#D4AF37" }}>Thank you! 🙏</p>
            <p className="text-xs text-muted-foreground mt-1">Your feedback helps us improve.</p>
          </div>
        ) : score === null ? (
          <>
            <p className="text-base font-bold text-foreground mb-1">
              Quick question, {name} 👋
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              How likely are you to recommend SeaMinds to fellow seafarers?
            </p>
            <div className="flex gap-1.5 justify-between mb-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => handleScore(n)}
                  className="flex-1 aspect-square rounded-lg text-xs font-bold transition-all hover:scale-110"
                  style={getScoreColor(n, false)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <p className="text-[9px] text-muted-foreground">Not likely</p>
              <p className="text-[9px] text-muted-foreground">Very likely</p>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={getScoreColor(score, true)}
              >
                {score}
              </div>
              <p className="text-sm font-medium text-foreground">
                {score >= 9
                  ? "Thank you! 🙏 You're helping seafarers worldwide."
                  : score >= 7
                  ? "Thank you! What could we do better?"
                  : "We're sorry. What went wrong?"}
              </p>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                score >= 9
                  ? "What do you love most? (optional)"
                  : "Tell us more..."
              }
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none"
              style={{
                background: "rgba(13,27,42,0.8)",
                border: "1px solid rgba(212,175,55,0.2)",
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: "rgba(212,175,55,0.15)",
                  border: "1.5px solid #D4AF37",
                  color: "#D4AF37",
                }}
              >
                Submit
              </button>
              {score >= 9 && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-white/5 transition-colors"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NPSSurvey;
