import { useMemo, useState } from "react";
import { Camera, ChevronDown, ChevronRight } from "lucide-react";
import { MASTER_ITEMS, MASTER_SECTIONS } from "@/lib/takeover/template";
import { answerKey, isAnswered, isDeficiency, type AnswerMap, type AnyAnswer } from "@/lib/takeover/answers";
import { Guidance, ItemCard, NumberField, OptionGroup, TextField, Label } from "./ui";

type Filter = "all" | "unanswered" | "deficiency" | "critical" | "missing_photo";

interface Props {
  answers: AnswerMap;
  canEdit: boolean;
  photoRefs: Set<string>;
  onUpdate: (ref: string, patch: AnyAnswer) => void;
  onAddPhoto: (ref: string) => void;
}

const RESULTS = [
  { value: "pass" as const, label: "Satisfactory" },
  { value: "deficiency" as const, label: "Deficiency", tone: "bad" as const },
  { value: "na" as const, label: "Not applicable", tone: "muted" as const },
  { value: "not_verified" as const, label: "Not verified", tone: "muted" as const },
];

const GRADES = [
  { value: "1", label: "1 · Good" },
  { value: "2", label: "2 · Fair" },
  { value: "3", label: "3 · Poor" },
  { value: "4", label: "4 · Unacceptable" },
];

export default function MasterTab({ answers, canEdit, photoRefs, onUpdate, onAddPhoto }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({ [MASTER_SECTIONS[0]]: true });
  const [openItem, setOpenItem] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return MASTER_ITEMS.filter((i) => {
      const d = answers[answerKey("master", i.ref)]?.data;
      if (filter === "unanswered" && isAnswered("master", d)) return false;
      if (filter === "deficiency" && !isDeficiency("master", d)) return false;
      if (filter === "critical" && (i.criticality || "").toLowerCase() !== "critical") return false;
      if (filter === "missing_photo" && (!i.photoRequired || photoRefs.has(answerKey("master", i.ref)))) return false;
      if (!term) return true;
      return `${i.ref} ${i.item} ${i.section} ${i.detailedTest || ""}`.toLowerCase().includes(term);
    });
  }, [q, filter, answers, photoRefs]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search master checklist"
        className="w-full min-h-[44px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100 mb-2"
      />
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
        {(
          [
            ["all", "All"],
            ["unanswered", "Unanswered"],
            ["deficiency", "Deficiencies"],
            ["critical", "Critical"],
            ["missing_photo", "Missing photos"],
          ] as [Filter, string][]
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`shrink-0 min-h-[40px] px-3 rounded-xl text-xs font-semibold border ${
              filter === v
                ? "bg-[#D4AF37] text-[#0D1B2A] border-[#D4AF37]"
                : "border-[rgba(212,175,55,0.3)] text-slate-300"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {MASTER_SECTIONS.map((section) => {
        const items = filtered.filter((i) => i.section === section);
        if (!items.length) return null;
        const isOpen = open[section] ?? false;
        return (
          <div key={section} className="mb-3">
            <button
              onClick={() => setOpen((p) => ({ ...p, [section]: !isOpen }))}
              className="w-full flex items-center justify-between gap-2 rounded-xl bg-[#112240] border border-[rgba(212,175,55,0.3)] px-4 py-3 text-left"
            >
              <span className="text-sm font-bold text-[#D4AF37]">{section}</span>
              <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                {items.length}
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            </button>

            {isOpen &&
              items.map((i) => {
                const k = answerKey("master", i.ref);
                const d: AnyAnswer = answers[k]?.data || {};
                const expanded = openItem === k;
                return (
                  <ItemCard key={i.ref} flagged={d.result === "deficiency"}>
                    <button
                      className="w-full text-left"
                      onClick={() => setOpenItem(expanded ? null : k)}
                    >
                      <div className="flex justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-100">
                          {i.ref}. {i.item}
                        </span>
                        <span className="text-[10px] shrink-0 text-[#94A3B8]">
                          {i.criticality || ""}
                          {i.photoRequired ? " · photo" : ""}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#94A3B8]">
                        {isAnswered("master", d) ? `Recorded: ${d.result}` : "Not answered"}
                      </span>
                    </button>

                    {expanded && (
                      <div className="mt-3 space-y-3">
                        <Guidance title="Detailed inspection / test" body={i.detailedTest} />
                        <Guidance title="Takeover acceptance / minimum condition" body={i.acceptance} />
                        <Guidance title="Evidence / records to sight" body={i.evidence} />

                        <div>
                          <Label>Result</Label>
                          <OptionGroup
                            options={RESULTS}
                            value={d.result}
                            disabled={!canEdit}
                            onChange={(v) => onUpdate(i.ref, { result: v })}
                          />
                        </div>

                        <div>
                          <Label>Condition grade (separate from Not verified)</Label>
                          <OptionGroup
                            options={GRADES as any}
                            value={d.grade ? String(d.grade) : undefined}
                            disabled={!canEdit}
                            onChange={(v) => onUpdate(i.ref, { grade: Number(v) as any })}
                          />
                        </div>

                        <TextField label="Remarks / deficiency" multiline value={d.remarks} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { remarks: v })} />
                        <TextField label="Immediate action / recommendation" multiline value={d.action} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { action: v })} />
                        <div className="grid grid-cols-2 gap-3">
                          <NumberField label="Est. cost USD" value={d.cost_usd} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { cost_usd: v })} />
                          <TextField label="Responsible" value={d.responsible} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { responsible: v })} />
                        </div>
                        <TextField label="Due date" type="date" value={d.due_date} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { due_date: v })} />

                        <button
                          onClick={() => onAddPhoto(i.ref)}
                          disabled={!canEdit}
                          className="min-h-[44px] w-full rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Camera size={16} /> Add photograph
                          {photoRefs.has(k) ? " (attached)" : i.photoRequired ? " (required)" : ""}
                        </button>
                      </div>
                    )}
                  </ItemCard>
                );
              })}
          </div>
        );
      })}
      {!filtered.length && <p className="text-sm text-[#94A3B8] py-6 text-center">No items match this filter.</p>}
    </div>
  );
}
