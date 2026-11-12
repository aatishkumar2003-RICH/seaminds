// Resend webhook: email.bounced / email.complained → mark contact bounced/unsubscribed and log app_events.
// Verified with the Svix signature (RESEND_WEBHOOK_SECRET, "whsec_..."). No secret = reject everything.
import { createClient } from "npm:@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";

async function verify(id: string, ts: string, body: string, sigHeader: string) {
  if (!SECRET || !id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 600) return false;
  const raw = Uint8Array.from(atob(SECRET.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigHeader.split(" ").some((p) => p.split(",")[1] === expected);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const body = await req.text();
  const ok = await verify(req.headers.get("svix-id") || "", req.headers.get("svix-timestamp") || "", body, req.headers.get("svix-signature") || "");
  if (!ok) return new Response("invalid signature", { status: 401 });
  let evt: any; try { evt = JSON.parse(body); } catch { return new Response("bad json", { status: 400 }); }
  const type = String(evt?.type || "");
  if (type !== "email.bounced" && type !== "email.complained") return new Response("ignored");
  const to: string[] = (Array.isArray(evt?.data?.to) ? evt.data.to : [evt?.data?.to]).filter(Boolean).map((e: string) => String(e).toLowerCase().trim()).slice(0, 50);
  const stage = type === "email.bounced" ? "bounced" : "unsubscribed";
  const note = type === "email.bounced" ? `bounced:${String(evt?.data?.bounce?.type || "hard").slice(0, 30)}` : "complained";
  const now = new Date().toISOString();
  for (const email of to) {
    await svc.from("vessel_outreach_contacts").update({ stage, last_error: note, updated_at: now }).ilike("email", email);
    await svc.from("recruiter_outreach_contacts").update({ stage, notes: note, updated_at: now }).ilike("email", email);
    await svc.from("app_events").insert({ event_type: type === "email.bounced" ? "email_bounced" : "email_complained", message: `${note}: ${email}`, metadata: { email, subject: String(evt?.data?.subject || "").slice(0, 150) } });
  }
  return new Response("ok");
});
