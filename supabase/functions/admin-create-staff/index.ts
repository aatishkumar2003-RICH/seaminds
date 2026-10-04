import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const ROLES = ["technical_manager","technical_superintendent","marine_superintendent","purchasing_officer","accounts_officer","crewing_officer","crewing_manager","ship_master","chief_engineer","vessel_owner","approval_admin"];
const MODULES = ["fleet","pms","inspections","qhse","permits","procurement","crewing","payroll","travel","cashbook","accounts","voyage","owner_reports","documents"];
const uuids = (a: unknown) => (Array.isArray(a) ? a.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : []);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: u.user.id });
    if (!isAdmin) return json({ error: "Not authorised" }, 403);

    const b = await req.json().catch(() => ({}));
    const code = String(b.staff_code || "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) return json({ error: "Staff ID: 3–20 letters, numbers or dashes" }, 400);
    if (typeof b.password !== "string" || b.password.length < 8) return json({ error: "Password must be 8+ characters" }, 400);
    if (!ROLES.includes(b.role)) return json({ error: "Pick a valid job" }, 400);
    const name = String(b.full_name || "").trim().slice(0, 100);
    if (!name) return json({ error: "Full name required" }, 400);
    const contact = String(b.contact_email || "").trim().toLowerCase().slice(0, 255) || null;
    const modules = (Array.isArray(b.modules) ? b.modules : []).filter((m: string) => MODULES.includes(m));
    const limit = Math.max(0, Math.min(999999999, Number(b.approval_limit_usd) || 0));

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const loginEmail = `${code.toLowerCase()}@staff.seaminds.life`;
    const { data: created, error: ce } = await admin.auth.admin.createUser({
      email: loginEmail, password: b.password, email_confirm: true,
      user_metadata: { full_name: name, staff_code: code },
    });
    if (ce || !created?.user) return json({ error: ce?.message?.includes("already") ? "That Staff ID is taken" : ce?.message || "Could not create" }, 400);

    const { error: ie } = await admin.from("fleet_staff_members").insert({
      user_id: created.user.id, email: loginEmail, contact_email: contact, full_name: name,
      company: String(b.company || "").trim().slice(0, 100) || null,
      staff_code: code, requested_role: b.role, approved_role: b.role,
      department: String(b.department || "").slice(0, 50) || null,
      approval_limit_usd: limit, modules, cell_ids: uuids(b.cell_ids), vessel_ids: uuids(b.vessel_ids),
      can_approve_salaries: !!b.can_approve_salaries, can_approve_travel: !!b.can_approve_travel,
      can_approve_permits: !!b.can_approve_permits, can_approve_staff: !!b.can_approve_staff,
      status: "approved", approved_by: u.user.id, approved_at: new Date().toISOString(), provisioned_by_admin: true,
    });
    if (ie) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: ie.message }, 400); }
    return json({ success: true, staff_code: code });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
