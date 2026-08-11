import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OWNER_UID = "492ee966-e015-4440-a415-6ad6275a4a9b";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password } = await req.json().catch(() => ({}));

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return json({ error: "A valid email address is required" }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user?.id !== OWNER_UID) {
      return json({ error: "Not authorised" }, 403);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const cleanEmail = email.trim().toLowerCase();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      return json({ error: createError?.message || "Could not create account" }, 400);
    }

    const { error: upsertError } = await admin
      .from("marketing_team")
      .upsert(
        { user_id: created.user.id, email: cleanEmail, active: true, added_by: OWNER_UID },
        { onConflict: "user_id" },
      );
    if (upsertError) return json({ error: upsertError.message }, 400);

    return json({ success: true, message: "Account created and added to marketing team: " + cleanEmail });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
