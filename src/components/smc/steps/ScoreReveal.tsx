import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SMCScoreCertificate from "../SMCScoreCertificate";

interface Props {
  assessmentId: string;
  firstName: string;
  rank: string;
  onComplete: () => void;
}

const DEMO_SCORES = {
  technical: 4.42,
  experience: 4.31,
  communication: 3.89,
  behavioural: 4.05,
  wellness: 4.20,
};

function getRankAbbrev(rank: string): string {
  const map: Record<string, string> = {
    Master: "MA",
    "Chief Officer": "CO",
    "2nd Officer": "2O",
    "3rd Officer": "3O",
    "Chief Engineer": "CE",
    "Second Engineer": "2E",
    "3rd Engineer": "3E",
    AB: "AB",
    Bosun: "BO",
    Cook: "CK",
    Motorman: "MM",
    Electrician: "EL",
  };
  return map[rank] || "CR";
}

function getScoreBand(score: number): string {
  if (score >= 4.5) return "ELITE";
  if (score >= 4.0) return "EXPERT";
  if (score >= 3.5) return "COMPETENT+";
  if (score >= 3.0) return "COMPETENT";
  if (score >= 2.0) return "DEVELOPING";
  return "FOUNDATION";
}

const ScoreReveal = ({ assessmentId, firstName, rank, onComplete }: Props) => {
  const [phase, setPhase] = useState<"loading" | "counting" | "done">("loading");
  const [displayScore, setDisplayScore] = useState(0);

  const overall =
    DEMO_SCORES.technical * 0.3 +
    DEMO_SCORES.experience * 0.25 +
    DEMO_SCORES.communication * 0.2 +
    DEMO_SCORES.behavioural * 0.15 +
    DEMO_SCORES.wellness * 0.1;
  const finalScore = Math.round(overall * 100) / 100;

  const year = new Date().getFullYear();
  const certId = `SMC-${String(Math.round(finalScore * 100)).padStart(3, "0")}-${getRankAbbrev(rank)}-${year}`;
  const band = getScoreBand(finalScore);

  useEffect(() => {
    // Phase 1: Loading
    const loadTimer = setTimeout(() => setPhase("counting"), 3000);
    return () => clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    if (phase !== "counting") return;
    // Count up animation over 2 seconds
    const duration = 2000;
    const steps = 60;
    const increment = finalScore / steps;
    let current = 0;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      current = Math.min(step * increment, finalScore);
      setDisplayScore(Math.round(current * 100) / 100);
      if (step >= steps) {
        clearInterval(interval);
        setDisplayScore(finalScore);
        // Save to DB
        supabase
          .from("smc_assessments")
          .update({
            overall_score: finalScore,
            experience_score: DEMO_SCORES.experience,
            score_band: band,
            certificate_id: certId,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", assessmentId)
          .then(() => setPhase("done"));
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [phase, finalScore, assessmentId, band, certId]);

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center animate-pulse">
          <Shield size={40} className="text-primary" />
        </div>
        <p className="text-lg font-semibold text-foreground">Calculating your SMC Score...</p>
        <Loader2 size={24} className="text-primary animate-spin" />
      </div>
    );
  }

  if (phase === "counting") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">SeaMinds Certified</p>
        <p
          className="font-bold text-primary gold-glow score-glow leading-none"
          style={{ fontSize: "72px", letterSpacing: "-2px" }}
        >
          {displayScore.toFixed(2)}
        </p>
      </div>
    );
  }

  // Phase: done — show full certificate
  const today = new Date();
  const expiry = new Date(today);
  expiry.setFullYear(expiry.getFullYear() + 2);

  return (
    <SMCScoreCertificate
      data={{
        overallScore: finalScore,
        subScores: [
          { name: "🔧 Technical Competence", score: DEMO_SCORES.technical },
          { name: "📄 Experience Integrity", score: DEMO_SCORES.experience },
          { name: "🗣️ Communication Ability", score: DEMO_SCORES.communication },
          { name: "🧠 Behavioural Profile", score: DEMO_SCORES.behavioural },
          { name: "💚 Wellness Consistency", score: DEMO_SCORES.wellness },
        ],
        crewName: firstName,
        rank,
        vesselType: "Tanker",
        assessmentDate: today.toISOString().split("T")[0],
        expiryDate: expiry.toISOString().split("T")[0],
        certificateId: certId,
      }}
    />
  );
};

export default ScoreReveal;
