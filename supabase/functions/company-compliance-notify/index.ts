import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// One admin/manager action = one email to the affected person.
// Events: docs_requested, docs_submitted, company_approved, whatsapp_verified.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const OWNER = 'aatishkumar2003@gmail.com';
const UUID = /^[0-9a-f-]{36}$/i;

const shell = (title: string, body: string, cta?: { href: string; label: string }) => `
<div style="font-family:system-ui;max-width:600px;margin:0 auto;background:#0D1B2A;color:#fff;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#D4AF37,#C5941F);padding:20px;text-align:center"><h2 style="margin:0;color:#0D1B2A">${title}</h2></div>
  <div style="padding:20px;font-size:14px;line-height:1.6;color:#e2e8f0">${body}</div>
  ${cta ? `<div style="text-align:center;padding:0 16px 24px"><a href="${cta.href}" style="display:inline-block;background:#D4AF37;color:#0D1B2A;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">${cta.label}</a></div>` : ''}
  <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);color:#94A3B8;font-size:11px">SeaMinds · Support: support@seaminds.life</div>
</div>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await sb.auth.getUser(token);
    const caller = u?.user;
    if (!caller) return json({ error: 'unauthorized' }, 401);
    const { data: isAdmin } = await sb.rpc('is_admin', { _user_id: caller.id });

    const body = await req.json().catch(() => ({}));
    const event = String(body?.event || '');
    const target = String(body?.manager_user_id || body?.verification_id || '');

    let to = '', subject = '', html = '';
    const managerInfo = async (uid: string) => {
      const { data: mp } = await sb.from('manager_profiles').select('company_name,full_name').eq('user_id', uid).maybeSingle();
      const { data: au } = await sb.auth.admin.getUserById(uid);
      return { mp, email: au?.user?.email || '' };
    };

    if (event === 'docs_requested' || event === 'company_approved') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403);
      if (!UUID.test(target)) return json({ error: 'bad_target' }, 400);
      const { mp, email } = await managerInfo(target);
      if (!email) return json({ error: 'no_email' }, 404);
      to = email;
      const name = esc(mp?.full_name || 'there'); const co = esc(mp?.company_name || 'your company');
      if (event === 'docs_requested') {
        const { data: cc } = await sb.from('company_compliance').select('requested_items,admin_note').eq('manager_user_id', target).maybeSingle();
        const items = (cc?.requested_items || []).map((i: string) => `<li>${esc(i)}</li>`).join('');
        subject = `Action required: SeaMinds company verification for ${mp?.company_name || 'your company'}`;
        html = shell('🛡️ Company Verification', `<p>Dear ${name},</p><p>Thank you for registering <b>${co}</b> on SeaMinds. To protect our seafarers and activate your verified employer status, please provide the following in your Manager Portal:</p><ul>${items}</ul>${cc?.admin_note ? `<p style="color:#D4AF37">Note: ${esc(cc.admin_note)}</p>` : ''}<p style="color:#94A3B8;font-size:12px">Please do not reply with attachments — upload them securely in your portal so our team can review them in one place.</p>`, { href: 'https://seaminds.life/manager/dashboard#compliance', label: 'Upload in Manager Portal →' });
      } else {
        subject = `🎉 Account approved: welcome to SeaMinds, ${mp?.company_name || ''}`.trim();
        html = shell('🎉 Your company is approved', `<p>Dear ${name},</p><p><b>${co}</b> has been reviewed and approved by SeaMinds.</p><p>Your account is now fully active: publish vacancies, review applicants and run interviews from your dashboard.</p>`, { href: 'https://seaminds.life/manager/dashboard', label: 'Open Manager Dashboard →' });
      }
    } else if (event === 'docs_submitted') {
      const { mp, email } = await managerInfo(caller.id);
      if (!mp) return json({ error: 'not_manager' }, 403);
      const { data: cc } = await sb.from('company_compliance').select('license_number,website,document_paths,manager_note').eq('manager_user_id', caller.id).maybeSingle();
      to = OWNER;
      subject = `📄 Compliance submitted: ${mp.company_name || email}`;
      html = shell('📄 Company documents submitted', `<p><b>${esc(mp.company_name)}</b> · ${esc(mp.full_name || '')}<br/>Login: ${esc(email)}</p><p>Licence / registration: <b>${esc(cc?.license_number || '—')}</b><br/>Website: ${esc(cc?.website || '—')}<br/>Files uploaded: ${(cc?.document_paths || []).length}</p>${cc?.manager_note ? `<p>Note: ${esc(cc.manager_note)}</p>` : ''}`, { href: 'https://seaminds.life/admin?tab=company_approval', label: 'Review in Admin →' });
    } else if (event === 'whatsapp_verified') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403);
      if (!UUID.test(target)) return json({ error: 'bad_target' }, 400);
      const { data: mv } = await sb.from('mobile_verifications').select('email,full_name,phone_number,verification_status').eq('id', target).maybeSingle();
      if (!mv?.email || mv.verification_status !== 'verified') return json({ error: 'not_verified_or_no_email' }, 400);
      to = mv.email;
      subject = '✅ WhatsApp verified on your SeaMinds profile';
      html = shell('✅ WhatsApp verified', `<p>Dear ${esc(mv.full_name || 'Seafarer')},</p><p>Your WhatsApp number <b>${esc(mv.phone_number)}</b> is now verified on SeaMinds. Ship managers reviewing your applications can see the verified contact badge.</p>`, { href: 'https://seaminds.life/profile', label: 'Open My Profile →' });
    } else {
      return json({ error: 'bad_event' }, 400);
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}` },
      body: JSON.stringify({ from: 'SeaMinds <crew@seaminds.life>', reply_to: 'support@seaminds.life', to: [to], subject, html }),
    });
    if (!res.ok) { const d = await res.text(); console.error('resend', res.status, d); return json({ sent: false, status: res.status, details: d }, 502); }
    return json({ sent: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
