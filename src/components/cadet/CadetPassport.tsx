// Cadet view: weekly module, practical checklist, server-graded test and equipment badges.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CADET_CURRICULUM, stageLabel, type CadetTrack } from "@/lib/cadetCurriculum";

type Res = { week: number; score: number; correct: number; total: number; checklist: boolean[]; officer_name: string | null; completed_at: string };
type Prog = { enrolled: boolean; enrollment?: { track: CadetTrack; company: string | null; vessel: string | null; current_week: number; status: string; name: string | null }; dues?: string[]; results?: Res[] };

export default function CadetPassport() {
  const [p, setP] = useState<Prog | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [ans, setAns] = useState<number[]>([]); const [chk, setChk] = useState<boolean[]>([]); const [officer, setOfficer] = useState("");
  const [busy, setBusy] = useState(false); const [graded, setGraded] = useState<{ score: number; answers: number[] } | null>(null);
  const load = useCallback(async () => { const { data } = await supabase.rpc("cadet_my_program" as any); setP((data as any)?.ok ? data as any : { enrolled: false }); }, []);
  useEffect(() => { void load(); }, [load]);

  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  if (!p.enrolled || !p.enrollment) return (
    <div className="rounded-xl border border-primary/30 bg-card p-5 text-sm">
      <p className="font-bold text-primary">⚓ Cadet Academy</p>
      <p className="mt-2 text-muted-foreground">This programme opens when your company enrols you. Ask your training manager to add the email you use on SeaMinds.</p>
    </div>);

  const e = p.enrollment; const cur = CADET_CURRICULUM[e.track]; const res = new Map((p.results || []).map((r) => [r.week, r]));
  const startWeek = (w: number) => { const m = cur[w - 1]; setOpen(w); setAns(Array(m.q.length).fill(-1)); setChk(res.get(w)?.checklist || Array(m.chk.length).fill(false)); setOfficer(res.get(w)?.officer_name || ""); setGraded(null); };
  const submit = async () => {
    if (open === null) return; if (ans.some((a) => a < 0)) return toast.error("Answer all questions");
    setBusy(true);
    const { data, error } = await supabase.rpc("cadet_submit_week" as any, { p_week: open, p_answers: ans, p_checklist: chk, p_officer: officer || null } as any);
    setBusy(false); const d = data as any;
    if (error || !d?.ok) return toast.error(d?.error === "LOCKED" ? "This week is not open yet" : "Could not save — try again");
    setGraded({ score: d.score, answers: d.answers }); toast.success(d.score >= 60 ? `Week ${open} passed — ${d.score}%` : `Saved — ${d.score}%. Review and retry to improve.`); void load();
  };

  if (open !== null) {
    const m = cur[open - 1];
    return (
      <div className="space-y-4">
        <button onClick={() => setOpen(null)} className="text-sm text-primary">‹ Back to passport</button>
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <p className="text-xs text-muted-foreground">Week {open} · {stageLabel(open)} · due {p.dues?.[open - 1]}</p>
          <h2 className="mt-1 text-lg font-bold text-primary">{m.t}</h2>
          <p className="mt-1 text-sm">{m.f}</p>
          <p className="mt-3 text-xs font-bold text-primary">🔧 Equipment to know</p>
          <ul className="mt-1 list-disc pl-5 text-sm">{m.eq.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm">⚠️ {m.safe}</p>
          <p className="mt-2 text-xs text-muted-foreground">Rule: {m.ref}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <p className="text-sm font-bold text-primary">✅ Practical checklist (do it on board / at home)</p>
          {m.chk.map((t, i) => (
            <label key={i} className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!chk[i]} onChange={(ev) => setChk(chk.map((c, j) => j === i ? ev.target.checked : c))} />{t}</label>))}
          <input className="mt-3 w-full rounded-lg border border-primary/30 bg-background p-2 text-sm" placeholder="Officer who checked you (optional)" value={officer} onChange={(ev) => setOfficer(ev.target.value)} />
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <p className="text-sm font-bold text-primary">🎯 Weekly test</p>
          {m.q.map((q, i) => (
            <div key={i} className="mt-3">
              <p className="text-sm font-semibold">{i + 1}. {q.q}</p>
              {q.o.map((o, k) => {
                const right = graded && graded.answers[i] === k; const wrong = graded && ans[i] === k && graded.answers[i] !== k;
                return <button key={k} disabled={!!graded} onClick={() => setAns(ans.map((a, j) => j === i ? k : a))}
                  className={`mt-1 block w-full rounded-lg border px-3 py-2 text-left text-sm ${right ? "border-green-500 bg-green-500/15" : wrong ? "border-destructive bg-destructive/15" : ans[i] === k ? "border-primary bg-primary/15" : "border-primary/20"}`}>{o}</button>;
              })}
            </div>))}
          {graded ? (
            <div className="mt-4 space-y-2"><p className="text-sm font-bold">Score: {graded.score}%</p>
              <Button variant="outline" onClick={() => startWeek(open)}>Try again</Button> <Button onClick={() => setOpen(null)}>Done</Button></div>
          ) : <Button className="mt-4 w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Submit week"}</Button>}
        </div>
      </div>);
  }

  const done = p.results?.length || 0; const avg = done ? Math.round((p.results || []).reduce((s, r) => s + r.score, 0) / done) : null;
  const badges = (p.results || []).filter((r) => r.score >= 60);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/40 bg-card p-4">
        <p className="text-xs text-muted-foreground">⚓ CADET EQUIPMENT PASSPORT</p>
        <p className="text-lg font-bold text-primary">{e.track === "deck" ? "Deck" : "Engine"} Cadet{e.company ? ` · ${e.company}` : ""}</p>
        {e.vessel && <p className="text-sm">🚢 {e.vessel}</p>}
        <p className="mt-2 text-sm">Week {e.current_week} of 32 · {done} done · Avg {avg ?? "—"}% · 🏅 {badges.length} badges</p>
        <div className="mt-2 h-2 rounded bg-background"><div className="h-2 rounded bg-primary" style={{ width: `${(done / 32) * 100}%` }} /></div>
        {badges.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{badges.slice(-8).map((b) => <span key={b.week} className="rounded-full border border-primary/40 px-2 py-0.5 text-[11px]">⭐ {cur[b.week - 1].eq[0]}</span>)}</div>}
        <p className="mt-3 text-xs text-muted-foreground">Show this screen to your officer — they can check your passport anytime.</p>
      </div>
      {cur.map((m) => {
        const r = res.get(m.week); const locked = m.week > e.current_week;
        return (
          <button key={m.week} disabled={locked} onClick={() => startWeek(m.week)}
            className={`w-full rounded-xl border p-3 text-left ${m.week === e.current_week && !r ? "border-primary bg-primary/10" : "border-primary/20 bg-card"} ${locked ? "opacity-50" : ""}`}>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>Week {m.week} · {stageLabel(m.week)}</span><span>{r ? `✅ ${r.score}%` : locked ? "🔒" : `due ${p.dues?.[m.week - 1] || ""}`}</span></div>
            <p className="mt-0.5 text-sm font-semibold">{m.t}</p>
          </button>);
      })}
    </div>);
}
