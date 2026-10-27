import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Brain } from "lucide-react";

type HudSource = { id: string; label: string; status: "reading" | "ready" | "error"; rows: { rank_required?: string | null; vessel_type?: string | null }[] };

const STAGES = ["Reading text & images", "Recognising ranks & vessels", "Finding recruiter contacts"];

/** Sticky live status so a manager always sees that the AI is working on their adverts. */
export const AiReadingHud = ({ sources }: { sources: HudSource[] }) => {
  const total = sources.length;
  const reading = sources.filter((s) => s.status === "reading").length;
  const done = total - reading;
  const failed = sources.filter((s) => s.status === "error").length;
  const found = sources.reduce((n, s) => n + s.rows.length, 0);
  const latest = sources.flatMap((s) => s.rows).slice(-3).reverse();
  const [stage, setStage] = useState(0);
  const [justFinished, setJustFinished] = useState(false);
  const wasReading = useRef(false);

  useEffect(() => {
    if (!reading) return;
    const t = setInterval(() => setStage((x) => (x + 1) % STAGES.length), 1800);
    return () => clearInterval(t);
  }, [reading]);

  useEffect(() => {
    if (reading) { wasReading.current = true; setJustFinished(false); return; }
    if (wasReading.current) {
      wasReading.current = false;
      setJustFinished(true);
      try { navigator.vibrate?.(60); } catch { /* unsupported */ }
      const t = setTimeout(() => setJustFinished(false), 6000);
      return () => clearTimeout(t);
    }
  }, [reading]);

  if (!total || (!reading && !justFinished)) return null;
  const pct = Math.round((done / total) * 100);

  return (
    <section role="status" aria-live="polite" aria-label="AI reading progress"
      className="sticky top-2 z-30 rounded-xl border border-primary/50 bg-card/95 backdrop-blur p-3 shadow-lg space-y-2">
      <div className="flex items-center gap-2">
        {reading ? (
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            <Brain size={16} className="relative text-primary" />
          </span>
        ) : <CheckCircle2 size={28} className="shrink-0 text-primary" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-primary">
            {reading ? `AI is reading your adverts… ${done}/${total}` : `Done — ${found} vacanc${found === 1 ? "y" : "ies"} found`}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {reading ? <><Loader2 size={11} className="mr-1 inline animate-spin" />{STAGES[stage]} · you can keep working</> : "Review them below, then publish."}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-bold text-primary">{found} found</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(pct, reading ? 6 : 100)}%` }} />
      </div>
      {latest.length > 0 && (
        <ul className="space-y-0.5">
          {latest.map((r, i) => (
            <li key={i} className="truncate text-[11px] text-foreground">⚡ {[r.rank_required, r.vessel_type].filter(Boolean).join(" · ") || "Vacancy"}</li>
          ))}
        </ul>
      )}
      {failed > 0 && !reading && (
        <p className="flex items-center gap-1 text-[11px] text-destructive"><AlertTriangle size={12} /> {failed} advert{failed === 1 ? "" : "s"} could not be read — tap "Retry failed readings" below.</p>
      )}
    </section>
  );
};
