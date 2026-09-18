import { useMemo, useState } from "react";
import { SAFETY_ITEMS } from "@/lib/takeover/template";
import {
  answerKey,
  computeSafetyShortfall,
  isAnswered,
  validateQuantities,
  type AnswerMap,
  type AnyAnswer,
} from "@/lib/takeover/answers";
import { Camera } from "lucide-react";
import { Guidance, ItemCard, NumberField, OptionGroup, TextField, Label } from "./ui";

interface Props {
  answers: AnswerMap;
  canEdit: boolean;
  photoRefs: Set<string>;
  onUpdate: (ref: string, patch: AnyAnswer) => void;
  onAddPhoto: (ref: string) => void;
}

export default function SafetyTab({ answers, canEdit, photoRefs, onUpdate, onAddPhoto }: Props) {
  const [q, setQ] = useState("");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);

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
        zero.
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
        const expanded = openItem === k;
        return (
          <ItemCard key={i.ref} flagged={d.status === "deficiency" || (shortfall ?? 0) > 0}>
            <button className="w-full text-left" onClick={() => setOpenItem(expanded ? null : k)}>
              <div className="text-sm font-semibold text-slate-100">
                {i.ref}. {i.equipment}
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                {isAnswered("safety", d) ? `Recorded: ${d.status || "quantities only"}` : "Not answered"} · shortfall{" "}
                {shortfall === null ? "unknown" : shortfall}
              </span>
            </button>

            {expanded && (
              <div className="mt-3 space-y-3">
                <Guidance title="Statutory / approved source to compare against" body={i.statutorySource} />
                <Guidance title="Physical / operational check" body={i.check} />
                <Guidance title="Takeover minimum" body={i.takeoverMinimum} />

                <div className="grid grid-cols-3 gap-2">
                  <NumberField label="Required per plan" value={d.required_qty} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { required_qty: v })} error={issues.find((x) => x.field === "required_qty")?.message} />
                  <NumberField label="Onboard" value={d.onboard_qty} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { onboard_qty: v })} error={issues.find((x) => x.field === "onboard_qty")?.message} />
                  <NumberField label="Serviceable" value={d.serviceable_qty} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { serviceable_qty: v })} error={issues.find((x) => x.field === "serviceable_qty")?.message} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Last service / test" type="date" value={d.last_test} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { last_test: v })} />
                  <TextField label="Next due" type="date" value={d.next_due} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { next_due: v })} />
                </div>

                <div>
                  <Label>Status</Label>
                  <OptionGroup
                    options={[
                      { value: "satisfactory", label: "Satisfactory" },
                      { value: "deficiency", label: "Deficiency", tone: "bad" },
                      { value: "not_verified", label: "Not verified", tone: "muted" },
                    ]}
                    value={d.status as any}
                    disabled={!canEdit}
                    onChange={(v) => onUpdate(i.ref, { status: v as any })}
                  />
                </div>

                <TextField label="Remarks / action" multiline value={d.remarks} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { remarks: v })} />
                <button
                  onClick={() => onAddPhoto(i.ref)}
                  disabled={!canEdit}
                  className="min-h-[44px] w-full rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Camera size={16} /> Add photograph {photoRefs.has(k) ? "(attached)" : ""}
                </button>
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
