// R6 — Assessment Operations Control Room (admin only). All data and actions go through
// admin-checked server functions; this screen never receives answer keys, rubrics or recovery tokens.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

const GOLD = "#D4AF37", CARD = "#112240", MUTED = "#94A3B8", BORDER = "rgba(212,175,55,0.3)";
const STATUSES = ["ACTIVE", "USER_PAUSED", "CONNECTIVITY_INTERRUPTED", "SYSTEM_INTERRUPTED", "UNATTRIBUTED_INTERRUPTION", "HEALTH_BLOCKED",
  "RECOVERABLE", "NOTIFIED_AWAITING", "RESUMED", "SCORING_PENDING", "SCORING_RETRY_REQUIRED", "COMPLETED_SCORED", "CLOSED_ASSISTED"];
const LABEL: Record<string, string> = {
  ACTIVE: "Active / In assessment", USER_PAUSED: "User paused", CONNECTIVITY_INTERRUPTED: "Connectivity interrupted",
  SYSTEM_INTERRUPTED: "System interrupted", UNATTRIBUTED_INTERRUPTION: "Unattributed interruption", HEALTH_BLOCKED: "Health blocked",
  RECOVERABLE: "Recoverable", NOTIFIED_AWAITING: "Notified / awaiting candidate", RESUMED: "Resumed", SCORING_PENDING: "Scoring pending",
  SCORING_RETRY_REQUIRED: "Scoring retry required", COMPLETED_SCORED: "Completed & scored", CLOSED_ASSISTED: "Closed / assisted",
};
const tone = (s: string) => ["SYSTEM_INTERRUPTED", "HEALTH_BLOCKED", "SCORING_RETRY_REQUIRED"].includes(s) ? "#ef4444"
  : ["CONNECTIVITY_INTERRUPTED", "UNATTRIBUTED_INTERRUPTION", "SCORING_PENDING", "NOTIFIED_AWAITING", "USER_PAUSED"].includes(s) ? "#f59e0b"
  : ["COMPLETED_SCORED", "RESUMED", "RECOVERABLE"].includes(s) ? "#22c55e" : MUTED;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

function Stat({ label, value, bad }: { label: string; value: any; bad?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#0D1B2A", border: `1px solid ${bad ? "#ef4444" : BORDER}` }}>
      <div className="text-xs" style={{ color: MUTED }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: bad ? "#ef4444" : GOLD }}>{String(value)}</div>
    </div>
  );
}

export default function AssessmentOpsTab() {
  const [ready, setReady] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState(""); const [mode, setMode] = useState(""); const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([
      rpc("admin_ops_readiness"),
      rpc("admin_ops_list", { p_search: q || null, p_mode: mode || null, p_status: status || null, p_limit: 150 }),
    ]);
    if (r.error || l.error) { setDenied(true); return; }
    setDenied(false); setReady(r.data); setRows((l.data as any[]) || []);
  }, [q, mode, status]);
  useEffect(() => { load(); }, [load]);

  const openRow = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setTimeline([]);
    const { data } = await rpc("admin_ops_timeline", { p_assessment_id: id });
    setTimeline((data as any[]) || []);
  };

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    try {
      const { data, error } = await fn();
      if (error) toast.error(error.message || "Action failed");
      else if (data && data.ok === false) toast.error(`Not done: ${data.error_code || "blocked"}`);
      else {
        const blockers = data?.blockers?.length ? ` — blockers: ${data.blockers.join(", ")}` : "";
        toast.success(okMsg + blockers);
      }
    } finally { setBusy(false); await load(); if (open) { const { data } = await rpc("admin_ops_timeline", { p_assessment_id: open }); setTimeline((data as any[]) || []); } }
  };

  const reissue = (r: any) => {
    const reason = window.prompt("Reason for controlled reissue (required). The old paper and answers are kept, never deleted:");
    if (!reason || reason.trim().length < 5) { toast.error("A reason of at least 5 characters is required"); return; }
    let policy: string | null = null;
    if (r.answered > 0) {
      const p = window.prompt(`This paper has ${r.answered} saved answer(s). Type 1 = RETAIN answers for review, 2 = VOID / set aside with audit:`);
      policy = p === "1" ? "RETAIN_ANSWERS_FOR_REVIEW" : p === "2" ? "VOID_PRIOR_ANSWERS_AUDITED" : null;
      if (!policy) { toast.error("Policy selection required — reissue cancelled"); return; }
    }
    if (!window.confirm("Issue a new paper version for this assessment?")) return;
    act(() => rpc("admin_reissue_paper", { p_assessment_id: r.assessment_id, p_reason: reason.trim(), p_policy: policy }), "Paper superseded; candidate gets a new version on next Start");
  };

  const close = (r: any) => {
    const reason = window.prompt("Reason for marking assisted/closed (required):");
    if (!reason || reason.trim().length < 5) { toast.error("A reason of at least 5 characters is required"); return; }
    act(() => rpc("admin_ops_action", { p_assessment_id: r.assessment_id, p_action: "CLOSE_ASSISTED", p_reason: reason.trim() }), "Case closed and audited");
  };

  const sendTest = (r: any) => {
    if (!window.confirm("Send a [TEST] recovery email to YOUR OWN admin address? It only sends if the health check passes.")) return;
    act(() => supabase.functions.invoke("recovery-notify", { body: { assessmentId: r.assessment_id } })
      .then(({ data, error }) => ({ data: error ? { ok: false, error_code: "SEND_REJECTED" } : (data?.processed ? data : { ok: false, error_code: "NOT_DUE_OR_HEALTH_BLOCKED" }), error: null })),
      "[TEST] recovery processed");
  };

  if (denied) return <p className="p-6" style={{ color: "#ef4444" }}>Admin access required.</p>;

  const blocked = ready?.production_blocked;
  return (
    <div className="space-y-4 pt-4">
      {ready && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold" style={{ color: GOLD }}>Operational readiness</h2>
            <Button size="sm" variant="outline" onClick={load} style={{ borderColor: GOLD, color: GOLD }}>Refresh</Button>
          </div>
          {blocked && (
            <div className="rounded-xl p-3 font-bold text-sm" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", color: "#fca5a5" }}>
              PRODUCTION ASSESSMENTS BLOCKED — governed question inventory is not approved/complete.
              <div className="font-normal text-xs mt-1">Active production blueprints: {ready.production_active_blueprints} · SME-approved active questions: {ready.sme_approved_active_items}. Candidates will see "paper not ready" until both exist.</div>
            </div>
          )}
          {!ready.support_contact_verified && (
            <div className="rounded-xl p-3 text-sm" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid #f59e0b", color: "#fcd34d" }}>
              Recovery support email not configured/verified. Recovery emails go out without a support line.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Supported canonical ranks" value={ready.canonical_rank_count} />
            <Stat label="Production ACTIVE blueprints" value={ready.production_active_blueprints} bad={!ready.production_active_blueprints} />
            <Stat label="SME-approved active questions" value={ready.sme_approved_active_items} bad={!ready.sme_approved_active_items} />
            <Stat label="TEST blueprints (admin only)" value={ready.test_blueprints} />
            <Stat label="Scoring jobs pending" value={ready.scoring_jobs_pending} />
            <Stat label="Dead-letter jobs" value={ready.scoring_jobs_dead} bad={ready.scoring_jobs_dead > 0} />
            <Stat label="Retry required / manual review" value={`${ready.answers_retry_required} / ${ready.answers_manual_review}`} bad={ready.answers_manual_review > 0} />
            <Stat label="Open recovery cases" value={`${ready.open_recovery_cases} (${ready.health_blocked_cases} blocked)`} />
            <Stat label="Support contact" value={ready.support_contact_verified ? "Verified" : ready.support_contact_configured ? "Not verified" : "Not configured"} bad={!ready.support_contact_verified} />
            <Stat label="Last email provider error" value={ready.recovery_email_last_error || "None recorded"} bad={!!ready.recovery_email_last_error} />
            <Stat label="Active paper backoffs" value={ready.active_backoffs} bad={ready.active_backoffs > 0} />
          </div>
        </div>
      )}

      <div className="rounded-xl p-3 text-xs" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
        <b style={{ color: GOLD }}>TEST workflow:</b> on a row marked TEST (your own test paper) → "TEST: simulate interruption" → "Health check" → watch the status →
        optionally "Send [TEST] recovery to me". Test actions are refused on real candidate papers.
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <Input placeholder="Search name, email, assessment ID, rank" value={q} onChange={(e) => setQ(e.target.value)} className="bg-transparent" style={{ borderColor: BORDER, color: "#fff" }} />
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-md px-2 py-2 text-sm" style={{ background: CARD, color: GOLD, border: `1px solid ${BORDER}` }}>
          <option value="">All modes</option><option value="SMC">SMC self-service</option><option value="COMPANY">Company interview</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md px-2 py-2 text-sm" style={{ background: CARD, color: GOLD, border: `1px solid ${BORDER}` }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm" style={{ color: MUTED }}>No assessments match.</p>}
        {rows.map((r) => (
          <div key={r.assessment_id} className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <button className="w-full text-left" onClick={() => openRow(r.assessment_id)}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{r.candidate_name || "Unknown"}</span>
                {r.is_test && <span className="text-[10px] font-bold px-2 rounded" style={{ background: "#f59e0b", color: "#0D1B2A" }}>TEST</span>}
                <span className="text-[11px] px-2 rounded" style={{ border: `1px solid ${BORDER}`, color: GOLD }}>{r.mode}</span>
                <span className="text-[11px] font-bold px-2 rounded" style={{ color: tone(r.ops_status), border: `1px solid ${tone(r.ops_status)}` }}>{LABEL[r.ops_status] || r.ops_status}</span>
              </div>
              <div className="text-xs mt-1" style={{ color: MUTED }}>
                {r.candidate_email || "—"} · {r.canonical_rank || "rank unresolved"}{r.department ? ` · ${r.department}` : ""}{r.level ? ` · ${r.level}` : ""}{r.vessel_context ? ` · ${r.vessel_context}` : ""}
              </div>
              <div className="text-xs" style={{ color: MUTED }}>
                Paper v{r.paper_version ?? "—"} · {r.answered}/{r.total} answered · scoring open {r.scoring_open}{r.retry_required ? ` (retry ${r.retry_required}, max attempts ${r.max_scoring_attempts})` : ""} · last activity {fmt(r.last_activity)}
              </div>
            </button>
            {open === r.assessment_id && (
              <div className="mt-3 space-y-3 text-xs" style={{ color: MUTED }}>
                <div className="font-mono break-all">Assessment {r.assessment_id}</div>
                <div>Interruption: {r.interruption?.state || "none"}{r.interruption?.reason ? ` (${r.interruption.reason})` : ""} · {fmt(r.interruption?.at)}</div>
                <div>
                  Recovery: {r.recovery ? `${r.recovery.status} · reminders ${r.recovery.reminders_sent} · next ${fmt(r.recovery.next_action_at)} · health ${r.recovery.health_ok === true ? "OK" : r.recovery.health_ok === false ? "BLOCKED" : "not yet checked"}` : "no case"}
                  {r.recovery?.blockers?.length ? <span style={{ color: "#ef4444" }}> · blockers: {r.recovery.blockers.join(", ")}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={() => act(() => rpc("admin_ops_action", { p_assessment_id: r.assessment_id, p_action: "HEALTH_CHECK" }), "Health check recorded")} style={{ background: GOLD, color: "#0D1B2A", fontWeight: 700 }}>Health check</Button>
                  <Button size="sm" disabled={busy || !r.recovery} variant="outline" onClick={() => act(() => rpc("admin_ops_action", { p_assessment_id: r.assessment_id, p_action: "REQUEUE_RECOVERY", p_reason: "admin requeue" }), "Queued for governed recovery (sends only if healthy)")} style={{ borderColor: GOLD, color: GOLD }}>Requeue recovery</Button>
                  <Button size="sm" disabled={busy || !r.paper_version} variant="outline" onClick={() => reissue(r)} style={{ borderColor: GOLD, color: GOLD }}>Controlled reissue</Button>
                  <Button size="sm" disabled={busy || !r.recovery} variant="outline" onClick={() => close(r)} style={{ borderColor: GOLD, color: GOLD }}>Mark assisted / closed</Button>
                  {r.is_test && <>
                    <Button size="sm" disabled={busy} variant="outline" onClick={() => act(() => rpc("admin_ops_test_simulate", { p_assessment_id: r.assessment_id }), "TEST interruption recorded")} style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>TEST: simulate interruption</Button>
                    <Button size="sm" disabled={busy || !r.recovery} variant="outline" onClick={() => sendTest(r)} style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>Send [TEST] recovery to me</Button>
                  </>}
                </div>
                <div>
                  <div className="font-semibold mb-1" style={{ color: GOLD }}>Audit timeline</div>
                  {timeline.length === 0 ? <div>No events.</div> : timeline.slice(0, 30).map((t, i) => (
                    <div key={i} className="flex gap-2 border-b py-1" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
                      <span className="shrink-0">{fmt(t.at)}</span>
                      <span className="text-white">{t.event}{t.to ? ` → ${t.to}` : ""}</span>
                      {t.reason && <span>({t.reason})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
