import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, RotateCcw, ArrowRight, Mic, BarChart3 } from "lucide-react";
import { DRILLS, DRILL_FOLLOWUPS } from "@/components/homepage/FleetSimulatorPreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const KEY = "seaminds_fleet_drills_v1";
type Done = Record<string, { correct: boolean; at: string }>;
const readDone = (): Done => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

/** Crew-facing 3-stage vessel incident drills. Signed-in results are saved to the crew's training record. */
const FleetDrills = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = DRILLS.find((x) => x.key === params.get("drill"))?.key ?? DRILLS[0].key;
  const [k, setK] = useState(initial);
  const [stage, setStage] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [clean, setClean] = useState(true); // all stages right first time
  const [done, setDone] = useState<Done>(readDone);
  const d = DRILLS.find((x) => x.key === k)!;
  const stages = [{ label: "Immediate action", situation: "", question: d.question, options: d.options, correct: d.correct, why: d.why }, ...(DRILL_FOLLOWUPS[d.key] ?? [])];
  const s = stages[stage];
  const last = stage === stages.length - 1;
  const passed = Object.values(done).filter((v) => v.correct).length;
  const allDone = passed === DRILLS.length;
  const nextDrill = DRILLS.find((x) => x.key !== k && !done[x.key]?.correct);

  useEffect(() => {
    if (!user) return;
    void supabase.from("fleet_drill_results").select("drill_key, correct, updated_at").then(({ data }) => {
      if (!data?.length) return;
      setDone((prev) => {
        const next = { ...prev };
        for (const r of data) next[r.drill_key] = { correct: r.correct || !!prev[r.drill_key]?.correct, at: r.updated_at };
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full */ }
        return next;
      });
    });
  }, [user]);

  const open = (key: string) => { setK(key); setStage(0); setPick(null); setClean(true); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const choose = (i: number) => {
    setPick(i);
    const ok = i === s.correct;
    const stillClean = clean && ok;
    if (!ok) setClean(false);
    if (!last && ok) return;
    // Record once per run: on final stage, or on first wrong answer.
    const passedRun = last && stillClean;
    if (!ok && !clean) return; // already recorded this run
    const next = { ...done, [d.key]: { correct: passedRun || !!done[d.key]?.correct, at: new Date().toISOString() } };
    setDone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full */ }
    if (user) void supabase.rpc("record_fleet_drill", { p_drill: d.key, p_choice: passedRun ? d.correct : (d.correct + 1) % 4 });
  };

  const ok = pick === s.correct;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-primary">🚢 Fleet incident drills</h2>
        <span className="text-xs text-muted-foreground">{passed}/{DRILLS.length} safe</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary transition-all" style={{ width: `${(passed / DRILLS.length) * 100}%` }} /></div>

      {allDone && (
        <div className="rounded-xl border border-primary bg-primary/10 p-3 space-y-2">
          <p className="text-sm font-bold">🏅 All 5 fleet incidents handled safely</p>
          <p className="text-xs text-muted-foreground">Now prove it orally — an examiner will ask you to explain these decisions.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate("/maritime-interview")} className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Mic size={14} /> Oral test</button>
            <button onClick={() => navigate("/training?tab=records")} className="inline-flex items-center justify-center gap-1 rounded-xl border border-primary px-3 py-2 text-xs font-bold text-primary"><BarChart3 size={14} /> My records</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1">
        {DRILLS.map((x) => {
          const [icon, ...name] = x.tab.split(" ");
          const st = done[x.key];
          return (
            <button key={x.key} onClick={() => open(x.key)} aria-pressed={x.key === k}
              className={`relative flex flex-col items-center rounded-xl border py-1 text-[10px] font-bold leading-tight ${x.key === k ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary"}`}>
              <span className="text-sm">{icon}</span>{name.join(" ")}
              {st && <span className="absolute -right-1 -top-1 text-[10px]">{st.correct ? "✅" : "⚠️"}</span>}
            </button>
          );
        })}
      </div>

      <article className="rounded-xl border border-primary/30 bg-card p-3 space-y-3">
        <div>
          <h3 className="text-base font-bold">{d.title}</h3>
          <p className="text-[11px] text-muted-foreground">📚 {d.source} · 👥 {d.ranks}</p>
        </div>
        <div className="flex items-center gap-1.5" aria-label={`Stage ${stage + 1} of ${stages.length}`}>
          {stages.map((st, i) => (
            <div key={st.label} className="flex-1">
              <div className={`h-1 rounded-full ${i < stage ? "bg-primary" : i === stage ? "bg-primary/60" : "bg-border"}`} />
              <p className={`mt-1 text-[10px] ${i === stage ? "font-bold text-primary" : "text-muted-foreground"}`}>{i + 1}. {st.label}</p>
            </div>
          ))}
        </div>
        {stage === 0 ? (
          <ul className="rounded-lg border border-border bg-background/50 p-3 text-xs space-y-1">
            {d.params.map((p) => <li key={p}>• {p}</li>)}
          </ul>
        ) : (
          <p className="rounded-lg border border-border bg-background/50 p-3 text-xs">⏱️ {s.situation}</p>
        )}
        <p className="text-sm font-semibold">{s.question}</p>
        <div className="space-y-1.5">
          {s.options.map((o, i) => {
            const state = pick === null ? "" : i === s.correct ? "border-primary bg-primary/10" : i === pick ? "border-destructive bg-destructive/10" : "opacity-60";
            return <button key={o} disabled={pick !== null} onClick={() => choose(i)} className={`w-full text-left rounded-lg border border-border p-2.5 text-xs ${state}`}>{String.fromCharCode(65 + i)}. {o}</button>;
          })}
        </div>
        {pick !== null && (
          <div className="rounded-lg border border-primary/40 p-3 text-xs space-y-2">
            <p className="font-bold flex items-center gap-1.5">{ok ? <><CheckCircle2 size={14} className="text-primary" /> Correct — safe action</> : <><AlertTriangle size={14} className="text-destructive" /> Not the safe action</>}</p>
            <p className="text-muted-foreground">{s.why}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {ok && !last && (
                <button onClick={() => { setStage(stage + 1); setPick(null); }} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 font-bold text-primary-foreground">
                  Stage {stage + 2}: {stages[stage + 1].label} <ArrowRight size={14} />
                </button>
              )}
              {ok && last && (
                <>
                  <p className="w-full font-bold text-primary">{clean ? "✅ Drill completed safely — all stages right." : "Drill finished. Repeat it cleanly to earn the ✅."}</p>
                  {nextDrill && (
                    <button onClick={() => open(nextDrill.key)} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 font-bold text-primary-foreground">
                      Next drill: {nextDrill.tab} <ArrowRight size={14} />
                    </button>
                  )}
                </>
              )}
              {!ok && <button onClick={() => setPick(null)} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 font-bold text-primary-foreground"><RotateCcw size={12} /> Try this stage again</button>}
              {(ok && last) || !ok ? <button onClick={() => open(d.key)} className="inline-flex items-center gap-1 text-primary font-bold"><RotateCcw size={12} /> Restart drill</button> : null}
            </div>
          </div>
        )}
      </article>
      <p className="text-[11px] text-muted-foreground">Practice guidance only — not an STCW certificate. {user ? "Results are saved to your private training record." : "Sign in to save results to your training record."}</p>
    </div>
  );
};

export default FleetDrills;
