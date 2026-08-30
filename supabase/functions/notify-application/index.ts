import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE = "https://seaminds.life";

/** Authoritative admin check — reuses the project's public.is_admin(uuid) security-definer function. */
async function isAdmin(uid: string) {
  try {
    const { data, error } = await svc.rpc("is_admin", { _user_id: uid });
    return !error && data === true;
  } catch {
    return false;
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

const card = (inner: string) => `<div style="background:#0D1B2A;border-radius:14px;padding:24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;line-height:1.6">${inner}
  <p style="color:#94A3B8;font-size:12px;margin-top:22px">Sent via SeaMinds — seaminds.life · free crew platform, no agent fees</p>
</div>`;

const goldBtn = (href: string, label: string) =>
  `<p><a href="${href}" style="background:#D4AF37;color:#0D1B2A;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${label}</a></p>`;

/** Rough plain-text alternative built from the HTML body. */
const toText = (html: string) =>
  html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2: $1")
    .replace(/<\/(p|div|h2|h3|li|ol|ul)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

type Role = "manager" | "crew";

interface Attempt {
  kind: string;
  recipient: string;
  role: Role;
  sent: boolean;
  skipped?: string;
  error?: string;
}

// ---------------------------------------------------------------- audit log

async function logAttempt(row: {
  applicationId: string; kind: string; recipient: string; role: Role;
  ok: boolean; manual: boolean; providerId?: string | null; error?: string | null; skipped?: string | null;
}) {
  try {
    await svc.from("app_events").insert({
      event_type: "application_email",
      message: row.ok
        ? `Application email sent (${row.kind})`
        : `Application email ${row.skipped ? "skipped" : "failed"} (${row.kind})`,
      severity: row.ok ? "info" : row.skipped ? "info" : "warning",
      metadata: {
        application_id: row.applicationId,
        kind: row.kind,
        recipient: row.recipient,
        recipient_role: row.role,
        ok: row.ok,
        manual: row.manual,
        provider_id: row.providerId ?? null,
        error: row.error ? String(row.error).slice(0, 300) : null,
        skipped: row.skipped ?? null,
        attempted_at: new Date().toISOString(),
      },
    });
  } catch (_e) { /* logging must never break the flow */ }
}

/** True only when a provider-accepted delivery of this exact event to this exact recipient exists. */
async function alreadyDelivered(applicationId: string, kind: string, recipient: string) {
  const { data } = await svc.from("app_events").select("id")
    .eq("event_type", "application_email")
    .filter("metadata->>application_id", "eq", applicationId)
    .filter("metadata->>kind", "eq", kind)
    .filter("metadata->>recipient", "eq", recipient)
    .filter("metadata->>ok", "eq", "true")
    .limit(1);
  return !!(data && data.length);
}

/** Manual resends: max 3 per application+event+recipient per hour. */
async function resendBlocked(applicationId: string, kind: string, recipient: string) {
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const { data } = await svc.from("app_events").select("id")
    .eq("event_type", "application_email")
    .filter("metadata->>application_id", "eq", applicationId)
    .filter("metadata->>kind", "eq", kind)
    .filter("metadata->>recipient", "eq", recipient)
    .filter("metadata->>manual", "eq", "true")
    .gte("created_at", since).limit(4);
  return (data?.length || 0) >= 3;
}

/** Only the high-volume manager new-application alert is capped per recipient. */
async function overNewApplicationLimit(recipient: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await svc.from("app_events").select("id")
    .eq("event_type", "application_email")
    .filter("metadata->>kind", "eq", "application")
    .filter("metadata->>recipient", "eq", recipient)
    .filter("metadata->>ok", "eq", "true")
    .gte("created_at", since).limit(51);
  return (data?.length || 0) >= 50;
}

// ---------------------------------------------------------------- sending

async function deliver(opts: {
  applicationId: string; kind: string; recipient: string; role: Role;
  subject: string; html: string; manual: boolean; capped?: boolean;
}): Promise<Attempt> {
  const { applicationId, kind, recipient, role, subject, html, manual } = opts;
  const base = { kind, recipient, role };

  if (!recipient) return { ...base, sent: false, skipped: "no_email" };

  if (!manual && await alreadyDelivered(applicationId, kind, recipient)) {
    return { ...base, sent: false, skipped: "already_sent" };
  }
  if (manual && await resendBlocked(applicationId, kind, recipient)) {
    await logAttempt({ applicationId, kind, recipient, role, ok: false, manual, skipped: "resend_rate_limited" });
    return { ...base, sent: false, skipped: "resend_rate_limited" };
  }
  if (opts.capped && await overNewApplicationLimit(recipient)) {
    await logAttempt({ applicationId, kind, recipient, role, ok: false, manual, skipped: "rate_limited" });
    return { ...base, sent: false, skipped: "rate_limited" };
  }
  if (!RESEND_KEY) {
    await logAttempt({ applicationId, kind, recipient, role, ok: false, manual, skipped: "no_provider_key" });
    return { ...base, sent: false, skipped: "no_provider_key" };
  }

  let ok = false;
  let providerId: string | null = null;
  let error: string | null = null;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SeaMinds <crew@seaminds.life>",
        to: [recipient],
        subject,
        html,
        text: toText(html),
      }),
    });
    const body = await r.json().catch(() => ({}));
    ok = r.ok;
    providerId = (body as any)?.id ?? null;
    if (!ok) error = `[${r.status}] ${String((body as any)?.message || (body as any)?.error || "").slice(0, 200)}`;
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message.slice(0, 200) : "network_error";
  }

  await logAttempt({ applicationId, kind, recipient, role, ok, manual, providerId, error });
  return { ...base, sent: ok, error: ok ? undefined : error || "send_failed" };
}

// ---------------------------------------------------------------- lookups

async function emailOf(userId?: string | null) {
  if (!userId) return "";
  const { data } = await svc.auth.admin.getUserById(userId);
  return data?.user?.email || "";
}

/** Authoritative manager recipient + owning manager user id for an application. */
async function resolveManager(app: any): Promise<{ email: string; userId: string | null; company: string | null }> {
  if (app.job_posting_id) {
    const { data: jp } = await svc.from("job_postings")
      .select("manager_id, contact_email, company_name").eq("id", app.job_posting_id).maybeSingle();
    if (jp) {
      const email = (jp as any).contact_email || await emailOf(jp.manager_id);
      return { email, userId: (jp as any).manager_id ?? null, company: (jp as any).company_name ?? null };
    }
  }
  if (app.company_post_id) {
    const { data: cp } = await svc.from("company_posts")
      .select("manager_id").eq("id", app.company_post_id).maybeSingle();
    const mid = (cp as any)?.manager_id ?? null;
    return { email: await emailOf(mid), userId: mid, company: app.company_name ?? null };
  }
  if (app.vacancy_id) {
    const { data: ev } = await svc.from("external_vacancies")
      .select("contact_email, company_name").eq("id", app.vacancy_id).maybeSingle();
    return { email: (ev as any)?.contact_email || "", userId: null, company: (ev as any)?.company_name ?? null };
  }
  return { email: "", userId: null, company: app.company_name ?? null };
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Legacy postings with manager_id NULL may only be claimed by an admin-approved,
 * company-verified manager whose company name matches exactly and unambiguously.
 */
async function legacyCompanyClaim(uid: string, postingCompany: string | null) {
  if (!postingCompany) return false;
  const { data: mp } = await svc.from("manager_profiles")
    .select("company_name, admin_approved, company_verified").eq("user_id", uid).maybeSingle();
  if (!mp || (mp as any).admin_approved !== true || (mp as any).company_verified !== true) return false;
  const target = norm(postingCompany);
  if (!target || norm((mp as any).company_name) !== target) return false;
  // Unambiguous: exactly one manager profile carries this company name.
  const { data: peers } = await svc.from("manager_profiles").select("user_id, company_name").limit(200);
  const matches = (peers || []).filter((p: any) => norm(p.company_name) === target);
  return matches.length === 1 && matches[0].user_id === uid;
}

async function managerOwns(app: any, uid: string) {
  if (app.job_posting_id) {
    const { data: jp } = await svc.from("job_postings")
      .select("manager_id, company_name").eq("id", app.job_posting_id).maybeSingle();
    if (jp) {
      if (jp.manager_id === uid) return true;
      if (!jp.manager_id && await legacyCompanyClaim(uid, (jp as any).company_name)) return true;
    }
  }
  if (app.company_post_id) {
    const { data: cp } = await svc.from("company_posts")
      .select("manager_id").eq("id", app.company_post_id).maybeSingle();
    if ((cp as any)?.manager_id === uid) return true;
  }
  return false;
}

async function crewName(crewId: string) {
  const { data } = await svc.from("crew_profiles")
    .select("first_name, last_name").eq("id", crewId).maybeSingle();
  return `${data?.first_name || "A seafarer"} ${(data?.last_name || "").slice(0, 1)}`.trim();
}

interface NotifyResult { notified: boolean; existed: boolean; error?: string }

/** Insert a notification only when an equivalent one does not exist yet. Reports the real outcome. */
async function ensureNotification(userId: string | null, kind: string, applicationId: string, row: {
  title: string; body: string; icon: string; screen: string; link?: string;
}): Promise<NotifyResult> {
  if (!userId) return { notified: false, existed: false, error: "no_recipient" };
  try {
    const { data: existing } = await svc.from("notifications")
      .select("id").eq("crew_id", userId).eq("kind", kind)
      .ilike("link", `%${applicationId}%`).limit(1);
    if (existing?.length) return { notified: true, existed: true };
    const { error } = await svc.from("notifications").insert({
      crew_id: userId, kind, ...row, link: row.link ?? null,
    });
    return { notified: !error, existed: false, error: error ? String(error.message).slice(0, 200) : undefined };
  } catch (e) {
    return { notified: false, existed: false, error: e instanceof Error ? e.message.slice(0, 200) : "error" };
  }
}

// ---------------------------------------------------------------- handler

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ ok: false, error: "unauthorized" }, 401);
    const { data: userRes } = await svc.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return json({ ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const applicationId = String(body?.application_id || "");
    const kind = String(body?.kind || "application");
    const manual = body?.force_resend === true;
    if (!applicationId) return json({ ok: false, error: "missing_application_id" }, 400);

    const { data: app } = await svc.from("job_applications")
      .select("id, crew_id, vacancy_id, job_posting_id, company_post_id, rank_applied, vessel_type, company_name, outcome, created_at, offered_at, offered_joining_date, offer_details, manager_note")
      .eq("id", applicationId).maybeSingle();
    if (!app) return json({ ok: false, error: "not_found" }, 404);

    const isCrewOwner = app.crew_id === user.id;
    const admin = await isAdmin(user.id);
    const isManager = admin || await managerOwns(app, user.id);

    // Manual resend is restricted to an authorized owning manager (or admin) resending a live offer.
    if (manual && (kind !== "offer" || !isManager || app.outcome !== "offered")) {
      return json({ ok: false, error: "resend_not_allowed", outcome: app.outcome }, 403);
    }
    const rank = app.rank_applied || "Crew";
    const mgr = await resolveManager(app);
    const company = app.company_name || mgr.company || "the company";
    const crewEmail = await emailOf(app.crew_id);
    const attempts: Attempt[] = [];

    const managerLink = `${SITE}/manager/dashboard?tab=applicants`;
    const crewJobsLink = `${SITE}/app?tab=jobs`;

    // ---------------------------------------------------------- new application
    if (kind === "application") {
      if (!isCrewOwner && !isManager) return json({ ok: false, error: "unauthorized" }, 403);

      const name = await crewName(app.crew_id);
      const { data: crew } = await svc.from("crew_profiles")
        .select("nationality, years_in_rank_band, public_card_token").eq("id", app.crew_id).maybeSingle();
      const { data: score } = await svc.from("smc_assessments")
        .select("overall_score, score_band, certificate_id")
        .eq("crew_profile_id", app.crew_id).eq("status", "completed")
        .order("completed_at", { ascending: false }).limit(1).maybeSingle();

      const appliedOn = new Date(app.created_at || Date.now()).toISOString().split("T")[0];
      const teaser = `<p><strong>${esc(name)}</strong> — ${esc(rank)}${
        crew?.nationality ? `, ${esc(crew.nationality)}` : ""
      }${crew?.years_in_rank_band ? ` · ${esc(crew.years_in_rank_band)} in rank` : ""}</p>`;
      const scoreLine = score?.overall_score != null
        ? `<p>SeaMinds Score: <strong>${esc(Number(score.overall_score).toFixed(2))}</strong>${
            score.score_band ? ` (${esc(score.score_band)})` : ""
          }${score.certificate_id ? ` — <a href="${SITE}/verify/${score.certificate_id}" style="color:#D4AF37">verify</a>` : ""}</p>`
        : "";
      const profileBtn = (crew as any)?.public_card_token
        ? goldBtn(`${SITE}/crew/${(crew as any).public_card_token}`, "View full Sea Profile (free company registration)")
        : "";

      attempts.push(await deliver({
        applicationId, kind: "application", recipient: mgr.email, role: "manager", manual, capped: true,
        subject: `New applicant via SeaMinds — ${rank}`,
        html: card(`
          <h2 style="color:#D4AF37;margin:0 0 12px">⚓ Application via SeaMinds</h2>
          <p>Position: ${esc(rank)}${app.vessel_type ? ` — ${esc(app.vessel_type)}` : ""}</p>
          <p>Applied on: ${esc(appliedOn)}</p>
          ${teaser}${scoreLine}${profileBtn}
          ${goldBtn(managerLink, "Open your Applicants")}
        `),
      }));

      attempts.push(await deliver({
        applicationId, kind: "application_ack", recipient: crewEmail, role: "crew", manual,
        subject: `Application received — ${rank}`,
        html: card(`
          <h2 style="color:#D4AF37;margin:0 0 12px">⚓ We received your application</h2>
          <p>SeaMinds has recorded your application for <strong>${esc(rank)}</strong>${
            app.company_name ? ` with ${esc(app.company_name)}` : ""
          }.</p>
          <p>Current status: <strong>Submitted</strong></p>
          <p>You will be notified in the app and by email when the company updates your application.</p>
          ${goldBtn(crewJobsLink, "View my applications")}
        `),
      }));

      return json({ ok: true, sent: attempts.some((a) => a.sent), attempts });
    }

    // ---------------------------------------------------------- shortlisted / declined
    if (kind === "shortlisted" || kind === "declined") {
      if (!isManager) return json({ ok: false, error: "unauthorized" }, 403);
      const expected = kind === "shortlisted" ? "shortlisted" : "declined";
      if (app.outcome !== expected) return json({ ok: false, error: "status_mismatch", outcome: app.outcome }, 409);

      const shortlisted = kind === "shortlisted";
      await ensureNotification(app.crew_id, "application_update", applicationId, {
        title: shortlisted ? "⭐ You have been shortlisted!" : "Application update",
        body: shortlisted
          ? `${company} shortlisted you for ${rank}. Keep your documents ready.`
          : `${company} has decided not to move forward with your application for ${rank}.`,
        icon: shortlisted ? "⭐" : "📄",
        screen: "jobs",
        link: `/app?tab=jobs&application=${applicationId}`,
      });

      attempts.push(await deliver({
        applicationId, kind, recipient: crewEmail, role: "crew", manual,
        subject: shortlisted ? `⭐ Shortlisted — ${rank}` : `Application update — ${rank}`,
        html: card(shortlisted
          ? `<h2 style="color:#D4AF37;margin:0 0 12px">⭐ You have been shortlisted</h2>
             <p>${esc(company)} has shortlisted you for <strong>${esc(rank)}</strong>.</p>
             <p>Keep your certificates and documents ready — the company may contact you for the next step.</p>
             ${goldBtn(crewJobsLink, "View my applications")}`
          : `<h2 style="color:#D4AF37;margin:0 0 12px">Application update</h2>
             <p>Thank you for applying for <strong>${esc(rank)}</strong>${
               app.company_name ? ` with ${esc(app.company_name)}` : ""
             }.</p>
             <p>The company has decided not to move forward with this application. Your SeaMinds profile stays active and you can apply to other vacancies right away.</p>
             ${goldBtn(crewJobsLink, "Browse vacancies")}`),
      }));

      return json({ ok: true, sent: attempts.some((a) => a.sent), attempts });
    }

    // ---------------------------------------------------------- offer sent
    if (kind === "offer") {
      if (!isManager) return json({ ok: false, error: "unauthorized" }, 403);

      let offer: any = app.offer_details ?? null;
      if (!offer && app.offered_at) offer = { joining_date: app.offered_joining_date, message: app.manager_note };
      if (!offer) return json({ ok: false, error: "no_offer" }, 409);

      const steps: string[] = [];
      if (offer.interview_required) {
        steps.push(`Interview${offer.interview_date ? ` — planned ${esc(offer.interview_date)}` : " — date to be advised"}`);
      }
      if (offer.documents_required) steps.push("Documentation check — please upload your documents on SeaMinds");
      steps.push(
        `Joining: ${esc(offer.joining_date || app.offered_joining_date || "TBA")}${
          offer.joining_port ? ` at ${esc(offer.joining_port)}` : ""
        }${offer.vessel_name ? ` · Vessel: ${esc(offer.vessel_name)}` : ""}`,
      );

      await ensureNotification(app.crew_id, "job_offer", applicationId, {
        title: `🎉 Offer received — ${rank}`,
        body: `${company}${offer.vessel_name ? ` · ${offer.vessel_name}` : ""}`,
        icon: "⚓",
        screen: "jobs",
        link: `/app?tab=jobs&offer=${applicationId}`,
      });

      attempts.push(await deliver({
        applicationId, kind: "offer", recipient: crewEmail, role: "crew", manual,
        subject: `⚓ Job Offer via SeaMinds — ${rank}`,
        html: card([
          `<h2 style="color:#D4AF37;margin:0 0 12px">⚓ Offer of Employment — ${esc(company)}</h2>`,
          `<p>Rank: <strong>${esc(rank)}</strong>${offer.vessel_name ? ` — ${esc(offer.vessel_name)}` : ""}</p>`,
          `<h3 style="color:#D4AF37;margin:18px 0 8px;font-size:15px">Next steps</h3>`,
          `<ol style="color:#E2E8F0;padding-left:20px;margin:0">${steps.map((s) => `<li style="margin-bottom:6px">${s}</li>`).join("")}</ol>`,
          offer.salary ? `<p>Salary: ${esc(offer.salary)}${/usd|\$/i.test(String(offer.salary)) ? "" : " USD/month"}</p>` : "",
          offer.message
            ? `<div style="border:1px solid rgba(212,175,55,0.3);border-radius:10px;padding:12px;margin:14px 0;color:#E2E8F0">${esc(offer.message)}</div>` : "",
          `<p style="color:#94A3B8;font-size:13px">Accept or decline securely inside SeaMinds — never by replying to this email.</p>`,
          goldBtn(`${SITE}/app?tab=jobs&offer=${applicationId}`, "View & Respond to Offer"),
          `<p><a href="${SITE}/app?tab=cv" style="color:#D4AF37">Upload documents</a></p>`,
        ].filter(Boolean).join("")),
      }));

      return json({ ok: true, sent: attempts.some((a) => a.sent), attempts });
    }

    // ---------------------------------------------------------- offer accepted / declined
    if (kind === "accepted" || kind === "offer_declined") {
      if (!isCrewOwner) return json({ ok: false, error: "unauthorized" }, 403);
      const accepted = kind === "accepted";
      const expected = accepted ? "placed" : "offer_declined";
      if (app.outcome !== expected) return json({ ok: false, error: "status_mismatch", outcome: app.outcome }, 409);

      const offer: any = app.offer_details ?? {};
      const name = await crewName(app.crew_id);

      const managerNotified = await ensureNotification(mgr.userId, "application_update", applicationId, {
        title: accepted ? `⚓ Offer accepted — ${rank}` : `Offer declined — ${rank}`,
        body: accepted
          ? `${name} accepted your offer for ${rank}.`
          : `${name} declined your offer for ${rank}.`,
        icon: accepted ? "⚓" : "📄",
        screen: "applicants",
        link: `/manager/dashboard?tab=applicants&application=${applicationId}`,
      });

      attempts.push(await deliver({
        applicationId, kind, recipient: mgr.email, role: "manager", manual,
        subject: accepted ? `⚓ Offer accepted — ${rank}` : `Offer declined — ${rank}`,
        html: card([
          `<h2 style="color:#D4AF37;margin:0 0 12px">${accepted ? "⚓ Offer accepted" : "Offer declined"}</h2>`,
          `<p><strong>${esc(name)}</strong> has ${accepted ? "accepted" : "declined"} your offer for <strong>${esc(rank)}</strong>.</p>`,
          accepted && offer.vessel_name ? `<p>Vessel: ${esc(offer.vessel_name)}</p>` : "",
          accepted && (offer.joining_date || offer.joining_port)
            ? `<p>Joining: ${esc(offer.joining_date || "TBA")}${offer.joining_port ? ` at ${esc(offer.joining_port)}` : ""}</p>` : "",
          accepted && offer.salary ? `<p>Salary: ${esc(offer.salary)}</p>` : "",
          goldBtn(managerLink, "Open your Applicants"),
        ].filter(Boolean).join("")),
      }));

      attempts.push(await deliver({
        applicationId, kind: accepted ? "accepted_ack" : "offer_declined_ack", recipient: crewEmail, role: "crew", manual,
        subject: accepted ? `⚓ Placement confirmed — ${rank}` : `Offer declined — ${rank}`,
        html: card(accepted
          ? `<h2 style="color:#D4AF37;margin:0 0 12px">⚓ Congratulations, sailor!</h2>
             <p>You accepted the offer for <strong>${esc(rank)}</strong>${
               app.company_name ? ` with ${esc(app.company_name)}` : ""
             }. Your placement is recorded in SeaMinds and your profile is hidden from other companies until your contract ends.</p>
             ${offer.joining_date ? `<p>Joining: ${esc(offer.joining_date)}${offer.joining_port ? ` at ${esc(offer.joining_port)}` : ""}</p>` : ""}
             ${goldBtn(crewJobsLink, "View my placement")}`
          : `<h2 style="color:#D4AF37;margin:0 0 12px">Offer declined</h2>
             <p>You declined the offer for <strong>${esc(rank)}</strong>${
               app.company_name ? ` from ${esc(app.company_name)}` : ""
             }. The company has been informed.</p>
             <p>Your profile stays active and you can keep applying to other vacancies.</p>
             ${goldBtn(crewJobsLink, "Browse vacancies")}`),
      }));

      return json({
        ok: true,
        sent: attempts.some((a) => a.sent),
        manager_notified: managerNotified,
        attempts,
      });
    }

    return json({ ok: false, error: "bad_kind" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "error" }, 500);
  }
});
