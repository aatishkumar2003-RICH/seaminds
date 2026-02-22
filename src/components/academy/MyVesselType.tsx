import { ArrowLeft, Ship } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MyVesselTypeProps {
  onBack: () => void;
}

const TANKER_CONTENT = {
  title: "Tanker Vetting",
  sections: [
    {
      heading: "SIRE 2.0 (New September 2024 Standard)",
      items: [
        "Completely new inspection framework replacing the old SIRE questionnaire",
        "Focus on 'how things are done' rather than 'are things in place'",
        "Crew must demonstrate competence through live operational observations",
        "Inspectors observe actual operations — cargo, mooring, navigation",
        "New digital reporting platform with objective evidence requirements",
        "Human factors assessment is now core (not optional)",
        "Inspectors will interview multiple crew members, not just officers",
      ],
    },
    {
      heading: "CDI — Chemical Tankers",
      items: [
        "Chemical Distribution Institute inspections for chemical/product tankers",
        "Focus on cargo handling procedures for hazardous chemicals",
        "Tank cleaning verification and wall wash standards",
        "Crew must demonstrate chemical cargo competency",
        "Compatibility checks and cargo segregation knowledge required",
      ],
    },
    {
      heading: "Oil Major Vetting",
      items: [
        "Shell TMSA 3 — Third edition focuses on leadership and continuous improvement",
        "BP Shipping Standards — emphasis on behavioral safety observations",
        "ExxonMobil HSSE — detailed pre-arrival questionnaires",
        "Chevron, TotalEnergies — individual vetting requirements",
        "All oil majors now emphasise human factors and crew welfare",
        "Crew mental health and fatigue management increasingly assessed",
      ],
    },
    {
      heading: "Human Factors Emphasis",
      items: [
        "SIRE 2.0 places human element at the centre of inspections",
        "Crew communication, teamwork, and situational awareness assessed",
        "Bridge Resource Management (BRM) demonstrated during operations",
        "Engine Room Resource Management (ERRM) for engineering crew",
        "Fatigue management — rest hour records cross-checked with operations",
        "Just culture and reporting culture evidence expected",
      ],
    },
  ],
};

const DRY_CARGO_CONTENT = {
  title: "Dry Cargo Vetting",
  sections: [
    {
      heading: "RightShip Star Rating System",
      items: [
        "0.5 to 5 star rating based on vessel safety performance",
        "Rating considers PSC detention history, casualties, class records",
        "3 stars minimum typically required by major charterers",
        "GHG Rating now included — environmental performance matters",
        "Age of vessel, flag state performance, and owner history factor in",
        "Rating is dynamic and updates based on new inspection results",
      ],
    },
    {
      heading: "Bulk Carrier Hatch Cover Requirements",
      items: [
        "Hatch cover weathertightness testing (ultrasonic or hose test)",
        "Coaming drainage and compression bar condition",
        "Hatch cover maintenance records and planned maintenance",
        "Cargo hold structural condition — frame/floor wastage",
        "Hold cleanliness standards for different cargo grades",
        "Loading/unloading equipment condition and certification",
      ],
    },
    {
      heading: "IMSBC Code — Liquefying Cargoes",
      items: [
        "Critical for nickel ore, iron ore fines, bauxite cargoes",
        "Transportable Moisture Limit (TML) testing mandatory",
        "Master's right to refuse cargo above TML — know your rights",
        "Can testing procedures (visual assessment before loading)",
        "Group A cargoes — risk of liquefaction and vessel capsize",
        "Shipper's declaration and certificate of moisture content required",
      ],
    },
    {
      heading: "Container Lashing & IMDG Requirements",
      items: [
        "Cargo Securing Manual (CSM) must be followed precisely",
        "Container weight verification (VGM) — SOLAS requirement",
        "IMDG Code for dangerous goods in containers — stowage and segregation",
        "Lashing equipment inspection and maintenance records",
        "Stack weight limits and bay planning compliance",
        "Reefer container monitoring and pre-trip inspections",
      ],
    },
  ],
};

const MyVesselType = ({ onBack }: MyVesselTypeProps) => {
  const [selected, setSelected] = useState<"tanker" | "dry" | null>(null);

  const content = selected === "tanker" ? TANKER_CONTENT : selected === "dry" ? DRY_CARGO_CONTENT : null;

  if (content) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="text-muted-foreground">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-semibold text-foreground">{content.title}</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {content.sections.map((section, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold text-primary mb-2">{section.heading}</h3>
                <ul className="space-y-1.5">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-semibold text-foreground">My Vessel Type</h2>
          <p className="text-[11px] text-muted-foreground">Select your vessel type for relevant vetting info</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <Button variant="outline" className="w-full h-14 justify-start gap-3" onClick={() => setSelected("tanker")}>
          <Ship size={20} className="text-primary" />
          <div className="text-left">
            <p className="font-medium text-foreground">Tanker</p>
            <p className="text-[11px] text-muted-foreground">SIRE 2.0, CDI, Oil Major Vetting</p>
          </div>
        </Button>
        <Button variant="outline" className="w-full h-14 justify-start gap-3" onClick={() => setSelected("dry")}>
          <Ship size={20} className="text-primary" />
          <div className="text-left">
            <p className="font-medium text-foreground">Dry Cargo</p>
            <p className="text-[11px] text-muted-foreground">RightShip, IMSBC, IMDG, Lashing</p>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default MyVesselType;
