import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const LANGUAGES = [
  { code: "en", name: "English", note: "Write in clear simple English." },
  { code: "vi", name: "Vietnamese", note: "Write entirely in Vietnamese (Tiếng Việt), natural and professional." },
  { code: "tl", name: "Tagalog", note: "Write entirely in Tagalog, natural for Filipino seafarers." },
  { code: "hi", name: "Hindi", note: "Write entirely in Hindi (Devanagari script), natural for Indian seafarers." },
  { code: "id", name: "Indonesian", note: "Write entirely in Bahasa Indonesia, natural for Indonesian seafarers." },
];

const TOPICS = [
  "How to calculate MLC 2006 rest hours correctly",
  "Seaman CV format 2026: what manning companies actually look for",
  "How to become an ETO on ships: qualifications and career path",
  "Panama seaman book: how to apply and renew",
  "STCW certificates explained for new seafarers",
  "How to prepare your vessel and yourself for a PSC inspection",
  "Best vessel types for deck cadets to start a career",
  "Homesickness at sea: practical ways seafarers cope",
  "Understanding your Seafarer Employment Agreement before you sign",
  "Tanker vs bulk carrier: which is better for your career",
  "How to get your first job as a deck cadet",
  "SIRE 2.0 explained: what it means for crew on tankers",
  "Medical certificate requirements for seafarers worldwide",
  "How to negotiate salary as a seafarer",
  "Fatigue management on board: your rights under STCW",
  "Documents every seafarer needs before joining a vessel",
  "MARPOL basics every crew member must know",
  "Signing off: the checklist before you leave the vessel",
  "How to stay fit and healthy on board a ship",
  "What is a Continuous Discharge Certificate and why it matters",
  "How to avoid maritime job scams and fake manning agents",
  "Working on LNG carriers: what officers need to know",
];


const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);

// ---------------- market_report mode ----------------

const NAVY = "#0D1B2A";
const CARD = "#112240";
const GOLD = "#D4AF37";
const MUTED = "#94A3B8";

const REGIONS: Record<string, RegExp> = {
  India: /mumbai|chennai|kolkata|india/i,
  Indonesia: /jakarta|surabaya|indonesia|batam/i,
  Philippines: /manila|cebu|philippines/i,
  Gulf: /dubai|fujairah|uae|saudi|qatar|rak|khorfakkan/i,
};

const regionOf = (port: string | null): string | null => {
  if (!port) return null;
  for (const [name, re] of Object.entries(REGIONS)) if (re.test(port)) return name;
  return null;
};

const departmentOf = (rank: string | null): string => {
  const r = (rank || "").toLowerCase();
  if (/engineer|electr|eto|motorman|fitter|oiler|wiper/.test(r)) return "ENGINE";
  if (/cook|steward|messman|catering|chef|galley/.test(r)) return "CATERING";
  if (/dp|rigger|crane|offshore|barge|roustabout/.test(r)) return "OFFSHORE";
  return "DECK";
};

const esc = (s: any) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtDate = (d: Date) =>
  `${d.getUTCDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;

async function marketReport() {
  const now = new Date();

  const { data: vacRaw } = await supabase
    .from("external_vacancies")
    .select("rank_required, vessel_type, joining_port, salary_text, salary_min, salary_max, expires_at, first_seen_at, is_scam_flagged")
    .gt("expires_at", now.toISOString())
    .or("is_scam_flagged.is.null,is_scam_flagged.eq.false")
    .limit(2000);

  const vacancies = (vacRaw || []).filter((v: any) => v.rank_required);

  // recent focuses (last 7 days)
  const since = new Date(now.getTime() - 7 * 864e5).toISOString();
  const { data: recent } = await supabase
    .from("blog_posts")
    .select("title, created_at")
    .gte("created_at", since);
  const recentTitles = (recent || []).map((r: any) => (r.title || "").toLowerCase());
  const usedRecently = (focus: string) => recentTitles.some((t) => t.includes(focus.toLowerCase()));

  // rank + region candidates
  const rankCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  for (const v of vacancies) {
    rankCounts.set(v.rank_required, (rankCounts.get(v.rank_required) || 0) + 1);
    const reg = regionOf(v.joining_port);
    if (reg) regionCounts.set(reg, (regionCounts.get(reg) || 0) + 1);
  }
  const topRanks = [...rankCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const regions = [...regionCounts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);

  let focusKind: "rank" | "region" | "digest" = "digest";
  let focus = "";
  const rankPick = topRanks.find(([r]) => !usedRecently(r));
  const regionPick = regions.find(([r]) => !usedRecently(`jobs ${r}`));
  if (rankPick) { focusKind = "rank"; focus = rankPick[0]; }
  else if (regionPick) { focusKind = "region"; focus = regionPick[0]; }

  let matching = vacancies;
  if (focusKind === "rank") matching = vacancies.filter((v: any) => v.rank_required === focus);
  if (focusKind === "region") matching = vacancies.filter((v: any) => regionOf(v.joining_port) === focus);

  if (matching.length < 3) {
    // widen to 72h lookback on first_seen_at across all live vacancies
    const cutoff = new Date(now.getTime() - 72 * 3600e3).toISOString();
    matching = vacancies.filter((v: any) => (v.first_seen_at || "") >= cutoff);
    focusKind = "digest"; focus = "";
  }
  if (matching.length < 3) {
    await supabase.from("app_events").insert({
      event_type: "blog_published",
      message: "Market report skipped: fewer than 3 live vacancies",
      severity: "info",
      metadata: { mode: "market_report", vacancy_count: matching.length },
    });
    return { success: true, skipped: "not enough vacancies" };
  }

  const dateStr = fmtDate(now);
  const focusLabel = focusKind === "rank" ? focus : focusKind === "region" ? focus : "crew";
  let title: string;
  if (focusKind === "rank") title = `${focus} Jobs & Vacancies — ${matching.length} Live Openings (${dateStr})`;
  else if (focusKind === "region") title = `Seafarer Jobs ${focus} — ${matching.length} Live Maritime Vacancies (${dateStr})`;
  else title = `⚓ ${matching.length} New Seafarer Jobs Today — ${topRanks.slice(0, 3).map(([r]) => r).join(", ")} (${dateStr})`;

  let slug = slugify(title);
  const { data: clash } = await supabase.from("blog_posts").select("slug").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${now.getUTCHours() < 12 ? "am" : "pm"}`;

  // market indices
  let indices: any = null;
  try {
    const { data } = await supabase.rpc("get_market_indices");
    indices = data;
  } catch { /* optional */ }

  const idxRows: string[] = [];
  if (indices && typeof indices === "object") {
    const push = (label: string, val: any) => {
      if (val === null || val === undefined || val === "") return;
      idxRows.push(
        `<div style="flex:1;min-width:120px;padding:10px 12px"><div style="color:${MUTED};font-size:11px;letter-spacing:.08em;text-transform:uppercase">${esc(label)}</div><div style="color:${GOLD};font-size:22px;font-weight:700">${esc(val)}</div></div>`,
      );
    };
    push("Live jobs", indices.total_live ?? indices.live_jobs ?? indices.total_vacancies);
    push("Added 24h", indices.added_24h ?? indices.new_24h ?? indices.last_24h);
    push("Countries", indices.countries ?? indices.country_count);
    const depts = indices.departments || indices.by_department;
    if (Array.isArray(depts)) {
      for (const d of depts) {
        const avg = d.avg_salary ? ` · $${Number(d.avg_salary).toLocaleString("en-US")}` : "";
        push(String(d.department ?? d.name ?? "Dept"), `${d.count ?? d.jobs ?? 0}${avg}`);
      }
    } else if (depts && typeof depts === "object") {
      for (const [k, v] of Object.entries<any>(depts)) {
        const avg = v?.avg_salary ? ` · $${Number(v.avg_salary).toLocaleString("en-US")}` : "";
        push(k, `${typeof v === "object" ? (v.count ?? 0) : v}${avg}`);
      }
    }
  }
  const snapshot = idxRows.length
    ? `<div style="background:${NAVY};border:1px solid rgba(212,175,55,0.3);border-radius:14px;padding:8px;margin:18px 0"><div style="color:${GOLD};font-size:12px;letter-spacing:.12em;padding:6px 12px 0">MARKET SNAPSHOT</div><div style="display:flex;flex-wrap:wrap">${idxRows.join("")}</div></div>`
    : "";

  // intro via gpt-4o-mini
  const factLine = `Focus: ${focusKind === "digest" ? "general daily digest" : focusLabel}. Matching live vacancies: ${matching.length}. Top ranks hiring: ${topRanks.map(([r, n]) => `${r} (${n})`).join(", ")}. Regions: ${regions.map(([r, n]) => `${r} (${n})`).join(", ") || "n/a"}.`;
  let intro = `There are ${matching.length} live ${focusKind === "digest" ? "seafarer" : focusLabel} vacancies on SeaMinds today.`;
  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 220,
        messages: [{
          role: "user",
          content: `Write 2-3 sentences of plain English introducing a maritime job market update for seafarers and ship managers. Use ONLY these facts, invent nothing, no statistics beyond these numbers. Mention the focus and the real counts.\n\n${factLine}\n\nReturn only the paragraph text.`,
        }],
      }),
    });
    const j = await aiRes.json();
    const txt = j.choices?.[0]?.message?.content?.trim();
    if (txt) intro = txt;
  } catch { /* fallback intro */ }

  // vacancy list
  const list = matching.slice(0, 20);
  const groups: Record<string, string[]> = { DECK: [], ENGINE: [], CATERING: [], OFFSHORE: [] };
  for (const v of list) {
    const parts = [`${esc(v.rank_required)} — ${esc(v.vessel_type || "Vessel")}`];
    if (v.joining_port) parts.push(esc(v.joining_port));
    if (v.salary_text) parts.push(esc(v.salary_text));
    groups[departmentOf(v.rank_required)].push(
      `<li style="margin:6px 0"><a href="https://seaminds.life/feed" style="color:#E2E8F0;text-decoration:none">${parts.join(" · ")}</a></li>`,
    );
  }
  const vacancyHtml = Object.entries(groups)
    .filter(([, items]) => items.length)
    .map(([dept, items]) =>
      `<h3 style="color:${GOLD};font-size:14px;letter-spacing:.1em;margin:18px 0 6px">${dept}</h3><ul style="list-style:none;padding:0;margin:0">${items.join("")}</ul>`,
    ).join("");

  const content = `
${snapshot}
<p>${esc(intro)}</p>
<div style="background:${CARD};border-radius:14px;padding:16px 18px;margin:18px 0">
  <h2 style="color:${GOLD};margin:0 0 4px;font-size:18px">The Vacancies</h2>
  ${vacancyHtml}
</div>
<div style="background:${NAVY};border-radius:14px;padding:18px;margin:18px 0">
  <h2 style="color:${GOLD};margin:0 0 8px;font-size:18px">For Seafarers</h2>
  <p style="color:#E2E8F0;margin:0 0 14px">How to apply: ① Create your free Sea Profile (2 minutes, just taps) ② Get matched ③ Apply — and ship managers can find you directly.</p>
  <a href="https://seaminds.life/join" style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:700;padding:10px 18px;border-radius:12px;text-decoration:none">Create your free Sea Profile</a>
</div>
<div style="border:1px solid ${GOLD};border-radius:14px;padding:18px;margin:18px 0">
  <h2 style="color:${GOLD};margin:0 0 8px;font-size:18px">For Ship Managers &amp; Manning Agents</h2>
  <p style="margin:0 0 14px">Hiring ${esc(focusKind === "digest" ? "crew" : focusLabel)}? SeaMinds gives you Sea Profiles, AI competency interviews scored 0.00–5.00, and evidence-based shortlists. Post vacancies and search crew — free during the founding period.</p>
  <a href="https://seaminds.life/for-companies" style="color:${GOLD};font-weight:700;text-decoration:none">Hire crew with AI interviews →</a>
</div>
<h3>How do I apply for ${esc(focusKind === "digest" ? "seafarer" : focusLabel)} jobs?</h3>
<p>Create a free Sea Profile on SeaMinds, which records your rank, vessel experience and certificates. Every live vacancy on the SeaMinds feed can be applied to directly from your profile, and the contact details published by the company are shown where they are available. Ship managers using SeaMinds can also find and contact you without you applying first.</p>
<h3>How can companies hire ${esc(focusKind === "digest" ? "crew" : focusLabel)} crew?</h3>
<p>Ship managers and manning agents register on SeaMinds, post their vacancies, and search Sea Profiles by rank, vessel type and availability. Candidates can be invited to an AI competency interview that is scored from 0.00 to 5.00 across technical knowledge, judgment, maritime English and professional behaviour, so shortlists are based on assessed evidence rather than CV claims.</p>
<div style="border-top:1px solid rgba(212,175,55,0.3);margin-top:24px;padding-top:14px;color:${MUTED};font-size:14px">
  <a href="https://seaminds.life/feed" style="color:${GOLD};text-decoration:none">Browse all live vacancies</a> ·
  <a href="https://seaminds.life/join" style="color:${GOLD};text-decoration:none">Create your free Sea Profile</a> ·
  <a href="https://seaminds.life/for-companies" style="color:${GOLD};text-decoration:none">Hire crew with AI interviews</a> ·
  <a href="https://seaminds.life/manager" style="color:${GOLD};text-decoration:none">Post a vacancy</a> ·
  <a href="https://seaminds.life" style="color:${GOLD};text-decoration:none">SeaMinds Maritime Exchange</a>
</div>`.trim();

  const { error: insErr } = await supabase.from("blog_posts").insert({
    title,
    content,
    excerpt: intro.slice(0, 300),
    slug,
    language: "en",
    region: "global",
    published: true,
  });
  if (insErr) throw insErr;

  await supabase.from("app_events").insert({
    event_type: "blog_published",
    message: `Market report published: ${title}`,
    severity: "info",
    metadata: { mode: "market_report", focus: focusKind === "digest" ? "digest" : focus, vacancy_count: matching.length, slug },
  });

  return { success: true, mode: "market_report", title, slug, vacancies: matching.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const AGENT_SECRET = Deno.env.get("AGENT_SECRET");
  if (AGENT_SECRET) {
    const provided = req.headers.get("x-agent-secret") || new URL(req.url).searchParams.get("secret");
    if (provided !== AGENT_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let reqMode = "";
  try {
    if (req.method === "POST") {
      const b = await req.clone().json();
      reqMode = b?.mode || "";
    }
  } catch { /* no body */ }

  if (reqMode === "market_report") {
    try {
      const out = await marketReport();
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      await supabase.from("app_events").insert({
        event_type: "blog_published",
        message: `Market report FAILED: ${String(e).substring(0, 200)}`,
        severity: "error",
        metadata: { mode: "market_report" },
      });
      return new Response(JSON.stringify({ success: false, error: String(e) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }


  try {
    // Pick the first topic+language pair that has not been published yet
    const { data: existing } = await supabase.from("blog_posts").select("slug");
    const used = new Set((existing || []).map((r: any) => r.slug));

    let topic: string | null = null;
    let lang = LANGUAGES[0];
    outer:
    for (const t of TOPICS) {
      for (const L of LANGUAGES) {
        const candidate = L.code === "en" ? slugify(t) : `${slugify(t)}-${L.code}`;
        if (!used.has(candidate)) { topic = t; lang = L; break outer; }
      }
    }

    if (!topic) {
      return new Response(JSON.stringify({ success: true, skipped: "all topics used" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const slug = lang.code === "en" ? slugify(topic) : `${slugify(topic)}-${lang.code}`;

    // Write the article with GPT-4o-mini
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1800,
        messages: [{
          role: "user",
          content: `Write a helpful article for working seafarers titled "${topic}".

LANGUAGE: ${lang.note} The title, excerpt and the entire article body must be in ${lang.name}.

Rules:
- 700-900 words, written for seafarers whose first language may not be English. Use simple, clear sentences.
- Practical and specific. Reference real regulations (MLC 2006, STCW, SOLAS, MARPOL) where relevant and accurate.
- Structure with 4-6 short section headings using markdown ##.
- No fluff, no marketing, no invented statistics. If you are unsure of a fact, describe the general rule instead of inventing numbers.
- End with a short practical checklist of 3-5 bullet points.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "one sentence summary under 160 characters", "content": "the full article in markdown"}`,
        }],
      }),
    });

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // Fetch a maritime image (optional)
    let imageUrl: string | null = null;
    try {
      const key = Deno.env.get("UNSPLASH_ACCESS_KEY");
      if (key) {
        const imgRes = await fetch(
          `https://api.unsplash.com/photos/random?query=ship%20ocean%20maritime&orientation=landscape&client_id=${key}`,
        );
        const img = await imgRes.json();
        imageUrl = img?.urls?.regular || null;
      }
    } catch { /* image is optional */ }

    
    const { error: insErr } = await supabase.from("blog_posts").insert({
      title: parsed.title || topic,
      content: parsed.content,
      excerpt: parsed.excerpt || null,
      slug,
      image_url: imageUrl,
      language: lang.code,
      region: "global",
      published: true,
    });
    if (insErr) throw insErr;

    // Announce it on Telegram so it reaches people immediately
    const TG = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHANNEL = Deno.env.get("TELEGRAM_BLOG_CHANNEL")
      || Deno.env.get("TELEGRAM_CHANNEL")
      || "@seamindsjobs";
    if (TG) {
      try {
        await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: CHANNEL,
            parse_mode: "HTML",
            text: `⚓ <b>New Article</b>\n\n<b>${parsed.title || topic}</b>\n\n${parsed.excerpt || ""}\n\n#seafarer #maritime #seaminds #crewlife${lang.code !== "en" ? ` #${lang.name.toLowerCase()}` : ""}\n\n👉 ${Deno.env.get("SUPABASE_URL")}/functions/v1/share?type=blog&slug=${slug}`,
          }),
        });
      } catch { /* telegram is optional */ }
    }

    await supabase.from("app_events").insert({
      event_type: "blog_published",
      message: `Blog published: ${parsed.title || topic}`,
      severity: "info",
      emailed: true,
      metadata: { slug },
    });

    return new Response(JSON.stringify({ success: true, title: parsed.title, slug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("app_events").insert({
      event_type: "blog_published",
      message: `Blog writer FAILED: ${String(e).substring(0, 200)}`,
      severity: "error",
      emailed: true,
    });
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
