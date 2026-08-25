import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE = "https://seaminds.life";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

async function alreadyEmailed(applicationId: string) {
  const { data } = await svc.from("app_events").select("id")
    .eq("event_type", "application_email")
    .filter("metadata->>application_id", "eq", applicationId).limit(1);
  return !!(data && data.length);
}

async function overDailyLimit(recipient: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await svc.from("app_events").select("id")
    .eq("event_type", "application_email")
    .filter("metadata->>recipient", "eq", recipient)
    .gte("created_at", since).limit(6);
  return (data?.length || 0) >= 5;
}

async function sendMail(to: string, subject: string, html: string, applicationId: string) {
  if (!RESEND_KEY) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "SeaMinds <crew@seaminds.life>", to: [to], subject, html }),
  });
  const ok = r.ok;
  await svc.from("app_events").insert({
    event_type: "application_email",
    message: ok ? "Application notification sent" : "Application notification failed",
    severity: ok ? "info" : "warning",
    metadata: { application_id: applicationId, recipient: to, ok },
  });
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ ok: false, error: "unauthorized" });
    const { data: userRes } = await svc.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return json({ ok: false, error: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const applicationId = String(body?.application_id || "");
    if (!applicationId) return json({ ok: false, error: "missing_application_id" });

    const { data: app } = await svc.from("job_applications")
      .select("id, crew_id, vacancy_id, job_posting_id, rank_applied, vessel_type, company_name")
      .eq("id", applicationId).maybeSingle();
    if (!app || app.crew_id !== user.id) return json({ ok: false, error: "not_found" });

    if (await alreadyEmailed(applicationId)) return json({ ok: true, skipped: "already_emailed" });

    const { data: crew } = await svc.from("crew_profiles")
      .select("first_name, last_name, rank, role, nationality, years_in_rank_band, public_card_token")
      .eq("id", app.crew_id).maybeSingle();

    const name = `${crew?.first_name || "A seafarer"} ${(crew?.last_name || "").slice(0, 1)}`.trim();
    const rank = app.rank_applied || crew?.rank || crew?.role || "Crew";
    const teaser = `<p><strong>${esc(name)}</strong> — ${esc(crew?.rank || crew?.role || rank)}${
      crew?.nationality ? `, ${esc(crew.nationality)}` : ""
    }${crew?.years_in_rank_band ? ` · ${esc(crew.years_in_rank_band)} in rank` : ""}</p>`;
    const profileLink = crew?.public_card_token
      ? `<p><a href="${SITE}/crew/${crew.public_card_token}">View the candidate's Sea Profile</a></p>`
      : "";

    let recipient = "";
    let subject = "";
    let html = "";

    if (app.job_posting_id) {
      const { data: jp } = await svc.from("job_postings")
        .select("manager_id, rank_required, vessel_type").eq("id", app.job_posting_id).maybeSingle();
      if (!jp?.manager_id) return json({ ok: true, skipped: "no_manager" });
      const { data: mgr } = await svc.auth.admin.getUserById(jp.manager_id);
      recipient = mgr?.user?.email || "";
      if (!recipient) return json({ ok: true, skipped: "no_email" });
      subject = `New applicant via SeaMinds — ${jp.rank_required || rank}`;
      html = `<div style="font-family:Arial,sans-serif;color:#0D1B2A">
        <h2>New applicant via SeaMinds</h2>
        <p>${esc(jp.rank_required || rank)}${jp.vessel_type ? ` — ${esc(jp.vessel_type)}` : ""}</p>
        ${teaser}${profileLink}
        <p><a href="${SITE}/manager/dashboard?tab=applicants">Open your Applicants</a></p>
      </div>`;
    } else if (app.vacancy_id) {
      const { data: ev } = await svc.from("external_vacancies")
        .select("contact_email, rank_required, title, vessel_type, joining_port")
        .eq("id", app.vacancy_id).maybeSingle();
      recipient = ev?.contact_email || "";
      if (!recipient) return json({ ok: true, skipped: "no_contact_email" });
      const pos = ev?.rank_required || ev?.title || rank;
      subject = `A seafarer applied to your ${pos} vacancy via SeaMinds`;
      html = `<div style="font-family:Arial,sans-serif;color:#0D1B2A">
        <h2>A seafarer applied via SeaMinds</h2>
        <p>Position: ${esc(pos)}${ev?.vessel_type ? ` — ${esc(ev.vessel_type)}` : ""}${ev?.joining_port ? `, ${esc(ev.joining_port)}` : ""}</p>
        ${teaser}${profileLink}
        <p><a href="${SITE}/for-companies">Register your company free to view full profiles and receive applicants</a></p>
      </div>`;
    } else {
      return json({ ok: true, skipped: "no_target" });
    }

    if (await overDailyLimit(recipient)) return json({ ok: true, skipped: "rate_limited" });

    const sent = await sendMail(recipient, subject, html, applicationId);
    return json({ ok: true, sent });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "error" });
  }
});
