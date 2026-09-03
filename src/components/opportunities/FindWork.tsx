import { useState, useEffect } from "react";
import { format, formatDistanceToNow, startOfToday } from "date-fns";
import { CalendarIcon, Ship, Globe, Clock, MapPin, DollarSign, Check, AlertTriangle, Award, ExternalLink, Mail, MessageCircle } from "lucide-react";
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
import { formatSalaryText, formatSalaryRange } from "@/lib/salary";
import { fetchCrewCardInfo, waApplyLink, getCachedCrewCardInfo, recordApplication, openHandoffTab, completeHandoff, fetchQuickProfileDone, CrewCardInfo } from "@/lib/applyMessage";
import ApplyGateSheet from "@/components/ApplyGateSheet";
import JobCard from "@/components/JobCard";
import { loadVacancies, loadMyApplicationTargets, UnifiedVacancy, vacancySalary } from "@/lib/vacancyFeed";
import CrewOffers from "@/components/CrewOffers";
import { useSearchParams } from "react-router-dom";

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


const COUNTRY_TABS = [
  { code: 'all', flag: '🌍', label: 'All' },
  { code: 'India', flag: '🇮🇳', label: 'India' },
  { code: 'Philippines', flag: '🇵🇭', label: 'Philippines' },
  { code: 'Indonesia', flag: '🇮🇩', label: 'Indonesia' },
  { code: 'China', flag: '🇨🇳', label: 'China' },
  { code: 'Turkey', flag: '🇹🇷', label: 'Turkey' },
  { code: 'Croatia', flag: '🇭🇷', label: 'Croatia' },
  { code: 'Ukraine', flag: '🇺🇦', label: 'Ukraine' },
  { code: 'Russia', flag: '🇷🇺', label: 'Russia' },
  { code: 'Myanmar', flag: '🇲🇲', label: 'Myanmar' },
  { code: 'Bangladesh', flag: '🇧🇩', label: 'Bangladesh' },
  { code: 'Greece', flag: '🇬🇷', label: 'Greece' },
  { code: 'Poland', flag: '🇵🇱', label: 'Poland' },
  { code: 'Romania', flag: '🇷🇴', label: 'Romania' },
  { code: 'Vietnam', flag: '🇻🇳', label: 'Vietnam' },
  { code: 'Sri Lanka', flag: '🇱🇰', label: 'Sri Lanka' },
  { code: 'Pakistan', flag: '🇵🇰', label: 'Pakistan' },
];

const COUNTRY_PORTS: Record<string, string[]> = {
  India: ['Mumbai', 'Chennai', 'Kolkata', 'Goa', 'Cochin', 'India'],
  Philippines: ['Manila', 'Cebu', 'Philippines'],
  Indonesia: ['Jakarta', 'Surabaya', 'Batam', 'Indonesia'],
  China: ['Shanghai', 'Tianjin', 'Dalian', 'Qingdao', 'Guangzhou', 'Shenzhen', 'China'],
  Turkey: ['Istanbul', 'Izmir', 'Mersin', 'Aliaga', 'Turkey'],
  Croatia: ['Rijeka', 'Split', 'Dubrovnik', 'Croatia'],
  Ukraine: ['Odessa', 'Kherson', 'Ukraine'],
  Russia: ['St. Petersburg', 'Novorossiysk', 'Vladivostok', 'Russia'],
  Myanmar: ['Yangon', 'Myanmar'],
  Bangladesh: ['Chittagong', 'Dhaka', 'Bangladesh'],
  Greece: ['Piraeus', 'Thessaloniki', 'Greece'],
  Poland: ['Gdansk', 'Gdynia', 'Szczecin', 'Poland'],
  Romania: ['Constanta', 'Romania'],
  Vietnam: ['Ho Chi Minh', 'Haiphong', 'Da Nang', 'Vietnam'],
  'Sri Lanka': ['Colombo', 'Sri Lanka'],
  Pakistan: ['Karachi', 'Pakistan'],
};

interface MyApplication {
  id: string;
  company_name: string | null;
  rank_applied: string | null;
  vessel_type: string | null;
  outcome: string;
  applied_at: string | null;
  vacancy_label: string | null;
}

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  awaiting: { label: "Applied", cls: "bg-muted text-muted-foreground" },
  shortlisted: { label: "Shortlisted ⭐", cls: "bg-primary/15 text-primary" },
  offered: { label: "Offer received 🎉", cls: "bg-emerald-500/15 text-emerald-400" },
  placed: { label: "Placed ⚓", cls: "bg-emerald-500/15 text-emerald-400" },
  declined: { label: "Not selected", cls: "bg-destructive/15 text-destructive" },
  withdrawn: { label: "Withdrawn", cls: "bg-muted text-muted-foreground" },
};

const FindWork = ({ profileId, firstName, lastName, role, nationality, yearsAtSea, shipName }: FindWorkProps) => {
  const [searchParams] = useSearchParams();
  const [crewId, setCrewId] = useState<string | null>(null);
  const [offerCount, setOfferCount] = useState(0);
  const [availabilityDate, setAvailabilityDate] = useState<Date>();
  const [preferredVessel, setPreferredVessel] = useState("Any Type");
  const [aboutMe, setAboutMe] = useState("");
  const [visible, setVisible] = useState(false);
  const [activeSaved, setActiveSaved] = useState(false);

  const [vacancies, setVacancies] = useState<UnifiedVacancy[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [directApplied, setDirectApplied] = useState<Record<string, "ok" | "dup">>({});
  const [directBusy, setDirectBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [showPrefs, setShowPrefs] = useState(false);
  const [smcScore, setSmcScore] = useState<number | null>(null);
  const [cardInfo, setCardInfo] = useState<CrewCardInfo | null>(null);
  const [needsQuickProfile, setNeedsQuickProfile] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (data.user?.id && !error) setCrewId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!crewId) return;
    fetchCrewCardInfo(crewId).then(setCardInfo);
    fetchQuickProfileDone(crewId).then((done) => setNeedsQuickProfile(!done));
  }, [crewId]);

  const [myApps, setMyApps] = useState<MyApplication[]>([]);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const loadMyApplications = async () => {
    const { data, error } = await supabase.rpc("get_my_applications" as never);
    if (!error && Array.isArray(data)) setMyApps(data as unknown as MyApplication[]);
  };

  useEffect(() => {
    if (crewId) loadMyApplications();
  }, [crewId]);

  const withdrawApplication = async (id: string) => {
    if (!window.confirm("Withdraw this application? The company will no longer consider you for this position.")) return;
    setWithdrawing(id);
    const { data, error } = await supabase.rpc("withdraw_application" as never, { p_application_id: id } as never);
    setWithdrawing(null);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast({ title: "Could not withdraw", description: res?.error || error?.message || "Please try again", variant: "destructive" });
      return;
    }
    toast({ title: "Withdrawn", description: "Your application has been withdrawn." });
    loadMyApplications();
  };


  const [extRankFilter, setExtRankFilter] = useState("all");
  const [extVesselFilter, setExtVesselFilter] = useState("all");


  // No country filter by default — show all positions until user taps a country


  useEffect(() => {
    if (crewId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId]);

  const loadData = async () => {
    if (!crewId) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [availRes, vacs, smcRes] = await Promise.all([
      supabase.from("crew_availability").select("*").eq("crew_profile_id", crewId).maybeSingle(),
      loadVacancies({ limitDirect: 20, limitExternal: 50, minQuality: 30 }),
      supabase.from("smc_assessments").select("overall_score").eq("crew_profile_id", crewId).eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (availRes.data) {
      setAvailabilityDate(availRes.data.availability_date ? new Date(availRes.data.availability_date) : undefined);
      setPreferredVessel(availRes.data.preferred_vessel_type || "Any Type");
      setAboutMe(availRes.data.about_me || "");
      setVisible(availRes.data.visible_to_employers);
    }

    if (smcRes.data?.overall_score != null) setSmcScore(Number(smcRes.data.overall_score));
    setVacancies(vacs);
    loadMyApplicationTargets().then(setAppliedIds);

    setLoading(false);
  };

  const applyRow = (row: any) => {
    setAvailabilityDate(row?.availability_date ? new Date(row.availability_date) : undefined);
    setPreferredVessel(row?.preferred_vessel_type || "Any Type");
    setAboutMe(row?.about_me || "");
    setVisible(!!row?.visible_to_employers);
  };

  const refreshAvailability = async () => {
    if (!crewId) return;
    const { data, error } = await supabase
      .from("crew_availability")
      .select("*")
      .eq("crew_profile_id", crewId)
      .maybeSingle();
    if (!error && data) applyRow(data);
  };

  useEffect(() => {
    if (!crewId) return;
    refreshAvailability();
    const onFocus = () => { if (document.visibilityState === "visible") refreshAvailability(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId]);

  const saveAvailability = async () => {
    if (!crewId) {
      toast({
        title: "Please sign in again",
        description: "Your session could not be verified.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      crew_profile_id: crewId,
      availability_date: availabilityDate ? format(availabilityDate, "yyyy-MM-dd") : null,
      preferred_vessel_type: preferredVessel,
      about_me: aboutMe,
      visible_to_employers: visible,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await supabase
      .from("crew_availability")
      .upsert(payload, { onConflict: "crew_profile_id" })
      .select()
      .single();

    setSaving(false);

    if (error || !saved) {
      console.error("crew_availability save failed:", error);
      toast({
        title: "Could not save",
        description: error?.message || "Unknown error",
        variant: "destructive",
      });
      return;
    }

    applyRow(saved);
    setActiveSaved(!!saved.visible_to_employers);
    const dateText = saved.availability_date
      ? format(new Date(saved.availability_date + "T00:00:00"), "d MMM yyyy")
      : "date open";
    toast({
      title: "Saved ✓",
      description: `available from ${dateText}`,
    });
  };


  // Outbound recording: awaited so the record + email attempt completes before the handoff
  const recordOutbound = async (args: { vacancyId?: string | null; jobPostingId?: string | null; companyPostId?: string | null; company?: string | null; rank?: string | null; vessel?: string | null; url: string | null }) => {
    const r = await recordApplication({
      vacancyId: args.vacancyId || null,
      companyPostId: args.companyPostId || null,
      jobPostingId: args.jobPostingId || null,
      company: args.company, rank: args.rank, vessel: args.vessel,
      externalUrl: args.url,
    });
    if (r.ok && r.duplicate) toast({ title: "Already applied ✓", description: "The company already has your application." });
    else if (r.ok && r.emailSent === false) toast({ title: "Applied ✓", description: "Saved on SeaMinds, but the email notification failed." });
    else if (r.ok) toast({ title: "Applied ✓", description: "Recorded on SeaMinds." });
    else toast({ title: "Sent", description: "Sent on WhatsApp — could not record on SeaMinds.", variant: "destructive" });
  };

  /** Single apply path for every vacancy on this screen — record + email first, then hand off. */
  const applyVacancy = async (v: UnifiedVacancy) => {
    if (needsQuickProfile) { setGateOpen(true); return; }
    if (appliedIds.has(v.id) || directApplied[v.id] || directBusy[v.id]) return;
    setDirectBusy((s0) => ({ ...s0, [v.id]: true }));
    try {
      const url = v.kind === "direct"
        ? null
        : v.applyUrl
          || waApplyLink(v.whatsapp, cardInfo || getCachedCrewCardInfo(), { rank: v.rank, vessel: v.vessel, port: v.port });
      const win = url ? openHandoffTab() : null;

      const r = await recordApplication({
        vacancyId: v.kind === "external" ? v.id : null,
        jobPostingId: v.kind === "direct" ? v.id : null,
        company: v.company, rank: v.rank, vessel: v.vessel,
        externalUrl: url,
      });
      setDirectBusy((s0) => ({ ...s0, [v.id]: false }));

      if (!r.ok) {
        toast({ title: "Error", description: url ? "Sent — could not record on SeaMinds." : "Could not send application. Try again.", variant: "destructive" });
      } else {
        setDirectApplied((s0) => ({ ...s0, [v.id]: r.duplicate ? "dup" : "ok" }));
        if (r.duplicate) toast({ title: "Already applied ✓", description: "The company already has your application." });
        else if (r.emailSent === false) toast({ title: "Applied ✓", description: "Saved on SeaMinds, but the email notification failed." });
        else if (v.kind === "direct") toast({ title: "Applied ✓", description: "The company can now see your application in SeaMinds." });
        else toast({ title: "Applied ✓", description: "Recorded on SeaMinds." });
      }
      if (url) completeHandoff(win, url);
      loadMyApplications();
    } catch {
      setDirectBusy((s0) => ({ ...s0, [v.id]: false }));
      toast({ title: "Error", description: "Could not open the application. Try again.", variant: "destructive" });
    }
  };

  const appliedState = (v: UnifiedVacancy) => directApplied[v.id] || (appliedIds.has(v.id) ? "ok" : undefined);

  const directPostings = vacancies.filter((v) => v.kind === "direct");
  const externalList = vacancies.filter((v) => v.kind === "external");

  const wordCount = aboutMe.trim().split(/\s+/).filter(Boolean).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><span className="text-muted-foreground text-sm">Loading...</span></div>;
  }

  return (
    <div className="space-y-5">
      <ApplyGateSheet open={gateOpen} onClose={() => setGateOpen(false)} next="/app?tab=jobs" />

      <div>
        {offerCount > 0 && (
          <h3 className="mx-4 mb-2 text-sm font-extrabold uppercase tracking-wide text-primary">⚡ Action required</h3>
        )}
        <CrewOffers
          profileId={crewId || profileId}
          highlightApplicationId={searchParams.get("offer")}
          onCountChange={setOfferCount}
        />
      </div>

      {myApps.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">📋 My Applications</h3>
          <div className="space-y-2">
            {myApps.map((a) => {
              const chip = STATUS_CHIP[a.outcome] || { label: a.outcome, cls: "bg-muted text-muted-foreground" };
              const canWithdraw = a.outcome === "awaiting" || a.outcome === "shortlisted";
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.rank_applied || a.vacancy_label || "Position"}
                      {a.company_name ? <span className="text-muted-foreground"> · {a.company_name}</span> : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {a.vessel_type ? `${a.vessel_type} · ` : ""}
                      applied {a.applied_at ? formatDistanceToNow(new Date(a.applied_at), { addSuffix: true }) : "recently"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", chip.cls)}>{chip.label}</span>
                    {canWithdraw && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground"
                        disabled={withdrawing === a.id} onClick={() => withdrawApplication(a.id)}>
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Recent Matches */}
      {(() => {
        const rankMatches = [
          ...jobPostings.filter(j => j.rank_required.toLowerCase() === role.toLowerCase() || j.rank_required === "Any Rank").map(j => ({
            id: j.id, title: j.rank_required, company: j.company_name, vessel: j.vessel_type,
            port: j.joining_port, salary: formatSalaryText(j.monthly_salary, "/mo") || "Negotiable",
            source: "posted" as const, date: j.created_at, whatsapp: j.contact_whatsapp, verified: j.verified,
          })),
          ...externalVacancies.filter(e => e.rank_required && e.rank_required.toLowerCase() === role.toLowerCase()).map(e => ({
            id: e.id, title: e.rank_required || e.title, company: e.company_name || "Unknown",
            vessel: e.vessel_type || "—", port: e.joining_port || "TBD",
            salary: formatSalaryText(e.salary_text, "/mo") || "—", source: "ai" as const, date: e.created_at || "",
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
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white shrink-0"
                      onClick={() => openWhatsApp({
                        number: m.whatsapp,
                        vacancyId: m.source === "ai" ? m.id : null,
                        jobPostingId: m.source === "posted" ? m.id : null,
                        company: m.company, rank: m.title, vessel: m.vessel, port: m.port,
                      })}
                    >
                      <MessageCircle size={12} /> Apply
                    </Button>
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

      {/* Availability & visibility preferences (collapsible) */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <button
          onClick={() => setShowPrefs(!showPrefs)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">
              {visible ? "✅ Companies can find you" : "⚪ You are hidden from companies"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tap to set when you are available
            </p>
          </div>
          <span className="text-primary text-xs font-bold">{showPrefs ? "−" : "+"}</span>
        </button>
        {showPrefs && (
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
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
                  <Calendar mode="single" selected={availabilityDate} onSelect={setAvailabilityDate} initialFocus disabled={(d) => d < startOfToday()} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAvailabilityDate(startOfToday())}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
                >
                  Available now
                </button>
                <button
                  type="button"
                  onClick={() => setAvailabilityDate(undefined)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border border-muted-foreground/30 text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  Not sure yet
                </button>
              </div>
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
              {saving ? "Saving..." : "Save & Update Visibility"}

            </Button>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Make Me Visible to Employers</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Employers can find and contact you</p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={cn("text-xs font-bold tracking-wide", visible ? "text-[#D4AF37]" : "text-muted-foreground")}>
                  {visible ? "VISIBLE ✓" : "HIDDEN"}
                </span>
                <Switch
                  checked={visible}
                  onCheckedChange={(checked) => setVisible(checked)}
                  className={cn(
                    "scale-125 data-[state=checked]:bg-[#D4AF37] data-[state=unchecked]:bg-[#3f3f46] [&>span]:bg-white"
                  )}
                />
              </div>
            </div>
            {activeSaved && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                <Check size={14} className="text-green-400" />
                <span className="text-xs text-green-400 font-medium">Profile Active — Employers Can Find You</span>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Country filter tabs */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const }}>
          Filter by Country
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {COUNTRY_TABS.map(tab => (
            <button
              key={tab.code}
              onClick={() => setCountryFilter(tab.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 20,
                border: countryFilter === tab.code
                  ? '1px solid #D4AF37'
                  : '1px solid rgba(255,255,255,0.1)',
                background: countryFilter === tab.code
                  ? 'rgba(212,175,55,0.15)'
                  : 'rgba(255,255,255,0.04)',
                color: countryFilter === tab.code ? '#D4AF37' : '#888',
                fontSize: 12, fontWeight: countryFilter === tab.code ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.2s',
                whiteSpace: 'nowrap' as const,
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.flag}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {countryFilter !== 'all' && (
        <div style={{
          background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 8, padding: '7px 12px', marginBottom: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ color: '#D4AF37', fontSize: 12 }}>
            {COUNTRY_TABS.find(t => t.code === countryFilter)?.flag} Showing jobs for {countryFilter}
          </span>
          <button onClick={() => setCountryFilter('all')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11 }}>
            Clear ✕
          </button>
        </div>
      )}

      {/* Job Postings from job_postings table */}
      {(() => {
        const filteredPostings = countryFilter === 'all'
          ? jobPostings
          : jobPostings.filter((job) => {
              const ports = COUNTRY_PORTS[countryFilter] || [];
              const jobPort = (job.joining_port || '').toLowerCase();
              const jobCompany = (job.company_name || '').toLowerCase();
              const countryLower = countryFilter.toLowerCase();
              return ports.some(p => jobPort.includes(p.toLowerCase())) || jobCompany.includes(countryLower);
            });

        return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide px-1">Available Positions</h3>
        {filteredPostings.length === 0 ? (
          <div className="rounded-xl bg-card border border-border p-6 text-center">
            <Ship size={24} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No company postings yet — scroll down for more jobs from across the industry.</p>
          </div>
        ) : (
          filteredPostings.map((jp) => {
            const postedAgo = formatDistanceToNow(new Date(jp.created_at), { addSuffix: true });

            return (
              <div
                key={jp.id}
                className="rounded-xl bg-card p-4 space-y-3"
                style={{ border: "1.5px solid #1a3a5c" }}
              >
                <div>
                  <span className="inline-block rounded-full px-2 py-0.5 mb-1.5 text-[9.5px] font-extrabold tracking-wider"
                    style={{ background: "rgba(212,175,55,0.12)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)" }}>
                    DIRECT — POSTED ON SEAMINDS
                  </span>
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
                    <span>{formatSalaryText(jp.monthly_salary) || "Negotiable"}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">Posted {postedAgo}</p>
                </div>
                {jp.additional_notes && (
                  <p className="text-[11px] text-muted-foreground italic">{jp.additional_notes}</p>
                )}
                <Button
                  size="sm"
                  disabled={!!directApplied[jp.id] || !!directBusy[jp.id]}
                  className="w-full font-semibold text-sm h-10"
                  style={{
                    background: directApplied[jp.id] ? "rgba(34,197,94,0.15)" : "#D4AF37",
                    color: directApplied[jp.id] ? "#22c55e" : "#0D1B2A",
                    border: directApplied[jp.id] ? "1px solid #22c55e" : "none",
                  }}
                  onClick={() => applyDirect(jp)}
                >
                  {directApplied[jp.id] === "dup"
                    ? "Already applied ✓"
                    : directApplied[jp.id] === "ok"
                      ? "Applied ✓ — your Sea Profile has been sent"
                      : directBusy[jp.id] ? "Sending…" : "APPLY WITH SEA PROFILE →"}
                </Button>
                {jp.contact_whatsapp && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-9 gap-1.5"
                    onClick={() => openWhatsApp({
                      number: jp.contact_whatsapp,
                      jobPostingId: jp.id,
                      company: jp.company_name, rank: jp.rank_required, vessel: jp.vessel_type, port: jp.joining_port,
                    })}
                  >
                    <MessageCircle size={12} /> Apply via WhatsApp
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
        );
      })()}


      {/* AI-Collected External Vacancies */}
      {externalVacancies.length > 0 && (() => {
        const extRanks = [...new Set(externalVacancies.map(e => e.rank_required).filter(Boolean))] as string[];
        const extVessels = [...new Set(externalVacancies.map(e => e.vessel_type).filter(Boolean))] as string[];

        // Nationality-based relevance scoring
        const natLower = (nationality || '').toLowerCase();
        const isIndian = /india|indian/.test(natLower);
        const isFilipino = /philip|filipino|filipina/.test(natLower);
        const isIndonesian = /indonesia|indonesian/.test(natLower);
        const isUkrainian = /ukrain/.test(natLower);
        const isBangladeshi = /bangladesh/.test(natLower);
        const isMyanmar = /myanmar|burm/.test(natLower);
        const hasRegion = isIndian || isFilipino || isIndonesian || isUkrainian || isBangladeshi || isMyanmar;
        const isRegionRelevant = (ext: ExternalVacancy) => {
          const src = (ext.source || '').toLowerCase();
          const title = (ext.title || '').toLowerCase();
          const desc = (ext.description || '').toLowerCase();
          const company = (ext.company_name || '').toLowerCase();
          const port = (ext.joining_port || '').toLowerCase();
          const combined = `${title} ${desc} ${company} ${port}`;
          if (isIndian && (src === 'india_philippines' || /india|mumbai|chennai|kolkata|cochin|goa|indian/i.test(combined))) return true;
          if (isFilipino && (src === 'india_philippines' || /philippines|manila|cebu|filipino|poea|dmw|pinoy/i.test(combined))) return true;
          if (isIndonesian && (src === 'regional_global' || /indonesia|jakarta|surabaya|indonesian|pelaut/i.test(combined))) return true;
          if (isUkrainian && (src === 'regional_global' || /ukrain|odesa|odessa|ukrainian|крюінг/i.test(combined))) return true;
          if (isBangladeshi && (src === 'regional_global' || /bangladesh|chittagong|dhaka|bangladeshi/i.test(combined))) return true;
          if (isMyanmar && (src === 'regional_global' || /myanmar|yangon|burmese/i.test(combined))) return true;
          return false;
        };

        const filtered = externalVacancies.filter(e => {
          const rankMatch = extRankFilter === "all" || e.rank_required === extRankFilter;
          const vesselMatch = extVesselFilter === "all" || e.vessel_type === extVesselFilter;
          if (!rankMatch || !vesselMatch) return false;
          if (countryFilter === 'all') return true;
          const ports = COUNTRY_PORTS[countryFilter] || [];
          const jobPort = (e.joining_port || '').toLowerCase();
          const jobCompany = (e.company_name || '').toLowerCase();
          const jobDesc = (e.description || '').toLowerCase();
          const countryLower = countryFilter.toLowerCase();
          return ports.some(p => jobPort.includes(p.toLowerCase())) ||
                 jobCompany.includes(countryLower) ||
                 jobDesc.includes(countryLower);
        }).sort((a, b) => {
          const aRelevant = isRegionRelevant(a) ? 1 : 0;
          const bRelevant = isRegionRelevant(b) ? 1 : 0;
          if (bRelevant !== aRelevant) return bRelevant - aRelevant;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        return (
        <div className="space-y-3" id="ai-collected-jobs">
          <div className="flex items-center gap-2 px-1">
            <Globe size={14} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">More Jobs</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {filtered.length}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            Fresh vacancies collected from across the industry
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
            const sourceLabel = (ext.quality_score ?? 0) >= 70 ? "Verified listing" : "";
            const postedAgo = ext.created_at ? formatDistanceToNow(new Date(ext.created_at), { addSuffix: true }) : '';
            const regionMatch = hasRegion && isRegionRelevant(ext);

            return (
              <div
                key={ext.id}
                className={cn("rounded-xl bg-card border p-4 space-y-3", regionMatch ? "border-primary/40 ring-1 ring-primary/20" : "border-border")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{ext.title}</h4>
                    {ext.company_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ext.company_website ? (
                          <a href={ext.company_website.startsWith('http') ? ext.company_website : `https://${ext.company_website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                            {ext.company_name} <Globe size={10} className="text-primary/70" />
                          </a>
                        ) : ext.company_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {regionMatch && <Badge className="text-[10px] bg-primary/20 text-primary border-0">{isIndian ? '🇮🇳' : isFilipino ? '🇵🇭' : isIndonesian ? '🇮🇩' : isUkrainian ? '🇺🇦' : isBangladeshi ? '🇧🇩' : isMyanmar ? '🇲🇲' : '🌍'} For You</Badge>}
                    {sourceLabel && <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>}
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
                  {formatSalaryText(ext.salary_text) && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign size={12} className="text-primary/70" />
                      <span>{formatSalaryText(ext.salary_text)}</span>
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
                </div>


                <div className="flex gap-2">
                  {ext.apply_url && (
                    <Button size="sm" className="flex-1 text-xs h-9 gap-1.5" onClick={() => openExternalVacancy(ext, ext.apply_url!)}>
                      <ExternalLink size={12} /> Apply
                    </Button>
                  )}
                  {ext.contact_whatsapp && (
                    <Button
                      size="sm"
                      variant={ext.apply_url ? "outline" : "default"}
                      className={cn("text-xs h-9 gap-1.5", !ext.apply_url && "flex-1 bg-green-600 hover:bg-green-700 text-white")}
                      onClick={() => openWhatsApp({
                        number: ext.contact_whatsapp,
                        vacancyId: ext.id,
                        company: ext.company_name, rank: ext.rank_required || ext.title, vessel: ext.vessel_type, port: ext.joining_port,
                      })}
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </Button>
                  )}
                  {ext.contact_email && !ext.apply_url && !ext.contact_whatsapp && (
                    <Button
                      size="sm"
                      className="flex-1 text-xs h-9 gap-1.5"
                      onClick={() => openExternalVacancy(ext, `mailto:${ext.contact_email}?subject=${encodeURIComponent(`Application: ${ext.title}`)}&body=${encodeURIComponent(`Dear Hiring Manager,\n\nI would like to apply for the ${ext.rank_required || ext.title} position.\n\nName: ${firstName} ${lastName}\nRank: ${role}\nNationality: ${nationality}\n\nBest regards`)}`, "_self")}
                    >
                      <Mail size={12} /> Email
                    </Button>
                  )}
                  {!ext.apply_url && !ext.contact_whatsapp && !ext.contact_email && ext.company_website && (
                    <Button
                      size="sm"
                      className="flex-1 text-xs h-9 gap-1.5"
                      onClick={() => openExternalVacancy(ext, ext.company_website!.startsWith('http') ? ext.company_website! : `https://${ext.company_website}`)}
                    >
                      <Globe size={12} /> Visit Website
                    </Button>
                  )}
                  {!ext.apply_url && !ext.contact_whatsapp && !ext.contact_email && !ext.company_website && (
                    <Button size="sm" className="w-full text-xs h-9" onClick={() => handleApplyExternal(ext)}>
                      Apply →
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
