import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarIcon, Ship, Anchor, Globe, Clock, MapPin, DollarSign, Check, AlertTriangle, Award, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

interface JobPosting {
  id: string;
  rank_required: string;
  vessel_type: string;
  contract_duration: string;
  monthly_salary: string | null;
  joining_port: string;
  contact_whatsapp: string;
  company_name: string;
  additional_notes: string | null;
  created_at: string;
  verified: boolean;
}

interface ExternalVacancy {
  id: string;
  title: string;
  rank_required: string | null;
  vessel_type: string | null;
  company_name: string | null;
  salary_text: string | null;
  joining_port: string | null;
  joining_date: string | null;
  contract_duration: string | null;
  description: string | null;
  apply_url: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  source: string;
  quality_score: number | null;
  created_at: string | null;
}

// Demo SMC score for development
const DEMO_SMC_SCORE = 4.17;

const FindWork = ({ profileId, firstName, lastName, role, nationality, yearsAtSea, shipName }: FindWorkProps) => {
  const [availabilityDate, setAvailabilityDate] = useState<Date>();
  const [preferredVessel, setPreferredVessel] = useState("Any Type");
  const [aboutMe, setAboutMe] = useState("");
  const [visible, setVisible] = useState(false);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [extRankFilter, setExtRankFilter] = useState("all");
  const [extVesselFilter, setExtVesselFilter] = useState("all");
  const [externalVacancies, setExternalVacancies] = useState<ExternalVacancy[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [availRes, vacRes, postingsRes, extRes] = await Promise.all([
      supabase.from("crew_availability").select("*").eq("crew_profile_id", profileId).maybeSingle(),
      supabase.from("job_vacancies").select("*").eq("active", true).order("created_at", { ascending: false }),
      supabase.from("job_postings").select("*").gte("created_at", thirtyDaysAgo.toISOString()).order("created_at", { ascending: false }),
      supabase.from("external_vacancies").select("*").eq("is_scam_flagged", false).gte("quality_score", 30).order("created_at", { ascending: false }).limit(50),
    ]);

    if (availRes.data) {
      setAvailabilityDate(availRes.data.availability_date ? new Date(availRes.data.availability_date) : undefined);
      setPreferredVessel(availRes.data.preferred_vessel_type || "Any Type");
      setAboutMe(availRes.data.about_me || "");
      setVisible(availRes.data.visible_to_employers);
    }

    if (vacRes.data) setVacancies(vacRes.data);
    if (postingsRes.data) setJobPostings(postingsRes.data);
    if (extRes.data) setExternalVacancies(extRes.data);
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
      {/* Recent Matches */}
      {(() => {
        const rankMatches = [
          ...jobPostings.filter(j => j.rank_required.toLowerCase() === role.toLowerCase() || j.rank_required === "Any Rank").map(j => ({
            id: j.id, title: j.rank_required, company: j.company_name, vessel: j.vessel_type,
            port: j.joining_port, salary: j.monthly_salary ? `$${j.monthly_salary}/mo` : "Negotiable",
            source: "posted" as const, date: j.created_at, whatsapp: j.contact_whatsapp, verified: j.verified,
          })),
          ...externalVacancies.filter(e => e.rank_required && e.rank_required.toLowerCase() === role.toLowerCase()).map(e => ({
            id: e.id, title: e.rank_required || e.title, company: e.company_name || "Unknown",
            vessel: e.vessel_type || "—", port: e.joining_port || "TBD",
            salary: e.salary_text || "—", source: "ai" as const, date: e.created_at || "",
            whatsapp: e.contact_whatsapp, verified: false,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

        if (!rankMatches.length) return null;

        return (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Matches for You</h3>
              <Badge className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0">{rankMatches.length}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">Jobs matching your rank: <span className="font-medium text-foreground">{role}</span></p>
            <div className="space-y-2">
              {rankMatches.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-card border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">{m.title}</span>
                      {m.verified && <Check size={12} className="text-blue-400 shrink-0" />}
                      <Badge variant="outline" className="text-[9px] shrink-0">{m.source === "ai" ? "🌐 AI" : "📋 Direct"}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{m.company} · {m.vessel} · {m.port}</p>
                    <p className="text-[11px] text-primary font-medium">{m.salary}</p>
                  </div>
                  {m.whatsapp ? (
                    <a href={`https://wa.me/${m.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I'm interested in the ${m.title} position. My name is ${firstName} ${lastName}, ${role}.`)}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white shrink-0">
                        <MessageCircle size={12} /> Apply
                      </Button>
                    </a>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => {
                      const el = document.getElementById("ai-collected-jobs");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}>View</Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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

      {/* Job Postings from job_postings table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide px-1">Available Positions</h3>
        {jobPostings.length === 0 ? (
          <div className="rounded-xl bg-card border border-border p-6 text-center">
            <Ship size={24} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No positions available yet. Check back soon.</p>
          </div>
        ) : (
          jobPostings.map((jp) => {
            const whatsappNumber = jp.contact_whatsapp.replace(/[^0-9]/g, "");
            const whatsappText = encodeURIComponent(
              `Hi, I am interested in the ${jp.rank_required} position. My name is ${firstName} ${lastName}, ${role}, ${nationality}, ${yearsAtSea} experience.`
            );
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;
            const postedAgo = formatDistanceToNow(new Date(jp.created_at), { addSuffix: true });

            return (
              <div
                key={jp.id}
                className="rounded-xl bg-card p-4 space-y-3"
                style={{ border: "1.5px solid #1a3a5c" }}
              >
                <div>
                  <h4 style={{ color: "#D4AF37", fontSize: "18px", fontWeight: "bold" }}>{jp.rank_required}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-sm text-foreground">{jp.company_name}</p>
                    {jp.verified && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.12)", color: "#3B82F6", fontSize: "11px", fontWeight: 600 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        ✓ Verified
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {jp.vessel_type} · {jp.contract_duration}
                </p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span>📍</span>
                    <span>{jp.joining_port}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={12} className="text-primary/70" />
                    <span>{jp.monthly_salary ? `$${jp.monthly_salary}/month` : "Negotiable"}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">Posted {postedAgo}</p>
                </div>
                {jp.additional_notes && (
                  <p className="text-[11px] text-muted-foreground italic">{jp.additional_notes}</p>
                )}
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm h-10">
                    Apply via WhatsApp
                  </Button>
                </a>
              </div>
            );
          })
        )}
      </div>

      {/* Manager Job Vacancies (legacy) */}
      {vacancies.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide px-1">Manager Vacancies</h3>
          {vacancies.map((v) => (
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
          ))}
        </div>
      )}

      {/* AI-Collected External Vacancies */}
      {externalVacancies.length > 0 && (() => {
        const extRanks = [...new Set(externalVacancies.map(e => e.rank_required).filter(Boolean))] as string[];
        const extVessels = [...new Set(externalVacancies.map(e => e.vessel_type).filter(Boolean))] as string[];

        // Nationality-based relevance scoring
        const natLower = (nationality || '').toLowerCase();
        const isIndian = /india|indian/.test(natLower);
        const isFilipino = /philip|filipino|filipina/.test(natLower);
        const isRegionRelevant = (ext: ExternalVacancy) => {
          const src = (ext.source || '').toLowerCase();
          const title = (ext.title || '').toLowerCase();
          const desc = (ext.description || '').toLowerCase();
          const company = (ext.company_name || '').toLowerCase();
          const port = (ext.joining_port || '').toLowerCase();
          const combined = `${title} ${desc} ${company} ${port}`;
          if (isIndian && (src === 'india_philippines' || /india|mumbai|chennai|kolkata|cochin|goa|indian/i.test(combined))) return true;
          if (isFilipino && (src === 'india_philippines' || /philippines|manila|cebu|filipino|poea|dmw|pinoy/i.test(combined))) return true;
          return false;
        };

        const filtered = externalVacancies.filter(e =>
          (extRankFilter === "all" || e.rank_required === extRankFilter) &&
          (extVesselFilter === "all" || e.vessel_type === extVesselFilter)
        ).sort((a, b) => {
          const aRelevant = isRegionRelevant(a) ? 1 : 0;
          const bRelevant = isRegionRelevant(b) ? 1 : 0;
          if (bRelevant !== aRelevant) return bRelevant - aRelevant;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        return (
        <div className="space-y-3" id="ai-collected-jobs">
          <div className="flex items-center gap-2 px-1">
            <Globe size={14} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">AI-Collected Jobs</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {filtered.length}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            Aggregated from Google Jobs, RSS feeds & Telegram channels
          </p>

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={extRankFilter} onValueChange={setExtRankFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Rank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ranks</SelectItem>
                {extRanks.sort().map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={extVesselFilter} onValueChange={setExtVesselFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {extVessels.sort().map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={extRankFilter !== "all" || extVesselFilter !== "all" ? "outline" : "default"}
              className="h-8 text-xs shrink-0 gap-1"
              onClick={() => {
                if (extRankFilter !== "all" || extVesselFilter !== "all") {
                  setExtRankFilter("all");
                  setExtVesselFilter("all");
                } else {
                  const matchedRank = extRanks.find(r => r.toLowerCase() === role.toLowerCase()) || "all";
                  const matchedVessel = preferredVessel !== "Any Type"
                    ? extVessels.find(v => v.toLowerCase().includes(preferredVessel.toLowerCase().split(" ")[0])) || "all"
                    : "all";
                  setExtRankFilter(matchedRank);
                  setExtVesselFilter(matchedVessel);
                }
              }}
            >
              {extRankFilter !== "all" || extVesselFilter !== "all" ? "✕ Clear" : "🎯 Match Me"}
            </Button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl bg-card border border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No jobs match your filters.</p>
            </div>
          ) : filtered.map((ext) => {
            const sourceLabel = ext.source === 'google_jobs' ? '🔍 Google' : ext.source === 'rss_feed' ? '📰 RSS' : ext.source === 'telegram' ? '📱 Telegram' : ext.source === 'india_philippines' ? '🇮🇳🇵🇭 Regional' : ext.source;
            const postedAgo = ext.created_at ? formatDistanceToNow(new Date(ext.created_at), { addSuffix: true }) : '';
            const regionMatch = (isIndian || isFilipino) && isRegionRelevant(ext);

            return (
              <div
                key={ext.id}
                className={cn("rounded-xl bg-card border p-4 space-y-3", regionMatch ? "border-primary/40 ring-1 ring-primary/20" : "border-border")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{ext.title}</h4>
                    {ext.company_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{ext.company_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {regionMatch && <Badge className="text-[10px] bg-primary/20 text-primary border-0">{isIndian ? '🇮🇳' : '🇵🇭'} For You</Badge>}
                    <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {ext.rank_required && (
                    <Badge className="text-[10px] bg-primary/10 text-primary border-0">{ext.rank_required}</Badge>
                  )}
                  {ext.vessel_type && (
                    <Badge variant="secondary" className="text-[10px]">{ext.vessel_type}</Badge>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {ext.joining_port && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-primary/70" />
                      <span>{ext.joining_port}</span>
                    </div>
                  )}
                  {ext.salary_text && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign size={12} className="text-primary/70" />
                      <span>{ext.salary_text}</span>
                    </div>
                  )}
                  {ext.contract_duration && (
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-primary/70" />
                      <span>{ext.contract_duration}</span>
                    </div>
                  )}
                </div>

                {ext.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{ext.description}</p>
                )}

                <div className="flex items-center justify-between">
                  {postedAgo && <p className="text-[10px] text-muted-foreground/60">{postedAgo}</p>}
                  {ext.quality_score && (
                    <div className="flex items-center gap-1">
                      <div className={cn("h-1.5 w-1.5 rounded-full", ext.quality_score >= 70 ? "bg-green-500" : ext.quality_score >= 40 ? "bg-yellow-500" : "bg-red-500")} />
                      <span className="text-[10px] text-muted-foreground/60">Q{ext.quality_score}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {ext.apply_url && (
                    <a href={ext.apply_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button size="sm" className="w-full text-xs h-9 gap-1.5">
                        <ExternalLink size={12} /> Apply
                      </Button>
                    </a>
                  )}
                  {ext.contact_whatsapp && (
                    <a href={`https://wa.me/${ext.contact_whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I'm interested in the ${ext.rank_required || ext.title} position. My name is ${firstName} ${lastName}, ${role}.`)}`} target="_blank" rel="noopener noreferrer" className={ext.apply_url ? "" : "flex-1"}>
                      <Button size="sm" variant={ext.apply_url ? "outline" : "default"} className={cn("text-xs h-9 gap-1.5", !ext.apply_url && "w-full bg-green-600 hover:bg-green-700 text-white")}>
                        <MessageCircle size={12} /> WhatsApp
                      </Button>
                    </a>
                  )}
                  {ext.contact_email && !ext.apply_url && !ext.contact_whatsapp && (
                    <a href={`mailto:${ext.contact_email}?subject=${encodeURIComponent(`Application: ${ext.title}`)}&body=${encodeURIComponent(`Dear Hiring Manager,\n\nI am interested in the ${ext.rank_required || ext.title} position.\n\nName: ${firstName} ${lastName}\nRank: ${role}\nNationality: ${nationality}\n\nBest regards`)}`} className="flex-1">
                      <Button size="sm" className="w-full text-xs h-9 gap-1.5">
                        <Mail size={12} /> Email
                      </Button>
                    </a>
                  )}
                  {!ext.apply_url && !ext.contact_whatsapp && !ext.contact_email && (
                    <Button size="sm" variant="outline" className="w-full text-xs h-9" disabled>
                      No Contact Info
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
};

export default FindWork;
