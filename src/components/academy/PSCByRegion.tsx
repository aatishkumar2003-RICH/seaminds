import { ArrowLeft, Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PSCByRegionProps {
  onBack: () => void;
}

const REGIONS = [
  {
    code: "USCG",
    label: "USCG (USA)",
    description: "United States Coast Guard inspections apply to all foreign-flagged vessels entering US ports.",
    inspects: [
      "Structural integrity and hull condition",
      "Fire safety systems and drills",
      "Life-saving appliances",
      "Crew certifications (STCW compliance)",
      "MARPOL compliance (oil record book, garbage management)",
      "ISM Code implementation",
      "MTSA (Maritime Transportation Security Act) compliance",
    ],
    focusAreas: [
      "Cyber security awareness and procedures",
      "Crew fatigue management — rest hour records scrutinised heavily",
      "Ballast water management systems compliance",
      "Enclosed space entry procedures (post-incident focus)",
      "STCW Manila amendments — crew competency verification",
    ],
    topDeficiencies: [
      "Fire safety deficiencies (extinguishers, fire doors, detection systems)",
      "Lifesaving equipment (lifeboat maintenance, EPIRB/SART testing)",
      "ISM — failure to follow SMS procedures",
      "MARPOL Annex I — oil record book discrepancies",
      "Working and living conditions (MLC violations)",
    ],
  },
  {
    code: "AMSA",
    label: "AMSA (Australia)",
    description: "Australian Maritime Safety Authority inspects all foreign vessels entering Australian waters.",
    inspects: [
      "Structural safety and seaworthiness",
      "Navigation equipment and charts (Australian waters)",
      "Pollution prevention (especially Great Barrier Reef zone)",
      "Crew welfare and MLC compliance",
      "Cargo securing and dangerous goods",
      "Biosecurity compliance (unique to Australia)",
    ],
    focusAreas: [
      "Concentrated Inspection Campaign (CIC) on SOLAS Chapter II-2 fire safety",
      "Crew mental health and welfare — expanded MLC checks",
      "Environmental compliance in sensitive marine areas",
      "Ballast water management — zero tolerance in reef areas",
      "IMSBC Code compliance for bulk carriers loading in Australia",
    ],
    topDeficiencies: [
      "Fire safety systems — detection and suppression deficiencies",
      "Safety of navigation — passage planning and chart updates",
      "MLC — crew hours of rest non-compliance",
      "ISM — non-conformities in safety management systems",
      "Structural deficiencies — corrosion and wastage",
    ],
  },
  {
    code: "Paris MOU",
    label: "Paris MOU (Europe/Canada)",
    description: "Covers 27 maritime administrations across Europe and Canada.",
    inspects: [
      "SOLAS safety equipment and structural condition",
      "MARPOL pollution prevention",
      "STCW crew qualifications",
      "MLC 2006 seafarer working conditions",
      "ISM/ISPS Code implementation",
      "Load line and tonnage compliance",
    ],
    focusAreas: [
      "CIC 2024 — Safety of navigation including ECDIS",
      "EU MRV / IMO DCS — carbon intensity reporting",
      "Fuel oil quality and sulphur content compliance (EU ETS)",
      "MLC amendments 2024 — enhanced crew welfare checks",
      "Cyber risk management in SMS",
    ],
    topDeficiencies: [
      "Fire safety — detection, structural protection, fire-fighting",
      "Life-saving appliances — maintenance and drill records",
      "Safety of navigation — ECDIS, charts, passage planning",
      "MLC — seafarer employment agreements and wages",
      "ISM — objective evidence of SMS non-conformities",
    ],
  },
  {
    code: "Tokyo MOU",
    label: "Tokyo MOU (Asia Pacific)",
    description: "Covers 21 member authorities in the Asia-Pacific region.",
    inspects: [
      "Ship structure and equipment",
      "Manning and crew certification",
      "Working and living conditions",
      "Safety management (ISM Code)",
      "Security (ISPS Code)",
      "Environmental compliance",
    ],
    focusAreas: [
      "Joint CIC with Paris MOU on fire safety",
      "Concentrated efforts on bulk carrier safety",
      "Enhanced focus on tanker operational safety",
      "MLC compliance — particular focus on crew wages and repatriation",
      "EEXI/CII compliance verification",
    ],
    topDeficiencies: [
      "Fire safety — same pattern as global trends",
      "Life-saving appliances and arrangements",
      "Safety of navigation equipment",
      "MARPOL — oil filtering equipment, sewage treatment",
      "Labour conditions — hours of rest violations",
    ],
  },
  {
    code: "IOMOU",
    label: "Indian Ocean MOU",
    description: "Covers maritime administrations around the Indian Ocean region.",
    inspects: [
      "SOLAS conventions compliance",
      "MARPOL environmental standards",
      "STCW seafarer certification",
      "MLC 2006 working conditions",
      "Load lines and stability",
      "Tonnage measurement compliance",
    ],
    focusAreas: [
      "Structural integrity of aging fleet in region",
      "Crew certification verification — focus on fraudulent certificates",
      "Oil record book and MARPOL Annex I compliance",
      "Basic safety equipment maintenance",
      "MLC — food and catering standards aboard",
    ],
    topDeficiencies: [
      "Structural safety — hull corrosion and wastage",
      "Fire safety equipment deficiencies",
      "Life-saving appliances — poor maintenance",
      "Crew certification — invalid or missing certificates",
      "MARPOL violations — inadequate pollution prevention",
    ],
  },
  {
    code: "ITF",
    label: "ITF Inspections",
    description: "International Transport Workers' Federation inspectors focus on crew welfare and labour rights.",
    inspects: [
      "Seafarer Employment Agreements (SEA)",
      "Wage payments — comparing contracts to CBA minimums",
      "Hours of work and rest compliance",
      "Food quality and provisions",
      "Accommodation and living conditions",
      "Repatriation rights and arrangements",
    ],
    focusAreas: [
      "Wage theft — underpayment below ITF-approved CBA rates",
      "Contract substitution — different terms signed at embarkation",
      "Forced labour indicators — withholding of documents",
      "Abandonment cases — unpaid wages over 2 months",
      "Right to shore leave and communication access",
    ],
    topDeficiencies: [
      "Wages below CBA minimum rates",
      "Discrepancies between signed contracts and actual conditions",
      "Inadequate provisions and drinking water",
      "Excessive working hours without proper rest",
      "Withholding of passports or travel documents",
    ],
  },
];

const PSCByRegion = ({ onBack }: PSCByRegionProps) => {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const region = REGIONS.find((r) => r.code === selectedRegion);

  if (region) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <button onClick={() => setSelectedRegion(null)} className="text-muted-foreground">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-semibold text-foreground">{region.label}</h2>
            <p className="text-[11px] text-muted-foreground">{region.description}</p>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            <Section title="What They Inspect" items={region.inspects} />
            <Section title="Current Focus Areas 2024–25" items={region.focusAreas} accent />
            <Section title="Top Deficiencies" items={region.topDeficiencies} />
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
          <h2 className="font-semibold text-foreground">PSC by Region</h2>
          <p className="text-[11px] text-muted-foreground">Select a region to view inspection details</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 grid grid-cols-2 gap-3">
          {REGIONS.map((r) => (
            <button
              key={r.code}
              onClick={() => setSelectedRegion(r.code)}
              className="rounded-xl bg-card border border-border p-4 text-left hover:border-primary/50 transition-colors"
            >
              <Shield size={18} className="text-primary mb-2" />
              <p className="text-sm font-medium text-foreground">{r.label}</p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

const Section = ({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) => (
  <div>
    <h3 className={`text-sm font-semibold mb-2 ${accent ? "text-primary" : "text-foreground"}`}>{title}</h3>
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
          <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

export default PSCByRegion;
