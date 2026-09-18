import { useMemo, useState } from "react";
import { SPARE_ITEMS } from "@/lib/takeover/template";
import {
  answerKey,
  computeShortfall,
  contradictsAssessment,
  isAnswered,
  isVerified,
  naReasonMissing,
  validateQuantities,
  type AnswerMap,
  type AnyAnswer,
} from "@/lib/takeover/answers";
import type { ItemStatus } from "@/hooks/takeover/useInspection";
import { Guidance, ItemCard, ItemSyncBadge, NumberField, OptionGroup, TextField, Label, WarnNote } from "./ui";

interface Props {
  answers: AnswerMap;
  canEdit: boolean;
  itemStatus: Record<string, ItemStatus>;
  onUpdate: (ref: string, patch: AnyAnswer) => void;
}

export default function SparesTab({ answers, canEdit, itemStatus, onUpdate }: Props) {
  const [q, setQ] = useState("");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [showAction, setShowAction] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return SPARE_ITEMS.filter((i) => {
      const d = answers[answerKey("spares", i.ref)]?.data;
      if (onlyUnanswered && isAnswered("spares", d)) return false;
      return !t || `${i.ref} ${i.system} ${i.spare}`.toLowerCase().includes(t);
    });
  }, [q, onlyUnanswered, answers]);

  return (
    <div>
      <div className="rounded-xl border border-[rgba(212,175,55,0.3)] bg-[#112240] p-3 mb-3">
        <p className="text-xs text-[#94A3B8]">
          Quantities shown as “recommended minimum” come from the template and are recommendations only — they must be
          confirmed against the vessel's maker and flag requirements. Shortfall stays unknown until both the recommended
          minimum and the serviceable quantity are known, and is always based on serviceable units. Recording quantities
          alone is not an assessment: the row stays “not verified” until you choose one.
        </p>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search critical spares"
        className="w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100 mb-2"
      />
      <button
        onClick={() => setOnlyUnanswered((v) => !v)}
        className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border mb-3 ${
          onlyUnanswered ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]" : "border-[rgba(212,175,55,0.3)] text-slate-300"
        }`}
      >
        Unanswered only
      </button>

      {items.map((i) => {
        const k = answerKey("spares", i.ref);
        const d: AnyAnswer = answers[k]?.data || {};
        const shortfall = computeShortfall(d, i.recommendedMinimum);
        const issues = validateQuantities(d);
        const contradiction = contradictsAssessment("spares", d, i.recommendedMinimum);
        const expanded = openItem === k;
        const actionOpen = d.result === "shortfall" || (shortfall ?? 0) > 0 || showAction[k];
        return (
          <ItemCard key={i.ref} flagged={(shortfall ?? 0) > 0 || d.result === "shortfall"}>
            <button className="w-full text-left" onClick={() => setOpenItem(expanded ? null : k)}>
              <div className="flex justify-between gap-3">
                <span className="text-sm font-semibold text-slate-100">
                  {i.ref}. {i.spare}
                </span>
                <span className="text-[10px] shrink-0 text-[#94A3B8] flex flex-col items-end">
                  <span>{i.criticality || ""}</span>
                  <ItemSyncBadge status={itemStatus[k]} />
                </span>
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                {i.system} · shortfall {shortfall === null ? "unknown" : shortfall}
                {isAnswered("spares", d) && !isVerified("spares", d) ? " · recorded, not verified" : ""}
              </span>
            </button>

            {expanded && (
              <div className="mt-3 space-y-3">
                <Guidance title="Applicability / inspection note" body={i.note} />
                <Guidance
                  title="Recommended takeover minimum (template recommendation, not a vessel-approved requirement)"
                  body={i.recommendedMinimum}
                />
                <Guidance title="Alternative acceptable mitigation (not automatically accepted)" body={i.alternativeMitigation} />

                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Actual qty onboard"
                    value={d.actual_qty}
                    disabled={!canEdit}
                    onChange={(v) => onUpdate(i.ref, { actual_qty: v })}
                    error={issues.find((x) => x.field === "actual_qty")?.message}
                  />
                  <NumberField
                    label="Serviceable qty"
                    value={d.serviceable_qty}
                    disabled={!canEdit}
                    onChange={(v) => onUpdate(i.ref, { serviceable_qty: v })}
                    error={issues.find((x) => x.field === "serviceable_qty")?.message}
                  />
                </div>
                {issues.length > 0 && (
                  <WarnNote>
                    Your entry is kept as a draft, but this row cannot count as verified or be submitted until the
                    quantities make sense. The server applies the same rule.
                  </WarnNote>
                )}

                <div>
                  <Label>Assessment</Label>
                  <OptionGroup
                    options={[
                      { value: "ok", label: "Meets requirement" },
                      { value: "shortfall", label: "Shortfall", tone: "bad" },
                      { value: "na", label: "Not applicable", tone: "muted" },
                      { value: "not_verified", label: "Not verified", tone: "muted" },
                    ]}
                    value={d.result as any}
                    disabled={!canEdit}
                    onChange={(v) => onUpdate(i.ref, { result: v as any })}
                  />
                </div>
                {contradiction && (
                  <WarnNote>
                    The serviceable quantity is below the recommended minimum, so a shortfall of {shortfall} is reported
                    as a finding despite “Meets requirement”.
                  </WarnNote>
                )}
                {d.result === "na" && (
                  <>
                    <TextField
                      label="Reason this spare does not apply (required)"
                      multiline
                      value={d.na_reason}
                      disabled={!canEdit}
                      onChange={(v) => onUpdate(i.ref, { na_reason: v })}
                    />
                    {naReasonMissing("spares", d) && <WarnNote>A reason is required.</WarnNote>}
                  </>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!d.mitigation_accepted}
                    disabled={!canEdit}
                    onChange={(e) => onUpdate(i.ref, { mitigation_accepted: e.target.checked })}
                  />
                  Alternative mitigation reviewed and accepted for this vessel
                </label>

                <TextField label="Location / bin" value={d.location} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { location: v })} />
                <TextField label="Remarks" multiline value={d.remarks} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { remarks: v })} />

                {actionOpen ? (
                  <div className="space-y-3 rounded-xl border border-[rgba(212,175,55,0.25)] p-3">
                    <TextField label="Action" multiline value={d.action} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { action: v })} />
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField label="Est. cost USD" value={d.cost_usd} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { cost_usd: v })} />
                      <TextField label="Responsible" value={d.responsible} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { responsible: v })} />
                    </div>
                    <TextField label="Due date" type="date" value={d.due_date} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { due_date: v })} />
                  </div>
                ) : (
                  <button onClick={() => setShowAction((p) => ({ ...p, [k]: true }))} className="text-xs text-[#D4AF37] underline">
                    Add action, owner, due date or cost
                  </button>
                )}

                {i.shortfallFormula && (
                  <p className="text-[10px] text-[#94A3B8]">Source reference formula: {i.shortfallFormula}</p>
                )}
              </div>
            )}
          </ItemCard>
        );
      })}
    </div>
  );
}
