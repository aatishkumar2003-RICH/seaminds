import { useState, useEffect, useMemo, useRef } from "react";
import MyPostsPanel from "@/components/manager/MyPostsPanel";
import { useNavigate } from "react-router-dom";
import { Anchor, ArrowUpDown, LogOut, FileWarning, CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ManagerPaymentHistory from "@/components/smc/ManagerPaymentHistory";
import {
  type PreviewVacancy,
  type SimilarVacancy,
  toPreviewVacancy,
  loadManagerIdentity,
  scanDuplicates,
  checkWhatsapp,
  publishVacancyBatch,
  uploadOriginalFlier,
  validateJoiningDates,
  ACCEPTED_FLIER_TYPES,
  publishSummary,
} from "@/lib/managerVacancies";

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
  joining_date?: string | null;
  contract_duration?: string | null;
  monthly_salary?: string | null;
  positions?: number | null;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  additional_notes?: string | null;
  expires_at?: string | null;
  posting_batch_id?: string | null;
  source_type?: string | null;
  flier_url?: string | null;
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
  const [flierView, setFlierView] = useState<string | null>(null);
  const [editVacancy, setEditVacancy] = useState<MyPosting | null>(null);
  const [savingVacancy, setSavingVacancy] = useState(false);
  const [editForm, setEditForm] = useState({
    rank_required: "", vessel_type: "", positions: "1", joining_port: "", joining_date: "",
    contract_duration: "", monthly_salary: "", contact_whatsapp: "", contact_email: "", additional_notes: "",
  });
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
  const [previews, setPreviews] = useState<PreviewVacancy[]>([]);
  const [risk, setRisk] = useState<{ level: string; flags: string[] } | null>(null);
  const [readingFlier, setReadingFlier] = useState(false);
  const [sourceType, setSourceType] = useState<"text" | "flier">("text");
  const [similarPending, setSimilarPending] = useState<{ rows: PreviewVacancy[]; skipped: number; similar: SimilarVacancy[] } | null>(null);
  const [flierUrl, setFlierUrl] = useState<string | null>(null);
  const flierInputRef = useRef<HTMLInputElement>(null);

  type ParseResult = { ok?: boolean; error?: string; raw_text?: string; vacancies?: Record<string, unknown>[]; risk?: { level: string; flags: string[] } };

  const applyParseResult = (res: ParseResult, setText: boolean) => {
    const list = (res.vacancies || []).map(toPreviewVacancy);
    if (setText && res.raw_text) setPasteText(res.raw_text.slice(0, 8000));
    setPreviews(list);
    setRisk(res.risk || null);
    setSimilarPending(null);
    if (list.length === 0) toast("No vacancies found");
  };


  const handleParseError = (error: unknown, res?: ParseResult) => {
    if (error) {
      const status = (error as { context?: { status?: number } })?.context?.status;
      if (status === 403) toast.error("Your company account is pending approval");
      else if (status === 429) toast.error("Daily limit reached — try again tomorrow");
      else if (status === 401) toast.error("Please sign in again to continue");
      else toast.error("Could not read that advert");
      return;
    }
    if (res?.error === "not_approved") toast.error("Your company account is pending approval");
    else if (res?.error === "daily_limit") toast.error("Daily limit reached — try again tomorrow");
    else toast.error(res?.error || "Could not read that advert");
  };

  const extractVacancies = async () => {
    const text = pasteText.trim();
    if (!text) { toast.error("Paste an advert first"); return; }
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-vacancy-text", { body: { text: text.slice(0, 8000) } });
      if (error) { handleParseError(error); return; }
      const res = data as ParseResult;
      if (!res?.ok) { handleParseError(null, res); return; }
      setSourceType("text");
      applyParseResult(res, false);
    } finally {
      setExtracting(false);
    }
  };

  const downscaleImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that image"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not read that image"));
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Could not read that image")); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });

  const handleFlierUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_FLIER_TYPES.includes(file.type.toLowerCase())) {
      toast.error("Please upload a JPG, PNG or WEBP image");
      return;
    }
    const identity = await loadManagerIdentity();
    if (!identity?.userId) { toast.error("Loading your company account — please try again"); return; }
    if (!identity.approved) { toast.error("Your company account is pending approval"); return; }
    setReadingFlier(true);
    try {
      const image_base64 = await downscaleImage(file);
      // preserve the ORIGINAL flier; the downscaled copy is only for AI reading
      const upload = await uploadOriginalFlier(file, identity.userId);
      if (!upload.ok) {
        setFlierUrl(null);
        toast.error("Could not preserve the original flyer. Please try uploading again.");
        return;
      }
      setFlierUrl(upload.url);
      const { data, error } = await supabase.functions.invoke("parse-vacancy-text", { body: { image_base64 } });

      if (error) { handleParseError(error); return; }
      const res = data as ParseResult;
      if (!res?.ok) { handleParseError(null, res); return; }
      setSourceType("flier");
      applyParseResult(res, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that flier");
    } finally {
      setReadingFlier(false);
    }
  };


  const updatePreview = (i: number, key: keyof PreviewVacancy, value: string) => {
    setPreviews((prev) => prev.map((p, idx) => {
      if (idx !== i) return p;
      if (key === "positions") {
        const n = parseInt(value.replace(/[^0-9]/g, ""), 10);
        return { ...p, positions: Number.isFinite(n) && n >= 1 ? n : 1 };
      }
      return { ...p, [key]: value };
    }));
  };

  const runPublish = async (rows: PreviewVacancy[], skipped: number, requested: number) => {
    setPublishing(true);
    try {
      const identity = await loadManagerIdentity();
      if (!identity?.approved) { toast.error("Your company account is pending approval"); return; }
      const result = await publishVacancyBatch(rows, identity, sourceType, {
        skipDuplicateScan: true,
        flierUrl: sourceType === "flier" ? flierUrl : null,
      });
      result.requested = requested;
      result.duplicatesSkipped = skipped;
      if (result.failures.length > 0) { toast.error(result.failures.join(" · ")); return; }
      toast.success(publishSummary(result));
      setPasteText("");
      setPreviews([]);
      setRisk(null);
      setSimilarPending(null);
      setFlierUrl(null);
      loadApplicants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish vacancies");
    } finally {
      setPublishing(false);
    }
  };

  const publishPreviews = async () => {
    if (previews.length === 0) return;
    if (sourceType === "flier" && !flierUrl) {
      toast.error("Original flyer is missing — upload the flyer again before publishing.");
      return;
    }
    const dates = validateJoiningDates(previews);

    if (!dates.ok) { toast.error(dates.warnings.join(" · ")); return; }
    const blocked = previews.some((p) => !checkWhatsapp(p.contact_whatsapp).ok);
    if (blocked) { toast.error("Country code required — add +XX (or clear the WhatsApp number) before publishing."); return; }
    setPublishing(true);
    const identity = await loadManagerIdentity();
    if (!identity?.approved) { setPublishing(false); toast.error("Your company account is pending approval"); return; }
    const scan = await scanDuplicates(identity.userId, previews);
    setPublishing(false);
    if (scan.toPublish.length === 0) {
      toast(`0 of ${previews.length} published · ${scan.exactDuplicates.length} exact duplicates skipped`);
      return;
    }
    if (scan.similar.length > 0) {
      setSimilarPending({ rows: scan.toPublish, skipped: scan.exactDuplicates.length, similar: scan.similar });
      return;
    }
    await runPublish(scan.toPublish, scan.exactDuplicates.length, previews.length);
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
        .select("id, rank_required, vessel_type, joining_port, status, created_at, joining_date, contract_duration, monthly_salary, positions, contact_email, contact_whatsapp, additional_notes, expires_at, posting_batch_id, source_type, flier_url")
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
      joining_port: posting?.joining_port || "",
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
    if (error) { setOfferSending(false); toast.error(error.message); return; }
    const result = data as { ok?: boolean; error?: string } | null;
    if (result && !result.ok) { setOfferSending(false); toast.error(result.error || "Could not send offer"); return; }

    const notified = await notifyOffer(applicationId);
    setOfferSending(false);

    setOfferSent((prev) => ({
      ...prev,
      [applicationId]: { vessel_name: offer.vessel_name || "", joining_date: offer.joining_date || "", salary: offer.salary || "" },
    }));
    setOfferFor(null);
    if (notified) {
      toast.success("Offer sent ✓");
    } else {
      toast.error("Offer saved — email delivery failed. The crew can still see it in SeaMinds.", {
        action: { label: "Resend email", onClick: () => resendOfferEmail(applicationId) },
      });
    }
    loadApplicants();
  };

  const notifyOffer = async (applicationId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("notify-application", {
        body: { application_id: applicationId, kind: "offer" },
      });
      if (error) return false;
      const r = data as { ok?: boolean; sent?: boolean } | null;
      return !!(r?.ok && r?.sent === true);
    } catch {
      return false;
    }
  };

  const resendOfferEmail = async (applicationId: string) => {
    const ok = await notifyOffer(applicationId);
    if (ok) toast.success("Offer email sent ✓");
    else toast.error("Email delivery failed — please try again");
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
                              <button
                                onClick={() => resendOfferEmail(a.application_id)}
                                className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
                              >
                                Resend email
                              </button>
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

  // ---------- Vacancy console ----------
  const sourceLabel = (s?: string | null) =>
    s === "text" ? "Text Import" : s === "flier" ? "Flyer" : "Manual";

  const isExpired = (jp: MyPosting) => !!jp.expires_at && new Date(jp.expires_at).getTime() < Date.now();

  const appsFor = (id: string) => applicants.filter((a) => a.job_posting_id === id);

  const vacancyMetrics = (jp: MyPosting) => {
    const linked = appsFor(jp.id);
    const positions = Math.max(Number(jp.positions) || 1, 1);
    const placed = linked.filter((a) => a.outcome === "placed").length;
    const expired = isExpired(jp);
    return {
      positions,
      placed,
      open: Math.max(positions - placed, 0),
      applicantCount: linked.length,
      full: placed >= positions,
      expired,
      displayStatus: jp.status === "filled" ? "filled" : expired ? "Expired" : (jp.status || "active"),
    };
  };

  const consoleStats = useMemo(() => {
    const activeVacancies = myPostings.filter((jp) => jp.status === "active" && !isExpired(jp));
    const linked = applicants.filter((a) => !!a.job_posting_id);
    const in3 = Date.now() + 3 * 86400000;
    return {
      active: activeVacancies.length,
      openPositions: activeVacancies.reduce((sum, jp) => {
        const positions = Math.max(Number(jp.positions) || 1, 1);
        const placed = appsFor(jp.id).filter((a) => a.outcome === "placed").length;
        return sum + Math.max(positions - placed, 0);
      }, 0),
      applicants: linked.length,
      shortlisted: linked.filter((a) => a.outcome === "shortlisted").length,
      offers: linked.filter((a) => a.outcome === "offered").length,
      placed: linked.filter((a) => a.outcome === "placed").length,
      expiring: activeVacancies.filter((jp) => {
        const t = jp.expires_at ? new Date(jp.expires_at).getTime() : 0;
        return t > 0 && t >= Date.now() && t <= in3;
      }).length,
    };
  }, [myPostings, applicants]);

  const vacancyGroups = useMemo(() => {
    const groups: { key: string; batch: boolean; items: MyPosting[] }[] = [];
    const byBatch = new Map<string, MyPosting[]>();
    myPostings.forEach((jp) => {
      if (jp.posting_batch_id) {
        const arr = byBatch.get(jp.posting_batch_id) || [];
        arr.push(jp);
        byBatch.set(jp.posting_batch_id, arr);
      } else {
        groups.push({ key: jp.id, batch: false, items: [jp] });
      }
    });
    byBatch.forEach((items, key) => groups.push({ key, batch: items.length > 1, items }));
    return groups;
  }, [myPostings]);

  const openEditVacancy = (jp: MyPosting) => {
    setEditVacancy(jp);
    setEditForm({
      rank_required: jp.rank_required || "",
      vessel_type: jp.vessel_type || "",
      positions: String(Math.max(Number(jp.positions) || 1, 1)),
      joining_port: jp.joining_port || "",
      joining_date: jp.joining_date || "",
      contract_duration: jp.contract_duration || "",
      monthly_salary: jp.monthly_salary || "",
      contact_whatsapp: jp.contact_whatsapp || "",
      contact_email: jp.contact_email || "",
      additional_notes: jp.additional_notes || "",
    });
  };

  const editLocked = !!editVacancy && appsFor(editVacancy.id).length > 0;

  const saveVacancyEdit = async () => {
    if (!editVacancy || savingVacancy) return;
    const positions = Math.max(parseInt(editForm.positions.replace(/[^0-9]/g, ""), 10) || 1, 1);
    const dateCheck = validateJoiningDates([
      toPreviewVacancy({ rank_required: editForm.rank_required, joining_date: editForm.joining_date }),
    ]);
    if (!dateCheck.ok) { toast.error(dateCheck.warnings.join(" · ")); return; }
    const wa = checkWhatsapp(editForm.contact_whatsapp);
    if (!wa.ok) { toast.error(wa.warning || "Invalid WhatsApp number"); return; }

    setSavingVacancy(true);
    const patch: Record<string, unknown> = {
      positions,
      joining_port: editForm.joining_port.trim() || "Not specified",
      joining_date: editForm.joining_date.trim() || null,
      contract_duration: editForm.contract_duration.trim() || "Not specified",
      monthly_salary: editForm.monthly_salary.trim() || null,
      contact_whatsapp: editForm.contact_whatsapp.trim(),
      contact_email: editForm.contact_email.trim() || null,
      additional_notes: editForm.additional_notes.trim() || null,
    };
    if (!editLocked) {
      patch.rank_required = editForm.rank_required.trim() || "Not specified";
      patch.vessel_type = editForm.vessel_type.trim() || "Not specified";
    }
    const { error } = await supabase.from("job_postings").update(patch as never).eq("id", editVacancy.id);
    setSavingVacancy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vacancy updated ✓");
    setEditVacancy(null);
    loadApplicants();
  };

  const markFilled = async (jp: MyPosting) => {
    const { error } = await supabase.from("job_postings").update({ status: "filled" } as never).eq("id", jp.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as filled ✓");
    loadApplicants();
  };

  const reopenVacancy = async (jp: MyPosting) => {
    const patch: Record<string, unknown> = { status: "active" };
    const cur = jp.expires_at ? new Date(jp.expires_at).getTime() : 0;
    if (!cur || cur < Date.now()) patch.expires_at = new Date(Date.now() + 14 * 86400000).toISOString();
    const { error } = await supabase.from("job_postings").update(patch as never).eq("id", jp.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vacancy reopened ✓");
    loadApplicants();
  };

  const extendVacancy = async (jp: MyPosting) => {
    const base = Math.max(jp.expires_at ? new Date(jp.expires_at).getTime() : 0, Date.now());
    const next = new Date(base + 14 * 86400000).toISOString();
    const { error } = await supabase.from("job_postings").update({ expires_at: next } as never).eq("id", jp.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Extended by 14 days ✓");
    loadApplicants();
  };

  const deleteVacancy = async (jp: MyPosting) => {
    if (appsFor(jp.id).length > 0) {
      toast.error("This vacancy has applications and cannot be deleted. Mark it filled instead.");
      return;
    }
    if (!window.confirm("Delete this vacancy? This cannot be undone.")) return;
    const { error } = await supabase.from("job_postings").delete().eq("id", jp.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vacancy deleted ✓");
    loadApplicants();
  };




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
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={() => navigate("/company-post")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
            >
              ✍️ Create Post
            </button>
            <span className="text-[10px] text-muted-foreground max-w-[240px] leading-snug">
              (Create Post publishes your flier as an advert. To turn a flier into searchable vacancies, use Paste-to-Post below.)
            </span>
          </div>

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
          {/* Manager Vacancy Console */}
          <div className="bg-secondary rounded-xl border border-border p-4 space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">📢 Vacancy Console</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { label: "Active", value: consoleStats.active },
                { label: "Open Positions", value: consoleStats.openPositions },
                { label: "Applicants", value: consoleStats.applicants },
                { label: "Shortlisted", value: consoleStats.shortlisted },
                { label: "Offers", value: consoleStats.offers },
                { label: "Placed", value: consoleStats.placed },
                { label: "Expiring 3d", value: consoleStats.expiring },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-[#D4AF37]/30 bg-[#0D1B2A] px-3 py-2">
                  <p className="text-lg font-bold text-[#D4AF37] leading-none">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {myPostings.length === 0 ? (
              <p className="text-xs text-muted-foreground">You have not posted any vacancies yet.</p>
            ) : (
              <div className="space-y-4">
                {vacancyGroups.map((grp) => (
                  <div key={grp.key} className="space-y-2">
                    {grp.batch && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                        Campaign · {grp.items.length} vacancies
                      </p>
                    )}
                    {grp.items.map((jp) => {
                      const m = vacancyMetrics(jp);
                      return (
                        <div key={jp.id} className="rounded-lg border border-border/50 bg-secondary/50 px-3 py-2 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">
                                {[jp.rank_required, jp.vessel_type].filter(Boolean).join(" · ") || "Vacancy"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {m.positions} position{m.positions === 1 ? "" : "s"} · {m.open} open · 👥 {m.applicantCount} applicants
                              </p>
                              <p className="text-[11px] text-muted-foreground/80">
                                {sourceLabel(jp.source_type)} · {jp.expires_at ? `expires ${new Date(jp.expires_at).toLocaleDateString()}` : "no expiry"}
                              </p>
                              {m.full && <p className="text-[11px] font-semibold text-green-500">All positions filled</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{m.displayStatus}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {jp.flier_url && (
                              <button onClick={() => setFlierView(jp.flier_url!)} className="text-[11px] px-2 py-1 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10">View Flyer</button>
                            )}
                            <button onClick={() => openEditVacancy(jp)} className="text-[11px] px-2 py-1 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10">Edit</button>
                            {jp.status === "filled" ? (
                              <button onClick={() => reopenVacancy(jp)} className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground">Reopen</button>
                            ) : (
                              <button onClick={() => markFilled(jp)} className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground">Mark Filled</button>
                            )}
                            <button onClick={() => extendVacancy(jp)} className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground">Extend 14 Days</button>
                            <button onClick={() => deleteVacancy(jp)} className="text-[11px] px-2 py-1 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10">Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {flierView && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setFlierView(null)}>
              <div className="bg-[#0D1B2A] border border-[#D4AF37]/40 rounded-xl p-3 max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold text-[#D4AF37]">Original Flyer</p>
                  <button onClick={() => setFlierView(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
                </div>
                <img src={flierView} alt="Vacancy flyer" className="w-full h-full max-h-[70vh] object-contain rounded-lg" />
              </div>
            </div>
          )}

          {editVacancy && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-[#0D1B2A] border border-[#D4AF37]/40 rounded-xl p-4 max-w-lg w-full space-y-3 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-[#D4AF37]">Edit Vacancy</p>
                  <button onClick={() => setEditVacancy(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
                </div>
                {editLocked && (
                  <p className="text-[11px] text-muted-foreground">Rank and vessel type cannot be changed after applications are received.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    ["rank_required", "Rank required"],
                    ["vessel_type", "Vessel type"],
                    ["positions", "Positions"],
                    ["joining_port", "Joining port"],
                    ["joining_date", "Joining date (YYYY-MM-DD)"],
                    ["contract_duration", "Contract duration"],
                    ["monthly_salary", "Monthly salary"],
                    ["contact_whatsapp", "Contact WhatsApp"],
                    ["contact_email", "Contact email"],
                  ] as [keyof typeof editForm, string][]).map(([k, label]) => (
                    <label key={k} className="text-[11px] text-muted-foreground space-y-1">
                      <span>{label}</span>
                      <input
                        value={editForm[k]}
                        disabled={editLocked && (k === "rank_required" || k === "vessel_type")}
                        onChange={(e) => setEditForm((p) => ({ ...p, [k]: e.target.value }))}
                        className="w-full text-sm bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground disabled:opacity-50"
                      />
                    </label>
                  ))}
                </div>
                <label className="text-[11px] text-muted-foreground space-y-1 block">
                  <span>Additional notes</span>
                  <textarea
                    value={editForm.additional_notes}
                    onChange={(e) => setEditForm((p) => ({ ...p, additional_notes: e.target.value }))}
                    rows={3}
                    className="w-full text-sm bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditVacancy(null)} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground">Cancel</button>
                  <button onClick={saveVacancyEdit} disabled={savingVacancy} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] disabled:opacity-50">
                    {savingVacancy ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          )}


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
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">⚡ Paste-to-Post — paste text OR upload your flier</h2>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                maxLength={8000}
                placeholder="Paste your WhatsApp vacancy advert here — exactly as you send it to your groups."
                className="w-full bg-background text-foreground text-sm rounded-xl border border-border p-3 outline-none focus:border-[#D4AF37]/60"
              />
              <p className="text-xs text-muted-foreground">This is what SeaMinds read from your flier. Correct anything wrong, then tap Extract vacancies to rebuild — or publish the cards below.</p>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={extractVacancies}
                  disabled={extracting || readingFlier}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {extracting ? "Reading advert…" : "Extract vacancies"}
                </button>
                <button
                  onClick={() => flierInputRef.current?.click()}
                  disabled={extracting || readingFlier}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {readingFlier ? "Reading your flier…" : "📄 Upload flier image"}
                </button>

                <input
                  ref={flierInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFlierUpload}
                />
              </div>
              <p className="text-xs text-muted-foreground">Have a flier? Upload the image and SeaMinds will read it into vacancies.</p>



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
                          ["positions", "Positions"],
                          ["joining_port", "Joining port"],
                          ["joining_date", "Joining date"],
                          ["contract_duration", "Contract"],
                          ["monthly_salary", "Salary"],
                          ["contact_whatsapp", "WhatsApp"],
                          ["contact_email", "Email"],

                        ] as [keyof PreviewVacancy, string][]).map(([key, label]) => (
                          <label key={key} className="text-xs text-muted-foreground space-y-1">
                            {label}
                            <input
                              value={String(v[key] ?? "")}
                              onChange={(e) => updatePreview(i, key, e.target.value)}
                              className="w-full bg-background text-foreground text-xs rounded-lg border border-border px-2 py-1.5 outline-none focus:border-[#D4AF37]/60"
                            />
                            {key === "monthly_salary" && !v.monthly_salary && (
                              <p className="text-[11px] italic text-muted-foreground/70 leading-tight">
                                Not stated — SeaMinds never adds a salary you did not write.
                              </p>
                            )}
                            {key === "contact_whatsapp" && !checkWhatsapp(v.contact_whatsapp).ok && (
                              <p className="text-[11px] text-amber-400 leading-tight">
                                Country code required — add +XX before publishing.
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

                  <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3 text-xs space-y-0.5">
                    <p className="font-semibold text-[#D4AF37]">Applications will go to</p>
                    <p className="text-foreground">Email: {previews.find((p) => p.contact_email)?.contact_email || "—"}</p>
                    <p className="text-foreground">WhatsApp: {previews.find((p) => p.contact_whatsapp)?.contact_whatsapp || "—"}</p>
                  </div>

                  {similarPending && (
                    <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs space-y-2">
                      <p className="font-semibold text-amber-300">Similar active vacancies already exist.</p>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-200/90">
                        {similarPending.similar.map((s) => (
                          <li key={s.id}>{s.rank_required} · {s.vessel_type} · {s.joining_port}</li>
                        ))}
                      </ul>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setSimilarPending(null)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => runPublish(similarPending.rows, similarPending.skipped, previews.length)}
                          disabled={publishing}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] disabled:opacity-50"
                        >
                          {publishing ? "Publishing…" : "Publish Anyway"}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={publishPreviews}
                    disabled={publishing || previews.some((p) => !checkWhatsapp(p.contact_whatsapp).ok)}
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
