import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CHANNEL = Deno.env.get("TELEGRAM_CHANNEL") || "@seamindsjobs";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sendToChannel(text: string): Promise<boolean> {
  if (!TG_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHANNEL,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Telegram error:", JSON.stringify(data));
    return !!data.ok;
  } catch (e) {
    console.error("Telegram send failed:", e);
    return false;
  }
}

const buildMessage = (v: any) => {
  const lines: string[] = [];
  lines.push(`⚓ <b>${esc(v.rank || "Crew")}</b>${v.vessel ? ` — ${esc(v.vessel)}` : ""}`);
  if (v.company) lines.push(`🏢 ${esc(v.company)}`);
  if (v.salary) lines.push(`💰 ${esc(v.salary)}`);
  if (v.port) lines.push(`📍 Joining: ${esc(v.port)}`);
  if (v.duration) lines.push(`📆 ${esc(v.duration)}`);
  lines.push("");
  if (v.whatsapp) {
    const d = String(v.whatsapp).replace(/[^\d]/g, "");
    if (d) lines.push(`📲 Apply on WhatsApp: https://wa.me/${d}`);
  }
  if (v.applyUrl) lines.push(`🔗 ${esc(v.applyUrl)}`);
  lines.push("");
  lines.push(`🌊 More jobs: ${Deno.env.get("SUPABASE_URL")}/functions/v1/share?type=jobs`);
  return lines.join("\n");
};

const TYPE_LABEL: Record<string, string> = {
  hiring: "🚢 HIRING",
  update: "📢 COMPANY UPDATE",
  fleet: "⚓ FLEET NEWS",
  training: "🎓 TRAINING",
  welfare: "🤝 CREW WELFARE",
};

const buildCompanyMessage = (p: any) => {
  const lines: string[] = [];
  lines.push(`${TYPE_LABEL[p.post_type] || "📢 UPDATE"}`);
  lines.push("");
  lines.push(`<b>${esc(p.company_name)}</b>${p.verified ? " ✅" : ""}`);
  lines.push("");
  lines.push(esc(p.caption || ""));
  lines.push("");
  if (p.whatsapp) {
    const d = String(p.whatsapp).replace(/[^\d]/g, "");
    if (d) lines.push(`📲 Apply on WhatsApp: https://wa.me/${d}`);
  }
  if (p.link_url) lines.push(`🔗 ${esc(p.link_url)}`);
  lines.push("");
  lines.push(`🌊 More jobs: ${Deno.env.get("SUPABASE_URL")}/functions/v1/share?type=jobs`);
  return lines.join("\n");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const AGENT_SECRET = Deno.env.get("AGENT_SECRET");
  if (AGENT_SECRET) {
    const provided = req.headers.get("x-agent-secret") || new URL(req.url).searchParams.get("secret");
    if (provided !== AGENT_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let posted = 0;
  const errors: string[] = [];

  try {
    // Company-posted vacancies first (they are the paying side)
    const { data: posts } = await supabase
      .from("job_postings")
      .select("id, rank_required, vessel_type, company_name, monthly_salary, joining_port, contract_duration, contact_whatsapp")
      .eq("status", "active")
      .eq("telegram_posted", false)
      .limit(3);

    for (const p of posts || []) {
      const ok = await sendToChannel(buildMessage({
        rank: p.rank_required, vessel: p.vessel_type, company: p.company_name,
        salary: p.monthly_salary, port: p.joining_port, duration: p.contract_duration,
        whatsapp: p.contact_whatsapp, applyUrl: null,
      }));
      if (ok) {
        await supabase.from("job_postings").update({ telegram_posted: true }).eq("id", p.id);
        posted++;
      } else errors.push(`post ${p.id}`);
      await new Promise((r) => setTimeout(r, 1200));
    }

    // Then agent-collected vacancies
    const { data: ext } = await supabase
      .from("external_vacancies")
      .select("id, rank_required, vessel_type, company_name, salary_text, joining_port, contract_duration, contact_whatsapp, apply_url")
      .eq("telegram_posted", false)
      .order("fetched_at", { ascending: false })
      .limit(5);

    for (const v of ext || []) {
      const ok = await sendToChannel(buildMessage({
        rank: v.rank_required, vessel: v.vessel_type, company: v.company_name,
        salary: v.salary_text, port: v.joining_port, duration: v.contract_duration,
        whatsapp: v.contact_whatsapp, applyUrl: v.apply_url,
      }));
      if (ok) {
        await supabase.from("external_vacancies").update({ telegram_posted: true }).eq("id", v.id);
        posted++;
      } else errors.push(`ext ${v.id}`);
      await new Promise((r) => setTimeout(r, 1200));
    }

    await supabase.from("app_events").insert({
      event_type: "telegram_broadcast",
      message: `Telegram broadcast: ${posted} vacancies posted`,
      severity: errors.length ? "warning" : "info",
      emailed: true,
      metadata: { posted, errors },
    });

    return new Response(JSON.stringify({ success: true, posted, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, posted, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
