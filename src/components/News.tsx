import { Newspaper, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const ARTICLES = [
  {
    id: 1,
    headline: "MLC 2006 Amendment 2024 — What Every Seafarer Must Know",
    summary: "New amendments strengthen seafarer rights on rest hours and repatriation. Key changes affect all vessels over 500GT.",
    tag: "Rights & Welfare",
  },
  {
    id: 2,
    headline: "Mental Health at Sea — Breaking the Silence",
    summary: "New ITF report shows 1 in 4 seafarers experience depression during long voyages. Support resources now available 24/7.",
    tag: "Mental Health",
  },
  {
    id: 3,
    headline: "Port State Control Inspections — Top 10 Deficiencies in 2025",
    summary: "Paris MOU releases annual report highlighting fatigue management and safety equipment as top concerns.",
    tag: "Safety",
  },
];

const News = () => {
  const handleReadMore = (headline: string) => {
    toast({
      title: "Opening Article",
      description: `Loading: ${headline}`,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Maritime News</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Stay informed on industry updates</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {ARTICLES.map((article) => (
          <div
            key={article.id}
            className="rounded-xl bg-card border border-border p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-foreground text-sm leading-snug flex-1">
                {article.headline}
              </h2>
            </div>

            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
              {article.tag}
            </Badge>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {article.summary}
            </p>

            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-between text-primary hover:text-primary"
              onClick={() => handleReadMore(article.headline)}
            >
              Read More
              <ArrowRight size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default News;
