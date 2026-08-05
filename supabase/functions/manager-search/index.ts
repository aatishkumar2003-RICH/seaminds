import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const parseMaybeJson = (value: unknown) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action = "search", filters = {}, userId } = body ?? {};

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const unauth = () => json({ success: false, error: "Please sign in as a manager." }, 401);
    if (!token) return unauth();

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const authUser = userData?.user;
    if (userErr || !authUser) return unauth();

    const { data: manager } = await admin
      .from("manager_profiles")
      .select("company_name")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (!manager) return unauth();

    if (action === "verify") return json({ success: true, company: manager.company_name });

    if (action === "cv") {
      if (!userId) return json({ success: false, error: "Missing userId" }, 400);
      const { data: cv } = await admin
        .from("crew_cv_data")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      const { data: profile } = await admin
        .from("crew_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (!cv && !profile) return json({ success: false, error: "CV not found" }, 404);
      try {
        await admin.from("cv_access_log").insert({
          manager_user_id: authUser.id,
          company_name: manager.company_name,
          crew_user_id: userId,
          action: "cv_view",
        });
      } catch (_e) { /* logging must never block the CV */ }
      return json({ success: true, cv: cv ? { ...cv, medical: parseMaybeJson(cv.medical) } : null, profile });
    }


    // ---- search ----
    let query = admin
      .from("crew_profiles")
      .select(
        "id, first_name, last_name, rank, role, nationality, vessel_type, preferred_vessel_types, whatsapp_number, email, is_available, available_from, crew_unique_id, email_verified, whatsapp_verified, years_at_sea, created_at",
      )
      .limit(200);

    if (filters.rank) query = query.or(`rank.ilike.%${filters.rank}%,role.ilike.%${filters.rank}%`);
    if (filters.nationality) query = query.ilike("nationality", `%${filters.nationality}%`);
    if (filters.vesselType) query = query.ilike("vessel_type", `%${filters.vesselType}%`);
    if (filters.availability === "available") query = query.eq("is_available", true);

    const { data: profiles, error } = await query;
    if (error) throw error;

    const ids = (profiles || []).map((p: any) => p.id);
    let cvByUser: Record<string, any> = {};
    let smcByUser: Record<string, any> = {};

    if (ids.length) {
      const [{ data: cvs }, { data: smcs }] = await Promise.all([
        admin.from("crew_cv_data").select("user_id, medical, sea_service, updated_at").in("user_id", ids),
        admin
          .from("smc_assessments")
          .select("crew_profile_id, overall_score, score_band, status, completed_at")
          .in("crew_profile_id", ids),
      ]);
      (cvs || []).forEach((c: any) => (cvByUser[c.user_id] = { ...c, medical: parseMaybeJson(c.medical) }));
      (smcs || []).forEach((s: any) => {
        const prev = smcByUser[s.crew_profile_id];
        if (!prev || (s.overall_score || 0) > (prev.overall_score || 0)) smcByUser[s.crew_profile_id] = s;
      });
    }

    const results = (profiles || []).map((p: any) => {
      const cv = cvByUser[p.id];
      const personal = cv?.medical?.personal || {};
      const seaService = Array.isArray(parseMaybeJson(cv?.sea_service)) ? parseMaybeJson(cv?.sea_service) : [];
      const latest = (seaService as any[]).find((s) => s?.vesselName || s?.vessel_name);
      return {
        user_id: p.id,
        cv_uid: cv?.medical?.cv_uid || personal.cvUid || p.crew_unique_id || null,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || personal.name || "Unnamed crew",
        rank: p.rank || personal.rank || personal.applyingFor || p.role || "—",
        nationality: p.nationality || personal.nationality || "—",
        vessel_type: p.vessel_type || latest?.vesselType || latest?.vessel_type || (p.preferred_vessel_types || [])[0] || "—",
        whatsapp_number: p.whatsapp_number || personal.phone || personal.whatsapp || null,
        is_available: !!p.is_available,
        available_from: p.available_from || personal.availableFrom || null,
        years_at_sea: p.years_at_sea || null,
        email_verified: !!p.email_verified,
        whatsapp_verified: !!p.whatsapp_verified,
        smc_score: smcByUser[p.id]?.overall_score ?? null,
        smc_band: smcByUser[p.id]?.score_band ?? null,
        has_cv: !!cv,
      };
    });

    return json({ success: true, count: results.length, results });
  } catch (e) {
    console.error("manager-search error:", e);
    return json({ success: false, error: (e as Error).message || "Search failed" }, 500);
  }
});
