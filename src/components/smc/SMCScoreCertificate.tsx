import { useState } from "react";
import { Share2, TrendingUp, Award, ExternalLink } from "lucide-react";

interface SubScore {
  name: string;
  score: number;
}

interface SMCScoreData {
  overallScore: number;
  subScores: SubScore[];
  crewName: string;
  rank: string;
  vesselType: string;
  assessmentDate: string;
  expiryDate: string;
  certificateId: string;
}

// Demo data for development
const DEMO_DATA: SMCScoreData = {
  overallScore: 4.17,
  subScores: [
    { name: "Technical Competence", score: 4.42 },
    { name: "Experience Integrity", score: 4.31 },
    { name: "Communication Ability", score: 3.89 },
    { name: "Behavioural Profile", score: 4.05 },
    { name: "Wellness Consistency", score: 4.20 },
  ],
  crewName: "Rajan Kumar",
  rank: "Chief Officer",
  vesselType: "Tanker",
  assessmentDate: "2026-02-22",
  expiryDate: "2028-02-22",
  certificateId: "SMC-417-CO-2026",
};

function getScoreBand(score: number) {
  if (score >= 4.50) return { stars: "⭐⭐⭐⭐⭐", label: "ELITE", colorClass: "text-primary" };
  if (score >= 4.00) return { stars: "⭐⭐⭐⭐", label: "EXPERT", colorClass: "text-slate-300" };
  if (score >= 3.50) return { stars: "⭐⭐⭐", label: "COMPETENT+", colorClass: "text-emerald-400" };
  if (score >= 3.00) return { stars: "⭐⭐⭐", label: "COMPETENT", colorClass: "text-emerald-400" };
  if (score >= 2.00) return { stars: "⭐⭐", label: "DEVELOPING", colorClass: "text-amber-400" };
  return { stars: "⭐", label: "FOUNDATION", colorClass: "text-muted-foreground" };
}

function getBarColor(score: number) {
  if (score >= 4.50) return "bg-primary";
  if (score >= 4.00) return "bg-slate-300";
  if (score >= 3.50) return "bg-emerald-400";
  if (score >= 3.00) return "bg-emerald-400";
  if (score >= 2.00) return "bg-amber-400";
  return "bg-muted-foreground";
}

const ACADEMY_MAP: Record<string, string[]> = {
  "Technical Competence": ["SIRE 2.0 Preparation", "PSC Inspection Readiness", "Vessel Type Specifics"],
  "Experience Integrity": ["Voyage Documentation", "Sea Service Records", "Certification Updates"],
  "Communication Ability": ["Bridge Communication", "ISM Code Procedures", "Emergency Response Drills"],
  "Behavioural Profile": ["Human Factors Assessment", "Fatigue Management", "Team Leadership"],
  "Wellness Consistency": ["Rest Hours Compliance", "Mental Health Awareness", "Physical Fitness"],
};

interface SMCScoreCertificateProps {
  data?: SMCScoreData;
  onImproveScore?: () => void;
}

const SMCScoreCertificate = ({ data = DEMO_DATA, onImproveScore }: SMCScoreCertificateProps) => {
  const [showImprove, setShowImprove] = useState(false);
  const band = getScoreBand(data.overallScore);

  const lowestSub = [...data.subScores].sort((a, b) => a.score - b.score)[0];
  const improvementTopics = ACADEMY_MAP[lowestSub.name] || [];

  const handleShare = () => {
    const text = `🏅 SMC Score: ${data.overallScore.toFixed(2)} — ${band.label}\n${data.crewName} | ${data.rank}\nCertificate: ${data.certificateId}\nVerify: seaminds.life/verify`;
    if (navigator.share) {
      navigator.share({ title: "My SMC Score", text });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  if (showImprove) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="p-6 space-y-6">
          <button onClick={() => setShowImprove(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Certificate
          </button>

          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold text-foreground">Improve Your Score</h2>
            <p className="text-sm text-muted-foreground">
              Your lowest sub-score is <span className="text-primary font-semibold">{lowestSub.name}</span> at {lowestSub.score.toFixed(2)}
            </p>
          </div>

          <div className="bg-secondary rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{lowestSub.name}</span>
              <span className="text-sm font-bold text-primary">{lowestSub.score.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${getBarColor(lowestSub.score)}`} style={{ width: `${(lowestSub.score / 5) * 100}%` }} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Recommended Academy Content</h3>
            {improvementTopics.map((topic, i) => (
              <div key={i} className="bg-secondary rounded-xl border border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <TrendingUp size={14} className="text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{topic}</span>
                </div>
                <ExternalLink size={14} className="text-muted-foreground" />
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Completing these modules can improve your {lowestSub.name} sub-score by up to 0.5 points.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
            <Award size={24} className="text-primary" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">SeaMinds Certified</p>
        </div>

        {/* Large Score */}
        <div className="text-center py-4">
          <p
            className="font-bold text-primary gold-glow score-glow leading-none"
            style={{ fontSize: "72px", letterSpacing: "-2px" }}
          >
            {data.overallScore.toFixed(2)}
          </p>
        </div>

        {/* Band */}
        <div className="text-center space-y-1">
          <p className="text-lg tracking-wide">{band.stars}</p>
          <p className={`text-sm font-bold uppercase tracking-[0.15em] ${band.colorClass}`}>
            {band.label}
          </p>
        </div>

        {/* Sub-score bars */}
        <div className="bg-secondary/50 rounded-xl border border-border p-4 space-y-4">
          {data.subScores.map((sub) => (
            <div key={sub.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{sub.name}</span>
                <span className="text-xs font-bold text-foreground">{sub.score.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${getBarColor(sub.score)}`}
                  style={{ width: `${(sub.score / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Certificate footer */}
        <div className="bg-secondary rounded-xl border border-border p-4 space-y-2">
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <div>
              <span className="text-muted-foreground block">Name</span>
              <span className="text-foreground font-medium">{data.crewName}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Rank</span>
              <span className="text-foreground font-medium">{data.rank}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Vessel Type</span>
              <span className="text-foreground font-medium">{data.vesselType}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Assessment Date</span>
              <span className="text-foreground font-medium">{new Date(data.assessmentDate).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Expiry Date</span>
              <span className="text-foreground font-medium">{new Date(data.expiryDate).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Certificate ID</span>
              <span className="text-primary font-mono font-medium text-[11px]">{data.certificateId}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border mt-2">
            <p className="text-[10px] text-muted-foreground">
              Verification: <span className="text-primary font-medium">seaminds.life/verify</span>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Share2 size={16} /> Share My Certificate
          </button>
          <button
            onClick={() => { setShowImprove(true); onImproveScore?.(); }}
            className="flex-1 bg-secondary border border-border text-foreground font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
          >
            <TrendingUp size={16} /> Improve My Score
          </button>
        </div>
      </div>
    </div>
  );
};

export default SMCScoreCertificate;
