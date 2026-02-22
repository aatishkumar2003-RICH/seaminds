import { useState } from "react";
import { Shield, Ship, MapPin, FileText, Scale } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import PSCByRegion from "@/components/academy/PSCByRegion";
import MyVesselType from "@/components/academy/MyVesselType";
import MyNextPort from "@/components/academy/MyNextPort";
import QuickReferenceCards from "@/components/academy/QuickReferenceCards";
import ITFRights from "@/components/academy/ITFRights";

type SubScreen = null | "psc" | "vessel" | "port" | "reference" | "itf";

const CARDS = [
  { id: "psc" as const, icon: Shield, title: "PSC by Region", description: "USCG, AMSA, Paris MOU, Tokyo MOU & more" },
  { id: "vessel" as const, icon: Ship, title: "My Vessel Type", description: "Tanker or Dry Cargo vetting requirements" },
  { id: "port" as const, icon: MapPin, title: "My Next Port", description: "What inspectors focus on at your port" },
  { id: "reference" as const, icon: FileText, title: "Quick Reference Cards", description: "Top deficiencies & inspector checklists" },
  { id: "itf" as const, icon: Scale, title: "ITF Rights", description: "Your rights, confidential contact, wages" },
];

const Academy = () => {
  const [subScreen, setSubScreen] = useState<SubScreen>(null);

  if (subScreen === "psc") return <PSCByRegion onBack={() => setSubScreen(null)} />;
  if (subScreen === "vessel") return <MyVesselType onBack={() => setSubScreen(null)} />;
  if (subScreen === "port") return <MyNextPort onBack={() => setSubScreen(null)} />;
  if (subScreen === "reference") return <QuickReferenceCards onBack={() => setSubScreen(null)} />;
  if (subScreen === "itf") return <ITFRights onBack={() => setSubScreen(null)} />;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Academy</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Inspections & Vetting</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => setSubScreen(card.id)}
              className="w-full rounded-xl bg-card border border-border p-4 text-left hover:border-primary/50 transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <card.icon size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{card.title}</p>
                <p className="text-[11px] text-muted-foreground">{card.description}</p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Academy;
