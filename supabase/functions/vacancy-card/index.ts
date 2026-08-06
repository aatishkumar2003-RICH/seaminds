import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let wasmReady = false;
async function ensureWasm() {
  if (wasmReady) return;
  const wasmRes = await fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
  await initWasm(await wasmRes.arrayBuffer());
  wasmReady = true;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const wrap = (text: string, maxChars: number): string[] => {
  const words = (text || "").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) { if (line) lines.push(line.trim()); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 2);
};

function buildSvg(v: {
  rank: string; vessel: string; company: string; salary: string; port: string;
}): string {
  const NAVY = "#0D1B2A", GOLD = "#D4AF37", CARD = "#112240";
  const rankLines = wrap(v.rank || "Crew Wanted", 16);
  const rankY = rankLines.length > 1 ? 330 : 360;

  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="#08121f"/>
    </linearGradient>
    <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="none" stroke="${GOLD}" stroke-width="6" stroke-opacity="0.5"/>

  <!-- top bar -->
  <circle cx="90" cy="90" r="34" fill="${CARD}" stroke="${GOLD}" stroke-width="2"/>
  <text x="90" y="102" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="${GOLD}" text-anchor="middle">SM</text>
  <text x="140" y="82" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#ffffff">SeaMinds</text>
  <text x="140" y="112" font-family="Arial, sans-serif" font-size="18" letter-spacing="3" fill="${GOLD}">SEAFARER JOB ALERT</text>

  <!-- rank, huge -->
  ${rankLines.map((l, i) => `<text x="90" y="${rankY + i * 84}" font-family="Arial, sans-serif" font-size="76" font-weight="900" fill="#ffffff">${esc(l)}</text>`).join("\n  ")}

  <!-- vessel -->
  <text x="90" y="${rankY + rankLines.length * 84 + 20}" font-family="Arial, sans-serif" font-size="34" fill="${GOLD}" font-weight="700">${esc(v.vessel || "All Vessel Types")}</text>

  <!-- company -->
  <text x="90" y="${rankY + rankLines.length * 84 + 66}" font-family="Arial, sans-serif" font-size="26" fill="#cbd5e1">${esc(v.company || "Verified Manning Company")}</text>

  <!-- salary card -->
  ${v.salary ? `
  <rect x="90" y="${rankY + rankLines.length * 84 + 100}" width="900" height="90" rx="16" fill="${CARD}" stroke="#22c55e" stroke-opacity="0.4"/>
  <text x="130" y="${rankY + rankLines.length * 84 + 158}" font-family="Arial, sans-serif" font-size="42" font-weight="900" fill="#22c55e">💰 ${esc(v.salary)}</text>
  ` : ""}

  ${v.port ? `<text x="90" y="1010" font-family="Arial, sans-serif" font-size="26" fill="#94a3b8">📍 Joining: ${esc(v.port)}</text>` : ""}

  <!-- footer -->
  <rect x="0" y="984" width="1080" height="96" fill="${CARD}"/>
  <text x="540" y="1044" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="${GOLD}" text-anchor="middle">Apply free — seaminds.life</text>
</svg>`;
}

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-agent-secret" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const AGENT_SECRET = Deno.env.get("AGENT_SECRET");
  if (AGENT_SECRET) {
    const provided = req.headers.get("x-agent-secret") || new URL(req.url).searchParams.get("secret");
    if (provided !== AGENT_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }

  try {
    await ensureWasm();
    const url = new URL(req.url);
    const source = url.searchParams.get("source") || "external"; // "external" | "posting"
    const id = url.searchParams.get("id");
    const save = url.searchParams.get("save") === "true";

    let vacancy: any = null;

    if (id) {
      if (source === "posting") {
        const { data } = await supabase.from("job_postings").select("*").eq("id", id).maybeSingle();
        if (data) vacancy = {
          rank: data.rank_required, vessel: data.vessel_type, company: data.company_name,
          salary: data.monthly_salary, port: data.joining_port,
        };
      } else {
        const { data } = await supabase.from("external_vacancies").select("*").eq("id", id).maybeSingle();
        if (data) vacancy = {
          rank: data.rank_required, vessel: data.vessel_type, company: data.company_name,
          salary: data.salary_text, port: data.joining_port,
        };
      }
    }

    if (!vacancy) {
      vacancy = {
        rank: url.searchParams.get("rank") || "Crew Wanted",
        vessel: url.searchParams.get("vessel") || "",
        company: url.searchParams.get("company") || "",
        salary: url.searchParams.get("salary") || "",
        port: url.searchParams.get("port") || "",
      };
    }

    const svg = buildSvg(vacancy);
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const png = resvg.render().asPng();

    if (save && id) {
      const path = `${source}-${id}.png`;
      await supabase.storage.from("job-fliers").upload(path, png, { contentType: "image/png", upsert: true });
      const { data: pub } = supabase.storage.from("job-fliers").getPublicUrl(path);
      if (source === "posting") {
        await supabase.from("job_postings").update({ flier_url: pub.publicUrl }).eq("id", id);
      }
      return new Response(JSON.stringify({ success: true, url: pub.publicUrl }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(png, { headers: { ...cors, "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
