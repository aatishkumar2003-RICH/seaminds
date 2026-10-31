import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { DRILLS } from "@/components/homepage/FleetSimulatorPreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const KEY = "seaminds_fleet_drills_v1";
type Done = Record<string, { correct: boolean; at: string }>;
const readDone = (): Done => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

/** Crew-facing vessel-type incident drills. Signed-in results are saved to the crew's training record. */
const FleetDrills = () => {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const initial = DRILLS.find((x) => x.key === params.get("drill"))?.key ?? DRILLS[0].key;
  const [k, setK] = useState(initial);
  const [pick, setPick] = useState<number | null>(null);
  const [done, setDone] = useState<Done>(readDone);
  const d = DRILLS.find((x) => x.key === k)!;
  const passed = Object.values(done).filter((v) => v.correct).length;

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

  const choose = (i: number) => {
    setPick(i);
    const ok = i === d.correct;
    const next = { ...done, [d.key]: { correct: ok || !!done[d.key]?.correct, at: new Date().toISOString() } };
    setDone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full */ }
    if (user) void supabase.rpc("record_fleet_drill", { p_drill: d.key, p_choice: i });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-primary">🚢 Fleet incident drills</h2>
        <span className="text-xs text-muted-foreground">{passed}/{DRILLS.length} safe</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary" style={{ width: `${(passed / DRILLS.length) * 100}%` }} /></div>
      <div className="grid grid-cols-5 gap-1">
        {DRILLS.map((x) => {
          const [icon, ...name] = x.tab.split(" ");
          const st = done[x.key];
          return (
            <button key={x.key} onClick={() => { setK(x.key); setPick(null); }} aria-pressed={x.key === k}
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
        <ul className="rounded-lg border border-border bg-background/50 p-3 text-xs space-y-1">
          {d.params.map((p) => <li key={p}>• {p}</li>)}
        </ul>
        <p className="text-sm font-semibold">{d.question}</p>
        <div className="space-y-1.5">
          {d.options.map((o, i) => {
            const state = pick === null ? "" : i === d.correct ? "border-primary bg-primary/10" : i === pick ? "border-destructive bg-destructive/10" : "opacity-60";
            return <button key={o} disabled={pick !== null} onClick={() => choose(i)} className={`w-full text-left rounded-lg border border-border p-2.5 text-xs ${state}`}>{String.fromCharCode(65 + i)}. {o}</button>;
          })}
        </div>
        {pick !== null && (
          <div className="rounded-lg border border-primary/40 p-3 text-xs space-y-2">
            <p className="font-bold flex items-center gap-1.5">{pick === d.correct ? <><CheckCircle2 size={14} className="text-primary" /> Correct — safe action</> : <><AlertTriangle size={14} className="text-destructive" /> Not the safe action</>}</p>
            <p className="text-muted-foreground">{d.why}</p>
            <button onClick={() => setPick(null)} className="inline-flex items-center gap-1 text-primary font-bold"><RotateCcw size={12} /> Try again</button>
          </div>
        )}
      </article>
      <p className="text-[11px] text-muted-foreground">Practice guidance only — not an STCW certificate. {user ? "Results are saved to your private training record." : "Sign in to save results to your training record."}</p>
    </div>
  );
};

export default FleetDrills;
