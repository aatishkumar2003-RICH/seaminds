import { useState } from "react";
import { Link } from "react-router-dom";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";

type Drill = {
  key: string; tab: string; title: string; source: string; ranks: string;
  params: string[]; question: string; options: string[]; correct: number; why: string;
};

/** Public demo drills — guidance-level, sourced to well-known industry codes/cases. */
export const DRILLS: Drill[] = [
  {
    key: "bulk", tab: "🌾 Bulk", title: "Cargo liquefaction before loading",
    source: "IMSBC Code · Bulk Jupiter (2015, bauxite) lessons",
    ranks: "Master · C/O",
    params: ["Shipper declares moisture content 11%", "Transportable Moisture Limit (TML) 10%", "Can test: wet sample leaves free water on surface"],
    question: "The shipper's certificate shows moisture above TML. What do you do?",
    options: ["Load slowly and trim carefully", "Stop loading, refuse cargo and inform owners/P&I", "Load only in the lower holds", "Ask the shipper for a new certificate and continue loading"],
    correct: 1,
    why: "Group A cargo above TML may liquefy and cause sudden capsize. Under IMSBC the Master must not accept it — stop, notify owners and P&I.",
  },
  {
    key: "gas", tab: "❄️ Gas", title: "BOG compressor trip — tank pressure rising",
    source: "IGC Code · SIGTTO guidance",
    ranks: "C/E · C/O · Gas Engineer",
    params: ["Reliquefaction compressor tripped on seal oil low pressure", "Cargo tank pressure rising towards relief valve set point", "Standby compressor available"],
    question: "First correct action?",
    options: ["Vent cargo to atmosphere immediately", "Start standby compressor / alternative BOG handling and monitor tank pressure", "Reset the tripped compressor without investigation", "Increase cargo tank temperature"],
    correct: 1,
    why: "Keep tank pressure controlled with standby plant (or GCU / fuel use) while the trip cause is found. Venting is a last resort; never reset a seal-oil trip blind.",
  },
  {
    key: "container", tab: "📦 Container", title: "Parametric rolling in head seas",
    source: "IMO MSC.1/Circ.1228 · APL China (1998) case",
    ranks: "Master · OOW",
    params: ["Head/stern seas, wave period ~half the roll period", "Roll angle building over successive cycles", "Lashings under high load"],
    question: "What is the best immediate action?",
    options: ["Keep course and speed — it will settle", "Change course and/or speed to break the wave-encounter resonance", "Ballast the double bottom fully", "Increase speed in the same heading"],
    correct: 1,
    why: "Parametric rolling is a resonance. Altering course or speed changes the encounter period and stops roll build-up (MSC.1/Circ.1228).",
  },
  {
    key: "tanker", tab: "🛢️ Tanker", title: "Inert gas deck seal low water",
    source: "SOLAS II-2 · ISGOTT · IBC/FSS Code",
    ranks: "C/O · 2/E · Pumpman",
    params: ["IG deck water seal low-level alarm", "Cargo discharge in progress", "O₂ in IG main 4.5%"],
    question: "What do you do?",
    options: ["Ignore — O₂ is below 5%", "Stop cargo operation, restore seal water level, investigate", "Open tank hatches to equalise", "Increase discharge rate"],
    correct: 1,
    why: "The deck seal stops hydrocarbon gas flowing back to the machinery space. Without it, stop cargo operations until it is restored.",
  },
  {
    key: "reefer", tab: "🍎 Reefer", title: "Ammonia leak in refrigeration room",
    source: "IIAR / class rules on ammonia plant",
    ranks: "C/E · 2/E · Reefer Engineer",
    params: ["Ammonia detector alarm in plant room", "Strong smell at entrance", "Plant running"],
    question: "First action?",
    options: ["Enter quickly to find the leak", "Raise alarm, keep out, start emergency ventilation, use SCBA/gas-tight suit team", "Spray water without PPE", "Wait for the smell to clear"],
    correct: 1,
    why: "Ammonia is toxic and flammable at high concentration. Never enter without SCBA and protective suit; ventilate and follow emergency procedure.",
  },
];

const FleetSimulatorPreview = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [k, setK] = useState(DRILLS[0].key);
  const [pick, setPick] = useState<number | null>(null);
  if (!open) return null;
  const d = DRILLS.find((x) => x.key === k)!;
  return (
    <div role="dialog" aria-modal="true" aria-label="Fleet incident drill preview" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-2" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-primary/40 bg-card p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-primary">⚡ FLEET INCIDENT DRILL · FREE PREVIEW</p>
            <h2 className="text-base font-bold">{d.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {DRILLS.map((x) => {
            const [icon, ...name] = x.tab.split(" ");
            return (
              <button key={x.key} onClick={() => { setK(x.key); setPick(null); }} aria-pressed={x.key === k}
                className={`flex flex-col items-center rounded-xl border py-1 text-[10px] font-bold leading-tight ${x.key === k ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary"}`}>
                <span className="text-sm">{icon}</span>{name.join(" ")}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">📚 {d.source} · 👥 {d.ranks}</p>
        <ul className="rounded-xl border border-border bg-background/50 p-3 text-xs space-y-1">
          {d.params.map((p) => <li key={p}>• {p}</li>)}
        </ul>
        <p className="text-sm font-semibold">{d.question}</p>
        <div className="space-y-1.5">
          {d.options.map((o, i) => {
            const state = pick === null ? "" : i === d.correct ? "border-primary bg-primary/10" : i === pick ? "border-destructive bg-destructive/10" : "opacity-60";
            return <button key={o} disabled={pick !== null} onClick={() => setPick(i)} className={`w-full text-left rounded-xl border border-border p-2.5 text-xs ${state}`}>{String.fromCharCode(65 + i)}. {o}</button>;
          })}
        </div>
        {pick !== null && (
          <div className="rounded-xl border border-primary/40 p-3 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">{pick === d.correct ? <><CheckCircle2 size={14} className="text-primary" /> Correct</> : <><AlertTriangle size={14} className="text-destructive" /> Not the safe action</>}</p>
            <p className="text-muted-foreground">{d.why}</p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Full drills add a voice oral check and a gap report for the superintendent. Training guidance only — not an STCW certificate.</p>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/for-companies#fleet-drills" onClick={onClose} className="rounded-xl bg-primary py-2.5 text-center text-xs font-bold text-primary-foreground no-underline">Fleet trial for my ships →</Link>
          <Link to="/training?tab=drills" onClick={onClose} className="rounded-xl border border-primary py-2.5 text-center text-xs font-bold text-primary no-underline">I'm crew — train now</Link>
        </div>
      </div>
    </div>
  );
};

export default FleetSimulatorPreview;
