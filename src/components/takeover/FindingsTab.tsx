import { useMemo, useState } from "react";
import type { AnswerMap } from "@/lib/takeover/answers";
import { BUCKET_LABELS, buildFindings, totalCost, type Severity } from "@/lib/takeover/findings";

const SEVERITY_LABELS: Record<Severity, string> = {
  invalid: "Invalid entry",
  contradiction: "Contradicts assessment",
  shortfall: "Shortfall",
  deficiency: "Deficiency",
  expired: "Certificate problem",
};

const TONE: Record<Severity, string> = {
  invalid: "text-red-300 border-red-400/50",
  contradiction: "text-amber-300 border-amber-400/50",
  shortfall: "text-amber-200 border-amber-400/40",
  deficiency: "text-red-200 border-red-400/40",
  expired: "text-red-200 border-red-400/40",
};

/**
 * Derived view over the existing answers. Nothing is re-entered here and
 * nothing closes automatically — this is not a defect/CAPA register.
 */
export default function FindingsTab({ answers }: { answers: AnswerMap }) {
  const [bucket, setBucket] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");

  const findings = useMemo(() => buildFindings(answers), [answers]);
  const shown = findings.filter(
    (f) => (bucket === "all" || f.bucket === bucket) && (severity === "all" || f.severity === severity)
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-3">
        <p className="text-xs text-[#94A3B8]">
          {findings.length} finding(s) derived from the answers you already recorded — estimated cost so far USD{" "}
          {totalCost(findings).toLocaleString()}. Nothing here is closed automatically; correct the source item to change
          a finding.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["all", ...Object.keys(BUCKET_LABELS)].map((b) => (
          <button
            key={b}
            onClick={() => setBucket(b)}
            className={`shrink-0 min-h-[40px] px-3 rounded-xl text-xs font-semibold border ${
              bucket === b ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "border-[rgba(212,175,55,0.3)] text-slate-300"
            }`}
          >
            {b === "all" ? "All timing" : BUCKET_LABELS[b]}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["all", ...Object.keys(SEVERITY_LABELS)].map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={`shrink-0 min-h-[40px] px-3 rounded-xl text-xs font-semibold border ${
              severity === s ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "border-[rgba(212,175,55,0.3)] text-slate-300"
            }`}
          >
            {s === "all" ? "All types" : SEVERITY_LABELS[s as Severity]}
          </button>
        ))}
      </div>

      {shown.map((f) => (
        <div key={f.key} className={`rounded-2xl bg-[#112240] border p-4 ${TONE[f.severity]}`}>
          <div className="flex justify-between gap-2">
            <span className="text-sm font-semibold text-slate-100">
              {f.group} {f.ref} · {f.title}
            </span>
            <span className="text-[10px] font-bold uppercase shrink-0">{SEVERITY_LABELS[f.severity]}</span>
          </div>
          <p className="text-[11px] text-[#94A3B8]">{f.context}</p>
          <p className="text-sm text-slate-200 mt-1">{f.detail}</p>
          {f.remarks && <p className="text-sm text-slate-300 mt-1">Remarks: {f.remarks}</p>}
          <div className="grid grid-cols-2 gap-x-3 mt-2 text-[11px] text-[#94A3B8]">
            <span>Action: {f.action || "not recorded"}</span>
            <span>Responsible: {f.responsible || "not recorded"}</span>
            <span>Due: {f.due_date || "not set"}</span>
            <span>Cost: {typeof f.cost_usd === "number" ? `USD ${f.cost_usd.toLocaleString()}` : "not estimated"}</span>
            <span>Timing: {BUCKET_LABELS[f.bucket || "unplanned"]}</span>
            <span>Updated: {f.updated_at ? new Date(f.updated_at).toLocaleString() : "not yet saved"}</span>
          </div>
        </div>
      ))}
      {!shown.length && (
        <p className="text-sm text-[#94A3B8] text-center py-6">
          No findings match this filter. That does not mean the inspection is complete — check the Report tab.
        </p>
      )}
    </div>
  );
}
