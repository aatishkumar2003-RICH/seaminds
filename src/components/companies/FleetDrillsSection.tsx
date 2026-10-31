import { useState } from "react";
import FleetSimulatorPreview, { DRILLS } from "@/components/homepage/FleetSimulatorPreview";

const ROWS = [
  ["Passive slides, predictable quizzes", "Real casualty and code-based decision drills"],
  ["Crew click 'Next' to finish", "Voice oral check in the crew's rank and vessel type"],
  ["Same course for every ship", "Separate tracks for Bulk, Gas, Container, Tanker, Reefer"],
  ["Annual certificate only", "Gap report mapped to SIRE 2.0, DryBMS and TMSA"],
];

const COMPLIANCE = [
  ["SeaMinds tool", "SIRE 2.0 evidence", "TMSA element"],
  ["Vessel-type incident drills", "Human factors — procedure & hardware knowledge", "3A · Crew competence & training"],
  ["Adaptive oral interview", "Human factors — crew interview readiness", "3 · Recruitment & competence assessment"],
  ["Gap → prescribed drill loop", "Corrective follow-up on observed gaps", "3A · Training gap closure"],
  ["Promotion assessment", "Rank-specific responsibility checks", "3 · Promotion & familiarisation"],
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
        <div className="space-y-2">
          <h3 className="text-center text-sm font-bold text-primary">TMSA & SIRE 2.0 compliance map</h3>
          <div className="overflow-hidden rounded-xl border border-primary/30 text-xs">
            {COMPLIANCE.map(([tool, sire, tmsa]) => (
              <div key={tool} className="grid grid-cols-3 border-t border-border first:border-t-0">
                <p className="p-3 font-semibold">{tool}</p><p className="p-3 text-muted-foreground">{sire}</p><p className="p-3 text-muted-foreground">{tmsa}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">Supports your vetting evidence; it does not replace STCW certification or your SMS.</p>
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
