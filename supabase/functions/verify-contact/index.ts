import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_WA_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') || '';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const sanitizeEmail = (v: string) => String(v || '').trim().toLowerCase().slice(0, 200);
const sanitizePhone = (v: string) => String(v || '').replace(/[^\d+]/g, '').slice(0, 20);

async function sendEmail(to: string, code: string) {
  if (!RESEND_KEY) throw new Error('Email sending is not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: 'SeaMinds <crew@seaminds.life>',
      to: [to],
      subject: `${code} is your SeaMinds verification code`,
      html: `<div style="font-family:system-ui;max-width:460px;margin:0 auto;background:#0D1B2A;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#D4AF37,#B8860B);padding:18px;text-align:center"><h2 style="margin:0;color:#0D1B2A">⚓ Verify your contact</h2></div>
        <div style="padding:24px;text-align:center">
          <p style="color:#9CA3AF;font-size:13px;margin:0 0 12px">Enter this code in your SeaMinds CV to confirm your contact details.</p>
          <div style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#D4AF37">${code}</div>
          <p style="color:#6b7280;font-size:12px;margin-top:14px">Valid for 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);color:#555;font-size:11px">SeaMinds — PT Indoglobal Service Solutions</div>
      </div>`,
    }),
  });
  if (!res.ok) throw new Error(`Email delivery failed (${res.status})`);
}

async function sendWhatsApp(to: string, code: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WA_FROM) return false;
  const body = new URLSearchParams({
    From: `whatsapp:${TWILIO_WA_FROM}`,
    To: `whatsapp:${to}`,
    Body: `⚓ SeaMinds: your verification code is ${code}. Valid for 10 minutes.`,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`WhatsApp delivery failed (${res.status})`);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ success: false, error: 'Unauthorized' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ success: false, error: 'Unauthorized' }, 401);

    const payload = await req.json();
    const action = String(payload.action || '');
    const channel = payload.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const target = channel === 'email' ? sanitizeEmail(payload.target) : sanitizePhone(payload.target);

    if (!target) return json({ success: false, error: 'Missing contact detail' }, 400);
    if (channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      return json({ success: false, error: 'Enter a valid email address' }, 400);
    }
    if (channel === 'whatsapp' && !/^\+?\d{7,15}$/.test(target)) {
      return json({ success: false, error: 'Enter a valid number with country code (e.g. +63...)' }, 400);
    }

    if (action === 'send') {
      // Rate limit: max 5 codes per channel per hour
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from('contact_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('channel', channel)
        .gte('created_at', hourAgo);
      if ((count || 0) >= 5) {
        return json({ success: false, error: 'Too many codes requested. Try again in an hour.' }, 429);
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const code_hash = await sha256(`${user.id}:${channel}:${target}:${code}`);

      await admin.from('contact_verifications').insert({
        user_id: user.id,
        channel,
        target,
        code_hash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      let delivered = channel;
      if (channel === 'email') {
        await sendEmail(target, code);
      } else {
        const sent = await sendWhatsApp(target, code);
        if (!sent) {
          // Fallback: deliver the WhatsApp code to the signed-in crew's account email
          const fallbackEmail = sanitizeEmail(payload.fallback_email || user.email || '');
          if (!fallbackEmail) return json({ success: false, error: 'WhatsApp delivery is not configured' }, 503);
          await sendEmail(fallbackEmail, code);
          delivered = 'email_fallback';
        }
      }

      return json({ success: true, delivered });
    }

    if (action === 'verify') {
      const code = String(payload.code || '').replace(/\D/g, '').slice(0, 6);
      if (code.length !== 6) return json({ success: false, error: 'Enter the 6-digit code' }, 400);

      const { data: rows } = await admin
        .from('contact_verifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel', channel)
        .eq('target', target)
        .is('verified_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const row = rows?.[0];
      if (!row) return json({ success: false, error: 'No pending code. Request a new one.' }, 400);
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json({ success: false, error: 'Code expired. Request a new one.' }, 400);
      }
      if ((row.attempts || 0) >= 5) {
        return json({ success: false, error: 'Too many attempts. Request a new code.' }, 429);
      }

      const hash = await sha256(`${user.id}:${channel}:${target}:${code}`);
      if (hash !== row.code_hash) {
        await admin.from('contact_verifications').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id);
        return json({ success: false, error: 'Incorrect code. Please try again.' }, 400);
      }

      const now = new Date().toISOString();
      await admin.from('contact_verifications').update({ verified_at: now }).eq('id', row.id);

      const profileUpdate = channel === 'email'
        ? { email_verified: true, email_verified_at: now, email: target }
        : { whatsapp_verified: true, whatsapp_verified_at: now, whatsapp_number: target };
      await admin.from('crew_profiles').update(profileUpdate).eq('user_id', user.id);

      return json({ success: true, verified: true, channel });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
