// Public support ticket gateway. Zero AI. Only path for creating support tickets.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function decodeJwtRole(token: string): string | null {
  try {
    const p = token.split(".")[1];
    if (!p) return null;
    const s = atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(p.length / 4) * 4, "="));
    return JSON.parse(s)?.role ?? null;
  } catch { return null; }
}

// Strip origin/query/hash, then redact dynamic identifiers into templates.
const ROUTE_TEMPLATES: Array<[RegExp, string]> = [
  [/^\/interview\/[^/]+\/exam(\/.*)?$/i, "/interview/:token/exam"],
  [/^\/interview\/[^/]+(\/.*)?$/i, "/interview/:token"],
  [/^\/crew\/view\/[^/]+(\/.*)?$/i, "/crew/view/:token"],
  [/^\/crew\/[^/]+(\/.*)?$/i, "/crew/:token"],
  [/^\/recover\/[^/]+(\/.*)?$/i, "/recover/:token"],
  [/^\/verify\/[^/]+(\/.*)?$/i, "/verify/:id"],
  [/^\/management\/inspections\/[^/]+(\/.*)?$/i, "/management/inspections/:id"],
];

function normalizeRoute(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  let p = raw.trim();
  try { p = new URL(p, "https://x.invalid").pathname; } catch { return null; }
  p = p.replace(/\/{2,}/g, "/");
  for (const [re, tpl] of ROUTE_TEMPLATES) if (re.test(p)) return tpl;
  const segs = p.split("/").filter(Boolean).slice(0, 12).map((s) => {
    if (UUID_RE.test(s) || /^[0-9a-f-]{32,}$/i.test(s)) return ":id";
    if (/^\d{3,}$/.test(s)) return ":n";
    if (/^SM-[A-Z0-9-]+$/i.test(s)) return ":ref";
    if (s.length >= 20 && /^[A-Za-z0-9_\-.~%]+$/.test(s)) return ":token";
    if (/@/.test(s)) return ":redacted";
    return s.slice(0, 40);
  });
  return ("/" + segs.join("/")).slice(0, 255);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const SALT = Deno.env.get("SUPPORT_REPORTER_SALT");
  const URL_ = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  if (!SALT) return json({ ok: false, error: "NOT_CONFIGURED" }, 503);

  // --- Auth: no header or public/anon key => anonymous; anything else must be a valid user JWT.
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== null && authHeader.trim() !== "") {
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "AUTH_INVALID" }, 401);
    const token = authHeader.slice(7).trim();
    if (!token) return json({ ok: false, error: "AUTH_INVALID" }, 401);
    const role = decodeJwtRole(token);
    const isPublicKey = token === ANON || token.startsWith("sb_publishable_") || role === "anon";
    if (!isPublicKey) {
      const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const { data, error } = await userClient.auth.getUser(token);
      if (error || !data?.user?.id) return json({ ok: false, error: "AUTH_INVALID" }, 401);
      userId = data.user.id;
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object") return json({ ok: false, error: "INVALID_JSON" }, 400);

  // --- Reporter key (never store raw IP).
  let reporterKey: string;
  if (userId) {
    reporterKey = `uid:${userId}`;
  } else {
    const ip = req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() || "";
    if (!ip) return json({ ok: false, error: "NETWORK_UNVERIFIED" }, 400);
    reporterKey = `ip_hmac:${await hmacHex(SALT, ip)}`;
  }

  const submissionId = isUuid(body.submission_id) ? body.submission_id : crypto.randomUUID();
  const assessmentId = isUuid(body.assessment_id) ? body.assessment_id : null;
  const subject = str(body.subject, 200);
  let description = str(body.description, 2000);
  const category = str(body.category, 32).toUpperCase();
  if (!subject || !description) return json({ ok: false, error: "SUBJECT_AND_DESCRIPTION_REQUIRED" }, 400);

  const route = normalizeRoute(body.route_pathname);
  // Sealed envelope: wellness/chat reports never carry chat content beyond a short user note.
  if ((route && route.startsWith("/chat")) || category === "WELLNESS") {
    description = `[Protected Wellness Scope Report]: ${description.slice(0, 500)}`;
  }

  const emailRaw = str(body.contact_email, 254);
  const contactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
  const waRaw = str(body.contact_whatsapp, 32).replace(/[^\d+]/g, "");
  const contactWhatsapp = waRaw.length >= 6 ? waRaw : null;

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("rpc_submit_support_ticket", {
    p_submission_id: submissionId,
    p_reporter_key: reporterKey,
    p_user_id: userId,
    p_contact_email: contactEmail,
    p_contact_whatsapp: contactWhatsapp,
    p_route_pathname: route,
    p_client_build: str(body.client_build, 64) || null,
    p_category: category,
    p_component: str(body.component, 64) || null,
    p_operation: str(body.operation, 64) || null,
    p_error_signature: str(body.error_signature, 64) || null,
    p_subject: subject,
    p_description: description,
    p_assessment_id: assessmentId,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("RATE_LIMITED")) return json({ ok: false, error: "RATE_LIMITED" }, 429);
    if (msg.includes("SUBMISSION_CONFLICT")) return json({ ok: false, error: "SUBMISSION_CONFLICT" }, 409);
    console.error("support-submit rpc error:", error.code);
    return json({ ok: false, error: "SUBMIT_FAILED" }, 500);
  }

  const result = data as { ok: boolean; ticket_ref: string; incident_ref: string | null; idempotent_replay: boolean };

  // Ticket is committed. Acknowledgement is best-effort and never affects the response.
  const RESEND = Deno.env.get("RESEND_API_KEY");
  if (contactEmail && RESEND && !result.idempotent_replay) {
    const send = (async () => {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "SeaMinds Support <crew@seaminds.life>",
            to: [contactEmail],
            reply_to: "support@seaminds.life",
            subject: `SeaMinds Support Ticket Received [${result.ticket_ref}]`,
            html: `<div style="font-family:Arial,sans-serif"><p>We received your report.</p><p>Reference: <b>${esc(result.ticket_ref)}</b></p><p>Subject: ${esc(subject)}</p><p>Reply to this email or write to support@seaminds.life with your reference.</p><p>— SeaMinds Support</p></div>`,
          }),
        });
        if (!r.ok) console.warn("support ack email not accepted:", r.status);
      } catch (e) {
        console.warn("support ack email failed:", String(e));
      }
    })();
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(send); else send.catch(() => {});
  }

  return json({ ok: true, ticket_ref: result.ticket_ref, incident_ref: result.incident_ref, idempotent_replay: result.idempotent_replay });
});
