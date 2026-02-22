import { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StepProgressBar from "./StepProgressBar";

interface Props {
  firstName: string;
  rank: string;
  profileId: string;
  assessmentId: string;
  onNext: () => void;
  onSkipToEnd?: () => void;
}

const DocumentVerification = ({ firstName, rank, profileId, assessmentId, onNext, onSkipToEnd }: Props) => {
  const [issueNote, setIssueNote] = useState("");

  const handleContinue = async () => {
    try {
      await supabase
        .from("smc_assessments")
        .update({ doc_upload_status: "verified", current_step: 3 })
        .eq("id", assessmentId);
    } catch (err) { console.log("DB write error (non-blocking):", err); }
    onNext();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <StepProgressBar currentStep={1} totalSteps={5} label="Document Verification" />

        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-4 text-center">
          <p className="text-lg font-bold text-emerald-400">✅ Documents Verified</p>
        </div>

        <div className="bg-secondary rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Verification Summary</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Name</span>
              <span className="text-foreground font-medium">{firstName}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Current Rank</span>
              <span className="text-foreground font-medium">{rank}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Certificates Valid</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1"><Check size={14} /> Yes</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">We noticed your BST certificate may be expiring soon. Please explain:</p>
          </div>
          <textarea
            value={issueNote}
            onChange={(e) => setIssueNote(e.target.value)}
            placeholder="Optional: add any notes..."
            className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-20"
          />
        </div>

        <button
          onClick={handleContinue}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl text-base hover:bg-primary/90 transition-colors"
        >
          Continue to Technical Assessment →
        </button>

        <button
          onClick={onSkipToEnd || onNext}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip to Certificate (testing only)
        </button>
      </div>
    </div>
  );
};

export default DocumentVerification;
