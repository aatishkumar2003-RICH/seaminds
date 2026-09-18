import { useMemo, useState } from "react";
import { SAFETY_ITEMS } from "@/lib/takeover/template";
import {
  answerKey,
  computeSafetyShortfall,
  contradictsAssessment,
  EVIDENCE_METHODS,
  isAnswered,
  isVerified,
  naReasonMissing,
  validateQuantities,
  type AnswerMap,
  type AnyAnswer,
} from "@/lib/takeover/answers";
import type { ItemStatus } from "@/hooks/takeover/useInspection";
import { Camera, ImageIcon } from "lucide-react";
import { Guidance, ItemCard, ItemSyncBadge, MultiSelect, NumberField, OptionGroup, TextField, Label, WarnNote } from "./ui";

interface Props {
  answers: AnswerMap;
  canEdit: boolean;
  photoRefs: Set<string>;
  itemStatus: Record<string, ItemStatus>;
  onUpdate: (ref: string, patch: AnyAnswer) => void;
  onAddPhoto: (ref: string, source: "camera_requested" | "gallery") => void;
}

export default function SafetyTab({ answers, canEdit, photoRefs, itemStatus, onUpdate, onAddPhoto }: Props) {
  const [q, setQ] = useState("");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [showAction, setShowAction] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return SAFETY_ITEMS.filter((i) => {
      const d = answers[answerKey("safety", i.ref)]?.data;
      if (onlyUnanswered && isAnswered("safety", d)) return false;
      return !t || `${i.ref} ${i.equipment} ${i.check || ""}`.toLowerCase().includes(t);
    });
  }, [q, onlyUnanswered, answers]);

  return (
    <div>
      <p className="text-xs text-[#94A3B8] mb-3">
        Quantity required by the approved plan is left blank until confirmed — an unknown requirement is never treated as
        zero. Quantities alone are recorded data, not an assessment.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search safety & emergency"
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
        const k = answerKey("safety", i.ref);
        const d: AnyAnswer = answers[k]?.data || {};
        const shortfall = computeSafetyShortfall(d);
        const issues = validateQuantities(d);
        const contradiction = contradictsAssessment("safety", d);
        const expanded = openItem === k;
        const actionOpen = d.status === "deficiency" || (shortfall ?? 0) > 0 || showAction[k];
        return (
          <ItemCard key={i.ref} flagged={d.status === "deficiency" || (shortfall ?? 0) > 0}>
            <button className="w-full text-left" onClick={() => setOpenItem(expanded ? null : k)}>
              <div className="flex justify-between gap-3">
                <span className="text-sm font-semibold text-slate-100">
                  {i.ref}. {i.equipment}
                </span>
                <ItemSyncBadge status={itemStatus[k]} />
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                {!isAnswered("safety", d)
                  ? "Not answered"
                  : `Recorded: ${d.status || "quantities only"}${isVerified("safety", d) ? "" : " · not verified"}`}{" "}
                · shortfall {shortfall === null ? "unknown" : shortfall}
              </span>
            </button>

            {expanded && (
              <div className="mt-3 space-y-3">
                <Guidance title="Statutory / approved source to compare against" body={i.statutorySource} />
                <Guidance title="Physical / operational check" body={i.check} />
                <Guidance title="Takeover minimum" body={i.takeoverMinimum} />
                <WarnNote>
                  A photograph does not establish that an operational test was carried out. Record the evidence method
                  used; leave it as “Not tested” when no test was witnessed.
                </WarnNote>

                <div className="grid grid-cols-3 gap-2">
                  <NumberField label="Required per plan" value={d.required_qty} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { required_qty: v })} error={issues.find((x) => x.field === "required_qty")?.message} />
                  <NumberField label="Onboard" value={d.onboard_qty} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { onboard_qty: v })} error={issues.find((x) => x.field === "onboard_qty")?.message} />
                  <NumberField label="Serviceable" value={d.serviceable_qty} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { serviceable_qty: v })} error={issues.find((x) => x.field === "serviceable_qty")?.message} />
                </div>
                {issues.length > 0 && (
                  <WarnNote>
                    Your entry is kept as a draft, but this row cannot count as verified or be submitted until the
                    quantities make sense.
                  </WarnNote>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Last service / test" type="date" value={d.last_test} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { last_test: v })} />
                  <TextField label="Next due" type="date" value={d.next_due} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { next_due: v })} />
                </div>

                <div>
                  <Label>Evidence method actually used</Label>
                  <MultiSelect options={EVIDENCE_METHODS} values={d.methods} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { methods: v })} />
                  {!d.methods?.length && <span className="text-[11px] text-[#94A3B8]">Method unrecorded — nothing is assumed.</span>}
                </div>
                <TextField label="Test reading / observation note" value={d.test_reading} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { test_reading: v })} />

                <div>
                  <Label>Status</Label>
                  <OptionGroup
                    options={[
                      { value: "satisfactory", label: "Satisfactory" },
                      { value: "deficiency", label: "Deficiency", tone: "bad" },
                      { value: "na", label: "Not applicable", tone: "muted" },
                      { value: "not_verified", label: "Not verified", tone: "muted" },
                    ]}
                    value={d.status as any}
                    disabled={!canEdit}
                    onChange={(v) => onUpdate(i.ref, { status: v as any })}
                  />
                </div>
                {contradiction && (
                  <WarnNote>
                    Serviceable units are below the quantity required by the approved plan, so a shortfall of {shortfall}{" "}
                    is reported as a finding despite “Satisfactory”.
                  </WarnNote>
                )}
                {d.status === "na" && (
                  <>
                    <TextField label="Reason this item does not apply (required)" multiline value={d.na_reason} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { na_reason: v })} />
                    {naReasonMissing("safety", d) && <WarnNote>A reason is required.</WarnNote>}
                  </>
                )}

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

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => onAddPhoto(i.ref, "camera_requested")} disabled={!canEdit} className="min-h-[44px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    <Camera size={16} /> Camera
                  </button>
                  <button onClick={() => onAddPhoto(i.ref, "gallery")} disabled={!canEdit} className="min-h-[44px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    <ImageIcon size={16} /> Upload
                  </button>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  {photoRefs.has(k) ? "Photograph attached to this item." : "No photograph attached."}
                </p>

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
