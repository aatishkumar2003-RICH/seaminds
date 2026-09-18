import { useMemo, useState } from "react";
import { CERT_ITEMS } from "@/lib/takeover/template";
import { answerKey, isAnswered, isVerified, type AnswerMap, type AnyAnswer } from "@/lib/takeover/answers";
import type { ItemStatus } from "@/hooks/takeover/useInspection";
import { Guidance, ItemCard, ItemSyncBadge, NumberField, OptionGroup, TextField, Label } from "./ui";

interface Props {
  answers: AnswerMap;
  canEdit: boolean;
  itemStatus: Record<string, ItemStatus>;
  onUpdate: (ref: string, patch: AnyAnswer) => void;
}

export default function CertificatesTab({ answers, canEdit, itemStatus, onUpdate }: Props) {
  const [q, setQ] = useState("");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [showAction, setShowAction] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return CERT_ITEMS.filter((i) => {
      const d = answers[answerKey("certificates", i.ref)]?.data;
      if (onlyUnanswered && isAnswered("certificates", d)) return false;
      return !t || `${i.ref} ${i.certificate}`.toLowerCase().includes(t);
    });
  }, [q, onlyUnanswered, answers]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search certificates & records"
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
        const k = answerKey("certificates", i.ref);
        const d: AnyAnswer = answers[k]?.data || {};
        const expanded = openItem === k;
        const deficient = d.status === "expired" || d.status === "missing";
        const actionOpen = deficient || showAction[k];
        return (
          <ItemCard key={i.ref} flagged={deficient}>
            <button className="w-full text-left" onClick={() => setOpenItem(expanded ? null : k)}>
              <div className="flex justify-between gap-3">
                <span className="text-sm font-semibold text-slate-100">
                  {i.ref}. {i.certificate}
                </span>
                <ItemSyncBadge status={itemStatus[k]} />
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                {!isAnswered("certificates", d)
                  ? "Not answered"
                  : `Recorded: ${d.status || "dates only"}${isVerified("certificates", d) ? "" : " · not verified"}`}
              </span>
            </button>

            {expanded && (
              <div className="mt-3 space-y-3">
                <Guidance title="Check" body={i.check} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Issue date" type="date" value={d.issue_date} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { issue_date: v })} />
                  <TextField label="Expiry" type="date" value={d.expiry_date} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { expiry_date: v })} />
                </div>
                <TextField label="Next due (survey/endorsement)" type="date" value={d.next_due} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { next_due: v })} />
                <div>
                  <Label>Status</Label>
                  <OptionGroup
                    options={[
                      { value: "valid", label: "Valid" },
                      { value: "expired", label: "Expired", tone: "bad" },
                      { value: "missing", label: "Missing", tone: "bad" },
                      { value: "not_sighted", label: "Not sighted", tone: "muted" },
                    ]}
                    value={d.status as any}
                    disabled={!canEdit}
                    onChange={(v) => onUpdate(i.ref, { status: v as any })}
                  />
                </div>
                <TextField label="Evidence sighted" value={d.evidence} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { evidence: v })} />
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
              </div>
            )}
          </ItemCard>
        );
      })}
    </div>
  );
}
