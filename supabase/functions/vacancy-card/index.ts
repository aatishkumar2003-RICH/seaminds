import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let wasmReady = false;
let fontBuffer: Uint8Array | null = null;

const FONT_URLS = [
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf",
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf",
];

async function ensureWasm() {
  if (!wasmReady) {
    const wasmRes = await fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
    await initWasm(await wasmRes.arrayBuffer());
    wasmReady = true;
  }
  if (!fontBuffer) {
    for (const url of FONT_URLS) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          fontBuffer = new Uint8Array(await res.arrayBuffer());
          break;
        }
      } catch { /* try next */ }
    }
  }
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const wrap = (text: string, maxChars: number, maxLines: number): string[] => {
  const words = (text || "").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) { if (line) lines.push(line.trim()); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, maxLines);
};

function buildSvg(v: {
  rank: string; vessel: string; company: string; salary: string; port: string;
}): string {
  const NAVY = "#0D1B2A", GOLD = "#D4AF37", CARD = "#112240";

  // Scale the rank text down as it gets longer so nothing is cut off
  const rankText = v.rank || "Crew Wanted";
  let rankSize = 76, rankChars = 17;
  if (rankText.length > 44) { rankSize = 50; rankChars = 26; }
  else if (rankText.length > 26) { rankSize = 62; rankChars = 21; }
  const rankLines = wrap(rankText, rankChars, 3);

  let y = 300;
  const parts: string[] = [];

  rankLines.forEach((l) => {
    parts.push(`<text x="90" y="${y}" font-family="DejaVu Sans" font-size="${rankSize}" font-weight="900" fill="#ffffff">${esc(l)}</text>`);
    y += rankSize + 12;
  });

  y += 18;
  parts.push(`<text x="90" y="${y}" font-family="DejaVu Sans" font-size="34" font-weight="700" fill="${GOLD}">${esc(v.vessel || "All Vessel Types")}</text>`);
  y += 50;

  parts.push(`<text x="90" y="${y}" font-family="DejaVu Sans" font-size="27" fill="#cbd5e1">${esc(v.company || "Verified Manning Company")}</text>`);
  y += 60;

  // Always render a salary block so the card never looks empty
  const salaryText = v.salary && String(v.salary).trim() ? v.salary : "Salary on request";
  const salaryColour = v.salary && String(v.salary).trim() ? "#22c55e" : "#94a3b8";
  parts.push(`<rect x="90" y="${y}" width="900" height="96" rx="16" fill="${CARD}" stroke="${salaryColour}" stroke-opacity="0.4"/>`);
  parts.push(`<text x="130" y="${y + 62}" font-family="DejaVu Sans" font-size="40" font-weight="900" fill="${salaryColour}">${esc(salaryText)}</text>`);
  y += 140;

  parts.push(`<text x="90" y="${y}" font-family="DejaVu Sans" font-size="27" fill="#94a3b8">Joining: ${esc(v.port && String(v.port).trim() ? v.port : "To be confirmed")}</text>`);

  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="#08121f"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="none" stroke="${GOLD}" stroke-width="6" stroke-opacity="0.5"/>

  <circle cx="90" cy="90" r="34" fill="${CARD}" stroke="${GOLD}" stroke-width="2"/>
  <text x="90" y="102" font-family="DejaVu Sans" font-size="28" font-weight="900" fill="${GOLD}" text-anchor="middle">SM</text>
  <text x="142" y="82" font-family="DejaVu Sans" font-size="30" font-weight="800" fill="#ffffff">SeaMinds</text>
  <text x="142" y="112" font-family="DejaVu Sans" font-size="17" letter-spacing="3" fill="${GOLD}">SEAFARER JOB ALERT</text>

  ${parts.join("\n  ")}

  <rect x="0" y="960" width="1080" height="120" fill="${CARD}"/>
  <text x="540" y="1012" font-family="DejaVu Sans" font-size="31" font-weight="800" fill="${GOLD}" text-anchor="middle">Apply free — seaminds.life</text>
  <text x="540" y="1052" font-family="DejaVu Sans" font-size="21" fill="#94a3b8" text-anchor="middle">Verified maritime vacancies for seafarers</text>
</svg>`;
}

function buildDigestSvg(jobs: any[], count: number): string {
  const NAVY = "#0D1B2A", GOLD = "#D4AF37", CARD = "#112240";
  const rows: string[] = [];
  let y = 300;

  jobs.slice(0, 6).forEach((j) => {
    const rank = wrap(j.rank || "Crew", 30, 1)[0] || "Crew";
    const detail = [j.vessel, j.company].filter(Boolean).join(" · ");
    const detailLine = wrap(detail, 44, 1)[0] || "";
    rows.push(`<rect x="70" y="${y - 44}" width="940" height="92" rx="14" fill="${CARD}"/>`);
    rows.push(`<text x="100" y="${y - 8}" font-family="DejaVu Sans" font-size="34" font-weight="800" fill="#ffffff">${esc(rank)}</text>`);
    if (detailLine) rows.push(`<text x="100" y="${y + 26}" font-family="DejaVu Sans" font-size="22" fill="#94a3b8">${esc(detailLine)}</text>`);
    if (j.salary) rows.push(`<text x="980" y="${y - 8}" font-family="DejaVu Sans" font-size="26" font-weight="800" fill="#22c55e" text-anchor="end">${esc(String(j.salary).slice(0, 18))}</text>`);
    y += 108;
  });

  const more = count > 6 ? `+ ${count - 6} more vacancies on SeaMinds` : "All live now on SeaMinds";

  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="#08121f"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="none" stroke="${GOLD}" stroke-width="6" stroke-opacity="0.5"/>

  <circle cx="90" cy="90" r="34" fill="${CARD}" stroke="${GOLD}" stroke-width="2"/>
  <text x="90" y="102" font-family="DejaVu Sans" font-size="28" font-weight="900" fill="${GOLD}" text-anchor="middle">SM</text>
  <text x="142" y="82" font-family="DejaVu Sans" font-size="30" font-weight="800" fill="#ffffff">SeaMinds</text>
  <text x="142" y="112" font-family="DejaVu Sans" font-size="17" letter-spacing="3" fill="${GOLD}">SEAFARER JOB ALERT</text>

  <text x="70" y="205" font-family="DejaVu Sans" font-size="64" font-weight="900" fill="#ffffff">${count} New Vacancies</text>
  <text x="70" y="250" font-family="DejaVu Sans" font-size="28" fill="${GOLD}">Deck · Engine · Catering · Cadets</text>

  ${rows.join("\n  ")}

  <text x="540" y="930" font-family="DejaVu Sans" font-size="24" fill="#94a3b8" text-anchor="middle">${esc(more)}</text>

  <rect x="0" y="960" width="1080" height="120" fill="${CARD}"/>
  <text x="540" y="1012" font-family="DejaVu Sans" font-size="31" font-weight="800" fill="${GOLD}" text-anchor="middle">Apply free — seaminds.life</text>
  <text x="540" y="1052" font-family="DejaVu Sans" font-size="21" fill="#94a3b8" text-anchor="middle">No agent fees. Apply direct on WhatsApp.</text>
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
    // NOTE: single cards should normally be generated on demand (streamed).
    // Only pass save=true for the rare case a stored URL is required.
    const save = url.searchParams.get("save") === "true";
    const mode = url.searchParams.get("mode") || "single";

    // Cleanup: delete generated cards older than 30 days (called by the nightly cron)
    if (mode === "cleanup") {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: files } = await supabase.storage.from("job-fliers").list("", { limit: 1000 });
      const stale = (files || [])
        .filter((f: any) => (f.name.startsWith("external-") || f.name.startsWith("digest-")) && f.created_at < cutoff)
        .map((f: any) => f.name);
      if (stale.length) await supabase.storage.from("job-fliers").remove(stale);
      return new Response(JSON.stringify({ success: true, removed: stale.length }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Digest: one card summarising many vacancies
    if (mode === "digest") {
      const hours = Number(url.searchParams.get("hours") || 24);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data: recent, count } = await supabase
        .from("external_vacancies")
        .select("rank_required, vessel_type, company_name, salary_text", { count: "exact" })
        .gte("fetched_at", since)
        .order("fetched_at", { ascending: false })
        .limit(6);
      const jobs = (recent || []).map((r: any) => ({
        rank: r.rank_required, vessel: r.vessel_type, company: r.company_name, salary: r.salary_text,
      }));
      const svgD = buildDigestSvg(jobs, count ?? jobs.length);
      const resvgD = new Resvg(svgD, {
        fitTo: { mode: "width", value: 1080 },
        font: { fontBuffers: fontBuffer ? [fontBuffer] : [], defaultFontFamily: "DejaVu Sans", loadSystemFonts: false },
      });
      const pngD = resvgD.render().asPng();
      return new Response(pngD, { headers: { ...cors, "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
    }

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
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1080 },
      font: {
        fontBuffers: fontBuffer ? [fontBuffer] : [],
        defaultFontFamily: "DejaVu Sans",
        loadSystemFonts: false,
      },
    });
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
    await supabase.from("app_events").insert({
      event_type: "vacancy_card",
      message: `Vacancy card FAILED: ${String(e).substring(0, 200)}`,
      severity: "error",
      emailed: true,
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
