// Cadet view: weekly module, practical checklist, server-graded test and equipment badges.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { CADET_CURRICULUM, stageLabel, type CadetTrack } from "@/lib/cadetCurriculum";
import { lessonFor } from "@/lib/cadetLessons";
import { oralFor } from "@/lib/cadetOralBank";
import { buildTrbPdf, trbShareText, type TrbInput } from "@/lib/cadetTrbPdf";

const CACHE = "cadet_prog_v1"; const OUTBOX = "cadet_outbox_v1";
const readJ = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };

type Res = { week: number; score: number; correct: number; total: number; checklist: boolean[]; officer_name: string | null; completed_at: string };
type Prog = { enrolled: boolean; enrollment?: { track: CadetTrack; company: string | null; vessel: string | null; current_week: number; status: string; name: string | null }; dues?: string[]; results?: Res[] };

export default function CadetPassport() {
  const { user } = useAuth();
  const [p, setP] = useState<Prog | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [ans, setAns] = useState<number[]>([]); const [chk, setChk] = useState<boolean[]>([]); const [officer, setOfficer] = useState("");
  const [busy, setBusy] = useState(false); const [graded, setGraded] = useState<{ score: number; answers: number[] } | null>(null);
  const [studied, setStudied] = useState(false); const [queued, setQueued] = useState<number>(readJ(OUTBOX, []).length);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("cadet_my_program" as any);
    if (error) { const c = readJ(CACHE, null); if (c) setP(c); else setP({ enrolled: false }); return; }
    const v = (data as any)?.ok ? data as any : { enrolled: false }; setP(v); try { localStorage.setItem(CACHE, JSON.stringify(v)); } catch { /* full */ }
  }, []);
  const flush = useCallback(async () => {
    const box: any[] = readJ(OUTBOX, []); if (!box.length || !navigator.onLine) return;
    const left: any[] = [];
    for (const b of box) { const { data, error } = await supabase.rpc("cadet_submit_week" as any, b); if (error || !(data as any)?.ok) left.push(b); }
    localStorage.setItem(OUTBOX, JSON.stringify(left)); setQueued(left.length);
    if (left.length < box.length) { toast.success(`Synced ${box.length - left.length} saved week(s) to your company`); void load(); }
  }, [load]);
  useEffect(() => { if (!user) return; const c = readJ(CACHE, null); if (c) setP(c); void flush().then(load); const on = () => void flush(); window.addEventListener("online", on); return () => window.removeEventListener("online", on); }, [load, flush, user]);

  if (!user) return (
    <div className="rounded-xl border border-primary/40 bg-card p-5 text-sm space-y-3">
      <p className="font-bold text-primary">⚓ Cadet Academy</p>
      <p className="text-muted-foreground">Your company has enrolled you. Sign in or create your free account with the <b>same email</b> your company used, and your Cadet Passport opens here.</p>
      <Button asChild className="w-full font-bold"><Link to={`/join?next=${encodeURIComponent("/training?tab=cadet")}`}>Sign in / Register as cadet</Link></Button>
    </div>);
  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  if (!p.enrolled || !p.enrollment) return (
    <div className="rounded-xl border border-primary/30 bg-card p-5 text-sm">
      <p className="font-bold text-primary">⚓ Cadet Academy</p>
      <p className="mt-2 text-muted-foreground">No cadet enrolment found for {user.email}. Ask your training manager to enrol exactly this email, then refresh.</p>
    </div>);

  const e = p.enrollment; const cur = CADET_CURRICULUM[e.track]; const res = new Map((p.results || []).map((r) => [r.week, r]));
  const startWeek = (w: number) => { const m = cur[w - 1]; setOpen(w); setAns(Array(m.q.length).fill(-1)); setChk(res.get(w)?.checklist || Array(m.chk.length).fill(false)); setOfficer(res.get(w)?.officer_name || ""); setGraded(null); setStudied(!!res.get(w)); };
  const submit = async () => {
    if (open === null) return; if (ans.some((a) => a < 0)) return toast.error("Answer all questions");
    setBusy(true); const args = { p_week: open, p_answers: ans, p_checklist: chk, p_officer: officer || null };
    const { data, error } = navigator.onLine ? await supabase.rpc("cadet_submit_week" as any, args as any) : { data: null, error: { message: "offline" } };
    setBusy(false); const d = data as any;
    if (error && (!navigator.onLine || /fetch|network|offline/i.test(error.message || ""))) {
      const box = readJ(OUTBOX, []).filter((b: any) => b.p_week !== open); box.push(args); localStorage.setItem(OUTBOX, JSON.stringify(box)); setQueued(box.length);
      toast.success("No signal — saved on your phone. It will sync automatically when you reach port or Wi-Fi."); setOpen(null); return;
    }
    if (error || !d?.ok) return toast.error(d?.error === "LOCKED" ? "This week is not open yet" : "Could not save — try again");
    setGraded({ score: d.score, answers: d.answers }); toast.success(d.score >= 60 ? `Week ${open} passed — ${d.score}%` : `Saved — ${d.score}%. Review and retry to improve.`); void load();
  };

  if (open !== null) {
    const m = cur[open - 1];
    return (
      <div className="space-y-4">
        <button onClick={() => setOpen(null)} className="text-sm text-primary">‹ Back to passport</button>
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <p className="text-xs text-muted-foreground">Module {open} · {stageLabel(open)} · self-paced, finish before sign-off</p>
          <h2 className="mt-1 text-lg font-bold text-primary">{m.t}</h2>
          <p className="mt-1 text-sm">{m.f}</p>
          <p className="mt-3 text-xs font-bold text-primary">🔧 Equipment to know</p>
          <ul className="mt-1 list-disc pl-5 text-sm">{m.eq.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm">⚠️ {m.safe}</p>
          <p className="mt-2 text-xs text-muted-foreground">Rule: {m.ref}</p>
        </div>
        {(() => { const L = lessonFor(e.track, open); return (
        <div className="rounded-xl border border-primary/40 bg-card p-4 space-y-3 text-sm">
          <p className="font-bold text-primary">📘 Study first (~{L.minutes} min)</p>
          <p><b>Why it matters:</b> {L.why}</p>
          <div><p className="font-semibold">Step by step</p><ol className="list-decimal pl-5 space-y-1">{L.steps.map((x) => <li key={x}>{x}</li>)}</ol></div>
          <div className="rounded-lg border border-primary/30 p-3 space-y-1"><p className="font-semibold">🎬 Real onboard scenario</p><p>{L.scenario.situation}</p>
            <p className="text-destructive">✖ Wrong: {L.scenario.wrong}</p><p className="text-green-500">✔ Right: {L.scenario.right}</p></div>
          <div><p className="font-semibold">🗣️ Say it in Maritime English</p><ul className="list-disc pl-5">{L.english.map((x) => <li key={x}>"{x}"</li>)}</ul>
            <Link to="/training?tab=english" className="text-xs text-primary underline">Practise speaking in the English Lab</Link></div>
          <div><p className="font-semibold">❓ Ask your officer</p><ul className="list-disc pl-5">{L.ask.map((x) => <li key={x}>{x}</li>)}</ul></div>
          {(() => { const oral = oralFor(e.track, `${m.t} ${m.eq.join(" ")}`); return oral.length > 0 && (
            <div><p className="font-semibold">🎖️ Superintendent oral questions</p><ul className="list-disc pl-5">{oral.map((x) => <li key={x.id}>{x.q}</li>)}</ul>
              <p className="text-[11px] text-muted-foreground">Real questions from superintendent interviews — prepare a spoken answer.</p></div>); })()}
          <div className="rounded-lg border border-primary/30 p-3"><p className="font-semibold">🧠 Senior Officer review (SI Brain)</p>
            <p className="text-xs text-muted-foreground">Get an independent senior officer's explanation of this module. The question is copied — paste it in the Brain.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={async () => { try { await navigator.clipboard.writeText(`Act as an independent senior officer (Chief Mate / Second Engineer). Review and explain for a ${e.track} cadet: "${m.t}". Equipment: ${m.eq.join(", ")}. Give normal parameters, common cadet mistakes, safety rules (${m.ref}) and what the officer will check. Point out anything in this lesson a senior officer would correct: ${L.steps.join("; ")}`); toast.success("Question copied — paste it in the Brain"); } catch { /* clipboard blocked */ } window.location.assign("/training?tab=brain"); }}>Ask Senior Officer Brain</Button></div>
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={studied} onChange={(ev) => setStudied(ev.target.checked)} />I have studied this module</label>
        </div>); })()}
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <p className="text-sm font-bold text-primary">✅ Practical checklist (do it on board / at home)</p>
          {m.chk.map((t, i) => (
            <label key={i} className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!chk[i]} onChange={(ev) => setChk(chk.map((c, j) => j === i ? ev.target.checked : c))} />{t}</label>))}
          <input className="mt-3 w-full rounded-lg border border-primary/30 bg-background p-2 text-sm" placeholder="Officer who checked you (optional)" value={officer} onChange={(ev) => setOfficer(ev.target.value)} />
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <p className="text-sm font-bold text-primary">🎯 Knowledge check</p>
          {!studied && <p className="mt-2 text-sm text-muted-foreground">Tick "I have studied this module" above to open the check.</p>}
          {studied && m.q.map((q, i) => (
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
          ) : studied && <Button className="mt-4 w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save module"}</Button>}
        </div>
      </div>);
  }

  const done = p.results?.length || 0; const avg = done ? Math.round((p.results || []).reduce((s, r) => s + r.score, 0) / done) : null;
  const badges = (p.results || []).filter((r) => r.score >= 60);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/40 bg-card p-4">
        <p className="text-xs text-muted-foreground">⚓ ELECTRONIC TRAINING RECORD BOOK (e-TRB)</p>
        <p className="text-lg font-bold text-primary">{e.track === "deck" ? "Deck" : "Engine"} Cadet{e.company ? ` · ${e.company}` : ""}</p>
        {e.vessel && <p className="text-sm">🚢 {e.vessel}</p>}
        <p className="mt-2 text-sm">Week {e.current_week} of 32 · {done} done · Avg {avg ?? "—"}% · 🏅 {badges.length} badges</p>
        <div className="mt-2 h-2 rounded bg-background"><div className="h-2 rounded bg-primary" style={{ width: `${(done / 32) * 100}%` }} /></div>
        {badges.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{badges.slice(-8).map((b) => <span key={b.week} className="rounded-full border border-primary/40 px-2 py-0.5 text-[11px]">⭐ {cur[b.week - 1].eq[0]}</span>)}</div>}
        <p className="mt-2 text-xs text-muted-foreground">📶 Works offline: open modules once in port; saves sync automatically.{queued > 0 ? ` ${queued} module(s) waiting to sync.` : ""} No penalty for late modules — complete all before sign-off.</p>
        {queued > 0 && <Button size="sm" className="mt-2" onClick={async () => { if (!navigator.onLine) return toast.error("Still no signal — try again in port or on Wi-Fi"); await flush(); if (readJ(OUTBOX, []).length) toast.error("Some modules could not sync yet — try again"); }}>🔄 Sync now</Button>}
        {(() => { const trb: TrbInput = { name: e.name || user.email || "Cadet", email: user.email, company: e.company, vessel: e.vessel, track: e.track, current_week: e.current_week, results: p.results || [] };
          return (<div className="mt-3 flex flex-wrap gap-2">
            <select defaultValue="" aria-label="Download my record book" className="rounded-md border border-primary bg-background px-2 py-1.5 text-xs font-bold text-primary"
              onChange={async (ev) => { const v = ev.target.value as "summary" | "full"; ev.target.value = ""; if (!v) return; const { doc, file } = await buildTrbPdf(trb, v); doc.save(file); }}>
              <option value="" disabled>📄 Download my e-TRB ▾</option><option value="summary">Progress summary</option><option value="full">Full record book</option></select>
            <Button size="sm" variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(trbShareText(trb))}`} target="_blank" rel="noopener noreferrer">📲 Send report (WhatsApp)</a></Button>
            <Button size="sm" variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent(`e-TRB progress — ${trb.name}`)}&body=${encodeURIComponent(trbShareText(trb))}`}>✉️ Email report</a></Button>
          </div>); })()}
        <p className="mt-3 text-xs text-muted-foreground">Show this screen to your officer — they can check your passport anytime.</p>
      </div>
      {cur.map((m) => {
        const r = res.get(m.week); const locked = m.week > e.current_week;
        return (
          <button key={m.week} disabled={locked} onClick={() => startWeek(m.week)}
            className={`w-full rounded-xl border p-3 text-left ${m.week === e.current_week && !r ? "border-primary bg-primary/10" : "border-primary/20 bg-card"} ${locked ? "opacity-50" : ""}`}>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>Module {m.week} · {stageLabel(m.week)}</span><span>{r ? `✅ ${r.score}%` : locked ? "🔒" : "Pending"}</span></div>
            <p className="mt-0.5 text-sm font-semibold">{m.t}</p>
          </button>);
      })}
    </div>);
}
