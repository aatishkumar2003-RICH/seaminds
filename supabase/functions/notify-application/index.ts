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

const card = (inner: string) => `<div style="background:#0D1B2A;border-radius:14px;padding:24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;line-height:1.6">${inner}
  <p style="color:#94A3B8;font-size:12px;margin-top:22px">Sent via SeaMinds — seaminds.life · free crew platform, no agent fees</p>
</div>`;

const goldBtn = (href: string, label: string) =>
  `<p><a href="${href}" style="background:#D4AF37;color:#0D1B2A;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${label}</a></p>`;

async function alreadyEmailed(applicationId: string, kind: string) {
  const { data } = await svc.from("app_events").select("id")
    .eq("event_type", "application_email")
    .filter("metadata->>application_id", "eq", applicationId)
    .filter("metadata->>kind", "eq", kind).limit(1);
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

async function sendMail(to: string, subject: string, html: string, applicationId: string, kind: string) {
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
    metadata: { application_id: applicationId, recipient: to, ok, kind },
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
    const kind = String(body?.kind || "application");
    if (!applicationId) return json({ ok: false, error: "missing_application_id" });

    const { data: app } = await svc.from("job_applications")
      .select("id, crew_id, vacancy_id, job_posting_id, company_post_id, rank_applied, vessel_type, company_name, offered_at, offered_joining_date, manager_note")
      .eq("id", applicationId).maybeSingle();
    if (!app) return json({ ok: false, error: "not_found" });

    // ---------- OFFER BRANCH (caller is the manager) ----------
    if (kind === "offer") {
      let authorized = false;
      if (app.job_posting_id) {
        const { data: jp } = await svc.from("job_postings")
          .select("manager_id, company_name").eq("id", app.job_posting_id).maybeSingle();
        if (jp) {
          if (jp.manager_id === user.id) authorized = true;
          else if (!jp.manager_id) {
            const { data: mp } = await svc.from("manager_profiles")
              .select("company_name").eq("user_id", user.id).maybeSingle();
            authorized = !!mp?.company_name && !!jp.company_name &&
              mp.company_name.trim().toLowerCase() === jp.company_name.trim().toLowerCase();
          }
        }
      }
      if (!authorized && app.company_post_id) {
        const { data: cp } = await svc.from("company_posts")
          .select("manager_id").eq("id", app.company_post_id).maybeSingle();
        if ((cp as any)?.manager_id === user.id) authorized = true;
      }
      if (!authorized) return json({ ok: false, error: "unauthorized" });

      // offer_details is optional (added later); fall back to the offer columns on the row
      let offer: any = null;
      const { data: od } = await svc.from("job_applications")
        .select("offer_details").eq("id", applicationId).maybeSingle();
      offer = (od as any)?.offer_details ?? null;
      if (!offer && app.offered_at) {
        offer = { joining_date: app.offered_joining_date, message: app.manager_note };
      }
      if (!offer) return json({ ok: false, error: "no_offer" });

      const { data: crewUser } = await svc.auth.admin.getUserById(app.crew_id);
      const to = crewUser?.user?.email || "";
      const rank = app.rank_applied || "Crew";
      const company = app.company_name || offer.company_name || "the company";

      const steps: string[] = [];
      if (offer.interview_required) {
        steps.push(`Interview${offer.interview_date ? ` — planned ${esc(offer.interview_date)}` : " — date to be advised"}`);
      }
      if (offer.documents_required) {
        steps.push("Documentation check — please upload your documents on SeaMinds");
      }
      steps.push(
        `Joining: ${esc(offer.joining_date || "TBA")}${offer.joining_port ? ` at ${esc(offer.joining_port)}` : ""}${
          offer.vessel_name ? ` · Vessel: ${esc(offer.vessel_name)}` : ""
        }`,
      );

      const lines = [
        `<h2 style="color:#D4AF37;margin:0 0 12px">⚓ Offer of Employment — ${esc(company)}</h2>`,
        `<p>Rank: <strong>${esc(rank)}</strong>${offer.vessel_name ? ` — ${esc(offer.vessel_name)}` : ""}</p>`,
        `<h3 style="color:#D4AF37;margin:18px 0 8px;font-size:15px">Next steps</h3>`,
        `<ol style="color:#E2E8F0;padding-left:20px;margin:0">${steps.map((s) => `<li style="margin-bottom:6px">${s}</li>`).join("")}</ol>`,
        offer.salary ? `<p>Salary: ${esc(offer.salary)}${/usd|\$/i.test(String(offer.salary)) ? "" : " USD/month"}</p>` : "",
        offer.message
          ? `<div style="border:1px solid rgba(212,175,55,0.3);border-radius:10px;padding:12px;margin:14px 0;color:#E2E8F0">${esc(offer.message)}</div>` : "",
        goldBtn(`${SITE}/app?tab=jobs&offer=${applicationId}`, "View & Respond to Offer"),
        `<p><a href="${SITE}/app?tab=cv" style="color:#D4AF37">Upload documents</a></p>`,
      ].filter(Boolean).join("");


      const { data: existingNotif } = await svc.from("notifications")
        .select("id").eq("crew_id", app.crew_id).eq("kind", "job_offer")
        .ilike("link", `%${applicationId}%`).limit(1);
      if (!existingNotif?.length) await svc.from("notifications").insert({
        crew_id: app.crew_id,
        link: `/app?tab=jobs&offer=${applicationId}`,
        kind: "job_offer",
        title: `🎉 Offer received — ${rank}`,
        body: `${company}${offer.vessel_name ? ` · ${offer.vessel_name}` : ""}`,
        icon: "⚓",
        screen: "jobs",
      });

      if (!to) return json({ ok: true, sent: false, skipped: "no_email" });
      if (await alreadyEmailed(applicationId, "offer")) {
        return json({ ok: true, sent: false, skipped: "already_sent" });
      }
      const sent = await sendMail(to, `⚓ Job Offer via SeaMinds — ${rank}`, card(lines), applicationId, "offer");
      return json({ ok: true, sent });
    }

    // ---------- ACCEPTED BRANCH (caller is the crew who owns the application) ----------
    if (kind === "accepted") {
      if (app.crew_id !== user.id) return json({ ok: false, error: "unauthorized" });
      if (await alreadyEmailed(applicationId, "accepted")) {
        return json({ ok: true, sent: false, skipped: "already_sent" });
      }

      const { data: od } = await svc.from("job_applications")
        .select("offer_details").eq("id", applicationId).maybeSingle();
      const offer: any = (od as any)?.offer_details ?? {};

      let recipientTo = "";
      if (app.job_posting_id) {
        const { data: jp } = await svc.from("job_postings")
          .select("manager_id, contact_email").eq("id", app.job_posting_id).maybeSingle();
        recipientTo = (jp as any)?.contact_email || "";
        if (!recipientTo && jp?.manager_id) {
          const { data: mgr } = await svc.auth.admin.getUserById(jp.manager_id);
          recipientTo = mgr?.user?.email || "";
        }
      }
      if (!recipientTo && app.company_post_id) {
        const { data: cp } = await svc.from("company_posts")
          .select("manager_id").eq("id", app.company_post_id).maybeSingle();
        if ((cp as any)?.manager_id) {
          const { data: mgr } = await svc.auth.admin.getUserById((cp as any).manager_id);
          recipientTo = mgr?.user?.email || "";
        }
      }
      if (!recipientTo) return json({ ok: true, sent: false, skipped: "no_email" });

      const { data: crewRow } = await svc.from("crew_profiles")
        .select("first_name, last_name").eq("id", app.crew_id).maybeSingle();
      const crewName = `${crewRow?.first_name || "The seafarer"} ${(crewRow?.last_name || "").slice(0, 1)}`.trim();
      const rankA = app.rank_applied || "Crew";

      const html = card([
        `<h2 style="color:#D4AF37;margin:0 0 12px">⚓ Offer accepted</h2>`,
        `<p><strong>${esc(crewName)}</strong> has accepted your offer for <strong>${esc(rankA)}</strong>.</p>`,
        offer.vessel_name ? `<p>Vessel: ${esc(offer.vessel_name)}</p>` : "",
        offer.joining_date || offer.joining_port
          ? `<p>Joining: ${esc(offer.joining_date || "TBA")}${offer.joining_port ? ` at ${esc(offer.joining_port)}` : ""}</p>` : "",
        offer.salary ? `<p>Salary: ${esc(offer.salary)}</p>` : "",
        goldBtn(`${SITE}/manager/dashboard?tab=applicants`, "Open your Applicants"),
      ].filter(Boolean).join(""));

      const sent = await sendMail(recipientTo, `⚓ Offer accepted — ${rankA}`, html, applicationId, "accepted");
      return json({ ok: true, sent });
    }


    // ---------- APPLICATION BRANCH (caller is the crew) ----------
    if (app.crew_id !== user.id) return json({ ok: false, error: "not_found" });
    if (await alreadyEmailed(applicationId, "application")) return json({ ok: true, sent: false, skipped: "already_emailed" });

    const { data: crew } = await svc.from("crew_profiles")
      .select("first_name, last_name, rank, role, nationality, years_in_rank_band, public_card_token")
      .eq("id", app.crew_id).maybeSingle();

    const { data: score } = await svc.from("smc_assessments")
      .select("overall_score, score_band, certificate_id")
      .eq("crew_profile_id", app.crew_id).eq("status", "completed")
      .order("completed_at", { ascending: false }).limit(1).maybeSingle();

    const name = `${crew?.first_name || "A seafarer"} ${(crew?.last_name || "").slice(0, 1)}`.trim();
    const rank = app.rank_applied || crew?.rank || crew?.role || "Crew";
    const teaser = `<p><strong>${esc(name)}</strong> — ${esc(crew?.rank || crew?.role || rank)}${
      crew?.nationality ? `, ${esc(crew.nationality)}` : ""
    }${crew?.years_in_rank_band ? ` · ${esc(crew.years_in_rank_band)} in rank` : ""}</p>`;
    const profileBtn = crew?.public_card_token
      ? goldBtn(`${SITE}/crew/${crew.public_card_token}`, "View full Sea Profile (free company registration)")
      : "";
    const scoreLine = score?.overall_score != null
      ? `<p>SeaMinds Score: <strong>${esc(Number(score.overall_score).toFixed(2))}</strong>${
          score.score_band ? ` (${esc(score.score_band)})` : ""
        }${score.certificate_id ? ` — <a href="${SITE}/verify/${score.certificate_id}" style="color:#D4AF37">verify</a>` : ""}</p>`
      : "";

    let recipient = "";
    let subject = "";
    let html = "";

    if (app.job_posting_id) {
      const { data: jp } = await svc.from("job_postings")
        .select("manager_id, rank_required, vessel_type, contact_email").eq("id", app.job_posting_id).maybeSingle();
      if (!jp) return json({ ok: true, sent: false, skipped: "no_target" });
      recipient = (jp as any).contact_email || "";
      if (!recipient) {
        if (!jp.manager_id) return json({ ok: true, sent: false, skipped: "no_manager" });
        const { data: mgr } = await svc.auth.admin.getUserById(jp.manager_id);
        recipient = mgr?.user?.email || "";
      }
      if (!recipient) return json({ ok: true, sent: false, skipped: "no_email" });
      subject = `New applicant via SeaMinds — ${jp.rank_required || rank}`;
      html = card(`
        <h2 style="color:#D4AF37;margin:0 0 12px">⚓ Application via SeaMinds</h2>
        <p>Position: ${esc(jp.rank_required || rank)}${jp.vessel_type ? ` — ${esc(jp.vessel_type)}` : ""}</p>
        ${teaser}${scoreLine}${profileBtn}
        ${goldBtn(`${SITE}/manager/dashboard?tab=applicants`, "Open your Applicants")}
      `);
    } else if (app.vacancy_id) {
      const { data: ev } = await svc.from("external_vacancies")
        .select("contact_email, rank_required, title, vessel_type, joining_port")
        .eq("id", app.vacancy_id).maybeSingle();
      recipient = ev?.contact_email || "";
      if (!recipient) return json({ ok: true, sent: false, skipped: "no_contact_email" });
      const pos = ev?.rank_required || ev?.title || rank;
      subject = `A seafarer applied to your ${pos} vacancy via SeaMinds`;
      html = card(`
        <h2 style="color:#D4AF37;margin:0 0 12px">⚓ Application via SeaMinds</h2>
        <p>Position: ${esc(pos)}${ev?.vessel_type ? ` — ${esc(ev.vessel_type)}` : ""}${ev?.joining_port ? `, ${esc(ev.joining_port)}` : ""}</p>
        ${teaser}${scoreLine}${profileBtn}
        ${goldBtn(`${SITE}/for-companies`, "Register your company free to view full profiles")}
      `);
    } else {
      return json({ ok: true, sent: false, skipped: "no_target" });
    }

    if (await overDailyLimit(recipient)) return json({ ok: true, sent: false, skipped: "rate_limited" });

    const sent = await sendMail(recipient, subject, html, applicationId, "application");
    return json({ ok: true, sent });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "error" });
  }
});
