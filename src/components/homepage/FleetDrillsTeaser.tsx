import { useState } from "react";
import FleetSimulatorPreview from "./FleetSimulatorPreview";

/** Homepage advert: opens the free fleet incident drill preview. */
const FleetDrillsTeaser = () => {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Fleet incident drills" className="max-w-6xl mx-auto px-4 pt-3">
      <button onClick={() => setOpen(true)} className="w-full rounded-xl border border-primary/50 bg-card/70 p-3 text-left hover:bg-primary/10">
        <p className="text-[10px] font-bold tracking-wider text-primary">⚡ NEW · INTERACTIVE FLEET INCIDENT DRILLS</p>
        <p className="text-sm font-semibold">Bulk · Gas · Container · Tanker · Reefer — try a real-case drill in 60 seconds</p>
        <p className="text-[11px] text-muted-foreground">Built around IMSBC, IGC, SOLAS, ISGOTT, SIRE 2.0 & TMSA. Tap to test →</p>
      </button>
      <FleetSimulatorPreview open={open} onClose={() => setOpen(false)} />
    </section>
  );
};

export default FleetDrillsTeaser;
