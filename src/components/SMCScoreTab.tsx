import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { openAssessmentV2, gatewayErrorMessage, type AssessmentMode } from "@/lib/assessmentGateway";
import { EXAM_CONTRACT, SCREENING_LABEL, CV_EVIDENCE_LABEL } from "@/lib/examContract";
import AssessmentFlow from "@/components/smc/AssessmentFlow";

interface SMCScoreTabProps { profileId: string; firstName: string; lastName: string; rank: string; shipName: string }

type Row = {
  id: string; status: string; assessment_mode: AssessmentMode; context_id: string; overall_score: number | null;
  score_band: string | null; certificate_id: string | null; completed_at: string | null; started_at: string | null;
  evidence_snapshot: any;
};
type Invite = { id: string; token: string; cv_request_status: string | null; round_2_assessment_id: string | null; status: string | null };

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", MUTED = "#94A3B8";
const btnPrimary = { background: GOLD, color: NAVY } as const;
const btnSecondary = { background: "transparent", color: GOLD, border: `1px solid ${GOLD}` } as const;

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const badgeFor = (r: Row) =>
  r.evidence_snapshot?.snapshot_type === "historical_legacy" ? "Historical / test" : null;

/** My Score hub — two independent tracks (PROFILE, CV_BASED) + manager Round 2 requests. */
const SMCScoreTab = ({ profileId, firstName, lastName, rank, shipName }: SMCScoreTabProps) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [hasCv, setHasCv] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; mode: AssessmentMode } | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    const [{ data: a }, { data: inv }, { data: cv }] = await Promise.all([
      supabase.from("smc_assessments")
        .select("id, status, assessment_mode, context_id, overall_score, score_band, certificate_id, completed_at, started_at, evidence_snapshot" as any)
        .eq("crew_profile_id", profileId).order("started_at", { ascending: false }),
      supabase.from("interview_invites").select("id, token, cv_request_status, round_2_assessment_id, status" as any)
        .eq("crew_profile_id", profileId).in("cv_request_status", ["REQUESTED", "SUBMITTED"]),
      supabase.from("crew_cv_data").select("certificates, sea_service").eq("user_id", profileId).maybeSingle(),
    ]);
    setRows(((a as any[]) || []) as Row[]);
    setInvites(((inv as any[]) || []) as Invite[]);
    const c: any = cv;
    setHasCv(!!c && ((Array.isArray(c.certificates) && c.certificates.length > 0) || (Array.isArray(c.sea_service) && c.sea_service.length > 0)));
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const start = async (mode: AssessmentMode, restart = false) => {
    if (busy) return;
    if (mode === "CV_BASED" && !hasCv) { toast.error(gatewayErrorMessage("CV_REQUIRED")); return; }
    setBusy(mode);
    try {
      const res = await openAssessmentV2(mode, { restart, crewId: profileId });
      if (!res.ok || !res.assessment_id) {
        if (res.error === "NEED_RANK") { navigate(`/profile?return=${encodeURIComponent("/app?tab=smc")}`); }
        toast.error(gatewayErrorMessage(res.error)); return;
      }
      trackEvent(res.action === "resume" ? "smc_assessment_resume" : "smc_assessment_start", { rank, mode });
      setOpen({ id: res.assessment_id, mode });
    } finally { setBusy(null); }
  };

  if (open) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <AssessmentFlow profileId={profileId} firstName={firstName} lastName={lastName} rank={rank} shipName={shipName}
          assessmentId={open.id}
          onComplete={() => { setOpen(null); load(); }}
          onExit={() => { setOpen(null); load(); }} />
      </div>
    );
  }

  if (!rows) return <div className="flex items-center justify-center h-full text-sm" style={{ color: MUTED }}>Loading your scores…</div>;

  const Track = ({ mode }: { mode: AssessmentMode }) => {
    const mine = rows.filter((r) => r.assessment_mode === mode && r.context_id === "self");
    const active = mine.find((r) => r.status === "in_progress");
    const done = mine.filter((r) => r.status === "completed" && r.overall_score != null);
    const latest = done[0];
    const spec = EXAM_CONTRACT[mode];
    const title = mode === "PROFILE" ? "Sea Profile Score" : "CV-Based Score";
    const sub = mode === "PROFILE" ? "Based on your declared rank and experience. No CV needed." : CV_EVIDENCE_LABEL;
    const cvBlocked = mode === "CV_BASED" && !hasCv;
    return (
      <section aria-label={title} className="rounded-2xl p-4 space-y-3" style={{ background: CARD, border: "1px solid rgba(212,175,55,0.3)" }}>
        <div>
          <h2 className="text-base font-extrabold" style={{ color: GOLD }}>{title}</h2>
          <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{sub}</p>
          <p className="text-[11px]" style={{ color: MUTED }}>{spec.total} questions · about {spec.minutes} min (estimate)</p>
        </div>
        {latest ? (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black" style={{ color: GOLD }}>{Number(latest.overall_score).toFixed(2)}</span>
            <span className="text-xs" style={{ color: MUTED }}>/ 5.00 {latest.score_band ? `· ${latest.score_band}` : ""} · {fmtDate(latest.completed_at)}</span>
            {badgeFor(latest) && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>{badgeFor(latest)}</span>}
          </div>
        ) : (
          <p className="text-xs" style={{ color: MUTED }}>No completed score yet.</p>
        )}
        {cvBlocked ? (
          <button onClick={() => navigate("/app?tab=cv")} className="w-full py-3 rounded-xl font-bold text-sm" style={btnSecondary}>Add your CV to unlock</button>
        ) : (
          <button onClick={() => start(mode)} disabled={!!busy} className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60" style={btnPrimary}>
            {busy === mode ? "Opening…" : active ? "Resume assessment" : latest ? "Retake" : "Start assessment"}
          </button>
        )}
        {active && !cvBlocked && (
          <button onClick={() => start(mode, true)} disabled={!!busy} className="w-full text-[11px] underline" style={{ color: MUTED }}>
            Start over (your unfinished attempt is closed; finished scores are kept)
          </button>
        )}
        {latest?.certificate_id && (
          <button onClick={() => navigate(`/verify/${latest.certificate_id}`)} className="w-full py-2.5 rounded-xl font-bold text-sm" style={btnSecondary}>View certificate</button>
        )}
        {done.length > 1 && (
          <details>
            <summary className="text-xs font-semibold cursor-pointer" style={{ color: GOLD }}>History ({done.length})</summary>
            <ul className="mt-2 space-y-1">
              {done.map((r) => (
                <li key={r.id} className="flex justify-between text-xs" style={{ color: "#e2e8f0" }}>
                  <span>{fmtDate(r.completed_at)} {badgeFor(r) ? `· ${badgeFor(r)}` : ""}</span>
                  <span style={{ color: GOLD }}>{Number(r.overall_score).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    );
  };

  const round2 = invites.filter((i) => {
    const r2 = i.round_2_assessment_id ? rows.find((r) => r.id === i.round_2_assessment_id) : null;
    return !r2 || r2.status === "in_progress";
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      <div>
        <p className="text-[10px] font-extrabold tracking-widest" style={{ color: GOLD }}>MY SCORE</p>
        <p className="text-[11px] mt-1" style={{ color: MUTED }}>{SCREENING_LABEL}. Technical 30% · Judgment 30% · Maritime English 25% · Professional Behaviour 15%.</p>
      </div>
      {round2.map((i) => (
        <section key={i.id} className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.4)" }}>
          <p className="text-sm font-bold text-white">A company requested a CV-Based interview round</p>
          <p className="text-[11px]" style={{ color: MUTED }}>Round 2 · {EXAM_CONTRACT.MANAGER.total} questions · about {EXAM_CONTRACT.MANAGER.minutes} min. Your Round 1 result stays unchanged.</p>
          <button onClick={() => navigate(`/interview/${i.token}/exam?round=2`)} className="w-full py-3 rounded-xl font-bold text-sm" style={btnPrimary}>
            {i.round_2_assessment_id ? "Resume Round 2" : "Review and start Round 2"}
          </button>
        </section>
      ))}
      <Track mode="PROFILE" />
      <Track mode="CV_BASED" />
      <button onClick={() => navigate(`/profile?return=${encodeURIComponent("/app?tab=smc")}`)} className="w-full py-3 rounded-xl font-bold text-sm" style={btnSecondary}>
        👤 My Sea Profile
      </button>
      <div className="h-6" />
    </div>
  );
};

export default SMCScoreTab;
