import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// AI document check for company verification. Clean pass → verified + approved automatically.
// Any doubt → status 'flagged' and an alarm email to the admin. Max 3 AI checks per company per day.
const OWNER = 'aatishkumar2003@gmail.com';
const MAX_RUNS = 3;
const MIN_CONFIDENCE = 85;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const PROMPT = `You verify maritime company documents for a crew platform. You receive: the company profile and two uploaded documents (1 = business licence / company registration, 2 = crewing licence such as RPSL/SIUPPAK/MLC recruitment licence).
Return ONLY JSON:
{"business_doc":{"readable":bool,"is_business_licence":bool,"company_name":string,"number":string,"expiry":"YYYY-MM-DD" or "","authority":string},
 "crewing_doc":{"readable":bool,"is_crewing_licence":bool,"company_name":string,"number":string,"expiry":"YYYY-MM-DD" or "","authority":string},
 "name_matches_profile":bool,"licence_number_matches":bool,"looks_tampered":bool,
 "confidence":0-100,"flags":[short plain-English problems]}
Be strict: blurry, cropped, unrelated, sample/template, edited-looking or mismatched documents must be flagged. Never invent values; use "" when unreadable.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await sb.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ error: 'unauthorized' }, 401);

    const { data: cc } = await sb.from('company_compliance').select('*').eq('manager_user_id', uid).maybeSingle();
    const input = await req.json().catch(() => ({}));

    // Manager answers the AI's doubt → manual-review ticket emailed to admin.
    if (input?.action === 'explain') {
      const note = String(input.note ?? '').trim().slice(0, 1000);
      if (note.length < 5) return json({ error: 'note_too_short' }, 400);
      if (!cc || cc.status !== 'flagged') return json({ error: 'nothing_to_explain' }, 400);
      if (cc.manager_note === note) return json({ ok: true, duplicate: true });
      await sb.from('company_compliance').update({ manager_note: note, updated_at: new Date().toISOString() }).eq('manager_user_id', uid);
      const [{ data: mp }, { data: au }] = await Promise.all([
        sb.from('manager_profiles').select('company_name').eq('user_id', uid).maybeSingle(),
        sb.auth.admin.getUserById(uid),
      ]);
      const flagsList = (cc.ai_result?.flags || []).map((f: string) => `<li>${esc(f)}</li>`).join('');
      if (Deno.env.get('RESEND_API_KEY')) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` },
          body: JSON.stringify({
            from: 'SeaMinds <crew@seaminds.life>', reply_to: au?.user?.email || 'support@seaminds.life', to: [OWNER],
            subject: `🎫 Manual verification ticket: ${mp?.company_name || au?.user?.email}`,
            html: `<div style="font-family:system-ui;max-width:600px;margin:auto"><p><b>${esc(mp?.company_name)}</b> · ${esc(au?.user?.email)}</p><p><b>AI concerns:</b></p><ul>${flagsList}</ul><p><b>Manager explanation:</b><br/>${esc(note)}</p><p><a href="https://seaminds.life/admin?tab=company_approval">Review in Admin →</a></p></div>`,
          }),
        }).catch((e) => console.error('email', e));
      }
      return json({ ok: true });
    }

    if (!cc || cc.status !== 'ai_review') return json({ error: 'nothing_to_check' }, 400);
    const today = new Date().toISOString().slice(0, 10);
    const runs = cc.ai_runs_day === today ? cc.ai_runs : 0;
    if (runs >= MAX_RUNS) {
      await sb.from('company_compliance').update({ status: 'flagged', ai_result: { ...(cc.ai_result || {}), flags: ['Daily AI check limit reached — admin will review'] }, updated_at: new Date().toISOString() }).eq('manager_user_id', uid);
      return json({ status: 'flagged', reason: 'limit' });
    }
    await sb.from('company_compliance').update({ ai_runs_day: today, ai_runs: runs + 1 }).eq('manager_user_id', uid);

    const { data: mp } = await sb.from('manager_profiles').select('company_name,full_name,country').eq('user_id', uid).maybeSingle();
    const person = cc.responsible_person || {};

    const part = async (path: string, label: string) => {
      const { data: blob, error } = await sb.storage.from('company-documents').download(path);
      if (error || !blob) throw new Error(`missing ${label}`);
      if (blob.size > 10 * 1024 * 1024) throw new Error(`${label} too large`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const b64 = btoa(bin);
      const type = blob.type || (path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      return type === 'application/pdf'
        ? { type: 'file', file: { filename: `${label}.pdf`, file_data: `data:application/pdf;base64,${b64}` } }
        : { type: 'image_url', image_url: { url: `data:${type};base64,${b64}` } };
    };

    let ai: any = null; const flags: string[] = [];
    try {
      const docs = [await part(cc.business_license_path, 'business'), await part(cc.crewing_license_path, 'crewing')];
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o', temperature: 0, max_tokens: 700, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: [
            { type: 'text', text: `Profile: company "${mp?.company_name || ''}", country "${mp?.country || ''}", licence no. "${cc.license_number || ''}", website "${cc.website || ''}". Document 1 then document 2 follow.` },
            ...docs,
          ] }],
        }),
      });
      if (!res.ok) throw new Error(`AI ${res.status}`);
      ai = JSON.parse((await res.json()).choices?.[0]?.message?.content || '{}');
    } catch (e) {
      flags.push(`AI check could not complete (${String((e as Error).message || e)}) — admin review needed`);
    }

    // Deterministic checks on top of AI judgement.
    if (ai) {
      for (const f of Array.isArray(ai.flags) ? ai.flags.slice(0, 8) : []) flags.push(String(f).slice(0, 200));
      if (!ai.business_doc?.readable || !ai.business_doc?.is_business_licence) flags.push('Business licence unreadable or not a business licence');
      if (!ai.crewing_doc?.readable || !ai.crewing_doc?.is_crewing_licence) flags.push('Crewing licence unreadable or not a crewing licence');
      if (ai.name_matches_profile === false) flags.push('Company name on documents does not match the profile');
      if (ai.licence_number_matches === false) flags.push('Licence number entered does not match the document');
      if (ai.looks_tampered) flags.push('Document may be edited or tampered');
      for (const [k, d] of [['Business', ai.business_doc], ['Crewing', ai.crewing_doc]] as const) {
        if (d?.expiry && /^\d{4}-\d{2}-\d{2}$/.test(d.expiry) && d.expiry < today) flags.push(`${k} licence expired on ${d.expiry}`);
      }
      if (Number(ai.confidence || 0) < MIN_CONFIDENCE) flags.push(`AI confidence only ${Number(ai.confidence || 0)}%`);
    }
    const uniq = [...new Set(flags)];
    const pass = !!ai && uniq.length === 0;
    const now = new Date().toISOString();
    const result = { ...(ai || {}), flags: uniq, passed: pass, checked_at: now };

    await sb.from('company_compliance').update({ status: pass ? 'verified' : 'flagged', ai_result: result, ai_checked_at: now, reviewed_at: pass ? now : null, updated_at: now }).eq('manager_user_id', uid);
    if (pass) {
      await sb.from('manager_profiles').update({ company_verified: true }).eq('user_id', uid);
    }

    // One email: manager on pass, admin alarm on flag.
    const { data: au } = await sb.auth.admin.getUserById(uid);
    const co = esc(mp?.company_name || 'Company');
    const to = pass ? au?.user?.email : OWNER;
    const subject = pass ? `✅ ${mp?.company_name || 'Your company'} is verified on SeaMinds` : `⚠️ AI flagged company verification: ${mp?.company_name || au?.user?.email}`;
    const body = pass
      ? `<p>Dear ${esc(person.name || mp?.full_name || 'there')},</p><p><b>${co}</b> passed SeaMinds document verification. Your account now carries the verified company badge.</p>`
      : `<p><b>${co}</b> · ${esc(au?.user?.email)}<br/>Responsible person: ${esc(person.name)} (${esc(person.title)}) · ${esc(person.email)} · ${esc(person.phone)}</p><p><b>AI concerns:</b></p><ul>${uniq.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><p><a href="https://seaminds.life/admin?tab=company_approval">Review in Admin →</a></p>`;
    if (to && Deno.env.get('RESEND_API_KEY')) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` },
        body: JSON.stringify({ from: 'SeaMinds <crew@seaminds.life>', reply_to: 'support@seaminds.life', to: [to], subject, html: `<div style="font-family:system-ui;max-width:600px;margin:auto;background:#0D1B2A;color:#e2e8f0;padding:20px;border-radius:12px">${body}<p style="color:#94A3B8;font-size:11px">SeaMinds · support@seaminds.life</p></div>` }),
      }).catch((e) => console.error('email', e));
    }
    return json({ status: pass ? 'verified' : 'flagged', flags: pass ? [] : uniq.length });
  } catch (e) {
    console.error(e);
    return json({ error: 'verification_failed' }, 500);
  }
});
