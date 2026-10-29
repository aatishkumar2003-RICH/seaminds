import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;
const ADMIN_UID = '492ee966-e015-4440-a415-6ad6275a4a9b';
const ADMIN_URL = 'https://seaminds.life/admin';
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, n = 120) => (typeof v === 'string' ? v.slice(0, n) : '');
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

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

function renderEmail(o: { title: string; band: string; ink: string; time: string; rows: [string, string, string][]; stat?: [string, string]; button: [string, string] }) {
  const rows = o.rows.map(([i, l, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #1e3a5f;color:#D4AF37;font-size:13px;white-space:nowrap">${i} ${esc(l)}</td><td style="padding:8px;border-bottom:1px solid #1e3a5f;color:#fff;font-size:13px;word-break:break-all">${esc(v || '-')}</td></tr>`).join('');
  const stat = o.stat ? `<div style="text-align:center;padding:16px"><div style="font-size:28px;font-weight:bold;color:#D4AF37">${esc(o.stat[0])}</div><div style="color:#9CA3AF;font-size:12px">${esc(o.stat[1])}</div></div>` : '';
  return `<div style="font-family:system-ui;max-width:520px;margin:0 auto;background:#0D1B2A;color:#fff;border-radius:12px;overflow:hidden"><div style="background:${o.band};padding:20px;text-align:center"><h2 style="margin:0;color:${o.ink}">${esc(o.title)}</h2><p style="margin:4px 0 0;color:${o.ink};font-size:13px">${esc(o.time)} WIB</p></div><table style="width:100%;padding:16px;border-collapse:collapse">${rows}</table>${stat}<div style="text-align:center;padding:4px 16px 20px"><a href="${o.button[1]}" style="display:inline-block;background:#D4AF37;color:#0D1B2A;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">${esc(o.button[0])}</a></div><div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);color:#666;font-size:11px">SeaMinds — PT Indoglobal Service Solutions</div></div>`;
}

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const user = await getUser(req);
    if (!user) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      if (!(await allowAnonymous(ip))) return json({ success: false, error: 'Rate limit exceeded' }, 429);
    }

    const body = await req.json();
    const email = (user?.email || clip(body.email)).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return json({ success: false, error: 'Invalid email' }, 400);
    const first_name = clip(body.first_name, 60);
    const last_name = clip(body.last_name, 60);
    const nationality = clip(body.nationality, 60);
    const whatsapp_number = clip(body.whatsapp_number, 30);
    const role = clip(body.role, 60);
    const vessel_type = clip(body.vessel_type, 60);
    const ship_name = clip(body.ship_name, 60);
    const name = `${first_name} ${last_name}`.trim();

    const isLogin = /^Login via/i.test(role);
    const isLinkRequest = /^Email Magic Link/i.test(role);
    const provider = isLogin ? role.replace(/^Login via\s*/i, '') : (isLinkRequest ? 'magic link' : 'registration');

    const safe = async (run: () => unknown) => { try { await run(); } catch { /* ignore */ } };

    // ── Who is this? (server-side lookup, never trusted from the client) ──
    let kind: 'admin' | 'manager' | 'workspace' | 'crew_new' | 'crew_login' | 'link_request' = isLinkRequest ? 'link_request' : (isLogin ? 'crew_login' : 'crew_new');
    let mgr: any = null; let staff: any = null; let crew: any = null;
    if (user) {
      if (user.id === ADMIN_UID) kind = 'admin';
      else {
        const [m, s, c] = await Promise.all([
          supabase.from('manager_profiles').select('company_name,company_type,full_name,designation,phone,country,admin_approved,created_at').eq('user_id', user.id).maybeSingle(),
          supabase.from('fleet_staff_members').select('full_name,approved_role,requested_role,company,status').eq('user_id', user.id).maybeSingle(),
          supabase.from('crew_profiles').select('first_name,last_name,role,nationality,whatsapp_number,vessel_type').eq('id', user.id).maybeSingle(),
        ]);
        mgr = m.data; staff = s.data; crew = c.data;
        if (mgr) kind = 'manager';
        else if (staff) kind = 'workspace';
      }
    }

    // ── Alert rules: admin & manager = every sign-in (60s duplicate guard);
    //    crew/workspace = first notified sign-in only; registrations always alert ──
    let send = true;
    if (kind !== 'crew_new' && kind !== 'link_request') {
      const everyLogin = kind === 'admin' || kind === 'manager';
      let q = supabase.from('signup_log').select('id', { count: 'exact', head: true }).eq('email', email).eq('notified', true);
      if (everyLogin) q = q.gte('signed_up_at', new Date(Date.now() - 60_000).toISOString());
      const { count } = await q;
      if ((count || 0) > 0) send = false;
    } else if (kind === 'link_request') {
      const { count } = await supabase.from('signup_log').select('id', { count: 'exact', head: true })
        .eq('email', email).eq('notified', true).gte('signed_up_at', new Date(Date.now() - COOLDOWN_MS).toISOString());
      if ((count || 0) > 0) send = false;
    }

    // ── Location & device (from edge headers; IP lookup fallback) ──
    const h = req.headers;
    const ip = h.get('cf-connecting-ip') || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    let cc = (h.get('cf-ipcountry') || '').toUpperCase();
    let city = h.get('cf-ipcity') || '';
    let region = '';
    if (send && ip && (!cc || cc === 'XX')) {
      try {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 1500);
        const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctl.signal });
        clearTimeout(tm);
        const g = await r.json();
        if (g?.success) { cc = String(g.country_code || '').toUpperCase(); city = city || g.city || ''; region = g.region || ''; }
      } catch { /* lookup optional */ }
    }
    let countryName = cc;
    try { if (/^[A-Z]{2}$/.test(cc)) countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) || cc; } catch { /* ignore */ }
    const flag = /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';
    const location = cc ? `${flag} ${countryName}${city || region ? ` (${[city, region].filter(Boolean).join(', ')})` : ''}`.trim() : 'Unknown';
    const ua = h.get('user-agent') || '';
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser';
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Unknown device';
    const device = `${browser} on ${os}`;
    const geoRows: [string, string, string][] = [['📍', 'Login country', location], ['🌐', 'IP address', ip || 'Unknown'], ['💻', 'Device', device]];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const mismatch = (declared: string) => !!(declared && cc && countryName && norm(declared) !== norm(countryName) && norm(declared) !== norm(cc));

    await safe(() => supabase.from('signup_log').insert({ email, first_name, last_name, nationality, whatsapp_number, role, vessel_type, ship_name, notified: send }));

    if (kind === 'crew_new') {
      await safe(() => supabase.from('app_events').insert({
        event_type: 'crew_signup', message: `${name} joined SeaMinds`.trim(), severity: 'info', emailed: false,
        metadata: { name, rank: role, nationality, email },
      }));
    }
    await safe(() => supabase.rpc('upsert_email_lead', { p_email: email, p_first_name: first_name, p_last_name: last_name, p_nationality: nationality, p_whatsapp: whatsapp_number, p_role: role, p_vessel_type: vessel_type, p_source: 'registration' }));

    if (!send) return json({ success: true, skipped: 'cooldown' });

    const t = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
    let subject = ''; let html = '';

    if (kind === 'admin') {
      subject = `🛡️ Admin Sign-In: ${email} — from ${flag} ${countryName || 'Unknown'}`;
      html = renderEmail({ title: '🛡️ Admin Console Access', band: 'linear-gradient(135deg,#D4AF37,#9B1C1C)', ink: '#fff', time: t,
        rows: [['📧', 'Email', email], ['👤', 'Name', name || 'Atish Kumar'], ['🔑', 'Signed in with', provider], ...geoRows],
        button: ['Open Admin Dashboard →', ADMIN_URL] });
    } else if (kind === 'manager') {
      const status = mgr.admin_approved ? 'Approved' : 'Approval pending';
      const mName = mgr.full_name || name;
      const flagged = mismatch(mgr.country || '');
      const mgrGeo: [string, string, string][] = [...geoRows, ...(flagged ? [['⚠️', 'Security check', `Country mismatch — registered ${mgr.country}, signed in from ${countryName}`] as [string, string, string]] : [])];
      const geoTag = ` — from ${flag} ${countryName || 'Unknown'}${flagged ? ' ⚠️ MISMATCH' : ''}`;
      if (!mgr.admin_approved) {
        const days = Math.max(0, Math.floor((Date.now() - new Date(mgr.created_at).getTime()) / 86400000));
        subject = `⏳ Approval Pending: ${email} — ${mgr.company_name || 'Company'}${geoTag}`;
        html = renderEmail({ title: '⏳ Company Approval Required', band: 'linear-gradient(135deg,#f59e0b,#D4AF37)', ink: '#0D1B2A', time: t,
          rows: [['📧', 'Email', email], ['🏢', 'Company', mgr.company_name], ['🏷️', 'Type', mgr.company_type], ['👤', 'Manager', [mName, mgr.designation].filter(Boolean).join(', ')], ['📱', 'Phone / WhatsApp', mgr.phone], ['🌍', 'Country', mgr.country], ['🕒', 'Waiting', `${days} day(s)`], ['🔑', 'Signed in with', provider], ...mgrGeo],
          button: ['Review & Approve →', `${ADMIN_URL}?tab=company_approval`] });
      } else {
        subject = `👔 Ship Manager Sign-In: ${email} — ${mgr.company_name || 'Company'} (${status})${geoTag}`;
        html = renderEmail({ title: '👔 Ship Manager Signed In', band: 'linear-gradient(135deg,#D4AF37,#B8860B)', ink: '#0D1B2A', time: t,
          rows: [['📧', 'Email', email], ['👤', 'Manager', mName], ['🏢', 'Company', mgr.company_name], ['🏷️', 'Type', mgr.company_type], ['✅', 'Status', status], ['📱', 'Phone / WhatsApp', mgr.phone], ['🌍', 'Registered country', mgr.country], ['🔑', 'Signed in with', provider], ...mgrGeo],
          button: ['View Companies →', `${ADMIN_URL}?tab=company_approval`] });
      }
    } else if (kind === 'workspace') {
      const r = staff.approved_role || staff.requested_role || 'Staff';
      subject = `🚢 Fleet Workspace Sign-In: ${email} — ${r}${staff.company ? ` (${staff.company})` : ''}`;
      html = renderEmail({ title: '🚢 Fleet Workspace Access', band: 'linear-gradient(135deg,#06b6d4,#0D1B2A)', ink: '#fff', time: t,
        rows: [['📧', 'Email', email], ['👤', 'Name', staff.full_name || name], ['🧭', 'Role', r], ['🏢', 'Company', staff.company], ['✅', 'Status', staff.status], ['🔑', 'Signed in with', provider], ...geoRows],
        button: ['Open Admin Dashboard →', ADMIN_URL] });
    } else if (kind === 'link_request') {
      subject = `✉️ Sign-In Link Requested: ${email}`;
      html = renderEmail({ title: '✉️ Email Sign-In Link Requested', band: 'linear-gradient(135deg,#334155,#0D1B2A)', ink: '#fff', time: t,
        rows: [['📧', 'Email', email]], button: ['Open Admin Dashboard →', ADMIN_URL] });
    } else {
      const cn = crew ? `${crew.first_name || ''} ${crew.last_name || ''}`.trim() : '';
      const rank = (kind === 'crew_new' ? role : crew?.role) || '';
      const nat = nationality || crew?.nationality || '';
      const { count } = await supabase.from('crew_profiles').select('*', { count: 'exact', head: true });
      const rows: [string, string, string][] = [['📧', 'Email', email], ['👤', 'Name', name || cn], ['⚓', 'Rank', rank], ['🌍', 'Nationality', nat], ['📱', 'WhatsApp', whatsapp_number || crew?.whatsapp_number || ''], ['🚢', 'Vessel', vessel_type || crew?.vessel_type || ''], ...geoRows];
      if (mismatch(nat)) rows.push(['ℹ️', 'Note', `Declared ${nat}, signed in from ${countryName}`]);
      if (kind === 'crew_new') {
        rows.push(['🛳️', 'Ship', ship_name]);
        subject = `🆕 New Crew: ${email} — ${[rank, name].filter(Boolean).join(' ')}${nat ? ` (${nat})` : ''} — ${count ?? '?'} total`;
        html = renderEmail({ title: '⚓ New Crew Member Registered', band: 'linear-gradient(135deg,#D4AF37,#B8860B)', ink: '#0D1B2A', time: t, rows, stat: [String(count ?? '?'), 'total crew on SeaMinds'], button: ['View in Admin Dashboard →', `${ADMIN_URL}?tab=crew&q=${encodeURIComponent(email)}`] });
      } else {
        rows.push(['🔑', 'Signed in with', provider]);
        subject = `⚓ First Crew Sign-In: ${email}${rank ? ` — ${rank}` : ''}${nat ? ` (${nat})` : ''}`;
        html = renderEmail({ title: '⚓ Seafarer — First Sign-In', band: 'linear-gradient(135deg,#1e3a5f,#0D1B2A)', ink: '#D4AF37', time: t, rows, button: ['View in Admin Dashboard →', `${ADMIN_URL}?tab=crew&q=${encodeURIComponent(email)}`] });
      }
    }

    let lastError: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({ from: 'SeaMinds <crew@seaminds.life>', to: ['aatishkumar2003@gmail.com'], subject, html }),
        });
        if (res.ok) { lastError = null; break; }
        lastError = `HTTP ${res.status}: ${await res.text()}`;
      } catch (e) { lastError = String(e); }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
    return json({ success: !lastError, kind, ...(lastError ? { error: lastError } : {}) }, lastError ? 502 : 200);
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
