import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    // Get existing record
    const { data: existing } = await supabase
      .from("auth_rate_limits")
      .select("*")
      .eq("ip_address", ip)
      .single();

    if (existing) {
      // If window expired, reset
      if (new Date(existing.window_start) < new Date(windowStart)) {
        await supabase
          .from("auth_rate_limits")
          .update({
            attempt_count: 1,
            window_start: new Date().toISOString(),
            last_attempt: new Date().toISOString(),
          })
          .eq("ip_address", ip);

        return new Response(
          JSON.stringify({ allowed: true, remaining: MAX_ATTEMPTS - 1 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Window still active
      if (existing.attempt_count >= MAX_ATTEMPTS) {
        const retryAfter = Math.ceil(
          (new Date(existing.window_start).getTime() + WINDOW_MINUTES * 60 * 1000 - Date.now()) / 1000
        );
        return new Response(
          JSON.stringify({
            allowed: false,
            error: `Too many login attempts. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
            retry_after_seconds: retryAfter,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Increment
      await supabase
        .from("auth_rate_limits")
        .update({
          attempt_count: existing.attempt_count + 1,
          last_attempt: new Date().toISOString(),
        })
        .eq("ip_address", ip);

      return new Response(
        JSON.stringify({ allowed: true, remaining: MAX_ATTEMPTS - existing.attempt_count - 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First attempt - insert
    await supabase.from("auth_rate_limits").insert({
      ip_address: ip,
      attempt_count: 1,
      window_start: new Date().toISOString(),
      last_attempt: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ allowed: true, remaining: MAX_ATTEMPTS - 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Rate limit check error:", error);
    // Fail open - allow the attempt if rate limiting itself fails
    return new Response(
      JSON.stringify({ allowed: true, remaining: MAX_ATTEMPTS }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
