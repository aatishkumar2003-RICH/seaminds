import { useState } from "react";
import { Shield, Ship, MapPin, FileText, Scale, Search, Youtube, Globe, ExternalLink, Sparkles, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DrillDownTopic from "@/components/academy/DrillDownTopic";
import RestHoursTracker from "@/components/academy/RestHoursTracker";
import { ALL_TOPICS } from "@/components/academy/academyData";

const ICON_MAP = { Shield, Ship, MapPin, FileText, Scale } as const;

type CategoryId = "inspections" | "vessels" | "reference" | "rights";

const CATEGORIES: { id: CategoryId; label: string; topicIds: string[] }[] = [
  { id: "inspections", label: "PSC Inspections", topicIds: ["sire2", "psc-uscg", "psc-amsa", "psc-paris", "psc-tokyo", "psc-indian", "psc-itf"] },
  { id: "vessels", label: "Vessel Types", topicIds: ["vessel-tanker", "vessel-dry"] },
  { id: "reference", label: "Quick Reference", topicIds: ["ref-uscg", "ref-amsa", "ref-paris", "ref-tokyo"] },
  { id: "rights", label: "Rights & Welfare", topicIds: ["itf-rights", "next-port"] },
];

const MARITIME_RESOURCES = [
  { name: "IMO Official", url: "https://www.imo.org/en/MediaCentre/Pages/SearchResults.aspx?k=", icon: "🌐" },
  { name: "AMSA Australia", url: "https://www.amsa.gov.au/search?q=", icon: "🇦🇺" },
  { name: "USCG", url: "https://www.dco.uscg.mil/search?q=", icon: "🇺🇸" },
  { name: "ITF Seafarers", url: "https://www.itfseafarers.org/?s=", icon: "⚓" },
  { name: "Marine Insight", url: "https://www.marineinsight.com/?s=", icon: "📰" },
];

const RELATED_TOPICS: Record<string, string[]> = {
  "sire": ["Tanker vetting", "Human factors", "OCIMF requirements"],
  "psc": ["Port state control", "Detention statistics", "Flag state inspections"],
  "safety": ["ISM Code", "Risk assessment", "Emergency drills"],
  "navigation": ["ECDIS", "Bridge procedures", "Collision regulations"],
  "cargo": ["Cargo operations", "Bill of lading", "IMSBC Code"],
  "engine": ["Engine room safety", "Planned maintenance", "Bunkering"],
  "crew": ["Crew welfare", "MLC 2006", "Rest hours"],
  "default": ["SIRE 2.0 preparation", "MLC crew rights", "PSC inspections"],
};

function getSuggestedTopics(query: string): string[] {
  const q = query.toLowerCase();
  for (const [key, topics] of Object.entries(RELATED_TOPICS)) {
    if (key !== "default" && q.includes(key)) return topics;
  }
  if (q.includes("tanker") || q.includes("vetting")) return RELATED_TOPICS["sire"];
  if (q.includes("inspect") || q.includes("detention")) return RELATED_TOPICS["psc"];
  if (q.includes("bridge") || q.includes("navigation") || q.includes("ecdis")) return RELATED_TOPICS["navigation"];
  if (q.includes("cargo") || q.includes("container") || q.includes("bulk")) return RELATED_TOPICS["cargo"];
  if (q.includes("engine") || q.includes("bunker")) return RELATED_TOPICS["engine"];
  if (q.includes("welfare") || q.includes("rest") || q.includes("mlc") || q.includes("rights")) return RELATED_TOPICS["crew"];
  return RELATED_TOPICS["default"];
}

const Academy = () => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [showRestHours, setShowRestHours] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string | null>(null);

  const activeTopic = ALL_TOPICS.find((t) => t.id === activeTopicId);

  if (showRestHours) {
    return <RestHoursTracker onBack={() => setShowRestHours(false)} />;
  }

  if (activeTopic) {
    return (
      <DrillDownTopic
        topic={activeTopic.data}
        onBack={() => setActiveTopicId(null)}
      />
    );
  }

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchResults(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleSuggestedTopic = (topic: string) => {
    setSearchQuery(topic);
    setSearchResults(topic);
  };

  const encodedQuery = searchResults ? encodeURIComponent(searchResults) : "";
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodedQuery}+maritime+seafarer`;
  const googleUrl = `https://www.google.com/search?q=${encodedQuery}+maritime+regulations+seafarer`;
  const suggestedTopics = searchResults ? getSuggestedTopics(searchResults) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Academy</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Search any maritime topic or browse below</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Search Bar */}
          <div className="rounded-xl bg-primary/10 border-2 border-primary/40 p-3 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search any maritime topic — regulations, procedures, vessel types..."
                  className="pl-9 bg-card border-primary/30 text-foreground placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
              <Button onClick={handleSearch} size="default" className="shrink-0">
                <Search size={16} />
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults && (
            <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-300">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                Results for "{searchResults}"
              </p>

              {/* YouTube */}
              <button
                onClick={() => window.open(youtubeUrl, "_blank")}
                className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 hover:border-primary/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                  <Youtube size={18} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Watch videos on YouTube</p>
                  <p className="text-[11px] text-muted-foreground">Search "{searchResults}" maritime videos</p>
                </div>
                <ExternalLink size={14} className="text-muted-foreground shrink-0" />
              </button>

              {/* Google */}
              <button
                onClick={() => window.open(googleUrl, "_blank")}
                className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-4 hover:border-primary/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Globe size={18} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Search on Google</p>
                  <p className="text-[11px] text-muted-foreground">Maritime regulations & guidance</p>
                </div>
                <ExternalLink size={14} className="text-muted-foreground shrink-0" />
              </button>

              {/* Maritime Resources */}
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                Official Maritime Resources
              </p>
              {MARITIME_RESOURCES.map((res) => (
                <button
                  key={res.name}
                  onClick={() => window.open(`${res.url}${encodedQuery}`, "_blank")}
                  className="w-full flex items-center gap-3 rounded-xl bg-card border border-border p-3 hover:border-primary/50 transition-colors text-left"
                >
                  <span className="text-lg w-6 text-center">{res.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{res.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">Search "{searchResults}"</p>
                  </div>
                  <ExternalLink size={12} className="text-muted-foreground shrink-0" />
                </button>
              ))}

              {/* Suggested Topics */}
              <div className="pt-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={12} className="text-primary" />
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Related Topics</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedTopics.map((topic) => (
                    <Badge
                      key={topic}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors text-xs py-1 px-3"
                      onClick={() => handleSuggestedTopic(topic)}
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Rest Hours Tracker */}
          <div>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-2">Tools</p>
            <button
              onClick={() => setShowRestHours(true)}
              className="w-full rounded-xl bg-card border border-primary/30 p-4 text-left hover:border-primary/50 transition-colors flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Clock size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">My Rest Hours Log</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">STCW compliance tracker — private to you</p>
              </div>
            </button>
          </div>

          {/* Existing Topic Cards */}
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
