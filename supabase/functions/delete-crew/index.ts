import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_UID = "492ee966-e015-4440-a415-6ad6275a4a9b";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // Only the platform owner may delete crew.
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token) return json({ success: false, error: "Not signed in." }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user || userData.user.id !== OWNER_UID) {
      return json({ success: false, error: "Not authorised." }, 403);
    }

    const { crewId } = await req.json().catch(() => ({}));
    if (!crewId) return json({ success: false, error: "Missing crewId" }, 400);

    // 1. Preserve the contact before anything is removed
    const { data: profile } = await admin
      .from("crew_profiles")
      .select("first_name, last_name, nationality, whatsapp_number, role, vessel_type, email_verified, whatsapp_verified")
      .eq("id", crewId)
      .maybeSingle();

    const { data: authUser } = await admin.auth.admin.getUserById(crewId);
    const email = authUser?.user?.email || null;

    if (email) {
      await admin.from("email_leads").upsert({
        email,
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        nationality: profile?.nationality || null,
        whatsapp_number: profile?.whatsapp_number || null,
        role: profile?.role || null,
        vessel_type: profile?.vessel_type || null,
        source: "retained_deleted_cv",
        email_verified: !!profile?.email_verified,
        phone_verified: !!profile?.whatsapp_verified,
        retained_from_deleted_cv: true,
        last_seen: new Date().toISOString(),
      }, { onConflict: "email" });
    }

    // 2. Remove stored files
    for (const bucket of ["crew-cvs", "crew-documents", "smc-documents"]) {
      try {
        const { data: files } = await admin.storage.from(bucket).list(crewId, { limit: 100 });
        const paths = (files || []).map((f: any) => `${crewId}/${f.name}`);
        if (paths.length) await admin.storage.from(bucket).remove(paths);
      } catch { /* continue */ }
    }

    // 3. Remove crew data
    const removed: Record<string, boolean> = {};
    for (const [table, col] of [
      ["crew_cv_data", "user_id"],
      ["crew_documents", "crew_profile_id"],
      ["chat_messages", "crew_profile_id"],
      ["wellness_streaks", "crew_profile_id"],
      ["rest_hours_data", "crew_profile_id"],
      ["smc_assessments", "crew_profile_id"],
      ["crew_availability", "crew_profile_id"],
      ["family_connections", "crew_profile_id"],
      ["notifications", "crew_id"],
      ["feed_interactions", "crew_id"],
      ["quiz_answers", "crew_id"],
      ["cv_access_log", "crew_user_id"],
    ] as [string, string][]) {
      try {
        await admin.from(table).delete().eq(col, crewId);
        removed[table] = true;
      } catch { removed[table] = false; }
    }

    await admin.from("crew_profiles").delete().eq("id", crewId);

    // 4. Remove the login account last
    try { await admin.auth.admin.deleteUser(crewId); } catch { /* may already be gone */ }

    await admin.from("app_events").insert({
      event_type: "crew_deleted",
      message: `Crew record deleted${email ? ` (${email} kept in registry)` : ""}`,
      severity: "warning",
      emailed: true,
      metadata: { crewId, email, removed },
    });

    return json({ success: true, contactPreserved: !!email, email });
  } catch (e) {
    return json({ success: false, error: String(e) }, 200);
  }
});
