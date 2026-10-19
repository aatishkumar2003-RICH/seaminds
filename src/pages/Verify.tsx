import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import seamindsLogo from "@/assets/seaminds-logo.png";

type VerifyResult = {
  valid: boolean;
  reason?: string;
  certificate_id?: string;
  candidate?: string;
  rank?: string;
  assessed_on?: string;
  expires_on?: string;
  expired?: boolean;
  score?: number | string;
  band?: string;
  scoring_version?: string;
  dimensions?: { technical?: number | null; judgment?: number | null; english?: number | null; behavioural?: number | null } | null;
  level_profile?: {
    recall_pct?: number | null;
    application_pct?: number | null;
    judgment_pct?: number | null;
    questions?: number | null;
    verdict?: string | null;
  } | null;
};

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

const TIERS: Array<{ key: 'recall_pct' | 'application_pct' | 'judgment_pct'; label: string; hint: string }> = [
  { key: 'recall_pct', label: 'Regulatory recall', hint: 'Rules, limits and required values' },
  { key: 'application_pct', label: 'Operational application', hint: 'Applying procedure to real equipment' },
  { key: 'judgment_pct', label: 'Command judgment', hint: 'Deciding under pressure and risk' },
];

const VERDICTS: Record<string, string> = {
  balanced: 'Balanced across knowledge and judgment',
  'strong knowledge, unproven decision-making': 'Strong knowledge — decision-making not yet proven',
  'sound judgment, weaker recall': 'Sound judgment — regulatory recall weaker',
};

const pctColor = (p: number) => (p >= 70 ? '#22c55e' : p >= 50 ? '#f59e0b' : '#ef4444');

const Verify = () => {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/app');
  };

  const shareUrl = `https://seaminds.life/verify/${id || ''}`;
  const handleShare = async () => {
    const text = `${result?.candidate || 'Seafarer'}${result?.rank ? ` (${result.rank})` : ''} — SeaMinds verified certificate`;
    try {
      if (navigator.share) { await navigator.share({ title: 'SeaMinds Certificate', text, url: shareUrl }); return; }
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Certificate link copied');
    } catch { /* user cancelled */ }
  };

  const handlePdf = async () => {
    const el = document.getElementById('verify-card');
    if (!el) return;
    setBusy(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0D1B2A', useCORS: true });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(13, 27, 42); pdf.rect(0, 0, pw, ph, 'F');
      const margin = 12;
      let w = pw - margin * 2, h = (canvas.height / canvas.width) * w;
      if (h > ph - margin * 2) { h = ph - margin * 2; w = (canvas.width / canvas.height) * h; }
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, margin, w, h);
      pdf.save(`SeaMinds-Certificate-${result?.certificate_id || id}.pdf`);
    } catch (e) {
      console.error(e); toast.error('Could not create the PDF. Please try again.');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) { setResult({ valid: false, reason: 'not_found' }); setLoading(false); return; }
      const { data, error } = await supabase.rpc('verify_certificate' as never, { p_id: id } as never);
      if (!alive) return;
      if (error || !data) setResult({ valid: false, reason: 'not_found' });
      else setResult(data as unknown as VerifyResult);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  const valid = !!result?.valid;
  const expired = valid && !!result?.expired;

  const pageTitle = valid
    ? `✅ ${result?.candidate || 'Certificate'} — Verified by SeaMinds`
    : 'SeaMinds Certificate Verification';
  const pageDesc = valid
    ? `${result?.candidate || 'This seafarer'}${result?.rank ? ` (${result.rank})` : ''} holds a SeaMinds Competency Certificate${result?.score ? ` scored ${result.score}/5.00` : ''}.`
    : 'Verify the authenticity of a SeaMinds maritime competency certificate.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://seaminds.life/verify/${id || ''}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
      </Helmet>
      <div style={{ minHeight:'100vh', width:'100%', boxSizing:'border-box', background:'linear-gradient(135deg, #0D1B2A 0%, #1B2838 50%, #0D1B2A 100%)' }}>
        <div style={{ position:'sticky', top:0, zIndex:10, background:'#0D1B2A', borderBottom:'1px solid rgba(212,175,55,0.3)', paddingTop:'env(safe-area-inset-top)' }}>
          <div style={{ maxWidth:'480px', margin:'0 auto', display:'flex', alignItems:'center', gap:8, padding:'10px 12px' }}>
            <button onClick={goBack} aria-label="Back" style={{ display:'flex', alignItems:'center', gap:4, color:'#D4AF37', background:'transparent', border:'none', fontWeight:700, fontSize:15, cursor:'pointer', padding:4 }}>
              <ChevronLeft size={22} /> Back
            </button>
            <span style={{ color:'#94A3B8', fontSize:13, marginLeft:'auto' }}>Certificate</span>
          </div>
        </div>
        <div style={{ maxWidth:'480px', width:'100%', margin:'0 auto', padding:'20px 16px 40px', boxSizing:'border-box', textAlign:'center' }}>
          <img src={seamindsLogo} style={{ width:'60px', height:'60px', borderRadius:'12px', margin:'0 auto 16px', display:'block' }} alt="SeaMinds" />

          {loading && <p style={{ color:'#D4AF37', fontSize:'16px' }}>⏳ Verifying certificate…</p>}

          {!loading && !valid && (
            <div style={{ background:'#1a2e47', borderRadius:'12px', padding:'32px', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color:'#cbd5e1', fontSize:'16px' }}>No certificate found with this ID</div>
              <div style={{ color:'#64748b', fontSize:'12px', marginTop:'8px' }}>{id}</div>
            </div>
          )}

          {!loading && valid && (
            <>
            <div id="verify-card" style={{ background:'#1a2e47', borderRadius:'12px', padding:'28px 20px', boxSizing:'border-box', width:'100%', border:`1px solid ${expired ? 'rgba(245,158,11,0.5)' : 'rgba(212,175,55,0.4)'}` }}>
              <div style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'48px', marginBottom:'8px' }}>{expired ? '⚠️' : '✅'}</div>
                <div style={{ color:'#D4AF37', fontSize:'14px', fontWeight:'bold', letterSpacing:'2px' }}>VERIFIED BY SEAMINDS</div>
                {expired ? (
                  <div style={{ color:'#f59e0b', fontSize:'13px', marginTop:'4px' }}>Expired — this certificate is no longer valid</div>
                ) : (
                  <div style={{ color:'#4ade80', fontSize:'13px', marginTop:'4px' }}>This certificate is authentic</div>
                )}
              </div>

              <div style={{ borderTop:'1px solid rgba(212,175,55,0.2)', paddingTop:'20px' }}>
                <div style={{ color:'#ffffff', fontSize:'24px', fontWeight:'bold', marginBottom:'4px' }}>{result?.candidate || '—'}</div>
                <div style={{ color:'#D4AF37', fontSize:'16px', marginBottom:'16px' }}>{result?.rank || ''}</div>
                <div style={{ textAlign:'left', display:'inline-block' }}>
                  {result?.score != null && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>SeaMinds Score: {Number(result.score).toFixed(2)}/5.00</p>}
                  {result?.band && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Band: {result.band}</p>}
                  <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Assessed on: {fmt(result?.assessed_on)}</p>
                  <p style={{ color: expired ? '#f59e0b' : '#ccc', fontSize:'13px', marginBottom:'6px' }}>Valid until: {fmt(result?.expires_on)}</p>
                  {result?.certificate_id && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Certificate ID: {result.certificate_id}</p>}
                  {result?.scoring_version && <p style={{ color:'#94a3b8', fontSize:'12px' }}>Scoring version: {result.scoring_version}</p>}
                </div>
              </div>

              {result?.level_profile && TIERS.some(t => typeof result.level_profile?.[t.key] === 'number') && (
                <div style={{ borderTop:'1px solid rgba(212,175,55,0.2)', paddingTop:'20px', marginTop:'20px', textAlign:'left' }}>
                  <div style={{ color:'#D4AF37', fontSize:'11px', letterSpacing:'2px', marginBottom:'12px', textTransform:'uppercase' }}>Assessment calibration</div>
                  {TIERS.map(t => {
                    const raw = result.level_profile?.[t.key];
                    const known = typeof raw === 'number' && raw !== null;
                    const p = known ? Math.max(0, Math.min(100, Number(raw))) : 0;
                    return (
                      <div key={t.key} style={{ marginBottom:'12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                          <span style={{ color:'#94A3B8' }}>{t.label}</span>
                          <span style={{ color: known ? pctColor(p) : '#64748b', fontWeight:'bold' }}>{known ? `${Math.round(p)}%` : 'Not assessed'}</span>
                        </div>
                        <div style={{ height:'8px', background:'#0d1b2a', borderRadius:'4px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${p}%`, background: known ? pctColor(p) : 'transparent', borderRadius:'4px' }} />
                        </div>
                        <div style={{ color:'#64748b', fontSize:'11px', marginTop:'3px' }}>{t.hint}</div>
                      </div>
                    );
                  })}
                  {result.level_profile?.verdict && (
                    <div style={{ color:'#D4AF37', fontSize:'12px', marginTop:'8px' }}>
                      {VERDICTS[String(result.level_profile.verdict).toLowerCase()] || result.level_profile.verdict}
                    </div>
                  )}
                  {!!result.level_profile?.questions && (
                    <div style={{ color:'#64748b', fontSize:'11px', marginTop:'2px' }}>Based on {result.level_profile.questions} assessed answers</div>
                  )}
                </div>
              )}

              <div style={{ borderTop:'1px solid rgba(212,175,55,0.2)', paddingTop:'16px', marginTop:'20px' }}>
                <div style={{ color:'#888', fontSize:'11px' }}>Verified by SeaMinds · seaminds.life</div>
                <div style={{ color:'#666', fontSize:'10px', marginTop:'2px' }}>PT Indoglobal Service Solutions</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={handleShare} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'12px', borderRadius:12, background:'transparent', color:'#D4AF37', border:'1px solid #D4AF37', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                <Share2 size={16} /> Share
              </button>
              <button onClick={handlePdf} disabled={busy} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'12px', borderRadius:12, background:'#D4AF37', color:'#0D1B2A', border:'none', fontWeight:700, fontSize:14, cursor:'pointer', opacity: busy ? 0.6 : 1 }}>
                <Download size={16} /> {busy ? 'Preparing…' : 'Save PDF'}
              </button>
            </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Verify;
