import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Ship, Anchor, Globe, Clock, MapPin, DollarSign, Check, AlertTriangle, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const VESSEL_TYPES = [
  "Bulk Carrier", "Tanker", "Chemical Tanker", "Container Ship",
  "General Cargo", "LNG/LPG", "Offshore", "Any Type",
];

interface FindWorkProps {
  profileId: string;
  firstName: string;
  lastName: string;
  role: string;
  nationality: string;
  yearsAtSea: string;
  shipName: string;
}

interface Vacancy {
  id: string;
  vessel_type: string;
  vessel_name: string;
  rank_required: string;
  contract_duration: string;
  start_date: string;
  joining_port: string;
  salary_min: number;
  salary_max: number;
  company_name: string;
  manager_profile_id: string;
  min_smc_score: number | null;
}

// Demo SMC score for development
const DEMO_SMC_SCORE = 4.17;

const FindWork = ({ profileId, firstName, lastName, role, nationality, yearsAtSea, shipName }: FindWorkProps) => {
  const [availabilityDate, setAvailabilityDate] = useState<Date>();
  const [preferredVessel, setPreferredVessel] = useState("Any Type");
  const [aboutMe, setAboutMe] = useState("");
  const [visible, setVisible] = useState(false);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [availRes, vacRes] = await Promise.all([
      supabase.from("crew_availability").select("*").eq("crew_profile_id", profileId).maybeSingle(),
      supabase.from("job_vacancies").select("*").eq("active", true).order("created_at", { ascending: false }),
    ]);

    if (availRes.data) {
      setAvailabilityDate(availRes.data.availability_date ? new Date(availRes.data.availability_date) : undefined);
      setPreferredVessel(availRes.data.preferred_vessel_type || "Any Type");
      setAboutMe(availRes.data.about_me || "");
      setVisible(availRes.data.visible_to_employers);
    }

    if (vacRes.data) setVacancies(vacRes.data);
    setLoading(false);
  };

  const saveAvailability = async (newVisible?: boolean) => {
    setSaving(true);
    const visVal = newVisible !== undefined ? newVisible : visible;
    const payload = {
      crew_profile_id: profileId,
      availability_date: availabilityDate ? format(availabilityDate, "yyyy-MM-dd") : null,
      preferred_vessel_type: preferredVessel,
      about_me: aboutMe,
      visible_to_employers: visVal,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("crew_availability")
      .select("id")
      .eq("crew_profile_id", profileId)
      .maybeSingle();

    if (existing) {
      await supabase.from("crew_availability").update(payload).eq("crew_profile_id", profileId);
    } else {
      await supabase.from("crew_availability").insert(payload);
    }
    setSaving(false);
    toast({ title: "Profile Updated", description: visVal ? "You are now visible to employers." : "Changes saved." });
  };

  const handleToggle = (checked: boolean) => {
    setVisible(checked);
    saveAvailability(checked);
  };

  const handleApply = async (vacancy: Vacancy) => {
    const { error } = await supabase.from("contact_requests").insert({
      vacancy_id: vacancy.id,
      crew_profile_id: profileId,
      manager_profile_id: vacancy.manager_profile_id,
      company_name: vacancy.company_name,
      vessel_type: vacancy.vessel_type,
      rank_required: vacancy.rank_required,
      status: "applied",
    });

    if (error) {
      toast({ title: "Error", description: "Could not send application. Try again.", variant: "destructive" });
    } else {
      toast({ title: "Application Sent", description: `Your profile has been sent to ${vacancy.company_name}.` });
    }
  };

  const wordCount = aboutMe.trim().split(/\s+/).filter(Boolean).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">Loading...</span></div>;
  }

  return (
    <div className="space-y-5">
      {/* CV Preview */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Anchor size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Maritime CV Preview</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Name</span>
            <p className="text-foreground font-medium">{firstName} {lastName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Rank</span>
            <p className="text-foreground font-medium">{role}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Nationality</span>
            <p className="text-foreground font-medium">{nationality || "Not set"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Years at Sea</span>
            <p className="text-foreground font-medium">{yearsAtSea || "Not set"}</p>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Current / Last Vessel</span>
            <p className="text-foreground font-medium">{shipName}</p>
          </div>
        </div>
      </div>

      {/* Availability Fields */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Complete Your Profile</h3>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Availability Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !availabilityDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {availabilityDate ? format(availabilityDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={availabilityDate} onSelect={setAvailabilityDate} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Preferred Vessel Type</label>
          <Select value={preferredVessel} onValueChange={setPreferredVessel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VESSEL_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">One Line About Me <span className="text-muted-foreground/60">(optional, max 20 words)</span></label>
          <Input
            value={aboutMe}
            onChange={(e) => {
              const words = e.target.value.trim().split(/\s+/).filter(Boolean);
              if (words.length <= 20) setAboutMe(e.target.value);
            }}
            placeholder="e.g. Experienced officer with tanker specialization"
            className="text-sm"
          />
          <p className="text-[10px] text-muted-foreground">{wordCount}/20 words</p>
        </div>

        <Button size="sm" onClick={() => saveAvailability()} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>

      {/* Visibility Toggle */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Make Me Visible to Employers</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Employers can find and contact you</p>
          </div>
          <Switch checked={visible} onCheckedChange={handleToggle} className="scale-125" />
        </div>
        {visible && (
          <div className="mt-3 flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            <Check size={14} className="text-primary" />
            <span className="text-xs text-primary font-medium">Profile Active — Employers Can Find You</span>
          </div>
        )}
      </div>

      {/* Job Listings */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide px-1">Available Positions</h3>
        {vacancies.length === 0 ? (
          <div className="rounded-xl bg-card border border-border p-6 text-center">
            <Ship size={24} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No vacancies posted yet. Check back soon.</p>
          </div>
        ) : (
          vacancies.map((v) => (
            <div key={v.id} className="rounded-xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-foreground">{v.rank_required}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.company_name}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                  {v.vessel_type}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Ship size={12} className="text-primary/70" />
                  <span>{v.vessel_name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-primary/70" />
                  <span>{v.contract_duration}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={12} className="text-primary/70" />
                  <span>{v.start_date ? format(new Date(v.start_date), "MMM yyyy") : "TBD"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-primary/70" />
                  <span>{v.joining_port}</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <DollarSign size={12} className="text-primary/70" />
                  <span>${v.salary_min.toLocaleString()} – ${v.salary_max.toLocaleString()} /mo</span>
                </div>
                {v.min_smc_score && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <Award size={12} className="text-primary/70" />
                    <span>Min SMC Score: {v.min_smc_score.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {(() => {
                const meetsScore = !v.min_smc_score || DEMO_SMC_SCORE >= v.min_smc_score;
                if (meetsScore) {
                  return <Button size="sm" className="w-full" onClick={() => handleApply(v)}>Apply Now</Button>;
                }
                return (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={12} className="text-amber-400" />
                      <span className="text-xs font-medium text-amber-300">Score Required: {v.min_smc_score?.toFixed(2)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Your Score: <span className="text-foreground font-medium">{DEMO_SMC_SCORE.toFixed(2)}</span> — Visit Academy to Improve
                    </p>
                  </div>
                );
              })()}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FindWork;
