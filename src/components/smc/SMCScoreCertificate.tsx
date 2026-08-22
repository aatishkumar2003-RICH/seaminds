import { useEffect, useState } from "react";
import { TrendingUp, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

interface CertRecord extends SMCScoreData {
  band: string;
}

function bandVisual(label: string) {
  const map: Record<string, { stars: string; color: string }> = {
    ELITE: { stars: "⭐⭐⭐⭐⭐", color: "#D4AF37" },
    EXPERT: { stars: "⭐⭐⭐⭐", color: "#C0C0C0" },
    "COMPETENT+": { stars: "⭐⭐⭐", color: "#34D399" },
    COMPETENT: { stars: "⭐⭐⭐", color: "#34D399" },
    DEVELOPING: { stars: "⭐⭐", color: "#FBBF24" },
    FOUNDATION: { stars: "⭐", color: "#94A3B8" },
  };
  return map[(label || "").toUpperCase()] || { stars: "", color: "#94A3B8" };
}

function getBarColor(score: number) {
  if (score >= 4.5) return "bg-primary";
  if (score >= 4.0) return "bg-slate-300";
  if (score >= 3.0) return "bg-emerald-400";
  if (score >= 2.0) return "bg-amber-400";
  return "bg-muted-foreground";
}

const ACADEMY_MAP: Record<string, string[]> = {
  "🔧 Technical Competence": ["SIRE 2.0 Preparation", "PSC Inspection Readiness", "Vessel Type Specifics"],
  "🧭 Judgment & Decision-Making": ["Bridge Resource Management", "Emergency Response Drills", "Risk Assessment"],
  "🗣️ Maritime English": ["Bridge Communication", "SMCP Phrases", "Report Writing"],
  "👨‍✈️ Professional Behaviour": ["Human Factors Assessment", "Fatigue Management", "Team Leadership"],
};

interface SMCScoreCertificateProps {
  data?: SMCScoreData;
  onImproveScore?: () => void;
}

const SMCScoreCertificate = ({ data: hint, onImproveScore }: SMCScoreCertificateProps) => {
  const [showImprove, setShowImprove] = useState(false);
  const [cert, setCert] = useState<CertRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let q = supabase
          .from("smc_assessments")
          .select("id, crew_profile_id, overall_score, technical_score, judgment_score, english_score, behavioural_score, score_band, certificate_id, completed_at, status, report")
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(1);

        if (hint?.certificateId) {
          q = q.eq("certificate_id", hint.certificateId);
        } else {
          const { data: auth } = await supabase.auth.getUser();
          if (!auth?.user) { if (alive) { setCert(null); setLoading(false); } return; }
          q = q.eq("crew_profile_id", auth.user.id);
        }

        const { data: rows } = await q;
        const a: any = rows?.[0];
        if (!a || !a.completed_at || a.overall_score == null) {
          if (alive) { setCert(null); setLoading(false); }
          return;
        }

        const [{ data: profile }, { data: vessels }] = await Promise.all([
          supabase.from("crew_profiles").select("first_name, last_name, rank").eq("id", a.crew_profile_id).maybeSingle(),
          supabase.from("crew_vessel_experience").select("vessel_family, sea_time_band").eq("crew_id", a.crew_profile_id),
        ]);

        let vesselType = (a.report?.vessel_type as string) || "";
        if (vessels && vessels.length > 0) {
          const ranked = await Promise.all(
            vessels.map(async (v: any) => {
              const { data: mid } = await supabase.rpc("band_years_midpoint" as never, { p_band: v.sea_time_band } as never);
              return { family: v.vessel_family as string, years: Number(mid) || 0 };
            })
          );
          ranked.sort((x, y) => y.years - x.years);
          if (ranked[0]?.family) vesselType = ranked[0].family;
        }

        const completed = new Date(a.completed_at);
        const expiry = new Date(a.completed_at);
        expiry.setFullYear(expiry.getFullYear() + 2);

        const subScores: SubScore[] = [
          { name: "🔧 Technical Competence", score: Number(a.technical_score) || 0 },
          { name: "🧭 Judgment & Decision-Making", score: Number(a.judgment_score) || 0 },
          { name: "🗣️ Maritime English", score: Number(a.english_score) || 0 },
          { name: "👨‍✈️ Professional Behaviour", score: Number(a.behavioural_score) || 0 },
        ];

        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

        if (!alive) return;
        setCert({
          overallScore: Number(a.overall_score),
          subScores,
          crewName: name,
          rank: profile?.rank || "",
          vesselType,
          assessmentDate: completed.toISOString(),
          expiryDate: expiry.toISOString(),
          certificateId: a.certificate_id || a.id,
          band: a.score_band || "",
        });
        setLoading(false);
      } catch {
        if (alive) { setCert(null); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [hint?.certificateId]);

  const captureAsImage = async (): Promise<string> => {
    const { default: html2canvas } = await import("html2canvas");
    const el = document.getElementById("smc-certificate");
    if (!el) throw new Error("Certificate element not found");
    const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: "#0D1B2A" });
    return canvas.toDataURL("image/png");
  };

  const handleDownloadPNG = async () => {
    try {
      const dataUrl = await captureAsImage();
      const link = document.createElement("a");
      link.download = `SeaMinds-Certificate-${cert?.certificateId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) { console.error(e); }
  };

  const handleDownloadPDF = async () => {
    try {
      const dataUrl = await captureAsImage();
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1200, 800] });
      pdf.addImage(dataUrl, "PNG", 0, 0, 1200, 800);
      pdf.save(`SeaMinds-Certificate-${cert?.certificateId}.pdf`);
    } catch (e) { console.error(e); }
  };

  const handleShare = async () => {
    if (!cert) return;
    try {
      const dataUrl = await captureAsImage();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `SeaMinds-Certificate-${cert.certificateId}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My SeaMinds Certified Score", text: `I scored ${cert.overallScore.toFixed(2)} on my SeaMinds Competency Assessment as ${cert.rank}.` });
      } else {
        handleDownloadPNG();
      }
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">Loading certificate…</div>
    );
  }

  if (!cert) {
    return (
      <div className="p-6 text-center">
        <div className="text-3xl mb-2">⚓</div>
        <p className="text-sm font-semibold text-foreground">No completed assessment yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your certificate appears here once you complete the SMC assessment.
        </p>
      </div>
    );
  }

  const band = bandVisual(cert.band);
  const lowestSub = [...cert.subScores].sort((a, b) => a.score - b.score)[0];
  const improvementTopics = ACADEMY_MAP[lowestSub?.name] || [];
  const verifyUrl = `https://seaminds.life/verify/${cert.certificateId}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(verifyUrl)}`;

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

  const subScoreLabels = ["Technical Competence", "Judgment & Decision-Making", "Maritime English", "Professional Behaviour"];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Certificate Card */}
        <div
          id="smc-certificate"
          style={{
            width: '900px',
            height: '600px',
            background: `#0D1B2A`,
            backgroundImage: `repeating-linear-gradient(45deg, rgba(212,175,55,0.03) 0px, rgba(212,175,55,0.03) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(-45deg, rgba(212,175,55,0.03) 0px, rgba(212,175,55,0.03) 1px, transparent 1px, transparent 40px)`,
            border: '3px solid #D4AF37',
            outline: '1px solid rgba(212,175,55,0.4)',
            outlineOffset: '8px',
            position: 'relative',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#e2e8f0',
            overflow: 'hidden',
            maxWidth: '100%',
            transformOrigin: 'top left',
            transform: 'scale(0.42)',
            marginBottom: '-348px',
          }}
        >
          {/* Holographic ribbon */}
          <div style={{
            position: 'absolute', top: '90px', left: 0, right: 0, height: '3px',
            background: 'linear-gradient(90deg, #0D1B2A, #D4AF37, #0D1B2A, #D4AF37, #0D1B2A)',
            opacity: 0.3,
          }} />
          <div style={{
            position: 'absolute', bottom: '50px', left: 0, right: 0, height: '3px',
            background: 'linear-gradient(90deg, #0D1B2A, #D4AF37, #0D1B2A, #D4AF37, #0D1B2A)',
            opacity: 0.3,
          }} />

          {/* Main layout: two columns */}
          <div style={{ display: 'flex', height: '100%', padding: '24px 36px' }}>
            {/* Left column */}
            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: '30px' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '36px', marginBottom: '4px' }}>⚓</div>
                <div style={{ fontSize: '13px', letterSpacing: '0.3em', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase' as const }}>
                  SeaMinds Certified
                </div>
                <div style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#94a3b8', marginTop: '2px', textTransform: 'uppercase' as const }}>
                  Competency Certificate
                </div>
              </div>

              {/* Candidate name */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', color: '#D4AF37', letterSpacing: '2px', fontWeight: 700 }}>
                  {cert.crewName || "—"}
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                  {[cert.rank, cert.vesselType].filter(Boolean).join(" • ")}
                </div>
              </div>

              {/* Score display */}
              <div style={{ textAlign: 'center', margin: '12px 0' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '72px', fontWeight: 700, color: '#D4AF37', lineHeight: 1, letterSpacing: '-3px', textShadow: '0 0 30px rgba(212,175,55,0.3)' }}>
                    {cert.overallScore.toFixed(2)}
                  </span>
                  {cert.band && (
                    <span style={{
                      background: band.color,
                      color: '#0D1B2A',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                    }}>
                      {cert.band}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{band.stars}</div>
              </div>

              {/* Sub-scores */}
              <div style={{ marginTop: '8px' }}>
                {cert.subScores.map((sub, i) => (
                  <div key={i} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                      <span style={{ color: '#94a3b8' }}>{subScoreLabels[i] || sub.name}</span>
                      <span style={{ color: '#D4AF37', fontWeight: 700 }}>{sub.score.toFixed(2)}/5.00</span>
                    </div>
                    <div style={{ height: '6px', background: '#1a2e47', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(sub.score / 5) * 100}%`, background: 'linear-gradient(90deg, #C5941F, #D4AF37)', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div style={{ width: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderLeft: '1px solid rgba(212,175,55,0.2)', paddingLeft: '30px' }}>
              {/* QR verification */}
              <div style={{
                background: '#ffffff', padding: '8px', borderRadius: '8px', marginBottom: '14px',
                border: '1px solid rgba(212,175,55,0.4)',
              }}>
                <img src={qrSrc} crossOrigin="anonymous" alt={`Verify certificate ${cert.certificateId}`} style={{ width: '96px', height: '96px', display: 'block' }} />
              </div>

              {/* Certificate ID box */}
              <div style={{
                border: '1px solid rgba(212,175,55,0.4)', borderRadius: '8px', padding: '12px',
                textAlign: 'center', width: '100%', marginBottom: '16px',
                background: 'rgba(212,175,55,0.05)',
              }}>
                <div style={{ fontSize: '8px', color: '#94a3b8', letterSpacing: '0.1em', marginBottom: '4px', textTransform: 'uppercase' as const }}>Certificate ID</div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#D4AF37', fontWeight: 700 }}>{cert.certificateId}</div>
                <div style={{ fontSize: '8px', color: '#64748b', marginTop: '6px' }}>Verify at seaminds.life/verify</div>
              </div>

              {/* Details */}
              <div style={{ width: '100%', fontSize: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Assessed on</span>
                  <span style={{ color: '#cbd5e1' }}>{new Date(cert.assessmentDate).toLocaleDateString('en-GB')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Valid until</span>
                  <span style={{ color: '#cbd5e1' }}>{new Date(cert.expiryDate).toLocaleDateString('en-GB')}</span>
                </div>
              </div>

              {/* Issuer */}
              <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '8px', color: '#64748b', lineHeight: 1.4 }}>
                Issued by<br />
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>PT Indoglobal Service Solutions</span>
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            borderTop: '1px solid #D4AF37', padding: '8px 0',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '9px', color: '#D4AF37', fontStyle: 'italic', letterSpacing: '0.05em' }}>
              SeaMinds — Advancing Maritime Excellence Through AI
            </span>
          </div>
        </div>

        {/* Name warning */}
        {!cert.crewName && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-400">Complete your profile to personalise this certificate</p>
          </div>
        )}

        {/* Export buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleDownloadPNG} style={{ background: '#0D1B2A', border: '1px solid #D4AF37', color: '#D4AF37', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            ⬇ Save as Image
          </button>
          <button onClick={handleDownloadPDF} style={{ background: '#D4AF37', border: 'none', color: '#0D1B2A', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            ⬇ Download PDF
          </button>
          <button onClick={handleShare} style={{ background: '#1a5a3a', border: 'none', color: 'white', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            ↗ Share Certificate
          </button>
        </div>

        {/* Improve score button */}
        <button
          onClick={() => { setShowImprove(true); onImproveScore?.(); }}
          className="w-full bg-secondary border border-border text-foreground font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
        >
          <TrendingUp size={16} /> Improve My Score
        </button>
      </div>
    </div>
  );
};

export default SMCScoreCertificate;
