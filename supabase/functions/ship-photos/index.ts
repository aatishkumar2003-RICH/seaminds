import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const QUERIES = [
  { q: "container ship", caption: "Container giant on passage" },
  { q: "cargo ship sea", caption: "Cargo vessel at sea" },
  { q: "oil tanker ship", caption: "Tanker under way" },
  { q: "bulk carrier ship", caption: "Bulk carrier loaded and outbound" },
  { q: "ship port crane", caption: "Alongside — cargo operations" },
  { q: "ship storm waves", caption: "Heavy weather on the bridge watch" },
  { q: "ship engine room", caption: "Engine room, watch in progress" },
  { q: "ship bridge navigation", caption: "Bridge watch at night" },
];

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

  const key = Deno.env.get("UNSPLASH_ACCESS_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no unsplash key" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

  let added = 0;
  for (const item of QUERIES) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(item.q)}&orientation=landscape&per_page=5&client_id=${key}`,
      );
      const data = await res.json();
      for (const p of (data.results || []).slice(0, 3)) {
        const url = p?.urls?.regular;
        if (!url) continue;
        const { data: exists } = await supabase.from("ship_photos").select("id").eq("photo_url", url).maybeSingle();
        if (exists) continue;
        await supabase.from("ship_photos").insert({
          photo_url: url,
          caption: item.caption,
          credit: p?.user?.name || null,
          query: item.q,
        });
        added++;
      }
    } catch { /* skip this query */ }
    await new Promise((r) => setTimeout(r, 400));
  }

  return new Response(JSON.stringify({ success: true, added }), { headers: { ...cors, "Content-Type": "application/json" } });
});
