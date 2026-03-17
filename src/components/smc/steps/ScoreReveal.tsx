import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SMCScoreCertificate from "../SMCScoreCertificate";

interface Props {
  assessmentId: string;
  firstName: string;
  lastName: string;
  rank: string;
  onComplete: () => void;
  transcript?: Array<{question:string,answer:string,score:number,redFlag:boolean,redFlagCategory:string|null,followUp:string|null}>;
  redFlags?: Array<{category:string,evidence:string,question?:string,answer?:string,severity?:string}>;
  candidateContext?: any;
}

interface Scores {
  technical: number;
  safety: number;
  operational: number;
  leadership: number;
  communication: number;
  overall: number;
}

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

const ScoreReveal = ({ assessmentId, firstName, lastName, rank, onComplete, transcript, redFlags, candidateContext }: Props) => {
  const [phase, setPhase] = useState<"loading" | "counting" | "done">("loading");
  const [displayScore, setDisplayScore] = useState(0);
  const [scores, setScores] = useState<Scores | null>(null);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    supabase.functions
      .invoke("score-assessment", {
        body: { rank, firstName, transcript: transcript || [], candidateContext: candidateContext || {} },
      })
      .then(({ data, error }) => {
        if (error || !data?.scores) {
          const fallback: Scores = {
            technical: 5,
            safety: 5,
            operational: 5,
            leadership: 5,
            communication: 5,
            overall: 2.50,
          };
          setScores(fallback);
        } else {
          setScores(data.scores);
        }
        setTimeout(() => setPhase("counting"), 500);

        // Generate report
        setReportLoading(true);
        supabase.functions.invoke('generate-report', {
          body: { rank, firstName, transcript: transcript || [], scores: data?.scores || {}, redFlags: redFlags || [], candidateContext: candidateContext || {} }
        }).then(({ data: rd }) => {
          if (rd?.report) setReport(rd.report);
          setReportLoading(false);
        });
      });
  }, []);

  const overall = scores?.overall ?? 0;
  const finalScore = Math.round(overall * 100) / 100;

  const year = new Date().getFullYear();
  const certId = `SMC-${String(Math.round(finalScore * 100)).padStart(3, "0")}-${getRankAbbrev(rank)}-${year}`;
  const band = getScoreBand(finalScore);

  useEffect(() => {
    if (phase !== "counting" || !scores) return;
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
        setPhase("done");
        trackEvent("smc_assessment_complete", { score: finalScore, band, rank });
        try {
          supabase
            .from("smc_assessments")
            .update({
              overall_score: finalScore,
              experience_score: scores.operational,
              score_band: band,
              certificate_id: certId,
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", assessmentId);
        } catch (err) {
          console.log("DB write error (non-blocking):", err);
        }
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [phase, scores, finalScore, assessmentId, band, certId]);

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

  if (!scores) return null;

  // Phase: done — show full certificate
  const today = new Date();
  const expiry = new Date(today);
  expiry.setFullYear(expiry.getFullYear() + 2);

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return (
    <div className="overflow-y-auto" style={{ maxHeight: '100%' }}>
      <SMCScoreCertificate
        data={{
          overallScore: finalScore,
          subScores: [
            { name: "🔧 Technical Competence", score: scores.technical },
            { name: "🛡️ Safety Awareness", score: scores.safety },
            { name: "⚙️ Operational Knowledge", score: scores.operational },
            { name: "👨‍✈️ Leadership & Teamwork", score: scores.leadership },
            { name: "🗣️ Communication Ability", score: scores.communication },
          ],
          crewName: fullName || "Complete your profile",
          rank,
          vesselType: "Tanker",
          assessmentDate: today.toISOString().split("T")[0],
          expiryDate: expiry.toISOString().split("T")[0],
          certificateId: certId,
        }}
      />
      {reportLoading && (
        <div style={{ textAlign:'center', color:'#D4AF37', padding:'16px', fontSize:'14px' }}>
          Generating your assessment report...
        </div>
      )}
      {report && (
        <div style={{ marginTop:'24px', display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ background:'#1a2e47', borderRadius:'8px', padding:'16px' }}>
            <div style={{ color:'#D4AF37', fontWeight:'bold', marginBottom:'8px', fontSize:'14px' }}>FINDINGS</div>
            {report.findings?.map((f: string, i: number) => (
              <div key={i} style={{ color:'#e0e0e0', fontSize:'13px', marginBottom:'6px', paddingLeft:'8px', borderLeft:'2px solid #D4AF37' }}>{f}</div>
            ))}
          </div>
          <div style={{ background:'#1a2e47', borderRadius:'8px', padding:'16px' }}>
            <div style={{ color:'#D4AF37', fontWeight:'bold', marginBottom:'8px', fontSize:'14px' }}>PROFESSIONAL REMARKS</div>
            <div style={{ color:'#e0e0e0', fontSize:'13px', lineHeight:'1.6', whiteSpace:'pre-line' }}>{report.remarks}</div>
          </div>
          {report.improvement_areas?.length > 0 && (
            <div style={{ background:'#1a2e47', borderRadius:'8px', padding:'16px' }}>
              <div style={{ color:'#D4AF37', fontWeight:'bold', marginBottom:'8px', fontSize:'14px' }}>IMPROVEMENT AREAS</div>
              {report.improvement_areas.map((item: any, i: number) => (
                <div key={i} style={{ marginBottom:'8px' }}>
                  <span style={{ background: item.severity==='Critical'?'#c0392b':item.severity==='Moderate'?'#d4801a':'#555', color:'white', borderRadius:'4px', padding:'2px 6px', fontSize:'11px', marginRight:'8px' }}>{item.severity}</span>
                  <span style={{ color:'#e0e0e0', fontSize:'13px', fontWeight:'bold' }}>{item.area}</span>
                  <div style={{ color:'#aaa', fontSize:'12px', marginTop:'2px', paddingLeft:'4px' }}>{item.detail}</div>
                </div>
              ))}
            </div>
          )}
          {report.training_recommendations?.length > 0 && (
            <div style={{ background:'#1a2e47', borderRadius:'8px', padding:'16px' }}>
              <div style={{ color:'#D4AF37', fontWeight:'bold', marginBottom:'8px', fontSize:'14px' }}>TRAINING RECOMMENDATIONS</div>
              {report.training_recommendations.map((r: string, i: number) => (
                <div key={i} style={{ color:'#e0e0e0', fontSize:'13px', marginBottom:'4px' }}>• {r}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScoreReveal;
