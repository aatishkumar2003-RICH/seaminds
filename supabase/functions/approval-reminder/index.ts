import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Daily reminder to the owner listing companies still waiting for approval.
// Sends nothing when the queue is empty. Cron-only (worker secret).
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret' };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: secretRow } = await supabase.from('admin_settings').select('value').eq('key', 'scoring_worker_secret').maybeSingle();
    const expected = (secretRow?.value ?? '').toString();
    const provided = req.headers.get('x-worker-secret') || '';
    if (!expected || provided !== expected) return json({ error: 'worker_auth_required' }, 401);

    const { data: pending } = await supabase.from('manager_profiles')
      .select('user_id,company_name,company_type,full_name,phone,country,created_at')
      .eq('admin_approved', false).order('created_at', { ascending: true });
    if (!pending || pending.length === 0) return json({ sent: false, pending: 0 });

    const emails: Record<string, string> = {};
    await Promise.all(pending.map(async (p) => {
      try { const { data } = await supabase.auth.admin.getUserById(p.user_id); emails[p.user_id] = data?.user?.email || ''; } catch { /* ignore */ }
    }));

    const link = 'https://seaminds.life/admin?tab=company_approval';
    const rows = pending.map((p) => {
      const days = Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000));
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;font-size:12.5px;color:#D4AF37;font-weight:700">${esc(p.company_name || '-')}<div style="color:#94A3B8;font-weight:400">${esc([p.company_type, p.country].filter(Boolean).join(' · '))}</div></td>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;font-size:12.5px;color:#fff;word-break:break-all">${esc(emails[p.user_id] || '-')}<div style="color:#94A3B8">${esc(p.full_name || '')}${p.phone ? ' · ' + esc(p.phone) : ''}</div></td>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;font-size:12.5px;color:#f59e0b;text-align:right;white-space:nowrap">${days} d</td></tr>`;
    }).join('');
    const t = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
    const html = `<div style="font-family:system-ui;max-width:600px;margin:0 auto;background:#0D1B2A;color:#fff;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#f59e0b,#D4AF37);padding:20px;text-align:center"><h2 style="margin:0;color:#0D1B2A">⏳ ${pending.length} Company Approval${pending.length > 1 ? 's' : ''} Pending</h2><p style="margin:4px 0 0;color:#0D1B2A;font-size:13px">Daily reminder · ${esc(t)} WIB</p></div>
      <table style="width:100%;padding:12px;border-collapse:collapse"><tr><th style="text-align:left;color:#94A3B8;font-size:11px;padding:6px 8px">Company</th><th style="text-align:left;color:#94A3B8;font-size:11px;padding:6px 8px">Email / Contact</th><th style="text-align:right;color:#94A3B8;font-size:11px;padding:6px 8px">Waiting</th></tr>${rows}</table>
      <div style="text-align:center;padding:8px 16px 22px"><a href="${link}" style="display:inline-block;background:#D4AF37;color:#0D1B2A;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">Review & Approve in Admin →</a></div>
      <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);color:#666;font-size:11px">Sent only on days when approvals are waiting.</div></div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}` },
      body: JSON.stringify({ from: 'SeaMinds <crew@seaminds.life>', to: ['aatishkumar2003@gmail.com'], subject: `⏳ Daily Reminder: ${pending.length} Company Approval${pending.length > 1 ? 's' : ''} Pending — SeaMinds Admin`, html }),
    });
    if (!res.ok) { const d = await res.text(); console.error('resend', res.status, d); return json({ sent: false, status: res.status, details: d }, 502); }
    return json({ sent: true, pending: pending.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
