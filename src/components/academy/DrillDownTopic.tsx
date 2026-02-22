import { ArrowLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface DetailSection {
  title: string;
  items: string[];
}

export interface TopicPoint {
  title: string;
  summary: string;
  detail: {
    heading: string;
    intro: string;
    sections: DetailSection[];
    note?: string;
  };
}

export interface TopicData {
  title: string;
  summary: string;
  points: TopicPoint[];
}

interface DrillDownTopicProps {
  topic: TopicData;
  onBack: () => void;
}

const DrillDownTopic = ({ topic, onBack }: DrillDownTopicProps) => {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  const point = selectedPointIndex !== null ? topic.points[selectedPointIndex] : null;

  // Level 3 — Full detail
  if (point) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <button onClick={() => setSelectedPointIndex(null)} className="text-muted-foreground">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-semibold text-foreground text-sm leading-tight">{point.detail.heading}</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            <p className="text-xs text-muted-foreground leading-relaxed">{point.detail.intro}</p>
            {point.detail.sections.map((section, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold text-primary mb-2">{section.title}</h3>
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
            {point.detail.note && (
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <p className="text-xs text-primary font-semibold mb-1">IMPORTANT</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{point.detail.note}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Level 2 — Key points list
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-semibold text-foreground">{topic.title}</h2>
          <p className="text-[11px] text-muted-foreground">{topic.summary}</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {topic.points.map((p, i) => (
            <button
              key={i}
              onClick={() => setSelectedPointIndex(i)}
              className="w-full rounded-xl bg-card border border-border p-4 text-left hover:border-primary/50 transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{p.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.summary}</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default DrillDownTopic;
