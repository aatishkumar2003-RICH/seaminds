// Part 1 study manual: sections, parameters, failures, branching scenario and practice drill (answers explained, not graded).
import { useState } from "react";
import type { ShoreModule } from "@/lib/cadetShoreInduction";

export default function ShoreStudy({ s }: { s: ShoreModule }) {
  const [pick, setPick] = useState<number | null>(null);
  const [ans, setAns] = useState<Record<number, number>>({});
  const right = Object.entries(ans).filter(([i, a]) => s.drills[+i].a === a).length;
  return (
    <div className="space-y-3 text-sm">
      <p className="font-bold text-primary">📘 Study manual (~{s.minutes} min) · Part 1 Pre-joining</p>
      <p className="text-xs text-muted-foreground">Competence: {s.competence}</p>
      <div><p className="font-semibold">You will be able to</p><ul className="list-disc pl-5">{s.objectives.map((x) => <li key={x}>{x}</li>)}</ul></div>
      {s.sections.map((x) => (
        <details key={x.h} className="rounded-lg border border-primary/20 p-3" open>
          <summary className="cursor-pointer font-semibold text-primary">{x.h}</summary>
          {x.p && <p className="mt-2 leading-relaxed">{x.p}</p>}
          {x.li && <ul className="mt-2 list-disc space-y-1 pl-5">{x.li.map((l) => <li key={l}>{l}</li>)}</ul>}
        </details>))}
      {s.params && <div className="rounded-lg border border-primary/30 p-3"><p className="font-semibold">📏 Numbers to remember</p>
        <table className="mt-2 w-full text-xs"><tbody>{s.params.map(([k, v]) => <tr key={k} className="border-t border-primary/10"><td className="py-1 pr-2">{k}</td><td className="py-1 font-bold text-primary">{v}</td></tr>)}</tbody></table></div>}
      <div className="rounded-lg border border-destructive/40 p-3"><p className="font-semibold">🚨 When things go wrong</p>
        {s.failures.map((f) => <div key={f.what} className="mt-2"><p className="font-semibold">{f.what}</p><p className="text-muted-foreground">→ {f.action}</p></div>)}</div>
      <div className="rounded-lg border border-primary/30 p-3"><p className="font-semibold">🎬 What would you do?</p><p className="mt-1">{s.scenario.situation}</p>
        {s.scenario.choices.map((c, i) => <button key={i} onClick={() => setPick(i)} className={`mt-2 block w-full rounded-lg border px-3 py-2 text-left ${pick === i ? (c.ok ? "border-green-500 bg-green-500/15" : "border-destructive bg-destructive/15") : "border-primary/20"}`}>{c.c}</button>)}
        {pick !== null && <p className={`mt-2 ${s.scenario.choices[pick].ok ? "text-green-500" : "text-destructive"}`}>{s.scenario.choices[pick].fb}</p>}</div>
      <div><p className="font-semibold">🗣️ Say it in Maritime English</p><ul className="list-disc pl-5">{s.english.map(([p, w]) => <li key={p}>"{p}" <span className="text-xs text-muted-foreground">— {w}</span></li>)}</ul></div>
      <div className="rounded-lg border border-primary/30 p-3"><p className="font-semibold">🎖️ Superintendent oral board</p>
        {s.oral.map((o) => <details key={o.q} className="mt-2"><summary className="cursor-pointer">{o.q}</summary><p className="mt-1 text-muted-foreground">Model answer: {o.a}</p></details>)}</div>
      <div className="rounded-lg border border-primary/30 p-3"><p className="font-semibold">🧪 Practice drill ({right}/{s.drills.length} correct) — not graded</p>
        {s.drills.map((d, i) => (
          <div key={i} className="mt-3"><p className="font-semibold">{i + 1}. {d.q}</p>
            {d.o.map((o, k) => { const chosen = ans[i] === k; const show = ans[i] !== undefined;
              return <button key={k} disabled={show} onClick={() => setAns({ ...ans, [i]: k })} className={`mt-1 block w-full rounded-lg border px-3 py-1.5 text-left ${show && k === d.a ? "border-green-500 bg-green-500/15" : chosen ? "border-destructive bg-destructive/15" : "border-primary/20"}`}>{o}</button>; })}
            {ans[i] !== undefined && <p className="mt-1 text-xs text-muted-foreground">💡 {d.why}</p>}</div>))}
        {Object.keys(ans).length > 0 && <button className="mt-3 text-xs text-primary underline" onClick={() => setAns({})}>Reset drill</button>}</div>
    </div>);
}
