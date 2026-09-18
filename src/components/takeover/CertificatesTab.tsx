import { useMemo, useState } from "react";
import { CERT_ITEMS } from "@/lib/takeover/template";
import { answerKey, isAnswered, type AnswerMap, type AnyAnswer } from "@/lib/takeover/answers";
import { Guidance, ItemCard, OptionGroup, TextField, Label } from "./ui";

interface Props {
  answers: AnswerMap;
  canEdit: boolean;
  onUpdate: (ref: string, patch: AnyAnswer) => void;
}

export default function CertificatesTab({ answers, canEdit, onUpdate }: Props) {
  const [q, setQ] = useState("");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);

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
        return (
          <ItemCard key={i.ref} flagged={d.status === "expired" || d.status === "missing"}>
            <button className="w-full text-left" onClick={() => setOpenItem(expanded ? null : k)}>
              <div className="text-sm font-semibold text-slate-100">
                {i.ref}. {i.certificate}
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                {isAnswered("certificates", d) ? `Recorded: ${d.status}` : "Not answered"}
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
              </div>
            )}
          </ItemCard>
        );
      })}
    </div>
  );
}
