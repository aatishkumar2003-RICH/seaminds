import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type RosterRow = { application_id: string; crew_name: string; rank: string };
type BoardRow = { id: string; crew_name: string; current_rank: string; target_rank: string; vessel: string; status: string; created_at: string; completed_at: string | null; technical_pct: number | null; safety_flags: number | null; verdict: string | null; gaps: string[] | null; turns: { question: string; answer: string; topic?: string; safety_flag?: boolean }[] | null };

export const PROMOTION_PATH: Record<string, string> = {
  "Deck Cadet": "Third Officer", "Third Officer": "Second Officer", "Second Officer": "Chief Officer", "Chief Officer": "Master",
  "Engine Cadet": "Fourth Engineer", "Fourth Engineer": "Third Engineer", "Third Engineer": "Second Engineer", "Second Engineer": "Chief Engineer",
  "AB": "Bosun", "Oiler": "Fourth Engineer",
};
const RANKS = ["Third Officer", "Second Officer", "Chief Officer", "Master", "Fourth Engineer", "Third Engineer", "Second Engineer", "Chief Engineer", "Bosun", "ETO"];
const VESSELS = [["bulk", "Bulk carrier"], ["oil_tanker", "Oil tanker"], ["chemical_tanker", "Chemical tanker"], ["gas_carrier", "Gas carrier"], ["container", "Container ship"], ["general_cargo", "General cargo"], ["ro_ro", "Ro-ro"], ["offshore", "Offshore"], ["passenger", "Passenger ship"]];

function badge(r: BoardRow) {
  if (r.status === "pending") return ["⏳ Waiting for crew", "border-border text-muted-foreground"];
  if (r.status === "declined") return ["Declined by crew", "border-border text-muted-foreground"];
  if (r.status !== "completed") return [r.status, "border-border text-muted-foreground"];
  if ((r.safety_flags ?? 0) > 0) return ["🔴 Safety review needed", "border-destructive text-destructive"];
  if ((r.technical_pct ?? 0) >= 70) return ["🟢 Ready for promotion", "border-primary text-primary"];
  return ["🟡 Ready with training", "border-primary/50 text-primary"];
}

export default function PromotionTab({ rows }: { rows: RosterRow[] | null }) {
  const [app, setApp] = useState("");
  const [target, setTarget] = useState("");
  const [vessel, setVessel] = useState("bulk");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("manager_promotion_board" as any);
    if (error) { toast.error("Could not load the promotion board."); setBoard([]); return; }
    setBoard((data as any) || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pick = (id: string) => {
    setApp(id);
    const r = rows?.find(x => x.application_id === id);
    setTarget(r ? PROMOTION_PATH[r.rank] || "" : "");
  };

  const send = async () => {
    if (!app || !target) return;
    setBusy(true);
    const { error } = await supabase.rpc("manager_invite_promotion" as any, { p_application: app, p_target_rank: target, p_vessel: vessel, p_note: note || null });
    setBusy(false);
    if (error) { toast.error(error.message.includes("not_allowed") ? "Only approved managers can request assessments for their own crew." : "Could not send the request. Please retry."); return; }
    toast.success("Request sent. The crew sees it at the top of their next actions.");
    setApp(""); setTarget(""); setNote(""); void load();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <section className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 h-fit">
        <h2 className="font-bold text-primary">🎓 Assess for promotion</h2>
        <p className="text-xs text-muted-foreground">The crew gets a request in their app, answers up to 7 AI scenarios for the next rank, and the result appears on your board.</p>
        <select value={app} onChange={e => pick(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 min-h-[44px] text-sm text-foreground">
          <option value="">Select crew…</option>
          {(rows || []).map(r => <option key={r.application_id} value={r.application_id}>{r.crew_name || "Crew"} — {r.rank}</option>)}
        </select>
        <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Target rank" className="w-full rounded-xl border border-border bg-background px-3 min-h-[44px] text-sm text-foreground">
          <option value="">Promote to…</option>
          {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={vessel} onChange={e => setVessel(e.target.value)} aria-label="Vessel type" className="w-full rounded-xl border border-border bg-background px-3 min-h-[44px] text-sm text-foreground">
          {VESSELS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 500))} placeholder="Note to crew (optional)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground min-h-20" />
        <button disabled={!app || !target || busy} onClick={send} className="w-full rounded-xl bg-primary text-primary-foreground font-bold min-h-[44px] disabled:opacity-50">{busy ? "Sending…" : "Send assessment request"}</button>
        {rows?.length === 0 && <p className="text-xs text-muted-foreground">No crew in your roster yet.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-primary">Promotion board</h2>
        {board === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {board?.length === 0 && <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No requests yet.</p>}
        {board?.map(r => {
          const [label, cls] = badge(r);
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[180px]">
                  <p className="font-semibold text-foreground">{r.crew_name || "Crew"}</p>
                  <p className="text-xs text-muted-foreground">{r.current_rank} → {r.target_rank} · sent {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                {r.status === "completed" && <span className="text-sm font-bold text-foreground">{r.technical_pct ?? 0}%</span>}
                <span className={`text-[11px] rounded-full border px-2 py-0.5 ${cls}`}>{label}</span>
                {r.status === "completed" && <button onClick={() => setOpen(open === r.id ? null : r.id)} className="rounded-xl border border-primary text-primary px-3 min-h-[36px] text-xs font-bold">{open === r.id ? "Hide" : "View report"}</button>}
              </div>
              {open === r.id && (
                <div className="space-y-3 border-t border-border pt-3 text-sm">
                  {(r.gaps?.length ?? 0) > 0 && <div><p className="font-semibold text-primary">Topics to strengthen</p><ul className="list-disc pl-5 text-muted-foreground">{r.gaps!.map(g => <li key={g}>{g}</li>)}</ul></div>}
                  {(r.turns || []).map((t, i) => (
                    <details key={i} className="border-b border-border pb-2">
                      <summary className="cursor-pointer font-semibold">{i + 1}. {t.topic?.replace(/_/g, " ") || "Scenario"}{t.safety_flag ? " · ⚠️ Safety" : ""}</summary>
                      <p className="mt-2">{t.question}</p><p className="mt-1 text-muted-foreground">Answer: {t.answer}</p>
                    </details>
                  ))}
                  <p className="text-xs text-muted-foreground">AI review is advisory. The promotion decision stays with your company.</p>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
