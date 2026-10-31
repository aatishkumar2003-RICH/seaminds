import { useState } from "react";
import FleetSimulatorPreview, { DRILLS } from "@/components/homepage/FleetSimulatorPreview";

const ROWS = [
  ["Passive slides, predictable quizzes", "Real casualty and code-based decision drills"],
  ["Crew click 'Next' to finish", "Voice oral check in the crew's rank and vessel type"],
  ["Same course for every ship", "Separate tracks for Bulk, Gas, Container, Tanker, Reefer"],
  ["Annual certificate only", "Gap report mapped to SIRE 2.0, DryBMS and TMSA"],
];

/** For-companies advert: legacy CBT vs SeaMinds drills + fleet coverage + live preview. */
const FleetDrillsSection = () => {
  const [open, setOpen] = useState(false);
  return (
    <section id="fleet-drills" className="py-16 md:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold tracking-wider text-primary">ENTERPRISE FLEET TRAINING</p>
          <h2 className="text-2xl md:text-3xl font-bold">Replace slide-based CBT with real incident drills</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">One digital training and pre-joining platform for mixed fleets — from 10 to 200+ ships.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-primary/30">
          <div className="grid grid-cols-2 bg-card text-xs font-bold">
            <p className="p-3 text-muted-foreground">Typical CBT</p><p className="p-3 text-primary">SeaMinds Fleet Drills</p>
          </div>
          {ROWS.map(([a, b]) => (
            <div key={a} className="grid grid-cols-2 border-t border-border text-xs">
              <p className="p-3 text-muted-foreground">{a}</p><p className="p-3">✓ {b}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          {DRILLS.map((d) => (
            <div key={d.key} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-bold">{d.tab}</p>
              <p className="text-[11px] text-muted-foreground">{d.title}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => setOpen(true)} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Try a drill now</button>
          <a href="#demo-form" className="rounded-xl border border-primary px-5 py-3 text-center text-sm font-bold text-primary no-underline">Request a fleet trial</a>
        </div>
      </div>
      <FleetSimulatorPreview open={open} onClose={() => setOpen(false)} />
    </section>
  );
};

export default FleetDrillsSection;
