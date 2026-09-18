import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CERT_ITEMS,
  MASTER_ITEMS,
  SAFETY_ITEMS,
  SPARE_ITEMS,
  TEMPLATE_ID,
  TEMPLATE_NAME,
  TEMPLATE_VERSION,
  type GroupKey,
} from "@/lib/takeover/template";
import {
  answerKey,
  computeStats,
  isAnswered,
  isDeficiency,
  isVerified,
  type AnswerMap,
} from "@/lib/takeover/answers";
import { buildCsv, buildJson, download } from "@/lib/takeover/exports";
import type { AttachmentRecord, InspectionRecord } from "@/hooks/takeover/useInspection";

interface Props {
  inspection: InspectionRecord;
  answers: AnswerMap;
  attachments: AttachmentRecord[];
  canEdit: boolean;
  onSubmitted: () => void;
}

const titleOf = (g: GroupKey, ref: string) => {
  if (g === "master") return MASTER_ITEMS.find((i) => i.ref === ref)?.item || ref;
  if (g === "spares") return SPARE_ITEMS.find((i) => i.ref === ref)?.spare || ref;
  if (g === "safety") return SAFETY_ITEMS.find((i) => i.ref === ref)?.equipment || ref;
  return CERT_ITEMS.find((i) => i.ref === ref)?.certificate || ref;
};

export default function ReportTab({ inspection, answers, attachments, canEdit, onSubmitted }: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const photoRefs = useMemo(
    () => new Set(attachments.filter((a) => a.group_key && a.item_ref).map((a) => `${a.group_key}:${a.item_ref}`)),
    [attachments]
  );
  const stats = useMemo(() => computeStats(answers, photoRefs), [answers, photoRefs]);

  const findings = useMemo(() => {
    const out: { group: GroupKey; ref: string; title: string; remarks?: string; action?: string }[] = [];
    Object.values(answers).forEach((a) => {
      if (isDeficiency(a.group_key, a.data))
        out.push({
          group: a.group_key,
          ref: a.item_ref,
          title: titleOf(a.group_key, a.item_ref),
          remarks: (a.data as any).remarks,
          action: (a.data as any).action,
        });
    });
    return out;
  }, [answers]);

  const unanswered = useMemo(() => {
    const groups: [GroupKey, { ref: string }[]][] = [
      ["master", MASTER_ITEMS],
      ["spares", SPARE_ITEMS],
      ["safety", SAFETY_ITEMS],
      ["certificates", CERT_ITEMS],
    ];
    const out: { group: GroupKey; ref: string; title: string }[] = [];
    groups.forEach(([g, items]) =>
      items.forEach((i) => {
        const d = answers[answerKey(g, i.ref)]?.data;
        if (!isAnswered(g, d) || !isVerified(g, d)) out.push({ group: g, ref: i.ref, title: titleOf(g, i.ref) });
      })
    );
    return out;
  }, [answers]);

  const submit = async () => {
    if (inspection.status === "submitted") return;
    if (stats.unanswered > 0 && note.trim().length < 20) {
      toast.error("Explain the limitation of this partial inspection (at least 20 characters) before submitting.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("takeover_submit" as any, {
      p_inspection_id: inspection.id,
      p_limitation_note: note.trim() || null,
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Submit failed");
      return;
    }
    toast.success("Inspection submitted and locked");
    onSubmitted();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ["Total items", stats.total],
          ["Answered", stats.answered],
          ["Unanswered", stats.unanswered],
          ["Verified", stats.verified],
          ["Not verified", stats.notVerified],
          ["Deficiencies", stats.deficiencies],
          ["Missing required photos", stats.missingPhotos],
          ["Evidence files", attachments.length],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-3">
            <p className="text-[11px] text-[#94A3B8]">{l}</p>
            <p className="text-xl font-bold text-[#D4AF37]">{v as number}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#94A3B8]">
        Every template row is counted, including blank ones. Zero deficiencies does not mean the inspection is complete —
        check the unanswered count.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => window.print()}
          className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold text-sm flex items-center gap-2"
        >
          <Printer size={16} /> Print / PDF report
        </button>
        <button
          onClick={() => download(`takeover-${inspection.vessel_name}.csv`, buildCsv(inspection as any, answers), "text/csv")}
          className="min-h-[44px] px-4 rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold text-sm flex items-center gap-2"
        >
          <Download size={16} /> CSV
        </button>
        <button
          onClick={() =>
            download(
              `takeover-${inspection.vessel_name}.json`,
              JSON.stringify(buildJson(inspection as any, answers), null, 2),
              "application/json"
            )
          }
          className="min-h-[44px] px-4 rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] font-bold text-sm flex items-center gap-2"
        >
          <FileText size={16} /> JSON
        </button>
      </div>

      <div className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4 print:bg-white print:text-black">
        <h2 className="text-lg font-bold text-[#D4AF37]">{TEMPLATE_NAME}</h2>
        <p className="text-xs text-[#94A3B8]">
          Template {TEMPLATE_ID} v{TEMPLATE_VERSION}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-slate-200">
          <p>Vessel: {inspection.vessel_name}</p>
          <p>IMO: {inspection.imo || "not supplied"}</p>
          <p>Flag: {inspection.flag || "—"}</p>
          <p>Class: {inspection.class_society || "—"}</p>
          <p>Port of registry: {inspection.port_of_registry || "—"}</p>
          <p>Inspector: {inspection.inspector_name || "—"}</p>
          <p>Inspection start: {inspection.started_on}</p>
          <p>Status: {inspection.status}</p>
        </div>

        <h3 className="mt-4 text-sm font-bold text-[#D4AF37]">Findings and actions ({findings.length})</h3>
        {findings.length ? (
          <ul className="text-sm text-slate-200 list-disc pl-5">
            {findings.map((f) => (
              <li key={`${f.group}-${f.ref}`}>
                [{f.group} {f.ref}] {f.title}
                {f.remarks ? ` — ${f.remarks}` : ""}
                {f.action ? ` · Action: ${f.action}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-300">No deficiencies recorded so far.</p>
        )}

        <h3 className="mt-4 text-sm font-bold text-[#D4AF37]">
          Unanswered or unverified items ({unanswered.length})
        </h3>
        <p className="text-xs text-slate-300">
          {unanswered
            .slice(0, 400)
            .map((u) => `${u.group} ${u.ref}`)
            .join(", ") || "None"}
        </p>

        <h3 className="mt-4 text-sm font-bold text-[#D4AF37]">Photo appendix ({attachments.length})</h3>
        <ul className="text-xs text-slate-300">
          {attachments.map((a) => (
            <li key={a.id}>
              P{a.photo_no} · {a.group_key || "general"} {a.item_ref || ""} · {a.caption || "no caption"} ·{" "}
              {new Date(a.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>

      {inspection.status === "submitted" ? (
        <div className="rounded-2xl border border-green-500/40 bg-green-500/10 p-4">
          <p className="text-sm text-green-300 font-semibold">
            Submitted {inspection.submitted_at ? new Date(inspection.submitted_at).toLocaleString() : ""} — record locked.
          </p>
          {inspection.limitation_note && (
            <p className="text-xs text-slate-300 mt-1">Limitation: {inspection.limitation_note}</p>
          )}
          <p className="text-xs text-[#94A3B8] mt-2">
            Corrections need a new linked revision. That revision feature is not built yet, so the original stays locked
            rather than allowing silent edits. This is an accountable submission record, not a flag-approved digital
            signature or statutory certificate.
          </p>
        </div>
      ) : (
        canEdit && (
          <div className="rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-4">
            <p className="text-sm font-semibold text-slate-100 mb-1">Submit inspection</p>
            <p className="text-xs text-[#94A3B8] mb-2">
              {stats.unanswered} items are still unanswered and {stats.missingPhotos} required photographs are missing.
              Submitting locks answers, header and evidence on the server.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Explain the limitation of this partial inspection (required when items are unanswered)"
              className="w-full rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 py-2 text-sm text-slate-100"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="mt-3 min-h-[48px] w-full rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit and lock"}
            </button>
          </div>
        )
      )}
    </div>
  );
}
