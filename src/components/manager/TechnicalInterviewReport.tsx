import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, FileText, Loader2 } from "lucide-react";
import { verdictLabel } from "@/lib/maritimeInterview";

type Report = { rank: string; target_rank: string | null; vessel: string | null; technical_pct: number | null; safety_flags: number | null; gaps: string[] | null; verdict: string | null; completed_at: string | null; turns: { question: string; answer: string; topic?: string; depth?: number; safety_flag?: boolean; gap?: string | null }[] };

/** Superintendent gap report — only visible when the crew shared it and applied to this manager's vacancy (server-enforced). */
export default function TechnicalInterviewReport({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const load = async () => {
    setOpen(true);
    if (report !== undefined) return;
    setLoading(true);
    const { data } = await supabase.rpc("manager_maritime_report", { p_application: applicationId });
    setReport(((data as unknown as Report[]) || [])[0] ?? null);
    setLoading(false);
  };
  return <>
    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void load()}><FileText className="h-3.5 w-3.5" /> Technical report</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Technical interview — gap report</DialogTitle></DialogHeader>
        {loading ? <Loader2 className="animate-spin mx-auto" /> : !report ? <p className="text-sm text-muted-foreground">This candidate has not shared an AI technical interview report yet.</p> : <div className="space-y-5 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Verdict" value={verdictLabel(report.verdict)} />
            <Stat label="Technical depth" value={`${report.technical_pct ?? 0}%`} />
            <Stat label="Safety concerns" value={String(report.safety_flags ?? 0)} />
            <Stat label="Assessed for" value={`${report.rank}${report.target_rank ? ` → ${report.target_rank}` : ""}`} />
          </div>
          {(report.safety_flags ?? 0) > 0 && <p className="flex gap-2 rounded-lg border border-destructive/40 p-3 text-destructive"><ShieldAlert className="h-4 w-4 shrink-0" /> One or more answers were flagged as unsafe. Review the transcript before deciding.</p>}
          {report.gaps?.length ? <div><h3 className="font-semibold text-primary mb-1">Gaps to train before joining</h3><ul className="list-disc pl-5 space-y-1">{report.gaps.map(g => <li key={g}>{g}</li>)}</ul></div> : null}
          <div><h3 className="font-semibold text-primary mb-1">Transcript</h3>{report.turns.map((t, i) => <details key={i} className="border-b border-border py-2"><summary className="cursor-pointer font-medium">{i + 1}. {t.topic?.replace(/_/g, " ") || "Scenario"} · depth {t.depth ?? "–"}/4{t.safety_flag ? " · ⚠ safety" : ""}</summary><p className="mt-2">{t.question}</p><p className="mt-1 text-muted-foreground">Answer: {t.answer}</p>{t.gap && <p className="mt-1">Gap: {t.gap}</p>}</details>)}</div>
          <p className="text-xs text-muted-foreground">AI-assisted practice assessment{report.completed_at ? ` · ${new Date(report.completed_at).toLocaleDateString()}` : ""}. Use as guidance alongside your own interview, not as a certificate.</p>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
const Stat = ({ label, value }: { label: string; value: string }) => <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{value}</p></div>;
