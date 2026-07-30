import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'SeaMinds <noreply@seaminds.life>';
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_WA_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') || '';
const TWILIO_CONTENT_SID = Deno.env.get('TWILIO_CONTENT_SID') || '';
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || '';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, accept, accept-profile, content-profile, prefer, range',
  'Access-Control-Max-Age': '86400',
};

// Always 200 so the browser SDK surfaces our structured error instead of a
// generic "non-2xx" failure. The `success` flag carries the outcome.
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

const log = (...args: unknown[]) => console.log('[verify-contact]', ...args);

async function sha256(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const sanitizeEmail = (v: string) => String(v || '').trim().toLowerCase().slice(0, 200);
const sanitizePhone = (v: string) => {
  const raw = String(v || '').replace(/[^\d+]/g, '').slice(0, 20);
  return raw.startsWith('+') ? '+' + raw.slice(1).replace(/\+/g, '') : raw;
};

function secureOtp() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

async function resendSend(from: string, to: string, code: string) {
  return await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'SeaMinds Verification Code',
      html: `<div style="font-family:system-ui,Segoe UI,Arial;max-width:460px;margin:0 auto;background:#0D1B2A;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#D4AF37,#B8860B);padding:18px;text-align:center"><h2 style="margin:0;color:#0D1B2A">⚓ SeaMinds Verification</h2></div>
        <div style="padding:24px;text-align:center">
          <p style="color:#9CA3AF;font-size:13px;margin:0 0 12px">Enter this code in SeaMinds to verify your contact details.</p>
          <div style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#D4AF37">${code}</div>
          <p style="color:#6b7280;font-size:12px;margin-top:14px">Valid for 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);color:#555;font-size:11px">SeaMinds — seaminds.life</div>
      </div>`,
    }),
  });
}

async function sendEmail(to: string, code: string) {
  if (!RESEND_KEY) throw new Error('Email service is not configured (missing RESEND_API_KEY). Contact SeaMinds support.');
  let res = await resendSend(EMAIL_FROM, to, code);
  if (!res.ok) {
    const body = await res.text();
    log('resend error', res.status, body);
    // Domain not verified yet → fall back to the shared Resend sender so crew are never blocked.
    if (res.status === 403 || res.status === 422 || /domain/i.test(body)) {
      res = await resendSend('SeaMinds <onboarding@resend.dev>', to, code);
      if (res.ok) return;
      const body2 = await res.text();
      log('resend fallback error', res.status, body2);
      throw new Error('Email codes are not active yet: the SeaMinds sender domain still needs to be verified with the email provider. Please verify your WhatsApp number instead, or contact SeaMinds support.');

    }
    throw new Error(`Email delivery failed (${res.status}). ${body.slice(0, 180)}`);
  }
}

// Known Twilio WhatsApp Sandbox senders (freeform body messages allowed for joined numbers)
const SANDBOX_SENDERS = ['+14155238886', '+17372508034'];

async function twilioPost(params: URLSearchParams) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, text, parsed };
}

async function sendWhatsApp(to: string, code: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WA_FROM) {
    log('twilio not configured');
    return false;
  }
  const bare = TWILIO_WA_FROM.replace(/^whatsapp:/, '').trim();
  const from = `whatsapp:${bare}`;
  const isSandbox = SANDBOX_SENDERS.includes(bare);
  const body = `Your SeaMinds verification code is ${code}. It expires in 10 minutes.`;

  // 1) Freeform body message (works for Sandbox and inside a 24h session window)
  const freeform = new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: body });
  log('twilio request', { mode: isSandbox ? 'sandbox' : 'production', api: 'messages-freeform', From: from, To: `whatsapp:${to}` });
  let r = await twilioPost(freeform);
  log('twilio response', { status: r.status, body: r.text.slice(0, 600) });
  if (r.ok) return true;

  const twilioCode = r.parsed?.code;

  // 2) Production senders outside a session require an approved template (Content API)
  if (twilioCode === 21654 || twilioCode === 63016) {
    if (TWILIO_CONTENT_SID) {
      const templated = new URLSearchParams({
        From: from,
        To: `whatsapp:${to}`,
        ContentSid: TWILIO_CONTENT_SID,
        ContentVariables: JSON.stringify({ '1': code }),
      });
      if (TWILIO_MESSAGING_SERVICE_SID) {
        templated.delete('From');
        templated.set('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
      }
      log('twilio request', { api: 'content-template', ContentSid: TWILIO_CONTENT_SID, To: `whatsapp:${to}` });
      r = await twilioPost(templated);
      log('twilio response', { status: r.status, body: r.text.slice(0, 600) });
      if (r.ok) return true;
    } else if (isSandbox) {
      throw new Error('WhatsApp sandbox message rejected: this number has not joined the Twilio Sandbox yet. Send the join code to the sandbox number on WhatsApp, then try again — or verify your email instead.');
    } else {
      throw new Error('WhatsApp needs an approved template for this sender (Twilio error 21654). Add a TWILIO_CONTENT_SID secret with your approved OTP template, or verify your email instead.');
    }
  }

  throw new Error(`WhatsApp delivery failed (${r.status}). ${(r.parsed?.message || r.text).slice(0, 200)}`);
}


// Accepts both the new explicit actions and the legacy {action, channel} shape.
function parseAction(payload: Record<string, unknown>) {
  const raw = String(payload.action || '');
  const map: Record<string, { op: 'send' | 'verify'; channel: 'email' | 'whatsapp' }> = {
    send_email_code: { op: 'send', channel: 'email' },
    verify_email_code: { op: 'verify', channel: 'email' },
    send_whatsapp_code: { op: 'send', channel: 'whatsapp' },
    verify_whatsapp_code: { op: 'verify', channel: 'whatsapp' },
  };
  if (map[raw]) return map[raw];
  const channel = payload.channel === 'whatsapp' ? 'whatsapp' : 'email';
  if (raw === 'send' || raw === 'verify') return { op: raw as 'send' | 'verify', channel };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return json({ success: false, error: 'You must be signed in to verify your contact details.' });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) {
      log('auth failed', userErr?.message);
      return json({ success: false, error: 'Your session expired. Please refresh the page and sign in again.' });
    }

    const payload = await req.json().catch(() => ({}));
    const parsed = parseAction(payload);
    if (!parsed) return json({ success: false, error: 'Unknown verification action' });
    const { op, channel } = parsed;
    const target = channel === 'email' ? sanitizeEmail(payload.target) : sanitizePhone(payload.target);

    log('request', { user: user.id, op, channel });

    if (!target) return json({ success: false, error: 'Enter your contact detail first' });
    if (channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      return json({ success: false, error: 'Enter a valid email address' });
    }
    if (channel === 'whatsapp' && !/^\+\d{7,15}$/.test(target)) {
      return json({ success: false, error: 'Enter the number in international format with country code (e.g. +639171234567)' });
    }

    if (op === 'send') {
      // Rate limit: max 5 codes per channel per hour
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from('contact_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('channel', channel)
        .gte('created_at', hourAgo);
      if ((count || 0) >= 5) {
        return json({ success: false, error: 'Too many codes requested. Please try again in an hour.' });
      }

      const code = secureOtp();
      const code_hash = await sha256(`${user.id}:${channel}:${target}:${code}`);

      const { error: insErr } = await admin.from('contact_verifications').insert({
        user_id: user.id,
        channel,
        target,
        code_hash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (insErr) {
        log('insert error', insErr.message);
        return json({ success: false, error: 'Could not create a verification code. Please try again.' });
      }

      let delivered: string = channel;
      if (channel === 'email') {
        await sendEmail(target, code);
      } else {
        const sent = await sendWhatsApp(target, code);
        if (!sent) {
          const fallbackEmail = sanitizeEmail((payload.fallback_email as string) || user.email || '');
          if (!fallbackEmail) {
            return json({ success: false, error: 'WhatsApp delivery is not configured yet. Please verify your email instead.' });
          }
          await sendEmail(fallbackEmail, code);
          delivered = 'email_fallback';
        }
      }

      log('code sent', { channel, delivered });
      return json({ success: true, delivered });
    }

    // verify
    const code = String(payload.code || '').replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) return json({ success: false, error: 'Enter the 6-digit code' });

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
    if (!row) return json({ success: false, error: 'No pending code. Request a new one.' });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json({ success: false, error: 'Code expired. Request a new one.' });
    }
    if ((row.attempts || 0) >= 5) {
      return json({ success: false, error: 'Too many attempts. Request a new code.' });
    }

    const hash = await sha256(`${user.id}:${channel}:${target}:${code}`);
    if (hash !== row.code_hash) {
      await admin.from('contact_verifications').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id);
      return json({ success: false, error: 'Incorrect code. Please try again.' });
    }

    const now = new Date().toISOString();
    // Consume the code (replay protection)
    await admin.from('contact_verifications').update({ verified_at: now }).eq('id', row.id);

    const profileUpdate = channel === 'email'
      ? { email_verified: true, email_verified_at: now, email: target }
      : { whatsapp_verified: true, whatsapp_verified_at: now, whatsapp_number: target };
    const { error: profErr } = await admin.from('crew_profiles').update(profileUpdate).eq('user_id', user.id);
    if (profErr) log('profile update warning', profErr.message);

    log('verified', { channel });
    return json({
      success: true,
      verified: true,
      channel,
      message: 'Welcome to SeaMinds. Your contact has been successfully verified.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    console.error('[verify-contact] failure:', message);
    return json({ success: false, error: message });
  }
});
