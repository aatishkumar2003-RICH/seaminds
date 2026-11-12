import type { InterviewModule, ModuleScores } from "../../../supabase/functions/_shared/maritimeExaminer";

const PARTS: { key: InterviewModule; label: string; note: string }[] = [
  { key: "spoken_english", label: "Spoken English", note: "Maritime communication" },
  { key: "technical", label: "Technical mastery", note: "Three cascading scenarios" },
  { key: "writing", label: "Written reporting", note: "Rank-appropriate task" },
  { key: "composure", label: "Composure", note: "Professional work decisions" },
];

export function partScoreLabel(part: InterviewModule, pct: number): string {
  if (part === "composure") return pct >= 75 ? "Composed" : pct >= 50 ? "Moderate" : "Review needed";
  if (part === "technical") return pct >= 75 ? "Strong" : pct >= 50 ? "Developing" : "Training needed";
  return pct >= 85 ? "Clear operational" : pct >= 70 ? "Effective" : pct >= 50 ? "Developing" : "Needs support";
}

export default function FourPartScores({ scores, compact = false }: { scores?: ModuleScores | null; compact?: boolean }) {
  if (!scores) return null;
  const parts = PARTS.filter(p => scores[p.key]);
  if (!parts.length) return null;
  return <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
    {parts.map(p => {
      const score = scores[p.key]!;
      return <div key={p.key} className="rounded-xl border border-border bg-background/40 p-3">
        <p className="text-[11px] text-muted-foreground">{p.label}</p>
        <p className="mt-0.5 text-xl font-bold text-foreground">{score.pct}%</p>
        <p className="text-[11px] font-semibold text-primary">{partScoreLabel(p.key, score.pct)}</p>
        {!compact && <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {p.key === "spoken_english" && score.evidence === "text" ? "Typed answers — speech not assessed" : p.key === "spoken_english" && score.evidence === "mixed" ? "Mixed voice and typed answers" : p.key === "spoken_english" ? "Voice answers" : p.note}
        </p>}
      </div>;
    })}
  </div>;
}
