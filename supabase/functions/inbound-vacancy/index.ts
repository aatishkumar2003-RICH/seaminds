// Inbound "forward-to-post": agencies email vacancies to jobs@seaminds.life.
// The mail provider POSTs the email here with ?key=<INBOUND_EMAIL_SECRET>.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const PROMPT = `You extract maritime job vacancies from a forwarded recruitment email (any language: English, Bahasa Indonesia, Tagalog). Translate ranks to standard English (Nakhoda/Kapitan=Master, Mualim I=Chief Officer, KKM/Hepe=Chief Engineer, Masinis I=2nd Engineer, Juru Mudi/Timonel=AB, Kelasi=OS, Koki/Kusinero=Cook).
Return JSON {"company_name":string|null,"vacancies":[{rank_required,vessel_type,contract_duration,salary_text,joining_port,joining_date,contact_whatsapp,contact_email,notes}],"risk":"low|medium|high"}.
One object PER RANK. Never invent data; use null. joining_date only strict YYYY-MM-DD. risk=high if seafarers are asked to pay fees/deposits. If the email is not a job vacancy, return vacancies: [].`;

function strip(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ");
}

async function readEmail(req: Request) {
  const ct = req.headers.get("content-type") || "";
  let p: any = {};
  if (ct.includes("json")) p = await req.json();
  else { const f = await req.formData(); f.forEach((v, k) => { if (typeof v === "string") p[k] = v; }); }
  const d = p.data ?? p; // Resend wraps in {type, data}
  const from = d.from?.email ?? d.from?.address ?? d.envelope?.from ?? d.FromFull?.Email ?? d.From ?? d.sender ?? d.from ?? "";
  const subject = d.subject ?? d.Subject ?? d.headers?.subject ?? "";
  const text = d.text ?? d.plain ?? d.TextBody ?? d["body-plain"] ?? d["stripped-text"] ?? (d.html || d.HtmlBody ? strip(d.html || d.HtmlBody) : "");
  return { from: String(from).match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase() ?? "", subject: String(subject), text: String(text) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const secret = Deno.env.get("INBOUND_EMAIL_SECRET");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || key !== secret) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const mail = await readEmail(req);
    const body = `${mail.subject}\n\n${mail.text}`.slice(0, 8000);
    if (body.trim().length < 40) return json({ ok: true, saved: 0, reason: "empty" });

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0, response_format: { type: "json_object" },
        messages: [{ role: "system", content: PROMPT }, { role: "user", content: body }] }),
    });
    if (!ai.ok) {
      await svc.from("app_events").insert({ event_type: "inbound_vacancy_failed", metadata: { from: mail.from, status: ai.status } } as any);
      return json({ ok: false, error: "ai_failed" }, 200);
    }
    const out = JSON.parse((await ai.json()).choices?.[0]?.message?.content || "{}");
    const list: any[] = Array.isArray(out.vacancies) ? out.vacancies : [];
    if (out.risk === "high" || !list.length) {
      await svc.from("app_events").insert({ event_type: "inbound_vacancy_skipped", metadata: { from: mail.from, subject: mail.subject, risk: out.risk, count: list.length } } as any);
      return json({ ok: true, saved: 0 });
    }

    let saved = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const v of list.slice(0, 20)) {
      if (!v?.rank_required) continue;
      const company = out.company_name || null;
      const dedup = `email|${(company || mail.from).toLowerCase()}|${String(v.rank_required).toLowerCase()}|${(v.vessel_type || "").toLowerCase()}|${today}`;
      const { error } = await svc.from("external_vacancies").insert({
        source: "email_forward",
        external_id: `email-${crypto.randomUUID()}`,
        title: `${v.rank_required}${v.vessel_type ? ` — ${v.vessel_type}` : ""}`,
        rank_required: v.rank_required, vessel_type: v.vessel_type, company_name: company,
        salary_text: v.salary_text, joining_port: v.joining_port,
        joining_date: /^\d{4}-\d{2}-\d{2}$/.test(v.joining_date || "") ? v.joining_date : null,
        contract_duration: v.contract_duration, description: v.notes || mail.subject,
        contact_email: v.contact_email || mail.from || null, contact_whatsapp: v.contact_whatsapp || null,
        quality_score: 60, is_verified: false, is_scam_flagged: out.risk === "medium",
        scam_flags: out.risk === "medium" ? ["review: medium risk"] : [],
        fetched_at: new Date().toISOString(), source_posted_at: today, dedup_key: dedup,
        raw_data: { from: mail.from, subject: mail.subject, vacancy: v },
      });
      if (!error) saved++;
    }
    await svc.from("app_events").insert({ event_type: "inbound_vacancy_posted", metadata: { from: mail.from, subject: mail.subject, saved } } as any);
    return json({ ok: true, saved });
  } catch (e) {
    console.error("inbound-vacancy", e);
    return json({ ok: false, error: "bad_request" }, 200);
  }
});
