import { useState } from "react";
import { Link } from "react-router-dom";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";

export type DrillStage = { label: string; situation: string; question: string; options: string[]; correct: number; why: string };
type Drill = {
  key: string; tab: string; title: string; source: string; ranks: string;
  params: string[]; question: string; options: string[]; correct: number; why: string;
  /** Follow-up stages (2: stabilise, 3: report/compliance). Correct answer kept at index 1 to match server grading. */
  next?: DrillStage[];
};

/** Stages 2–3 per drill — guidance-level, to be reviewed by a Master/C/E before enterprise demos. */
export const DRILL_FOLLOWUPS: Record<string, DrillStage[]> = {
  bulk: [
    { label: "Stabilise", situation: "Loading stopped. Two holds already contain part cargo; a wet sample shows a flow surface.", question: "What do you do with the cargo already loaded?",
      options: ["Sail — the holds are only part full", "Arrange independent sampling/testing and plan discharge if above TML, with stability review", "Cover the holds with tarpaulins and sail", "Add more dry cargo on top to absorb the water"], correct: 1,
      why: "Cargo above TML must not be carried. Independent testing and discharge planning, with a stability check, removes the liquefaction risk." },
    { label: "Report", situation: "Owners ask for documentation before the charterer disputes the delay.", question: "What must be recorded and reported?",
      options: ["Nothing — it was the shipper's error", "Log bridge/deck entries, issue Note of Protest, notify owners, P&I and flag as per SMS", "Only a WhatsApp to the agent", "Ask the crew to keep quiet until arrival"], correct: 1,
      why: "A Note of Protest, log entries and P&I/owner notification protect the vessel and evidence the Master's IMSBC decision." },
  ],
  gas: [
    { label: "Stabilise", situation: "Standby compressor running, but tank pressure still creeping up slowly.", question: "Next action to control pressure?",
      options: ["Raise the relief valve set point", "Use GCU / send BOG to engines as fuel, reduce cargo heat input, keep monitoring", "Shut all tank valves and wait", "Bypass the seal-oil trip on the tripped unit"], correct: 1,
      why: "Alternative BOG consumers (GCU / dual-fuel engines) keep pressure within limits. Relief valve settings and trips must never be altered." },
    { label: "Report", situation: "Pressure stable. The tripped compressor is isolated for inspection.", question: "What follow-up is required?",
      options: ["Restart it at next watch without records", "Root-cause the seal-oil trip, log it, report to office/terminal as per SMS and PMS", "Remove the trip alarm to avoid repeats", "Only tell the next C/E at handover"], correct: 1,
      why: "Recorded root-cause analysis and office/terminal reporting are expected by SIGTTO practice and vetting inspectors." },
  ],
  container: [
    { label: "Stabilise", situation: "Course altered; rolling reducing. Bridge reports possible lashing failure in bay 34.", question: "When is it safe to inspect the lashings?",
      options: ["Send crew immediately while still rolling", "After motions settle, with risk assessment, PPE, communication and no lone working", "Never — wait for port", "Only at night to avoid delays"], correct: 1,
      why: "Crew safety first: inspect only when motions are controlled, under a risk assessment and with proper supervision." },
    { label: "Report", situation: "Two containers are found missing overboard.", question: "What is required?",
      options: ["Record nothing until discharge port", "Broadcast navigational warning, notify coastal state, flag, owners and P&I; log details", "Ask the agent to inform the shipper later", "Only update the cargo plan"], correct: 1,
      why: "Lost containers are a hazard to navigation; SOLAS and MARPOL require prompt reporting, especially for any dangerous goods." },
  ],
  tanker: [
    { label: "Stabilise", situation: "Cargo stopped; seal water restored. O₂ in IG main now reads 6%.", question: "Can discharge resume?",
      options: ["Yes — the seal is fixed", "No — restore IG quality to ≤5% O₂ and confirm positive tank pressure first", "Yes, at reduced rate", "Yes, if the terminal agrees"], correct: 1,
      why: "Inert gas must be ≤5% O₂ with tanks kept at positive pressure before cargo operations resume (SOLAS II-2 / ISGOTT)." },
    { label: "Report", situation: "Operations resumed safely after 40 minutes.", question: "What follow-up is expected for vetting?",
      options: ["Nothing — it was fixed", "Record in IG log and cargo log, report to office, review PMS of seal and alarms", "Only inform the terminal verbally", "Delete the alarm history"], correct: 1,
      why: "SIRE 2.0 inspectors check that defects and alarms are recorded, reported and followed up through the PMS." },
  ],
  reefer: [
    { label: "Stabilise", situation: "Ventilation running; SCBA team ready. Leak located at a compressor valve.", question: "How should the team stop the leak?",
      options: ["Work without suits — ventilation is on", "Isolate the section via remote/emergency valves, team in gas-tight suits, standby team ready", "Restart the plant to pump out ammonia", "Open all doors to the accommodation"], correct: 1,
      why: "Isolate remotely where possible; entry only with proper protection and a standby team. Never vent toward accommodation." },
    { label: "Report", situation: "Leak isolated, levels below alarm.", question: "Before the plant restarts?",
      options: ["Restart immediately to protect cargo", "Gas-free check, repair, record in logs, report to office and class if required", "Top up ammonia and run", "Leave detectors muted"], correct: 1,
      why: "Confirm safe atmosphere, repair properly, record and report — cargo temperature never outranks crew safety." },
  ],
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
