import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Lock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RANKS = [
  "Master", "Chief Officer", "2nd Officer", "3rd Officer",
  "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer",
  "Electrician", "Bosun", "AB Seaman", "OS Seaman",
  "Fitter", "Oiler", "Wiper", "Cook", "Steward", "Cadet",
];

const DURATIONS = ["2 months", "3 months", "4 months", "5 months", "6 months", "9 months", "12 months"];

const VESSEL_TYPES = [
  "Bulk Carrier", "Tanker", "Chemical Tanker", "Container Ship",
  "General Cargo", "LNG/LPG", "Offshore",
];

interface MatchingProfile {
  rank: string;
  nationality: string;
  years_at_sea: string;
  availability_date: string | null;
  crew_profile_id: string;
}

const PostVacancy = () => {
  const navigate = useNavigate();
  const [managerProfile, setManagerProfile] = useState<{ id: string; company_name: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Form state
  const [vesselName, setVesselName] = useState("");
  const [vesselType, setVesselType] = useState("");
  const [rankRequired, setRankRequired] = useState("");
  const [contractDuration, setContractDuration] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [joiningPort, setJoiningPort] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [specialReqs, setSpecialReqs] = useState("");
  const [minSmcScore, setMinSmcScore] = useState("");
  const [posting, setPosting] = useState(false);

  // Post-submit state
  const [posted, setPosted] = useState(false);
  const [matches, setMatches] = useState<MatchingProfile[]>([]);
  const [vacancyId, setVacancyId] = useState("");

  useEffect(() => {
    checkManagerAuth();
  }, []);

  const checkManagerAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setAuthChecked(true); return; }

    const { data } = await supabase
      .from("manager_profiles")
      .select("id, company_name")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (data) setManagerProfile(data);
    setAuthChecked(true);
  };

  const handlePost = async () => {
    if (!vesselName || !vesselType || !rankRequired || !contractDuration || !startDate || !joiningPort || !salaryMin || !salaryMax) {
      toast({ title: "Missing Fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }

    if (!managerProfile) return;
    setPosting(true);

    const { data: vacancy, error } = await supabase.from("job_vacancies").insert({
      manager_profile_id: managerProfile.id,
      company_name: managerProfile.company_name,
      vessel_name: vesselName,
      vessel_type: vesselType,
      rank_required: rankRequired,
      contract_duration: contractDuration,
      start_date: format(startDate, "yyyy-MM-dd"),
      joining_port: joiningPort,
      salary_min: parseInt(salaryMin),
      salary_max: parseInt(salaryMax),
      special_requirements: specialReqs,
      min_smc_score: minSmcScore ? parseFloat(minSmcScore) : null,
    }).select("id").single();

    if (error || !vacancy) {
      toast({ title: "Error", description: "Failed to post vacancy.", variant: "destructive" });
      setPosting(false);
      return;
    }

    setVacancyId(vacancy.id);

    // Find matching crew
    const { data: matchData } = await supabase
      .from("crew_availability")
      .select("crew_profile_id, availability_date, preferred_vessel_type")
      .eq("visible_to_employers", true);

    if (matchData && matchData.length > 0) {
      const crewIds = matchData.map((m) => m.crew_profile_id);
      const { data: profiles } = await supabase
        .from("crew_profiles")
        .select("id, role, nationality, years_at_sea")
        .in("id", crewIds);

      if (profiles) {
        const merged: MatchingProfile[] = profiles.map((p) => {
          const avail = matchData.find((m) => m.crew_profile_id === p.id);
          return {
            rank: p.role,
            nationality: p.nationality,
            years_at_sea: p.years_at_sea,
            availability_date: avail?.availability_date || null,
            crew_profile_id: p.id,
          };
        });

        // Sort: matching rank first, then by availability
        merged.sort((a, b) => {
          const aMatch = a.rank.toLowerCase() === rankRequired.toLowerCase() ? 0 : 1;
          const bMatch = b.rank.toLowerCase() === rankRequired.toLowerCase() ? 0 : 1;
          return aMatch - bMatch;
        });

        setMatches(merged);
      }
    }

    setPosted(true);
    setPosting(false);
    toast({ title: "Vacancy Posted", description: "Your vacancy is now live." });
  };

  const handleRequestContact = async (crewProfileId: string) => {
    if (!managerProfile) return;

    await supabase.from("contact_requests").insert({
      vacancy_id: vacancyId,
      crew_profile_id: crewProfileId,
      manager_profile_id: managerProfile.id,
      company_name: managerProfile.company_name,
      vessel_type: vesselType,
      rank_required: rankRequired,
      status: "pending",
    });

    toast({ title: "Request Sent", description: "The crew member will be notified inside SeaMinds." });
  };

  if (!authChecked) {
    return <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">Checking access...</span></div>;
  }

  if (!managerProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
          <Lock size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Manager Access Required</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          This section is for shipping companies and crewing agencies. Manager login required.
        </p>
        <Button onClick={() => navigate("/manager")} className="mt-2">Manager Login</Button>
      </div>
    );
  }

  if (posted) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl bg-card border border-primary/30 p-4 text-center space-y-2">
          <h3 className="text-base font-semibold text-foreground">✅ Vacancy Posted</h3>
          <p className="text-sm text-muted-foreground">
            We found <span className="text-primary font-bold">{matches.length}</span> crew member{matches.length !== 1 ? "s" : ""} matching your requirements.
          </p>
        </div>

        {matches.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide px-1">Matching Profiles</h4>
            {matches.map((m, i) => (
              <div key={i} className="rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-primary" />
                      <span className="font-semibold text-foreground text-sm">{m.rank}</span>
                      {m.rank.toLowerCase() === rankRequired.toLowerCase() && (
                        <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">RANK MATCH</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="block text-[10px]">Nationality</span>
                    <span className="text-foreground">{m.nationality || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px]">Experience</span>
                    <span className="text-foreground">{m.years_at_sea || "—"} yrs</span>
                  </div>
                  <div>
                    <span className="block text-[10px]">Available</span>
                    <span className="text-foreground">{m.availability_date ? format(new Date(m.availability_date), "MMM yyyy") : "—"}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => handleRequestContact(m.crew_profile_id)}>
                  Request Contact
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={() => { setPosted(false); setVesselName(""); setVesselType(""); setRankRequired(""); setContractDuration(""); setStartDate(undefined); setJoiningPort(""); setSalaryMin(""); setSalaryMax(""); setSpecialReqs(""); setMinSmcScore(""); }}>
          Post Another Vacancy
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Post a Vacancy</h3>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Vessel Name & Type *</label>
          <div className="grid grid-cols-2 gap-2">
            <Input value={vesselName} onChange={(e) => setVesselName(e.target.value)} placeholder="MV Pacific Star" className="text-sm" />
            <Select value={vesselType} onValueChange={setVesselType}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {VESSEL_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Rank Required *</label>
          <Select value={rankRequired} onValueChange={setRankRequired}>
            <SelectTrigger><SelectValue placeholder="Select rank" /></SelectTrigger>
            <SelectContent>
              {RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Contract Duration *</label>
          <Select value={contractDuration} onValueChange={setContractDuration}>
            <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Start Date *</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {startDate ? format(startDate, "PP") : "Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Joining Port *</label>
            <Input value={joiningPort} onChange={(e) => setJoiningPort(e.target.value)} placeholder="Singapore" className="text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Monthly Salary Range (USD) *</label>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="From" className="text-sm" />
            <Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="To" className="text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Special Requirements <span className="text-muted-foreground/60">(optional)</span></label>
          <textarea
            value={specialReqs}
            onChange={(e) => setSpecialReqs(e.target.value)}
            placeholder="e.g. Must hold valid US visa, tanker endorsement required"
            rows={3}
            className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Minimum SMC Score Required <span className="text-muted-foreground/60">(optional, 0.00–5.00)</span></label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="5"
            value={minSmcScore}
            onChange={(e) => setMinSmcScore(e.target.value)}
            placeholder="e.g. 3.50"
            className="text-sm"
          />
        </div>

        <Button className="w-full" onClick={handlePost} disabled={posting}>
          {posting ? "Posting..." : "Post Vacancy"}
        </Button>
      </div>
    </div>
  );
};

export default PostVacancy;
