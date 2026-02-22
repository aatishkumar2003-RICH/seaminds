import { useState } from "react";
import { Shield, Ship, MapPin, FileText, Scale } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import DrillDownTopic from "@/components/academy/DrillDownTopic";
import { ALL_TOPICS } from "@/components/academy/academyData";

const ICON_MAP = { Shield, Ship, MapPin, FileText, Scale } as const;

type CategoryId = "inspections" | "vessels" | "reference" | "rights";

const CATEGORIES: { id: CategoryId; label: string; topicIds: string[] }[] = [
  { id: "inspections", label: "PSC Inspections", topicIds: ["sire2", "psc-uscg", "psc-amsa", "psc-paris", "psc-tokyo", "psc-indian", "psc-itf"] },
  { id: "vessels", label: "Vessel Types", topicIds: ["vessel-tanker", "vessel-dry"] },
  { id: "reference", label: "Quick Reference", topicIds: ["ref-uscg", "ref-amsa", "ref-paris", "ref-tokyo"] },
  { id: "rights", label: "Rights & Welfare", topicIds: ["itf-rights", "next-port"] },
];

const Academy = () => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);

  const activeTopic = ALL_TOPICS.find((t) => t.id === activeTopicId);

  if (activeTopic) {
    return (
      <DrillDownTopic
        topic={activeTopic.data}
        onBack={() => setActiveTopicId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Academy</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Inspections, Vetting & Your Rights</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-2">{cat.label}</p>
              <div className="space-y-2">
                {cat.topicIds.map((tid) => {
                  const topic = ALL_TOPICS.find((t) => t.id === tid);
                  if (!topic) return null;
                  const IconComponent = ICON_MAP[topic.icon];
                  return (
                    <button
                      key={tid}
                      onClick={() => setActiveTopicId(tid)}
                      className="w-full rounded-xl bg-card border border-border p-4 text-left hover:border-primary/50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <IconComponent size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{topic.data.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{topic.data.summary}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Academy;
