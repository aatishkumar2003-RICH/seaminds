import { ArrowLeft, Search, MapPin } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MyNextPortProps {
  onBack: () => void;
}

const PORT_DATABASE: Record<string, { authority: string; region: string; focus: string[] }> = {
  // USA
  houston: { authority: "USCG (United States Coast Guard)", region: "USA", focus: ["Cyber security procedures", "Crew fatigue management and rest hours", "Ballast water management", "MTSA security compliance", "Enclosed space entry procedures"] },
  "new york": { authority: "USCG (United States Coast Guard)", region: "USA", focus: ["Cyber security procedures", "Crew fatigue management and rest hours", "Ballast water management", "MTSA security compliance", "Enclosed space entry procedures"] },
  "new orleans": { authority: "USCG (United States Coast Guard)", region: "USA", focus: ["Cyber security procedures", "Crew fatigue management and rest hours", "Ballast water management", "MTSA security compliance", "Enclosed space entry procedures"] },
  "los angeles": { authority: "USCG (United States Coast Guard)", region: "USA", focus: ["Cyber security procedures", "Crew fatigue management and rest hours", "Ballast water management", "MTSA security compliance", "Enclosed space entry procedures"] },
  // Australia
  sydney: { authority: "AMSA (Australian Maritime Safety Authority)", region: "Australia", focus: ["Fire safety (CIC focus)", "Crew mental health and MLC welfare", "Environmental compliance", "Ballast water — zero tolerance near reef", "IMSBC Code for bulk cargoes"] },
  melbourne: { authority: "AMSA (Australian Maritime Safety Authority)", region: "Australia", focus: ["Fire safety (CIC focus)", "Crew mental health and MLC welfare", "Environmental compliance", "Ballast water — zero tolerance near reef", "IMSBC Code for bulk cargoes"] },
  "port hedland": { authority: "AMSA (Australian Maritime Safety Authority)", region: "Australia", focus: ["Fire safety (CIC focus)", "Crew mental health and MLC welfare", "Environmental compliance", "Ballast water — zero tolerance near reef", "IMSBC Code for bulk cargoes"] },
  brisbane: { authority: "AMSA (Australian Maritime Safety Authority)", region: "Australia", focus: ["Fire safety (CIC focus)", "Crew mental health and MLC welfare", "Environmental compliance", "Ballast water — zero tolerance near reef", "IMSBC Code for bulk cargoes"] },
  // Europe
  rotterdam: { authority: "Paris MOU", region: "Europe", focus: ["ECDIS and navigation safety (CIC)", "EU ETS carbon reporting", "Sulphur content compliance", "MLC 2024 amendments — crew welfare", "Cyber risk management in SMS"] },
  hamburg: { authority: "Paris MOU", region: "Europe", focus: ["ECDIS and navigation safety (CIC)", "EU ETS carbon reporting", "Sulphur content compliance", "MLC 2024 amendments — crew welfare", "Cyber risk management in SMS"] },
  antwerp: { authority: "Paris MOU", region: "Europe", focus: ["ECDIS and navigation safety (CIC)", "EU ETS carbon reporting", "Sulphur content compliance", "MLC 2024 amendments — crew welfare", "Cyber risk management in SMS"] },
  "le havre": { authority: "Paris MOU", region: "Europe", focus: ["ECDIS and navigation safety (CIC)", "EU ETS carbon reporting", "Sulphur content compliance", "MLC 2024 amendments — crew welfare", "Cyber risk management in SMS"] },
  // Asia Pacific
  singapore: { authority: "Tokyo MOU", region: "Asia Pacific", focus: ["Joint CIC on fire safety", "Bulk carrier safety focus", "Tanker operational safety", "MLC — crew wages and repatriation", "EEXI/CII compliance"] },
  shanghai: { authority: "Tokyo MOU", region: "Asia Pacific", focus: ["Joint CIC on fire safety", "Bulk carrier safety focus", "Tanker operational safety", "MLC — crew wages and repatriation", "EEXI/CII compliance"] },
  busan: { authority: "Tokyo MOU", region: "Asia Pacific", focus: ["Joint CIC on fire safety", "Bulk carrier safety focus", "Tanker operational safety", "MLC — crew wages and repatriation", "EEXI/CII compliance"] },
  tokyo: { authority: "Tokyo MOU", region: "Asia Pacific", focus: ["Joint CIC on fire safety", "Bulk carrier safety focus", "Tanker operational safety", "MLC — crew wages and repatriation", "EEXI/CII compliance"] },
  manila: { authority: "Tokyo MOU", region: "Asia Pacific", focus: ["Joint CIC on fire safety", "Bulk carrier safety focus", "Tanker operational safety", "MLC — crew wages and repatriation", "EEXI/CII compliance"] },
  // Indian Ocean
  mumbai: { authority: "Indian Ocean MOU", region: "Indian Ocean", focus: ["Structural integrity of aging vessels", "Crew certification verification", "Oil record book compliance", "Basic safety equipment maintenance", "MLC — food and catering standards"] },
  chennai: { authority: "Indian Ocean MOU", region: "Indian Ocean", focus: ["Structural integrity of aging vessels", "Crew certification verification", "Oil record book compliance", "Basic safety equipment maintenance", "MLC — food and catering standards"] },
  colombo: { authority: "Indian Ocean MOU", region: "Indian Ocean", focus: ["Structural integrity of aging vessels", "Crew certification verification", "Oil record book compliance", "Basic safety equipment maintenance", "MLC — food and catering standards"] },
  jeddah: { authority: "Indian Ocean MOU", region: "Indian Ocean", focus: ["Structural integrity of aging vessels", "Crew certification verification", "Oil record book compliance", "Basic safety equipment maintenance", "MLC — food and catering standards"] },
  durban: { authority: "Indian Ocean MOU", region: "Indian Ocean", focus: ["Structural integrity of aging vessels", "Crew certification verification", "Oil record book compliance", "Basic safety equipment maintenance", "MLC — food and catering standards"] },
};

const MyNextPort = ({ onBack }: MyNextPortProps) => {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ authority: string; region: string; focus: string[] } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = () => {
    const key = query.trim().toLowerCase();
    const match = PORT_DATABASE[key];
    if (match) {
      setResult(match);
      setNotFound(false);
    } else {
      setResult(null);
      setNotFound(true);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-semibold text-foreground">My Next Port</h2>
          <p className="text-[11px] text-muted-foreground">Find out what inspectors focus on at your next port</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter port name (e.g. Rotterdam)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button size="icon" onClick={handleSearch}>
              <Search size={16} />
            </Button>
          </div>

          {result && (
            <div className="rounded-xl bg-card border border-border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                <span className="text-sm font-medium text-foreground capitalize">{query}</span>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">PSC Authority</p>
                <p className="text-sm font-semibold text-primary">{result.authority}</p>
                <p className="text-xs text-muted-foreground">Region: {result.region}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Current Inspection Focus</p>
                <ul className="space-y-1.5">
                  {result.focus.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {notFound && (
            <div className="rounded-xl bg-card border border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">Port not found in database. Try a major port name like Houston, Rotterdam, Singapore, or Mumbai.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MyNextPort;
