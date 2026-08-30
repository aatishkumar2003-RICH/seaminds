import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, n = 120) => (typeof v === 'string' ? v.slice(0, n) : '');

async function getUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user ?? null;
}

// Fallback protection for unauthenticated (pre-login magic-link) calls
async function allowAnonymous(ip: string) {
  const key = `notify-signup:${ip}`;
  const now = new Date();
  const { data } = await supabase.from('auth_rate_limits').select('*').eq('ip_address', key).maybeSingle();
  if (!data) {
    await supabase.from('auth_rate_limits').insert({ ip_address: key, attempt_count: 1, window_start: now.toISOString(), last_attempt: now.toISOString() });
    return true;
  }
  const windowStart = new Date(data.window_start).getTime();
  if (windowStart < Date.now() - 60 * 60 * 1000) {
    await supabase.from('auth_rate_limits').update({ attempt_count: 1, window_start: now.toISOString(), last_attempt: now.toISOString() }).eq('ip_address', key);
    return true;
  }
  if (data.attempt_count >= 3) return false;
  await supabase.from('auth_rate_limits').update({ attempt_count: data.attempt_count + 1, last_attempt: now.toISOString() }).eq('ip_address', key);
  return true;
}

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      if (!(await allowAnonymous(ip))) {
        return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded' }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await req.json();
    const email = user?.email || clip(body.email);
    if (!EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    const first_name = clip(body.first_name, 60);
    const last_name = clip(body.last_name, 60);
    const nationality = clip(body.nationality, 60);
    const whatsapp_number = clip(body.whatsapp_number, 30);
    const role = clip(body.role, 60);
    const vessel_type = clip(body.vessel_type, 60);
    const ship_name = clip(body.ship_name, 60);

    // Query builders are thenable but not Promises — wrap so failures never throw
    const safe = async (run: () => unknown) => { try { await run(); } catch { /* ignore */ } };

    // Save to signup log
    await safe(() => supabase.from('signup_log').insert({ email, first_name, last_name, nationality, whatsapp_number, role, vessel_type, ship_name, notified: true }));

    // Log the signup as an app event so the monitor digest can report it
    await safe(() => supabase.from('app_events').insert({
      event_type: 'crew_signup',
      message: `${first_name || ''} ${last_name || ''} joined SeaMinds`.trim(),
      severity: 'info',
      emailed: false,
      metadata: {
        name: `${first_name || ''} ${last_name || ''}`.trim(),
        rank: role || '',
        nationality: nationality || '',
        email: email || '',
      },
    }));

    // Upsert to email leads
    await safe(() => supabase.rpc('upsert_email_lead', { p_email: email, p_first_name: first_name, p_last_name: last_name, p_nationality: nationality, p_whatsapp: whatsapp_number, p_role: role, p_vessel_type: vessel_type, p_source: 'registration' }));


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
