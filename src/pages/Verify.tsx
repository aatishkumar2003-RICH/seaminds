import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
};

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

const Verify = () => {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #0D1B2A 0%, #1B2838 50%, #0D1B2A 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
        <div style={{ maxWidth:'480px', width:'100%', textAlign:'center' }}>
          <img src={seamindsLogo} style={{ width:'60px', height:'60px', borderRadius:'12px', margin:'0 auto 16px', display:'block' }} alt="SeaMinds" />

          {loading && <p style={{ color:'#D4AF37', fontSize:'16px' }}>⏳ Verifying certificate…</p>}

          {!loading && !valid && (
            <div style={{ background:'#1a2e47', borderRadius:'12px', padding:'32px', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color:'#cbd5e1', fontSize:'16px' }}>No certificate found with this ID</div>
              <div style={{ color:'#64748b', fontSize:'12px', marginTop:'8px' }}>{id}</div>
            </div>
          )}

          {!loading && valid && (
            <div style={{ background:'#1a2e47', borderRadius:'12px', padding:'32px', border:`1px solid ${expired ? 'rgba(245,158,11,0.5)' : 'rgba(212,175,55,0.4)'}` }}>
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
                  {result?.score != null && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>SMC Score: {Number(result.score).toFixed(2)}/5.00</p>}
                  {result?.band && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Band: {result.band}</p>}
                  <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Assessed on: {fmt(result?.assessed_on)}</p>
                  <p style={{ color: expired ? '#f59e0b' : '#ccc', fontSize:'13px', marginBottom:'6px' }}>Valid until: {fmt(result?.expires_on)}</p>
                  {result?.certificate_id && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Certificate ID: {result.certificate_id}</p>}
                  {result?.scoring_version && <p style={{ color:'#94a3b8', fontSize:'12px' }}>Scoring version: {result.scoring_version}</p>}
                </div>
              </div>

              <div style={{ borderTop:'1px solid rgba(212,175,55,0.2)', paddingTop:'16px', marginTop:'20px' }}>
                <div style={{ color:'#888', fontSize:'11px' }}>Verified by SeaMinds · seaminds.life</div>
                <div style={{ color:'#666', fontSize:'10px', marginTop:'2px' }}>PT Indoglobal Service Solutions</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Verify;
