import { ArrowLeft, FileText } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface QuickReferenceCardsProps {
  onBack: () => void;
}

const CHECKLISTS = [
  {
    id: "uscg",
    title: "USCG Checklist",
    subtitle: "United States Coast Guard",
    topDeficiencies: [
      "Fire safety — extinguishers expired, fire doors not self-closing",
      "Lifesaving — lifeboat falls worn, EPIRB not registered correctly",
      "ISM — crew unable to demonstrate SMS knowledge",
      "MARPOL — oil record book entries not matching sounding logs",
      "MLC — rest hour records showing violations",
    ],
    inspectorChecksFirst: [
      "Certificates and documents — class, statutory, crew",
      "Bridge — GMDSS equipment test, ECDIS, passage plan",
      "Engine room — oily water separator, incinerator log",
      "Fire safety — random fire station, extinguisher check",
      "Crew interview — safety procedures and emergency duties",
    ],
  },
  {
    id: "amsa",
    title: "AMSA Checklist",
    subtitle: "Australian Maritime Safety Authority",
    topDeficiencies: [
      "Fire detection systems — faulty smoke detectors in accommodation",
      "Navigation safety — outdated charts, incomplete passage plans",
      "MLC — crew working hours exceeding limits",
      "ISM — objective evidence of non-conformities not addressed",
      "Structural — corrosion in ballast tanks and void spaces",
    ],
    inspectorChecksFirst: [
      "Ship's particulars and certificates validity",
      "Bridge equipment — ECDIS, AIS, VDR data recording",
      "Biosecurity declaration (unique to Australia)",
      "Crew welfare — accommodation, food stores, medical supplies",
      "Pollution prevention — SOPEP, oil record book, garbage record",
    ],
  },
  {
    id: "paris",
    title: "Paris MOU Checklist",
    subtitle: "Europe & Canada",
    topDeficiencies: [
      "Fire safety — structural fire protection and detection",
      "Lifesaving — maintenance of launching appliances",
      "Navigation — ECDIS familiarisation records incomplete",
      "MLC — seafarer employment agreements deficient",
      "ISM — objective evidence requirements not met",
    ],
    inspectorChecksFirst: [
      "Document review — certificates, class status, flag state",
      "General impression — deck condition, maintenance standard",
      "Bridge — navigation equipment, chart updates, BRM evidence",
      "Engine room — safety systems, alarm testing, OWS",
      "Crew quarters — MLC compliance, food, medical chest",
    ],
  },
  {
    id: "tokyo",
    title: "Tokyo MOU Checklist",
    subtitle: "Asia Pacific",
    topDeficiencies: [
      "Fire safety — same global trend as Paris MOU findings",
      "Lifesaving equipment — servicing records and condition",
      "Navigation safety — radar, ECDIS operational issues",
      "MARPOL — sewage treatment plant, OWS malfunctions",
      "Labour conditions — rest hours and wage documentation",
    ],
    inspectorChecksFirst: [
      "Ship risk profile assessment — targeting based on history",
      "Certificates and crew documentation verification",
      "Safety equipment spot checks — fire, LSA",
      "Engine room walkthrough — OWS, fuel changeover records",
      "Crew interview — emergency procedures and rest hours",
    ],
  },
];

const QuickReferenceCards = ({ onBack }: QuickReferenceCardsProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = CHECKLISTS.find((c) => c.id === selectedId);

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <button onClick={() => setSelectedId(null)} className="text-muted-foreground">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-semibold text-foreground">{selected.title}</h2>
            <p className="text-[11px] text-muted-foreground">{selected.subtitle}</p>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-destructive mb-2">Top 5 Deficiencies</h3>
              <ol className="space-y-1.5">
                {selected.topDeficiencies.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">What Inspector Checks First</h3>
              <ol className="space-y-1.5">
                {selected.inspectorChecksFirst.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
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
          <h2 className="font-semibold text-foreground">Quick Reference Cards</h2>
          <p className="text-[11px] text-muted-foreground">Tap a checklist to view details</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {CHECKLISTS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="w-full rounded-xl bg-card border border-border p-4 text-left hover:border-primary/50 transition-colors flex items-center gap-3"
            >
              <FileText size={20} className="text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{c.title}</p>
                <p className="text-[11px] text-muted-foreground">{c.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default QuickReferenceCards;
