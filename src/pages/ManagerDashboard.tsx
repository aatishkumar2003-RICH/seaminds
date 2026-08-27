import { useState, useEffect, useMemo } from "react";
import MyPostsPanel from "@/components/manager/MyPostsPanel";
import { useNavigate } from "react-router-dom";
import { Anchor, ArrowUpDown, LogOut, FileWarning, CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ManagerPaymentHistory from "@/components/smc/ManagerPaymentHistory";

interface CrewRow {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  shipName: string;
  voyageDays: number;
}

interface SafetyReport {
  id: string;
  category: string;
  description: string;
  ship_name: string;
  status: string;
  created_at: string;
}

interface Applicant {
  application_id: string;
  applied_at: string;
  outcome: string;
  rank: string;
  vessel: string;
  crew_name: string;
  nationality: string;
  crew_rank: string;
  available_from: string;
  offered_joining_date: string;
  job_posting_id?: string | null;
  vacancy_label?: string | null;
}

interface MyPosting {
  id: string;
  rank_required: string | null;
  vessel_type: string | null;
  joining_port?: string | null;
  status: string | null;
  created_at: string;
}

const relTime = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

interface FleetCrew {
  link_id: string;
  name: string;
  rank: string;
  nationality: string;
  certs_total: number;
  certs_expiring_90d: number;
  rest_hours_updated: string | null;
  contract_end: string | null;
}

interface FleetResult {
  ok?: boolean;
  error?: string;
  crew?: FleetCrew[];
}

interface ParsedVacancy {
  rank_required: string;
  vessel_type: string;
  contract_duration: string;
  monthly_salary: string;
  joining_port: string;
  joining_date: string;
  contact_whatsapp: string;
  contact_email: string;
  additional_notes: string;
}

type SortKey = "shipName";
type DashTab = "crew" | "applicants" | "payments";


const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [crewRows, setCrewRows] = useState<CrewRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("shipName");
  const [sortAsc, setSortAsc] = useState(true);
  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>([]);
  const [dashTab, setDashTab] = useState<DashTab>("crew");
  const [managerUserId, setManagerUserId] = useState("");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [myPostings, setMyPostings] = useState<MyPosting[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [offerFor, setOfferFor] = useState<Applicant | null>(null);
  const [offerForm, setOfferForm] = useState({
    vessel_name: "", joining_port: "", joining_date: "", salary: "",
    interview_required: true, interview_date: "", documents_required: true, message: "",
  });
  const [offerSending, setOfferSending] = useState(false);
  const [offerSent, setOfferSent] = useState<Record<string, { vessel_name: string; joining_date: string; salary: string }>>({});

  const [fleet, setFleet] = useState<FleetResult | null>(null);
  const [fleetEmail, setFleetEmail] = useState("");
  const [fleetAdding, setFleetAdding] = useState(false);
  const [dpaName, setDpaName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyEmail, setEmergencyEmail] = useState("");
  const [savingEmergency, setSavingEmergency] = useState(false);

  // --- Paste-to-Post ---
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previews, setPreviews] = useState<ParsedVacancy[]>([]);
  const [risk, setRisk] = useState<{ level: string; flags: string[] } | null>(null);

  const extractVacancies = async () => {
    const text = pasteText.trim();
    if (!text) { toast.error("Paste an advert first"); return; }
    setExtracting(true);
    const { data, error } = await supabase.functions.invoke("parse-vacancy-text", { body: { text: text.slice(0, 8000) } });
    setExtracting(false);
    if (error) {
      const status = (error as unknown as { context?: { status?: number } })?.context?.status;
      if (status === 403) toast.error("Your company account is pending approval");
      else if (status === 429) toast.error("Daily limit reached — try again tomorrow");
      else if (status === 401) toast.error("Please sign in again to continue");
      else toast.error("Could not read that advert");
      return;
    }
    const res = data as { ok?: boolean; error?: string; vacancies?: ParsedVacancy[]; risk?: { level: string; flags: string[] } };
    if (!res?.ok) {
      if (res?.error === "not_approved") toast.error("Your company account is pending approval");
      else if (res?.error === "daily_limit") toast.error("Daily limit reached — try again tomorrow");
      else toast.error("Could not read that advert");
      return;
    }
    const list = (res.vacancies || []).map((v) => ({
      rank_required: v.rank_required || "",
      vessel_type: v.vessel_type || "",
      contract_duration: v.contract_duration || "",
      monthly_salary: v.monthly_salary || "",
      joining_port: v.joining_port || "",
      joining_date: v.joining_date || "",
      contact_whatsapp: v.contact_whatsapp || "",
      contact_email: v.contact_email || "",
      additional_notes: v.additional_notes || "",
    }));
    setPreviews(list);
    setRisk(res.risk || null);
    if (list.length === 0) toast("No vacancies found in that text");
  };

  const updatePreview = (i: number, key: keyof ParsedVacancy, value: string) => {
    setPreviews((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  };

  const publishPreviews = async () => {
    if (previews.length === 0) return;
    setPublishing(true);
    try {
      const salaryFallback = "Salary as per international market standards, commensurate with rank and experience. Allowances and terms as per prevailing international market conditions.";
      const rows = previews.map((v) => {
        const hasSalary = (v.monthly_salary ?? "").trim().length > 0;
        const additionalNotes = [
          v.additional_notes,
          v.joining_date ? `Joining date: ${v.joining_date}` : "",
          v.contact_email ? `Email: ${v.contact_email}` : "",
          !hasSalary ? salaryFallback : "",
        ].filter(Boolean).join("\n") || null;
        return {
          rank_required: v.rank_required || "Not specified",
          vessel_type: v.vessel_type || "Not specified",
          contract_duration: v.contract_duration || "Not specified",
          monthly_salary: v.monthly_salary || null,
          joining_port: v.joining_port || "Not specified",
          contact_whatsapp: v.contact_whatsapp || "",
          contact_email: (v.contact_email || "").trim() || null,
          additional_notes: additionalNotes,
          company_name: companyName,
          status: "active",
          plan: "founding",
          verified: false,
          manager_id: managerUserId,
        };
      });
      const { error } = await supabase.from("job_postings").insert(rows as any);
      if (error) { toast.error(error.message || "Could not publish vacancies"); return; }
      toast.success(`${rows.length} vacancies published ⚓`);
      setPasteText("");
      setPreviews([]);
      setRisk(null);
      loadApplicants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish vacancies");
    } finally {
      setPublishing(false);
    }
  };




  const saveEmergencyContact = async () => {
    setSavingEmergency(true);
    const { error } = await supabase
      .from("manager_profiles")
      .update({
        dpa_name: dpaName.trim() || null,
        emergency_phone: emergencyPhone.trim() || null,
        emergency_email: emergencyEmail.trim() || null,
        emergency_updated_at: new Date().toISOString(),
      })
      .eq("user_id", managerUserId);
    setSavingEmergency(false);
    if (error) { toast.error("Could not save emergency contact"); return; }
    toast.success("Emergency contact saved");
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/manager"); return; }
      setManagerUserId(user.id);

      const { data: profile } = await supabase
        .from("manager_profiles")
        .select("company_name, dpa_name, emergency_phone, emergency_email")
        .eq("user_id", user.id)
        .single();

      if (!profile) { navigate("/manager"); return; }
      setCompanyName(profile.company_name);
      setDpaName(profile.dpa_name || "");
      setEmergencyPhone(profile.emergency_phone || "");
      setEmergencyEmail(profile.emergency_email || "");


      // Safety reports come through the approved-manager RPC (RLS-safe)
      const { data: safety } = await supabase.rpc("get_my_safety_reports" as any);
      const safetyResult = safety as unknown as { ok?: boolean; reports?: SafetyReport[] } | null;
      setSafetyReports(safetyResult?.ok ? (safetyResult.reports || []) : []);

      setLoading(false);
    };
    load();
  }, [navigate]);

  const sorted = useMemo(() => {
    const arr = [...crewRows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "shipName") cmp = a.shipName.localeCompare(b.shipName);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [crewRows, sortKey, sortAsc]);


  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const loadApplicants = async () => {
    setApplicantsLoading(true);
    const { data, error } = await supabase.rpc("get_my_applicants");
    setApplicantsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setApplicants(((data as unknown) as Applicant[]) || []);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: jp } = await supabase
        .from("job_postings")
        .select("id, rank_required, vessel_type, status, created_at")
        .eq("manager_id", user.id)
        .order("created_at", { ascending: false });
      setMyPostings(((jp as unknown) as MyPosting[]) || []);
    }
  };

  const openOfferDialog = (a: Applicant) => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    const firstName = (a.crew_name || "Seafarer").split(" ")[0];
    const rank = a.rank || a.crew_rank || "the position";
    const posting = myPostings.find((p) => p.id === a.job_posting_id);
    setOfferFor(a);
    setOfferForm({
      vessel_name: a.vessel || posting?.vessel_type || "",
      joining_port: "",
      joining_date: d.toISOString().split("T")[0],
      salary: "",
      interview_required: true,
      interview_date: "",
      documents_required: true,
      message: `Dear ${firstName}, we are pleased to consider you for the position of ${rank} on our vessel. As the next step you will be planned for an interview, followed by a documentation check. Kindly confirm your readiness and upload your documents on SeaMinds for verification.`,
    });
  };

  const sendOffer = async () => {
    if (!offerFor || offerSending) return;
    setOfferSending(true);
    const applicationId = offerFor.application_id;
    const offer = {
      vessel_name: offerForm.vessel_name.trim() || null,
      joining_port: offerForm.joining_port.trim() || null,
      joining_date: offerForm.joining_date || null,
      salary: offerForm.salary.trim() || null,
      interview_required: offerForm.interview_required,
      interview_date: offerForm.interview_required ? (offerForm.interview_date || null) : null,
      documents_required: offerForm.documents_required,
      message: offerForm.message.trim() || null,
    };
    const { data, error } = await supabase.rpc("manager_update_application" as any, {
      p_application_id: applicationId,
      p_action: "offer",
      p_joining_date: offerForm.joining_date || null,
      p_offer: offer,
    } as any);
    setOfferSending(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { ok?: boolean; error?: string } | null;
    if (result && !result.ok) { toast.error(result.error || "Could not send offer"); return; }

    supabase.functions.invoke("notify-application", {
      body: { application_id: applicationId, kind: "offer" },
    }).catch(() => {});

    setOfferSent((prev) => ({
      ...prev,
      [applicationId]: { vessel_name: offer.vessel_name || "", joining_date: offer.joining_date || "", salary: offer.salary || "" },
    }));
    setOfferFor(null);
    toast.success("Offer sent ✓");
    loadApplicants();
  };


  const handleApplicationAction = async (
    applicationId: string,
    action: "shortlist" | "decline" | "offer",
    joiningDate?: string,
    contractMonths?: number
  ) => {
    const params: { p_application_id: string; p_action: string; p_joining_date?: string; p_contract_months?: number } = {
      p_application_id: applicationId,
      p_action: action,
    };
    if (action === "offer") {
      params.p_joining_date = joiningDate;
      params.p_contract_months = contractMonths;
    }
    const { data, error } = await supabase.rpc("manager_update_application", params);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok?: boolean; error?: string } | null;
    if (result && !result.ok) {
      toast.error(result.error || "Update failed");
      return;
    }
    toast("Done");
    loadApplicants();
  };

  const loadFleet = async () => {
    const { data } = await supabase.rpc("get_my_fleet" as any);
    setFleet((data as unknown as FleetResult) || null);
  };

  const addFleetCrew = async () => {
    setFleetAdding(true);
    const { data, error } = await supabase.rpc("fleet_add_crew" as any, { p_crew_email: fleetEmail.trim() });
    setFleetAdding(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) { toast.error(result?.error || "Could not add crew"); return; }
    toast.success("Invite sent — waiting for crew confirmation");
    setFleetEmail("");
    loadFleet();
  };

  useEffect(() => {
    if (companyName) { loadApplicants(); loadFleet(); }
  }, [companyName]);

  // Crew overview is built from the linked fleet (crew_profiles is not readable by managers)
  useEffect(() => {
    const crew = fleet?.ok ? (fleet.crew || []) : [];
    setCrewRows(
      crew.map((c) => ({
        id: c.link_id,
        firstName: c.name,
        lastName: "",
        role: c.rank,
        shipName: c.contract_end ? "On contract" : "—",
        voyageDays: 0,
      }))
    );
  }, [fleet]);


  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "applicants") setDashTab("applicants");
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  const statusMeta = (outcome: string) => {
    switch (outcome) {
      case "awaiting": return { cls: "bg-muted text-muted-foreground", label: "New" };
      case "shortlisted": return { cls: "bg-[#D4AF37]/15 text-[#D4AF37]", label: "⭐ Shortlisted" };
      case "offered": return { cls: "bg-blue-500/15 text-blue-400", label: "📨 Offered" };
      case "placed": return { cls: "bg-green-500/15 text-green-400", label: "⚓ Placed" };
      case "declined":
      case "offer_declined": return { cls: "bg-secondary text-muted-foreground/70", label: "Declined" };
      case "released": return { cls: "bg-muted text-muted-foreground", label: "Released" };
      default: return { cls: "bg-muted text-muted-foreground", label: outcome };
    }
  };

  const renderApplicantActions = (a: Applicant) => {
    const sent = offerSent[a.application_id];
    const { cls: statusClass, label: statusLabel } = statusMeta(a.outcome);
    return (
                        <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass}`}>{statusLabel}</span>
                          {a.outcome === "awaiting" && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleApplicationAction(a.application_id, "shortlist")}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
                              >
                                ⭐ Shortlist
                              </button>
                              <button
                                onClick={() => handleApplicationAction(a.application_id, "decline")}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground border border-border hover:bg-secondary/80 transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {a.outcome === "shortlisted" && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => openOfferDialog(a)}
                                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
                              >
                                Send offer →
                              </button>
                              <button
                                onClick={() => handleApplicationAction(a.application_id, "decline")}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground border border-border hover:bg-secondary/80 transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {a.outcome === "offered" && (
                            <div className="flex flex-col items-start sm:items-end gap-1">
                              {sent && (
                                <>
                                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-500/15 text-green-400">Offer sent ✓</span>
                                  <p className="text-xs text-muted-foreground">
                                    {[sent.vessel_name, sent.joining_date ? `joining ${sent.joining_date}` : "", sent.salary ? `$${sent.salary}` : ""].filter(Boolean).join(" · ")}
                                  </p>
                                </>
                              )}
                              <p className="text-xs text-muted-foreground italic">Waiting for crew to accept…</p>
                            </div>
                          )}
                          {a.outcome === "placed" && (
                            <p className="text-xs text-green-400">🎉 Placed — congratulations!</p>
                          )}
                        </div>
    );
  };

  const renderApplicantCard = (a: Applicant) => (
    <div key={a.application_id} className="bg-secondary/50 rounded-xl border border-border/50 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground">
          {a.crew_name} <span className="font-normal text-muted-foreground">· {a.nationality}</span>
        </p>
        <p className="text-xs text-muted-foreground">{a.rank} · {a.vessel} · {relTime(a.applied_at)}</p>
        {a.available_from && (
          <p className="text-xs text-muted-foreground">Available from {new Date(a.available_from).toLocaleDateString()}</p>
        )}
      </div>
      {renderApplicantActions(a)}
    </div>
  );

  const applicantGroups = (() => {
    const byPosting = new Map<string, Applicant[]>();
    const other: Applicant[] = [];
    applicants.forEach((a) => {
      if (a.job_posting_id) {
        const arr = byPosting.get(a.job_posting_id) || [];
        arr.push(a);
        byPosting.set(a.job_posting_id, arr);
      } else other.push(a);
    });
    const groups = myPostings.map((jp) => ({
      key: jp.id,
      title: [jp.rank_required, jp.vessel_type].filter(Boolean).join(" — ") || "Vacancy",
      meta: `posted ${relTime(jp.created_at)} · ${jp.status || "active"}`,
      items: byPosting.get(jp.id) || [],
    }));
    byPosting.forEach((items, id) => {
      if (!groups.some((g) => g.key === id)) {
        groups.push({ key: id, title: items[0]?.vacancy_label || "Vacancy", meta: "", items });
      }
    });
    if (other.length) groups.push({ key: "other", title: "Other applications", meta: "", items: other });
    return groups;
  })();

  const awaitingCount = applicants.filter((a) => a.outcome === "awaiting").length;


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Anchor size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Manager Dashboard</h1>
            <p className="text-xs text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate("/manager-search")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0D1B2A] text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 transition-colors"
          >
            🔍 Search Crew
          </button>
          <button
            onClick={() => navigate("/manager/interviews")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
          >
            🎓 Arrange Interview
          </button>
          <button
            onClick={() => navigate("/company-post")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
          >
            ✍️ Create Post
          </button>
          <button
            onClick={() => navigate("/post-vacancy")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0D1B2A] text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 transition-colors"
          >
            📢 Post Vacancy
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-6xl lg:max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          <button
            onClick={() => setDashTab("crew")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              dashTab === "crew" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Crew Overview
          </button>
          <button
            onClick={() => setDashTab("applicants")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              dashTab === "applicants" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            👥 Applicants{awaitingCount > 0 ? ` (${awaitingCount})` : ""}
          </button>
          <button
            onClick={() => setDashTab("payments")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              dashTab === "payments" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard size={14} /> Credits & Payments
          </button>
        </div>

        {awaitingCount > 0 && (
          <button
            onClick={() => {
              setDashTab("applicants");
              setTimeout(() => document.getElementById("applicants-section")?.scrollIntoView({ behavior: "smooth" }), 60);
            }}
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/25 transition-colors"
          >
            👥 {awaitingCount} awaiting
          </button>
        )}

        {dashTab === "applicants" ? (
          <>
          {/* My Vacancies */}
          <div className="bg-secondary rounded-xl border border-border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">📢 My Vacancies</h2>
            {myPostings.length === 0 ? (
              <p className="text-xs text-muted-foreground">You have not posted any vacancies yet.</p>
            ) : (
              <div className="space-y-2">
                {myPostings.map((jp) => (
                  <div key={jp.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {[jp.rank_required, jp.vessel_type].filter(Boolean).join(" · ") || "Vacancy"}
                      </p>
                      <p className="text-xs text-muted-foreground">posted {relTime(jp.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{jp.status || "active"}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#D4AF37]/15 text-[#D4AF37]">
                        👥 {applicants.filter((a) => a.job_posting_id === jp.id).length}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div id="applicants-section" className="bg-secondary rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">👥 Applicants</h2>
              <button
                onClick={loadApplicants}
                disabled={applicantsLoading}
                className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                aria-label="Refresh applicants"
              >
                <RefreshCw size={16} className={applicantsLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {applicantGroups.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Applications to your vacancies will appear here.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Post a vacancy to start receiving applications.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applicantGroups.map((g) => {
                  const expanded = openGroups[g.key] ?? g.items.length > 0;
                  return (
                    <div key={g.key} className="rounded-xl border border-border/50 overflow-hidden">
                      <button
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [g.key]: !expanded }))}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-secondary/60 hover:bg-secondary/80 transition-colors text-left"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-foreground truncate">{g.title}</span>
                          {g.meta && <span className="block text-xs text-muted-foreground">{g.meta}</span>}
                        </span>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] shrink-0">
                          👥 {g.items.length}
                        </span>
                      </button>

                      {expanded && (
                        g.items.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-muted-foreground">No applications yet.</p>
                        ) : (
                          <>
                            <div className="hidden lg:block overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/50">
                                    <th className="px-4 py-2 font-medium">Candidate</th>
                                    <th className="px-4 py-2 font-medium">Nationality</th>
                                    <th className="px-4 py-2 font-medium">Rank applied</th>
                                    <th className="px-4 py-2 font-medium">Applied</th>
                                    <th className="px-4 py-2 font-medium">Status</th>
                                    <th className="px-4 py-2 font-medium">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.items.map((a) => (
                                    <tr key={a.application_id} className="border-b border-border/30 last:border-0 align-top">
                                      <td className="px-4 py-3 font-medium text-foreground">{a.crew_name}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{a.nationality}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{a.rank}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{relTime(a.applied_at)}</td>
                                      <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusMeta(a.outcome).cls}`}>
                                          {statusMeta(a.outcome).label}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">{renderApplicantActions(a)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="lg:hidden p-3 space-y-3">
                              {g.items.map((a) => renderApplicantCard(a))}
                            </div>
                          </>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
        ) : dashTab === "payments" ? (
          <ManagerPaymentHistory managerUserId={managerUserId} />
        ) : (
          <>

            {/* My Fleet */}
            <div className="bg-secondary rounded-xl border border-border p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">🚢 My Fleet</h2>

              {fleet?.error === "fleet_subscription_required" ? (
                <div className="bg-secondary/50 rounded-xl border border-[#D4AF37]/30 p-4 space-y-2">
                  <h3 className="text-base font-bold text-[#D4AF37]">Fleet Compliance Dashboard</h3>
                  <p className="text-sm text-muted-foreground">
                    See your crew's MLC rest hours, certificate expiry warnings and CVs in one audit-ready view. Contact SeaMinds to activate your fleet subscription.
                  </p>
                  <button
                    onClick={() => window.open("mailto:info@indossol.com?subject=Fleet subscription")}
                    className="text-xs font-medium px-3 py-2 rounded-lg bg-transparent text-[#D4AF37] border border-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
                  >
                    Contact us
                  </button>
                </div>
              ) : fleet?.ok ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={fleetEmail}
                      onChange={(e) => setFleetEmail(e.target.value)}
                      placeholder="crew@email.com"
                      className="flex-1 bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border"
                    />
                    <button
                      onClick={addFleetCrew}
                      disabled={fleetAdding || !fleetEmail.trim()}
                      className="text-sm font-bold px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Add crew
                    </button>
                  </div>

                  {(fleet.crew || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No linked crew yet — add your crew by email above, or crew placed through SeaMinds link automatically.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {(fleet.crew || []).map((c) => (
                        <div key={c.link_id} className="bg-secondary/50 rounded-xl border border-border/50 p-4 space-y-2">
                          <p className="text-sm font-bold text-foreground">
                            {c.name} <span className="font-normal text-muted-foreground">· {c.rank}{c.nationality ? ` · ${c.nationality}` : ""}</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">📜 {c.certs_total || 0} certs</span>
                            {(c.certs_expiring_90d || 0) > 0 ? (
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/15 text-amber-400">⚠️ {c.certs_expiring_90d} expiring ≤90d</span>
                            ) : (
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/15 text-green-400">✓ Certs OK</span>
                            )}
                          </div>
                          {c.rest_hours_updated ? (
                            <p className="text-xs text-green-400">⏱ Rest hours updated {new Date(c.rest_hours_updated).toLocaleDateString()}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">⏱ No rest-hour records yet</p>
                          )}
                          {c.contract_end && (
                            <p className="text-xs text-muted-foreground">Contract ends {new Date(c.contract_end).toLocaleDateString()}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground/70">
                    You see rest hours, certificates and CV data of linked crew only — wellness data is never shared.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading fleet…</p>
              )}
            </div>

            {/* Emergency / DPA contact */}
            <div className="bg-secondary rounded-xl border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">🆘 Emergency / DPA contact</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={dpaName}
                  onChange={(e) => setDpaName(e.target.value)}
                  placeholder="DPA / contact person name"
                  className="bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border"
                />
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="Emergency phone"
                  className="bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border"
                />
                <input
                  type="email"
                  value={emergencyEmail}
                  onChange={(e) => setEmergencyEmail(e.target.value)}
                  placeholder="Emergency email"
                  className="bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border"
                />
              </div>
              <button
                onClick={saveEmergencyContact}
                disabled={savingEmergency}
                className="text-sm font-bold px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingEmergency ? "Saving…" : "Save"}
              </button>
              <p className="text-xs text-muted-foreground/70">
                Shown to YOUR linked crew in their SOS screen — per ISM practice, crew must always be able to reach their company.
              </p>
            </div>





            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-2xl font-bold text-foreground">{crewRows.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Crew</p>
              </div>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-2xl font-bold text-foreground">{new Set(crewRows.map((r) => r.shipName)).size}</p>
                <p className="text-xs text-muted-foreground mt-1">Vessels</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Name</th>
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Rank</th>
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase cursor-pointer select-none" onClick={() => handleSort("shipName")}>
                        <span className="flex items-center gap-1">Ship <ArrowUpDown size={12} /></span>
                      </th>
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Voyage Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 transition-colors hover:bg-secondary/80">
                        <td className="px-4 py-3 text-foreground font-medium">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.role}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.shipName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.voyageDays > 0 ? `Day ${row.voyageDays}` : "—"}</td>
                      </tr>
                    ))}
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No linked crew yet — add crew in My Fleet above.
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>
            </div>

            {/* Safety Reports */}
            {safetyReports.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileWarning size={18} className="text-red-400" />
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Anonymous Safety Reports</h2>
                  <span className="bg-red-500/15 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">{safetyReports.length}</span>
                </div>
                <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Date</th>
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Ship</th>
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Category</th>
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Description</th>
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {safetyReports.map((report) => (
                          <tr key={report.id} className="border-b border-border/50">
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {new Date(report.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{report.ship_name}</td>
                            <td className="px-4 py-3 text-foreground font-medium capitalize">{report.category}</td>
                            <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{report.description}</td>
                            <td className="px-4 py-3">
                              <select
                                value={report.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value;
                                  const { data, error } = await supabase.rpc("manager_update_safety_status" as any, { p_id: report.id, p_status: newStatus });
                                  const res = data as unknown as { ok?: boolean } | null;
                                  if (error || !res?.ok) { toast.error("Could not update this report"); return; }
                                  setSafetyReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: newStatus } : r));
                                }}
                                className="bg-secondary text-foreground text-xs rounded-lg px-2 py-1 border border-border"
                              >
                                <option value="New">🔴 New</option>
                                <option value="Under Review">🟡 Under Review</option>
                                <option value="Resolved">🟢 Resolved</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Paste-to-Post */}
            <div className="bg-secondary rounded-xl border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">⚡ Paste-to-Post — post a vacancy in 30 seconds</h2>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                maxLength={8000}
                placeholder="Paste your WhatsApp vacancy advert here — exactly as you send it to your groups."
                className="w-full bg-background text-foreground text-sm rounded-xl border border-border p-3 outline-none focus:border-[#D4AF37]/60"
              />
              <p className="text-xs text-muted-foreground">AI reads it and creates your vacancies. You review before publishing.</p>
              <button
                onClick={extractVacancies}
                disabled={extracting}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {extracting ? "Reading advert…" : "Extract vacancies"}
              </button>

              {risk && (risk.level === "medium" || risk.level === "high") && (
                <div
                  className={`rounded-xl border p-3 text-xs ${
                    risk.level === "high"
                      ? "border-red-500/50 bg-red-500/10 text-red-300"
                      : "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  <p className="font-semibold">Please check this advert before publishing.</p>
                  {risk.flags.length > 0 && (
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {risk.flags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {previews.length > 0 && (
                <div className="space-y-3">
                  {previews.map((v, i) => (
                    <div key={i} className="bg-secondary/50 rounded-xl border border-border/50 p-3 space-y-2 relative">
                      <button
                        onClick={() => setPreviews((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label="Discard vacancy"
                        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-sm"
                      >
                        ×
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-6">
                        {([
                          ["rank_required", "Rank"],
                          ["vessel_type", "Vessel type"],
                          ["joining_port", "Joining port"],
                          ["joining_date", "Joining date"],
                          ["contract_duration", "Contract"],
                          ["monthly_salary", "Salary"],
                          ["contact_whatsapp", "WhatsApp"],
                          ["contact_email", "Email"],

                        ] as [keyof ParsedVacancy, string][]).map(([key, label]) => (
                          <label key={key} className="text-xs text-muted-foreground space-y-1">
                            {label}
                            <input
                              value={v[key]}
                              onChange={(e) => updatePreview(i, key, e.target.value)}
                              className="w-full bg-background text-foreground text-xs rounded-lg border border-border px-2 py-1.5 outline-none focus:border-[#D4AF37]/60"
                            />
                            {key === "monthly_salary" && !v.monthly_salary && (
                              <p className="text-[11px] italic text-muted-foreground/70 leading-tight">
                                This line will be published if you leave salary blank.<br />
                                Salary as per international market standards, commensurate with rank and experience. Allowances and terms as per prevailing international market conditions.
                              </p>
                            )}
                          </label>
                        ))}
                      </div>
                      <label className="text-xs text-muted-foreground space-y-1 block">
                        Notes
                        <textarea
                          value={v.additional_notes}
                          onChange={(e) => updatePreview(i, "additional_notes", e.target.value)}
                          rows={2}
                          className="w-full bg-background text-foreground text-xs rounded-lg border border-border px-2 py-1.5 outline-none focus:border-[#D4AF37]/60"
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    onClick={publishPreviews}
                    disabled={publishing}
                    className="text-xs font-bold px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {publishing ? "Publishing…" : "Publish all vacancies"}
                  </button>
                </div>
              )}
            </div>


            {/* Privacy note */}
            <p className="text-xs text-muted-foreground text-center py-4">
              Wellness conversations and mood check-ins are private to each seafarer and are never shown to companies or manning agents. This dashboard shows crew assignments and anonymous safety reports only.
            </p>


            {/* Admin: Free assessment counter */}
            <div className="bg-secondary/50 rounded-xl border border-border px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Free assessments used</span>
              <span className="text-xs font-bold text-primary">153 / 1,000</span>
            </div>
          </>
        )}

        {managerUserId && <MyPostsPanel managerId={managerUserId} />}
      </div>

      {offerFor && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => !offerSending && setOfferFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-5"
            style={{ background: "#0D1B2A", border: "1px solid rgba(212,175,55,0.3)" }}
          >
            <p className="text-base font-extrabold" style={{ color: "#D4AF37" }}>⚓ Offer of Employment</p>
            <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>
              {offerFor.crew_name} · {offerFor.rank}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Vessel name</label>
                <input value={offerForm.vessel_name} onChange={(e) => setOfferForm((f) => ({ ...f, vessel_name: e.target.value }))}
                  className="w-full mt-1 rounded-xl px-3 py-2 text-sm bg-[#112240] text-white border border-[#1e3a5f]" />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Joining port</label>
                <input value={offerForm.joining_port} onChange={(e) => setOfferForm((f) => ({ ...f, joining_port: e.target.value }))}
                  className="w-full mt-1 rounded-xl px-3 py-2 text-sm bg-[#112240] text-white border border-[#1e3a5f]" />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Joining date</label>
                <input type="date" value={offerForm.joining_date} onChange={(e) => setOfferForm((f) => ({ ...f, joining_date: e.target.value }))}
                  className="w-full mt-1 rounded-xl px-3 py-2 text-sm bg-[#112240] text-white border border-[#1e3a5f]" />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Monthly salary USD</label>
                <input value={offerForm.salary} placeholder="as per rank & experience"
                  onChange={(e) => setOfferForm((f) => ({ ...f, salary: e.target.value }))}
                  className="w-full mt-1 rounded-xl px-3 py-2 text-sm bg-[#112240] text-white border border-[#1e3a5f] placeholder:text-[#64748b]" />
              </div>

              <label className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={offerForm.interview_required}
                  onChange={(e) => setOfferForm((f) => ({ ...f, interview_required: e.target.checked }))}
                  className="accent-[#D4AF37] w-4 h-4" />
                Interview required
              </label>
              {offerForm.interview_required && (
                <div>
                  <label className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Interview date (optional — to be advised)</label>
                  <input type="date" value={offerForm.interview_date}
                    onChange={(e) => setOfferForm((f) => ({ ...f, interview_date: e.target.value }))}
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm bg-[#112240] text-white border border-[#1e3a5f]" />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={offerForm.documents_required}
                  onChange={(e) => setOfferForm((f) => ({ ...f, documents_required: e.target.checked }))}
                  className="accent-[#D4AF37] w-4 h-4" />
                Documents upload required on SeaMinds
              </label>

              <div>
                <label className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Message</label>
                <textarea rows={5} value={offerForm.message}
                  onChange={(e) => setOfferForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full mt-1 rounded-xl px-3 py-2 text-sm bg-[#112240] text-white border border-[#1e3a5f] leading-relaxed" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setOfferFor(null)} disabled={offerSending}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold border border-[#D4AF37]/50 text-[#D4AF37] bg-transparent">
                Cancel
              </button>
              <button onClick={sendOffer} disabled={offerSending}
                className="flex-1 rounded-xl py-2.5 text-sm font-extrabold bg-[#D4AF37] text-[#0D1B2A] disabled:opacity-50">
                {offerSending ? "Sending…" : "Send offer →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default ManagerDashboard;
