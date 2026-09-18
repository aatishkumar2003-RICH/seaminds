import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CERT_ITEMS,
  MASTER_ITEMS,
  SAFETY_ITEMS,
  SPARE_ITEMS,
  TEMPLATE_ID,
  TEMPLATE_NAME,
  TEMPLATE_VERSION,
  GRADE_LABELS,
  type GroupKey,
} from "@/lib/takeover/template";
import {
  answerKey,
  computeStats,
  hasAssessment,
  isAnswered,
  isNotApplicable,
  isVerified,
  methodLabel,
  type AnswerMap,
} from "@/lib/takeover/answers";
import { buildFindings, titleOf, totalCost, unverifiedRows, BUCKET_LABELS } from "@/lib/takeover/findings";
import { buildCsv, buildJson, download, type EvidenceMeta } from "@/lib/takeover/exports";
import { isPhotoEvidence, signedUrl, SOURCE_LABELS } from "@/lib/takeover/photos";
import type { AttachmentRecord, InspectionRecord, SaveState } from "@/hooks/takeover/useInspection";

interface Props {
  inspection: InspectionRecord;
  answers: AnswerMap;
  attachments: AttachmentRecord[];
  canEdit: boolean;
  saveState: SaveState;
  conflictCount: number;
  flush: () => Promise<{ pending: number; conflicts: number; answerCount: number; versionSum: number }>;
  onSubmitted: () => void;
}

interface ServerLimitations {
  error?: string;
  total?: number;
  unanswered?: number;
  unverified?: number;
  missing_photos?: number;
  invalid_quantities?: number;
  is_partial?: boolean;
  unanswered_items?: string[];
  unverified_items?: string[];
  missing_photo_items?: string[];
  invalid_quantity_items?: string[];
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #takeover-print, #takeover-print * { visibility: visible !important; }
  #takeover-print { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; }
  #takeover-print img { max-height: 220px; page-break-inside: avoid; }
  #takeover-print tr, #takeover-print li { page-break-inside: avoid; }
}
`;

const ALL_ITEMS: [GroupKey, { ref: string }[]][] = [
  ["master", MASTER_ITEMS],
  ["spares", SPARE_ITEMS],
  ["safety", SAFETY_ITEMS],
  ["certificates", CERT_ITEMS],
];

/** Human readable value dump of an answer, actual values only. */
function describe(group: GroupKey, d: any): string {
  const parts: string[] = [];
  if (group === "master") {
    if (d.result) parts.push(`result ${d.result}`);
    if (d.grade) parts.push(`grade ${d.grade} — ${GRADE_LABELS[d.grade as 1 | 2 | 3 | 4]}`);
  }
  if (group === "spares") {
    if (d.result) parts.push(`assessment ${d.result}`);
    parts.push(`onboard ${d.actual_qty ?? "unknown"}`, `serviceable ${d.serviceable_qty ?? "unknown"}`);
    if (d.location) parts.push(`location ${d.location}`);
  }
  if (group === "safety") {
    if (d.status) parts.push(`status ${d.status}`);
    parts.push(
      `required ${d.required_qty ?? "unknown"}`,
      `onboard ${d.onboard_qty ?? "unknown"}`,
      `serviceable ${d.serviceable_qty ?? "unknown"}`
    );
    if (d.last_test) parts.push(`last test ${d.last_test}`);
    if (d.next_due) parts.push(`next due ${d.next_due}`);
  }
  if (group === "certificates") {
    if (d.status) parts.push(`status ${d.status}`);
    if (d.issue_date) parts.push(`issued ${d.issue_date}`);
    if (d.expiry_date) parts.push(`expires ${d.expiry_date}`);
    if (d.next_due) parts.push(`next due ${d.next_due}`);
    if (d.evidence) parts.push(`evidence ${d.evidence}`);
  }
  if (d.methods?.length) parts.push(`method: ${d.methods.map(methodLabel).join(", ")}`);
  else if (group === "master" || group === "safety") parts.push("method unrecorded");
  if (d.test_reading) parts.push(`reading ${d.test_reading}`);
  if (d.na_reason) parts.push(`not applicable because: ${d.na_reason}`);
  return parts.join(" · ");
}

export default function ReportTab({
  inspection,
  answers,
  attachments,
  canEdit,
  saveState,
  conflictCount,
  flush,
  onSubmitted,
}: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [limits, setLimits] = useState<ServerLimitations | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [imgLoaded, setImgLoaded] = useState<Record<string, boolean>>({});

  const submitted = inspection.status === "submitted";
  const snapshot = (inspection.submitted_snapshot as any) || null;
  const snapshotMissing = submitted && !snapshot;

  /**
   * A submitted report is rendered from the frozen server snapshot, never
   * reconstructed from today's mutable answers or a newer template.
   */
  const viewAnswers: AnswerMap = useMemo(() => {
    if (!submitted || !snapshot) return answers;
    const map: AnswerMap = {};
    (snapshot.answers || []).forEach((a: any) => {
      map[answerKey(a.group_key, a.item_ref)] = {
        group_key: a.group_key,
        item_ref: a.item_ref,
        data: a.data || {},
        version: a.version,
        updated_at: a.updated_at,
      };
    });
    return map;
  }, [submitted, snapshot, answers]);

  const viewAttachments: AttachmentRecord[] = useMemo(
    () => (submitted && snapshot ? (snapshot.attachments || []) : attachments),
    [submitted, snapshot, attachments]
  );

  const templateMismatch =
    submitted && snapshot
      ? snapshot.template_id !== TEMPLATE_ID || Number(snapshot.template_version) !== TEMPLATE_VERSION
      : inspection.template_id !== TEMPLATE_ID || inspection.template_version !== TEMPLATE_VERSION;

  const photoRefs = useMemo(
    () =>
      new Set(
        viewAttachments
          .filter((a) => a.group_key && a.item_ref && isPhotoEvidence(a.mime_type))
          .map((a) => `${a.group_key}:${a.item_ref}`)
      ),
    [viewAttachments]
  );
  const stats = useMemo(() => computeStats(viewAnswers, photoRefs), [viewAnswers, photoRefs]);
  const findings = useMemo(() => buildFindings(viewAnswers), [viewAnswers]);

  const recorded = useMemo(
    () =>
      ALL_ITEMS.flatMap(([g, items]) =>
        items
          .filter((i) => isAnswered(g, viewAnswers[answerKey(g, i.ref)]?.data))
          .map((i) => ({ group: g, ref: i.ref, row: viewAnswers[answerKey(g, i.ref)] }))
      ),
    [viewAnswers]
  );

  const unanswered = useMemo(() => unverifiedRows(viewAnswers, (g, d) => !isAnswered(g, d)), [viewAnswers]);
  const unverified = useMemo(
    () => unverifiedRows(viewAnswers, (g, d) => isAnswered(g, d) && !isVerified(g, d)),
    [viewAnswers]
  );
  const excluded = useMemo(() => unverifiedRows(viewAnswers, (g, d) => isNotApplicable(g, d)), [viewAnswers]);

  const images = useMemo(() => viewAttachments.filter((a) => isPhotoEvidence(a.mime_type)), [viewAttachments]);
  const documents = useMemo(() => viewAttachments.filter((a) => !isPhotoEvidence(a.mime_type)), [viewAttachments]);
  const loadedCount = images.filter((a) => imgLoaded[a.id]).length;

  useEffect(() => {
    let live = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const a of images) {
        const u = await signedUrl(a.storage_path);
        if (u) next[a.id] = u;
      }
      if (live) setUrls(next);
    })();
    return () => {
      live = false;
    };
  }, [images]);

  const loadLimits = useCallback(async () => {
    setLimitsLoading(true);
    const { data, error } = await supabase.rpc("takeover_limitations" as any, { p_inspection_id: inspection.id });
    setLimitsLoading(false);
    if (error) {
      setLimits({ error: error.message });
      return;
    }
    setLimits(data as ServerLimitations);
  }, [inspection.id]);

  useEffect(() => {
    if (!submitted) void loadLimits();
  }, [submitted, loadLimits]);

  const evidenceMeta: EvidenceMeta[] = viewAttachments as unknown as EvidenceMeta[];
  const exportHeader = {
    ...(inspection as any),
    template_id: submitted && snapshot ? snapshot.template_id : inspection.template_id,
    template_version: submitted && snapshot ? snapshot.template_version : inspection.template_version,
  };

  const printReport = () => {
    if (images.length && loadedCount < images.length) {
      toast.error(
        `${images.length - loadedCount} photograph(s) are still loading. Wait for them before printing, or the report will be missing evidence.`
      );
      return;
    }
    window.print();
  };

  const submit = async () => {
    if (submitted) return;
    setBusy(true);
    try {
      const state = await flush();
      if (state.conflicts > 0) {
        toast.error("Resolve the editing conflicts before submitting — nothing has been locked.");
        return;
      }
      if (state.pending > 0) {
        toast.error(
          `${state.pending} answer(s) are not on the server yet. Submitting now would freeze an incomplete record.`
        );
        return;
      }
      const fresh = await supabase.rpc("takeover_limitations" as any, { p_inspection_id: inspection.id });
      const lim = fresh.data as ServerLimitations;
      if (fresh.error || lim?.error) {
        toast.error(lim?.error || fresh.error?.message || "Could not check completeness");
        return;
      }
      setLimits(lim);
      if (lim.is_partial && note.trim().length < 20) {
        toast.error("This is a partial inspection. Explain the limitation (at least 20 characters) before submitting.");
        return;
      }

      const { data, error } = await supabase.rpc("takeover_submit" as any, {
        p_inspection_id: inspection.id,
        p_limitation_note: note.trim() || null,
        p_expected_answer_count: state.answerCount,
        p_expected_version_sum: state.versionSum,
      });
      const r = data as any;
      if (error || r?.error) {
        toast.error(r?.error || error?.message || "Submit failed");
        if (r?.stale) onSubmitted();
        return;
      }
      toast.success(r?.is_partial ? "Submitted and locked as a PARTIAL inspection" : "Inspection submitted and locked");
      onSubmitted();
    } finally {
      setBusy(false);
    }
  };

  const blockedReason =
    conflictCount > 0
      ? "Editing conflicts must be resolved first."
      : saveState === "failed"
      ? "Some answers failed to save. Retry before submitting."
      : saveState === "unsynced" || saveState === "saving"
      ? "Answers are still syncing to the server."
      : null;

  const statusLine = submitted
    ? inspection.is_partial
      ? "SUBMITTED — PARTIAL INSPECTION"
      : "SUBMITTED"
    : "DRAFT — not submitted";

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ["Total items", stats.total],
          ["Answered", stats.answered],
          ["Unanswered", stats.unanswered],
          ["Verified", stats.verified],
          ["Recorded, not verified", stats.notVerified],
          ["Findings", findings.length],
          ["Missing required photos", stats.missingPhotos],
          ["Evidence files", viewAttachments.length],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-3">
            <p className="text-[11px] text-[#94A3B8]">{l}</p>
            <p className="text-xl font-bold text-[#D4AF37]">{v as number}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#94A3B8]">
        Every template row is counted, including blank ones. Zero findings does not mean the inspection is complete —
        check the unanswered and not-verified counts.
      </p>

      {snapshotMissing && (
        <div className="rounded-2xl border border-red-400/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-200 font-semibold">
            This submitted report has no frozen snapshot on the server, so its original content cannot be shown
            faithfully. Reconstructing it from today's data would misrepresent what was inspected.
          </p>
        </div>
      )}
      {templateMismatch && !snapshotMissing && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4">
          <p className="text-sm text-amber-200">
            This record was made against template {exportHeader.template_id} v{exportHeader.template_version}, which
            differs from the template loaded in this app ({TEMPLATE_ID} v{TEMPLATE_VERSION}). Wording shown for items may
            not match the original.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={printReport}
          className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold text-sm flex items-center gap-2"
        >
          <Printer size={16} /> Print / PDF report
        </button>
        <button
          onClick={() =>
            download(
              `takeover-${inspection.vessel_name}.csv`,
              buildCsv(exportHeader, viewAnswers, evidenceMeta),
              "text/csv"
            )
          }
          className="min-h-[44px] px-4 rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold text-sm flex items-center gap-2"
        >
          <Download size={16} /> CSV
        </button>
        <button
          onClick={() =>
            download(
              `takeover-${inspection.vessel_name}.json`,
              JSON.stringify(buildJson(exportHeader, viewAnswers, evidenceMeta, snapshot), null, 2),
              "application/json"
            )
          }
          className="min-h-[44px] px-4 rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold text-sm flex items-center gap-2"
        >
          <FileText size={16} /> JSON
        </button>
      </div>
      {images.length > 0 && loadedCount < images.length && (
        <p className="text-xs text-amber-300">
          {loadedCount} of {images.length} photographs loaded. Printing is blocked until every image is loaded.
        </p>
      )}

      {/* ------------------------- printable report ------------------------- */}
      <div id="takeover-print" className="rounded-2xl bg-white text-black p-5 text-[12px] leading-relaxed">
        <h2 className="text-lg font-bold">{TEMPLATE_NAME}</h2>
        <p className="text-[11px]">
          Template {exportHeader.template_id} v{exportHeader.template_version} · report generated{" "}
          {new Date().toLocaleString()}
        </p>
        <p className="mt-1 font-bold">{statusLine}</p>

        <table className="w-full mt-3 border-collapse">
          <tbody>
            {[
              ["Vessel", inspection.vessel_name],
              ["IMO", inspection.imo || "not supplied"],
              ["Flag", inspection.flag || "—"],
              ["Class society", inspection.class_society || "—"],
              ["Port of registry", inspection.port_of_registry || "—"],
              ["Inspector", inspection.inspector_name || "—"],
              ["Inspection start", inspection.started_on],
              ["Record created", new Date(inspection.created_at).toLocaleString()],
              ["Last update", new Date(inspection.updated_at).toLocaleString()],
              [
                "Submitted",
                submitted
                  ? `${new Date(inspection.submitted_at || snapshot?.submitted_at || "").toLocaleString()} by ${
                      snapshot?.submitted_by || inspection.submitted_by || "unknown account"
                    }`
                  : "not submitted",
              ],
            ].map(([l, v]) => (
              <tr key={String(l)} className="border-b border-gray-300">
                <td className="py-1 pr-3 font-semibold w-44">{l}</td>
                <td className="py-1">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-4 font-bold">Completeness</h3>
        <p>
          {stats.total} template rows · {stats.answered} answered · {stats.unanswered} unanswered · {stats.verified}{" "}
          verified · {stats.notVerified} recorded but not verified · {stats.missingPhotos} required photographs missing ·{" "}
          {stats.invalidQuantities} rows with invalid quantities.
        </p>
        {(submitted ? inspection.is_partial : limits?.is_partial) && (
          <p className="font-bold mt-1">
            PARTIAL INSPECTION — this report does not cover every checklist row.
          </p>
        )}
        {(snapshot?.limitation_note || inspection.limitation_note) && (
          <p className="mt-1">
            <span className="font-semibold">Stated limitation: </span>
            {snapshot?.limitation_note || inspection.limitation_note}
          </p>
        )}

        <h3 className="mt-4 font-bold">
          Findings and actions ({findings.length}) · estimated cost USD {totalCost(findings).toLocaleString()}
        </h3>
        {findings.length ? (
          <table className="w-full border-collapse mt-1">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 pr-2">Ref</th>
                <th className="py-1 pr-2">Item</th>
                <th className="py-1 pr-2">Finding</th>
                <th className="py-1 pr-2">Action</th>
                <th className="py-1 pr-2">Responsible</th>
                <th className="py-1 pr-2">Due</th>
                <th className="py-1 pr-2">Timing</th>
                <th className="py-1">Cost USD</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.key} className="border-b border-gray-300 align-top">
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {f.group} {f.ref}
                  </td>
                  <td className="py-1 pr-2">{f.title}</td>
                  <td className="py-1 pr-2">
                    {f.detail}
                    {f.remarks ? ` — ${f.remarks}` : ""}
                  </td>
                  <td className="py-1 pr-2">{f.action || "not recorded"}</td>
                  <td className="py-1 pr-2">{f.responsible || "not recorded"}</td>
                  <td className="py-1 pr-2">{f.due_date || "not set"}</td>
                  <td className="py-1 pr-2">{BUCKET_LABELS[f.bucket || "unplanned"]}</td>
                  <td className="py-1">{typeof f.cost_usd === "number" ? f.cost_usd.toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No findings recorded so far.</p>
        )}

        <h3 className="mt-4 font-bold">Recorded observations ({recorded.length})</h3>
        <table className="w-full border-collapse mt-1">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1 pr-2">Ref</th>
              <th className="py-1 pr-2">Item</th>
              <th className="py-1 pr-2">Recorded values</th>
              <th className="py-1">Observed</th>
            </tr>
          </thead>
          <tbody>
            {recorded.map(({ group, ref, row }) => (
              <tr key={`${group}-${ref}`} className="border-b border-gray-200 align-top">
                <td className="py-1 pr-2 whitespace-nowrap">
                  {group} {ref}
                </td>
                <td className="py-1 pr-2">{titleOf(group, ref)}</td>
                <td className="py-1 pr-2">
                  {describe(group, row?.data || {})}
                  {!hasAssessment(group, row?.data) ? " · no explicit assessment recorded" : ""}
                  {row?.data?.remarks ? ` · remarks: ${row.data.remarks}` : ""}
                </td>
                <td className="py-1 whitespace-nowrap">
                  {row?.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-4 font-bold">Not applicable, with reason ({excluded.length})</h3>
        <ul className="list-disc pl-5">
          {excluded.map((u) => (
            <li key={`${u.group}-${u.ref}`}>
              {u.group} {u.ref} · {u.title} — {viewAnswers[answerKey(u.group, u.ref)]?.data?.na_reason || "NO REASON RECORDED"}
            </li>
          ))}
          {!excluded.length && <li>None</li>}
        </ul>

        <h3 className="mt-4 font-bold">Recorded but not verified ({unverified.length})</h3>
        <p>{unverified.map((u) => `${u.group} ${u.ref} ${u.title}`).join("; ") || "None"}</p>

        <h3 className="mt-4 font-bold">Unanswered items ({unanswered.length})</h3>
        <p>{unanswered.map((u) => `${u.group} ${u.ref} ${u.title}`).join("; ") || "None"}</p>

        <h3 className="mt-4 font-bold">Photographic appendix ({images.length})</h3>
        <div className="grid grid-cols-2 gap-3">
          {images.map((a) => (
            <div key={a.id} className="border border-gray-300 p-2">
              {urls[a.id] ? (
                <img
                  src={urls[a.id]}
                  alt={a.caption || `Evidence ${a.photo_no}`}
                  className="w-full object-contain"
                  onLoad={() => setImgLoaded((p) => ({ ...p, [a.id]: true }))}
                  onError={() => setImgLoaded((p) => ({ ...p, [a.id]: false }))}
                />
              ) : (
                <p className="text-red-700 font-semibold">
                  Photograph P{a.photo_no} could not be loaded — it is NOT included in this printout.
                </p>
              )}
              <p className="mt-1">
                <span className="font-semibold">P{a.photo_no}</span>
                {a.item_ref ? ` · ${a.group_key} ${a.item_ref}` : " · general"} · {a.caption || "no caption"}
              </p>
              <p className="text-[10px]">
                Evidence ID {a.id} · {SOURCE_LABELS[a.source_type] || a.source_type} ·{" "}
                {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {!images.length && <p>No photographs attached.</p>}
        </div>

        <h3 className="mt-4 font-bold">Document evidence ({documents.length})</h3>
        <ul className="list-disc pl-5">
          {documents.map((a) => (
            <li key={a.id}>
              Evidence ID {a.id} · {a.mime_type} · {a.item_ref ? `${a.group_key} ${a.item_ref}` : "general"} ·{" "}
              {a.caption || "no caption"} · {new Date(a.created_at).toLocaleString()} — document evidence, not a
              photograph.
            </li>
          ))}
          {!documents.length && <li>None</li>}
        </ul>

        <p className="mt-4 text-[10px]">
          This is an accountable inspection record, not a flag-approved digital signature or statutory certificate.
          Template minimum quantities are recommendations requiring vessel-specific confirmation, not measured values.
        </p>
      </div>

      {/* ------------------------------ submit ------------------------------ */}
      {submitted ? (
        <div className="rounded-2xl border border-green-500/40 bg-green-500/10 p-4">
          <p className="text-sm text-green-300 font-semibold">
            Submitted {inspection.submitted_at ? new Date(inspection.submitted_at).toLocaleString() : ""} — record
            locked{inspection.is_partial ? " as a PARTIAL inspection" : ""}.
          </p>
          {inspection.limitation_note && (
            <p className="text-xs text-slate-300 mt-1">Limitation: {inspection.limitation_note}</p>
          )}
          <p className="text-xs text-[#94A3B8] mt-2">
            Corrections need a new linked revision. That revision feature is not built yet, so the original stays locked
            rather than allowing silent edits.
          </p>
        </div>
      ) : (
        canEdit && (
          <div className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-100">Submit inspection</p>
              <button onClick={loadLimits} className="text-xs text-[#D4AF37] flex items-center gap-1">
                <RefreshCw size={12} className={limitsLoading ? "animate-spin" : ""} /> Recheck
              </button>
            </div>
            {limits?.error ? (
              <p className="text-xs text-red-300 mb-2">{limits.error}</p>
            ) : (
              <p className="text-xs text-[#94A3B8] mb-2">
                Server check: {limits?.unanswered ?? "…"} unanswered, {limits?.unverified ?? "…"} recorded but not
                verified, {limits?.missing_photos ?? "…"} required photographs missing, {limits?.invalid_quantities ?? "…"}{" "}
                rows with invalid quantities. Submitting locks answers, header and evidence on the server.
              </p>
            )}
            {limits?.is_partial && (
              <p className="text-xs text-amber-300 mb-2">
                This will be recorded as a PARTIAL inspection and marked PARTIAL in the frozen snapshot and every export.
              </p>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Explain the limitation of this partial inspection (required while anything is unanswered, unverified, missing a required photograph or not tested)"
              className="w-full rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 py-2 text-sm text-slate-100"
            />
            {blockedReason && <p className="text-xs text-amber-300 mt-2">{blockedReason}</p>}
            <button
              onClick={submit}
              disabled={busy || !!blockedReason}
              className="mt-3 min-h-[48px] w-full rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold disabled:opacity-60"
            >
              {busy ? "Checking and submitting…" : "Submit and lock"}
            </button>
          </div>
        )
      )}
    </div>
  );
}
