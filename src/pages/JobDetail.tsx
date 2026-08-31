import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, MapPin, Ship, BadgeCheck, MessageCircle, ExternalLink, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatSalaryText } from "@/lib/salary";
import { trackPixel } from "@/lib/metaPixel";
import {
  fetchCrewCardInfo, getCachedCrewCardInfo, waApplyLink, recordApplication,
  openHandoffTab, completeHandoff, fetchQuickProfileDone, CrewCardInfo,
} from "@/lib/applyMessage";
import ApplyGateSheet from "@/components/ApplyGateSheet";
import NotFound from "@/pages/NotFound";
import { jobPath, idFromSlug, RANK_HUBS, rankMatches } from "@/lib/jobSlug";
import { toast } from "sonner";

const NAVY = "#0D1B2A";
const CARD = "#112240";
const GOLD = "#D4AF37";
const BORDER = "#1e3a5f";

interface Job {
  id: string;
  kind: "direct" | "external";
  rank: string;
  vessel: string;
  company: string;
  salary: string | null;
  port: string | null;
  duration: string | null;
  joiningDate: string | null;
  notes: string | null;
  flier: string | null;
  whatsapp: string | null;
  email: string | null;
  applyUrl: string | null;
  verified: boolean;
  posted: string | null;
  expires: string | null;
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;

const JobDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const id = idFromSlug(slug);

  const [job, setJob] = useState<Job | null>(null);
  const [similar, setSimilar] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [needsQuickProfile, setNeedsQuickProfile] = useState(false);
  const [cardInfo, setCardInfo] = useState<CrewCardInfo | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let alive = true;
    const preload = (uid: string | undefined) => {
      if (!uid) { if (alive) setSignedIn(false); return; }
      if (alive) setSignedIn(true);
      fetchCrewCardInfo(uid).then((c) => { if (alive) setCardInfo(c); });
      fetchQuickProfileDone(uid).then((done) => { if (alive) setNeedsQuickProfile(!done); });
    };
    supabase.auth.getSession().then(({ data }) => {
      preload(data?.session?.user?.id);
      if (alive) setAuthResolved(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      preload(s?.user?.id);
      if (alive) setAuthResolved(true);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) { setLoading(false); return; }
      setLoading(true);
      const nowIso = new Date().toISOString();

      const { data: p } = await supabase.from("job_postings" as any)
        .select("id, rank_required, vessel_type, monthly_salary, joining_port, joining_date, contract_duration, company_name, additional_notes, contact_whatsapp, contact_email, verified, flier_url, created_at, expires_at, status")
        .eq("id", id).eq("status", "active").maybeSingle();

      let found: Job | null = null;
      const pr: any = p;
      if (pr && (!pr.expires_at || pr.expires_at > nowIso)) {
        found = {
          id: pr.id, kind: "direct",
          rank: pr.rank_required || "Crew", vessel: pr.vessel_type || "—",
          company: pr.company_name || "Maritime Company", salary: pr.monthly_salary,
          port: pr.joining_port, duration: pr.contract_duration, joiningDate: pr.joining_date,
          notes: pr.additional_notes, flier: pr.flier_url,
          whatsapp: pr.contact_whatsapp, email: pr.contact_email || null, applyUrl: null,
          verified: !!pr.verified, posted: pr.created_at, expires: pr.expires_at,
        };
      } else {
        const { data: e } = await supabase.from("external_vacancies" as any)
          .select("id, rank_required, title, vessel_type, company_name, salary_text, joining_port, joining_date, contract_duration, description, contact_whatsapp, contact_email, apply_url, is_verified, is_scam_flagged, fetched_at, expires_at")
          .eq("id", id).gt("expires_at", nowIso).maybeSingle();
        const er: any = e;
        if (er && !er.is_scam_flagged) {
          found = {
            id: er.id, kind: "external",
            rank: er.rank_required || er.title || "Crew", vessel: er.vessel_type || "—",
            company: er.company_name || "Maritime Company", salary: er.salary_text,
            port: er.joining_port, duration: er.contract_duration, joiningDate: er.joining_date || null,
            notes: er.description, flier: null,
            whatsapp: er.contact_whatsapp, email: er.contact_email || null, applyUrl: er.apply_url,
            verified: !!er.is_verified, posted: er.fetched_at, expires: er.expires_at,
          };
        }
      }

      if (!alive) return;
      setJob(found);
      setLoading(false);

      if (found) {
        const rankKey = (found.rank || "").split(/[/,(]/)[0].trim().slice(0, 20);
        const [sp, se] = await Promise.all([
          supabase.from("job_postings" as any)
            .select("id, rank_required, vessel_type, company_name, joining_port")
            .eq("status", "active").ilike("rank_required", `%${rankKey}%`).neq("id", found.id).limit(5),
          supabase.from("external_vacancies" as any)
            .select("id, rank_required, vessel_type, company_name, joining_port")
            .gt("expires_at", nowIso).ilike("rank_required", `%${rankKey}%`).neq("id", found.id).limit(5),
        ]);
        const merge = [
          ...(((sp as any).data as any[]) || []).map((r) => ({ ...r, kind: "direct" as const })),
          ...(((se as any).data as any[]) || []).map((r) => ({ ...r, kind: "external" as const })),
        ].slice(0, 5).map((r: any) => ({
          id: r.id, kind: r.kind, rank: r.rank_required || "Crew", vessel: r.vessel_type || "—",
          company: r.company_name || "Maritime Company", salary: null, port: r.joining_port,
          duration: null, joiningDate: null, notes: null, flier: null, whatsapp: null,
          email: null, applyUrl: null, verified: false, posted: null, expires: null,
        })) as Job[];
        if (alive) setSimilar(merge);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const hub = useMemo(() => (job ? RANK_HUBS.find((h) => rankMatches(h, job.rank)) : null), [job]);

  const apply = async () => {
    if (!job) return;
    if (!signedIn) { navigate(`/join?next=${encodeURIComponent(jobPath({ id: job.id, rank: job.rank, vessel: job.vessel, port: job.port }))}`); return; }
    if (needsQuickProfile) { setGateOpen(true); return; }
    setApplying(true);
    try {
      trackPixel("Contact", { content_name: "job_apply_detail" });
      const base = {
        vacancyId: job.kind === "external" ? job.id : null,
        jobPostingId: job.kind === "direct" ? job.id : null,
        companyPostId: null,
        company: job.company || null,
        rank: job.rank || null,
        vessel: job.vessel || null,
      };
      const say = (r: any, okMsg: string) => {
        if (r.ok && r.duplicate) toast.success("Already applied ✓ — the company already has your application");
        else if (r.ok && r.emailSent === false) toast.warning("Applied ✓ — saved on SeaMinds, but the email notification failed");
        else if (r.ok) toast.success(okMsg);
        else toast.error("Could not record the application on SeaMinds");
      };

      if (job.email) {
        const r = await recordApplication({ ...base, externalUrl: null });
        say(r, "Applied ✓ — your application has been emailed to the company");
        return;
      }
      if (job.whatsapp) {
        const url = waApplyLink(job.whatsapp, cardInfo || getCachedCrewCardInfo(), { rank: job.rank, vessel: job.vessel, port: job.port });
        if (url) {
          const win = openHandoffTab();
          const r = await recordApplication({ ...base, externalUrl: url });
          say(r, "Applied ✓ — recorded on SeaMinds");
          completeHandoff(win, url);
          return;
        }
      }
      if (job.applyUrl) {
        const win = openHandoffTab();
        const r = await recordApplication({ ...base, externalUrl: job.applyUrl });
        say(r, "Applied ✓ — recorded on SeaMinds");
        completeHandoff(win, job.applyUrl);
        return;
      }
      navigate("/app?tab=jobs");
    } catch {
      navigate("/app?tab=jobs");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", background: NAVY, color: "#94a3b8", padding: 60, textAlign: "center" }}>Loading vacancy…</div>;
  }

  if (!job) {
    return (
      <NotFound
        title="This vacancy has closed"
        message="This position is no longer live on SeaMinds. Similar contracts are posted every day — browse the rank hubs below."
        links={[
          { href: "/feed", label: "All live vacancies" },
          { href: "/jobs/rank/chief-officer", label: "Chief Officer jobs" },
          { href: "/jobs/rank/2nd-engineer", label: "2nd Engineer jobs" },
          { href: "/", label: "SeaMinds home" },
        ]}
      />
    );
  }

  const path = jobPath({ id: job.id, rank: job.rank, vessel: job.vessel, port: job.port });
  const canonical = `https://seaminds.life${path}`;
  const place = job.port || "Worldwide";
  const title = `${job.rank} Job on ${job.vessel} — ${place} | SeaMinds`;
  const desc = (job.notes || `${job.rank} vacancy on ${job.vessel} joining ${place}. Apply free on SeaMinds — no agent fees.`).replace(/\s+/g, " ").trim().slice(0, 150);
  const salary = formatSalaryText(job.salary);

  const ld = job.kind === "direct" ? {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: `${job.rank} — ${job.vessel}`,
    description: job.notes || `${job.rank} position on ${job.vessel} joining ${place}.`,
    datePosted: job.posted,
    validThrough: job.expires,
    employmentType: "CONTRACTOR",
    directApply: true,
    hiringOrganization: { "@type": "Organization", name: job.company },
    ...(job.port
      ? { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.port } } }
      : { applicantLocationRequirements: { "@type": "Country", name: "Worldwide" }, jobLocationType: "TELECOMMUTE" }),
  } : null;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "16px 16px 70px" }}>
      <ApplyGateSheet open={gateOpen} onClose={() => setGateOpen(false)} next={path} />
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        {ld && <script type="application/ld+json">{JSON.stringify(ld)}</script>}
      </Helmet>

      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <a href="/feed" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#94A3B8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          <ChevronLeft size={16} /> All vacancies
        </a>

        <article style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18, marginTop: 12 }}>
          <h1 style={{ color: "#fff", fontSize: 21, fontWeight: 900, lineHeight: 1.25 }}>
            {job.rank} — {job.vessel} ({place})
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <span style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>{job.company}</span>
            {job.kind === "direct" && job.verified && <BadgeCheck size={14} style={{ color: "#22c55e" }} />}
          </div>
          <p style={{ color: job.kind === "direct" ? "#22c55e" : "#f59e0b", fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
            {job.kind === "direct"
              ? "Posted on SeaMinds by a verified company"
              : "Aggregated from a public source — SeaMinds has not verified this employer"}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: "#cbd5e1", marginTop: 14 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Ship size={14} style={{ color: "#94a3b8" }} />{job.vessel}</span>
            {job.port && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><MapPin size={14} style={{ color: "#94a3b8" }} />{job.port}</span>}
            {job.joiningDate && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CalendarDays size={14} style={{ color: "#94a3b8" }} />Joining {fmtDate(job.joiningDate)}</span>}
            {job.duration && <span style={{ color: "#94a3b8" }}>{job.duration}</span>}
          </div>

          {salary && <p style={{ color: "#22c55e", fontWeight: 800, fontSize: 16, marginTop: 12 }}>{salary}</p>}

          {job.notes && (
            <p style={{ color: "#e2e8f0", fontSize: 13.5, lineHeight: 1.65, marginTop: 14, whiteSpace: "pre-wrap" }}>{job.notes}</p>
          )}

          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 14 }}>
            {job.posted && <>Posted {fmtDate(job.posted)}</>}
            {job.expires && <> · Closes {fmtDate(job.expires)}</>}
          </p>

          {job.flier && (
            <a href={job.flier} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, color: GOLD, fontSize: 12.5, fontWeight: 700, textDecoration: "underline" }}>
              View original company flyer
            </a>
          )}

          <button onClick={apply} disabled={applying || !authResolved} style={{
            marginTop: 18, width: "100%", padding: 13, borderRadius: 12, border: "none",
            cursor: applying || !authResolved ? "default" : "pointer",
            opacity: applying || !authResolved ? 0.5 : 1,
            background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            {job.email ? <>✉️ Apply — sent to company email</>
              : job.whatsapp ? <><MessageCircle size={16} /> Apply via WhatsApp</>
              : <><ExternalLink size={16} /> View & Apply</>}
          </button>
        </article>

        {hub && (
          <p style={{ marginTop: 14, fontSize: 12.5 }}>
            <a href={`/jobs/rank/${hub.slug}`} style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>
              → All live {hub.name} vacancies
            </a>
          </p>
        )}

        {similar.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <h2 style={{ color: "#fff", fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Similar vacancies</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {similar.map((s) => (
                <a key={s.id} href={jobPath({ id: s.id, rank: s.rank, vessel: s.vessel, port: s.port })}
                  style={{ display: "block", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "11px 13px", textDecoration: "none" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 13.5 }}>{s.rank}</span>
                  <span style={{ color: GOLD, fontSize: 12 }}> · {s.vessel}</span>
                  <span style={{ color: "#94a3b8", fontSize: 11.5 }}> · {s.port || "Worldwide"}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default JobDetail;
