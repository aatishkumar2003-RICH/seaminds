import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SMCScoreCertificate from "../SMCScoreCertificate";

interface Props {
  assessmentId: string;
  firstName: string;
  lastName: string;
  rank: string;
  onComplete: () => void;
  onBack?: () => void;
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

const ScoreReveal = ({ assessmentId, firstName, lastName, rank, onComplete, onBack, transcript, redFlags, candidateContext }: Props) => {
  const [phase, setPhase] = useState<"loading" | "counting" | "done">("loading");
  const [displayScore, setDisplayScore] = useState(0);
  const [scores, setScores] = useState<Scores | null>(null);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const { accessToken } = useAuth();

  useEffect(() => {
    const run = async () => {
      const authHeaders = { Authorization: `Bearer ${accessToken}` };

      const { data, error } = await supabase.functions.invoke("score-assessment", {
        body: { rank, firstName, transcript: transcript || [], candidateContext: candidateContext || {} },
        headers: authHeaders,
      });
      if (error || !data?.scores) {
        const fallback: Scores = {
          technical: 5, safety: 5, operational: 5, leadership: 5, communication: 5, overall: 2.50,
        };
        setScores(fallback);
      } else {
        setScores(data.scores);
      }
      setTimeout(() => setPhase("counting"), 500);

      // Generate report
      setReportLoading(true);
      supabase.functions.invoke('generate-report', {
        body: { rank, firstName, transcript: transcript || [], scores: data?.scores || {}, redFlags: redFlags || [], candidateContext: candidateContext || {} },
        headers: authHeaders,
      }).then(({ data: rd }) => {
        if (rd?.report) {
          setReport(rd.report);
          supabase.from("smc_assessments").update({
            report: rd.report,
            recommendation: rd.report.recommendation || null,
          } as any).eq("id", assessmentId).then(() => {});
        }
        setReportLoading(false);
      });
    };
    run();
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
              red_flags: redFlags || [],
              report: report || null,
              recommendation: report?.recommendation || null,
              dimension_scores: {
                technical: scores.technical,
                safety: scores.safety,
                operational: scores.operational,
                leadership: scores.leadership,
                communication: scores.communication,
              },
            } as any)
            .eq("id", assessmentId)
            .then(() => {});
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
    <div id="smc-certificate" className="overflow-y-auto" style={{ maxHeight: '100%' }}>
      {onBack && (
        <button onClick={onBack}
          style={{ background:'transparent', border:'1px solid #2a4060', color:'#D4AF37', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', cursor:'pointer', marginBottom:'16px', display:'block' }}>
          ← Back to Profile
        </button>
      )}
      <div style={{ textAlign:'center', marginBottom:'16px' }}>
        <img src="/seaminds-logo.png" style={{ width:'60px', height:'60px', borderRadius:'12px', objectFit:'contain' }} alt="SeaMinds" />
        <div style={{ color:'#D4AF37', fontSize:'11px', letterSpacing:'2px', marginTop:'4px' }}>SEAMINDS CERTIFIED</div>
      </div>
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
      {/* Certificate footer with logo and QR */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'24px', paddingTop:'16px', borderTop:'1px solid rgba(212,175,55,0.3)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <img src="/seaminds-logo.png" style={{ width:'32px', height:'32px', borderRadius:'6px' }} alt="SeaMinds" />
          <div>
            <div style={{ color:'#D4AF37', fontSize:'11px', fontWeight:'bold' }}>SEAMINDS VERIFIED</div>
            <div style={{ color:'#888', fontSize:'10px' }}>seaminds.life</div>
          </div>
        </div>
        {assessmentId && (
          <div style={{ textAlign:'center' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(`https://seaminds.life/verify/${assessmentId}`)}&format=png&bgcolor=0d1b2a&color=D4AF37`}
              style={{ width:'70px', height:'70px', display:'block' }}
              alt="Verify Score"
              crossOrigin="anonymous"
            />
            <div style={{ color:'#888', fontSize:'9px', marginTop:'2px' }}>Scan to verify</div>
          </div>
        )}
      </div>
      <div style={{ textAlign:'center', margin:'16px 0', padding:'12px', background:'white', borderRadius:'8px', display:'inline-block' }}>
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`https://seaminds.life/verify/${certId || assessmentId}`)}&format=png&bgcolor=ffffff`}
          style={{ width:'80px', height:'80px', display:'block' }}
          alt="Verify Certificate"
          crossOrigin="anonymous"
        />
        <div style={{ fontSize:'9px', color:'#666', marginTop:'4px' }}>Scan to verify authenticity</div>
        <div style={{ fontSize:'8px', color:'#999', marginTop:'2px' }}>{certId || assessmentId}</div>
      </div>
      <button
        onClick={async () => {
          try {
            const { default: html2canvas } = await import('html2canvas');
            const { jsPDF } = await import('jspdf');
            const el = document.getElementById('smc-certificate');
            if (!el) return;
            const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#0D1B2A' });
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`SeaMinds-SMC-Certificate-${certId || assessmentId}.pdf`);
          } catch(e) { console.error('Download error:', e); }
        }}
        style={{ background:'#D4AF37', color:'#0D1B2A', border:'none', padding:'10px 24px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', marginTop:'8px', display:'block', width:'100%' }}>
        ⬇ Download Certificate PDF
      </button>
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
          {redFlags && redFlags.length > 0 && (
            <div style={{ background:'#1a2e47', borderRadius:'8px', padding:'16px' }}>
              <div style={{ color:'#D4AF37', fontWeight:'bold', marginBottom:'8px', fontSize:'14px' }}>🔍 INTEGRITY FLAGS</div>
              <p style={{ color:'#aaa', fontSize:'11px', marginBottom:'12px' }}>Automated monitoring detected the following during the assessment.</p>
              {(() => {
                const integrityFlags = redFlags.filter(f => f.category === 'INTEGRITY');
                const tabSwitches = integrityFlags.filter(f => f.evidence?.includes('Tab switched'));
                const pastes = integrityFlags.filter(f => f.evidence?.includes('Copy-paste'));
                const otherFlags = redFlags.filter(f => f.category !== 'INTEGRITY');
                return (
                  <>
                    {tabSwitches.length > 0 && (
                      <div style={{ marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ background: tabSwitches.length >= 3 ? '#c0392b' : '#d4801a', color:'white', borderRadius:'4px', padding:'2px 6px', fontSize:'11px', fontWeight:'bold' }}>
                          {tabSwitches.length >= 3 ? 'HIGH' : 'MEDIUM'}
                        </span>
                        <span style={{ color:'#e0e0e0', fontSize:'13px' }}>
                          Tab switches detected: <strong>{tabSwitches.length}</strong> time(s)
                        </span>
                      </div>
                    )}
                    {pastes.length > 0 && (
                      <div style={{ marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ background:'#555', color:'white', borderRadius:'4px', padding:'2px 6px', fontSize:'11px', fontWeight:'bold' }}>LOW</span>
                        <span style={{ color:'#e0e0e0', fontSize:'13px' }}>
                          Copy-paste detected: <strong>{pastes.length}</strong> time(s) — {pastes.map(p => p.evidence).join('; ')}
                        </span>
                      </div>
                    )}
                    {otherFlags.length > 0 && otherFlags.map((f, i) => (
                      <div key={i} style={{ marginBottom:'8px' }}>
                        <span style={{ background: f.severity === 'HIGH' ? '#c0392b' : f.severity === 'MEDIUM' ? '#d4801a' : '#555', color:'white', borderRadius:'4px', padding:'2px 6px', fontSize:'11px', marginRight:'8px' }}>{f.category}</span>
                        <span style={{ color:'#e0e0e0', fontSize:'13px' }}>{f.evidence}</span>
                      </div>
                    ))}
                    {tabSwitches.length === 0 && pastes.length === 0 && otherFlags.length === 0 && (
                      <div style={{ color:'#4ade80', fontSize:'13px' }}>✓ No integrity concerns detected</div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          {(!redFlags || redFlags.length === 0) && (
            <div style={{ background:'#1a2e47', borderRadius:'8px', padding:'16px' }}>
              <div style={{ color:'#D4AF37', fontWeight:'bold', marginBottom:'8px', fontSize:'14px' }}>🔍 INTEGRITY FLAGS</div>
              <div style={{ color:'#4ade80', fontSize:'13px' }}>✓ No integrity concerns detected — clean assessment</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScoreReveal;
