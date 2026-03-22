import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TITLE_QUERIES: [RegExp, string][] = [
  [/hormuz|red sea|warlike/i, "container ship ocean night dramatic"],
  [/mental|depress|lonely|fatigue/i, "person alone ocean contemplative"],
  [/sire|inspect|tanker|psc/i, "industrial ship port inspection"],
  [/wage|salary|pay/i, "professional finance office work"],
  [/piracy|guinea/i, "naval security ocean patrol"],
  [/abandon|repatriat/i, "cargo ship port harbor"],
  [/lng|green|ammonia|fuel/i, "sustainable industrial energy ship"],
  [/stcw|certificate|training/i, "professional maritime training education"],
  [/master|captain|career/i, "ship captain bridge professional"],
  [/fire|emergency|safety/i, "industrial safety rescue"],
  [/recruit|illegal|fraud/i, "contract signing professional business"],
];

function queryForTitle(title: string): string {
  for (const [re, q] of TITLE_QUERIES) {
    if (re.test(title)) return q;
  }
  return "cargo ship ocean maritime professional";
}

async function fetchUnsplashUrl(query: string, accessKey: string): Promise<string | null> {
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${accessKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Unsplash error", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data?.urls?.regular || null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
  if (!unsplashKey) {
    return new Response(JSON.stringify({ error: "UNSPLASH_ACCESS_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: posts, error } = await supabase
    .from("blog_posts")
    .select("id, title, image_url")
    .eq("published", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const post of posts || []) {
    const query = queryForTitle(post.title);
    const imageUrl = await fetchUnsplashUrl(query, unsplashKey);

    if (imageUrl) {
      const { error: updateErr } = await supabase
        .from("blog_posts")
        .update({ image_url: imageUrl })
        .eq("id", post.id);

      if (updateErr) {
        errors.push(`${post.id}: ${updateErr.message}`);
      } else {
        updated++;
      }
    } else {
      errors.push(`${post.id}: no Unsplash result`);
    }

    await sleep(1200);
  }

  return new Response(
    JSON.stringify({ total: (posts || []).length, updated, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
