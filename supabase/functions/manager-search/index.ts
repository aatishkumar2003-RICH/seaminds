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

// ---- contact masking (contacts are released only via reveal_contact credits) ----
const maskEmail = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.includes("@")) return null;
  const [local, domain] = value.split("@");
  if (!local || !domain) return null;
  return `${local[0]}•••••@${domain}`;
};

const maskPhone = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const plus = value.trim().startsWith("+");
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 4) return "••• •••";
  const cc = digits.slice(0, Math.min(3, Math.max(1, digits.length - 3)));
  const last = digits.slice(-3);
  return `${plus ? "+" : ""}${cc} ••• ••• ${last}`;
};

const maskProfileContacts = (profile: any) => {
  if (!profile || typeof profile !== "object") return profile;
  return {
    ...profile,
    email: maskEmail(profile.email),
    whatsapp_number: maskPhone(profile.whatsapp_number),
    manning_agent_phone: maskPhone(profile.manning_agent_phone),
  };
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action = "search", filters = {}, userId } = body ?? {};
    const page = Math.max(0, Number(body?.page) || 0);
    const pageSize = Math.min(50, Math.max(1, Number(body?.pageSize) || 50));

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const unauth = () => json({ success: false, error: "Please sign in as a manager." }, 401);
    if (!token) return unauth();

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const authUser = userData?.user;
    if (userErr || !authUser) return unauth();

    const OWNER_EMAILS = ["atish@seaminds.life"];
    const isOwner = OWNER_EMAILS.includes(String(authUser.email || "").trim().toLowerCase())
      || authUser.id === "492ee966-e015-4440-a415-6ad6275a4a9b";

    // Private preview: Crew Search is locked to the owner account until the owner opens it.
    if (!isOwner) {
      return json({ success: false, pending_approval: true, error: "Crew Search is currently in private preview with select partner fleets. Request early access at admin@seaminds.life." }, 403);
    }

    const { data: managerRow } = await admin
      .from("manager_profiles")
      .select("company_name, admin_approved, company_verified")
      .eq("user_id", authUser.id)
      .maybeSingle();
    const manager = managerRow ?? (isOwner ? { company_name: "SeaMinds", admin_approved: true, company_verified: true } : null);
    if (!manager) return unauth();

    // Seafarer contact details and CVs are only released to approved companies.
    if (manager.admin_approved !== true && !isOwner) {
      return json({
        success: false,
        pending_approval: true,
        error: "Your company account is awaiting approval. SeaMinds verifies every company before releasing seafarer details. Contact the SeaMinds admin team at admin@seaminds.life to request access.",
      }, 403);
    }

    if (action === "verify") {
      return json({ success: true, company: manager.company_name, verified: manager.company_verified === true });
    }

    if (action === "cv") {
      if (!userId) return json({ success: false, error: "Missing userId" }, 400);

      // Full CV is behind the contact-reveal credit wall (admin bypasses).
      const ADMIN_UID = "492ee966-e015-4440-a415-6ad6275a4a9b";
      if (!isOwner) {
        const { data: reveal } = await admin
          .from("contact_reveals")
          .select("id")
          .eq("manager_user_id", authUser.id)
          .eq("crew_id", userId)
          .maybeSingle();
        if (!reveal) {
          return json({
            success: false,
            error: "reveal_required",
            message: "Reveal this seafarer's contact first (1 credit) to open the full CV.",
          }, 402);
        }
      }
      const { data: cv } = await admin
        .from("crew_cv_data")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      const { data: profile } = await admin
        .from("crew_profiles")
        .select("*")
        .eq("id", userId)
        .eq("is_test", false)
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
      return json({ success: true, cv: cv ? { ...cv, medical: parseMaybeJson(cv.medical) } : null, profile: maskProfileContacts(profile) });
    }


    // ---- search ----
    const ADMIN_UID_SEARCH = "492ee966-e015-4440-a415-6ad6275a4a9b";
    let query = admin
      .from("crew_profiles")
      .select(
        "id, first_name, last_name, rank, role, nationality, vessel_type, preferred_vessel_types, whatsapp_number, email, is_available, available_from, crew_unique_id, email_verified, whatsapp_verified, years_at_sea, created_at, years_in_rank_band, contracts_in_rank_band, total_sea_service_band, quick_profile_completed_at, placed_until, placed_company",
        { count: "exact" },
      )
      .eq("is_test", false);

    // Placed crew are protected during their contract: only the placing company
    // (or the admin) may see them, regardless of the availability filter.
    if (!isOwner) {
      const today = new Date().toISOString().slice(0, 10);
      const myCompany = String(manager.company_name || "").trim().toLowerCase();
      const { data: placedRows } = await admin
        .from("crew_profiles")
        .select("id, placed_company")
        .eq("is_test", false)
        .gte("placed_until", today)
        .limit(5000);
      const hidden = (placedRows || [])
        .filter((r: any) => String(r.placed_company || "").trim().toLowerCase() !== myCompany || !myCompany)
        .map((r: any) => r.id);
      if (hidden.length) query = query.not("id", "in", `(${hidden.join(",")})`);
    }


    // "My Unlocked Candidates": only crew this manager already paid to reveal (never charged again).
    const isRoster = action === "unlocked";
    if (isRoster) {
      const { data: rv } = await admin.from("contact_reveals").select("crew_id")
        .eq("manager_user_id", authUser.id).limit(5000);
      const rids = (rv || []).map((r: any) => r.crew_id).filter(Boolean);
      query = query.in("id", rids.length ? rids : ["00000000-0000-0000-0000-000000000000"]);
    }

    if (filters.rank) query = query.or(`rank.ilike.%${filters.rank}%,role.ilike.%${filters.rank}%`);
    if (filters.nationality) query = query.ilike("nationality", `%${filters.nationality}%`);

    if (filters.vesselType) {
      const term = String(filters.vesselType).trim();
      const t = term.toLowerCase();
      // Map the manager's wording onto the quick-profile vessel_family vocabulary
      const families: string[] = [];
      if (t.includes("lng")) families.push("LNG");
      if (t.includes("lpg") || t.includes("gas")) families.push("LPG");
      if (t.includes("tanker") || t.includes("oil") || t.includes("chemical")) families.push("TANKER");
      if (t.includes("bulk")) families.push("BULK");
      if (t.includes("container")) families.push("CONTAINER");
      if (t.includes("offshore") || t.includes("osv") || t.includes("psv")) families.push("PSV_OSV");
      if (t.includes("ahts")) families.push("AHTS");
      if (t.includes("ro-ro") || t.includes("roro")) families.push("RORO");
      const patterns = families.length ? families.map((f) => `%${f}%`) : [`%${term.replace(/[\s/-]+/g, "_")}%`, `%${term}%`];

      const expIds = new Set<string>();
      for (const pat of patterns) {
        const { data: exp } = await admin
          .from("crew_vessel_experience")
          .select("crew_id")
          .ilike("vessel_family", pat)
          .limit(2000);
        (exp || []).forEach((e: any) => e?.crew_id && expIds.add(e.crew_id));
      }

      const orParts = [`vessel_type.ilike.%${term}%`];
      if (expIds.size) orParts.push(`id.in.(${[...expIds].join(",")})`);
      query = query.or(orParts.join(","));
    }

    // Appraisal filters: minimum competency score (0-5) and Maritime English readiness (recent practice average).
    const minScore = Number(filters.minScore) || 0;
    if (minScore > 0) {
      const { data: rows } = await admin.from("smc_assessments").select("crew_profile_id")
        .eq("status", "completed").gte("overall_score", minScore).limit(5000);
      const sids = [...new Set((rows || []).map((r: any) => r.crew_profile_id).filter(Boolean))];
      query = sids.length ? query.in("id", sids) : query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    }
    const minEnglish = Number(filters.minEnglish) || 0;
    if (minEnglish > 0) {
      const { data: rows } = await admin.from("english_attempts").select("user_id, score")
        .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(20000);
      const per: Record<string, number[]> = {};
      (rows || []).forEach((r: any) => { const a = (per[r.user_id] ||= []); if (a.length < 10) a.push(r.score); });
      const eids = Object.entries(per).filter(([, a]) => a.length >= 3 && a.reduce((n, x) => n + x, 0) / a.length >= minEnglish).map(([u]) => u);
      query = eids.length ? query.in("id", eids) : query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    }

    // Availability defaults to available-only unless the manager asks for "all"
    if (!isRoster && (filters.availability === undefined || filters.availability === null || filters.availability === "" || filters.availability === "available")) {
      query = query.eq("is_available", true);
    }

    query = query
      .order("is_available", { ascending: false })
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    const { data: profiles, error, count: total } = await query;
    if (error) throw error;

    const ids = (profiles || []).map((p: any) => p.id);
    let cvByUser: Record<string, any> = {};
    let smcByUser: Record<string, any> = {};
    const engByUser: Record<string, number> = {};

    if (ids.length) {
      const [{ data: cvs }, { data: smcs }] = await Promise.all([
        admin.from("crew_cv_data").select("user_id, medical, sea_service, updated_at").in("user_id", ids),
        admin
          .from("smc_assessments")
          .select("crew_profile_id, overall_score, score_band, status, completed_at")
          .in("crew_profile_id", ids),
      ]);
      const { data: eng } = await admin.from("english_attempts").select("user_id, score").in("user_id", ids)
        .order("created_at", { ascending: false }).limit(ids.length * 10);
      const tmp: Record<string, number[]> = {};
      (eng || []).forEach((r: any) => { const a = (tmp[r.user_id] ||= []); if (a.length < 10) a.push(r.score); });
      Object.entries(tmp).forEach(([u, a]) => { if (a.length >= 3) engByUser[u] = Math.round(a.reduce((n, x) => n + x, 0) / a.length); });
      (cvs || []).forEach((c: any) => (cvByUser[c.user_id] = { ...c, medical: parseMaybeJson(c.medical) }));
      (smcs || []).forEach((s: any) => {
        const prev = smcByUser[s.crew_profile_id];
        const t = (x: any) => new Date(x?.completed_at || 0).getTime();
        if (!prev || t(s) > t(prev)) smcByUser[s.crew_profile_id] = s;
      });
    }

    // Pipeline transparency: count of companies actively engaging each crew (names never returned).
    const talks: Record<string, number> = {};
    const offers: Record<string, boolean> = {};
    const pausedBy: Record<string, boolean> = {};
    if (ids.length) {
      const [{ data: apps }, { data: pz }] = await Promise.all([
        admin.from("job_applications").select("crew_id, outcome").in("crew_id", ids)
          .in("outcome", ["shortlisted", "offered", "accepted"]).limit(5000),
        admin.from("crew_profiles").select("id, inquiries_paused").in("id", ids),
      ]);
      (apps || []).forEach((a: any) => {
        talks[a.crew_id] = (talks[a.crew_id] || 0) + 1;
        if (a.outcome === "offered" || a.outcome === "accepted") offers[a.crew_id] = true;
      });
      (pz || []).forEach((r: any) => (pausedBy[r.id] = !!r.inquiries_paused));
    }

    // Paid crew priority boosts (crew_boosts) float to the top, rotating every 3 hours for fairness.
    const boosted: Record<string, boolean> = {};
    if (ids.length) {
      const { data: bz } = await admin.from("crew_boosts").select("crew_id")
        .in("crew_id", ids).gt("boosted_until", new Date().toISOString());
      (bz || []).forEach((b: any) => (boosted[b.crew_id] = true));
    }
    const unlocked: Record<string, boolean> = {};
    if (ids.length) {
      const { data: mine } = await admin.from("contact_reveals").select("crew_id")
        .eq("manager_user_id", authUser.id).in("crew_id", ids);
      (mine || []).forEach((m: any) => (unlocked[m.crew_id] = true));
    }
    const slot = Math.floor(Date.now() / (3 * 3600000));
    const rot = (id: string) => { let h = slot; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };

    const results = (profiles || []).map((p: any) => {
      const cv = cvByUser[p.id];
      const personal = cv?.medical?.personal || {};
      const seaService = Array.isArray(parseMaybeJson(cv?.sea_service)) ? parseMaybeJson(cv?.sea_service) : [];
      const latest = (seaService as any[]).find((s) => s?.vesselName || s?.vessel_name);
      return {
        user_id: p.id,
        crewId: p.id,
        cv_uid: cv?.medical?.cv_uid || personal.cvUid || p.crew_unique_id || null,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || personal.name || "Unnamed crew",
        rank: p.rank || personal.rank || personal.applyingFor || p.role || "—",
        nationality: p.nationality || personal.nationality || "—",
        vessel_type: p.vessel_type || latest?.vesselType || latest?.vessel_type || (p.preferred_vessel_types || [])[0] || "—",
        whatsapp_number: (unlocked[p.id] || isOwner) ? (p.whatsapp_number || personal.phone || personal.whatsapp || null) : maskPhone(p.whatsapp_number || personal.phone || personal.whatsapp || null),
        email: (unlocked[p.id] || isOwner) ? (p.email || personal.email || null) : maskEmail(p.email || personal.email || null),
        is_unlocked: !!unlocked[p.id] || isOwner,
        placed_until: p.placed_until || null,
        priority_boost: !!boosted[p.id],
        is_available: !!p.is_available,
        available_from: p.available_from || personal.availableFrom || null,
        years_at_sea: p.years_at_sea || null,
        email_verified: !!p.email_verified,
        whatsapp_verified: !!p.whatsapp_verified,
        smc_score: smcByUser[p.id]?.overall_score ?? null,
        smc_band: smcByUser[p.id]?.score_band ?? null,
        has_cv: !!cv,
        years_in_rank_band: p.years_in_rank_band ?? null,
        contracts_in_rank_band: p.contracts_in_rank_band ?? null,
        total_sea_service_band: p.total_sea_service_band ?? null,
        quick_profile_done: !!p.quick_profile_completed_at,
        english_avg: engByUser[p.id] ?? null,
        active_talks: talks[p.id] || 0,
        pipeline_status: pausedBy[p.id] ? "paused" : offers[p.id] ? "offer_pending" : (talks[p.id] || 0) >= 4 ? "high_demand" : (talks[p.id] || 0) > 0 ? "in_talks" : "open",
      };
    });
    results.sort((a: any, b: any) => (b.priority_boost ? 1 : 0) - (a.priority_boost ? 1 : 0)
      || (a.priority_boost && b.priority_boost ? rot(a.user_id) - rot(b.user_id) : 0));

    return json({ success: true, count: results.length, total: total ?? results.length, results });
  } catch (e) {
    console.error("manager-search error:", e);
    return json({ success: false, error: (e as Error).message || "Search failed" }, 500);
  }
});
