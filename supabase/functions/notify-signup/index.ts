import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { email, first_name, last_name, nationality, whatsapp_number, role, vessel_type, ship_name } = await req.json();

    // Save to signup log
    await supabase.from('signup_log').insert({ email, first_name, last_name, nationality, whatsapp_number, role, vessel_type, ship_name, notified: true }).catch(() => {});

    // Upsert to email leads
    await supabase.rpc('upsert_email_lead', { p_email: email, p_first_name: first_name, p_last_name: last_name, p_nationality: nationality, p_whatsapp: whatsapp_number, p_role: role, p_vessel_type: vessel_type, p_source: 'registration' }).catch(() => {});

    // Get total crew count
    const { count } = await supabase.from('crew_profiles').select('*', { count: 'exact', head: true });
    const t = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

    // Send email notification with retry
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({
            from: 'SeaMinds <crew@seaminds.life>',
            to: ['aatishkumar2003@gmail.com'],
            subject: `🆕 ${first_name || ''} ${last_name || ''} joined SeaMinds — ${count} total crew`,
            html: `<div style="font-family:system-ui;max-width:500px;margin:0 auto;background:#0D1B2A;color:white;border-radius:12px;overflow:hidden"><div style="background:linear-gradient(135deg,#D4AF37,#B8860B);padding:20px;text-align:center"><h2 style="margin:0;color:#0D1B2A">⚓ New Crew Member!</h2><p style="margin:4px 0 0;color:#0D1B2A;font-size:13px">${t} WIB</p></div><table style="width:100%;padding:16px;border-collapse:collapse">${[['📧','Email',email||'-'],['👤','Name',`${first_name||''} ${last_name||''}`],['📱','WhatsApp',whatsapp_number||'-'],['🌍','Nationality',nationality||'-'],['⚓','Role',role||'-'],['🚢','Vessel',vessel_type||'-'],['🛳️','Ship',ship_name||'-']].map(([icon,label,val])=>`<tr><td style="padding:8px;border-bottom:1px solid #1e3a5f;color:#D4AF37;font-size:13px">${icon} ${label}</td><td style="padding:8px;border-bottom:1px solid #1e3a5f;color:white;font-size:13px">${val}</td></tr>`).join('')}</table><div style="text-align:center;padding:16px"><div style="font-size:28px;font-weight:bold;color:#D4AF37">${count || '?'}</div><div style="color:#9CA3AF;font-size:12px">total crew on SeaMinds</div></div><div style="text-align:center;padding:0 16px 20px"><a href="https://seaminds.lovable.app/admin" style="display:inline-block;background:#D4AF37;color:#0D1B2A;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">View in Admin Dashboard →</a></div><div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);color:#555;font-size:11px">SeaMinds — PT Indoglobal Service Solutions</div></div>`,
          }),
        });
        if (res.ok) { lastError = null; break; }
        lastError = `HTTP ${res.status}: ${await res.text()}`;
      } catch (e) {
        lastError = String(e);
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }

    return new Response(JSON.stringify({ success: !lastError, ...(lastError ? { error: lastError } : {}) }), {
      status: lastError ? 502 : 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: cors });
  }
});
