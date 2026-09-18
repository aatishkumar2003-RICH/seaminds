import { useMemo, useState } from "react";
import { Camera, ChevronDown, ChevronRight, ImageIcon } from "lucide-react";
import { MASTER_ITEMS, MASTER_SECTIONS, GRADE_OPTIONS } from "@/lib/takeover/template";
import {
  answerKey,
  EVIDENCE_METHODS,
  isAnswered,
  isDeficiency,
  isVerified,
  naReasonMissing,
  type AnswerMap,
  type AnyAnswer,
} from "@/lib/takeover/answers";
import type { ItemStatus } from "@/hooks/takeover/useInspection";
import { Guidance, ItemCard, ItemSyncBadge, MultiSelect, NumberField, OptionGroup, TextField, Label, WarnNote } from "./ui";

type Filter = "all" | "unanswered" | "deficiency" | "critical" | "missing_photo" | "unverified";

interface Props {
  answers: AnswerMap;
  canEdit: boolean;
  photoRefs: Set<string>;
  itemStatus: Record<string, ItemStatus>;
  onUpdate: (ref: string, patch: AnyAnswer) => void;
  onAddPhoto: (ref: string, source: "camera_requested" | "gallery") => void;
}

const RESULTS = [
  { value: "pass" as const, label: "Satisfactory" },
  { value: "deficiency" as const, label: "Deficiency", tone: "bad" as const },
  { value: "na" as const, label: "Not applicable", tone: "muted" as const },
  { value: "not_verified" as const, label: "Not verified", tone: "muted" as const },
];

const BUCKETS = [
  { value: "immediate", label: "Immediate" },
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
  { value: "90d", label: "90 days" },
  { value: "drydock", label: "Drydock" },
];

export default function MasterTab({ answers, canEdit, photoRefs, itemStatus, onUpdate, onAddPhoto }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({ [MASTER_SECTIONS[0]]: true });
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [showAction, setShowAction] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return MASTER_ITEMS.filter((i) => {
      const d = answers[answerKey("master", i.ref)]?.data;
      if (filter === "unanswered" && isAnswered("master", d)) return false;
      if (filter === "unverified" && isVerified("master", d)) return false;
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
            ["unverified", "Not verified"],
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
                const deficient = d.result === "deficiency";
                const critical = (i.criticality || "").toLowerCase() === "critical";
                const actionOpen = deficient || showAction[k];
                return (
                  <ItemCard key={i.ref} flagged={deficient}>
                    <button className="w-full text-left" onClick={() => setOpenItem(expanded ? null : k)}>
                      <div className="flex justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-100">
                          {i.ref}. {i.item}
                        </span>
                        <span className="text-[10px] shrink-0 text-[#94A3B8] flex flex-col items-end">
                          <span>
                            {i.criticality || ""}
                            {i.photoRequired ? " · photo required" : ""}
                          </span>
                          <ItemSyncBadge status={itemStatus[k]} />
                        </span>
                      </div>
                      <span className="text-[11px] text-[#94A3B8]">
                        {!isAnswered("master", d)
                          ? "Not answered"
                          : `Recorded: ${d.result}${isVerified("master", d) ? "" : " · not verified"}`}
                        {d.methods?.length ? ` · ${d.methods.length} evidence method(s)` : " · method unrecorded"}
                      </span>
                    </button>

                    {expanded && (
                      <div className="mt-3 space-y-3">
                        <Guidance title="Detailed inspection / test" body={i.detailedTest} />
                        <Guidance title="Takeover acceptance / minimum condition" body={i.acceptance} />
                        <Guidance title="Evidence / records to sight" body={i.evidence} />
                        {critical && (
                          <WarnNote>
                            Critical item. A photograph shows a condition at one moment — it does not establish that an
                            operational test was carried out. Record the evidence method used, and leave it as “Not
                            tested” if no test was witnessed.
                          </WarnNote>
                        )}

                        <div>
                          <Label>Result</Label>
                          <OptionGroup
                            options={RESULTS}
                            value={d.result as any}
                            disabled={!canEdit}
                            onChange={(v) => onUpdate(i.ref, { result: v })}
                          />
                        </div>

                        {d.result === "na" && (
                          <>
                            <TextField
                              label="Reason this item does not apply (required)"
                              multiline
                              value={d.na_reason}
                              disabled={!canEdit}
                              onChange={(v) => onUpdate(i.ref, { na_reason: v })}
                            />
                            {naReasonMissing("master", d) && (
                              <WarnNote>A reason is required. The row stays visible in the report as excluded.</WarnNote>
                            )}
                          </>
                        )}

                        <div>
                          <Label>Evidence method actually used</Label>
                          <MultiSelect
                            options={EVIDENCE_METHODS}
                            values={d.methods}
                            disabled={!canEdit}
                            onChange={(v) => onUpdate(i.ref, { methods: v })}
                          />
                          {!d.methods?.length && (
                            <span className="text-[11px] text-[#94A3B8]">Method unrecorded — nothing is assumed.</span>
                          )}
                        </div>
                        <TextField
                          label="Test reading / observation note"
                          value={d.test_reading}
                          disabled={!canEdit}
                          onChange={(v) => onUpdate(i.ref, { test_reading: v })}
                        />

                        <div>
                          <Label>Condition grade (source workbook wording; separate from Not verified)</Label>
                          <OptionGroup
                            options={GRADE_OPTIONS as any}
                            value={d.grade ? String(d.grade) : undefined}
                            disabled={!canEdit}
                            onChange={(v) => onUpdate(i.ref, { grade: Number(v) as any })}
                          />
                        </div>

                        <TextField label="Remarks / deficiency" multiline value={d.remarks} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { remarks: v })} />

                        {actionOpen ? (
                          <div className="space-y-3 rounded-xl border border-[rgba(212,175,55,0.25)] p-3">
                            <TextField label="Immediate action / recommendation" multiline value={d.action} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { action: v })} />
                            <div>
                              <Label>Planning bucket</Label>
                              <OptionGroup options={BUCKETS as any} value={d.bucket as any} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { bucket: v as any })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <NumberField label="Est. cost USD" value={d.cost_usd} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { cost_usd: v })} />
                              <TextField label="Responsible" value={d.responsible} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { responsible: v })} />
                            </div>
                            <TextField label="Due date" type="date" value={d.due_date} disabled={!canEdit} onChange={(v) => onUpdate(i.ref, { due_date: v })} />
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowAction((p) => ({ ...p, [k]: true }))}
                            className="text-xs text-[#D4AF37] underline"
                          >
                            Add action, owner, due date or cost
                          </button>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => onAddPhoto(i.ref, "camera_requested")}
                            disabled={!canEdit}
                            className="min-h-[44px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <Camera size={16} /> Camera
                          </button>
                          <button
                            onClick={() => onAddPhoto(i.ref, "gallery")}
                            disabled={!canEdit}
                            className="min-h-[44px] rounded-xl border border-[rgba(212,175,55,0.3)] text-[#D4AF37] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <ImageIcon size={16} /> Upload
                          </button>
                        </div>
                        <p className="text-[11px] text-[#94A3B8]">
                          {photoRefs.has(k)
                            ? "Photograph attached to this item."
                            : i.photoRequired
                            ? "A photograph is required by the source template for this item."
                            : "No photograph attached."}
                        </p>
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
