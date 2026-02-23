import { useState } from "react";
import { TrendingUp, ExternalLink, Shield, Download } from "lucide-react";

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
  overallScore: 4.21,
  subScores: [
    { name: "🔧 Technical Competence", score: 4.42 },
    { name: "📄 Experience Integrity", score: 4.31 },
    { name: "🗣️ Communication Ability", score: 3.89 },
    { name: "🧠 Behavioural Profile", score: 4.05 },
    { name: "💚 Wellness Consistency", score: 4.20 },
  ],
  crewName: "Rajan Kumar",
  rank: "Chief Officer",
  vesselType: "Tanker",
  assessmentDate: "2026-02-22",
  expiryDate: "2028-02-22",
  certificateId: "SMC-421-CO-2026",
};

function getScoreBand(score: number) {
  if (score >= 4.50) return { stars: "⭐⭐⭐⭐⭐", label: "ELITE", colorClass: "text-primary" };
  if (score >= 4.00) return { stars: "⭐⭐⭐⭐", label: "EXPERT", colorClass: "text-slate-300" };
  if (score >= 3.50) return { stars: "⭐⭐⭐", label: "COMPETENT+", colorClass: "text-emerald-400" };
  if (score >= 3.00) return { stars: "⭐⭐⭐", label: "COMPETENT", colorClass: "text-emerald-400" };
  if (score >= 2.00) return { stars: "⭐⭐", label: "DEVELOPING", colorClass: "text-amber-400" };
  return { stars: "⭐", label: "FOUNDATION", colorClass: "text-muted-foreground" };
}

function getBandInterpretation(label: string): string {
  const map: Record<string, string> = {
    ELITE: "Top 5% of assessed seafarers globally — qualifies for premium salary bidding",
    EXPERT: "Top 20% of assessed seafarers globally — qualifies for premium salary bidding",
    "COMPETENT+": "Above average competency — eligible for enhanced contract opportunities",
    COMPETENT: "Meets industry standard — eligible for standard contract opportunities",
    DEVELOPING: "Building competency — recommended Academy training to improve score",
    FOUNDATION: "Early career — complete Academy modules to build your score",
  };
  return map[label] || "";
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
  "🔧 Technical Competence": ["SIRE 2.0 Preparation", "PSC Inspection Readiness", "Vessel Type Specifics"],
  "📄 Experience Integrity": ["Voyage Documentation", "Sea Service Records", "Certification Updates"],
  "🗣️ Communication Ability": ["Bridge Communication", "ISM Code Procedures", "Emergency Response Drills"],
  "🧠 Behavioural Profile": ["Human Factors Assessment", "Fatigue Management", "Team Leadership"],
  "💚 Wellness Consistency": ["Rest Hours Compliance", "Mental Health Awareness", "Physical Fitness"],
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

  const handleDownloadCertificate = () => {
    const subScoreRows = data.subScores
      .map(
        (sub) =>
          `<div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:13px;color:#94a3b8">${sub.name}</span>
              <span style="font-size:13px;font-weight:700;color:#e2e8f0">${sub.score.toFixed(2)}</span>
            </div>
            <div style="height:8px;background:#1e293b;border-radius:9999px;overflow:hidden">
              <div style="height:100%;width:${(sub.score / 5) * 100}%;background:#D4AF37;border-radius:9999px"></div>
            </div>
          </div>`
      )
      .join("");

    const displayName = (!data.crewName || data.crewName === "Complete your profile") ? "—" : data.crewName;
    const interpretation = getBandInterpretation(band.label);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SMC Certificate - ${data.certificateId}</title>
<style>
  @media print { .no-print { display:none!important } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  body { margin:0; padding:0; background:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#e2e8f0; display:flex; flex-direction:column; align-items:center; }
  .cert { width:700px; margin:40px auto; padding:48px; background:#0f172a; border:2px solid #D4AF37; border-radius:16px; position:relative; }
  .cert::before { content:''; position:absolute; inset:6px; border:1px solid rgba(212,175,55,0.3); border-radius:12px; pointer-events:none; }
  .shield { width:64px; height:64px; background:linear-gradient(135deg,#D4AF37,#C5941F,#D4AF37); border-radius:16px; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; font-size:32px; }
  .label { text-align:center; font-size:11px; letter-spacing:0.25em; font-weight:600; color:#D4AF37; text-transform:uppercase; }
  .score { text-align:center; font-size:84px; font-weight:700; color:#D4AF37; line-height:1; margin:16px 0 8px; text-shadow:0 0 20px rgba(212,175,55,0.4); letter-spacing:-3px; }
  .stars { text-align:center; font-size:18px; margin-bottom:4px; }
  .band { text-align:center; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; color:#cbd5e1; }
  .interp { text-align:center; font-size:12px; color:#94a3b8; margin-top:4px; }
  .bars { background:rgba(30,41,59,0.5); border:1px solid #334155; border-radius:12px; padding:20px; margin:24px 0; }
  .details { background:#1e293b; border:1px solid #334155; border-radius:12px; padding:20px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; font-size:12px; }
  .grid .lbl { color:#94a3b8; display:block; margin-bottom:2px; }
  .grid .val { color:#e2e8f0; font-weight:500; }
  .certid { font-family:monospace; color:#D4AF37; font-weight:600; font-size:11px; }
  .verify { border-top:1px solid #334155; margin-top:12px; padding-top:8px; font-size:10px; color:#94a3b8; }
  .verify a { color:#D4AF37; font-weight:500; text-decoration:none; }
  .print-bar { text-align:center; margin:24px 0; }
  .print-btn { background:linear-gradient(135deg,#D4AF37,#C5941F); color:#fff; border:none; padding:14px 40px; font-size:16px; font-weight:600; border-radius:12px; cursor:pointer; }
</style></head><body>
<div class="print-bar no-print"><button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button></div>
<div class="cert">
  <div class="shield">🛡️</div>
  <div class="label">SeaMinds Certified Score</div>
  <div class="score">${data.overallScore.toFixed(2)}</div>
  <div class="stars">${band.stars}</div>
  <div class="band">${band.label}</div>
  <div class="interp">${interpretation}</div>
  <div class="bars">${subScoreRows}</div>
  <div class="details">
    <div class="grid">
      <div><span class="lbl">Name</span><span class="val">${displayName}</span></div>
      <div><span class="lbl">Rank</span><span class="val">${data.rank}</span></div>
      <div><span class="lbl">Vessel Type</span><span class="val">${data.vesselType}</span></div>
      <div><span class="lbl">Assessment Date</span><span class="val">${new Date(data.assessmentDate).toLocaleDateString()}</span></div>
      <div><span class="lbl">Expiry Date</span><span class="val">${new Date(data.expiryDate).toLocaleDateString()}</span></div>
      <div><span class="lbl">Certificate ID</span><span class="certid">${data.certificateId}</span></div>
    </div>
    <div class="verify">Verification: <a href="https://seaminds.life/verify?id=${data.certificateId}" target="_blank">seaminds.life/verify</a></div>
  </div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const nameIsPlaceholder = !data.crewName || data.crewName === "Complete your profile";

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
        {/* Header — Gold Shield Badge */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: "linear-gradient(135deg, #D4AF37 0%, #C5941F 50%, #D4AF37 100%)" }}>
            <Shield size={32} className="text-white" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ color: "#D4AF37" }}>
            SeaMinds Certified Score
          </p>
        </div>

        {/* Large Score — Fix 2: bigger, brighter gold */}
        <div className="text-center py-2">
          <p
            className="font-bold leading-none"
            style={{ fontSize: "84px", letterSpacing: "-3px", color: "#D4AF37", textShadow: "0 0 20px rgba(212,175,55,0.4)" }}
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
          {/* Fix 5: interpretation line */}
          <p className="text-xs text-muted-foreground mt-1">
            {getBandInterpretation(band.label)}
          </p>
        </div>

        {/* Fix 1: Name warning if placeholder */}
        {nameIsPlaceholder && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-400">Complete your profile to personalise this certificate</p>
          </div>
        )}

        {/* Sub-score bars — Fix 4: proportional width based on /5 */}
        <div className="bg-secondary/50 rounded-xl border border-border p-4 space-y-4">
          {data.subScores.map((sub) => (
            <div key={sub.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{sub.name}</span>
                <span className="text-xs font-bold text-foreground">{sub.score.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-primary"
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
              <span className="text-foreground font-medium">{nameIsPlaceholder ? "—" : data.crewName}</span>
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
              <span className="font-mono font-medium text-[11px]" style={{ color: "#D4AF37" }}>{data.certificateId}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border mt-2">
            <p className="text-[10px] text-muted-foreground">
              Verification: <span className="font-medium" style={{ color: "#D4AF37" }}>seaminds.life/verify</span>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDownloadCertificate}
            className="flex-1 font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-white"
            style={{ background: "linear-gradient(135deg, #D4AF37 0%, #C5941F 100%)" }}
          >
            <Download size={16} /> Download Certificate
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
