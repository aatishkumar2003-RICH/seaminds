// Admin-only WhatsApp lead studio: screenshot OCR extraction + single templated send (client paces).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_UID = "492ee966-e015-4440-a415-6ad6275a4a9b";
const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const FROM = (Deno.env.get("TWILIO_WHATSAPP_FROM") || "").replace(/^whatsapp:/, "").trim();
const GW = "https://connector-gateway.lovable.dev/twilio";
const gwHeaders = (form = false): Record<string, string> => ({
  Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") || ""}`,
  "X-Connection-Api-Key": Deno.env.get("TWILIO_API_KEY") || "",
  ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
});
const gwReady = () => !!Deno.env.get("LOVABLE_API_KEY") && !!Deno.env.get("TWILIO_API_KEY");
const TEMPLATES: Record<string, string> = {
  fleet_partnership: "HXd248f99fc3c4d3b7529cbb5134b0a9fe",
  crew_welcome: "HX061c2b5a5f172b330a9ffa735c027875",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await svc.auth.getUser(jwt);
    if (u?.user?.id !== ADMIN_UID) return json({ error: "Admin only" }, 403);
    const body = await req.json().catch(() => ({}));

    if (body.action === "extract") {
      const img = String(body.imageBase64 || "");
      const mime = String(body.mimeType || "image/jpeg");
      if (!img || img.length > 8_000_000 || !/^image\//.test(mime)) return json({ error: "Invalid image" }, 400);
      const key = Deno.env.get("LOVABLE_API_KEY");
      if (!key) return json({ error: "AI not configured" }, 500);
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          messages: [{ role: "user", content: [
            { type: "text", text: "Extract every person and phone number visible in this image (WhatsApp group list, contact list, crew list or flyer). Return ONLY a JSON array of objects: {\"name\": string|null, \"phone\": string, \"rank\": string|null}. Copy phone numbers exactly as shown. No markdown." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${img}` } },
          ] }],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("AI error", r.status, t);
        return json({ error: r.status === 402 ? "AI credits exhausted" : r.status === 429 ? "Busy, try again shortly" : "Extraction failed" }, r.status);
      }
      const d = await r.json();
      const txt = String(d.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
      let rows: unknown = [];
      try { rows = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1)); } catch { rows = []; }
      return json({ rows: Array.isArray(rows) ? rows.slice(0, 500) : [] });
    }

    if (body.action === "template_status") {
      if (!gwReady()) return json({ error: "WhatsApp sender not configured" }, 500);
      const out: Record<string, string> = {};
      for (const [k, sid] of Object.entries(TEMPLATES)) {
        try {
          const r = await fetch(`${GW}/content/v1/Content/${sid}/ApprovalRequests`, { headers: gwHeaders() });
          const p = await r.json().catch(() => ({}));
          out[k] = String(p?.whatsapp?.status || (r.ok ? "unknown" : "error")).toLowerCase();
        } catch { out[k] = "error"; }
      }
      return json({ ok: true, statuses: out });
    }

    if (body.action === "test") {
      const tpl = TEMPLATES[String(body.template || "")];
      if (!tpl) return json({ error: "Unknown template" }, 400);
      if (!gwReady() || !FROM) return json({ error: "WhatsApp sender not configured" }, 500);
      // Test goes ONLY to the owner's own handset; never to a lead.
      const r = await fetch(`${GW}/Messages.json`, {
        method: "POST",
        headers: gwHeaders(true),
        body: new URLSearchParams({
          From: `whatsapp:${FROM}`, To: "whatsapp:+6285219878989", ContentSid: tpl,
          ContentVariables: JSON.stringify({ "1": "Test" }),
        }),
      });
      const p = await r.json().catch(() => ({}));
      return json(r.ok ? { ok: true, sid: p.sid } : { ok: false, error: p?.message || `Twilio ${r.status}` });
    }

    if (body.action === "send") {
      const id = String(body.lead_id || "");
      const tpl = TEMPLATES[String(body.template || "")];
      if (!id || !tpl) return json({ error: "Missing lead or unknown template" }, 400);
      if (!gwReady() || !FROM) return json({ error: "WhatsApp sender not configured" }, 500);
      const { data: lead } = await svc.from("whatsapp_crew_leads").select("*").eq("id", id).maybeSingle();
      if (!lead) return json({ error: "Lead not found" }, 404);
      if (lead.status === "opt_out" || lead.status === "sent") return json({ ok: true, skipped: lead.status });
      const params = new URLSearchParams({
        From: `whatsapp:${FROM}`, To: `whatsapp:${lead.phone_e164}`, ContentSid: tpl,
        ContentVariables: JSON.stringify({ "1": lead.name || "Sir/Madam" }),
      });
      const r = await fetch(`${GW}/Messages.json`, {
        method: "POST",
        headers: gwHeaders(true),
        body: params,
      });
      const p = await r.json().catch(() => ({}));
      if (!r.ok) {
        await svc.from("whatsapp_crew_leads").update({ status: "failed", last_error: String(p?.message || r.status).slice(0, 300) }).eq("id", id);
        return json({ ok: false, error: p?.message || `Twilio ${r.status}` });
      }
      await svc.from("whatsapp_crew_leads").update({ status: "sent", message_sid: p.sid, sent_at: new Date().toISOString(), last_error: null }).eq("id", id);
      return json({ ok: true, sid: p.sid });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Server error" }, 500);
  }
});
