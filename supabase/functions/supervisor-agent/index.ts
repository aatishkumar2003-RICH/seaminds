import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// One compiled daily report at 9:00 PM Jakarta covering the whole Jakarta day.
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;
const ADMIN_TO = 'admin@seaminds.life';
const ADMIN_UID = '492ee966-e015-4440-a415-6ad6275a4a9b';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-secret',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const AGENT_SECRET = Deno.env.get('AGENT_SECRET');
  const provided = req.headers.get('x-agent-secret') || new URL(req.url).searchParams.get('secret');
  const auth = req.headers.get('authorization') || '';
  const isService = auth.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '__none__');
  let isScheduler = false;
  if (!isService && auth.startsWith('Bearer ')) {
    // Managed schedule callbacks authenticate with a signed project token.
    try { const p = JSON.parse(atob(auth.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); isScheduler = p.role === 'service_role'; } catch { /* no */ }
  }
  if (!(AGENT_SECRET && provided === AGENT_SECRET) && !isService && !isScheduler) return json({ error: 'Forbidden' }, 403);

  try {
    // Jakarta day window (UTC+7): from 00:00 WIB until now
    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 3600_000);
    const start = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000);
    const since = start.toISOString();
    const dayDate = wib.toISOString().slice(0, 10);

    // Duplicate guard: only one report per Jakarta day
    const { count: already } = await supabase.from('app_events').select('id', { count: 'exact', head: true })
      .eq('event_type', 'supervisor_daily_report').gte('created_at', since);
    if ((already || 0) > 0 && new URL(req.url).searchParams.get('force') !== '1') return json({ skipped: 'already_sent_today' });

    const cnt = async (q: any) => { const { count, error } = await q; return error ? 0 : (count || 0); };
    const h = { count: 'exact' as const, head: true };

    const [shipOk, shipErr, mgrOk, mgrErr, crewBrief, crewBriefErr, crewNew, apps, appEmails, newPosts, extNew, blogs, errors, warnings, crewTotal, shipsActive, digestCrew] = await Promise.all([
      cnt(supabase.from('vessel_outreach_contacts').select('id', h).gte('last_sent_at', since).is('last_error', null)),
      cnt(supabase.from('vessel_outreach_contacts').select('id', h).gte('updated_at', since).not('last_error', 'is', null)),
      cnt(supabase.from('recruiter_outreach_log').select('id', h).gte('sent_at', since).eq('ok', true)),
      cnt(supabase.from('recruiter_outreach_log').select('id', h).gte('sent_at', since).eq('ok', false)),
      cnt(supabase.from('briefing_log').select('id', h).gte('sent_at', since).eq('ok', true)),
      cnt(supabase.from('briefing_log').select('id', h).gte('sent_at', since).eq('ok', false)),
      cnt(supabase.from('crew_profiles').select('id', h).gte('created_at', since)),
      cnt(supabase.from('job_applications').select('id', h).gte('created_at', since)),
      cnt(supabase.from('app_events').select('id', h).eq('event_type', 'application_email').gte('created_at', since)),
      cnt(supabase.from('job_postings').select('id', h).gte('created_at', since)),
      cnt(supabase.from('external_vacancies').select('id', h).gte('created_at', since)),
      supabase.from('blog_posts').select('title').gte('created_at', since).limit(5),
      supabase.from('app_events').select('message,created_at').eq('severity', 'error').gte('created_at', since).order('created_at', { ascending: false }).limit(8),
      cnt(supabase.from('app_events').select('id', h).eq('severity', 'warning').gte('created_at', since)),
      cnt(supabase.from('crew_profiles').select('id', h)),
      cnt(supabase.from('vessel_outreach_contacts').select('id', h).eq('stage', 'active')),
      supabase.from('crew_digest_log').select('crew_id').eq('sent_on', dayDate).limit(5000),
    ]);
    const crewDigest = new Set(((digestCrew as any).data || []).map((r: any) => r.crew_id)).size;
    const { data: mgrEng } = await supabase.from('manager_engagement_log').select('kind').eq('sent_on', dayDate).limit(5000);
    const managerEngage = (mgrEng || []).length;

    // Logins today (classified server-side)
    const signedIn: { id: string; email: string; created: string }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) if (u.last_sign_in_at && u.last_sign_in_at >= since) signedIn.push({ id: u.id, email: u.email || '', created: u.created_at });
      if (data.users.length < 1000) break;
    }
    const ids = signedIn.map((u) => u.id);
    const [{ data: mgrs }, { data: vendors }] = await Promise.all([
      ids.length ? supabase.from('manager_profiles').select('user_id,company_name').in('user_id', ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from('marketplace_vendors').select('user_id,company_name').in('user_id', ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const mgrMap = new Map((mgrs || []).map((m: any) => [m.user_id, m.company_name]));
    const venMap = new Map((vendors || []).map((m: any) => [m.user_id, m.company_name]));
    const mgrLogins = signedIn.filter((u) => mgrMap.has(u.id));
    const venLogins = signedIn.filter((u) => venMap.has(u.id) && !mgrMap.has(u.id));
    const adminLogins = signedIn.filter((u) => u.id === ADMIN_UID).length;
    const crewLogins = signedIn.filter((u) => u.id !== ADMIN_UID && !mgrMap.has(u.id) && !venMap.has(u.id));
    const crewFirst = crewLogins.filter((u) => u.created >= since).length;

    const totalSent = shipOk + mgrOk + crewBrief;
    const totalFailed = shipErr + mgrErr + crewBriefErr;
    const errList = (errors as any).data || [];
    const allClear = totalFailed === 0 && errList.length === 0;

    const row = (label: string, val: unknown, color = '#fff') => `<tr><td style="padding:7px 10px;color:#94A3B8;font-size:13px;border-bottom:1px solid #1e3352;">${esc(label)}</td><td style="padding:7px 10px;text-align:right;font-weight:bold;color:${color};font-size:14px;border-bottom:1px solid #1e3352;">${esc(val)}</td></tr>`;
    const section = (title: string, rows: string) => `<h2 style="color:#D4AF37;font-size:15px;margin:22px 0 6px;">${title}</h2><table style="width:100%;border-collapse:collapse;background:#112240;border-radius:8px;">${rows}</table>`;
    const names = (list: { id: string; email: string }[], map: Map<string, string>) => list.slice(0, 10).map((u) => `${esc(u.email)}${map.get(u.id) ? ` (${esc(map.get(u.id))})` : ''}`).join('<br>');
    const jakartaTime = now.toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

    const html = `<html><body style="font-family:Arial,sans-serif;background:#0D1B2A;color:#fff;padding:20px;">
<div style="max-width:600px;margin:0 auto;">
<h1 style="color:#D4AF37;font-size:21px;margin:0;">⚓ SeaMinds Daily Report</h1>
<p style="color:#94A3B8;font-size:12px;margin:4px 0 0;">Whole day ${esc(dayDate)} (00:00 → ${esc(jakartaTime)} WIB)</p>
<div style="margin:16px 0;padding:12px;border-radius:8px;background:${allClear ? '#143d2a' : '#4a1d1d'};border:1px solid ${allClear ? '#22c55e' : '#ef4444'};font-size:14px;">
${allClear ? '✅ No errors today — all email jobs ran cleanly.' : `⚠️ ${totalFailed} failed email(s) and ${errList.length} system error(s) today.`}</div>
${section('📧 Emails sent today', [
  row('🚢 Ships — Daily Bulletin', shipOk, '#22c55e'),
  row('👔 Ship managers / recruiters — Outreach', mgrOk, '#22c55e'),
  row('👔 Ship managers — Engagement reminders', managerEngage),
  row('👥 Crew — Weekly briefing', crewBrief, '#22c55e'),
  row('👥 Crew — Daily job feed (crew reached)', crewDigest),
  row('📨 Applications sent to recruiters', appEmails),
  row('❌ Failed sends', totalFailed, totalFailed ? '#ef4444' : '#22c55e'),
  row('Total sent', totalSent, '#D4AF37'),
].join(''))}
${section('🔐 Sign-ins today', [
  row('🛡️ Admin', adminLogins),
  row('👔 Ship managers', mgrLogins.length),
  row('🏪 Marketplace sellers', venLogins.length),
  row('⚓ Crew (all)', crewLogins.length),
  row('🆕 Crew — first-time', crewFirst),
].join(''))}
${mgrLogins.length ? `<p style="font-size:12px;color:#94A3B8;margin:6px 0;">Managers: ${names(mgrLogins, mgrMap)}</p>` : ''}
${venLogins.length ? `<p style="font-size:12px;color:#94A3B8;margin:6px 0;">Marketplace: ${names(venLogins, venMap)}</p>` : ''}
${section('📈 Activity today', [
  row('New crew registrations', crewNew),
  row('Job applications', apps),
  row('New vacancies posted', newPosts),
  row('AI-collected vacancies', extNew),
  row('Blog articles published', ((blogs as any).data || []).length),
  row('Warnings logged', warnings),
  row('Total crew on SeaMinds', crewTotal, '#D4AF37'),
  row('Active ship mailboxes', shipsActive, '#D4AF37'),
].join(''))}
${errList.length ? `<h2 style="color:#ef4444;font-size:15px;margin:22px 0 6px;">🔴 Errors</h2>${errList.map((e: any) => `<div style="background:#112240;padding:8px 10px;border-left:3px solid #ef4444;margin-bottom:6px;font-size:12px;color:#ccc;">${esc(e.message)}</div>`).join('')}` : ''}
<p style="text-align:center;margin-top:26px;"><a href="https://seaminds.life/admin" style="color:#D4AF37;font-size:12px;">Open Admin Dashboard →</a></p>
<p style="text-align:center;color:#64748b;font-size:11px;">SeaMinds Supervisor · one report daily at 9:00 PM Jakarta</p>
</div></body></html>`;

    let sendError: string | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({ from: 'SeaMinds Supervisor <crew@seaminds.life>', to: [ADMIN_TO], subject: `⚓ Daily Report ${dayDate} — ${totalSent} emails · ${crewLogins.length} crew · ${mgrLogins.length} managers${allClear ? ' · ✅ no errors' : ' · ⚠️ check errors'}`, html }),
        });
        if (r.ok) { sendError = null; break; }
        sendError = `HTTP ${r.status}: ${await r.text()}`;
      } catch (e) { sendError = String(e); }
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }

    const stats = { totalSent, totalFailed, shipOk, mgrOk, crewBrief, crewLogins: crewLogins.length, crewFirst, mgrLogins: mgrLogins.length, venLogins: venLogins.length, adminLogins };
    const isForce = new URL(req.url).searchParams.get('force') === '1';
    if (!sendError && !isForce) await supabase.from('app_events').insert({ event_type: 'supervisor_daily_report', message: `Daily report sent: ${totalSent} emails`, severity: 'info', metadata: stats });
    return json({ success: !sendError, stats, ...(sendError ? { error: sendError } : {}) }, sendError ? 502 : 200);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500);
  }
});
