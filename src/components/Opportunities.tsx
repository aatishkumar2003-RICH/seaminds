import { Briefcase, MapPin, Calendar, Clock, Ship, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const LISTINGS = [
  {
    id: 1,
    vesselType: "Bulk Carrier",
    rank: "Chief Officer",
    company: "Pacific Maritime Ltd",
    contract: "4 months",
    startDate: "March 2026",
    location: "Singapore",
  },
  {
    id: 2,
    vesselType: "Container Ship",
    rank: "AB Seaman",
    company: "Global Crew Agency",
    contract: "6 months",
    startDate: "April 2026",
    location: "Manila",
  },
  {
    id: 3,
    vesselType: "Tanker",
    rank: "2nd Engineer",
    company: "Ocean Manning Services",
    contract: "5 months",
    startDate: "March 2026",
    location: "Mumbai",
  },
];

const Opportunities = () => {
  const handleApply = (rank: string, company: string) => {
    toast({
      title: "Application Sent",
      description: `Your interest in the ${rank} position at ${company} has been noted.`,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Opportunities</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Browse available positions</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {LISTINGS.map((job) => (
          <div
            key={job.id}
            className="rounded-xl bg-card border border-border p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-foreground">{job.rank}</h2>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Building2 size={12} />
                  <span>{job.company}</span>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                {job.vesselType}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-primary/70" />
                <span>{job.contract}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-primary/70" />
                <span>{job.startDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={12} className="text-primary/70" />
                <span>{job.location}</span>
              </div>
            </div>

            <Button
              size="sm"
              className="w-full"
              onClick={() => handleApply(job.rank, job.company)}
            >
              Apply
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Opportunities;
