import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import seamindsLogo from "@/assets/seaminds-logo.png";

const Verify = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const verify = async () => {
      if (!id) { setError('Invalid verification link.'); setLoading(false); return; }
      try {
        let result: any = null;
        const { data: assessment } = await supabase
          .from('smc_assessments')
          .select('overall_score, started_at, crew_profile_id, status')
          .eq('id', id)
          .eq('status', 'completed')
          .single();

        if (assessment) {
          const { data: profile } = await supabase
            .from('crew_profiles')
            .select('first_name, last_name, rank, nationality, crew_unique_id')
            .eq('id', assessment.crew_profile_id)
            .single();
          result = { ...(assessment as any), ...(profile as any || {}) };
        } else {
          const { data: profile } = await supabase
            .from('crew_profiles')
            .select('first_name, last_name, rank, nationality, crew_unique_id')
            .eq('crew_unique_id', id)
            .single();
          if (profile) result = profile as any;
        }

        if (result) { setData(result); }
        else { setError('Certificate not found or not yet verified.'); }
      } catch (e) {
        setError('Could not verify this certificate.');
      }
      setLoading(false);
    };
    verify();
  }, [id]);

  const pageTitle = data
    ? `✅ ${data.first_name} ${data.last_name} — Verified by SeaMinds`
    : 'SeaMinds Certificate Verification';
  const pageDesc = data
    ? `${data.first_name} ${data.last_name}${data.rank ? ` (${data.rank})` : ''} has a verified SeaMinds Competency Certificate${data.overall_score ? ` with a score of ${data.overall_score}/5.00` : ''}.`
    : 'Verify the authenticity of a SeaMinds maritime competency certificate.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:image" content="https://seaminds.lovable.app/og-verify.png" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://seaminds.lovable.app/verify/${id || ''}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content="https://seaminds.lovable.app/og-verify.png" />
      </Helmet>
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #0D1B2A 0%, #1B2838 50%, #0D1B2A 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ maxWidth:'480px', width:'100%', textAlign:'center' }}>
        <img src="/seaminds-logo.png" style={{ width:'60px', height:'60px', borderRadius:'12px', margin:'0 auto 16px', display:'block' }} alt="SeaMinds" />
        {loading && <p style={{ color:'#D4AF37', fontSize:'16px' }}>⏳ Verifying certificate...</p>}
        {error && (
          <div style={{ background:'#1a2e47', borderRadius:'12px', padding:'32px', border:'1px solid #c0392b' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>❌</div>
            <div style={{ color:'#e74c3c', fontSize:'20px', fontWeight:'bold', marginBottom:'8px' }}>Verification Failed</div>
            <div style={{ color:'#aaa', fontSize:'14px' }}>{error}</div>
          </div>
        )}
        {data && !error && (
          <div style={{ background:'#1a2e47', borderRadius:'12px', padding:'32px', border:'1px solid rgba(212,175,55,0.4)' }}>
            <div style={{ marginBottom:'24px' }}>
              <div style={{ fontSize:'48px', marginBottom:'8px' }}>✅</div>
              <div style={{ color:'#D4AF37', fontSize:'14px', fontWeight:'bold', letterSpacing:'2px' }}>VERIFIED BY SEAMINDS</div>
              <div style={{ color:'#4ade80', fontSize:'13px', marginTop:'4px' }}>This certificate is authentic</div>
            </div>
            <div style={{ borderTop:'1px solid rgba(212,175,55,0.2)', paddingTop:'20px' }}>
              <div style={{ color:'#ffffff', fontSize:'24px', fontWeight:'bold', marginBottom:'4px' }}>
                {data.first_name} {data.last_name}
              </div>
              <div style={{ color:'#D4AF37', fontSize:'16px', marginBottom:'16px' }}>{data.rank || ''}</div>
              <div style={{ textAlign:'left', display:'inline-block' }}>
                {data.nationality && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Nationality: {data.nationality}</p>}
                {data.crew_unique_id && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Crew ID: {data.crew_unique_id}</p>}
                {data.overall_score && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>SMC Score: {data.overall_score}/5.00</p>}
                {data.started_at && <p style={{ color:'#ccc', fontSize:'13px', marginBottom:'6px' }}>Certified: {new Date(data.started_at).toLocaleDateString('en-GB')}</p>}
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
